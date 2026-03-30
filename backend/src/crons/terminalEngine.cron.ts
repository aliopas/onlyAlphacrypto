import cron from 'node-cron';
import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/db';
import { coinNews, radarSignals, airdropProjects } from '../models/index';
import { generateDualNewsOutput } from '../services/openai.service';
import { deleteCache } from '../config/redis';
import { env } from '../config/env';
import { eq, isNotNull, desc } from 'drizzle-orm';

function hashTitle(title: string): string {
    return crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex');
}

// ─── Crypto News Sources ──────────────────────────────────────────────────────
const NEWS_SOURCES = [
    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
];

async function fetchLatestNews(): Promise<Array<{ title: string; text?: string; source?: string }>> {
    try {
        let url = NEWS_SOURCES[0];
        if (process.env.CRYPTOCOMPARE_API_KEY) {
            url += `&api_key=${process.env.CRYPTOCOMPARE_API_KEY}`;
        }
        console.log(`[TerminalEngine] Fetching from: ${NEWS_SOURCES[0]}`);
        let { data } = await axios.get(url, { timeout: 8000 });
        if (!data || !data.Data || !Array.isArray(data.Data)) {
            // Log the actual response to diagnose rate limits or auth errors from CryptoCompare
            const snippet = JSON.stringify(data).slice(0, 300);
            console.error(`[TerminalEngine] Invalid API structure. Response snippet: ${snippet}`);
            return [];
        }

        console.log(`[TerminalEngine] Fetched ${data.Data.length} news items from API`);
        return data.Data.slice(0, 5).map((item: Record<string, any>) => ({
            title: item.title as string,
            source: item.source_info?.name as string || item.source as string,
        }));
    } catch (err: any) {
        console.error('[TerminalEngine] Error fetching news:', err.message);
        if (err.response) {
            console.error('[TerminalEngine] API Error Data:', err.response.data);
        }
        return [];
    }
}

// ─── Main Cron: Every 10 minutes (Phase 1A: Gathering Engine) ──────────────
export async function runTerminalEngine(): Promise<void> {
    console.log('🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...');

    const newsItems = await fetchLatestNews();

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

            // 1. Check if already processed (Deduplication at application level)
            const [existing] = await db.select({ id: coinNews.id }) // Check coinNews for already processed items
                .from(coinNews)
                .where(eq(coinNews.sourceHash, hash))
                .limit(1);

            if (existing) {
                console.log(`[TerminalEngine] Skipping duplicate (in coinNews): "${rawText.slice(0, 50)}..."`);
                duplicateCount++;
                continue;
            }

            // 2. Insert into raw_news_buffer for later triage (Phase 1B)
            // Note: raw_news_buffer table needs to be created via schema update
            // Using raw SQL since raw_news_buffer model may not be imported yet
            await db.execute(`
                INSERT INTO raw_news_buffer (
                    title, 
                    source, 
                    retrieved_at, 
                    source_hash
                ) VALUES (
                    $1, $2, NOW(), $3
                )
                ON CONFLICT (source_hash) DO NOTHING
            `, [rawText, newsItem.source || 'Unknown', hash]);

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