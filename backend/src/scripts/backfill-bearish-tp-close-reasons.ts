import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface BackfillSummary {
    scanned: number;
    corrected: number;
    skipped: number;
    errors: string[];
}

async function backfillBearishTpCloseReasons(): Promise<BackfillSummary> {
    const summary: BackfillSummary = {
        scanned: 0,
        corrected: 0,
        skipped: 0,
        errors: []
    };

    try {
        const mislabeled = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, false),
                eq(signalPerformance.autoClosedReason, 'take_profit'),
                eq(signalPerformance.closeReason, 'SL_HIT')
            ))
            .limit(5000);

        summary.scanned = mislabeled.length;

        for (const signal of mislabeled) {
            try {
                if (signal.takeProfitPrice == null || signal.exitPrice == null) {
                    summary.skipped++;
                    continue;
                }

                const isLong = signal.takeProfitPrice > signal.entryPrice;
                const hitTp = isLong
                    ? signal.exitPrice >= signal.takeProfitPrice
                    : signal.exitPrice <= signal.takeProfitPrice;

                if (hitTp) {
                    await db.update(signalPerformance)
                        .set({ closeReason: 'TP_HIT' })
                        .where(eq(signalPerformance.id, signal.id));
                    summary.corrected++;
                } else {
                    summary.skipped++;
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): ${message}`);
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Failed to fetch mislabeled signals: ${message}`);
    }

    return summary;
}

async function main(): Promise<void> {
    logger.info('[BackfillBearishTp] Starting backfill of mislabeled bearish TP closures');

    const summary = await backfillBearishTpCloseReasons();

    logger.info('[BackfillBearishTp] Scanned: %d', summary.scanned);
    logger.info('[BackfillBearishTp] Corrected: %d', summary.corrected);
    logger.info('[BackfillBearishTp] Skipped: %d', summary.skipped);

    if (summary.errors.length > 0) {
        logger.warn('[BackfillBearishTp] Errors: %d', summary.errors.length);
        for (const error of summary.errors.slice(0, 50)) {
            logger.warn('[BackfillBearishTp] - %s', error);
        }
        process.exit(1);
    }

    logger.info('[BackfillBearishTp] Backfill complete.');
    process.exit(0);
}

main().catch((err) => {
    logger.error('[BackfillBearishTp] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
