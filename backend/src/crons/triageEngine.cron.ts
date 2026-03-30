import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { generateLightweightTriage } from '../services/openai.service';
import { eq } from 'drizzle-orm';

// Lock to prevent concurrent runs
let isTriageRunning = false;

export async function runTriageEngine(): Promise<void> {
    // Prevent concurrent runs
    if (isTriageRunning) {
        console.log('⏳ [TriageEngine] Already running, skipping...');
        return;
    }

    isTriageRunning = true;
    console.log('🤖 [TriageEngine] Running — scoring buffered news (Phase 1B)...');

    try {
        // Fetch unprocessed items, limit 50, ordered by retrieved_at ASC
        const items = await db
            .select()
            .from(rawNewsBuffer)
            .where(eq(rawNewsBuffer.processed, false))
            .orderBy(rawNewsBuffer.retrievedAt)
            .limit(50);

        if (items.length === 0) {
            console.log('[TriageEngine] No items to process.');
            return;
        }

        console.log(`[TriageEngine] Found ${items.length} items to triage`);

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

                    await db                        .update(rawNewsBuffer)
                        .set({
                            relevanceScore: scoredItem.relevanceScore,
                            sentimentHint: scoredItem.sentimentHint,
                            processed: true
                        })
                        .where(eq(rawNewsBuffer.id, item.id));

                    processedCount++;
                }

                console.log(`[TriageEngine] Batch ${batchNumber}/${batches} processed (${batch.length} items)`);
            } catch (batchError) {
                console.error(`[TriageEngine] Error processing batch ${batchNumber}:`, batchError);
                // Continue with next batch
            }
        }

        console.log(`✅ [TriageEngine] Completed: ${processedCount} items triaged in ${batches} batches`);
    } catch (error) {
        console.error('[TriageEngine] Fatal error:', error);
    } finally {
        isTriageRunning = false;
    }
}

export function startTriageEngineCron(): void {
    // Schedule every 2 hours: '0 */2 * * *'
    cron.schedule('0 */2 * * *', runTriageEngine);
    console.log('⏰ Triage Engine cron scheduled — every 2 hours (Phase 1B)');
}