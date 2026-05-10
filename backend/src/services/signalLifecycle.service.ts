import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export type SignalState = 'NEW' | 'WAITING_CONFIRMATION' | 'ACTIVE' | 'PARTIAL_TP' | 'BREAKEVEN' | 'CLOSED';
export type CloseReason = 'TP_HIT' | 'SL_HIT' | 'EXPIRED' | 'THESIS_REVERSED';

interface SignalPerformanceRow {
    id: number;
    signalId: number;
    coinSymbol: string;
    signalState: string | null;
    entryPrice: number;
    takeProfitPrice: number | null;
    stopLossPrice: number | null;
    createdAt: Date;
    partialTpHitAt: Date | null;
    breakevenMovedAt: Date | null;
}

const SIGNAL_STATES = ['NEW', 'WAITING_CONFIRMATION', 'ACTIVE', 'PARTIAL_TP', 'BREAKEVEN', 'CLOSED'] as const;

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
    const fiftyPercentDistance = distanceToTp * 0.5;
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
        return rows as unknown as SignalPerformanceRow[];
    } catch (err) {
        logger.error(`[SignalLifecycle] Failed to get signals by state=${state}:`, err);
        return [];
    }
}

export async function processActiveSignals(): Promise<void> {
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
                    await autoCloseSignal(signal.id, 'TP_HIT');
                    continue;
                }
                if (slHit) {
                    await autoCloseSignal(signal.id, 'SL_HIT');
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

export async function checkExpiredSignals(): Promise<void> {
    try {
        const activeSignals = await getSignalsByState('ACTIVE');
        const now = Date.now();

        for (const signal of activeSignals) {
            const signalAgeHours = (now - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60);
            const shouldExpire = signalAgeHours >= 72;
            if (shouldExpire) {
                await autoCloseSignal(signal.id, 'EXPIRED');
            }
        }
    } catch (err) {
        logger.error('[SignalLifecycle] Error in checkExpiredSignals:', err);
    }
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const { getCandles } = await import('../services/ohlcvSnapshot.service');
        const candles = await getCandles(symbol, '4h', 1);
        if (!candles || candles.length === 0) return null;
        return candles[0].close;
    } catch {
        return null;
    }
}