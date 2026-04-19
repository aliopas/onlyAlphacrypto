import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { eq, lt, sql, and } from 'drizzle-orm';

export async function runBufferCleanup(): Promise<void> {
    console.log('🧹 [BufferCleanup] Starting cleanup of processed news...');

    try {
        // Delete rows where processed = true AND ttlExpiresAt < NOW()
        const result = await db
            .delete(rawNewsBuffer)
            .where(
                and(
                    eq(rawNewsBuffer.processed, true),
                    eq(rawNewsBuffer.consumed, true),
                    lt(rawNewsBuffer.ttlExpiresAt, sql`now()`)
                )
            )
            .execute();

        console.log('🧹 [BufferCleanup] Cleanup completed successfully');
    } catch (error) {
        console.error('[BufferCleanup] Error during cleanup:', error);
    }
}

export function startBufferCleanupCron(): void {
    // Schedule once a day at midnight: '0 0 * * *'
    cron.schedule('0 0 * * *', runBufferCleanup);
    console.log('🧹 [BufferCleanup] Cron scheduled — running daily at midnight.');
}