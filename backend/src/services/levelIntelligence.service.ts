import { db } from '../config/db';
import { levelIntelligence, levelInteractions, levelTypeEnum, timeframeEnum, interactionTypeEnum } from '../models/market.model';
import { getCoinKlinesRange, BinanceKline } from './binance.service';
import { getPriceWithFallback } from './priceService';
import { logger } from '../utils/logger';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface LevelData {
    coinSymbol: string;
    levelPrice: number;
    levelType: 'support' | 'resistance';
    timeframe: '1h' | '4h' | '1d' | '1w';
    touchCount: number;
    bounceCount: number;
    breakCount: number;
    fakeoutCount: number;
    avgBouncePercent?: number;
    avgBreakPercent?: number;
    volumeAtLevel?: number;
    lastTouchedAt?: Date;
    confidenceScore: number;
    flipped: boolean;
}

export interface InteractionData {
    levelId: number;
    candleTimestamp: Date;
    priceAtTouch: number;
    interactionType: 'touch' | 'bounce' | 'break' | 'fakeout';
    magnitudePercent?: number;
    volumeAtTouch?: number;
}

// ─── Configurable History Windows ───────────────────────────────────────────

const TIMEFRAME_CONFIGS = {
    '1h': { limit: 1000, interval: '1h' },
    '4h': { limit: 1000, interval: '4h' },
    '1d': { limit: 500, interval: '1d' },
    '1w': { limit: 200, interval: '1w' },
} as const;

// ─── Fetch Candles ──────────────────────────────────────────────────────────

export async function fetchCandles(coinSymbol: string, timeframe: '1h' | '4h' | '1d' | '1w', limit?: number): Promise<CandleData[]> {
    try {
        const config = TIMEFRAME_CONFIGS[timeframe];
        const candleLimit = limit || config.limit;
        const endTime = Date.now();
        const startTime = endTime - (candleLimit * getIntervalMs(timeframe));

        const binanceKlines = await getCoinKlinesRange(coinSymbol, config.interval, startTime, endTime);

        return binanceKlines.map(k => ({
            timestamp: k.closeTime,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
        }));
    } catch (error) {
        logger.error('[LevelIntelligence] fetchCandles failed for %s %s: %s', coinSymbol, timeframe, error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Calculate Levels ───────────────────────────────────────────────────────

export function calculateLevels(candles: CandleData[], timeframe: '1h' | '4h' | '1d' | '1w'): LevelData[] {
    if (candles.length < 10) {
        return [];
    }

    const pivots = findPivotPoints(candles);
    const clusters = clusterLevels(pivots, candles);

    const levels: LevelData[] = [];

    for (const cluster of clusters) {
        const levelPrice = cluster.avgPrice;
        const touches = analyzeTouches(candles, levelPrice);

        if (touches.length < 1) continue;

        const stats = calculateStats(touches, candles, levelPrice);
        const confidenceScore = calculateConfidenceScore(stats, touches.length, timeframe);

        levels.push({
            coinSymbol: '', // Set by caller
            levelPrice,
            levelType: cluster.type,
            timeframe,
            touchCount: touches.length,
            bounceCount: stats.bounceCount,
            breakCount: stats.breakCount,
            fakeoutCount: stats.fakeoutCount,
            avgBouncePercent: stats.avgBouncePercent,
            avgBreakPercent: stats.avgBreakPercent,
            volumeAtLevel: stats.avgVolume,
            lastTouchedAt: new Date(touches[touches.length - 1].timestamp),
            confidenceScore,
            flipped: false, // TODO: implement flip detection
        });
    }

    return levels;
}

// ─── Helper: Find Pivot Points ─────────────────────────────────────────────

function findPivotPoints(candles: CandleData[]): Array<{ price: number; type: 'support' | 'resistance'; index: number }> {
    const pivots: Array<{ price: number; type: 'support' | 'resistance'; index: number }> = [];

    for (let i = 2; i < candles.length - 2; i++) {
        const current = candles[i];

        // Support pivot: low is lower than surrounding 4 candles
        if (current.low < candles[i-1].low && current.low < candles[i-2].low &&
            current.low < candles[i+1].low && current.low < candles[i+2].low) {
            pivots.push({ price: current.low, type: 'support', index: i });
        }

        // Resistance pivot: high is higher than surrounding 4 candles
        if (current.high > candles[i-1].high && current.high > candles[i-2].high &&
            current.high > candles[i+1].high && current.high > candles[i+2].high) {
            pivots.push({ price: current.high, type: 'resistance', index: i });
        }
    }

    return pivots;
}

// ─── Helper: Cluster Levels ────────────────────────────────────────────────

function clusterLevels(pivots: Array<{ price: number; type: 'support' | 'resistance'; index: number }>, candles: CandleData[]): Array<{ avgPrice: number; type: 'support' | 'resistance' }> {
    const clusters: Array<{ prices: number[]; type: 'support' | 'resistance' }> = [];

    for (const pivot of pivots) {
        let found = false;
        for (const cluster of clusters) {
            if (cluster.type === pivot.type) {
                const tolerance = 0.01; // 1%
                const minPrice = Math.min(...cluster.prices);
                const maxPrice = Math.max(...cluster.prices);
                if (pivot.price >= minPrice * (1 - tolerance) && pivot.price <= maxPrice * (1 + tolerance)) {
                    cluster.prices.push(pivot.price);
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            clusters.push({ prices: [pivot.price], type: pivot.type });
        }
    }

    return clusters.map(c => ({
        avgPrice: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
        type: c.type,
    }));
}

// ─── Helper: Analyze Touches ───────────────────────────────────────────────

function analyzeTouches(candles: CandleData[], levelPrice: number): Array<{ timestamp: number; type: 'touch' | 'bounce' | 'break' | 'fakeout'; magnitude?: number; volume: number }> {
    const touches: Array<{ timestamp: number; type: 'touch' | 'bounce' | 'break' | 'fakeout'; magnitude?: number; volume: number }> = [];

    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const nextCandle = candles[i + 1];

        if (candle.low <= levelPrice && candle.high >= levelPrice) {
            // Touch
            const touchType = classifyTouch(candle, nextCandle, levelPrice);
            touches.push({
                timestamp: candle.timestamp,
                type: touchType.type,
                magnitude: touchType.magnitude,
                volume: candle.volume,
            });
        }
    }

    return touches;
}

// ─── Helper: Classify Touch ────────────────────────────────────────────────

function classifyTouch(candle: CandleData, nextCandle: CandleData | undefined, levelPrice: number): { type: 'touch' | 'bounce' | 'break' | 'fakeout'; magnitude?: number } {
    if (!nextCandle) {
        return { type: 'touch' };
    }

    const closeAbove = nextCandle.close > levelPrice;
    const closeBelow = nextCandle.close < levelPrice;

    if (candle.close > levelPrice) {
        // Resistance touch
        if (closeBelow && (levelPrice - nextCandle.close) / levelPrice > 0.005) {
            return { type: 'bounce', magnitude: ((levelPrice - nextCandle.close) / levelPrice) * 100 };
        }
        if (closeAbove && (nextCandle.close - levelPrice) / levelPrice > 0.01) {
            return { type: 'break', magnitude: ((nextCandle.close - levelPrice) / levelPrice) * 100 };
        }
    } else if (candle.close < levelPrice) {
        // Support touch
        if (closeAbove && (nextCandle.close - levelPrice) / levelPrice > 0.005) {
            return { type: 'bounce', magnitude: ((nextCandle.close - levelPrice) / levelPrice) * 100 };
        }
        if (closeBelow && (levelPrice - nextCandle.close) / levelPrice > 0.01) {
            return { type: 'break', magnitude: ((levelPrice - nextCandle.close) / levelPrice) * 100 };
        }
    }

    // Check for fakeout: initial move then reverse
    if (nextCandle && candles[i + 2]) {
        const thirdCandle = candles[i + 2];
        const initialMove = Math.abs(nextCandle.close - levelPrice) / levelPrice > 0.005;
        const reverseMove = Math.abs(thirdCandle.close - nextCandle.close) / nextCandle.close > 0.005;
        if (initialMove && reverseMove && Math.sign(thirdCandle.close - nextCandle.close) !== Math.sign(nextCandle.close - levelPrice)) {
            return { type: 'fakeout' };
        }
    }

    return { type: 'touch' };
}

// ─── Helper: Calculate Stats ───────────────────────────────────────────────

function calculateStats(touches: Array<{ timestamp: number; type: string; magnitude?: number; volume: number }>, candles: CandleData[], levelPrice: number) {
    const bounceMagnitudes = touches.filter(t => t.type === 'bounce').map(t => t.magnitude).filter(m => m !== undefined) as number[];
    const breakMagnitudes = touches.filter(t => t.type === 'break').map(t => t.magnitude).filter(m => m !== undefined) as number[];
    const volumes = touches.map(t => t.volume);

    return {
        bounceCount: touches.filter(t => t.type === 'bounce').length,
        breakCount: touches.filter(t => t.type === 'break').length,
        fakeoutCount: touches.filter(t => t.type === 'fakeout').length,
        avgBouncePercent: bounceMagnitudes.length > 0 ? bounceMagnitudes.reduce((a, b) => a + b, 0) / bounceMagnitudes.length : undefined,
        avgBreakPercent: breakMagnitudes.length > 0 ? breakMagnitudes.reduce((a, b) => a + b, 0) / breakMagnitudes.length : undefined,
        avgVolume: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : undefined,
    };
}

// ─── Helper: Calculate Confidence Score ────────────────────────────────────

function calculateConfidenceScore(stats: any, touchCount: number, timeframe: string): number {
    let score = 0;

    if (touchCount >= 3) {
        score = (stats.bounceCount / touchCount) * 60;
    }

    // Sample size penalty
    if (touchCount < 5) score -= 20;
    else if (touchCount < 10) score -= 10;

    // Staleness penalty (simplified, assume lastTouchedAt is recent)
    // TODO: implement staleness check

    // Fakeout penalty
    score -= stats.fakeoutCount * 5;

    // Break penalty
    score -= stats.breakCount * 2;

    // Incomplete data penalty (simplified)
    if (touchCount < 3) score -= 10;

    return Math.max(0, Math.min(100, score));
}

// ─── Helper: Get Interval in MS ────────────────────────────────────────────

function getIntervalMs(timeframe: string): number {
    switch (timeframe) {
        case '1h': return 60 * 60 * 1000;
        case '4h': return 4 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        case '1w': return 7 * 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000;
    }
}

// ─── Save Levels (Tolerance-based Upsert) ──────────────────────────────────

export async function saveLevels(levels: LevelData[]): Promise<void> {
    for (const level of levels) {
        try {
            // Check for existing level within 1% tolerance
            const tolerance = 0.01;
            const minPrice = level.levelPrice * (1 - tolerance);
            const maxPrice = level.levelPrice * (1 + tolerance);

            const existing = await db.select()
                .from(levelIntelligence)
                .where(and(
                    eq(levelIntelligence.coinSymbol, level.coinSymbol),
                    eq(levelIntelligence.timeframe, level.timeframe),
                    eq(levelIntelligence.levelType, level.levelType),
                    gte(levelIntelligence.levelPrice, minPrice),
                    lte(levelIntelligence.levelPrice, maxPrice)
                ))
                .limit(1);

            if (existing.length > 0) {
                // Update existing
                await db.update(levelIntelligence)
                    .set({
                        touchCount: sql`${levelIntelligence.touchCount} + ${level.touchCount}`,
                        bounceCount: sql`${levelIntelligence.bounceCount} + ${level.bounceCount}`,
                        breakCount: sql`${levelIntelligence.breakCount} + ${level.breakCount}`,
                        fakeoutCount: sql`${levelIntelligence.fakeoutCount} + ${level.fakeoutCount}`,
                        avgBouncePercent: level.avgBouncePercent || sql`${levelIntelligence.avgBouncePercent}`,
                        avgBreakPercent: level.avgBreakPercent || sql`${levelIntelligence.avgBreakPercent}`,
                        volumeAtLevel: level.volumeAtLevel || sql`${levelIntelligence.volumeAtLevel}`,
                        lastTouchedAt: level.lastTouchedAt || sql`${levelIntelligence.lastTouchedAt}`,
                        confidenceScore: level.confidenceScore,
                        updatedAt: new Date(),
                    })
                    .where(eq(levelIntelligence.id, existing[0].id));
            } else {
                // Insert new
                await db.insert(levelIntelligence).values({
                    coinSymbol: level.coinSymbol,
                    levelPrice: level.levelPrice.toString(), // numeric
                    levelType: level.levelType,
                    timeframe: level.timeframe,
                    touchCount: level.touchCount,
                    bounceCount: level.bounceCount,
                    breakCount: level.breakCount,
                    fakeoutCount: level.fakeoutCount,
                    avgBouncePercent: level.avgBouncePercent?.toString(),
                    avgBreakPercent: level.avgBreakPercent?.toString(),
                    volumeAtLevel: level.volumeAtLevel?.toString(),
                    lastTouchedAt: level.lastTouchedAt,
                    confidenceScore: level.confidenceScore,
                    flipped: level.flipped,
                });
            }
        } catch (error) {
            logger.error('[LevelIntelligence] saveLevels failed for %s: %s', level.coinSymbol, error instanceof Error ? error.message : String(error));
        }
    }
}

// ─── Get Levels for Coin ────────────────────────────────────────────────────

export async function getLevelsForCoin(coinSymbol: string, timeframe?: '1h' | '4h' | '1d' | '1w'): Promise<LevelData[]> {
    try {
        let query = db.select().from(levelIntelligence).where(eq(levelIntelligence.coinSymbol, coinSymbol));

        if (timeframe) {
            query = query.where(eq(levelIntelligence.timeframe, timeframe));
        }

        const rows = await query;

        return rows.map(row => ({
            coinSymbol: row.coinSymbol,
            levelPrice: parseFloat(row.levelPrice),
            levelType: row.levelType,
            timeframe: row.timeframe,
            touchCount: row.touchCount,
            bounceCount: row.bounceCount,
            breakCount: row.breakCount,
            fakeoutCount: row.fakeoutCount,
            avgBouncePercent: row.avgBouncePercent ? parseFloat(row.avgBouncePercent) : undefined,
            avgBreakPercent: row.avgBreakPercent ? parseFloat(row.avgBreakPercent) : undefined,
            volumeAtLevel: row.volumeAtLevel ? parseFloat(row.volumeAtLevel) : undefined,
            lastTouchedAt: row.lastTouchedAt || undefined,
            confidenceScore: row.confidenceScore,
            flipped: row.flipped,
        }));
    } catch (error) {
        logger.error('[LevelIntelligence] getLevelsForCoin failed for %s: %s', coinSymbol, error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Get Nearby Levels ─────────────────────────────────────────────────────

export async function getNearbyLevels(coinSymbol: string, currentPrice: number, tolerancePercent: number = 5): Promise<LevelData[]> {
    try {
        const tolerance = tolerancePercent / 100;
        const minPrice = currentPrice * (1 - tolerance);
        const maxPrice = currentPrice * (1 + tolerance);

        const rows = await db.select()
            .from(levelIntelligence)
            .where(and(
                eq(levelIntelligence.coinSymbol, coinSymbol),
                gte(sql`${levelIntelligence.levelPrice}::numeric`, minPrice),
                lte(sql`${levelIntelligence.levelPrice}::numeric`, maxPrice)
            ));

        return rows.map(row => ({
            coinSymbol: row.coinSymbol,
            levelPrice: parseFloat(row.levelPrice),
            levelType: row.levelType,
            timeframe: row.timeframe,
            touchCount: row.touchCount,
            bounceCount: row.bounceCount,
            breakCount: row.breakCount,
            fakeoutCount: row.fakeoutCount,
            avgBouncePercent: row.avgBouncePercent ? parseFloat(row.avgBouncePercent) : undefined,
            avgBreakPercent: row.avgBreakPercent ? parseFloat(row.avgBreakPercent) : undefined,
            volumeAtLevel: row.volumeAtLevel ? parseFloat(row.volumeAtLevel) : undefined,
            lastTouchedAt: row.lastTouchedAt || undefined,
            confidenceScore: row.confidenceScore,
            flipped: row.flipped,
        }));
    } catch (error) {
        logger.error('[LevelIntelligence] getNearbyLevels failed for %s: %s', coinSymbol, error instanceof Error ? error.message : String(error));
        return [];
    }
}