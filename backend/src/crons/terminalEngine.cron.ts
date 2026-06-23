import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { coinNews, rawNewsBuffer } from '../models/market.model';
import { fetchAllRSSNews } from '../services/rssNews.service';
import { eq, isNotNull, desc, and } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';
import { guardedCronRun } from '../utils/cronGuard';
import { logger } from '../utils/logger';

function hashTitle(title: string): string {
    return crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex');
}

// ─── Main Cron: Every 10 minutes (Phase 1A: Gathering Engine) ──────────────
export async function runTerminalEngine(): Promise<void> {
    logger.info('[TerminalEngine] Running — gathering crypto news (Phase 1A)...');

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
            // Coin filter: keyword-based pre-filter for tracked coins and macro events
            const titleUpper = newsItem.title.toUpperCase();
            const mentionsTrackedCoin = TRACKED_COINS.some(coin => titleUpper.includes(coin));

            // Also check for macro keywords in title
            const MACRO_KEYWORDS = ['FED', 'RATE', 'ETF', 'REGULATION', 'INFLATION', 'CPI', 'SANCTION', 'CRISIS'];
            const mentionsMacroKeyword = MACRO_KEYWORDS.some(kw => titleUpper.includes(kw));

            if (!mentionsTrackedCoin && !mentionsMacroKeyword) {
                continue; // Skip — not relevant to any tracked coin
            }

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

    logger.info('[TerminalEngine] Buffered %d new news items, skipped %d duplicates.', bufferedCount, duplicateCount);
}

// Export function to start the cron job
export function startTerminalEngineCron(): void {
    // Every 10 minutes (Phase 1A: Gathering Engine). Protected by BOTH an in-process guard
    // and a cross-instance Redis mutex (5 min TTL) because this cron produces rows into the
    // shared raw_news_buffer table — without the mutex, two instances would double-fetch and
    // race on the dedup SELECT/INSERT.
    cron.schedule('*/10 * * * *', () => { void guardedCronRun('TerminalEngine', 300, runTerminalEngine); });
    logger.info('[TerminalEngine] Cron scheduled — every 10 minutes (Phase 1A: Gathering Engine)');
}