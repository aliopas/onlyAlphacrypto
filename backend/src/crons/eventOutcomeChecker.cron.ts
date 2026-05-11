import cron from 'node-cron';
import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { getCoinKlinesRange } from '../services/binance.service';
import { logger } from '../utils/logger';
import { eq, isNotNull, isNull, and, lt, gte, sql, inArray } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';

const HORIZONS = {
    '1h': 3600000, // 1 hour in ms
    '4h': 14400000, // 4 hours
    '24h': 86400000, // 24 hours
    '3d': 259200000, // 3 days
    '7d': 604800000, // 7 days
} as const;

export async function runEventOutcomeChecker(): Promise<void> {
    try {
        logger.info('[EventOutcomeChecker] Starting outcome check...');

        // Query eligible rows: priceAtTime populated, no outcome classification yet, old enough for 1h
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - HORIZONS['1h']);

        const eligibleRows = await db
            .select({
                id: coinNewsHistory.id,
                coinSymbol: coinNewsHistory.coinSymbol,
                priceAtTime: coinNewsHistory.priceAtTime,
                publishedAt: coinNewsHistory.publishedAt,
                price1hAfter: coinNewsHistory.price1hAfter,
                price4hAfter: coinNewsHistory.price4hAfter,
                price24hAfter: coinNewsHistory.price24hAfter,
                price3dAfter: coinNewsHistory.price3dAfter,
                price7dAfter: coinNewsHistory.price7dAfter,
            })
            .from(coinNewsHistory)
            .where(and(
                isNotNull(coinNewsHistory.priceAtTime),
                isNull(coinNewsHistory.outcomeClassification),
                lt(coinNewsHistory.publishedAt, oneHourAgo),
                inArray(coinNewsHistory.coinSymbol, [...TRACKED_COINS])
            ))
            .limit(10);

        if (eligibleRows.length === 0) {
            logger.info('[EventOutcomeChecker] No eligible rows to process');
            return;
        }

        logger.info('[EventOutcomeChecker] Processing %d rows', eligibleRows.length);

        for (const row of eligibleRows) {
            try {
                await processRow(row);
            } catch (error) {
                logger.error('[EventOutcomeChecker] Failed to process row %d (%s): %s',
                    row.id, row.coinSymbol, error instanceof Error ? error.message : String(error));
            }
        }

        logger.info('[EventOutcomeChecker] Completed processing');
    } catch (error) {
        logger.error('[EventOutcomeChecker] Fatal error: %s', error instanceof Error ? error.message : String(error));
    }
}

async function processRow(row: {
    id: number;
    coinSymbol: string;
    priceAtTime: number | null;
    publishedAt: Date;
    price1hAfter: number | null;
    price4hAfter: number | null;
    price24hAfter: number | null;
    price3dAfter: number | null;
    price7dAfter: number | null;
}): Promise<void> {
    const { id, coinSymbol, publishedAt } = row;
    if (!row.priceAtTime) {
        logger.warn('[EventOutcomeChecker] Skipping row %d: priceAtTime is null', id);
        return;
    }
    const priceAtTime = row.priceAtTime;
    const publishedAtMs = publishedAt.getTime();
    const now = Date.now();

    // Determine ready horizons
    const readyHorizons: string[] = [];
    for (const [key, ms] of Object.entries(HORIZONS)) {
        if (publishedAtMs + ms < now) {
            readyHorizons.push(key);
        }
    }

    if (readyHorizons.length === 0) {
        logger.debug('[EventOutcomeChecker] No horizons ready for row %d', id);
        return;
    }

    // Fetch 1h candles from publishedAt to publishedAt + 7d (max horizon)
    const maxEndTime = publishedAtMs + HORIZONS['7d'];
    const allCandles = await getCoinKlinesRange(coinSymbol, '1h', publishedAtMs, maxEndTime);

    if (allCandles.length === 0) {
        logger.warn('[EventOutcomeChecker] No candles fetched for %s, skipping row %d', coinSymbol, id);
        return;
    }

    // Process each ready horizon
    const updates: Partial<typeof coinNewsHistory.$inferInsert> = {};
    let horizonsFilled = 0;

    for (const horizon of readyHorizons) {
        const horizonMs = HORIZONS[horizon as keyof typeof HORIZONS];
        const targetTime = publishedAtMs + horizonMs;

        // Find the closest candle at or after targetTime
        const targetCandle = allCandles.find(c => c.closeTime >= targetTime);
        if (!targetCandle) {
            logger.debug('[EventOutcomeChecker] No candle found for %s horizon on row %d', horizon, id);
            continue;
        }

        const priceAfter = targetCandle.close;
        const change = ((priceAfter - priceAtTime) / priceAtTime) * 100;

        if (horizon === '1h' && row.price1hAfter === null) {
            updates.price1hAfter = priceAfter;
            updates.change1h = change;
            horizonsFilled++;
        } else if (horizon === '4h' && row.price4hAfter === null) {
            updates.price4hAfter = priceAfter;
            updates.change4h = change;
            horizonsFilled++;
        } else if (horizon === '24h' && row.price24hAfter === null) {
            updates.price24hAfter = priceAfter;
            updates.change24h = change;
            horizonsFilled++;
        } else if (horizon === '3d' && row.price3dAfter === null) {
            updates.price3dAfter = priceAfter;
            updates.change3d = change;
            horizonsFilled++;
        } else if (horizon === '7d' && row.price7dAfter === null) {
            updates.price7dAfter = priceAfter;
            updates.change7d = change;
            horizonsFilled++;
        }
    }

    if (horizonsFilled === 0) {
        logger.debug('[EventOutcomeChecker] No horizons filled for row %d', id);
        return;
    }

    // Calculate maxUpside, maxDrawdown, timeToPeak, timeToBottom from allCandles
    let maxUpside = 0;
    let maxDrawdown = 0;
    let peakTimeMs = 0;
    let bottomTimeMs = 0;

    for (const candle of allCandles) {
        const changePct = ((candle.close - priceAtTime) / priceAtTime) * 100;
        if (changePct > maxUpside) {
            maxUpside = changePct;
            peakTimeMs = candle.closeTime;
        }
        if (changePct < maxDrawdown) {
            maxDrawdown = changePct;
            bottomTimeMs = candle.closeTime;
        }
    }

    updates.maxUpsideAfterEvent = maxUpside;
    updates.maxDrawdownAfterEvent = maxDrawdown;
    updates.timeToPeakHours = peakTimeMs > 0 ? Math.round((peakTimeMs - publishedAtMs) / 3600000) : null;
    updates.timeToBottomHours = bottomTimeMs > 0 ? Math.round((bottomTimeMs - publishedAtMs) / 3600000) : null;

    // Classify outcome if 3d horizon is filled
    if (updates.price3dAfter !== undefined && updates.change3d !== undefined) {
        const change3d = updates.change3d as number;
        let classification: string;
        if (change3d > 15) classification = 'strong_bullish';
        else if (change3d > 5) classification = 'bullish';
        else if (change3d > -5) classification = 'neutral';
        else if (change3d > -15) classification = 'bearish';
        else classification = 'strong_bearish';
        updates.outcomeClassification = classification;
    }

    // Update the row
    await db.update(coinNewsHistory)
        .set(updates)
        .where(eq(coinNewsHistory.id, id));

    logger.info('[EventOutcomeChecker] Updated row %d (%s): filled %d horizons, classification=%s',
        id, coinSymbol, horizonsFilled, updates.outcomeClassification || 'pending');
}

export function startEventOutcomeCheckerCron(): void {
    cron.schedule('*/30 * * * *', () => runEventOutcomeChecker());
    console.log('⏰ EventOutcomeChecker scheduled — every 30 minutes');
}