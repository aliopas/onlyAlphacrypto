import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { coinNews, rawNewsBuffer } from '../models/market.model';
import { fetchAllRSSNews } from '../services/rssNews.service';
import { eq, isNotNull, desc, and } from 'drizzle-orm';

function hashTitle(title: string): string {
    return crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex');
}

// ─── Main Cron: Every 10 minutes (Phase 1A: Gathering Engine) ──────────────
export async function runTerminalEngine(): Promise<void> {
    console.log('🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...');

    const rssItems = await fetchAllRSSNews();
    const newsItems = rssItems.map(item => ({ title: item.title, source: item.source }));

    if (!newsItems.length) {
        console.log('[TerminalEngine] No news to process.');
        return;
    }

    let bufferedCount = 0;
    let duplicateCount = 0;

    for (const newsItem of newsItems) {
        try {
            const rawText = newsItem.title;
            const hash = hashTitle(rawText);

            // 1. Check if already processed in coinNews
            const [existing] = await db.select({ id: coinNews.id })
                .from(coinNews)
                .where(eq(coinNews.sourceHash, hash))
                .limit(1);

            if (existing) {
                console.log(`[TerminalEngine] Skipping duplicate (in coinNews): "${rawText.slice(0, 50)}..."`);
                duplicateCount++;
                continue;
            }

            // 1b. Check if already in raw_news_buffer (dedup at buffer level)
            const [existingBuffer] = await db.select({ id: rawNewsBuffer.id })
                .from(rawNewsBuffer)
                .where(eq(rawNewsBuffer.sourceHash, hash))
                .limit(1);

            if (existingBuffer) {
                duplicateCount++;
                continue;
            }

            // 2. Insert into raw_news_buffer for later triage (Phase 1B)
            await db.insert(rawNewsBuffer).values({
                title: rawText,
                source: newsItem.source || 'Unknown',
                sourceHash: hash,
                ttlExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            }).onConflictDoNothing({ target: rawNewsBuffer.sourceHash });

            bufferedCount++;
        } catch (err) {
            console.error('[TerminalEngine] Error buffering news item:', err);
        }
    }

    console.log(`✅ [TerminalEngine] Buffered ${bufferedCount} new news items, skipped ${duplicateCount} duplicates.`);
}

// Export function to start the cron job
export function startTerminalEngineCron(): void {
    // Changed from '*/5 * * * *' to '*/10 * * * *' for 10-minute intervals (Phase 1A optimization)
    cron.schedule('*/10 * * * *', runTerminalEngine);
    console.log('⏰ Terminal Intelligence Engine cron scheduled — every 10 minutes (Phase 1A: Gathering Engine)');
}