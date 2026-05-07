import axios from 'axios';
import { db } from '../config/db';
import { ohlcvCandles, ohlcvIndicators } from '../models/market.model';
import { eq, sql, asc, desc } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';
import { logger } from '../utils/logger';
import { deleteCachePattern } from '../config/redis';

const BINANCE_INTERVAL_MAP: Record<string, string> = {
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
};

interface BinanceKline {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseAssetVolume: string;
    takerBuyQuoteAssetVolume: string;
    unusedField: string;
}

async function fetchBinanceKlines(symbol: string, interval: string, limit: number = 500, startTime?: number): Promise<BinanceKline[]> {
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
    if (startTime) {
        url += `&startTime=${startTime}`;
    }
    const response = await axios.get(url);
    return response.data.map((k: unknown[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteAssetVolume: k[7],
        numberOfTrades: k[8],
        takerBuyBaseAssetVolume: k[9],
        takerBuyQuoteAssetVolume: k[10],
        unusedField: k[11],
    }));
}

export async function fetchAndStoreCandles(symbol: string, timeframe: string, limit: number): Promise<number> {
    try {
        const binanceInterval = BINANCE_INTERVAL_MAP[timeframe];
        const klines = await fetchBinanceKlines(symbol, binanceInterval, limit);

        const candles = klines.map(k => ({
            coinSymbol: symbol,
            timeframe,
            openTime: new Date(k.openTime),
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: parseFloat(k.close),
            volume: parseFloat(k.volume),
            closeTime: new Date(k.closeTime),
        }));

        for (const candle of candles) {
            await db.insert(ohlcvCandles)
                .values(candle)
                .onConflictDoUpdate({
                    target: [ohlcvCandles.coinSymbol, ohlcvCandles.timeframe, ohlcvCandles.openTime],
                    set: {
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                        closeTime: candle.closeTime,
                    },
                });
        }

        // Invalidate cache
        await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

        return candles.length;
    } catch (error) {
        logger.error(`[OHLCV] fetchAndStoreCandles failed for ${symbol} ${timeframe}:`, error);
        throw error;
    }
}

export async function backfillHistoricalCandles(symbol: string, timeframe: string, daysBack: number): Promise<number> {
    const binanceInterval = BINANCE_INTERVAL_MAP[timeframe];
    const totalCandles = [];
    const chunkSize = timeframe === '4h' ? 500 : timeframe === '1d' ? 500 : 200;
    let startTime = Date.now() - daysBack * 24 * 60 * 60 * 1000; // Start from daysBack ago

    while (true) {
        try {
            const klines = await fetchBinanceKlines(symbol, binanceInterval, chunkSize, startTime);
            if (klines.length === 0) break;

            const candles = klines.map(k => ({
                coinSymbol: symbol,
                timeframe,
                openTime: new Date(k.openTime),
                open: parseFloat(k.open),
                high: parseFloat(k.high),
                low: parseFloat(k.low),
                close: parseFloat(k.close),
                volume: parseFloat(k.volume),
                closeTime: new Date(k.closeTime),
            }));

            for (const candle of candles) {
                await db.insert(ohlcvCandles)
                    .values(candle)
                    .onConflictDoNothing();
            }

            totalCandles.push(...candles);

            // Rate limit
            await new Promise(resolve => setTimeout(resolve, 200));

            if (klines.length < chunkSize) break;
            startTime = klines[klines.length - 1].closeTime + 1; // Next chunk start
        } catch (error) {
            logger.error(`[OHLCV] backfill chunk failed for ${symbol} ${timeframe}:`, error);
            break;
        }
    }

    // Invalidate cache
    await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

    return totalCandles.length;
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
        const candles = await db.select()
            .from(ohlcvCandles)
            .where(sql`${ohlcvCandles.coinSymbol} = ${symbol} AND ${ohlcvCandles.timeframe} = ${timeframe}`)
            .orderBy(asc(ohlcvCandles.openTime));

        if (candles.length === 0) return 0;

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const atr14 = calculateATR(highs, lows, closes, 14);
        const volumeAvg20 = calculateSMA(volumes, 20);

        const indicators = candles.map((candle, i) => ({
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

        for (const indicator of indicators) {
            await db.insert(ohlcvIndicators)
                .values(indicator)
                .onConflictDoUpdate({
                    target: [ohlcvIndicators.coinSymbol, ohlcvIndicators.timeframe, ohlcvIndicators.openTime],
                    set: {
                        ema20: indicator.ema20,
                        ema50: indicator.ema50,
                        ema200: indicator.ema200,
                        atr14: indicator.atr14,
                        volumeAvg20: indicator.volumeAvg20,
                        computedAt: indicator.computedAt,
                    },
                });
        }

        // Invalidate cache
        await deleteCachePattern(`ohlcv:${symbol}:${timeframe}*`);

        return indicators.length;
    } catch (error) {
        logger.error(`[OHLCV] computeIndicators failed for ${symbol} ${timeframe}:`, error);
        throw error;
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