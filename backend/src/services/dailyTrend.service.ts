import { db } from '../config/db';
import { ohlcvIndicators } from '../models/market.model';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';

export type TrendLabel = 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH';

async function getLatest1dIndicator(symbol: string): Promise<{
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
} | null> {
    try {
        const [row] = await db
            .select()
            .from(ohlcvIndicators)
            .where(and(eq(ohlcvIndicators.coinSymbol, symbol), eq(ohlcvIndicators.timeframe, '1d')))
            .orderBy(desc(ohlcvIndicators.openTime));

        if (!row) return null;
        return {
            ema20: row.ema20 ?? null,
            ema50: row.ema50 ?? null,
            ema200: row.ema200 ?? null,
        };
    } catch (err) {
        logger.error(`[DailyTrend] Failed to get 1d indicators for ${symbol}:`, err);
        return null;
    }
}

export async function calculateDailyTrend(symbol: string): Promise<TrendLabel> {
    try {
        const indicator1d = await getLatest1dIndicator(symbol);
        if (!indicator1d || indicator1d.ema20 === null || indicator1d.ema50 === null) {
            return 'SIDEWAYS';
        }

        const ema20 = indicator1d.ema20;
        const ema50 = indicator1d.ema50;
        const ema200 = indicator1d.ema200;

        if (ema200 === null) {
            if (ema20 > ema50) return 'BULLISH';
            if (ema20 < ema50) return 'BEARISH';
            return 'SIDEWAYS';
        }

        if (ema20 > ema50 && ema50 > ema200) {
            return 'STRONG_BULLISH';
        } else if (ema20 > ema50) {
            return 'BULLISH';
        } else if (ema20 < ema50 && ema50 < ema200) {
            return 'STRONG_BEARISH';
        } else if (ema20 < ema50) {
            return 'BEARISH';
        }

        const maxVal = Math.max(ema20, ema50, ema200);
        const minVal = Math.min(ema20, ema50, ema200);
        const range = maxVal - minVal;
        const percentRange = range / maxVal;

        if (percentRange <= 0.01) {
            return 'SIDEWAYS';
        }

        return 'SIDEWAYS';
    } catch (err) {
        logger.error(`[DailyTrend] Error calculating trend for ${symbol}:`, err);
        return 'SIDEWAYS';
    }
}