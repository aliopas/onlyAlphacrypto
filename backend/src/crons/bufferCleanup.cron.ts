import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { eq, lt, sql, and, or } from 'drizzle-orm';
import { logger } from '../utils/logger';

export async function runBufferCleanup(): Promise<void> {
    try {
        // Delete rows whose TTL has expired once they have been processed.
        //
        // Eligibility (OR of two branches):
        //   1. Consumed via aiWorkflow: `consumed = true` AND TTL expired.
        //   2. Fallback safety net: `processed = true` AND TTL is more than 7 days past
        //      expiry. This catches legacy rows written before the `consumed` fix (which
        //      never had `consumed` flipped to true) and rows whose consuming job failed
        //      partway through, so they never get stuck in the buffer forever.
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const fallbackDate = new Date(Date.now() - sevenDaysMs);

        const result = await db
            .delete(rawNewsBuffer)
            .where(
                and(
                    eq(rawNewsBuffer.processed, true),
                    lt(rawNewsBuffer.ttlExpiresAt, sql`now()`),
                    or(
                        eq(rawNewsBuffer.consumed, true),
                        lt(rawNewsBuffer.ttlExpiresAt, fallbackDate)
                    )
                )
            )
            .execute();

        const deleted = result?.rowCount ?? 0;
        logger.info('[BufferCleanup] Deleted %d expired rows from raw_news_buffer', deleted);
    } catch (error) {
        logger.error('[BufferCleanup] Error during cleanup: %s', error instanceof Error ? error.message : String(error));
    }
}

export function startBufferCleanupCron(): void {
    // Schedule once a day at midnight: '0 0 * * *'
    cron.schedule('0 0 * * *', () => { void runBufferCleanup(); });
    logger.info('[BufferCleanup] Cron scheduled — running daily at midnight.');
}