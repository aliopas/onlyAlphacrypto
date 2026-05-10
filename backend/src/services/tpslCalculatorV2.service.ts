import type { TechnicalAnalysisFullResult } from './technicalAnalysis.service';

export type TpSource = 'resistance' | 'support' | 'liquidity' | 'atr';
export type SlSource = 'invalidation' | 'support' | 'resistance' | 'atr';

export interface TpslV2Result {
    takeProfitPrice: number;
    stopLossPrice: number;
    tpSource: TpSource;
    slSource: SlSource;
    riskRewardRatio: number;
    isRejected: boolean;
    rejectionReason: string | null;
    entryZoneLow: number;
    entryZoneHigh: number;
}

const MIN_RR_TACTICAL = 2;
const MIN_RR_STRATEGIC = 3;
const ENTRY_BUFFER_PERCENT = 0.01;

function findNearestResistanceAbove(price: number, resistanceLevels: TechnicalAnalysisFullResult['resistanceLevels']): number | null {
    if (!resistanceLevels || resistanceLevels.length === 0) return null;
    const valid = resistanceLevels.filter(r => r.price > price);
    if (valid.length === 0) return null;
    return Math.min(...valid.map(r => r.price));
}

function findNearestSupportBelow(price: number, supportLevels: TechnicalAnalysisFullResult['supportLevels']): number | null {
    if (!supportLevels || supportLevels.length === 0) return null;
    const strongSupport = supportLevels.filter(s => s.strengthScore >= 60);
    if (strongSupport.length === 0) return null;
    const valid = strongSupport.filter(s => s.price < price);
    if (valid.length === 0) return null;
    return Math.max(...valid.map(s => s.price));
}

function calculateEntryZone(entryPrice: number, bufferPercent: number): { low: number; high: number } {
    const buffer = entryPrice * bufferPercent;
    return {
        low: entryPrice - buffer,
        high: entryPrice + buffer,
    };
}

export async function calculateTpslV2(params: {
    entryPrice: number;
    direction: 'bullish' | 'bearish';
    signalType: 'tactical' | 'strategic';
    taResult: TechnicalAnalysisFullResult;
}): Promise<TpslV2Result> {
    const { entryPrice, direction, signalType, taResult } = params;

    if (entryPrice <= 0) {
        return {
            takeProfitPrice: 0,
            stopLossPrice: 0,
            tpSource: 'atr',
            slSource: 'atr',
            riskRewardRatio: 0,
            isRejected: true,
            rejectionReason: 'Invalid entry price',
            entryZoneLow: 0,
            entryZoneHigh: 0,
        };
    }

    const atr = taResult.atrDaily ?? 0;
    const entryZone = calculateEntryZone(entryPrice, ENTRY_BUFFER_PERCENT);

    let takeProfitPrice = 0;
    let tpSource: TpSource = 'atr';

    if (direction === 'bullish') {
        const tp1 = taResult.nearestResistance?.price ?? null;
        if (tp1 !== null && tp1 > entryPrice) {
            takeProfitPrice = tp1;
            tpSource = 'resistance';
        } else if (atr > 0) {
            takeProfitPrice = entryPrice + atr * 1.5;
            tpSource = 'atr';
        } else {
            takeProfitPrice = entryPrice * 1.15;
            tpSource = 'atr';
        }
    } else {
        const tp1 = findNearestSupportBelow(entryPrice, taResult.supportLevels);
        if (tp1 !== null) {
            takeProfitPrice = tp1;
            tpSource = 'support';
        } else if (atr > 0) {
            takeProfitPrice = entryPrice - atr * 1.5;
            tpSource = 'atr';
        } else {
            takeProfitPrice = entryPrice * 0.85;
            tpSource = 'atr';
        }
    }

    let stopLossPrice = 0;
    let slSource: SlSource = 'atr';

    if (direction === 'bullish') {
        const sl1 = taResult.structure.lastSwingLow ?? null;
        if (sl1 !== null && sl1 < entryPrice) {
            stopLossPrice = sl1;
            slSource = 'invalidation';
        } else {
            const support = findNearestSupportBelow(entryPrice, taResult.supportLevels);
            if (support !== null) {
                stopLossPrice = support;
                slSource = 'support';
            } else if (atr > 0) {
                stopLossPrice = entryPrice - atr * 1.0;
                slSource = 'atr';
            } else {
                stopLossPrice = entryPrice * 0.92;
                slSource = 'atr';
            }
        }
    } else {
        const sl1 = taResult.structure.lastSwingHigh ?? null;
        if (sl1 !== null && sl1 > entryPrice) {
            stopLossPrice = sl1;
            slSource = 'invalidation';
        } else {
            const resistance = findNearestResistanceAbove(entryPrice, taResult.resistanceLevels);
            if (resistance !== null) {
                stopLossPrice = resistance;
                slSource = 'resistance';
            } else if (atr > 0) {
                stopLossPrice = entryPrice + atr * 1.0;
                slSource = 'atr';
            } else {
                stopLossPrice = entryPrice * 1.08;
                slSource = 'atr';
            }
        }
    }

    const tpDistance = Math.abs(takeProfitPrice - entryPrice);
    const slDistance = Math.abs(entryPrice - stopLossPrice);
    const riskRewardRatio = slDistance > 0 ? tpDistance / slDistance : 0;

    const minRR = signalType === 'tactical' ? MIN_RR_TACTICAL : MIN_RR_STRATEGIC;
    const isRejected = riskRewardRatio < minRR;
    const rejectionReason = isRejected
        ? `RR ${riskRewardRatio.toFixed(2)} below minimum ${minRR} for ${signalType}`
        : null;

    return {
        takeProfitPrice,
        stopLossPrice,
        tpSource,
        slSource,
        riskRewardRatio,
        isRejected,
        rejectionReason,
        entryZoneLow: entryZone.low,
        entryZoneHigh: entryZone.high,
    };
}