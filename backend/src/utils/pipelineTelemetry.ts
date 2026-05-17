import { logger } from './logger';

export interface QualityBreakdown {
    trend: number;
    sr: number;
    volume: number;
    structure: number;
    confluence: number;
    penalties: number;
    final: number;
}

export interface PipelineTelemetry {
    symbol: string;
    timestamp: string;
    marketRegime: string;
    trend4h: string;
    trendDaily: string;
    qualityScore: number;
    qualityBreakdown: QualityBreakdown;
    algorithmVerdict: string;
    aiVerdict: string;
    finalVerdict: string;
    finalDirection: 'bullish' | 'bearish' | 'neutral';
    rejectionReason: string | null;
    rejectionStage: string | null;
    signalAction: string | null;
    signalId: number | null;
    regimeAllowsSignals: boolean;
    counterTrendBlocked: boolean;
    qualityRejected: boolean;
    rrRejected: boolean;
}

type RejectionStage =
    | 'regime_blocked'
    | 'volatility_blocked'
    | 'counter_trend'
    | 'quality_threshold'
    | 'rr_minimum'
    | 'lifecycle_constraint'
    | 'failed_bos'
    | 'no_direction'
    | 'none';

const counters: Record<RejectionStage, number> = {
    regime_blocked: 0,
    volatility_blocked: 0,
    counter_trend: 0,
    quality_threshold: 0,
    rr_minimum: 0,
    lifecycle_constraint: 0,
    failed_bos: 0,
    no_direction: 0,
    none: 0,
};

let totalAnalyzed = 0;
let totalSignalsCreated = 0;
let totalSignalsSkipped = 0;

export function incrementRejection(stage: RejectionStage): void {
    counters[stage]++;
}

export function incrementAnalyzed(): void {
    totalAnalyzed++;
}

export function incrementSignalCreated(): void {
    totalSignalsCreated++;
}

export function incrementSignalSkipped(): void {
    totalSignalsSkipped++;
}

export function logPipelineTelemetry(t: PipelineTelemetry): void {
    logger.info('[PIPELINE] %s | regime=%s trend4h=%s trendDaily=%s algo=%s ai=%s final=%s dir=%s quality=%d(%s) rejection=%s action=%s signalId=%s', 
        t.symbol,
        t.marketRegime,
        t.trend4h,
        t.trendDaily,
        t.algorithmVerdict,
        t.aiVerdict,
        t.finalVerdict,
        t.finalDirection,
        t.qualityScore,
        JSON.stringify(t.qualityBreakdown),
        t.rejectionStage ?? 'NONE',
        t.signalAction ?? 'SKIP',
        t.signalId ?? '-'
    );
}

export function logRejectionSummary(): void {
    logger.info('[REJECTION-SUMMARY] analyzed=%d created=%d skipped=%d | regime_blocked=%d counter_trend=%d quality=%d rr=%d lifecycle=%d failed_bos=%d no_dir=%d volatility=%d',
        totalAnalyzed,
        totalSignalsCreated,
        totalSignalsSkipped,
        counters.regime_blocked,
        counters.counter_trend,
        counters.quality_threshold,
        counters.rr_minimum,
        counters.lifecycle_constraint,
        counters.failed_bos,
        counters.no_direction,
        counters.volatility_blocked
    );
}

export function getRejectionCounters(): { totalAnalyzed: number; totalSignalsCreated: number; totalSignalsSkipped: number; breakdown: Record<RejectionStage, number> } {
    return { totalAnalyzed, totalSignalsCreated, totalSignalsSkipped, breakdown: { ...counters } };
}
