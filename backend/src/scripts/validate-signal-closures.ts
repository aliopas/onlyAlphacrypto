import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNotNull } from 'drizzle-orm';
import { TRACKED_COIN_SET } from '../config/coins';
import { logger } from '../utils/logger';
import { getCoinKlinesRange } from '../services/binance.service';

interface ClosureSummary {
    totalClosed: number;
    trackedClosed: number;
    withinBounds: number;
    outsideBounds: number;
    noHistory: number;
    errors: string[];
}

interface KlineRange {
    high24h: number;
    low24h: number;
}

async function get24hRangeAtTime(symbol: string, timestamp: Date): Promise<KlineRange | null> {
    try {
        const endTime = timestamp.getTime();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const klines = await getCoinKlinesRange(symbol, '1h', startTime, endTime);

        if (!klines || klines.length === 0) {
            return null;
        }

        const high24h = Math.max(...klines.map(k => k.high));
        const low24h = Math.min(...klines.map(k => k.low));

        if (isNaN(high24h) || isNaN(low24h)) {
            return null;
        }

        return { high24h, low24h };
    } catch (err) {
        logger.warn({ message: 'Failed to fetch klines for 24h range', symbol, timestamp: timestamp.toISOString(), error: err instanceof Error ? err.message : String(err) });
        return null;
    }
}

async function validateSignalClosures(): Promise<ClosureSummary> {
    const summary: ClosureSummary = {
        totalClosed: 0,
        trackedClosed: 0,
        withinBounds: 0,
        outsideBounds: 0,
        noHistory: 0,
        errors: []
    };

    try {
        const closedSignals = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, false),
                isNotNull(signalPerformance.exitPrice),
                isNotNull(signalPerformance.closedAt)
            ))
            .limit(5000);

        summary.totalClosed = closedSignals.length;

        for (const signal of closedSignals) {
            try {
                if (!TRACKED_COIN_SET.has(signal.coinSymbol.toUpperCase())) {
                    continue;
                }

                summary.trackedClosed++;

                if (!signal.closedAt) {
                    summary.noHistory++;
                    continue;
                }

                const range = await get24hRangeAtTime(signal.coinSymbol, signal.closedAt);
                if (!range) {
                    summary.noHistory++;
                    summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): no klines at ${signal.closedAt.toISOString()}`);
                    continue;
                }

                const exitPrice = signal.exitPrice ?? 0;
                const withinBounds = exitPrice >= range.low24h && exitPrice <= range.high24h;

                if (withinBounds) {
                    summary.withinBounds++;
                } else {
                    summary.outsideBounds++;
                    summary.errors.push(
                        `Signal #${signal.id} (${signal.coinSymbol}): exitPrice=${exitPrice} outside 24h range [${range.low24h}, ${range.high24h}] at ${signal.closedAt.toISOString()}`
                    );
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): validation error - ${message}`);
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Failed to fetch closed signals: ${message}`);
    }

    return summary;
}

async function main(): Promise<void> {
    logger.info('[ValidateSignalClosures] Starting signal closure validation');

    const summary = await validateSignalClosures();

    logger.info('[ValidateSignalClosures] Validation complete');
    logger.info('[ValidateSignalClosures] Total closed signals: %d', summary.totalClosed);
    logger.info('[ValidateSignalClosures] Tracked coin closures: %d', summary.trackedClosed);
    logger.info('[ValidateSignalClosures] Within 24h bounds at closure: %d', summary.withinBounds);
    logger.info('[ValidateSignalClosures] Outside 24h bounds at closure: %d', summary.outsideBounds);
    logger.info('[ValidateSignalClosures] No kline history at closure: %d', summary.noHistory);

    if (summary.outsideBounds > 0) {
        logger.warn('[ValidateSignalClosures] Issues found: %d', summary.outsideBounds);
        for (const error of summary.errors.slice(0, 50)) {
            if (error.includes('outside 24h range')) {
                logger.warn('[ValidateSignalClosures] - %s', error);
            }
        }
        process.exit(1);
    }

    logger.info('[ValidateSignalClosures] All tracked-coin closures with kline history are within 24h bounds.');
    process.exit(0);
}

main().catch((err) => {
    logger.error('[ValidateSignalClosures] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
