import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNotNull } from 'drizzle-orm';
import { TRACKED_COIN_SET } from '../config/coins';
import { getConfirmedClosePrice } from '../services/priceService';
import { logger } from '../utils/logger';

interface ClosureSummary {
    totalClosed: number;
    trackedClosed: number;
    withinBounds: number;
    outsideBounds: number;
    unvalidated: number;
    errors: string[];
}

async function validateSignalClosures(): Promise<ClosureSummary> {
    const summary: ClosureSummary = {
        totalClosed: 0,
        trackedClosed: 0,
        withinBounds: 0,
        outsideBounds: 0,
        unvalidated: 0,
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

                const confirmed = await getConfirmedClosePrice(signal.coinSymbol);

                if (!confirmed || !confirmed.validated) {
                    summary.unvalidated++;
                    summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): unvalidated confirmed price - ${confirmed?.reason ?? 'unknown'}`);
                    continue;
                }

                const exitPrice = signal.exitPrice ?? 0;
                const withinBounds = confirmed.high24h != null && confirmed.low24h != null
                    ? exitPrice >= confirmed.low24h && exitPrice <= confirmed.high24h
                    : false;

                if (withinBounds) {
                    summary.withinBounds++;
                } else {
                    summary.outsideBounds++;
                    summary.errors.push(
                        `Signal #${signal.id} (${signal.coinSymbol}): exitPrice=${exitPrice} outside 24h range [${confirmed.low24h ?? 'null'}, ${confirmed.high24h ?? 'null'}]`
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
    logger.info('[ValidateSignalClosures] Within 24h bounds: %d', summary.withinBounds);
    logger.info('[ValidateSignalClosures] Outside 24h bounds: %d', summary.outsideBounds);
    logger.info('[ValidateSignalClosures] Unvalidated price: %d', summary.unvalidated);

    if (summary.errors.length > 0) {
        logger.warn('[ValidateSignalClosures] Issues found: %d', summary.errors.length);
        for (const error of summary.errors.slice(0, 50)) {
            logger.warn('[ValidateSignalClosures] - %s', error);
        }
        if (summary.errors.length > 50) {
            logger.warn('[ValidateSignalClosures] ... and %d more', summary.errors.length - 50);
        }
        process.exit(1);
    }

    logger.info('[ValidateSignalClosures] All tracked-coin closures are within 24h bounds.');
    process.exit(0);
}

main().catch((err) => {
    logger.error('[ValidateSignalClosures] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
