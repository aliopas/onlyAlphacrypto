import cron from 'node-cron';
import axios from 'axios';
import { TRACKED_COINS } from '../config/coins';
import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { BINANCE_BASE } from '../services/binance.service';

interface BinanceTicker {
    symbol: string;
    quoteVolume: string;
    priceChangePercent: string;
}

const MARKET_FILTER_CRITERIA = {
    MIN_VOLUME_USD: 50_000_000,   // $50M
    MAX_SPREAD_PERCENT: 0.5,       // 0.5%
    MAX_PRICE_CHANGE_24H: 25,      // 25%
} as const;

interface MarketData {
    volume: number;
    spread: number;
    priceChange: number;
}

async function fetchMarketFilterData(): Promise<Map<string, MarketData>> {
    const data = new Map<string, MarketData>();

    try {
        // Fetch from Binance: GET /api/v3/ticker/24hr
        const response = await axios.get(`${BINANCE_BASE}/ticker/24hr`);
        const tickers = response.data as BinanceTicker[];

        for (const coin of TRACKED_COINS) {
            const ticker = tickers.find((t: BinanceTicker) => t.symbol === `${coin}USDT`);
            if (ticker) {
                // Binance ticker has:
                // quoteVolume: 24h volume in USDT
                // priceChangePercent: price change %
                // Note: Spread not available in 24hr ticker, so skip spread check
                const volume = parseFloat(ticker.quoteVolume);
                const priceChange = parseFloat(ticker.priceChangePercent);

                data.set(coin, {
                    volume,
                    spread: 0, // Not available, set to 0 to pass check
                    priceChange
                });
            }
        }
    } catch (error) {
        logger.error('[MarketFilter] Failed to fetch Binance data:', error);
    }

    return data;
}

async function runMarketFilter(): Promise<void> {
    if (!env.MARKET_FILTER_ENABLED) return;

    const data = await fetchMarketFilterData();
    let updated = 0;

    for (const coin of TRACKED_COINS) {
        const coinData = data.get(coin);
        const isTradeable = coinData !== undefined
            && coinData.volume >= MARKET_FILTER_CRITERIA.MIN_VOLUME_USD
            && Math.abs(coinData.priceChange) <= MARKET_FILTER_CRITERIA.MAX_PRICE_CHANGE_24H;

        try {
            await db.update(coinIntelligenceCache)
                .set({ isTradeable })
                .where(eq(coinIntelligenceCache.coinSymbol, coin));

            if (!isTradeable) {
                logger.info(`[MarketFilter] ${coin} flagged NOT tradeable: vol=${coinData?.volume}, change=${coinData?.priceChange}%`);
            }
            updated++;
        } catch (error) {
            logger.error(`[MarketFilter] Failed to update ${coin}:`, error);
        }
    }

    logger.info(`[MarketFilter] Checked ${updated} coins`);
}

export async function startMarketFilterCron(): Promise<void> {
    // Run once on startup
    await runMarketFilter();

    // Schedule every 6 hours
    cron.schedule('0 */6 * * *', () => {
        runMarketFilter().catch(err => logger.error('[MarketFilter] Scheduled run failed:', err));
    });

    logger.info('[MarketFilter] Cron scheduled — every 6 hours');
}

export { runMarketFilter };