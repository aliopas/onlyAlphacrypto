import cron from 'node-cron';
import { db } from '../config/db';
import { scenarioHorizonOutcomes, marketScenarios } from '../models/market.model';
import { getCoinKlinesRange } from '../services/binance.service';
import { logger } from '../utils/logger';
import { eq, lte, and, sql, inArray } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';

export async function runScenarioOutcomeChecker(): Promise<void> {
    if (process.env.SCENARIO_TRACKER_ENABLED !== 'true') {
        logger.info('[ScenarioOutcomeChecker] Disabled via env SCENARIO_TRACKER_ENABLED');
        return;
    }

    try {
        logger.info('[ScenarioOutcomeChecker] Starting outcome check...');

        const now = new Date();

        // Get pending outcomes due
        const pendingOutcomes = await db
            .select({
                scenarioId: scenarioHorizonOutcomes.scenarioId,
                coinSymbol: scenarioHorizonOutcomes.coinSymbol,
                horizon: scenarioHorizonOutcomes.horizon,
                dueAt: scenarioHorizonOutcomes.dueAt,
                priceAtStart: scenarioHorizonOutcomes.priceAtStart,
            })
            .from(scenarioHorizonOutcomes)
            .where(and(
                eq(scenarioHorizonOutcomes.status, 'pending'),
                lte(scenarioHorizonOutcomes.dueAt, now),
                inArray(scenarioHorizonOutcomes.coinSymbol, [...TRACKED_COINS]),
            ))
            .limit(100);

        if (pendingOutcomes.length === 0) {
            logger.info('[ScenarioOutcomeChecker] No pending outcomes due');
            return;
        }

        logger.info('[ScenarioOutcomeChecker] Processing %d outcomes', pendingOutcomes.length);

        for (const outcome of pendingOutcomes) {
            try {
                await processOutcome(outcome);
            } catch (error) {
                logger.error('[ScenarioOutcomeChecker] Failed to process outcome %s-%s: %s',
                    outcome.scenarioId, outcome.horizon, error instanceof Error ? error.message : String(error));
            }
        }

        logger.info('[ScenarioOutcomeChecker] Completed processing');
    } catch (error) {
        logger.error('[ScenarioOutcomeChecker] Fatal error: %s', error instanceof Error ? error.message : String(error));
    }
}

async function processOutcome(outcome: {
    scenarioId: string;
    coinSymbol: string;
    horizon: string;
    dueAt: Date;
    priceAtStart: string;
}): Promise<void> {
    const { scenarioId, coinSymbol, horizon } = outcome;
    const priceAtStart = parseFloat(outcome.priceAtStart);

    // Get scenario for zones and bias
    const scenario = await db
        .select({
            bias: marketScenarios.bias,
            targetZoneLow: marketScenarios.targetZoneLow,
            targetZoneHigh: marketScenarios.targetZoneHigh,
            riskZoneLow: marketScenarios.riskZoneLow,
            riskZoneHigh: marketScenarios.riskZoneHigh,
            invalidationPrice: marketScenarios.invalidationPrice,
            referencePriceAt: marketScenarios.referencePriceAt,
        })
        .from(marketScenarios)
        .where(eq(marketScenarios.scenarioId, scenarioId))
        .limit(1);

    if (scenario.length === 0) {
        throw new Error(`Scenario ${scenarioId} not found`);
    }

    const scen = scenario[0];
    const bias = scen.bias;
    const startTime = scen.referencePriceAt.getTime();
    const horizonMs = getHorizonMs(horizon as any); // TODO: type
    const endTime = startTime + horizonMs;

    // Fetch candles
    const candles = await getCoinKlinesRange(coinSymbol, '1h', startTime, endTime);

    if (candles.length === 0) {
        // Insufficient data
        await updateOutcome(scenarioId, horizon, null, null, null, null, null, null, 'insufficient_data', 'failed', 'No candles available');
        return;
    }

    // Find price at horizon (last candle)
    const lastCandle = candles[candles.length - 1];
    if (!lastCandle || lastCandle.closeTime < endTime - 3600000) { // Allow some tolerance
        await updateOutcome(scenarioId, horizon, null, null, null, null, null, null, 'insufficient_data', 'failed', 'No price at horizon');
        return;
    }

    const priceAtHorizon = lastCandle.close;
    const changePercent = ((priceAtHorizon - priceAtStart) / priceAtStart) * 100;

    // Compute maxUpside, maxDrawdown, times
    let maxUpsidePercent = -Infinity;
    let maxDrawdownPercent = Infinity;
    let timeToPeakMinutes = 0;
    let timeToBottomMinutes = 0;

    for (const candle of candles) {
        const change = ((candle.close - priceAtStart) / priceAtStart) * 100;
        if (change > maxUpsidePercent) {
            maxUpsidePercent = change;
            timeToPeakMinutes = Math.round((candle.closeTime - startTime) / 60000);
        }
        if (change < maxDrawdownPercent) {
            maxDrawdownPercent = change;
            timeToBottomMinutes = Math.round((candle.closeTime - startTime) / 60000);
        }
    }

    // Check for invalidation (bias-aware)
    let invalidated = false;
    const riskLow = scen.riskZoneLow ? parseFloat(scen.riskZoneLow) : null;
    const riskHigh = scen.riskZoneHigh ? parseFloat(scen.riskZoneHigh) : null;
    const invalidation = scen.invalidationPrice ? parseFloat(scen.invalidationPrice) : null;

    for (const candle of candles) {
        const price = candle.close;
        if ((riskLow && price <= riskLow) || (riskHigh && price >= riskHigh)) {
            invalidated = true;
            break;
        }
        if (invalidation) {
            if ((bias === 'bullish' && price <= invalidation) || (bias === 'bearish' && price >= invalidation)) {
                invalidated = true;
                break;
            }
        }
    }

    // Classify (bias-aware)
    let classification: string;
    if (invalidated) {
        classification = 'invalidated';
    } else if (Math.abs(changePercent) < 0.01) { // Small change = neutral
        classification = 'neutral';
    } else if (bias === 'bullish') {
        classification = changePercent > 0 ? 'favorable' : 'unfavorable';
    } else if (bias === 'bearish') {
        classification = changePercent < 0 ? 'favorable' : 'unfavorable';
    } else { // neutral bias
        classification = 'neutral';
    }

    await updateOutcome(scenarioId, horizon, priceAtHorizon.toString(), changePercent.toString(), maxUpsidePercent.toString(), maxDrawdownPercent.toString(), timeToPeakMinutes, timeToBottomMinutes, classification, 'captured', null);
}

async function updateOutcome(
    scenarioId: string,
    horizon: string,
    priceAtHorizon: string | null,
    changePercent: string | null,
    maxUpsidePercent: string | null,
    maxDrawdownPercent: string | null,
    timeToPeakMinutes: number | null,
    timeToBottomMinutes: number | null,
    outcomeClassification: string | null,
    status: string,
    errorMessage: string | null
): Promise<void> {
    await db.update(scenarioHorizonOutcomes)
        .set({
            priceAtHorizon,
            changePercent,
            maxUpsidePercent,
            maxDrawdownPercent,
            timeToPeakMinutes,
            timeToBottomMinutes,
            outcomeClassification: outcomeClassification as any,
            status: status as any,
            capturedAt: new Date(),
            errorMessage,
            updatedAt: new Date()
        })
        .where(and(
            eq(scenarioHorizonOutcomes.scenarioId, scenarioId),
            eq(scenarioHorizonOutcomes.horizon, horizon as any)
        ));
}

function getHorizonMs(horizon: string): number {
    const map: Record<string, number> = {
        '1h': 3600000,
        '4h': 14400000,
        '24h': 86400000,
        '3d': 259200000,
        '7d': 604800000,
        '14d': 1209600000,
        '30d': 2592000000,
        '90d': 7776000000,
        '180d': 15552000000,
        '365d': 31536000000,
        '730d': 63072000000
    };
    return map[horizon] || 0;
}

export function startScenarioOutcomeCheckerCron(): void {
    cron.schedule('0 * * * *', () => runScenarioOutcomeChecker());
    console.log('⏰ ScenarioOutcomeChecker scheduled — every hour');
}