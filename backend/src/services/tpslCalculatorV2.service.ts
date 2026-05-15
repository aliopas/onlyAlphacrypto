import type { TechnicalAnalysisFullResult } from './technicalAnalysis.service';
import type { MtfContext } from './mtfContext.service';
import { env } from '../config/env';

export type TpSource = 'resistance' | 'support' | 'liquidity' | 'atr';
export type SlSource = 'invalidation' | 'support' | 'resistance' | 'atr';

export interface TpslV2Result {
    takeProfitPrice: number;
    tp2Price: number | null;
    tp3Price: number | null;
    stopLossPrice: number;
    tpSource: TpSource;
    tp2Source: TpSource | null;
    tp3Source: TpSource | null;
    slSource: SlSource;
    riskRewardRatio: number;
    riskRewardRatio2: number | null;
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
    mtfContext?: MtfContext | null;
}): Promise<TpslV2Result> {
    const { entryPrice, direction, signalType, taResult, mtfContext } = params;

    if (entryPrice <= 0) {
        return {
            takeProfitPrice: 0,
            tp2Price: null,
            tp3Price: null,
            stopLossPrice: 0,
            tpSource: 'atr',
            tp2Source: null,
            tp3Source: null,
            slSource: 'atr',
            riskRewardRatio: 0,
            riskRewardRatio2: null,
            isRejected: true,
            rejectionReason: 'Invalid entry price',
            entryZoneLow: 0,
            entryZoneHigh: 0,
        };
    }

    const atr = taResult.atrDaily ?? 0;
    const entryZone = calculateEntryZone(entryPrice, ENTRY_BUFFER_PERCENT);

    let atrMultiplier = 1.0;
    if (mtfContext?.confluence) {
        const score = mtfContext.confluence.confluenceScore;
        if (score > 70) atrMultiplier = 1.2;
        else if (score < 50) atrMultiplier = 0.8;
    }

    const tf1w = mtfContext?.timeframes.find(tf => tf.timeframe === '1w');
    const tf1d = mtfContext?.timeframes.find(tf => tf.timeframe === '1d');

    const higherTfResistance = tf1w?.resistanceLevels?.length
        ? tf1w.resistanceLevels
        : tf1d?.resistanceLevels?.length
            ? tf1d.resistanceLevels
            : null;

    const higherTfSupport = tf1w?.supportLevels?.length
        ? tf1w.supportLevels
        : tf1d?.supportLevels?.length
            ? tf1d.supportLevels
            : null;

    let takeProfitPrice = 0;
    let tp2Price: number | null = null;
    let tp3Price: number | null = null;
    let tpSource: TpSource = 'atr';
    let tp2Source: TpSource | null = null;
    let tp3Source: TpSource | null = null;

    if (direction === 'bullish') {
        let tp1: number | null = null;
        if (higherTfResistance) {
            const aboveEntry = higherTfResistance.filter(r => r.price > entryPrice);
            if (aboveEntry.length > 0) tp1 = Math.min(...aboveEntry.map(r => r.price));
        }
        if (tp1 === null && taResult.nearestResistance?.price && taResult.nearestResistance.price > entryPrice) {
            tp1 = taResult.nearestResistance.price;
        }
        if (tp1 !== null && tp1 > entryPrice) {
            takeProfitPrice = tp1;
            tpSource = 'resistance';
        } else if (atr > 0) {
            const tpMultiplier = signalType === 'tactical' ? 2.0 : 3.0;
            takeProfitPrice = entryPrice + atr * tpMultiplier * atrMultiplier;
            tpSource = 'atr';
        } else {
            const tpPct = signalType === 'tactical' ? 1.12 : 1.18;
            takeProfitPrice = entryPrice * tpPct;
            tpSource = 'atr';
        }

        if (env.LIFECYCLE_V2_ENABLED && atr > 0) {
            const allResistance = [
                ...(higherTfResistance ?? []).filter(r => r.price > entryPrice).sort((a, b) => a.price - b.price),
                ...(taResult.resistanceLevels ?? []).filter(r => r.price > entryPrice).sort((a, b) => a.price - b.price),
            ];

            const uniqueResistance = allResistance.filter((r, idx, arr) =>
                arr.findIndex(x => Math.abs(x.price - r.price) < atr * 0.5) === idx
            );

            if (uniqueResistance.length >= 2) {
                tp2Price = uniqueResistance[1].price;
                tp2Source = 'resistance';
            } else {
                tp2Price = takeProfitPrice + atr * 1.0;
                tp2Source = 'atr';
            }

            if (uniqueResistance.length >= 3) {
                tp3Price = uniqueResistance[2].price;
                tp3Source = 'resistance';
            } else if (signalType === 'strategic') {
                tp3Price = tp2Price + atr * 0.5;
                tp3Source = 'atr';
            }
        }
    } else {
        let tp1: number | null = null;
        if (higherTfSupport) {
            const belowEntry = higherTfSupport.filter(s => s.price < entryPrice);
            if (belowEntry.length > 0) tp1 = Math.max(...belowEntry.map(s => s.price));
        }
        if (tp1 === null) {
            const taSupport = findNearestSupportBelow(entryPrice, taResult.supportLevels);
            if (taSupport !== null) tp1 = taSupport;
        }
        if (tp1 !== null) {
            takeProfitPrice = tp1;
            tpSource = 'support';
        } else if (atr > 0) {
            const tpMultiplier = signalType === 'tactical' ? 2.0 : 3.0;
            takeProfitPrice = entryPrice - atr * tpMultiplier * atrMultiplier;
            tpSource = 'atr';
        } else {
            const tpPct = signalType === 'tactical' ? 1.12 : 1.18;
            takeProfitPrice = entryPrice * (2 - tpPct);
            tpSource = 'atr';
        }

        if (env.LIFECYCLE_V2_ENABLED && atr > 0) {
            const allSupport = [
                ...(higherTfSupport ?? []).filter(s => s.price < entryPrice).sort((a, b) => b.price - a.price),
                ...(taResult.supportLevels ?? []).filter(s => s.price < entryPrice).sort((a, b) => b.price - a.price),
            ];

            const uniqueSupport = allSupport.filter((s, idx, arr) =>
                arr.findIndex(x => Math.abs(x.price - s.price) < atr * 0.5) === idx
            );

            if (uniqueSupport.length >= 2) {
                tp2Price = uniqueSupport[1].price;
                tp2Source = 'support';
            } else {
                tp2Price = takeProfitPrice - atr * 1.0;
                tp2Source = 'atr';
            }

            if (uniqueSupport.length >= 3) {
                tp3Price = uniqueSupport[2].price;
                tp3Source = 'support';
            } else if (signalType === 'strategic') {
                tp3Price = tp2Price - atr * 0.5;
                tp3Source = 'atr';
            }
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
            let support: number | null = null;
            if (higherTfSupport) {
                const strongSupport = higherTfSupport.filter(s => s.price < entryPrice);
                if (strongSupport.length > 0) support = Math.max(...strongSupport.map(s => s.price));
            }
            if (support === null) {
                support = findNearestSupportBelow(entryPrice, taResult.supportLevels);
            }
            if (support !== null) {
                stopLossPrice = support;
                slSource = 'support';
            } else if (atr > 0) {
                stopLossPrice = entryPrice - atr * 1.0 * atrMultiplier;
                slSource = 'atr';
            } else {
                stopLossPrice = entryPrice * 0.95;
                slSource = 'atr';
            }
        }
    } else {
        const sl1 = taResult.structure.lastSwingHigh ?? null;
        if (sl1 !== null && sl1 > entryPrice) {
            stopLossPrice = sl1;
            slSource = 'invalidation';
        } else {
            let resistance: number | null = null;
            if (higherTfResistance) {
                const aboveEntry = higherTfResistance.filter(r => r.price > entryPrice);
                if (aboveEntry.length > 0) resistance = Math.min(...aboveEntry.map(r => r.price));
            }
            if (resistance === null) {
                resistance = findNearestResistanceAbove(entryPrice, taResult.resistanceLevels);
            }
            if (resistance !== null) {
                stopLossPrice = resistance;
                slSource = 'resistance';
            } else if (atr > 0) {
                stopLossPrice = entryPrice + atr * 1.0 * atrMultiplier;
                slSource = 'atr';
            } else {
                stopLossPrice = entryPrice * 1.05;
                slSource = 'atr';
            }
        }
    }

    const tpDistance = Math.abs(takeProfitPrice - entryPrice);
    const slDistance = Math.abs(entryPrice - stopLossPrice);
    const riskRewardRatio = slDistance > 0 ? tpDistance / slDistance : 0;

    const tp2Distance = tp2Price != null ? Math.abs(tp2Price - entryPrice) : 0;
    const riskRewardRatio2 = slDistance > 0 && tp2Price != null ? tp2Distance / slDistance : null;

    const minRR = signalType === 'tactical' ? MIN_RR_TACTICAL : MIN_RR_STRATEGIC;
    const isRejected = riskRewardRatio < minRR;
    const rejectionReason = isRejected
        ? `RR ${riskRewardRatio.toFixed(2)} below minimum ${minRR} for ${signalType}`
        : null;

    return {
        takeProfitPrice,
        tp2Price,
        tp3Price,
        stopLossPrice,
        tpSource,
        tp2Source,
        tp3Source,
        slSource,
        riskRewardRatio,
        riskRewardRatio2,
        isRejected,
        rejectionReason,
        entryZoneLow: entryZone.low,
        entryZoneHigh: entryZone.high,
    };
}