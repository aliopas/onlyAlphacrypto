import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import {
    airdropEvidenceArtifacts,
    airdropMoodSnapshots,
    airdropProjects,
    airdropSignals,
    airdropTasks,
    type AirdropMoodLabel,
    type AirdropProject,
} from '../models/airdrop.model';

/** Public eligibility (DEC-041 AD-4): algorithmic publish only */
export const publicPublishFilter = and(
    eq(airdropProjects.isActive, true),
    eq(airdropProjects.pipelineStatus, 'active'),
    eq(airdropProjects.publishPath, 'auto_publish')
);

export interface PortfolioMoodStrip {
    window: '24h' | '7d';
    moodLabel: AirdropMoodLabel;
    mentionCount: number;
    uniqueSourceCount: number;
    hypeScore: number;
    fudScore: number;
    controversyFlag: boolean;
    computedAt: string | null;
}

export interface PortfolioDateSignal {
    kind: string;
    isoDate: string | null;
    raw?: string;
    confidence: 'low' | 'medium' | 'high';
}

export interface PortfolioProvenanceLink {
    label: string;
    url: string;
    kind: 'signal' | 'cited' | 'official' | 'social';
}

export interface PortfolioTaskItem {
    id: number | null;
    description: string;
    isAutoVerifiable: boolean;
    chain: string | null;
}

export interface AirdropPortfolioCard {
    id: number;
    name: string;
    network: string;
    logoUrl: string | null;
    ecosystem: string | null;
    effortLevel: string | null;
    rewardConfidence: string | null;
    qualityScore: number;
    riskVerdict: string | null;
    estValue: string | null;
    isActive: boolean;
    pipelineStatus: string;
    publishPath: string;
    snapshotAt: string | null;
    tgeAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** Why farm now — evidence-backed, NFA */
    whyFarmNow: string;
    teamSummary: string;
    docsSummary: string;
    fundingSummary: string;
    howItWorks: string;
    tasks: PortfolioTaskItem[];
    dates: PortfolioDateSignal[];
    mood: {
        strip24h: PortfolioMoodStrip | null;
        strip7d: PortfolioMoodStrip | null;
    };
    provenanceLinks: PortfolioProvenanceLink[];
    websiteUrl: string | null;
    twitterUrl: string | null;
    discordUrl: string | null;
    fundingRound: string | null;
    aiReport: string | null;
    nfaDisclaimer: string;
}

function iso(d: Date | null | undefined): string | null {
    if (!d) return null;
    return d.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function buildWhyFarmNow(project: AirdropProject, mood: PortfolioMoodStrip | null): string {
    const parts: string[] = [];
    const report = (project.aiReport ?? '').trim();
    if (report) {
        parts.push(report.length > 280 ? `${report.slice(0, 280)}…` : report);
    } else {
        parts.push(
            `${project.name} passed algorithmic legitimacy gates with multi-source evidence. Not financial advice.`
        );
    }
    if (project.estValue && !/^tbd$/i.test(project.estValue)) {
        parts.push(`Estimated range cited by sources: ${project.estValue}.`);
    }
    if (mood && (mood.moodLabel === 'hot' || mood.moodLabel === 'warming')) {
        parts.push(
            `Social mood (${mood.window}): ${mood.moodLabel} — popularity only, not a legitimacy signal.`
        );
    }
    if (project.snapshotAt || project.tgeAt) {
        const d = project.snapshotAt ?? project.tgeAt;
        parts.push(
            `Tracked date signal around ${d ? d.toISOString().slice(0, 10) : 'unknown'} — verify on official channels.`
        );
    }
    return parts.join(' ');
}

function buildTeamSummary(project: AirdropProject, provenance: Record<string, unknown>): string {
    const bits: string[] = [];
    if (project.fundingRound) bits.push(`Funding/round signal: ${project.fundingRound}.`);
    if (project.websiteUrl) bits.push('Official site present in evidence pack.');
    if (project.twitterUrl) bits.push('Social account linked from evidence.');
    const team = provenance['teamSubstance'];
    if (typeof team === 'string') bits.push(`Team substance (Gate-2): ${team}.`);
    if (bits.length === 0) {
        return 'Team details limited in current evidence pack — held projects stay non-public until stronger proof.';
    }
    return bits.join(' ');
}

function buildDocsSummary(project: AirdropProject, provenance: Record<string, unknown>): string {
    if (project.websiteUrl) {
        return `Documentation / site URL available: ${project.websiteUrl}. Always verify contracts and claim pages independently.`;
    }
    const docs = provenance['docsPresent'];
    if (docs === true) return 'Docs/whitepaper signals were present in the evidence pack at publish time.';
    return 'No strong docs URL in pack at publish — quality passed via other evidence bars (multi-source / DeFiLlama).';
}

function buildFundingSummary(project: AirdropProject, provenance: Record<string, unknown>): string {
    if (project.fundingRound) return project.fundingRound;
    if (provenance['defillamaMatched'] === true) {
        return 'DeFiLlama protocol match contributed to the evidence bar (TVL/protocol reality).';
    }
    return 'No dedicated funding round string on file.';
}

function buildHowItWorks(project: AirdropProject, tasks: PortfolioTaskItem[]): string {
    if (tasks.length > 0) {
        return `Typical path: complete the listed tasks on ${project.network}. Task list is informational (NFA) — confirm steps on official docs before interacting.`;
    }
    const report = (project.aiReport ?? '').trim();
    if (report) return report.slice(0, 400);
    return `Monitor official channels for eligibility criteria on ${project.network}. OnlyAlpha does not execute transactions for you.`;
}

function parseDateSignalsFromProvenanceAndProject(
    project: AirdropProject,
    moodDates: unknown
): PortfolioDateSignal[] {
    const out: PortfolioDateSignal[] = [];
    if (project.snapshotAt) {
        out.push({
            kind: 'snapshot',
            isoDate: project.snapshotAt.toISOString(),
            confidence: 'medium',
        });
    }
    if (project.tgeAt) {
        out.push({
            kind: 'tge',
            isoDate: project.tgeAt.toISOString(),
            confidence: 'medium',
        });
    }
    if (Array.isArray(moodDates)) {
        for (const item of moodDates.slice(0, 10)) {
            if (!item || typeof item !== 'object') continue;
            const rec = item as Record<string, unknown>;
            const kind = typeof rec.kind === 'string' ? rec.kind : 'unclear';
            const isoDate = typeof rec.isoDate === 'string' ? rec.isoDate : null;
            if (out.some((d) => d.kind === kind && d.isoDate === isoDate)) continue;
            out.push({
                kind,
                isoDate,
                raw: typeof rec.raw === 'string' ? rec.raw : undefined,
                confidence: isoDate ? 'medium' : 'low',
            });
        }
    }
    return out.slice(0, 12);
}

function moodFromRow(row: {
    moodWindow: '24h' | '7d';
    moodLabel: AirdropMoodLabel;
    mentionCount: number;
    uniqueSourceCount: number;
    hypeScore: number;
    fudScore: number;
    controversyFlag: boolean;
    computedAt: Date | null;
}): PortfolioMoodStrip {
    return {
        window: row.moodWindow,
        moodLabel: row.moodLabel,
        mentionCount: row.mentionCount,
        uniqueSourceCount: row.uniqueSourceCount,
        hypeScore: row.hypeScore,
        fudScore: row.fudScore,
        controversyFlag: row.controversyFlag,
        computedAt: iso(row.computedAt),
    };
}

/**
 * Build full portfolio card for a publish-eligible project.
 */
export async function buildPortfolioCard(project: AirdropProject): Promise<AirdropPortfolioCard> {
    const provenance = asRecord(project.provenanceSummary);

    const taskRows = await db
        .select()
        .from(airdropTasks)
        .where(eq(airdropTasks.projectId, project.id))
        .orderBy(airdropTasks.orderIndex);

    let tasks: PortfolioTaskItem[] = taskRows.map((t) => ({
        id: t.id,
        description: t.description,
        isAutoVerifiable: t.isAutoVerifiable ?? false,
        chain: t.chain,
    }));

    // Soft tasks from aiReport bullets if no DB tasks
    if (tasks.length === 0 && project.aiReport) {
        const lines = project.aiReport
            .split(/[.\n]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 15 && s.length < 160)
            .slice(0, 3);
        tasks = lines.map((description) => ({
            id: null,
            description,
            isAutoVerifiable: false,
            chain: null,
        }));
    }

    let strip24h: PortfolioMoodStrip | null = null;
    let strip7d: PortfolioMoodStrip | null = null;
    let moodDateSignals: unknown = [];

    if (project.entityId) {
        const moods = await db
            .select()
            .from(airdropMoodSnapshots)
            .where(eq(airdropMoodSnapshots.entityId, project.entityId))
            .orderBy(desc(airdropMoodSnapshots.computedAt))
            .limit(8);

        for (const m of moods) {
            if (m.moodWindow === '24h' && !strip24h) {
                strip24h = moodFromRow(m);
                moodDateSignals = m.dateSignals;
            }
            if (m.moodWindow === '7d' && !strip7d) {
                strip7d = moodFromRow(m);
                if (!moodDateSignals || (Array.isArray(moodDateSignals) && moodDateSignals.length === 0)) {
                    moodDateSignals = m.dateSignals;
                }
            }
        }
    }

    const provenanceLinks: PortfolioProvenanceLink[] = [];
    const pushLink = (label: string, url: string | null | undefined, kind: PortfolioProvenanceLink['kind']): void => {
        if (!url || !url.startsWith('http')) return;
        if (provenanceLinks.some((l) => l.url === url)) return;
        provenanceLinks.push({ label, url: url.slice(0, 1000), kind });
    };

    pushLink('Website', project.websiteUrl, 'official');
    pushLink('Twitter', project.twitterUrl, 'social');
    pushLink('Discord', project.discordUrl, 'social');

    if (project.entityId) {
        const signals = await db
            .select({
                id: airdropSignals.id,
                title: airdropSignals.title,
                url: airdropSignals.url,
            })
            .from(airdropSignals)
            .where(eq(airdropSignals.entityId, project.entityId))
            .orderBy(desc(airdropSignals.createdAt))
            .limit(6);

        for (const s of signals) {
            pushLink((s.title ?? `Signal #${s.id}`).slice(0, 80), s.url, 'signal');
        }

        const arts = await db
            .select({
                title: airdropEvidenceArtifacts.title,
                url: airdropEvidenceArtifacts.url,
                fetchStatus: airdropEvidenceArtifacts.fetchStatus,
            })
            .from(airdropEvidenceArtifacts)
            .where(
                and(
                    eq(airdropEvidenceArtifacts.entityId, project.entityId),
                    eq(airdropEvidenceArtifacts.fetchStatus, 'ok')
                )
            )
            .orderBy(desc(airdropEvidenceArtifacts.createdAt))
            .limit(5);

        for (const a of arts) {
            pushLink((a.title ?? 'Cited source').slice(0, 80), a.url, 'cited');
        }
    }

    const primaryMood = strip24h ?? strip7d;

    return {
        id: project.id,
        name: project.name,
        network: project.network,
        logoUrl: project.logoUrl,
        ecosystem: project.ecosystem,
        effortLevel: project.effortLevel,
        rewardConfidence: project.rewardConfidence,
        qualityScore: project.qualityScore ?? 0,
        riskVerdict: project.riskVerdict,
        estValue: project.estValue,
        isActive: project.isActive ?? false,
        pipelineStatus: project.pipelineStatus,
        publishPath: project.publishPath,
        snapshotAt: iso(project.snapshotAt),
        tgeAt: iso(project.tgeAt),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        whyFarmNow: buildWhyFarmNow(project, primaryMood),
        teamSummary: buildTeamSummary(project, provenance),
        docsSummary: buildDocsSummary(project, provenance),
        fundingSummary: buildFundingSummary(project, provenance),
        howItWorks: buildHowItWorks(project, tasks),
        tasks,
        dates: parseDateSignalsFromProvenanceAndProject(project, moodDateSignals),
        mood: { strip24h, strip7d },
        provenanceLinks: provenanceLinks.slice(0, 12),
        websiteUrl: project.websiteUrl,
        twitterUrl: project.twitterUrl,
        discordUrl: project.discordUrl,
        fundingRound: project.fundingRound,
        aiReport: project.aiReport,
        nfaDisclaimer:
            'Not financial advice. Airdrops are speculative; never share seed phrases or send funds to “claim” sites. Verify every URL independently.',
    };
}

/** List-card projection (lighter than full detail) */
export function toPortfolioListItem(card: AirdropPortfolioCard): Record<string, unknown> {
    return {
        id: card.id,
        name: card.name,
        network: card.network,
        logoUrl: card.logoUrl,
        ecosystem: card.ecosystem,
        effortLevel: card.effortLevel,
        rewardConfidence: card.rewardConfidence,
        qualityScore: card.qualityScore,
        riskVerdict: card.riskVerdict,
        estValue: card.estValue,
        isActive: card.isActive,
        pipelineStatus: card.pipelineStatus,
        publishPath: card.publishPath,
        snapshotAt: card.snapshotAt,
        tgeAt: card.tgeAt,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        whyFarmNow: card.whyFarmNow.slice(0, 200),
        moodLabel: card.mood.strip24h?.moodLabel ?? card.mood.strip7d?.moodLabel ?? null,
        mood: card.mood,
        provenanceCount: card.provenanceLinks.length,
        taskCount: card.tasks.length,
        progressPercent: 0,
        websiteUrl: card.websiteUrl,
        twitterUrl: card.twitterUrl,
        fundingRound: card.fundingRound,
        aiReport: card.aiReport,
    };
}

export async function listPublicPortfolioCards(): Promise<AirdropPortfolioCard[]> {
    const rows = await db
        .select()
        .from(airdropProjects)
        .where(publicPublishFilter)
        .orderBy(desc(airdropProjects.updatedAt));

    const cards: AirdropPortfolioCard[] = [];
    for (const row of rows) {
        cards.push(await buildPortfolioCard(row));
    }
    return cards;
}

export async function getPublicPortfolioCardById(id: number): Promise<AirdropPortfolioCard | null> {
    const rows = await db
        .select()
        .from(airdropProjects)
        .where(and(eq(airdropProjects.id, id), publicPublishFilter))
        .limit(1);
    const row = rows[0];
    if (!row) return null;
    return buildPortfolioCard(row);
}
