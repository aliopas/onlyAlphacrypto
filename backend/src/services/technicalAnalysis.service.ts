import { getCandles, getLatestIndicator } from './ohlcvSnapshot.service';
import { isTrackedCoin } from '../config/coins';
import { db } from '../config/db';
import { ohlcvCandles, ohlcvIndicators, radarSignals } from '../models/market.model';
import { gt, count } from 'drizzle-orm';

type CandleRow = typeof ohlcvCandles.$inferSelect;
type IndicatorRow = typeof ohlcvIndicators.$inferSelect;

// ─── Trend Label Enum ─────────────────────────────────────
export type TrendLabel = 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH';

// ─── Support / Resistance Level ───────────────────────────
export interface SRLevel {
    price: number;
    type: 'support' | 'resistance';
    strengthScore: number;        // 0-100
    touchCount: number;           // number of price reactions
    volumeAtLevel: number;        // avg volume when price was near this level
    rejectionStrength: number;    // avg wick size as % of candle range
    lastTouchedAt: Date;
}

export interface SRTiers {
    strongLevels: SRLevel[];     // strengthScore >= 60 — for TP/SL
    allLevels: SRLevel[];         // strengthScore >= 40 — for quality scoring nearSR
}

// ─── Market Structure Result ──────────────────────────────
export type StructurePattern = 'HH_HL' | 'LH_LL' | 'BOS_BULLISH' | 'BOS_BEARISH' | 'CHOCH_BULLISH' | 'CHOCH_BEARISH' | 'FAILED_BOS' | 'NONE';

export interface MarketStructureResult {
    pattern: StructurePattern;
    trend: 'bullish' | 'bearish' | 'sideways';
    isChocho: boolean;             // CHOCH detected → -20 penalty
    isFailedBos: boolean;          // Failed BOS → no signal
    lastSwingHigh: number | null;
    lastSwingLow: number | null;
}

// ─── Candle Pattern Result ────────────────────────────────
export type RecognizedPattern = 'hammer' | 'shooting_star' | 'bullish_engulfing' | 'bearish_engulfing' | 'morning_star' | 'evening_star';

export interface CandlePatternResult {
    pattern: RecognizedPattern | null;
    direction: 'bullish' | 'bearish' | null;  // direction the pattern suggests
    volumeConfirmed: boolean;     // volume > volumeAvg20
    srAligned: boolean;           // pattern forms at S/R level
    isValid: boolean;             // all 3 conditions must be true
}

// ─── Volume Confirmation Result ───────────────────────────
export interface VolumeConfirmationResult {
    currentVolume: number;
    avgVolume: number;
    volumeRatio: number;          // current / avg
    isAboveAverage: boolean;      // > 20% above avg
    isSpike: boolean;             // > 2x average
    isLowVolume: boolean;         // movement without volume → reject
    scoreModifier: number;        // +15, +25, or 0 (and -15 penalty flag)
}

// ─── Quality Score Result ─────────────────────────────────
export interface QualityScoreResult {
    score: number;                // 0-100, signal only proceeds if >= 60
    trendConfirmed: boolean;      // true if trend is directional
    nearSR: boolean;              // true if near any S/R level
    volumeConfirmed: boolean;     // volume > 1.2x average
    patternAtSR: boolean;         // valid candle pattern at S/R
    chochPenalty: number;         // -20 if CHOCH detected
    lowVolumePenalty: number;     // -15 if low volume movement
    manipulationPenalty: number;  // -20 if price > 25% move in 24h
    isRejected: boolean;          // true if score < 60
    rejectionReason: string | null;
    breakdown: {
        trend: number;
        sr: number;
        volume: number;
        structure: number;
        confluence: number;
        penalties: number;
        final: number;
    };
}

// ─── Technical Analysis Full Result ───────────────────────
export interface TechnicalAnalysisFullResult {
    symbol: string;
    timestamp: Date;
    trend: TrendLabel;
    supportLevels: SRLevel[];     // strong (>=60), for TP/SL — backward compatible
    resistanceLevels: SRLevel[];   // strong (>=60), for TP/SL — backward compatible
    allSupportLevels: SRLevel[];  // (>=40) for quality scoring nearSR check
    allResistanceLevels: SRLevel[];// (>=40) for quality scoring nearSR check
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
    structure: MarketStructureResult;
    candlePattern: CandlePatternResult;
    volume: VolumeConfirmationResult;
    qualityScore: QualityScoreResult;
    atrDaily: number | null;      // ATR-14 from Daily indicators (for TP/SL)
    atr4h: number | null;         // ATR-14 from 4H indicators (for entry zones)
}

// ─── Signal Health Result ─────────────────────────────────
export interface SignalHealthResult {
    signalCount48h: number;
    status: 'healthy' | 'caution' | 'starvation';
    message: string;
    reducedConfidenceMode: boolean;
}

// Price distance percentage helper
export function priceDistancePercent(price: number, level: number): number {
    return Math.abs((price - level) / level) * 100;
}

// Check if price is within X% of a level
export function isNearLevel(price: number, level: number, thresholdPercent: number): boolean {
    return priceDistancePercent(price, level) <= thresholdPercent;
}

export async function detectTrend(symbol: string, preFetched4h?: IndicatorRow | null, preFetched1d?: IndicatorRow | null, preFetchedCandles4h?: CandleRow[] | null): Promise<TrendLabel> {
    try {
        // Use pre-fetched data if available
        const indicator4h = preFetched4h || await getLatestIndicator(symbol, '4h');
        if (!indicator4h) {
            return 'SIDEWAYS';
        }
        const ema20 = indicator4h.ema20;
        const ema50 = indicator4h.ema50;

        // Fetch EMA-200 from Daily indicators
        const indicator1d = preFetched1d || await getLatestIndicator(symbol, '1d');
        const ema200 = indicator1d?.ema200 || null;

        // Get current price from latest 4H candle
        const candles = preFetchedCandles4h || await getCandles(symbol, '4h', 1);
        if (!candles || candles.length === 0) {
            return 'SIDEWAYS';
        }
        const price = candles[0].close;

        if (ema200 === null) {
            // Fall back to EMA-20/50 only
            if (ema50 === null || ema20 === null) {
                return 'SIDEWAYS';
            }
            if (price > ema20 && ema20 > ema50) {
                return 'BULLISH';
            } else if (price < ema20 && ema20 < ema50) {
                return 'BEARISH';
            } else {
                return 'SIDEWAYS';
            }
        } else {
            // EMA-200 exists
            if (ema20 === null || ema50 === null) {
                return 'SIDEWAYS';
            }
            if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
                return 'STRONG_BULLISH';
            } else if (price > ema50 && ema20 > ema50) {
                return 'BULLISH';
            } else if (Math.max(ema20, ema50, ema200) - Math.min(ema20, ema50, ema200) <= 0.01 * Math.max(ema20, ema50, ema200)) {
                return 'SIDEWAYS';
            } else if (price < ema50 && ema20 < ema50) {
                return 'BEARISH';
            } else if (price < ema20 && ema20 < ema50 && ema50 < ema200) {
                return 'STRONG_BEARISH';
            } else {
                return 'SIDEWAYS';
            }
        }
    } catch (error) {
        console.error(`[detectTrend] Error for ${symbol}:`, error);
        return 'SIDEWAYS';
    }
}

export async function detectSupportResistance(symbol: string, preFetchedCandles?: CandleRow[] | null): Promise<SRTiers> {
    try {
        const candles = preFetchedCandles || await getCandles(symbol, '4h', 200);
        if (!candles || candles.length < 5) {
            return { strongLevels: [], allLevels: [] };
        }

        const ascCandles = candles.slice().reverse();

        const swingHighs: { price: number; index: number; volume: number; date: Date }[] = [];
        const swingLows: { price: number; index: number; volume: number; date: Date }[] = [];

        for (let i = 1; i < ascCandles.length - 1; i++) {
            const candle = ascCandles[i];
            const prev1 = ascCandles[i - 1];
            const next1 = ascCandles[i + 1];

            if (candle.low < prev1.low && candle.low < next1.low) {
                swingLows.push({ price: candle.low, index: i, volume: candle.volume, date: candle.openTime });
            }
            if (candle.high > prev1.high && candle.high > next1.high) {
                swingHighs.push({ price: candle.high, index: i, volume: candle.volume, date: candle.openTime });
            }
        }

        const clusterLevels = (swings: typeof swingHighs, type: 'support' | 'resistance'): SRLevel[] => {
            if (swings.length === 0) return [];

            swings.sort((a, b) => a.price - b.price);
            const clusters: { prices: number[]; volumes: number[]; dates: Date[]; count: number }[] = [];

            for (const swing of swings) {
                let found = false;
                for (const cluster of clusters) {
                    const avgPrice = cluster.prices.reduce((sum, p) => sum + p, 0) / cluster.prices.length;
                    if (priceDistancePercent(swing.price, avgPrice) <= 1.5) {
                        cluster.prices.push(swing.price);
                        cluster.volumes.push(swing.volume);
                        cluster.dates.push(swing.date);
                        cluster.count++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    clusters.push({ prices: [swing.price], volumes: [swing.volume], dates: [swing.date], count: 1 });
                }
            }

            const overallAvgVolume = ascCandles.reduce((sum, c) => sum + c.volume, 0) / ascCandles.length;

            return clusters.map(cluster => {
                const price = cluster.prices.reduce((sum, p) => sum + p, 0) / cluster.prices.length;
                const touchCount = cluster.count;
                const volumeAtLevel = cluster.volumes.reduce((sum, v) => sum + v, 0) / cluster.volumes.length;
                const lastTouchedAt = cluster.dates.reduce((latest, d) => d > latest ? d : latest, cluster.dates[0]);

                let rejectionStrength = 0;
                let rejectionCount = 0;
                for (const candle of ascCandles) {
                    if (priceDistancePercent(candle.close, price) <= 0.5) {
                        const range = candle.high - candle.low;
                        if (range > 0) {
                            if (type === 'resistance') {
                                const upperWick = candle.high - Math.max(candle.open, candle.close);
                                rejectionStrength += upperWick / range;
                            } else {
                                const lowerWick = Math.min(candle.open, candle.close) - candle.low;
                                rejectionStrength += lowerWick / range;
                            }
                            rejectionCount++;
                        }
                    }
                }
                rejectionStrength = rejectionCount > 0 ? rejectionStrength / rejectionCount : 0;

                const touchScore = Math.min(touchCount / 5, 1) * 100 * 0.3;
                const volumeScore = Math.min(volumeAtLevel / overallAvgVolume, 1.5) / 1.5 * 100 * 0.3;
                const rejectionScore = rejectionStrength * 100 * 0.2;
                const timeframeScore = 100 * 0.1;
                const daysSince = (Date.now() - lastTouchedAt.getTime()) / (1000 * 60 * 60 * 24);
                const recencyScore = Math.max(0, 100 - (daysSince / 30 * 100)) * 0.1;

                const strengthScore = touchScore + volumeScore + rejectionScore + timeframeScore + recencyScore;

                return {
                    price,
                    type,
                    strengthScore: Math.min(strengthScore, 100),
                    touchCount,
                    volumeAtLevel,
                    rejectionStrength,
                    lastTouchedAt,
                };
            });
        };

        const supportLevels = clusterLevels(swingLows, 'support');
        const resistanceLevels = clusterLevels(swingHighs, 'resistance');

        const filterStrong = (levels: SRLevel[]) => levels.filter(l => l.strengthScore >= 60).sort((a, b) => b.strengthScore - a.strengthScore).slice(0, 5);
        const filterAll = (levels: SRLevel[]) => levels.filter(l => l.strengthScore >= 40).sort((a, b) => b.strengthScore - a.strengthScore).slice(0, 10);

        return {
            strongLevels: [...filterStrong(supportLevels), ...filterStrong(resistanceLevels)],
            allLevels: [...filterAll(supportLevels), ...filterAll(resistanceLevels)],
        };
    } catch (error) {
        console.error(`[detectSupportResistance] Error for ${symbol}:`, error);
        return { strongLevels: [], allLevels: [] };
    }
}

export async function analyzeMarketStructure(symbol: string, preFetchedCandles?: CandleRow[] | null): Promise<MarketStructureResult> {
    try {
        const candles = preFetchedCandles || await getCandles(symbol, '4h', 100);
        if (!candles || candles.length < 5) {
            return {
                pattern: 'NONE',
                trend: 'sideways',
                isChocho: false,
                isFailedBos: false,
                lastSwingHigh: null,
                lastSwingLow: null,
            };
        }

        // Reverse to ASC
        const ascCandles = candles.slice().reverse();

        // Detect swings (same as S/R but over 100)
        const swingHighs: { price: number; index: number }[] = [];
        const swingLows: { price: number; index: number }[] = [];

        for (let i = 1; i < ascCandles.length - 1; i++) {
            const candle = ascCandles[i];
            const prev1 = ascCandles[i - 1];
            const next1 = ascCandles[i + 1];

            if (candle.low < prev1.low && candle.low < next1.low) {
                swingLows.push({ price: candle.low, index: i });
            }
            if (candle.high > prev1.high && candle.high > next1.high) {
                swingHighs.push({ price: candle.high, index: i });
            }
        }

        if (swingHighs.length < 2 || swingLows.length < 2) {
            return {
                pattern: 'NONE',
                trend: 'sideways',
                isChocho: false,
                isFailedBos: false,
                lastSwingHigh: swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null,
                lastSwingLow: swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null,
            };
        }

        // Get last 6 swings or all
        const recentSwings: { type: 'high' | 'low'; price: number; index: number }[] = [];
        swingHighs.forEach(h => recentSwings.push({ type: 'high', price: h.price, index: h.index }));
        swingLows.forEach(l => recentSwings.push({ type: 'low', price: l.price, index: l.index }));
        recentSwings.sort((a, b) => a.index - b.index); // by time
        const lastSwings = recentSwings.slice(-6);

        // Separate highs and lows
        const highs = lastSwings.filter(s => s.type === 'high').map(s => s.price);
        const lows = lastSwings.filter(s => s.type === 'low').map(s => s.price);

        // Check patterns with 1-deviation tolerance
        let hhDeviations = 0;
        for (let i = 1; i < highs.length; i++) {
            if (highs[i] < highs[i - 1]) hhDeviations++;
        }
        let hlDeviations = 0;
        for (let i = 1; i < lows.length; i++) {
            if (lows[i] < lows[i - 1]) hlDeviations++;
        }
        const hh_hl = highs.length >= 2 && lows.length >= 2 && hhDeviations <= 1 && hlDeviations <= 1;

        let lhDeviations = 0;
        for (let i = 1; i < highs.length; i++) {
            if (highs[i] > highs[i - 1]) lhDeviations++;
        }
        let llDeviations = 0;
        for (let i = 1; i < lows.length; i++) {
            if (lows[i] > lows[i - 1]) llDeviations++;
        }
        const lh_ll = highs.length >= 2 && lows.length >= 2 && lhDeviations <= 1 && llDeviations <= 1;

        const lastSwingHigh = highs[highs.length - 1] || null;
        const lastSwingLow = lows[lows.length - 1] || null;
        const currentPrice = ascCandles[ascCandles.length - 1].close;

        // Check BOS and CHOCH
        let bos_bullish = false;
        let bos_bearish = false;
        let choch_bullish = false;
        let choch_bearish = false;

        if (lastSwingHigh !== null) {
            if (currentPrice > lastSwingHigh) {
                if (hh_hl) bos_bullish = true;
                else if (lh_ll) choch_bullish = true;
            }
        }
        if (lastSwingLow !== null) {
            if (currentPrice < lastSwingLow) {
                if (lh_ll) bos_bearish = true;
                else if (hh_hl) choch_bearish = true;
            }
        }

        // Failed BOS
        let failed_bos = false;
        if (bos_bullish || bos_bearish) {
            // Check if price returned within 3 candles
            for (let i = Math.max(0, ascCandles.length - 4); i < ascCandles.length; i++) {
                const candle = ascCandles[i];
                if ((bos_bullish && candle.low < lastSwingHigh!) || (bos_bearish && candle.high > lastSwingLow!)) {
                    failed_bos = true;
                    break;
                }
            }
        }

        // Determine pattern by priority
        let pattern: StructurePattern = 'NONE';
        if (failed_bos) {
            pattern = 'FAILED_BOS';
        } else if (choch_bullish) {
            pattern = 'CHOCH_BULLISH';
        } else if (choch_bearish) {
            pattern = 'CHOCH_BEARISH';
        } else if (bos_bullish) {
            pattern = 'BOS_BULLISH';
        } else if (bos_bearish) {
            pattern = 'BOS_BEARISH';
        } else if (hh_hl) {
            pattern = 'HH_HL';
        } else if (lh_ll) {
            pattern = 'LH_LL';
        }

        // Determine trend
        let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
        if (['HH_HL', 'BOS_BULLISH', 'CHOCH_BULLISH'].includes(pattern)) {
            trend = 'bullish';
        } else if (['LH_LL', 'BOS_BEARISH', 'CHOCH_BEARISH'].includes(pattern)) {
            trend = 'bearish';
        }

        return {
            pattern,
            trend,
            isChocho: pattern.startsWith('CHOCH'),
            isFailedBos: pattern === 'FAILED_BOS',
            lastSwingHigh,
            lastSwingLow,
        };
    } catch (error) {
        console.error(`[analyzeMarketStructure] Error for ${symbol}:`, error);
        return {
            pattern: 'NONE',
            trend: 'sideways',
            isChocho: false,
            isFailedBos: false,
            lastSwingHigh: null,
            lastSwingLow: null,
        };
    }
}

export async function detectCandlePattern(
    symbol: string,
    supportLevels: SRLevel[],
    resistanceLevels: SRLevel[],
    preFetchedCandles5?: CandleRow[] | null,
    preFetched4h?: IndicatorRow | null
): Promise<CandlePatternResult> {
    try {
        const candles = preFetchedCandles5 || await getCandles(symbol, '4h', 5);
        if (!candles || candles.length < 1) {
            return {
                pattern: null,
                direction: null,
                volumeConfirmed: false,
                srAligned: false,
                isValid: false,
            };
        }

        // Reverse to ASC
        const ascCandles = candles.slice().reverse();
        const current = ascCandles[ascCandles.length - 1];
        const prev = ascCandles.length > 1 ? ascCandles[ascCandles.length - 2] : null;
        const prev2 = ascCandles.length > 2 ? ascCandles[ascCandles.length - 3] : null;

        // Get volumeAvg20
        const indicator = preFetched4h || await getLatestIndicator(symbol, '4h');
        const volumeAvg20 = indicator?.volumeAvg20 || 0;
        const volumeConfirmed = current.volume > volumeAvg20;

        // Pattern detection
        let pattern: RecognizedPattern | null = null;
        let direction: 'bullish' | 'bearish' | null = null;

        const body = Math.abs(current.close - current.open);
        const range = current.high - current.low;
        const upperWick = current.high - Math.max(current.open, current.close);
        const lowerWick = Math.min(current.open, current.close) - current.low;

        if (body < 0.3 * range) {
            if (lowerWick >= 2 * body) {
                pattern = 'hammer';
                direction = 'bullish';
            } else if (upperWick >= 2 * body) {
                pattern = 'shooting_star';
                direction = 'bearish';
            }
        }

        else if (prev && body > Math.abs(prev.close - prev.open) &&
            current.close > prev.open && current.open < prev.close &&
            prev.close < prev.open) {
            pattern = 'bullish_engulfing';
            direction = 'bullish';
        } else if (prev && body > Math.abs(prev.close - prev.open) &&
            current.close < prev.open && current.open > prev.close &&
            prev.close > prev.open) {
            pattern = 'bearish_engulfing';
            direction = 'bearish';
        }

        else if (prev && prev2) {
            const firstBody = Math.abs(prev2.close - prev2.open);
            const thirdBody = body;
            const middleBody = Math.abs(prev.close - prev.open);
            const isSmallMiddle = middleBody < 0.3 * (prev.high - prev.low);

            if (prev2.close < prev2.open && prev.close > prev.open && current.close > current.open &&
                thirdBody >= 0.5 * firstBody && isSmallMiddle) {
                pattern = 'morning_star';
                direction = 'bullish';
            } else if (prev2.close > prev2.open && prev.close < prev.open && current.close < current.open &&
                thirdBody >= 0.5 * firstBody && isSmallMiddle) {
                pattern = 'evening_star';
                direction = 'bearish';
            }
        }

        // SR alignment
        let srAligned = false;
        if (direction === 'bullish' && supportLevels.some(level => isNearLevel(current.close, level.price, 2))) {
            srAligned = true;
        } else if (direction === 'bearish' && resistanceLevels.some(level => isNearLevel(current.close, level.price, 2))) {
            srAligned = true;
        }

        const isValid = pattern !== null && (volumeConfirmed || srAligned);

        return {
            pattern,
            direction,
            volumeConfirmed,
            srAligned,
            isValid,
        };
    } catch (error) {
        console.error(`[detectCandlePattern] Error for ${symbol}:`, error);
        return {
            pattern: null,
            direction: null,
            volumeConfirmed: false,
            srAligned: false,
            isValid: false,
        };
    }
}

export async function analyzeVolumeConfirmation(symbol: string, preFetchedCandles1?: CandleRow[] | null, preFetched4h?: IndicatorRow | null): Promise<VolumeConfirmationResult> {
    try {
        const candles = preFetchedCandles1 || await getCandles(symbol, '4h', 1);
        if (!candles || candles.length === 0) {
            return {
                currentVolume: 0,
                avgVolume: 0,
                volumeRatio: 0,
                isAboveAverage: false,
                isSpike: false,
                isLowVolume: false,
                scoreModifier: 0,
            };
        }

        const currentVolume = candles[0].volume;
        const indicator = preFetched4h || await getLatestIndicator(symbol, '4h');
        const avgVolume = indicator?.volumeAvg20 || 0;

        if (avgVolume === 0) {
            return {
                currentVolume,
                avgVolume: 0,
                volumeRatio: 0,
                isAboveAverage: false,
                isSpike: false,
                isLowVolume: true,
                scoreModifier: 0,
            };
        }

        const volumeRatio = currentVolume / avgVolume;
        const isAboveAverage = volumeRatio > 1.2;
        const isSpike = volumeRatio > 2.0;
        const isLowVolume = volumeRatio < 0.5;
        const scoreModifier = isSpike ? 25 : isAboveAverage ? 15 : 0;

        return {
            currentVolume,
            avgVolume,
            volumeRatio,
            isAboveAverage,
            isSpike,
            isLowVolume,
            scoreModifier,
        };
    } catch (error) {
        console.error(`[analyzeVolumeConfirmation] Error for ${symbol}:`, error);
        return {
            currentVolume: 0,
            avgVolume: 0,
            volumeRatio: 0,
            isAboveAverage: false,
            isSpike: false,
            isLowVolume: false,
            scoreModifier: 0,
        };
    }
}

export function calculateQualityScore(params: {
    trend: TrendLabel;
    currentPrice: number;
    allSupportLevels: SRLevel[];
    allResistanceLevels: SRLevel[];
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
    volumeConfirmed: boolean;
    volumeSpike: boolean;
    volumeRatio: number;
    patternAtSR: boolean;
    isChocho: boolean;
    isFailedBos: boolean;
    priceChange24h: number | null;
    structurePattern: StructurePattern;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
}): QualityScoreResult {
    const { trend, currentPrice, volumeRatio, structurePattern, ema20, ema50, ema200 } = params;

    // ── Trend Strength: 0–20 (gradient based on EMA alignment) ──
    let trendStrength = 0;
    const directionalTrends = new Set<TrendLabel>(['BULLISH', 'STRONG_BULLISH', 'BEARISH', 'STRONG_BEARISH']);
    if (directionalTrends.has(trend)) {
        trendStrength += 10;
        if (trend === 'STRONG_BULLISH' || trend === 'STRONG_BEARISH') {
            trendStrength += 5;
        }
    }
    if (ema20 !== null && ema50 !== null && ema200 !== null) {
        const maxEma = Math.max(ema20, ema50, ema200);
        if (maxEma > 0) {
            const spread = (maxEma - Math.min(ema20, ema50, ema200)) / maxEma;
            trendStrength += Math.min(5, Math.round(spread / 0.02));
        }
    } else if (ema20 !== null && ema50 !== null) {
        const maxEma = Math.max(ema20, ema50);
        if (maxEma > 0) {
            const spread = Math.abs(ema20 - ema50) / maxEma;
            trendStrength += Math.min(5, Math.round(spread / 0.02));
        }
    }
    trendStrength = Math.min(20, trendStrength);

    // ── S/R Proximity: 0–20 (distance-based, closer = higher) ──
    let srScore = 0;
    const allLevels = [...params.allSupportLevels, ...params.allResistanceLevels];
    let closestDistance = Infinity;
    for (const level of allLevels) {
        const dist = priceDistancePercent(currentPrice, level.price);
        if (dist < closestDistance) closestDistance = dist;
    }
    if (closestDistance <= 0.5) srScore = 20;
    else if (closestDistance <= 1.0) srScore = 16;
    else if (closestDistance <= 1.5) srScore = 12;
    else if (closestDistance <= 2.0) srScore = 8;
    else if (closestDistance <= 3.0) srScore = 4;
    else srScore = 0;

    // ── Volume Confirmation: 0–20 (ratio-based continuous) ──
    let volumeScore = 0;
    if (volumeRatio >= 2.0) volumeScore = 20;
    else if (volumeRatio >= 1.5) volumeScore = 16;
    else if (volumeRatio >= 1.2) volumeScore = 12;
    else if (volumeRatio >= 0.8) volumeScore = 6;
    else if (volumeRatio >= 0.5) volumeScore = 3;
    else volumeScore = 0;

    // ── Structure Alignment: 0–20 ──
    let structureScore = 0;
    switch (structurePattern) {
        case 'BOS_BULLISH': case 'BOS_BEARISH': structureScore = 18; break;
        case 'HH_HL': case 'LH_LL': structureScore = 14; break;
        case 'CHOCH_BULLISH': case 'CHOCH_BEARISH': structureScore = 6; break;
        case 'NONE': structureScore = 4; break;
        case 'FAILED_BOS': structureScore = 0; break;
        default: structureScore = 2;
    }

    // ── Pattern + Confluence: 0–20 ──
    let confluenceScore = 0;
    if (params.patternAtSR) confluenceScore += 10;
    if (params.volumeSpike) confluenceScore += 5;
    if (directionalTrends.has(trend) && params.patternAtSR) confluenceScore += 5;
    confluenceScore = Math.min(20, confluenceScore);

    // ── Penalties (additive) ──
    const chochPenalty = params.isChocho ? -20 : 0;
    const lowVolumePenalty = volumeRatio < 0.5 ? -15 : 0;
    const manipulationPenalty = (params.priceChange24h !== null && Math.abs(params.priceChange24h) > 25) ? -20 : 0;
    const penalties = chochPenalty + lowVolumePenalty + manipulationPenalty;

    const baseScore = trendStrength + srScore + volumeScore + structureScore + confluenceScore;
    const finalScore = Math.max(0, Math.min(100, baseScore + penalties));

    const isRejected = finalScore < 60;
    let rejectionReason: string | null = null;
    if (params.isFailedBos) {
        rejectionReason = "Failed Break of Structure — no signal";
    } else if (finalScore < 60) {
        rejectionReason = `Quality score ${finalScore} below threshold 60 (trend=${trendStrength} sr=${srScore} vol=${volumeScore} struct=${structureScore} conf=${confluenceScore} pen=${penalties})`;
    }

    return {
        score: finalScore,
        trendConfirmed: directionalTrends.has(trend),
        nearSR: srScore > 0,
        volumeConfirmed: params.volumeConfirmed,
        patternAtSR: params.patternAtSR,
        chochPenalty,
        lowVolumePenalty,
        manipulationPenalty,
        isRejected,
        rejectionReason,
        breakdown: { trend: trendStrength, sr: srScore, volume: volumeScore, structure: structureScore, confluence: confluenceScore, penalties, final: finalScore },
    };
}

export async function analyzeTechnicals(symbol: string): Promise<TechnicalAnalysisFullResult | null> {
    if (!isTrackedCoin(symbol)) {
        return null;
    }

    try {
        // 2. Fetch data once to avoid redundant queries
        const candles200 = await getCandles(symbol, '4h', 200);
        if (!candles200 || candles200.length < 5) return null;
        const indicator4h = await getLatestIndicator(symbol, '4h');
        const indicator1d = await getLatestIndicator(symbol, '1d');

        const currentPrice = candles200[0].close; // latest candle
        const atrDaily = indicator1d?.atr14 || null;
        const atr4h = indicator4h?.atr14 || null;

        // 4. Run sub-engines in parallel with pre-fetched data
        const [trend, srResult, structure, volumeResult] = await Promise.all([
            detectTrend(symbol, indicator4h, indicator1d, candles200.slice(0, 1)),
            detectSupportResistance(symbol, candles200),
            analyzeMarketStructure(symbol, candles200.slice(0, 100)),
            analyzeVolumeConfirmation(symbol, candles200.slice(0, 1), indicator4h),
        ]);

        const { strongLevels, allLevels } = srResult;

        const supportLevels = strongLevels.filter(l => l.type === 'support');
        const resistanceLevels = strongLevels.filter(l => l.type === 'resistance');
        const allSupportLevels = allLevels.filter(l => l.type === 'support');
        const allResistanceLevels = allLevels.filter(l => l.type === 'resistance');

        const patternResult = await detectCandlePattern(symbol, supportLevels, resistanceLevels, candles200.slice(0, 5), indicator4h);

        const nearestSupport = supportLevels
            .filter(l => l.price < currentPrice)
            .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0] ?? null;
        const nearestResistance = resistanceLevels
            .filter(l => l.price > currentPrice)
            .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0] ?? null;

        const qualityScore = calculateQualityScore({
            trend,
            currentPrice,
            allSupportLevels,
            allResistanceLevels,
            nearestSupport,
            nearestResistance,
            volumeConfirmed: volumeResult.isAboveAverage,
            volumeSpike: volumeResult.isSpike,
            volumeRatio: volumeResult.volumeRatio,
            patternAtSR: patternResult.isValid,
            isChocho: structure.isChocho,
            isFailedBos: structure.isFailedBos,
            priceChange24h: null,
            structurePattern: structure.pattern,
            ema20: indicator4h?.ema20 ?? null,
            ema50: indicator4h?.ema50 ?? null,
            ema200: indicator1d?.ema200 ?? null,
        });

        return {
            symbol,
            timestamp: new Date(),
            trend,
            supportLevels,
            resistanceLevels,
            allSupportLevels,
            allResistanceLevels,
            nearestSupport,
            nearestResistance,
            structure,
            candlePattern: patternResult,
            volume: volumeResult,
            qualityScore,
            atrDaily,
            atr4h,
        };
    } catch (error) {
        console.error(`[analyzeTechnicals] Failed for ${symbol}:`, error);
        return null;
    }
}

export async function checkSignalHealth(): Promise<SignalHealthResult> {
    try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const result = await db.select({ count: count() }).from(radarSignals).where(gt(radarSignals.createdAt, cutoff));
        const signalCount48h = Number(result[0]?.count ?? 0n);

        let status: 'healthy' | 'caution' | 'starvation';
        let message: string;
        let reducedConfidenceMode: boolean;

        if (signalCount48h === 0) {
            status = 'starvation';
            message = '[SIGNAL-HEALTH] WARNING: Zero signals in 48h. Check market conditions and filter gates.';
            reducedConfidenceMode = true;
        } else if (signalCount48h < 3) {
            status = 'caution';
            message = `[SIGNAL-HEALTH] CAUTION: Low signal rate (${signalCount48h} in 48h).`;
            reducedConfidenceMode = false;
        } else {
            status = 'healthy';
            message = `[SIGNAL-HEALTH] OK: ${signalCount48h} signals in 48h.`;
            reducedConfidenceMode = false;
        }

        return {
            signalCount48h,
            status,
            message,
            reducedConfidenceMode,
        };
    } catch (error) {
        console.error(`[checkSignalHealth] Error:`, error);
        return {
            signalCount48h: 0,
            status: 'starvation',
            message: '[SIGNAL-HEALTH] ERROR: Unable to check signal health.',
            reducedConfidenceMode: true,
        };
    }
}