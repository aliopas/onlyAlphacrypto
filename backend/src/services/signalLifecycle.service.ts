import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export type SignalState = 'NEW' | 'WAITING_CONFIRMATION' | 'ACTIVE' | 'PARTIAL_TP' | 'PARTIAL_TP2' | 'BREAKEVEN' | 'CLOSED';
export type CloseReason = 'TP_HIT' | 'SL_HIT' | 'EXPIRED' | 'THESIS_INVALIDATED' | 'ALL_TP_HIT';

export interface LifecycleActionEntry {
    action: string;
    timestamp: string;
    price?: number;
    details?: Record<string, unknown>;
}

interface SignalPerformanceRow {
    id: number;
    signalId: number;
    coinSymbol: string;
    signalState: string | null;
    entryPrice: number;
    takeProfitPrice: number | null;
    tp2Price: number | null;
    tp3Price: number | null;
    stopLossPrice: number | null;
    createdAt: Date;
    partialTpHitAt: Date | null;
    tp2HitAt: Date | null;
    breakevenMovedAt: Date | null;
    lifecycleActionsLog: LifecycleActionEntry[] | null;
}

const SIGNAL_STATES = ['NEW', 'WAITING_CONFIRMATION', 'ACTIVE', 'PARTIAL_TP', 'PARTIAL_TP2', 'BREAKEVEN', 'CLOSED'] as const;

const PARTIAL_TP_DISTANCE_RATIO = 0.5;
const SL_BUFFER_ATR_FACTOR = 0.3;
const ATR_TRAILING_FACTOR = 1.5;
const TREND_SLOPE_THRESHOLD = 0.001;
const CONFLUENCE_HIGH_THRESHOLD = 70;
const CONFLUENCE_MID_THRESHOLD = 50;
const CONFLUENCE_LOW_THRESHOLD = 40;
const EXPIRY_HOURS = 72;
const EXPECTED_HOURS_LONG = 24;
const EXPECTED_HOURS_SHORT = 12;
const TIME_THRESHOLD_MULTIPLIER = 2.0;
const MOMENTUM_ATR_FACTOR = 0.5;
const VOLUME_COLLAPSE_THRESHOLD = 0.5;

async function appendLifecycleAction(signalId: number, action: LifecycleActionEntry): Promise<void> {
    if (!env.LIFECYCLE_V2_ENABLED) return;
    try {
        const [existing] = await db
            .select({ log: signalPerformance.lifecycleActionsLog })
            .from(signalPerformance)
            .where(eq(signalPerformance.id, signalId));
        const currentLog: LifecycleActionEntry[] = Array.isArray(existing?.log) ? existing.log : [];
        const updatedLog = [...currentLog, action];
        await db
            .update(signalPerformance)
            .set({ lifecycleActionsLog: updatedLog })
            .where(eq(signalPerformance.id, signalId));
    } catch (err) {
        logger.warn(`[SignalLifecycle] Failed to append lifecycle action for signalId=${signalId}:`, err);
    }
}

export async function updateSignalState(signalId: number, newState: SignalState): Promise<void> {
    try {
        await db
            .update(signalPerformance)
            .set({ signalState: newState })
            .where(eq(signalPerformance.id, signalId));
        logger.info(`[SignalLifecycle] signalId=${signalId} state updated to ${newState}`);
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to update state for signalId=${signalId}:`, err);
        throw err;
    }
}

export async function checkPartialTp(
    signalId: number,
    currentPrice: number,
    entryPrice: number,
    tp: number
): Promise<boolean> {
    if (!tp || tp <= 0 || entryPrice <= 0) return false;
    const isLong = tp > entryPrice;
    const distanceToTp = Math.abs(tp - entryPrice);
    const currentDistance = isLong
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;
    if (currentDistance <= 0) return false;
    const fiftyPercentDistance = distanceToTp * PARTIAL_TP_DISTANCE_RATIO;
    return currentDistance >= fiftyPercentDistance;
}

export async function moveStopToBreakeven(signalId: number): Promise<void> {
    try {
        const [signal] = await db
            .select()
            .from(signalPerformance)
            .where(eq(signalPerformance.id, signalId));

        if (!signal) return;

        await db
            .update(signalPerformance)
            .set({
                stopLossPrice: signal.entryPrice,
                breakevenMovedAt: new Date(),
                signalState: 'BREAKEVEN',
            })
            .where(eq(signalPerformance.id, signalId));

        logger.info(`[SignalLifecycle] signalId=${signalId} SL moved to breakeven at ${signal.entryPrice}`);
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to move SL to breakeven for signalId=${signalId}:`, err);
        throw err;
    }
}

export async function moveStopToLevel(signalId: number, newStopPrice: number): Promise<void> {
    try {
        await db
            .update(signalPerformance)
            .set({ stopLossPrice: newStopPrice })
            .where(eq(signalPerformance.id, signalId));

        logger.info(`[SignalLifecycle] signalId=${signalId} SL moved to ${newStopPrice}`);
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to move SL for signalId=${signalId}:`, err);
        throw err;
    }
}

export async function autoCloseSignal(signalId: number, reason: CloseReason): Promise<void> {
    try {
        await db
            .update(signalPerformance)
            .set({
                signalState: 'CLOSED',
                closeReason: reason,
                isActive: false,
                closedAt: new Date(),
            })
            .where(eq(signalPerformance.id, signalId));
        logger.info(`[SignalLifecycle] signalId=${signalId} auto-closed. reason=${reason}`);
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to auto-close signalId=${signalId}:`, err);
        throw err;
    }
}

export async function getSignalsByState(state: SignalState): Promise<SignalPerformanceRow[]> {
    try {
        const rows = await db
            .select()
            .from(signalPerformance)
            .where(eq(signalPerformance.signalState, state));
        return rows as SignalPerformanceRow[];
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to get signals by state=${state}:`, err);
        return [];
    }
}

export async function getSignalsByStates(states: SignalState[]): Promise<SignalPerformanceRow[]> {
    try {
        const rows = await db
            .select()
            .from(signalPerformance)
            .where(inArray(signalPerformance.signalState, states));
        return rows as SignalPerformanceRow[];
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to get signals by states=${states.join(',')}:`, err);
        return [];
    }
}

export async function processActiveSignals(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED) {
        return;
    }

    try {
        const activeSignals = await getSignalsByState('ACTIVE');
        for (const signal of activeSignals) {
            try {
                const currentPrice = await getCurrentPrice(signal.coinSymbol);
                if (!currentPrice || !signal.takeProfitPrice || !signal.entryPrice || !signal.stopLossPrice) continue;

                const isLong = signal.takeProfitPrice > signal.entryPrice;

                const tpHit = isLong
                    ? currentPrice >= signal.takeProfitPrice
                    : currentPrice <= signal.takeProfitPrice;
                const slHit = isLong
                    ? currentPrice <= signal.stopLossPrice
                    : currentPrice >= signal.stopLossPrice;

                if (tpHit) {
                    if (env.LIFECYCLE_V2_ENABLED && signal.tp2Price != null) {
                        await db
                            .update(signalPerformance)
                            .set({
                                signalState: 'PARTIAL_TP',
                                partialTpHitAt: new Date(),
                            })
                            .where(eq(signalPerformance.id, signal.id));

                        await moveStopToBreakeven(signal.id);
                        await appendLifecycleAction(signal.id, {
                            action: 'TP1_HIT',
                            timestamp: new Date().toISOString(),
                            price: currentPrice,
                        });
                        logger.info(`[SignalLifecycle] signalId=${signal.id} TP1 hit, state=PARTIAL_TP, SL moved to breakeven`);
                    } else {
                        await autoCloseSignal(signal.id, 'TP_HIT');
                        if (env.LIFECYCLE_V2_ENABLED) {
                            await appendLifecycleAction(signal.id, {
                                action: 'TP_HIT',
                                timestamp: new Date().toISOString(),
                                price: currentPrice,
                            });
                        }
                    }
                    continue;
                }
                if (slHit) {
                    await autoCloseSignal(signal.id, 'SL_HIT');
                    if (env.LIFECYCLE_V2_ENABLED) {
                        await appendLifecycleAction(signal.id, {
                            action: 'SL_HIT',
                            timestamp: new Date().toISOString(),
                            price: currentPrice,
                        });
                    }
                    continue;
                }

                const isPartialTp = await checkPartialTp(
                    signal.id,
                    currentPrice,
                    signal.entryPrice,
                    signal.takeProfitPrice
                );

                if (isPartialTp) {
                    await updateSignalState(signal.id, 'PARTIAL_TP');
                    await moveStopToBreakeven(signal.id);
                }
            } catch (err) {
                logger.warn(`[SignalLifecycle] Error processing signalId=${signal.id}:`, err);
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in processActiveSignals:', err);
    }
}

export async function processPartialTpSignals(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED || !env.LIFECYCLE_V2_ENABLED) {
        return;
    }

    try {
        const partialTpSignals = await getSignalsByState('PARTIAL_TP');
        for (const signal of partialTpSignals) {
            try {
                const currentPrice = await getCurrentPrice(signal.coinSymbol);
                if (!currentPrice || signal.tp2Price == null) continue;

                const isLong = signal.tp2Price > signal.entryPrice;
                const tp2Hit = isLong
                    ? currentPrice >= signal.tp2Price
                    : currentPrice <= signal.tp2Price;

                if (tp2Hit) {
                    await db
                        .update(signalPerformance)
                        .set({
                            signalState: 'PARTIAL_TP2',
                            tp2HitAt: new Date(),
                            stopLossPrice: signal.takeProfitPrice,
                        })
                        .where(eq(signalPerformance.id, signal.id));

                    await appendLifecycleAction(signal.id, {
                        action: 'TP2_HIT',
                        timestamp: new Date().toISOString(),
                        price: currentPrice,
                        details: { newStopPrice: signal.takeProfitPrice },
                    });
                    logger.info(`[SignalLifecycle] signalId=${signal.id} TP2 hit, state=PARTIAL_TP2, SL moved to TP1=${signal.takeProfitPrice}`);
                }
            } catch (err) {
                logger.warn(`[SignalLifecycle] Error processing PARTIAL_TP signalId=${signal.id}:`, err);
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in processPartialTpSignals:', err);
    }
}

export async function processPartialTp2Signals(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED || !env.LIFECYCLE_V2_ENABLED) {
        return;
    }

    try {
        const partialTp2Signals = await getSignalsByState('PARTIAL_TP2');
        for (const signal of partialTp2Signals) {
            try {
                const currentPrice = await getCurrentPrice(signal.coinSymbol);
                if (!currentPrice || signal.tp3Price == null) continue;

                const isLong = (signal.tp3Price ?? signal.tp2Price ?? signal.takeProfitPrice ?? 0) > signal.entryPrice;

                const slHit = signal.stopLossPrice != null && (
                    isLong ? currentPrice <= signal.stopLossPrice : currentPrice >= signal.stopLossPrice
                );
                if (slHit) {
                    await autoCloseSignal(signal.id, 'SL_HIT');
                    await appendLifecycleAction(signal.id, {
                        action: 'SL_HIT',
                        timestamp: new Date().toISOString(),
                        price: currentPrice,
                    });
                    continue;
                }

                const tp3Hit = isLong
                    ? currentPrice >= signal.tp3Price
                    : currentPrice <= signal.tp3Price;

                if (tp3Hit) {
                    await db
                        .update(signalPerformance)
                        .set({
                            signalState: 'CLOSED',
                            closeReason: 'ALL_TP_HIT',
                            isActive: false,
                            closedAt: new Date(),
                        })
                        .where(eq(signalPerformance.id, signal.id));

                    await appendLifecycleAction(signal.id, {
                        action: 'TP3_HIT_ALL_TP_COMPLETE',
                        timestamp: new Date().toISOString(),
                        price: currentPrice,
                    });
                    logger.info(`[SignalLifecycle] signalId=${signal.id} All TP hit, closed with ALL_TP_HIT`);
                }
            } catch (err) {
                logger.warn(`[SignalLifecycle] Error processing PARTIAL_TP2 signalId=${signal.id}:`, err);
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in processPartialTp2Signals:', err);
    }
}

export async function processDynamicSL(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED || !env.LIFECYCLE_V2_ENABLED) {
        return;
    }

    try {
        const eligibleStates: SignalState[] = ['ACTIVE', 'PARTIAL_TP', 'PARTIAL_TP2', 'BREAKEVEN'];
        const signals = await getSignalsByStates(eligibleStates);

        for (const signal of signals) {
            try {
                const structureData = await getStructureData(signal.coinSymbol);
                if (!structureData) continue;

                const currentPrice = await getCurrentPrice(signal.coinSymbol);
                if (!currentPrice || !signal.stopLossPrice) continue;

                const isLong = (signal.tp2Price ?? signal.takeProfitPrice ?? 0) > signal.entryPrice;

                let confluenceMultiplier = 1.0;
                if (env.MTF_CONTEXT_ENABLED) {
                    const mtfContext = await getMtfContext(signal.coinSymbol);
                    if (mtfContext?.confluence) {
                        const score = mtfContext.confluence.confluenceScore;
                        if (score > CONFLUENCE_HIGH_THRESHOLD) confluenceMultiplier = 1.3;
                        else if (score > CONFLUENCE_MID_THRESHOLD) confluenceMultiplier = 1.15;
                        else if (score < CONFLUENCE_LOW_THRESHOLD) confluenceMultiplier = 0.85;
                    }
                }

                const slTrailingResult = evaluateSLTrailing(signal, currentPrice, structureData, confluenceMultiplier);

                if (slTrailingResult.shouldTrail) {
                    const newStop = slTrailingResult.newStopPrice;
                    await moveStopToLevel(signal.id, newStop);
                    await appendLifecycleAction(signal.id, {
                        action: 'SL_TRAILED',
                        timestamp: new Date().toISOString(),
                        price: currentPrice,
                        details: {
                            previousStop: signal.stopLossPrice,
                            newStop: newStop,
                            reason: slTrailingResult.reason,
                        },
                    });
                    logger.info(`[SignalLifecycle] signalId=${signal.id} SL trailed to ${newStop}, reason=${slTrailingResult.reason}`);
                }
            } catch (err) {
                logger.warn(`[SignalLifecycle] Error processing dynamic SL for signalId=${signal.id}:`, err);
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in processDynamicSL:', err);
    }
}

interface StructureData {
    lastSwingHigh: number | null;
    lastSwingLow: number | null;
    trendDirection: 'bullish' | 'bearish' | 'neutral';
    atr14: number | null;
    volumeAvg20: number | null;
    recentVolume: number | null;
}

async function getStructureData(symbol: string): Promise<StructureData | null> {
    try {
        const candles = await getCandlesForStructure(symbol, '4h', 50);
        if (!candles || candles.length < 10) return null;

        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);

        const lastSwingHigh = findLastSwingHigh(highs);
        const lastSwingLow = findLastSwingLow(lows);

        const recentCloses = closes.slice(-20);
        let trendDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (recentCloses.length >= 2) {
            const slope = (recentCloses[recentCloses.length - 1] - recentCloses[0]) / recentCloses.length;
            if (slope > TREND_SLOPE_THRESHOLD) trendDirection = 'bullish';
            else if (slope < -TREND_SLOPE_THRESHOLD) trendDirection = 'bearish';
        }

        const atr14 = calculateATR(candles, 14);
        const volumeAvg20 = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : null;

        return {
            lastSwingHigh,
            lastSwingLow,
            trendDirection,
            atr14,
            volumeAvg20,
            recentVolume,
        };
    } catch (err) {
        logger.warn(`[SignalLifecycle] Failed to get structure data for ${symbol}:`, err);
        return null;
    }
}

interface CandleData { high: number; low: number; close: number; volume: number; }

async function getCandlesForStructure(symbol: string, timeframe: string, limit: number): Promise<CandleData[] | null> {
    try {
        const { getCandles } = await import('./ohlcvSnapshot.service');
        const candles = await getCandles(symbol, timeframe, limit);
        return candles?.map(c => ({ high: c.high, low: c.low, close: c.close, volume: c.volume })) ?? null;
    } catch {
        return null;
    }
}

function findLastSwingHigh(highs: number[]): number | null {
    if (highs.length < 3) return null;
    for (let i = highs.length - 2; i >= 1; i--) {
        if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
            return highs[i];
        }
    }
    return null;
}

function findLastSwingLow(lows: number[]): number | null {
    if (lows.length < 3) return null;
    for (let i = lows.length - 2; i >= 1; i--) {
        if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
            return lows[i];
        }
    }
    return null;
}

function calculateATR(candles: CandleData[], period: number): number | null {
    if (candles.length < period + 1) return null;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        );
        trs.push(tr);
    }
    if (trs.length < period) return null;
    const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
}

interface SLTrailingResult {
    shouldTrail: boolean;
    newStopPrice: number;
    reason: string;
}

function evaluateSLTrailing(signal: SignalPerformanceRow, currentPrice: number, structure: StructureData, confluenceMultiplier: number = 1.0): SLTrailingResult {
    const isLong = (signal.tp2Price ?? signal.takeProfitPrice ?? 0) > signal.entryPrice;
    const atr = structure.atr14 ?? 0;
    const currentStop = signal.stopLossPrice ?? 0;

    if (isLong) {
        const higherSwingLow = structure.lastSwingLow;
        if (higherSwingLow != null && higherSwingLow > currentStop && higherSwingLow < currentPrice) {
            const buffer = atr * SL_BUFFER_ATR_FACTOR * (2 - confluenceMultiplier);
            const safeStop = higherSwingLow - buffer;
            if (safeStop > currentStop) {
                return { shouldTrail: true, newStopPrice: safeStop, reason: 'STRUCTURE_HIGHER_SWING_LOW' };
            }
        }

        if (structure.trendDirection === 'bullish' && atr > 0) {
            const atrFactor = ATR_TRAILING_FACTOR / confluenceMultiplier;
            const trailingStop = currentPrice - (atr * atrFactor);
            if (trailingStop > currentStop) {
                return { shouldTrail: true, newStopPrice: trailingStop, reason: 'BULLISH_TREND_TRAILING' };
            }
        }
    } else {
        const lowerSwingHigh = structure.lastSwingHigh;
        if (lowerSwingHigh != null && lowerSwingHigh < currentStop && lowerSwingHigh > currentPrice) {
            const buffer = atr * SL_BUFFER_ATR_FACTOR * (2 - confluenceMultiplier);
            const safeStop = lowerSwingHigh + buffer;
            if (safeStop < currentStop) {
                return { shouldTrail: true, newStopPrice: safeStop, reason: 'STRUCTURE_LOWER_SWING_HIGH' };
            }
        }

        if (structure.trendDirection === 'bearish' && atr > 0) {
            const atrFactor = ATR_TRAILING_FACTOR / confluenceMultiplier;
            const trailingStop = currentPrice + (atr * atrFactor);
            if (trailingStop < currentStop) {
                return { shouldTrail: true, newStopPrice: trailingStop, reason: 'BEARISH_TREND_TRAILING' };
            }
        }
    }

    return { shouldTrail: false, newStopPrice: currentStop, reason: 'NO_SIGNAL' };
}

async function getMtfContext(symbol: string): Promise<import('./mtfContext.service').MtfContext | null> {
    try {
        const { buildMtfContext } = await import('./mtfContext.service');
        return await buildMtfContext(symbol);
    } catch {
        return null;
    }
}

export async function processThesisValidation(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED || !env.LIFECYCLE_V2_ENABLED) {
        return;
    }

    try {
        const eligibleStates: SignalState[] = ['ACTIVE', 'PARTIAL_TP'];
        const signals = await getSignalsByStates(eligibleStates);

        for (const signal of signals) {
            try {
                const structureData = await getStructureData(signal.coinSymbol);
                if (!structureData) continue;

                const currentPrice = await getCurrentPrice(signal.coinSymbol);
                if (!currentPrice) continue;

                const isLong = (signal.tp2Price ?? signal.takeProfitPrice ?? 0) > signal.entryPrice;

                let thesisSensitivityMultiplier = 1.0;
                if (env.MTF_CONTEXT_ENABLED) {
                    const mtfContext = await getMtfContext(signal.coinSymbol);
                    if (mtfContext?.confluence) {
                        const alignment = mtfContext.confluence.trendAlignment;
                        if (alignment === 'conflicting') thesisSensitivityMultiplier = 0.5;
                        else if (alignment === 'mixed') thesisSensitivityMultiplier = 0.75;
                        else thesisSensitivityMultiplier = 1.0;
                    }
                }

                const invalidationResult = evaluateThesisInvalidation(signal, currentPrice, structureData, thesisSensitivityMultiplier);

                if (invalidationResult.isInvalidated) {
                    await autoCloseSignal(signal.id, 'THESIS_INVALIDATED');
                    await appendLifecycleAction(signal.id, {
                        action: 'THESIS_INVALIDATED',
                        timestamp: new Date().toISOString(),
                        price: currentPrice,
                        details: { reason: invalidationResult.reason },
                    });
                    logger.info(`[SignalLifecycle] signalId=${signal.id} thesis invalidated: ${invalidationResult.reason}`);
                }
            } catch (err) {
                logger.warn(`[SignalLifecycle] Error processing thesis validation for signalId=${signal.id}:`, err);
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in processThesisValidation:', err);
    }
}

interface ThesisInvalidationResult {
    isInvalidated: boolean;
    reason: string | null;
}

function evaluateThesisInvalidation(signal: SignalPerformanceRow, currentPrice: number, structure: StructureData, sensitivityMultiplier: number = 1.0): ThesisInvalidationResult {
    const isLong = (signal.tp2Price ?? signal.takeProfitPrice ?? 0) > signal.entryPrice;
    const atr = structure.atr14 ?? 0;

    const structureThreshold = 1.0 * sensitivityMultiplier;
    const timeThresholdMultiplier = TIME_THRESHOLD_MULTIPLIER * sensitivityMultiplier;

    if (isLong) {
        if (structure.lastSwingLow != null && structure.lastSwingLow < signal.entryPrice) {
            if (currentPrice < structure.lastSwingLow - atr * structureThreshold) {
                return { isInvalidated: true, reason: 'STRUCTURE_BREAK_BEARISH' };
            }
        }

        if (structure.volumeAvg20 != null && structure.volumeAvg20 > 0 && structure.recentVolume != null) {
            const volumeRatio = structure.recentVolume / structure.volumeAvg20;
            if (volumeRatio < VOLUME_COLLAPSE_THRESHOLD) {
                return { isInvalidated: true, reason: 'VOLUME_COLLAPSE' };
            }
        }
    } else {
        if (structure.lastSwingHigh != null && structure.lastSwingHigh > signal.entryPrice) {
            if (currentPrice > structure.lastSwingHigh + atr * structureThreshold) {
                return { isInvalidated: true, reason: 'STRUCTURE_BREAK_BULLISH' };
            }
        }

        if (structure.volumeAvg20 != null && structure.volumeAvg20 > 0 && structure.recentVolume != null) {
            const volumeRatio = structure.recentVolume / structure.volumeAvg20;
            if (volumeRatio < VOLUME_COLLAPSE_THRESHOLD) {
                return { isInvalidated: true, reason: 'VOLUME_COLLAPSE' };
            }
        }
    }

    const signalAgeHours = (Date.now() - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60);
    const expectedHours = isLong ? EXPECTED_HOURS_LONG : EXPECTED_HOURS_SHORT;
    if (signalAgeHours > expectedHours * timeThresholdMultiplier && atr > 0) {
        const priceChangePercent = Math.abs(currentPrice - signal.entryPrice) / signal.entryPrice;
        const expectedMove = atr * MOMENTUM_ATR_FACTOR;
        if (priceChangePercent < expectedMove / signal.entryPrice) {
            return { isInvalidated: true, reason: 'MOMENTUM_EXHAUSTION' };
        }
    }

    return { isInvalidated: false, reason: null };
}

export async function checkExpiredSignals(): Promise<void> {
    try {
        const activeSignals = await getSignalsByState('ACTIVE');
        const now = Date.now();

        for (const signal of activeSignals) {
            const signalAgeHours = (now - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60);
            const shouldExpire = signalAgeHours >= EXPIRY_HOURS;
            if (shouldExpire) {
                await autoCloseSignal(signal.id, 'EXPIRED');
                if (env.LIFECYCLE_V2_ENABLED) {
                    await appendLifecycleAction(signal.id, {
                        action: 'EXPIRED',
                        timestamp: new Date().toISOString(),
                        details: { ageHours: signalAgeHours },
                    });
                }
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in checkExpiredSignals:', err);
    }
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const { getCandles } = await import('./ohlcvSnapshot.service');
        const candles = await getCandles(symbol, '4h', 1);
        if (!candles || candles.length === 0) return null;
        return candles[0].close;
    } catch {
        return null;
    }
}