import { db } from '../config/db';
import { radarSignals, signalPerformance } from '../models/market.model';
import { eq, and } from 'drizzle-orm';
import { getPriceWithFallback } from './priceService';
import { calculateTpsl } from './tpslCalculator.service';

type SignalDirection = 'bullish' | 'bearish';
type SignalVerdict = 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL';

interface SignalDecision {
    action: 'create' | 'upgrade' | 'close_and_replace' | 'skip';
    verdict: SignalVerdict;
    closedSignal?: {
        id: number;
        exitPrice: number;
        realizedPnl: number;
        closedAt: Date;
    };
    reason: string;
}

function verdictToDirection(verdict: string): SignalDirection {
    const bullish = new Set(['STRONG_BUY', 'BUY']);
    return bullish.has(verdict) ? 'bullish' : 'bearish';
}

function isStrongVerdict(verdict: string): boolean {
    return verdict === 'STRONG_BUY' || verdict === 'STRONG_SELL';
}

function canUpgrade(oldVerdict: string): boolean {
    return oldVerdict === 'BUY' || oldVerdict === 'SELL';
}

export async function decideSignalAction(coinSymbol: string, newVerdict: SignalVerdict): Promise<SignalDecision> {
    const activeSignals = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.coinSymbol, coinSymbol),
            eq(signalPerformance.isActive, true)
        ))
        .limit(1);

    if (activeSignals.length === 0) {
        return {
            action: 'create',
            verdict: newVerdict,
            reason: `No active signal for ${coinSymbol}. Creating new ${newVerdict} signal.`
        };
    }

    const activeSignal = activeSignals[0];
    const oldDirection = verdictToDirection(activeSignal.verdict);
    const newDirection = verdictToDirection(newVerdict);

    if (oldDirection === newDirection) {
        if (canUpgrade(activeSignal.verdict) && isStrongVerdict(newVerdict)) {
            const price = await getPriceWithFallback(coinSymbol);
            if (!price || price.price <= 0) {
            return {
                action: 'skip',
                verdict: activeSignal.verdict as SignalVerdict,
                reason: `Price fetch failed for ${coinSymbol}. Skipping signal upgrade.`
            };
            }

            const isBearish = newDirection === 'bearish';
            const tradePnl = ((price.price - activeSignal.entryPrice) / activeSignal.entryPrice) * 100;
            const adjustedPnl = isBearish ? -tradePnl : tradePnl;

            if (adjustedPnl > 0) {
                return {
                    action: 'upgrade',
                    verdict: newVerdict,
                    reason: `Upgrading ${activeSignal.verdict} to ${newVerdict} for ${coinSymbol}. Trade is profitable (${adjustedPnl.toFixed(2)}%).`
                };
            }

            return {
                action: 'skip',
                verdict: activeSignal.verdict as SignalVerdict,
                reason: `Trade is currently unprofitable (${adjustedPnl.toFixed(2)}%). Keeping existing ${activeSignal.verdict} signal.`
            };
        }

        return {
            action: 'skip',
            verdict: activeSignal.verdict as SignalVerdict,
            reason: `Cannot upgrade ${activeSignal.verdict} to ${newVerdict}. Same direction but upgrade not allowed.`
        };
    }

    const price = await getPriceWithFallback(coinSymbol);
    if (!price || price.price <= 0) {
        return {
            action: 'skip',
            verdict: activeSignal.verdict as SignalVerdict,
            reason: `Price fetch failed for ${coinSymbol}. Skipping direction change.`
        };
    }

    const isBearish = oldDirection === 'bearish';
    const tradePnl = ((price.price - activeSignal.entryPrice) / activeSignal.entryPrice) * 100;
    const realizedPnl = isBearish ? -tradePnl : tradePnl;

    const closedAt = new Date();

    return {
        action: 'close_and_replace',
        verdict: newVerdict,
        closedSignal: {
            id: activeSignal.id,
            exitPrice: price.price,
            realizedPnl,
            closedAt
        },
        reason: `Direction changed from ${oldDirection} to ${newDirection}. Closing old ${activeSignal.verdict} signal with ${realizedPnl.toFixed(2)}% P&L.`
    };
}

export async function executeSignalDecision(
    coinSymbol: string,
    signalText: string,
    sentiment: string,
    impactScore: number,
    decision: SignalDecision,
    tpslData?: { stopLossPrice: number; takeProfitPrice: number }
): Promise<number | null> {
    if (decision.action === 'close_and_replace' && decision.closedSignal) {
        await db.update(signalPerformance)
            .set({
                isActive: false,
                closedAt: decision.closedSignal.closedAt,
                exitPrice: decision.closedSignal.exitPrice,
                realizedPnl: decision.closedSignal.realizedPnl
            })
            .where(eq(signalPerformance.id, decision.closedSignal.id));

        console.log(`[SignalManager] Closed signal ${decision.closedSignal.id} for ${coinSymbol}: exitPrice=$${decision.closedSignal.exitPrice}, realizedPnl=${decision.closedSignal.realizedPnl.toFixed(2)}%`);
    }

    if (decision.action === 'upgrade') {
        await db.update(signalPerformance)
            .set({ verdict: decision.verdict })
            .where(and(
                eq(signalPerformance.coinSymbol, coinSymbol),
                eq(signalPerformance.isActive, true)
            ));

        console.log(`[SignalManager] Upgraded signal for ${coinSymbol} to ${decision.verdict}.`);
        return null;
    }

    if (decision.action === 'skip') {
        console.log(`[SignalManager] Skipped signal for ${coinSymbol}: ${decision.reason}`);
        return null;
    }

    if (decision.action === 'create' || decision.action === 'close_and_replace') {
        const insertedRadar = await db.insert(radarSignals).values({
            coinSymbol,
            signalText,
            sentiment,
            impactScore,
            newsId: null
        }).returning({ id: radarSignals.id });

        if (insertedRadar.length === 0) {
            console.error(`[SignalManager] Failed to insert radar signal for ${coinSymbol}`);
            return null;
        }

        const price = await getPriceWithFallback(coinSymbol);
        if (price && price.price > 0) {
            await db.insert(signalPerformance).values({
                signalId: insertedRadar[0].id,
                coinSymbol,
                verdict: decision.verdict,
                sentiment,
                entryPrice: price.price,
                entryAt: new Date(),
                isActive: true,
                stopLossPrice: tpslData?.stopLossPrice,
                takeProfitPrice: tpslData?.takeProfitPrice,
                signalState: 'NEW',
            });

            console.log(`[SignalManager] Created ${decision.verdict} signal for ${coinSymbol}: entryPrice=$${price.price}, signalId=${insertedRadar[0].id}`);
            return insertedRadar[0].id;
        } else {
            console.error(`[SignalManager] Failed to fetch price for ${coinSymbol} after creating radar signal`);
            return null;
        }
    }

    return null;
}
