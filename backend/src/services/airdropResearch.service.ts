import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
    airdropPipelineRuns,
    airdropProjects,
    type AirdropProject,
} from '../models/airdrop.model';
import { deleteCache, getCache, setCache } from '../config/redis';
import { publicPublishFilter } from './airdropPortfolio.service';
import { AIGateway } from './ai/ai-gateway';
import { PromptFactory } from './ai/prompt-factory';
import { logger } from '../utils/logger';

export type ResearchTier = 'recommended' | 'under_review' | 'not_recommended';

export type EvidenceStrength = 'low' | 'medium' | 'high';

export type PublicVerdictLabel =
    | 'not_recommended'
    | 'under_review'
    | 'high_risk'
    | 'insufficient_evidence'
    | 'failed_legitimacy_checks';

export interface AirdropPublicStats {
    projectsScanned: number;
    recommended: number;
    underReview: number;
    notRecommended: number;
    acceptanceRatePercent: number;
    lastPipelineAt: string | null;
}

export interface AirdropResearchListItem {
    id: number;
    slug: string;
    name: string;
    network: string;
    tier: 'not_recommended' | 'under_review';
    verdictLabel: PublicVerdictLabel;
    evidenceStrength: EvidenceStrength;
    riskVerdict: string | null;
    reasonsPublic: string[];
    analyzedAt: string;
    seoEligible: boolean;
    logoUrl: string | null;
}

export interface AirdropResearchDetail extends AirdropResearchListItem {
    summary: string;
    headline: string;
    websiteUrl: string | null;
    twitterUrl: string | null;
    qualityScore: number | null;
    nfaDisclaimer: string;
    methodologyBlurb: string;
    /** DEC-042 AR-4: AI note for seoEligible only; null if flag off / fail / N/A */
    researchBlurb: string | null;
}

export interface ResearchListResult {
    items: AirdropResearchListItem[];
    page: number;
    limit: number;
    total: number;
    tier: 'not_recommended' | 'under_review';
}

const NFA_DISCLAIMER =
    'Educational research only. Not financial advice. OnlyAlpha does not recommend buying, selling, or farming any asset. Verify every claim independently.';

const METHODOLOGY_BLURB =
    'OnlyAlpha separates social mood from legitimacy. Projects are evaluated with algorithmic Gate-1 safety filters, multi-source evidence density, and Gate-2 structural checks (team/docs/funding consistency). Community hype alone never qualifies a recommendation. This archive documents projects that did not meet our publication bar.';

const CACHE_STATS = 'airdrop:stats:v1';
const CACHE_LIST_PREFIX = 'airdrop:research:list:v1';
const CACHE_DETAIL_PREFIX = 'airdrop:research:detail:v1';
const CACHE_TTL = 120;
const BLURB_MAX_CHARS = 500;
const BLURB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BLURB_UNSAFE_RE =
    /seed\s*phrase|private\s*key|connect\s+wallet\s+to\s+claim|send\s+\d+\s*(eth|bnb|sol)|guaranteed\s+(profit|returns?)/i;

const researchPrompts = new PromptFactory();
const researchGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 45000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

const SHORTENER_OR_PHISH_RE =
    /bit\.ly|tinyurl|t\.co\/|cutt\.ly|rb\.gy|is\.gd|ow\.ly|rebrand\.ly|shorturl|tiny\.cc|goo\.gl|phishing|drainer|claim-airdrop|free-claim/i;

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
}

/** Public research slug from name; append -{id} for uniqueness. */
export function buildResearchSlug(name: string, id: number): string {
    const base = name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 80);
    const stem = base.length > 0 ? base : 'project';
    return `${stem}-${id}`;
}

/** Reject pure hex/random junk names (short + mostly hex/random). */
export function isJunkName(name: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 3) return true;
    const compact = trimmed.replace(/[\s\-_.]/g, '');
    if (compact.length < 3) return true;
    if (/^[0-9a-f]+$/i.test(compact) && compact.length <= 16) return true;
    if (/^[a-z0-9]{8,}$/i.test(compact)) {
        const vowels = (compact.match(/[aeiou]/gi) ?? []).length;
        const digits = (compact.match(/\d/g) ?? []).length;
        if (vowels === 0 && digits >= compact.length * 0.4) return true;
        if (digits >= compact.length * 0.6) return true;
    }
    return false;
}

function urlLooksUnsafe(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return true;
    const t = url.trim();
    if (!t.startsWith('http://') && !t.startsWith('https://')) return true;
    if (SHORTENER_OR_PHISH_RE.test(t)) return true;
    return false;
}

function hasHardScamReason(internalReasons: string[]): boolean {
    return internalReasons.some(
        (r) =>
            /hard_scam|gate1_fail|phishing|scam_pattern|suspicious_short/i.test(r)
    );
}

export function mapReasonsPublic(internalReasons: string[]): string[] {
    const out: string[] = [];
    const push = (msg: string): void => {
        if (!out.includes(msg)) out.push(msg);
    };

    if (internalReasons.length === 0) {
        push('Did not meet OnlyAlpha algorithmic recommendation criteria.');
        return out;
    }

    for (const raw of internalReasons) {
        const r = raw.toLowerCase();
        if (
            r.includes('hard_scam') ||
            r.includes('gate1') ||
            r.includes('phishing') ||
            r.includes('suspicious_short') ||
            r.includes('spam_density') ||
            r.includes('too_short') ||
            r.includes('no_signals')
        ) {
            push(
                'Could not pass safety filters (malicious or phishing-like patterns in source text).'
            );
        } else if (
            r.includes('gate2') ||
            r.includes('not_legitimate') ||
            r.includes('not legitimate') ||
            r.includes('legitimacy')
        ) {
            push(
                'Failed structural legitimacy checks (team, docs, or funding consistency).'
            );
        } else if (
            r.includes('insufficient_evidence') ||
            r.includes('evidence_bar')
        ) {
            push('Not enough independent evidence to recommend farming.');
        } else if (r.includes('community_only')) {
            push('Community hype alone is not enough for a recommendation.');
        } else if (r.includes('quality_below')) {
            push('Signal quality below our publication bar.');
        } else if (r.includes('hard_contradiction') || r.includes('contradiction')) {
            push('Conflicting claims across sources.');
        } else if (r.includes('mood_controversy') || r.includes('controversy')) {
            push('Conflicting claims across sources.');
        } else if (r.includes('publish_rule')) {
            // skip success reasons
        } else {
            push('Did not meet OnlyAlpha algorithmic recommendation criteria.');
        }
    }

    if (out.length === 0) {
        push('Did not meet OnlyAlpha algorithmic recommendation criteria.');
    }
    return out.slice(0, 6);
}

export function computeEvidenceStrength(
    provenance: Record<string, unknown>,
    websiteUrl: string | null,
    twitterUrl: string | null
): EvidenceStrength {
    const independent =
        typeof provenance['independentDiscoveryCount'] === 'number'
            ? provenance['independentDiscoveryCount']
            : 0;
    const defi = provenance['defillamaMatched'] === true;
    if (independent >= 2 || defi) return 'high';
    if (independent === 1) return 'medium';
    if (websiteUrl && twitterUrl) return 'medium';
    return 'low';
}

export function computeVerdictLabel(params: {
    tier: 'not_recommended' | 'under_review';
    riskVerdict: string | null;
    internalReasons: string[];
}): PublicVerdictLabel {
    const { tier, riskVerdict, internalReasons } = params;
    if (tier === 'under_review') {
        if (
            internalReasons.some(
                (r) =>
                    /insufficient_evidence|evidence_bar/i.test(r)
            )
        ) {
            return 'insufficient_evidence';
        }
        return 'under_review';
    }
    const rv = (riskVerdict ?? '').toUpperCase();
    if (rv === 'SCAM' || hasHardScamReason(internalReasons)) {
        return 'high_risk';
    }
    if (
        internalReasons.some((r) => /gate2|legitimacy|not_legitimate/i.test(r))
    ) {
        return 'failed_legitimacy_checks';
    }
    return 'not_recommended';
}

function safeWebsite(
    url: string | null | undefined,
    redact: boolean
): string | null {
    if (redact) return null;
    if (!url || urlLooksUnsafe(url)) return null;
    return url.slice(0, 300);
}

function safeTwitter(
    url: string | null | undefined,
    redact: boolean
): string | null {
    if (redact) return null;
    if (!url) return null;
    const t = url.trim();
    if (!t.startsWith('http')) {
        const handle = t.replace(/^@/, '');
        if (!/^[A-Za-z0-9_]{1,50}$/.test(handle)) return null;
        return `https://twitter.com/${handle}`;
    }
    if (urlLooksUnsafe(t) && !/twitter\.com|x\.com/i.test(t)) return null;
    if (!/twitter\.com|x\.com/i.test(t)) return null;
    return t.slice(0, 300);
}

export function computeSeoEligible(params: {
    pipelineStatus: string;
    publishPath: string;
    name: string;
    websiteUrl: string | null;
    twitterUrl: string | null;
    provenance: Record<string, unknown>;
    reasonsPublic: string[];
    redactLinks: boolean;
}): boolean {
    if (
        params.pipelineStatus !== 'rejected' ||
        params.publishPath !== 'reject'
    ) {
        return false;
    }
    if (isJunkName(params.name)) return false;
    if (params.reasonsPublic.length < 1) return false;

    const site = safeWebsite(params.websiteUrl, params.redactLinks);
    const tw = safeTwitter(params.twitterUrl, params.redactLinks);
    const independent =
        typeof params.provenance['independentDiscoveryCount'] === 'number'
            ? params.provenance['independentDiscoveryCount']
            : 0;
    const defi = params.provenance['defillamaMatched'] === true;

    return Boolean(site || tw || defi || independent >= 2);
}

function buildHeadline(
    name: string,
    tier: 'not_recommended' | 'under_review'
): string {
    if (tier === 'under_review') return `${name} — Under Review`;
    return `${name} — Not Recommended`;
}

function buildSummary(reasonsPublic: string[]): string {
    const head =
        reasonsPublic[0] ??
        'Did not meet OnlyAlpha algorithmic recommendation criteria.';
    const second =
        reasonsPublic[1] != null ? ` ${reasonsPublic[1]}` : '';
    return `${head}${second} Educational research only. Not financial advice.`;
}

function projectToResearchItem(project: AirdropProject): AirdropResearchListItem | null {
    const isRejected =
        project.pipelineStatus === 'rejected' && project.publishPath === 'reject';
    const isHold =
        project.pipelineStatus === 'hold_recheck' ||
        project.publishPath === 'hold_recheck';

    if (!isRejected && !isHold) return null;

    const tier: 'not_recommended' | 'under_review' = isRejected
        ? 'not_recommended'
        : 'under_review';

    const provenance = asRecord(project.provenanceSummary);
    const internalReasons = asStringArray(provenance['reasons']);
    const reasonsPublic = mapReasonsPublic(internalReasons);
    const redactLinks =
        hasHardScamReason(internalReasons) ||
        (project.riskVerdict ?? '').toUpperCase() === 'SCAM';

    const websiteSafe = safeWebsite(project.websiteUrl, redactLinks);
    const twitterSafe = safeTwitter(project.twitterUrl, redactLinks);

    const seoEligible =
        tier === 'under_review'
            ? false
            : computeSeoEligible({
                  pipelineStatus: project.pipelineStatus,
                  publishPath: project.publishPath,
                  name: project.name,
                  websiteUrl: project.websiteUrl,
                  twitterUrl: project.twitterUrl,
                  provenance,
                  reasonsPublic,
                  redactLinks,
              });

    return {
        id: project.id,
        slug: buildResearchSlug(project.name, project.id),
        name: project.name,
        network: project.network,
        tier,
        verdictLabel: computeVerdictLabel({
            tier,
            riskVerdict: project.riskVerdict,
            internalReasons,
        }),
        evidenceStrength: computeEvidenceStrength(
            provenance,
            websiteSafe,
            twitterSafe
        ),
        riskVerdict: project.riskVerdict,
        reasonsPublic,
        analyzedAt: (project.updatedAt ?? project.createdAt).toISOString(),
        seoEligible,
        logoUrl: project.logoUrl,
    };
}

function readStoredBlurb(provenance: Record<string, unknown>): string | null {
    const blurb = provenance['researchBlurb'];
    if (typeof blurb !== 'string') return null;
    const trimmed = blurb.trim();
    if (!trimmed || trimmed.length < 20) return null;
    const atRaw = provenance['researchBlurbAt'];
    if (typeof atRaw === 'string') {
        const at = Date.parse(atRaw);
        if (!Number.isNaN(at) && Date.now() - at > BLURB_TTL_MS) {
            return null;
        }
    }
    return sanitizeBlurb(trimmed);
}

function sanitizeBlurb(raw: string): string | null {
    let t = raw.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (BLURB_UNSAFE_RE.test(t)) return null;
    if (t.length > BLURB_MAX_CHARS) t = `${t.slice(0, BLURB_MAX_CHARS - 1)}…`;
    if (t.length < 20) return null;
    return t;
}

function projectToResearchDetail(project: AirdropProject): AirdropResearchDetail | null {
    const item = projectToResearchItem(project);
    if (!item) return null;

    const provenance = asRecord(project.provenanceSummary);
    const internalReasons = asStringArray(provenance['reasons']);
    const redactLinks =
        hasHardScamReason(internalReasons) ||
        (project.riskVerdict ?? '').toUpperCase() === 'SCAM';

    const storedBlurb =
        env.AIRDROP_RESEARCH_BLURB_ENABLED &&
        item.seoEligible &&
        item.tier === 'not_recommended'
            ? readStoredBlurb(provenance)
            : null;

    return {
        ...item,
        summary: buildSummary(item.reasonsPublic),
        headline: buildHeadline(project.name, item.tier),
        websiteUrl: safeWebsite(project.websiteUrl, redactLinks),
        twitterUrl: safeTwitter(project.twitterUrl, redactLinks),
        qualityScore: project.qualityScore ?? null,
        nfaDisclaimer: NFA_DISCLAIMER,
        methodologyBlurb: METHODOLOGY_BLURB,
        researchBlurb: storedBlurb,
    };
}

/**
 * DEC-042 AR-4: lazy AI blurb for seoEligible not_recommended only.
 * Stores in provenanceSummary.researchBlurb (+ researchBlurbAt). Budget: skip if fresh cache.
 */
async function ensureResearchBlurb(
    project: AirdropProject,
    detail: AirdropResearchDetail
): Promise<string | null> {
    if (!env.AIRDROP_RESEARCH_BLURB_ENABLED) return detail.researchBlurb;
    if (detail.tier !== 'not_recommended' || !detail.seoEligible) return null;
    if (detail.researchBlurb) return detail.researchBlurb;

    if (!env.OPENROUTER_API_KEY) {
        logger.warn('[ResearchBlurb] skipped — no OPENROUTER_API_KEY');
        return null;
    }

    try {
        const messages = researchPrompts.buildAirdropResearchBlurbMessages({
            name: detail.name,
            network: detail.network,
            verdictLabel: detail.verdictLabel,
            evidenceStrength: detail.evidenceStrength,
            reasonsPublic: detail.reasonsPublic,
            qualityScore: detail.qualityScore,
        });

        const raw = await researchGateway.chat<Record<string, unknown>>({
            model: env.WRITER_MODEL,
            temperature: 0.35,
            responseFormat: { type: 'json_object' },
            messages,
            maxTokens: 400,
            maxRetries: 1,
        });

        const blurbRaw =
            typeof raw['blurb'] === 'string'
                ? raw['blurb']
                : typeof raw['text'] === 'string'
                  ? raw['text']
                  : '';
        const blurb = sanitizeBlurb(blurbRaw);
        if (!blurb) return null;

        const prev = asRecord(project.provenanceSummary);
        const nextProvenance: Record<string, unknown> = {
            ...prev,
            researchBlurb: blurb,
            researchBlurbAt: new Date().toISOString(),
        };

        await db
            .update(airdropProjects)
            .set({
                provenanceSummary: nextProvenance,
                updatedAt: new Date(),
            })
            .where(eq(airdropProjects.id, project.id));

        try {
            await deleteCache(`${CACHE_DETAIL_PREFIX}:${detail.slug}`);
        } catch {
            // non-blocking
        }

        return blurb;
    } catch (err) {
        logger.error(
            '[ResearchBlurb] AI failed for project=%s: %s',
            project.id,
            err instanceof Error ? err.message : String(err)
        );
        return null;
    }
}

async function finalizeDetail(
    project: AirdropProject,
    detail: AirdropResearchDetail
): Promise<AirdropResearchDetail> {
    const blurb = await ensureResearchBlurb(project, detail);
    if (blurb === detail.researchBlurb) return detail;
    return { ...detail, researchBlurb: blurb };
}

/**
 * Public hub stats. projectsScanned = total airdrop_projects rows (all pipeline states).
 */
export async function getAirdropPublicStats(): Promise<AirdropPublicStats> {
    const cached = await getCache<AirdropPublicStats>(CACHE_STATS);
    if (cached) return cached;

    const [recommendedRow] = await db
        .select({ cnt: count() })
        .from(airdropProjects)
        .where(publicPublishFilter);

    const [underReviewRow] = await db
        .select({ cnt: count() })
        .from(airdropProjects)
        .where(eq(airdropProjects.pipelineStatus, 'hold_recheck'));

    const [notRecommendedRow] = await db
        .select({ cnt: count() })
        .from(airdropProjects)
        .where(eq(airdropProjects.pipelineStatus, 'rejected'));

    const [scannedRow] = await db
        .select({ cnt: count() })
        .from(airdropProjects);

    const [latestRun] = await db
        .select({ runAt: airdropPipelineRuns.runAt })
        .from(airdropPipelineRuns)
        .orderBy(desc(airdropPipelineRuns.runAt))
        .limit(1);

    const recommended = Number(recommendedRow?.cnt ?? 0);
    const underReview = Number(underReviewRow?.cnt ?? 0);
    const notRecommended = Number(notRecommendedRow?.cnt ?? 0);
    const denom = Math.max(1, recommended + underReview + notRecommended);
    const acceptanceRatePercent =
        Math.round((recommended / denom) * 1000) / 10;

    const stats: AirdropPublicStats = {
        projectsScanned: Number(scannedRow?.cnt ?? 0),
        recommended,
        underReview,
        notRecommended,
        acceptanceRatePercent,
        lastPipelineAt: latestRun?.runAt ? latestRun.runAt.toISOString() : null,
    };

    await setCache(CACHE_STATS, stats, CACHE_TTL);
    return stats;
}

export async function listResearchArchive(params: {
    tier?: 'not_recommended' | 'under_review';
    page?: number;
    limit?: number;
}): Promise<ResearchListResult> {
    const tier = params.tier === 'under_review' ? 'under_review' : 'not_recommended';
    const page = Math.max(1, params.page ?? 1);
    let limit = Math.max(1, params.limit ?? 20);
    if (tier === 'under_review') {
        limit = Math.min(limit, 50);
    } else {
        limit = Math.min(limit, 50);
    }

    const cacheKey = `${CACHE_LIST_PREFIX}:${tier}:${page}:${limit}`;
    const cached = await getCache<ResearchListResult>(cacheKey);
    if (cached) return cached;

    const status = tier === 'under_review' ? 'hold_recheck' : 'rejected';

    const rows = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.pipelineStatus, status))
        .orderBy(desc(airdropProjects.updatedAt))
        .limit(500);

    const mapped: AirdropResearchListItem[] = [];
    for (const row of rows) {
        const item = projectToResearchItem(row);
        if (!item) continue;
        if (tier === 'not_recommended' && !item.seoEligible) continue;
        if (item.tier !== tier) continue;
        mapped.push(item);
    }

    const total = mapped.length;
    const start = (page - 1) * limit;
    const items = mapped.slice(start, start + limit);

    const result: ResearchListResult = { items, page, limit, total, tier };
    await setCache(cacheKey, result, CACHE_TTL);
    return result;
}

export async function getResearchBySlug(
    slug: string
): Promise<AirdropResearchDetail | null> {
    const normalized = slug.trim().toLowerCase().slice(0, 120);
    if (!normalized) return null;

    const cacheKey = `${CACHE_DETAIL_PREFIX}:${normalized}`;
    const cached = await getCache<AirdropResearchDetail | { __miss: true }>(
        cacheKey
    );
    if (cached && '__miss' in cached) return null;
    if (cached) return cached as AirdropResearchDetail;

    // Prefer id suffix: name-{id}
    const idMatch = normalized.match(/-(\d+)$/);
    if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        if (!isNaN(id)) {
            const [row] = await db
                .select()
                .from(airdropProjects)
                .where(eq(airdropProjects.id, id))
                .limit(1);
            if (row) {
                const base = projectToResearchDetail(row);
                if (base && base.slug === normalized) {
                    if (
                        base.tier === 'not_recommended' &&
                        !base.seoEligible
                    ) {
                        await setCache(cacheKey, { __miss: true }, CACHE_TTL);
                        return null;
                    }
                    const detail = await finalizeDetail(row, base);
                    await setCache(cacheKey, detail, CACHE_TTL);
                    return detail;
                }
            }
        }
    }

    // Fallback scan recent rejects/holds (bounded)
    const rows = await db
        .select()
        .from(airdropProjects)
        .where(
            sql`${airdropProjects.pipelineStatus} IN ('rejected', 'hold_recheck')`
        )
        .orderBy(desc(airdropProjects.updatedAt))
        .limit(800);

    for (const row of rows) {
        const base = projectToResearchDetail(row);
        if (!base) continue;
        if (base.slug !== normalized) continue;
        if (base.tier === 'not_recommended' && !base.seoEligible) {
            await setCache(cacheKey, { __miss: true }, CACHE_TTL);
            return null;
        }
        const detail = await finalizeDetail(row, base);
        await setCache(cacheKey, detail, CACHE_TTL);
        return detail;
    }

    await setCache(cacheKey, { __miss: true }, 60);
    return null;
}

/** Sitemap helpers — eligible not_recommended slugs only. */
export async function listSeoEligibleResearchSlugs(): Promise<
    Array<{ slug: string; updatedAt: string }>
> {
    const cacheKey = `${CACHE_LIST_PREFIX}:seo-slugs`;
    const cached = await getCache<Array<{ slug: string; updatedAt: string }>>(
        cacheKey
    );
    if (cached) return cached;

    const rows = await db
        .select()
        .from(airdropProjects)
        .where(
            and(
                eq(airdropProjects.pipelineStatus, 'rejected'),
                eq(airdropProjects.publishPath, 'reject')
            )
        )
        .orderBy(desc(airdropProjects.updatedAt))
        .limit(500);

    const out: Array<{ slug: string; updatedAt: string }> = [];
    for (const row of rows) {
        const item = projectToResearchItem(row);
        if (!item || !item.seoEligible) continue;
        out.push({ slug: item.slug, updatedAt: item.analyzedAt });
    }

    await setCache(cacheKey, out, CACHE_TTL);
    return out;
}
