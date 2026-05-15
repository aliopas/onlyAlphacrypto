import { db } from '../config/db';
import { shadowSignals } from '../models/market.model';
import { eq, isNull, sql } from 'drizzle-orm';

// ─── Type Definitions ────────────────────────────────────────────────────────────
export type ShadowSignalRow = typeof shadowSignals.$inferSelect;

export interface ShadowStats {
    totalSignals: number;
    resolved72h: number;
    algorithmWins72h: number;
    aiWins72h: number;
    resolved7d: number;
    algorithmWins7d: number;
    aiWins7d: number;
    agreeingSignals: number;
    disagreeingSignals: number;
    algorithmDisagreementWinRate: number | null;
}

// ─── Core Service Functions ─────────────────────────────────────────────────────

/**
 * Insert a new shadow signal record
 */
export async function insertShadowSignal(params: {
    coinSymbol: string;
    algorithmVerdict: string;
    aiVerdict: string;
    algorithmEntry: number;
    aiEntry: number;
    algorithmTp?: number;
    algorithmSl?: number;
    aiTp?: number;
    aiSl?: number;
    qualityScore: number;
    trendContext: string;
    agreement: boolean;
    mtfConfluenceScore?: number | null;
    mtfTrendAlignment?: string | null;
    mtfDominantTrend?: string | null;
}): Promise<number> {
    const result = await db.insert(shadowSignals).values({
        coinSymbol: params.coinSymbol,
        algorithmVerdict: params.algorithmVerdict,
        aiVerdict: params.aiVerdict,
        algorithmEntry: params.algorithmEntry,
        aiEntry: params.aiEntry,
        algorithmTp: params.algorithmTp,
        algorithmSl: params.algorithmSl,
        aiTp: params.aiTp,
        aiSl: params.aiSl,
        qualityScore: params.qualityScore,
        trendContext: params.trendContext,
        agreement: params.agreement,
        mtfConfluenceScore: params.mtfConfluenceScore ?? null,
        mtfTrendAlignment: params.mtfTrendAlignment ?? null,
        mtfDominantTrend: params.mtfDominantTrend ?? null,
    }).returning({ id: shadowSignals.id });

    return result[0].id;
}

/**
 * Resolve a shadow signal at 72h checkpoint — uses pre-fetched signal row to avoid redundant SELECT
 */
export async function resolveShadowSignal72h(
    id: number,
    price72h: number,
    signalRow?: ShadowSignalRow
): Promise<void> {
    let row = signalRow;
    if (!row) {
        const signal = await db.select().from(shadowSignals).where(eq(shadowSignals.id, id)).limit(1);
        if (!signal.length) return;
        row = signal[0];
    }

    const algorithmPnl = calculatePnl(row.algorithmVerdict, row.algorithmEntry, price72h);
    const aiPnl = calculatePnl(row.aiVerdict, row.aiEntry, price72h);

    await db.update(shadowSignals).set({
        price72h,
        algorithmPnl72h: algorithmPnl,
        aiPnl72h: aiPnl,
        algorithmWin72h: algorithmPnl > 0,
        aiWin72h: aiPnl > 0,
    }).where(eq(shadowSignals.id, id));
}

/**
 * Resolve shadow signals at 72h checkpoint — batch version (no redundant SELECTs)
 */
export async function resolveShadowSignals72hBatch(
    signals: Array<{ id: number; coinSymbol: string; algorithmVerdict: string; algorithmEntry: number; aiVerdict: string; aiEntry: number }>,
    priceByCoin: Record<string, number>
): Promise<void> {
    const updates = signals
        .map(signal => {
            const price = priceByCoin[signal.coinSymbol];
            if (price === undefined) return null;
            const algorithmPnl = calculatePnl(signal.algorithmVerdict, signal.algorithmEntry, price);
            const aiPnl = calculatePnl(signal.aiVerdict, signal.aiEntry, price);
            return {
                id: signal.id,
                price72h: price,
                algorithmPnl72h: algorithmPnl,
                aiPnl72h: aiPnl,
                algorithmWin72h: algorithmPnl > 0,
                aiWin72h: aiPnl > 0,
            };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

    for (const update of updates) {
        await db.update(shadowSignals).set({
            price72h: update.price72h,
            algorithmPnl72h: update.algorithmPnl72h,
            aiPnl72h: update.aiPnl72h,
            algorithmWin72h: update.algorithmWin72h,
            aiWin72h: update.aiWin72h,
        }).where(eq(shadowSignals.id, update.id));
    }
}

/**
 * Resolve a shadow signal at 7d checkpoint and finalize — uses pre-fetched signal row to avoid redundant SELECT
 */
export async function resolveShadowSignal7d(
    id: number,
    price7d: number,
    signalRow?: ShadowSignalRow
): Promise<void> {
    let row = signalRow;
    if (!row) {
        const signal = await db.select().from(shadowSignals).where(eq(shadowSignals.id, id)).limit(1);
        if (!signal.length) return;
        row = signal[0];
    }

    const algorithmPnl7d = calculatePnl(row.algorithmVerdict, row.algorithmEntry, price7d);
    const aiPnl7d = calculatePnl(row.aiVerdict, row.aiEntry, price7d);

    let winner: string | null = null;
    if (algorithmPnl7d > aiPnl7d) {
        winner = 'algorithm';
    } else if (aiPnl7d > algorithmPnl7d) {
        winner = 'ai';
    } else {
        winner = 'tie';
    }

    await db.update(shadowSignals).set({
        price7d,
        algorithmPnl7d,
        aiPnl7d,
        algorithmWin7d: algorithmPnl7d > 0,
        aiWin7d: aiPnl7d > 0,
        winner,
        resolvedAt: new Date(),
    }).where(eq(shadowSignals.id, id));
}

/**
 * Resolve shadow signals at 7d checkpoint — batch version (no redundant SELECTs)
 */
export async function resolveShadowSignals7dBatch(
    signals: Array<{ id: number; coinSymbol: string; algorithmVerdict: string; algorithmEntry: number; aiVerdict: string; aiEntry: number }>,
    priceByCoin: Record<string, number>
): Promise<void> {
    const updates = signals
        .map(signal => {
            const price = priceByCoin[signal.coinSymbol];
            if (price === undefined) return null;
            const algorithmPnl7d = calculatePnl(signal.algorithmVerdict, signal.algorithmEntry, price);
            const aiPnl7d = calculatePnl(signal.aiVerdict, signal.aiEntry, price);
            let winner: string | null = null;
            if (algorithmPnl7d > aiPnl7d) {
                winner = 'algorithm';
            } else if (aiPnl7d > algorithmPnl7d) {
                winner = 'ai';
            } else {
                winner = 'tie';
            }
            return {
                id: signal.id,
                price7d: price,
                algorithmPnl7d,
                aiPnl7d,
                algorithmWin7d: algorithmPnl7d > 0,
                aiWin7d: aiPnl7d > 0,
                winner,
                resolvedAt: new Date(),
            };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

    for (const update of updates) {
        await db.update(shadowSignals).set({
            price7d: update.price7d,
            algorithmPnl7d: update.algorithmPnl7d,
            aiPnl7d: update.aiPnl7d,
            algorithmWin7d: update.algorithmWin7d,
            aiWin7d: update.aiWin7d,
            winner: update.winner,
            resolvedAt: update.resolvedAt,
        }).where(eq(shadowSignals.id, update.id));
    }
}

/**
 * Get all unresolved shadow signals (no price7d set) with limit
 */
export async function getUnresolvedShadowSignals(): Promise<ShadowSignalRow[]> {
    return await db
        .select()
        .from(shadowSignals)
        .where(isNull(shadowSignals.price7d))
        .limit(500);
}

/**
 * Get statistical overview of shadow signals — single query with SQL aggregates
 */
export async function getShadowStats(): Promise<ShadowStats> {
    const stats = await db
        .select({
            totalSignals: sql<number>`count(*)`,
            resolved72h: sql<number>`count(*) FILTER (WHERE ${shadowSignals.price72h} IS NOT NULL)`,
            algorithmWins72h: sql<number>`count(*) FILTER (WHERE ${shadowSignals.algorithmWin72h} = true)`,
            aiWins72h: sql<number>`count(*) FILTER (WHERE ${shadowSignals.aiWin72h} = true)`,
            resolved7d: sql<number>`count(*) FILTER (WHERE ${shadowSignals.price7d} IS NOT NULL)`,
            algorithmWins7d: sql<number>`count(*) FILTER (WHERE ${shadowSignals.algorithmWin7d} = true)`,
            aiWins7d: sql<number>`count(*) FILTER (WHERE ${shadowSignals.aiWin7d} = true)`,
            agreeingSignals: sql<number>`count(*) FILTER (WHERE ${shadowSignals.agreement} = true)`,
            disagreeingSignals: sql<number>`count(*) FILTER (WHERE ${shadowSignals.agreement} = false)`,
            algorithmDisagreementWins: sql<number>`count(*) FILTER (WHERE ${shadowSignals.agreement} = false AND ${shadowSignals.winner} = 'algorithm')`,
        })
        .from(shadowSignals);

    const row = stats[0];
    if (!row) {
        return {
            totalSignals: 0,
            resolved72h: 0,
            algorithmWins72h: 0,
            aiWins72h: 0,
            resolved7d: 0,
            algorithmWins7d: 0,
            aiWins7d: 0,
            agreeingSignals: 0,
            disagreeingSignals: 0,
            algorithmDisagreementWinRate: null,
        };
    }

    const disagreeingSignals = Number(row.disagreeingSignals);
    const algorithmDisagreementWinRate = disagreeingSignals > 0
        ? (Number(row.algorithmDisagreementWins) / disagreeingSignals) * 100
        : null;

    return {
        totalSignals: Number(row.totalSignals),
        resolved72h: Number(row.resolved72h),
        algorithmWins72h: Number(row.algorithmWins72h),
        aiWins72h: Number(row.aiWins72h),
        resolved7d: Number(row.resolved7d),
        algorithmWins7d: Number(row.algorithmWins7d),
        aiWins7d: Number(row.aiWins7d),
        agreeingSignals: Number(row.agreeingSignals),
        disagreeingSignals,
        algorithmDisagreementWinRate,
    };
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Centralized verdict direction resolver — handles both old (BUY/SELL)
 * and new (BULLISH/BEARISH) formats for backward compatibility.
 */
export function getVerdictDirection(verdict: string): 'bullish' | 'bearish' | 'neutral' {
    const upper = verdict.toUpperCase();
    if (['BUY', 'STRONG_BUY', 'BULLISH', 'STRONG_BULLISH'].includes(upper)) return 'bullish';
    if (['SELL', 'STRONG_SELL', 'BEARISH', 'STRONG_BEARISH'].includes(upper)) return 'bearish';
    return 'neutral';
}

/**
 * Calculate P&L percentage for a verdict
 */
function calculatePnl(verdict: string, entryPrice: number, exitPrice: number): number {
    if (entryPrice <= 0) return 0;
    const direction = getVerdictDirection(verdict);
    if (direction === 'bullish') return ((exitPrice - entryPrice) / entryPrice) * 100;
    if (direction === 'bearish') return ((entryPrice - exitPrice) / entryPrice) * 100;
    return 0;
}