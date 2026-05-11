import cron from 'node-cron';
import { db } from '../config/db';
import { fetchHistoricalNewsForCoins, backfillPriceOutcomes } from '../services/temporalIntelligence.service';
import { coinNews } from '../models/market.model';
import { sql } from 'drizzle-orm';
import { TRACKED_COIN_SET } from '../config/coins';

export async function runHistoricalNewsCron(): Promise<void> {
    console.log('📅 [Historical News Cron] Started.');

    try {
        // Get all unique coin symbols from published news (last 7 days)
        const symbolsResult = await db.select({ symbol: coinNews.coinSymbol })
            .from(coinNews)
            .where(sql`${coinNews.publishedAt} > NOW() - INTERVAL '7 days'`)
            .groupBy(coinNews.coinSymbol);

        const symbols = symbolsResult.map(row => row.symbol).filter((s): s is string => !!s && TRACKED_COIN_SET.has(s));

        if (symbols.length === 0) {
            console.log('[Historical News Cron] No coins found. Skipping.');
            return;
        }

        console.log(`[Historical News Cron] Processing ${symbols.length} coins:`, symbols.join(', '));

        // Fetch historical news for all coins
        await fetchHistoricalNewsForCoins(symbols);

        // Backfill price outcomes
        await backfillPriceOutcomes();

        console.log('✅ [Historical News Cron] Completed successfully.');

    } catch (err) {
        console.error('❌ [Historical News Cron] Failed:', err);
    }
}

export function startHistoricalNewsCron(): void {
    cron.schedule('0 4 * * *', () => runHistoricalNewsCron());
    console.log('⏰ Historical News Cron scheduled — daily at 04:00 UTC');
}