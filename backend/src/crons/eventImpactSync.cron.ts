import cron from 'node-cron';
import { db } from '../config/db';
import { coinNewsHistory, eventImpacts } from '../models/market.model';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { persistEventImpact, persistEventImpactOutcomes } from '../services/eventImpactPersistence.service';
import { eq, and, isNull, isNotNull, asc, desc, gte, sql } from 'drizzle-orm';
import type { CoinNewsHistoryRecord } from '../services/eventImpactPersistence.service';

const BATCH_SIZE = 100;

export async function runEventImpactSync(): Promise<void> {
    if (!env.EVENT_IMPACT_SYNC_ENABLED) {
        return;
    }

    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        logger.info('[EventImpactSync] Skipping: EVENT_IMPACT_PERSISTENCE_ENABLED is false');
        return;
    }

    try {
        logger.info('[EventImpactSync] Starting sync...');

        const unsyncedRecords = await db
            .select({
                id: coinNewsHistory.id,
                coinSymbol: coinNewsHistory.coinSymbol,
                title: coinNewsHistory.title,
                source: coinNewsHistory.source,
                publishedAt: coinNewsHistory.publishedAt,
                sentiment: coinNewsHistory.sentiment,
                eventType: coinNewsHistory.eventType,
                eventSeverity: coinNewsHistory.eventSeverity,
                priceAtTime: coinNewsHistory.priceAtTime,
                isRugPull: coinNewsHistory.isRugPull,
                fetchedAt: coinNewsHistory.fetchedAt,
                sourceHash: coinNewsHistory.sourceHash,
                eventScope: coinNewsHistory.eventScope,
                btcPriceAtEvent: coinNewsHistory.btcPriceAtEvent,
                ethPriceAtEvent: coinNewsHistory.ethPriceAtEvent,
                fearGreedAtEvent: coinNewsHistory.fearGreedAtEvent,
                price1hAfter: coinNewsHistory.price1hAfter,
                price4hAfter: coinNewsHistory.price4hAfter,
                price24hAfter: coinNewsHistory.price24hAfter,
                price3dAfter: coinNewsHistory.price3dAfter,
                price7dAfter: coinNewsHistory.price7dAfter,
                change1h: coinNewsHistory.change1h,
                change4h: coinNewsHistory.change4h,
                change24h: coinNewsHistory.change24h,
                change3d: coinNewsHistory.change3d,
                change7d: coinNewsHistory.change7d,
                priceChange7d: coinNewsHistory.priceChange7d,
                maxUpsideAfterEvent: coinNewsHistory.maxUpsideAfterEvent,
                maxDrawdownAfterEvent: coinNewsHistory.maxDrawdownAfterEvent,
                timeToPeakHours: coinNewsHistory.timeToPeakHours,
                timeToBottomHours: coinNewsHistory.timeToBottomHours,
                outcomeClassification: coinNewsHistory.outcomeClassification,
            })
            .from(coinNewsHistory)
            .leftJoin(eventImpacts, eq(eventImpacts.sourceId, coinNewsHistory.id))
            .where(and(
                isNull(eventImpacts.id),
                isNotNull(coinNewsHistory.eventSeverity),
                gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '48 hours'`),
            ))
            .orderBy(desc(coinNewsHistory.publishedAt))
            .limit(BATCH_SIZE);

        if (unsyncedRecords.length === 0) {
            logger.info('[EventImpactSync] No unsynced records found');
            return;
        }

        logger.info('[EventImpactSync] Found %d unsynced records', unsyncedRecords.length);

        let created = 0;
        let skipped = 0;
        let errors = 0;

        for (const row of unsyncedRecords) {
            try {
                const record = row as unknown as CoinNewsHistoryRecord;
                const eventImpactId = await persistEventImpact(record);

                if (eventImpactId === null) {
                    skipped++;
                    continue;
                }

                const outcomeCount = await persistEventImpactOutcomes(eventImpactId, record);

                if (outcomeCount > 0) {
                    created++;
                } else {
                    errors++;
                }
            } catch (error) {
                errors++;
                logger.error(
                    '[EventImpactSync] Failed to process source_id=%d: %s',
                    row.id,
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        logger.info(
            '[EventImpactSync] Batch completed: created=%d, skipped=%d, errors=%d',
            created,
            skipped,
            errors,
        );
    } catch (error) {
        logger.error('[EventImpactSync] Fatal error: %s', error instanceof Error ? error.message : String(error));
    }
}

export function startEventImpactSyncCron(): void {
    if (!env.EVENT_IMPACT_SYNC_ENABLED) {
        logger.info('[EventImpactSync] Disabled by EVENT_IMPACT_SYNC_ENABLED=false');
        return;
    }

    cron.schedule('*/30 * * * *', () => runEventImpactSync());
    logger.info('[EventImpactSync] Scheduled — every 30 minutes');
}
