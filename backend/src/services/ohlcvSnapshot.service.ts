import { db } from '../config/db';
import { ohlcvCandles, ohlcvIndicators } from '../models/market.model';
import { eq, sql, asc, desc } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';
import { logger } from '../utils/logger';
import { deleteCachePattern } from '../config/redis';
import { getCoinKlinesRange } from './binance.service';

const BINANCE_INTERVAL_MAP: Record<string, string> = {
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
};

export async function fetchAndStoreCandles(symbol: string, timeframe: string, limit: number): Promise<number> {
    try {
        const binanceInterval = BINANCE_INTERVAL_MAP[timeframe];
        if (!binanceInterval) throw new Error(`Unsupported timeframe: ${timeframe}`);

        // Calculate time range for latest candles
        const intervalMs = timeframe === '4h' ? 4 * 60 * 60 * 1000 :
                          timeframe === '1d' ? 24 * 60 * 60 * 1000 :
                          7 * 24 * 60 * 60 * 1000; // 1w
        const endTime = Date.now();
        const startTime = endTime - (limit * intervalMs);

        const klines = await getCoinKlinesRange(symbol, binanceInterval, startTime, endTime);

        const candles: typeof ohlcvCandles.$inferInsert[] = klines.map(k => ({
            coinSymbol: symbol,
            timeframe,
            openTime: new Date(k.closeTime - intervalMs), // Approximate openTime
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
            closeTime: new Date(k.closeTime),
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < candles.length; i += BATCH_SIZE) {
            const batch = candles.slice(i, i + BATCH_SIZE);
            await db.insert(ohlcvCandles)
                .values(batch)
                .onConflictDoUpdate({
                    target: [ohlcvCandles.coinSymbol, ohlcvCandles.timeframe, ohlcvCandles.openTime],
                    set: {
                        open: sql`EXCLUDED.open`,
                        high: sql`EXCLUDED.high`,
                        low: sql`EXCLUDED.low`,
                        close: sql`EXCLUDED.close`,
                        volume: sql`EXCLUDED.volume`,
                        closeTime: sql`EXCLUDED.close_time`,
                    },
                });
        }

        // Invalidate cache
        await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

        return candles.length;
    } catch (error) {
        logger.error(`[OHLCV] fetchAndStoreCandles failed for ${symbol} ${timeframe}:`, error);
        return 0;
    }
}

export async function backfillHistoricalCandles(symbol: string, timeframe: string, daysBack: number): Promise<number> {
    try {
        const binanceInterval = BINANCE_INTERVAL_MAP[timeframe];
        if (!binanceInterval) throw new Error(`Unsupported timeframe: ${timeframe}`);

        const endTime = Date.now();
        const startTime = endTime - (daysBack * 24 * 60 * 60 * 1000);

        const klines = await getCoinKlinesRange(symbol, binanceInterval, startTime, endTime);

        const candles: typeof ohlcvCandles.$inferInsert[] = klines.map(k => ({
            coinSymbol: symbol,
            timeframe,
            openTime: new Date(k.closeTime - (timeframe === '4h' ? 4 * 60 * 60 * 1000 : timeframe === '1d' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)), // Approximate
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
            closeTime: new Date(k.closeTime),
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < candles.length; i += BATCH_SIZE) {
            const batch = candles.slice(i, i + BATCH_SIZE);
            await db.insert(ohlcvCandles)
                .values(batch)
                .onConflictDoNothing();
        }

        // Invalidate cache
        await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

        return candles.length;
    } catch (error) {
        logger.error(`[OHLCV] backfillHistoricalCandles failed for ${symbol} ${timeframe}:`, error);
        return 0;
    }
}

function calculateEMA(values: number[], period: number): (number | null)[] {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            ema.push(null);
        } else if (i === period - 1) {
            const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
            ema.push(sum / period);
        } else {
            ema.push(values[i] * multiplier + (ema[i - 1]! * (1 - multiplier)));
        }
    }

    return ema;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
    const tr: number[] = [];
    for (let i = 0; i < highs.length; i++) {
        if (i === 0) {
            tr.push(highs[i] - lows[i]);
        } else {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(tr1, tr2, tr3));
        }
    }

    if (tr.length < period) return Array(tr.length).fill(null);

    const atr: (number | null)[] = [];
    for (let i = 0; i < tr.length; i++) {
        if (i < period - 1) {
            atr.push(null);
        } else if (i === period - 1) {
            const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
            atr.push(sum / period);
        } else {
            atr.push((atr[i - 1]! * (period - 1) + tr[i]) / period);
        }
    }

    return atr;
}

function calculateSMA(values: number[], period: number): (number | null)[] {
    const sma: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
    }
    return sma;
}

export async function computeIndicators(symbol: string, timeframe: string): Promise<number> {
    try {
        // Check if there are any candles without indicators
        const [result] = await db.select({ count: sql<number>`count(*)` })
            .from(ohlcvCandles)
            .leftJoin(ohlcvIndicators, sql`${ohlcvIndicators.coinSymbol} = ${ohlcvCandles.coinSymbol} AND ${ohlcvIndicators.timeframe} = ${ohlcvCandles.timeframe} AND ${ohlcvIndicators.openTime} = ${ohlcvCandles.openTime}`)
            .where(sql`${ohlcvCandles.coinSymbol} = ${symbol} AND ${ohlcvCandles.timeframe} = ${timeframe} AND ${ohlcvIndicators.id} IS NULL`);

        if (result.count === 0) return 0; // No new candles

        // Get all candles for full calculation
        const allCandles = await db.select()
            .from(ohlcvCandles)
            .where(sql`${ohlcvCandles.coinSymbol} = ${symbol} AND ${ohlcvCandles.timeframe} = ${timeframe}`)
            .orderBy(asc(ohlcvCandles.openTime));

        if (allCandles.length === 0) return 0;

        const closes = allCandles.map(c => c.close);
        const highs = allCandles.map(c => c.high);
        const lows = allCandles.map(c => c.low);
        const volumes = allCandles.map(c => c.volume);

        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const atr14 = calculateATR(highs, lows, closes, 14);
        const volumeAvg20 = calculateSMA(volumes, 20);

        const indicators = allCandles.map((candle, i) => ({
            coinSymbol: symbol,
            timeframe,
            openTime: candle.openTime,
            ema20: ema20[i],
            ema50: ema50[i],
            ema200: ema200[i],
            atr14: atr14[i],
            volumeAvg20: volumeAvg20[i],
            computedAt: new Date(),
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
            const batch = indicators.slice(i, i + BATCH_SIZE);
            await db.insert(ohlcvIndicators)
                .values(batch)
                .onConflictDoUpdate({
                    target: [ohlcvIndicators.coinSymbol, ohlcvIndicators.timeframe, ohlcvIndicators.openTime],
                    set: {
                        ema20: sql`EXCLUDED.ema_20`,
                        ema50: sql`EXCLUDED.ema_50`,
                        ema200: sql`EXCLUDED.ema_200`,
                        atr14: sql`EXCLUDED.atr_14`,
                        volumeAvg20: sql`EXCLUDED.volume_avg_20`,
                        computedAt: sql`EXCLUDED.computed_at`,
                    },
                });
        }

        // Invalidate cache
        await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

        return indicators.length;
    } catch (error) {
        logger.error(`[OHLCV] computeIndicators failed for ${symbol} ${timeframe}:`, error);
        return 0;
    }
}

export async function getCandles(symbol: string, timeframe: string, limit: number): Promise<typeof ohlcvCandles.$inferSelect[]> {
    return await db.select()
        .from(ohlcvCandles)
        .where(sql`${ohlcvCandles.coinSymbol} = ${symbol} AND ${ohlcvCandles.timeframe} = ${timeframe}`)
        .orderBy(desc(ohlcvCandles.openTime))
        .limit(limit);
}

export async function getLatestIndicator(symbol: string, timeframe: string): Promise<typeof ohlcvIndicators.$inferSelect | null> {
    const result = await db.select()
        .from(ohlcvIndicators)
        .where(sql`${ohlcvIndicators.coinSymbol} = ${symbol} AND ${ohlcvIndicators.timeframe} = ${timeframe}`)
        .orderBy(desc(ohlcvIndicators.openTime))
        .limit(1);
    return result[0] || null;
}

export async function getIndicatorAtTime(symbol: string, timeframe: string, timestamp: Date): Promise<typeof ohlcvIndicators.$inferSelect | null> {
    const result = await db.select()
        .from(ohlcvIndicators)
        .where(sql`${ohlcvIndicators.coinSymbol} = ${symbol} AND ${ohlcvIndicators.timeframe} = ${timeframe} AND ${ohlcvIndicators.openTime} <= ${timestamp}`)
        .orderBy(desc(ohlcvIndicators.openTime))
        .limit(1);
    return result[0] || null;
}