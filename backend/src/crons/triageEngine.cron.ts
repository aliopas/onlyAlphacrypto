import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { generateLightweightTriage } from '../services/openai.service';
import { eq } from 'drizzle-orm';
import { isTrackedCoin, isMacroEvent } from '../config/coins';
import { guardedCronRun } from '../utils/cronGuard';
import { logger } from '../utils/logger';

export async function runTriageEngine(): Promise<void> {
    logger.info('[TriageEngine] Running — scoring buffered news (Phase 1B)...');

    // Fetch unprocessed items, limit 50, ordered by retrieved_at ASC
    const items = await db
        .select()
        .from(rawNewsBuffer)
        .where(eq(rawNewsBuffer.processed, false))
        .orderBy(rawNewsBuffer.retrievedAt)
        .limit(50);

    if (items.length === 0) {
        logger.info('[TriageEngine] No items to process.');
        return;
    }

    logger.info('[TriageEngine] Found %d items to triage', items.length);

    // Process in batches of 10
    const batchSize = 10;
    const batches = Math.ceil(items.length / batchSize);
    let processedCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        try {
            // Prepare batch for AI processing (title and source only)
            // Convert null to undefined because generateLightweightTriage expects string | undefined
            const newsBatch = batch.map(item => ({
                title: item.title,
                source: item.source === null ? undefined : item.source
            }));

            // Call lightweight triage function
            const scoredBatch = await generateLightweightTriage(newsBatch);

            // Update each item with its score
            for (let j = 0; j < batch.length; j++) {
                const item = batch[j];
                const scoredItem = scoredBatch[j];

                // Coin filter: force NOISE for non-tracked coins, default BTC for macro events
                const hasTrackedCoin = scoredItem.symbolMentions.some((s: string) => isTrackedCoin(s));
                if (!hasTrackedCoin) {
                    if (isMacroEvent(scoredItem.eventType)) {
                        scoredItem.symbolMentions = ['BTC'];
                    } else {
                        scoredItem.classification = 'NOISE';
                        logger.info('[TriageFilter] NOISE — no tracked coin in mentions: %s', scoredItem.symbolMentions.join(','));
                    }
                }

                await db.update(rawNewsBuffer)
                    .set({
                        relevanceScore: scoredItem.relevanceScore,
                        sentimentHint: scoredItem.sentimentHint,
                        symbolMentions: scoredItem.symbolMentions,
                        eventType: scoredItem.eventType,
                        eventSeverity: scoredItem.eventSeverity,
                        classification: scoredItem.classification || 'MINOR',
                        processed: true
                    })
                    .where(eq(rawNewsBuffer.id, item.id));

                processedCount++;
            }

            logger.info('[TriageEngine] Batch %d/%d processed (%d items)', batchNumber, batches, batch.length);
        } catch (batchError) {
            logger.error('[TriageEngine] Error processing batch %d: %s', batchNumber, batchError instanceof Error ? batchError.message : String(batchError));
            // Continue with next batch
        }
    }

    logger.info('[TriageEngine] Completed: %d items triaged in %d batches', processedCount, batches);
}

export function startTriageEngineCron(): void {
    // Every 2 hours (Phase 1B). Protected by BOTH an in-process guard and a cross-instance
    // Redis mutex (10 min TTL) because this cron writes relevanceScore/processed back to
    // raw_news_buffer — without it, two instances would both SELECT the same 50 rows, both
    // call the AI, and double-spend on identical batches.
    cron.schedule('0 */2 * * *', () => { void guardedCronRun('TriageEngine', 600, runTriageEngine); });
    logger.info('[TriageEngine] Cron scheduled — every 2 hours (Phase 1B)');
}