import { createHash } from 'crypto';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import {
    airdropEntities,
    airdropEvidenceArtifacts,
    airdropMoodSnapshots,
    airdropSignals,
    contentSources,
    type AirdropEntity,
    type ContentSourcePurpose,
} from '../models/airdrop.model';
import { fetchProtocolDetail } from './defillama.service';
import { normalizeAlias, normalizeSlug } from './entityResolve.service';

const FETCH_TIMEOUT_MS = 8000;
const FETCH_MAX_BYTES = 200_000;
const MAX_CITED_FETCHES = 3;
const SIGNAL_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export interface EvidenceSignalRow {
    id: number;
    sourceId: number | null;
    title: string | null;
    body: string | null;
    url: string | null;
    publishedAt: Date | null;
    signalKind: string | null;
    extractedUrls: string[] | null;
    purpose: ContentSourcePurpose | null;
    sourceKind: string | null;
}

export interface CitedFetchArtifact {
    url: string;
    fetchStatus: 'ok' | 'failed' | 'skipped';
    title: string | null;
    textExcerpt: string | null;
    artifactId: number | null;
}

export interface DefiLlamaMatchSummary {
    matched: boolean;
    name: string | null;
    slug: string | null;
    tvl: number | null;
    url: string | null;
    twitter: string | null;
    category: string | null;
    description: string | null;
}

export interface EvidencePack {
    entity: AirdropEntity;
    signals: EvidenceSignalRow[];
    discoverySourceIds: number[];
    communitySourceIds: number[];
    independentDiscoveryCount: number;
    communityOnly: boolean;
    citedUrls: string[];
    citedFetches: CitedFetchArtifact[];
    defillama: DefiLlamaMatchSummary;
    controversyFlag: boolean;
    moodLabel: string | null;
}

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isAllowedCitedUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        // block obvious non-content
        if (/\.(jpg|jpeg|png|gif|webp|svg|mp4|zip|exe)(\?|$)/i.test(u.pathname)) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * G3: fetch only URLs already present in the evidence pack (cited).
 */
export async function fetchCitedUrl(
    url: string
): Promise<{ ok: boolean; title: string | null; text: string | null; error?: string }> {
    if (!isAllowedCitedUrl(url)) {
        return { ok: false, title: null, text: null, error: 'url_not_allowed' };
    }

    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
                Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
                'User-Agent': 'OnlyAlphaEvidenceBot/1.0',
            },
            redirect: 'follow',
        });

        if (!res.ok) {
            return { ok: false, title: null, text: null, error: `http_${res.status}` };
        }

        const buf = await res.arrayBuffer();
        const slice = buf.byteLength > FETCH_MAX_BYTES ? buf.slice(0, FETCH_MAX_BYTES) : buf;
        const raw = new TextDecoder('utf-8', { fatal: false }).decode(slice);
        const text = stripHtml(raw).slice(0, 4000);
        const titleMatch = raw.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
        const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : null;

        return { ok: text.length > 40, title, text: text || null };
    } catch (err) {
        return {
            ok: false,
            title: null,
            text: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

async function storeEvidenceArtifact(params: {
    entityId: number;
    signalId: number | null;
    artifactType: string;
    url: string;
    title: string | null;
    contentText: string | null;
    fetchStatus: 'pending' | 'ok' | 'failed' | 'skipped';
    provenance: Record<string, unknown>;
}): Promise<number | null> {
    const sourceHash = createHash('sha256')
        .update(`${params.entityId}|${params.url}|${params.artifactType}`)
        .digest('hex');

    try {
        const inserted = await db
            .insert(airdropEvidenceArtifacts)
            .values({
                entityId: params.entityId,
                signalId: params.signalId,
                artifactType: params.artifactType,
                url: params.url.slice(0, 1000),
                title: params.title,
                contentText: params.contentText,
                fetchStatus: params.fetchStatus,
                sourceHash,
                provenance: params.provenance,
                updatedAt: new Date(),
            })
            .returning({ id: airdropEvidenceArtifacts.id });
        return inserted[0]?.id ?? null;
    } catch {
        return null;
    }
}

export async function loadEntitySignals(entityId: number): Promise<EvidenceSignalRow[]> {
    const since = new Date(Date.now() - SIGNAL_LOOKBACK_MS);

    const rows = await db
        .select({
            id: airdropSignals.id,
            sourceId: airdropSignals.sourceId,
            title: airdropSignals.title,
            body: airdropSignals.body,
            url: airdropSignals.url,
            publishedAt: airdropSignals.publishedAt,
            signalKind: airdropSignals.signalKind,
            extractedUrls: airdropSignals.extractedUrls,
            purpose: contentSources.purpose,
            sourceKind: contentSources.kind,
        })
        .from(airdropSignals)
        .leftJoin(contentSources, eq(airdropSignals.sourceId, contentSources.id))
        .where(
            and(
                eq(airdropSignals.entityId, entityId),
                gte(airdropSignals.createdAt, since)
            )
        )
        .orderBy(desc(airdropSignals.createdAt));

    return rows.map((r) => ({
        ...r,
        extractedUrls: Array.isArray(r.extractedUrls)
            ? r.extractedUrls.filter((u): u is string => typeof u === 'string')
            : null,
    }));
}

async function matchDefiLlama(entity: AirdropEntity): Promise<DefiLlamaMatchSummary> {
    const empty: DefiLlamaMatchSummary = {
        matched: false,
        name: null,
        slug: null,
        tvl: null,
        url: null,
        twitter: null,
        category: null,
        description: null,
    };

    const tryNames = [
        entity.defillamaSlug,
        entity.slug,
        entity.canonicalName,
    ].filter((x): x is string => typeof x === 'string' && x.length > 0);

    for (const name of tryNames) {
        const detail = await fetchProtocolDetail(name);
        if (!detail) continue;

        const matchedName = detail.name ?? name;
        // Weak name guard
        const a = normalizeAlias(matchedName);
        const b = normalizeAlias(entity.canonicalName);
        const slugOk =
            normalizeSlug(matchedName) === entity.slug ||
            a === b ||
            a.includes(b) ||
            b.includes(a);

        if (!slugOk && !entity.defillamaSlug) continue;

        return {
            matched: true,
            name: matchedName,
            slug: normalizeSlug(matchedName),
            tvl: typeof detail.tvl === 'number' ? detail.tvl : null,
            url: detail.url,
            twitter: detail.twitter,
            category: detail.category,
            description: detail.description ? detail.description.slice(0, 500) : null,
        };
    }

    return empty;
}

function collectCitedUrls(signals: EvidenceSignalRow[], defillama: DefiLlamaMatchSummary): string[] {
    const urls = new Set<string>();
    for (const s of signals) {
        if (s.url) urls.add(s.url);
        for (const u of s.extractedUrls ?? []) {
            if (u) urls.add(u);
        }
    }
    if (defillama.url) urls.add(defillama.url);
    if (defillama.twitter) {
        const tw = defillama.twitter.startsWith('http')
            ? defillama.twitter
            : `https://twitter.com/${defillama.twitter.replace(/^@/, '')}`;
        urls.add(tw);
    }
    return Array.from(urls).filter(isAllowedCitedUrl).slice(0, 12);
}

/**
 * Build Evidence Pack for an entity: multi-source signals + optional cited fetches + DeFiLlama.
 */
export async function buildEvidencePack(entityId: number): Promise<EvidencePack | null> {
    const entityRows = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.id, entityId))
        .limit(1);
    const entity = entityRows[0];
    if (!entity) return null;

    const signals = await loadEntitySignals(entityId);
    if (signals.length === 0) return null;

    const discoverySourceIds = new Set<number>();
    const communitySourceIds = new Set<number>();

    for (const s of signals) {
        if (s.sourceId === null) continue;
        if (s.purpose === 'airdrop_community') {
            communitySourceIds.add(s.sourceId);
        } else if (s.purpose === 'airdrop_alpha' || s.sourceKind === 'rss') {
            discoverySourceIds.add(s.sourceId);
        } else if (s.signalKind === 'rss_mention' || s.signalKind === 'alpha_mention') {
            discoverySourceIds.add(s.sourceId);
        }
    }

    const independentDiscoveryCount = discoverySourceIds.size;
    const communityOnly = independentDiscoveryCount === 0 && communitySourceIds.size > 0;

    const defillama = await matchDefiLlama(entity);

    // Persist defillama slug when matched
    if (defillama.matched && defillama.slug && !entity.defillamaSlug) {
        try {
            await db
                .update(airdropEntities)
                .set({ defillamaSlug: defillama.slug, updatedAt: new Date() })
                .where(eq(airdropEntities.id, entity.id));
        } catch {
            // ignore
        }
    }

    const citedUrls = collectCitedUrls(signals, defillama);
    const citedFetches: CitedFetchArtifact[] = [];

    // Prefer docs/official-looking URLs first
    const ranked = [...citedUrls].sort((a, b) => {
        const score = (u: string): number => {
            let s = 0;
            if (/docs\.|gitbook|whitepaper|github\.com/i.test(u)) s += 3;
            if (defillama.url && u === defillama.url) s += 2;
            if (/twitter\.com|x\.com/i.test(u)) s += 1;
            return s;
        };
        return score(b) - score(a);
    });

    for (const url of ranked.slice(0, MAX_CITED_FETCHES)) {
        const fetched = await fetchCitedUrl(url);
        const status = fetched.ok ? 'ok' : 'failed';
        const artifactId = await storeEvidenceArtifact({
            entityId: entity.id,
            signalId: null,
            artifactType: 'cited_fetch',
            url,
            title: fetched.title,
            contentText: fetched.text,
            fetchStatus: status,
            provenance: { error: fetched.error ?? null, g3: true },
        });
        citedFetches.push({
            url,
            fetchStatus: status,
            title: fetched.title,
            textExcerpt: fetched.text ? fetched.text.slice(0, 1500) : null,
            artifactId,
        });
    }

    let controversyFlag = false;
    let moodLabel: string | null = null;
    try {
        const mood = await db
            .select()
            .from(airdropMoodSnapshots)
            .where(
                and(
                    eq(airdropMoodSnapshots.entityId, entityId),
                    inArray(airdropMoodSnapshots.moodWindow, ['24h', '7d'])
                )
            )
            .orderBy(desc(airdropMoodSnapshots.computedAt))
            .limit(2);
        for (const m of mood) {
            if (m.controversyFlag) controversyFlag = true;
            if (!moodLabel) moodLabel = m.moodLabel;
        }
    } catch {
        // mood optional
    }

    return {
        entity,
        signals,
        discoverySourceIds: Array.from(discoverySourceIds),
        communitySourceIds: Array.from(communitySourceIds),
        independentDiscoveryCount,
        communityOnly,
        citedUrls,
        citedFetches,
        defillama,
        controversyFlag,
        moodLabel,
    };
}

export function buildUntrustedSourcesBlock(signals: EvidenceSignalRow[], maxSignals = 6): string {
    const chunks: string[] = [];
    for (const s of signals.slice(0, maxSignals)) {
        const body = (s.body ?? s.title ?? '').slice(0, 900);
        chunks.push(
            [
                '<<<UNTRUSTED_SOURCE_BEGIN>>>',
                `signalId=${s.id}`,
                `purpose=${s.purpose ?? 'unknown'}`,
                `kind=${s.sourceKind ?? s.signalKind ?? 'unknown'}`,
                `url=${s.url ?? ''}`,
                `title=${(s.title ?? '').slice(0, 200)}`,
                body,
                '<<<UNTRUSTED_SOURCE_END>>>',
            ].join('\n')
        );
    }
    return chunks.join('\n\n');
}

export function buildStructuredFactsJson(pack: EvidencePack): string {
    const facts = {
        entityId: pack.entity.id,
        canonicalName: pack.entity.canonicalName,
        slug: pack.entity.slug,
        independentDiscoveryCount: pack.independentDiscoveryCount,
        discoverySourceIds: pack.discoverySourceIds,
        communitySourceIds: pack.communitySourceIds,
        communityOnly: pack.communityOnly,
        signalCount: pack.signals.length,
        citedUrls: pack.citedUrls.slice(0, 10),
        controversyFlag: pack.controversyFlag,
        moodLabel: pack.moodLabel,
        signalSummaries: pack.signals.slice(0, 8).map((s) => ({
            id: s.id,
            purpose: s.purpose,
            kind: s.sourceKind ?? s.signalKind,
            title: (s.title ?? '').slice(0, 120),
            url: s.url,
            publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
        })),
    };
    return JSON.stringify(facts);
}

export function buildCitedFetchSummariesJson(pack: EvidencePack): string {
    return JSON.stringify(
        pack.citedFetches.map((f) => ({
            url: f.url,
            fetchStatus: f.fetchStatus,
            title: f.title,
            excerpt: f.textExcerpt ? f.textExcerpt.slice(0, 800) : null,
        }))
    );
}
