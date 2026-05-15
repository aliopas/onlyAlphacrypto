import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, sql } from 'drizzle-orm';
import type { TechnicalAnalysisFullResult } from './technicalAnalysis.service';

export type SignalType = 'tactical' | 'strategic';
export type HorizonDays = 3 | 14 | 21;

export interface ClassificationResult {
    signalType: SignalType;
    horizonDays: HorizonDays;
    entryZoneLow: number;
    entryZoneHigh: number;
    invalidationLevel: number;
    invalidationReason: string;
    riskRewardRatio: number;
    meetsMinimumRR: boolean;
}

const TACTICAL_EVENTS = new Set(['listing', 'whale_movement', 'partnership', 'price_action', 'volume_spike']);
const STRATEGIC_14_EVENTS = new Set(['ETF_approval', 'ETF_rejection', 'regulation', 'hack', 'delisting']);
const STRATEGIC_21_EVENTS = new Set(['mainnet_launch', 'major_funding', 'protocol_upgrade']);

const MIN_RR_TACTICAL = 2;
const MIN_RR_STRATEGIC = 3;
const ENTRY_BUFFER_PERCENT = 0.01;

function mapEventTypeToSignalType(eventType: string): { signalType: SignalType; horizonDays: HorizonDays } {
    const normalized = eventType.toLowerCase();
    if (TACTICAL_EVENTS.has(normalized)) {
        return { signalType: 'tactical', horizonDays: 3 };
    }
    if (STRATEGIC_14_EVENTS.has(normalized)) {
        return { signalType: 'strategic', horizonDays: 14 };
    }
    if (STRATEGIC_21_EVENTS.has(normalized)) {
        return { signalType: 'strategic', horizonDays: 21 };
    }
    return { signalType: 'tactical', horizonDays: 3 };
}

function findNearestSRLevel(
    price: number,
    direction: 'bullish' | 'bearish',
    taResult: TechnicalAnalysisFullResult
): { level: number; type: 'support' | 'resistance' } | null {
    const levels = direction === 'bullish'
        ? taResult.resistanceLevels
        : taResult.supportLevels;

    if (!levels || levels.length === 0) {
        return null;
    }

    let best: { level: number; type: 'support' | 'resistance' } | null = null;
    let bestDistance = Infinity;

    for (const lvl of levels) {
        const distance = Math.abs(price - lvl.price);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = { level: lvl.price, type: lvl.type };
        }
    }

    return best;
}

function calculateEntryZone(entryPrice: number, bufferPercent: number): { low: number; high: number } {
    const buffer = entryPrice * bufferPercent;
    return {
        low: entryPrice - buffer,
        high: entryPrice + buffer,
    };
}

function calculateRiskReward(
    entryPrice: number,
    direction: 'bullish' | 'bearish',
    tpPrice: number,
    slPrice: number
): number {
    const tpDistance = Math.abs(tpPrice - entryPrice);
    const slDistance = Math.abs(entryPrice - slPrice);

    if (slDistance === 0) return 0;
    return tpDistance / slDistance;
}

export function deriveDirectionFromVerdict(verdict?: string): 'bullish' | 'bearish' | null {
    if (!verdict) return null;
    const upper = verdict.toUpperCase();
    if (upper === 'STRONG_BULLISH' || upper === 'BULLISH') return 'bullish';
    if (upper === 'STRONG_BEARISH' || upper === 'BEARISH') return 'bearish';
    return null;
}

export function classifySignal(params: {
    eventType: string;
    taResult: TechnicalAnalysisFullResult;
    currentPrice: number;
    verdict?: string;
}): ClassificationResult {
    const { eventType, taResult, currentPrice, verdict } = params;
    const entryPrice = currentPrice;

    if (entryPrice <= 0) {
        return {
            signalType: 'tactical',
            horizonDays: 3,
            entryZoneLow: 0,
            entryZoneHigh: 0,
            invalidationLevel: 0,
            invalidationReason: 'No reference price available',
            riskRewardRatio: 0,
            meetsMinimumRR: false,
        };
    }

    const { signalType, horizonDays } = mapEventTypeToSignalType(eventType);
    const direction = deriveDirectionFromVerdict(verdict);

    if (!direction) {
        return {
            signalType: 'tactical',
            horizonDays: 3,
            entryZoneLow: 0,
            entryZoneHigh: 0,
            invalidationLevel: 0,
            invalidationReason: 'No directional verdict',
            riskRewardRatio: 0,
            meetsMinimumRR: false,
        };
    }

    const nearestSR = findNearestSRLevel(entryPrice, direction, taResult);
    const takeProfitPrice = nearestSR?.level ?? entryPrice * 1.15;

    const invalidationLevel = signalType === 'tactical'
        ? taResult.structure.lastSwingLow ?? entryPrice * 0.92
        : taResult.structure.lastSwingLow ?? entryPrice * 0.85;
    const stopLossPrice = invalidationLevel;

    const entryZone = calculateEntryZone(entryPrice, ENTRY_BUFFER_PERCENT);
    const rr = calculateRiskReward(entryPrice, direction, takeProfitPrice, stopLossPrice);
    const minRR = signalType === 'tactical' ? MIN_RR_TACTICAL : MIN_RR_STRATEGIC;

    const invalidationReason = taResult.structure.isChocho
        ? 'CHoCH detected - structure shift'
        : taResult.structure.isFailedBos
            ? 'Failed BOS'
            : 'Structure break point';

    return {
        signalType,
        horizonDays,
        entryZoneLow: entryZone.low,
        entryZoneHigh: entryZone.high,
        invalidationLevel,
        invalidationReason,
        riskRewardRatio: rr,
        meetsMinimumRR: rr >= minRR,
    };
}

export type OutcomeClassification = 'favorable' | 'unfavorable' | 'neutral' | 'invalidated' | 'insufficient_data';

export interface ClassificationStats {
    total: number;
    favorable: number;
    unfavorable: number;
    neutral: number;
    invalidated: number;
    insufficientData: number;
}

function deriveClassification(pnl7d: number | null, wasInvalidated: boolean): { outcome: OutcomeClassification; confidence: number } {
    if (wasInvalidated) {
        return { outcome: 'invalidated', confidence: 0.9 };
    }
    if (pnl7d === null || Number.isNaN(pnl7d)) {
        return { outcome: 'insufficient_data', confidence: 0.5 };
    }
    if (pnl7d > 15) {
        return { outcome: 'favorable', confidence: Math.min(1, 0.5 + (pnl7d - 15) / 100) };
    }
    if (pnl7d > 5) {
        return { outcome: 'favorable', confidence: 0.65 };
    }
    if (pnl7d > -5) {
        return { outcome: 'neutral', confidence: 0.6 };
    }
    if (pnl7d > -15) {
        return { outcome: 'unfavorable', confidence: 0.7 };
    }
    return { outcome: 'unfavorable', confidence: Math.min(1, 0.5 + Math.abs(pnl7d + 15) / 100) };
}

export async function classifySignalOutcome(signalId: number): Promise<void> {
    const records = await db.select()
        .from(signalPerformance)
        .where(eq(signalPerformance.signalId, signalId))
        .limit(1);

    if (records.length === 0) {
        console.warn(`[SignalClassification] No signal_performance record found for signalId=${signalId}`);
        return;
    }

    const perf = records[0];

    if (perf.isActive) {
        console.warn(`[SignalClassification] Signal ${signalId} is still active, skipping classification.`);
        return;
    }

    const wasInvalidated = perf.autoClosedReason === 'invalidation' || perf.autoClosedReason === 'stop_loss';
    const { outcome, confidence } = deriveClassification(perf.pnl7d ?? null, wasInvalidated);

    await db.update(signalPerformance)
        .set({
            outcomeClassification: outcome,
            classificationConfidence: confidence
        })
        .where(eq(signalPerformance.signalId, signalId));

    console.log(`[SignalClassification] Signal ${signalId} classified as ${outcome} (confidence=${confidence.toFixed(2)})`);
}

export async function getClassificationStats(): Promise<ClassificationStats> {
    const rows = await db.select({
        outcomeClassification: signalPerformance.outcomeClassification,
        count: sql<number>`COUNT(*)::int`,
    })
        .from(signalPerformance)
        .where(eq(signalPerformance.isActive, false))
        .groupBy(signalPerformance.outcomeClassification);

    const stats: ClassificationStats = {
        total: 0,
        favorable: 0,
        unfavorable: 0,
        neutral: 0,
        invalidated: 0,
        insufficientData: 0
    };

    for (const row of rows) {
        const c = row.count ?? 0;
        stats.total += c;
        switch (row.outcomeClassification) {
            case 'favorable': stats.favorable += c; break;
            case 'unfavorable': stats.unfavorable += c; break;
            case 'neutral': stats.neutral += c; break;
            case 'invalidated': stats.invalidated += c; break;
            case 'insufficient_data': stats.insufficientData += c; break;
        }
    }

    return stats;
}