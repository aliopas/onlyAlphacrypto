import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNotNull } from 'drizzle-orm';
import { TRACKED_COIN_SET } from '../config/coins';
import { logger } from '../utils/logger';
import { binanceGet, BINANCE_BASE } from '../services/binance.service';

interface BinanceTickerAtTimeResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

interface ClosureSummary {
    totalClosed: number;
    trackedClosed: number;
    withinBounds: number;
    outsideBounds: number;
    noHistory: number;
    errors: string[];
}

interface Ticker24hAtTime {
    high24h: number;
    low24h: number;
    openTime: number;
    closeTime: number;
}

async function get24hTickerAtTime(symbol: string, timestamp: Date): Promise<Ticker24hAtTime | null> {
    try {
        const pair = `${symbol.toUpperCase()}USDT`;
        const targetMs = timestamp.getTime();

        const { data } = await binanceGet<BinanceTickerAtTimeResponse[]>(`${BINANCE_BASE}/ticker/24hr`, {
            symbol: pair,
        });

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        for (const ticker of data) {
            const openTime = ticker.openTime;
            const closeTime = ticker.closeTime;
            if (targetMs >= openTime && targetMs <= closeTime) {
                const high24h = parseFloat(ticker.highPrice);
                const low24h = parseFloat(ticker.lowPrice);
                if (isNaN(high24h) || isNaN(low24h)) return null;
                return { high24h, low24h, openTime, closeTime };
            }
        }

        return null;
    } catch (err) {
        logger.warn({ message: 'Failed to fetch 24h ticker at closure time', symbol, timestamp: timestamp.toISOString(), error: err instanceof Error ? err.message : String(err) });
        return null;
    }
}

async function validateSignalClosures(): Promise<ClosureSummary> {
    const summary: ClosureSummary = {
        totalClosed: 0,
        trackedClosed: 0,
        withinBounds: 0,
        outsideBounds: 0,
        noHistory: 0,
        errors: []
    };

    try {
        const closedSignals = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, false),
                isNotNull(signalPerformance.exitPrice),
                isNotNull(signalPerformance.closedAt)
            ))
            .limit(5000);

        summary.totalClosed = closedSignals.length;

        for (const signal of closedSignals) {
            try {
                if (!TRACKED_COIN_SET.has(signal.coinSymbol.toUpperCase())) {
                    continue;
                }

                summary.trackedClosed++;

                if (!signal.closedAt) {
                    summary.noHistory++;
                    continue;
                }

                const ticker = await get24hTickerAtTime(signal.coinSymbol, signal.closedAt);
                if (!ticker) {
                    summary.noHistory++;
                    summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): no 24h ticker history at ${signal.closedAt.toISOString()}`);
                    continue;
                }

                const exitPrice = signal.exitPrice ?? 0;
                const withinBounds = exitPrice >= ticker.low24h && exitPrice <= ticker.high24h;

                if (withinBounds) {
                    summary.withinBounds++;
                } else {
                    summary.outsideBounds++;
                    summary.errors.push(
                        `Signal #${signal.id} (${signal.coinSymbol}): exitPrice=${exitPrice} outside 24h range [${ticker.low24h}, ${ticker.high24h}] at ${signal.closedAt.toISOString()}`
                    );
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                summary.errors.push(`Signal #${signal.id} (${signal.coinSymbol}): validation error - ${message}`);
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Failed to fetch closed signals: ${message}`);
    }

    return summary;
}

async function main(): Promise<void> {
    logger.info('[ValidateSignalClosures] Starting signal closure validation');

    const summary = await validateSignalClosures();

    logger.info('[ValidateSignalClosures] Validation complete');
    logger.info('[ValidateSignalClosures] Total closed signals: %d', summary.totalClosed);
    logger.info('[ValidateSignalClosures] Tracked coin closures: %d', summary.trackedClosed);
    logger.info('[ValidateSignalClosures] Within 24h bounds at closure: %d', summary.withinBounds);
    logger.info('[ValidateSignalClosures] Outside 24h bounds at closure: %d', summary.outsideBounds);
    logger.info('[ValidateSignalClosures] No history at closure: %d', summary.noHistory);

    if (summary.errors.length > 0) {
        logger.warn('[ValidateSignalClosures] Issues found: %d', summary.errors.length);
        for (const error of summary.errors.slice(0, 50)) {
            logger.warn('[ValidateSignalClosures] - %s', error);
        }
        if (summary.errors.length > 50) {
            logger.warn('[ValidateSignalClosures] ... and %d more', summary.errors.length - 50);
        }
        process.exit(1);
    }

    logger.info('[ValidateSignalClosures] All tracked-coin closures are within 24h bounds at closure time.');
    process.exit(0);
}

main().catch((err) => {
    logger.error('[ValidateSignalClosures] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
