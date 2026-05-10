import { db } from '../config/db';
import { radarSignals, signalPerformance } from '../models/market.model';
import { eq, sql } from 'drizzle-orm';

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