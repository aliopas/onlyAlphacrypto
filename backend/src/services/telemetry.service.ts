import { db } from '../config/db';
import { redis } from '../config/redis';
import { signalPerformance, shadowSignals, rawNewsBuffer, coinNews } from '../models/market.model';
import { eq, sql, gte, and, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface SystemTelemetry {
    timestamp: string;
    signals: {
        total: number;
        byState: Record<string, number>;
        activeCount: number;
        closedCount: number;
        archivedCount: number;
        partialTpCount: number;
        winRate72h: number | null;
    };
    shadowMode: {
        total: number;
        unresolved: number;
        resolved72h: number;
        algorithmWins72h: number;
        aiWins72h: number;
        agreementRate: number | null;
    };
    pipeline: {
        newsBufferBacklog: number;
        articlesLast24h: number;
        hourlyPublishRate: number | null;
    };
    health: {
        dbConnected: boolean;
        redisConnected: boolean;
        signalGenerationPaused: boolean;
    };
}

export async function collectSystemTelemetry(): Promise<SystemTelemetry> {
    const now = new Date();
    const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hoursAgo72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const [
        signalCounts,
        shadowTotal,
        shadowUnresolved,
        shadowResolved72h,
        newsBufferCount,
        articles24h,
        dbHealth,
        redisHealth,
    ] = await Promise.all([
        getSignalCounts(),
        getShadowTotal(),
        getShadowUnresolved(),
        getShadowResolved72h(hoursAgo72),
        getNewsBufferCount(),
        getArticlesLast24h(hoursAgo24),
        checkDbHealth(),
        checkRedisHealth(),
    ]);

    const activeCount = signalCounts.byState['ACTIVE'] ?? 0;
    const closedCount = signalCounts.byState['CLOSED'] ?? 0;
    const archivedCount = signalCounts.byState['ARCHIVED'] ?? 0;
    const partialTpCount = signalCounts.byState['PARTIAL_TP'] ?? 0;

    const algorithmWins72h = shadowResolved72h.filter(r => r.algorithmWin72h === true).length;
    const aiWins72h = shadowResolved72h.filter(r => r.aiWin72h === true).length;

    const agreementRate = shadowTotal > 0
        ? Math.round(((shadowTotal - shadowUnresolved) / shadowTotal) * 1000) / 10
        : null;

    let winRate72h: number | null = null;
    const resolvedCount = shadowResolved72h.length;
    if (resolvedCount > 0) {
        winRate72h = Math.round((algorithmWins72h / resolvedCount) * 1000) / 10;
    }

    let signalGenerationPaused = false;
    if (redis) {
        try {
            const paused = await redis.get('oa:signal_generation:paused');
            signalGenerationPaused = paused === '1';
        } catch {
            // ignore
        }
    }

    return {
        timestamp: now.toISOString(),
        signals: {
            total: signalCounts.total,
            byState: signalCounts.byState,
            activeCount,
            closedCount,
            archivedCount,
            partialTpCount,
            winRate72h,
        },
        shadowMode: {
            total: shadowTotal,
            unresolved: shadowUnresolved,
            resolved72h: resolvedCount,
            algorithmWins72h,
            aiWins72h,
            agreementRate,
        },
        pipeline: {
            newsBufferBacklog: newsBufferCount,
            articlesLast24h: articles24h,
            hourlyPublishRate: null, // Would need time-series data
        },
        health: {
            dbConnected: dbHealth,
            redisConnected: redisHealth,
            signalGenerationPaused,
        },
    };
}

interface SignalCountResult {
    total: number;
    byState: Record<string, number>;
}

async function getSignalCounts(): Promise<SignalCountResult> {
    try {
        const rows = await db
            .select({
                state: signalPerformance.signalState,
                count: sql<number>`count(*)`,
            })
            .from(signalPerformance)
            .groupBy(signalPerformance.signalState);

        const byState: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
            const key = row.state ?? 'UNKNOWN';
            const count = Number(row.count) || 0;
            byState[key] = count;
            total += count;
        }
        return { total, byState };
    } catch (err) {
        logger.error('[Telemetry] Failed to get signal counts: %s', err instanceof Error ? err.message : String(err));
        return { total: 0, byState: {} };
    }
}

async function getShadowTotal(): Promise<number> {
    try {
        const result = await db.select({ count: sql<number>`count(*)` }).from(shadowSignals);
        return Number(result[0]?.count) || 0;
    } catch {
        return 0;
    }
}

async function getShadowUnresolved(): Promise<number> {
    try {
        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(shadowSignals)
            .where(isNull(shadowSignals.price7d));
        return Number(result[0]?.count) || 0;
    } catch {
        return 0;
    }
}

interface ShadowResolved {
    algorithmWin72h: boolean | null;
    aiWin72h: boolean | null;
}

async function getShadowResolved72h(since: Date): Promise<ShadowResolved[]> {
    try {
        const rows = await db
            .select({
                algorithmWin72h: shadowSignals.algorithmWin72h,
                aiWin72h: shadowSignals.aiWin72h,
            })
            .from(shadowSignals)
            .where(and(
                gte(shadowSignals.createdAt, since),
                sql`${shadowSignals.price72h} IS NOT NULL`
            ));
        return rows as ShadowResolved[];
    } catch {
        return [];
    }
}

async function getNewsBufferCount(): Promise<number> {
    try {
        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(rawNewsBuffer)
            .where(isNull(rawNewsBuffer.consumedAt));
        return Number(result[0]?.count) || 0;
    } catch {
        return 0;
    }
}

async function getArticlesLast24h(since: Date): Promise<number> {
    try {
        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(coinNews)
            .where(gte(coinNews.createdAt, since));
        return Number(result[0]?.count) || 0;
    } catch {
        return 0;
    }
}

async function checkDbHealth(): Promise<boolean> {
    try {
        await db.execute(sql`SELECT 1`);
        return true;
    } catch {
        return false;
    }
}

async function checkRedisHealth(): Promise<boolean> {
    if (!redis) return false;
    try {
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}
