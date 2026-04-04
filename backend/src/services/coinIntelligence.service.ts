import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { eq, gt, sql, and } from 'drizzle-orm';
import { getPriceWithFallback, type PriceResult } from './priceService';
import { getBinanceHistory, type BinanceHistoryResult } from './binanceHistory.service';
import { getWikipediaBackground } from './wikipedia.service';

export interface CoinIntelligence {
    coinSymbol: string;
    ath: number | null;
    athDate: string | null;
    trend8w: 'uptrend' | 'downtrend' | 'sideways' | null;
    week52High: number | null;
    week52Low: number | null;
    priceChange30d: string | null;
    wikiBackground: string | null;
    dexBoostActive: boolean;
    dataSource: 'binance' | 'dexscreener' | 'unknown';
}

export async function getCoinIntelligence(symbol: string, tokenAddress?: string): Promise<CoinIntelligence> {
    // STEP 1 - Cache check (4-hour TTL)
    const cached = await db.select()
        .from(coinIntelligenceCache)
        .where(and(
            eq(coinIntelligenceCache.coinSymbol, symbol),
            gt(coinIntelligenceCache.cachedAt, sql`NOW() - INTERVAL '4 hours'`)
        ))
        .limit(1);

    if (cached.length > 0) {
        return {
            coinSymbol: cached[0].coinSymbol,
            ath: cached[0].ath,
            athDate: cached[0].athDate,
            trend8w: cached[0].trend8w as CoinIntelligence['trend8w'],
            week52High: cached[0].week52High,
            week52Low: cached[0].week52Low,
            priceChange30d: cached[0].priceChange30d?.toString() ?? null,
            wikiBackground: cached[0].wikiBackground,
            dexBoostActive: cached[0].dexBoostActive,
            dataSource: (cached[0].dataSource as CoinIntelligence['dataSource']) ?? 'unknown',
        };
    }

    // STEP 2 - Parallel fetch
    const [historyResult, wikiResult, priceResult] = await Promise.allSettled([
        getBinanceHistory(symbol),
        getWikipediaBackground(symbol),
        getPriceWithFallback(symbol, tokenAddress),
    ]);

    const historyData: BinanceHistoryResult | null = historyResult.status === 'fulfilled' ? historyResult.value : null;
    const wikiData: string | null = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
    const priceData: PriceResult | null = priceResult.status === 'fulfilled' ? priceResult.value : null;

    // STEP 3 - Build object
    const intel: CoinIntelligence = {
        coinSymbol: symbol,
        ath: historyData?.ath ?? null,
        athDate: historyData?.athDate ?? null,
        trend8w: historyData?.trend8w ?? null,
        week52High: historyData?.week52High ?? null,
        week52Low: historyData?.week52Low ?? null,
        priceChange30d: historyData?.priceChange30d ?? null,
        wikiBackground: wikiData ?? null,
        dexBoostActive: priceData?.source === 'dexscreener',
        dataSource: historyData ? 'binance' : priceData ? 'dexscreener' : 'unknown',
    };

    // STEP 4 - Upsert with Drizzle
    await db.insert(coinIntelligenceCache)
        .values({
            coinSymbol: intel.coinSymbol,
            ath: intel.ath,
            athDate: intel.athDate,
            trend8w: intel.trend8w,
            week52High: intel.week52High,
            week52Low: intel.week52Low,
            priceChange30d: intel.priceChange30d ? parseFloat(intel.priceChange30d) : null,
            wikiBackground: intel.wikiBackground,
            dexBoostActive: intel.dexBoostActive,
            dataSource: intel.dataSource,
        })
        .onConflictDoUpdate({
            target: coinIntelligenceCache.coinSymbol,
            set: {
                ath: intel.ath,
                athDate: intel.athDate,
                trend8w: intel.trend8w,
                week52High: intel.week52High,
                week52Low: intel.week52Low,
                priceChange30d: intel.priceChange30d ? parseFloat(intel.priceChange30d) : null,
                wikiBackground: intel.wikiBackground,
                dexBoostActive: intel.dexBoostActive,
                dataSource: intel.dataSource,
                cachedAt: sql`NOW()`,
            },
        });

    // STEP 5 - Return intel
    return intel;
}