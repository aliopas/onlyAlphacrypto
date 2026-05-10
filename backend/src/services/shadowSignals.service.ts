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
    }).returning({ id: shadowSignals.id });

    return result[0].id;
}

/**
 * Resolve a shadow signal at 72h checkpoint
 */
export async function resolveShadowSignal72h(id: number, price72h: number): Promise<void> {
    const signal = await db.select().from(shadowSignals).where(eq(shadowSignals.id, id)).limit(1);
    if (!signal.length) return;

    const row = signal[0];
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
 * Resolve a shadow signal at 7d checkpoint and finalize
 */
export async function resolveShadowSignal7d(id: number, price7d: number): Promise<void> {
    const signal = await db.select().from(shadowSignals).where(eq(shadowSignals.id, id)).limit(1);
    if (!signal.length) return;

    const row = signal[0];
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
 * Get statistical overview of shadow signals using SQL aggregates
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

    let algorithmDisagreementWinRate: number | null = null;
    if (row.disagreeingSignals > 0) {
        const disagreementWins = await db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(shadowSignals)
            .where(sql`${shadowSignals.agreement} = false AND ${shadowSignals.winner} = 'algorithm'`);

        algorithmDisagreementWinRate = (disagreementWins[0]?.count || 0) / row.disagreeingSignals * 100;
    }

    return {
        totalSignals: Number(row.totalSignals),
        resolved72h: Number(row.resolved72h),
        algorithmWins72h: Number(row.algorithmWins72h),
        aiWins72h: Number(row.aiWins72h),
        resolved7d: Number(row.resolved7d),
        algorithmWins7d: Number(row.algorithmWins7d),
        aiWins7d: Number(row.aiWins7d),
        agreeingSignals: Number(row.agreeingSignals),
        disagreeingSignals: Number(row.disagreeingSignals),
        algorithmDisagreementWinRate,
    };
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Calculate P&L percentage for a verdict
 */
function calculatePnl(verdict: string, entryPrice: number, exitPrice: number): number {
    const isBullish = verdict.includes('BUY') || verdict.includes('BULLISH');
    const isBearish = verdict.includes('SELL') || verdict.includes('BEARISH');

    if (isBullish) {
        return ((exitPrice - entryPrice) / entryPrice) * 100;
    } else if (isBearish) {
        return ((entryPrice - exitPrice) / entryPrice) * 100;
    } else {
        return 0;
    }
}