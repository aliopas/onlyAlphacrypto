import cron from 'node-cron';
import { db } from '../config/db';
import { eventImpactOutcomes, eventImpacts } from '../models/market.model';
import { env } from '../config/env';
import { getCoinKlinesRange } from '../services/binance.service';
import { logger } from '../utils/logger';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';

const HORIZON_MS: Record<string, number> = {
    '1h': 3_600_000,
    '4h': 14_400_000,
    '24h': 86_400_000,
    '3d': 259_200_000,
    '7d': 604_800_000,
};

const BATCH_SIZE = 100;

interface PendingOutcomeRow {
    id: number;
    eventImpactId: number;
    horizon: string;
    horizonHours: number;
    coinSymbol: string;
    publishedAt: Date;
    priceAtEvent: number | null;
}

function classifyOutcome(changePercent: number): string {
    if (changePercent > 15) return 'strong_bullish';
    if (changePercent > 5) return 'bullish';
    if (changePercent > -5) return 'neutral';
    if (changePercent > -15) return 'bearish';
    return 'strong_bearish';
}

export async function runEventImpactOutcomeChecker(): Promise<void> {
    if (!env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED) {
        return;
    }

    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        logger.info('[EventImpactOutcomeChecker] Skipping: EVENT_IMPACT_PERSISTENCE_ENABLED is false');
        return;
    }

    try {
        logger.info('[EventImpactOutcomeChecker] Starting...');

        const now = new Date();

        const pendingOutcomes = await db
            .select({
                id: eventImpactOutcomes.id,
                eventImpactId: eventImpactOutcomes.eventImpactId,
                horizon: eventImpactOutcomes.horizon,
                horizonHours: eventImpactOutcomes.horizonHours,
                coinSymbol: eventImpacts.coinSymbol,
                publishedAt: eventImpacts.publishedAt,
                priceAtEvent: eventImpacts.priceAtEvent,
            })
            .from(eventImpactOutcomes)
            .innerJoin(eventImpacts, eq(eventImpacts.id, eventImpactOutcomes.eventImpactId))
            .where(and(
                eq(eventImpactOutcomes.status, 'pending'),
                lte(eventImpactOutcomes.dueAt, now),
                inArray(eventImpacts.coinSymbol, [...TRACKED_COINS]),
            ))
            .limit(BATCH_SIZE);

        if (pendingOutcomes.length === 0) {
            logger.info('[EventImpactOutcomeChecker] No pending outcomes due');
            return;
        }

        logger.info('[EventImpactOutcomeChecker] Processing %d outcomes', pendingOutcomes.length);

        let completed = 0;
        let failed = 0;

        for (const outcome of pendingOutcomes) {
            try {
                await processOutcome(outcome as PendingOutcomeRow);
                completed++;
            } catch (error) {
                failed++;
                logger.error(
                    '[EventImpactOutcomeChecker] Failed for outcome id=%d: %s',
                    outcome.id,
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        logger.info(
            '[EventImpactOutcomeChecker] Batch completed: completed=%d, failed=%d',
            completed,
            failed,
        );
    } catch (error) {
        logger.error('[EventImpactOutcomeChecker] Fatal error: %s', error instanceof Error ? error.message : String(error));
    }
}

async function processOutcome(outcome: PendingOutcomeRow): Promise<void> {
    const { id, coinSymbol, horizon, horizonHours, publishedAt, priceAtEvent } = outcome;

    if (priceAtEvent === null || priceAtEvent <= 0) {
        await markOutcomeFailed(id, 'price_at_event is null or invalid');
        return;
    }

    const startTime = publishedAt.getTime();
    const horizonMs = HORIZON_MS[horizon] ?? horizonHours * 3_600_000;
    const endTime = startTime + horizonMs;

    const candles = await getCoinKlinesRange(coinSymbol, '1h', startTime, endTime);

    if (candles.length === 0) {
        await db
            .update(eventImpactOutcomes)
            .set({
                status: 'unsupported',
                errorMessage: 'No Binance data available for this coin',
                updatedAt: new Date(),
            })
            .where(eq(eventImpactOutcomes.id, id));
        return;
    }

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle || lastCandle.closeTime < endTime - 3_600_000) {
        await markOutcomeFailed(id, 'No price data near horizon target');
        return;
    }

    const priceAtHorizon = lastCandle.close;
    const changePercent = ((priceAtHorizon - priceAtEvent) / priceAtEvent) * 100;

    let maxUpsidePercent = -Infinity;
    let maxDrawdownPercent = Infinity;
    let timeToPeakMs = 0;
    let timeToBottomMs = 0;

    for (const candle of candles) {
        const candleChange = ((candle.close - priceAtEvent) / priceAtEvent) * 100;
        if (candleChange > maxUpsidePercent) {
            maxUpsidePercent = candleChange;
            timeToPeakMs = candle.closeTime - startTime;
        }
        if (candleChange < maxDrawdownPercent) {
            maxDrawdownPercent = candleChange;
            timeToBottomMs = candle.closeTime - startTime;
        }
    }

    const timeToPeakHours = timeToPeakMs > 0 ? Math.round(timeToPeakMs / 3_600_000) : null;
    const timeToBottomHours = timeToBottomMs > 0 ? Math.round(timeToBottomMs / 3_600_000) : null;

    const outcomeClassification = classifyOutcome(changePercent);

    await db
        .update(eventImpactOutcomes)
        .set({
            priceAtHorizon,
            changePercent,
            maxUpsidePercent: maxUpsidePercent === -Infinity ? null : maxUpsidePercent,
            maxDrawdownPercent: maxDrawdownPercent === Infinity ? null : maxDrawdownPercent,
            timeToPeakHours,
            timeToBottomHours,
            outcomeClassification,
            status: 'completed',
            checkedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(eventImpactOutcomes.id, id));
}

async function markOutcomeFailed(id: number, errorMessage: string): Promise<void> {
    await db
        .update(eventImpactOutcomes)
        .set({
            status: 'failed',
            errorMessage,
            checkedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(eventImpactOutcomes.id, id));
}

export function startEventImpactOutcomeCheckerCron(): void {
    if (!env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED) {
        logger.info('[EventImpactOutcomeChecker] Disabled by EVENT_IMPACT_OUTCOME_CHECKER_ENABLED=false');
        return;
    }

    cron.schedule('*/30 * * * *', () => runEventImpactOutcomeChecker());
    logger.info('[EventImpactOutcomeChecker] Scheduled — every 30 minutes');
}
