import { and, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../config/db';
import {
    airdropMoodSnapshots,
    airdropSignals,
    type AirdropMoodLabel,
    type AirdropMoodWindow,
} from '../models/airdrop.model';

export interface DateSignalEntry {
    kind: 'snapshot' | 'tge' | 'claim' | 'unclear';
    raw?: string;
    isoDate?: string | null;
}

export interface MoodComputeResult {
    entitiesTouched: number;
    snapshotsWritten: number;
}

const HYPE_PATTERNS: RegExp[] = [
    /\bairdrop\b/i,
    /\bfree\b/i,
    /\bclaim\b/i,
    /\bhuge\b/i,
    /\bmassive\b/i,
    /\bguaranteed\b/i,
    /\b100x\b/i,
    /\bmoon\b/i,
    /\beligible\b/i,
    /\bretrodrop\b/i,
    /\bincentivized\b/i,
];

const FUD_PATTERNS: RegExp[] = [
    /\bscam\b/i,
    /\brug\b/i,
    /\bfake\b/i,
    /\bphishing\b/i,
    /\bdelay(?:ed)?\b/i,
    /\bcancel(?:led|ed)?\b/i,
    /\bhoneypot\b/i,
    /\bmalicious\b/i,
    /\bavoid\b/i,
    /\bwarning\b/i,
    /\bfud\b/i,
];

function windowMs(window: AirdropMoodWindow): number {
    return window === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

function scorePatterns(text: string, patterns: RegExp[]): number {
    let hits = 0;
    for (const p of patterns) {
        if (p.test(text)) hits += 1;
    }
    return hits;
}

function deriveMoodLabel(
    mentionCount: number,
    hypeScore: number,
    fudScore: number,
    controversyFlag: boolean
): AirdropMoodLabel {
    if (controversyFlag || fudScore >= 3 || (fudScore >= 2 && fudScore >= hypeScore)) {
        return 'toxic';
    }
    if (mentionCount >= 8 && hypeScore >= 4) return 'hot';
    if (mentionCount >= 3 || hypeScore >= 2) return 'warming';
    return 'cold';
}

function controversyFromDates(dateSignals: DateSignalEntry[]): boolean {
    // Conflicting ISO dates for the same kind (e.g. two different snapshot days)
    const byKind = new Map<string, Set<string>>();
    for (const d of dateSignals) {
        if (!d.isoDate) continue;
        const day = d.isoDate.slice(0, 10);
        const set = byKind.get(d.kind) ?? new Set<string>();
        set.add(day);
        byKind.set(d.kind, set);
    }
    for (const set of byKind.values()) {
        if (set.size > 1) return true;
    }
    return false;
}

function parseDateSignalsFromJson(raw: unknown): DateSignalEntry[] {
    if (!Array.isArray(raw)) return [];
    const out: DateSignalEntry[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const kindRaw = typeof rec.kind === 'string' ? rec.kind : 'unclear';
        const kind: DateSignalEntry['kind'] =
            kindRaw === 'snapshot' || kindRaw === 'tge' || kindRaw === 'claim' || kindRaw === 'unclear'
                ? kindRaw
                : 'unclear';
        out.push({
            kind,
            raw: typeof rec.raw === 'string' ? rec.raw : undefined,
            isoDate: typeof rec.isoDate === 'string' ? rec.isoDate : null,
        });
    }
    return out;
}

/**
 * Recompute mood snapshots for entities that have recent signals.
 * Writes one row per (entity, window) with latest computedAt (append-style history).
 */
export async function recomputeMoodSnapshots(
    entityIds?: number[]
): Promise<MoodComputeResult> {
    const windows: AirdropMoodWindow[] = ['24h', '7d'];
    let snapshotsWritten = 0;
    const entitySet = new Set<number>();

    const maxWindowMs = windowMs('7d');
    const since = new Date(Date.now() - maxWindowMs);

    const signalRows = await db
        .select({
            id: airdropSignals.id,
            entityId: airdropSignals.entityId,
            sourceId: airdropSignals.sourceId,
            title: airdropSignals.title,
            body: airdropSignals.body,
            publishedAt: airdropSignals.publishedAt,
            extractedDates: airdropSignals.extractedDates,
            createdAt: airdropSignals.createdAt,
        })
        .from(airdropSignals)
        .where(
            and(
                isNotNull(airdropSignals.entityId),
                gte(airdropSignals.createdAt, since)
            )
        );

    for (const row of signalRows) {
        if (row.entityId !== null) entitySet.add(row.entityId);
    }

    let targets = Array.from(entitySet);
    if (entityIds && entityIds.length > 0) {
        const allow = new Set(entityIds);
        targets = targets.filter((id) => allow.has(id));
        for (const id of entityIds) {
            if (!targets.includes(id)) targets.push(id);
        }
    }

    const now = new Date();

    for (const entityId of targets) {
        for (const window of windows) {
            const cutoff = new Date(Date.now() - windowMs(window));
            const windowSignals = signalRows.filter((s) => {
                if (s.entityId !== entityId) return false;
                const ts = s.publishedAt ?? s.createdAt;
                return ts >= cutoff;
            });

            const mentionCount = windowSignals.length;
            const sourceIds = new Set<number>();
            for (const s of windowSignals) {
                if (s.sourceId !== null) sourceIds.add(s.sourceId);
            }
            const uniqueSourceCount = sourceIds.size;

            let hypeHits = 0;
            let fudHits = 0;
            const dateSignals: DateSignalEntry[] = [];

            for (const s of windowSignals) {
                const text = `${s.title ?? ''} ${s.body ?? ''}`;
                hypeHits += scorePatterns(text, HYPE_PATTERNS);
                fudHits += scorePatterns(text, FUD_PATTERNS);
                dateSignals.push(...parseDateSignalsFromJson(s.extractedDates));
            }

            const hypeScore =
                mentionCount === 0 ? 0 : Math.min(10, hypeHits / Math.max(mentionCount, 1) * 2 + Math.min(mentionCount / 3, 3));
            const fudScore =
                mentionCount === 0 ? 0 : Math.min(10, fudHits / Math.max(mentionCount, 1) * 2 + (fudHits > 0 ? 1 : 0));

            const controversyFlag = controversyFromDates(dateSignals);
            const moodLabel = deriveMoodLabel(mentionCount, hypeScore, fudScore, controversyFlag);

            // Cap stored date signals
            const dateSignalsCapped = dateSignals.slice(0, 40);

            await db.insert(airdropMoodSnapshots).values({
                entityId,
                moodWindow: window,
                mentionCount,
                uniqueSourceCount,
                hypeScore,
                fudScore,
                dateSignals: dateSignalsCapped,
                controversyFlag,
                moodLabel,
                computedAt: now,
            });

            snapshotsWritten += 1;
        }
    }

    return {
        entitiesTouched: targets.length,
        snapshotsWritten,
    };
}

/** Optional cleanup: keep last N snapshots per entity+window (best-effort). */
export async function pruneOldMoodSnapshots(keepPerWindow = 14): Promise<number> {
    // Delete rows older than keep count using window function
    const result = await db.execute(sql`
        DELETE FROM airdrop_mood_snapshots
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY entity_id, mood_window
                           ORDER BY computed_at DESC
                       ) AS rn
                FROM airdrop_mood_snapshots
            ) ranked
            WHERE rn > ${keepPerWindow}
        )
    `);
    const rowCount =
        typeof result.rowCount === 'number'
            ? result.rowCount
            : Array.isArray(result.rows)
              ? result.rows.length
              : 0;
    return rowCount;
}
