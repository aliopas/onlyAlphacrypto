import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, isNull, lte, and, sql, inArray } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';
import { TRACKED_COINS } from '../config/coins';
import { guardCron } from '../utils/cronGuard';
import { logger } from '../utils/logger';

async function updateSignalPerformance(): Promise<void> {
    logger.info('[SignalPerf] Update run started');

    const need24h = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price24h),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '24 hours'`),
            inArray(signalPerformance.coinSymbol, [...TRACKED_COINS])
        ))
        .limit(50);

    for (const row of need24h) {
        // Per-row try/catch so one bad row doesn't abort the rest of the batch.
        try {
            const priceResult = await getPriceWithFallback(row.coinSymbol);
            if (!priceResult) continue;
            const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
            const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
            const tradePnl = isBearish ? -pricePnl : pricePnl;

            await db.update(signalPerformance).set({
                price24h: priceResult.price,
                pnl24h: tradePnl,
            }).where(eq(signalPerformance.id, row.id));
        } catch (err) {
            logger.warn('[SignalPerf] Failed 24h update for signalId=%d: %s', row.id, err instanceof Error ? err.message : String(err));
        }
    }

    const need7d = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price7d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '7 days'`),
            inArray(signalPerformance.coinSymbol, [...TRACKED_COINS])
        ))
        .limit(50);

    for (const row of need7d) {
        try {
            const priceResult = await getPriceWithFallback(row.coinSymbol);
            if (!priceResult) continue;
            const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
            const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
            const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
            const tradePnl = isBearish ? -pricePnl : pricePnl;
            const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;

            await db.update(signalPerformance).set({
                price7d: priceResult.price,
                pnl7d: tradePnl,
                isWin7d: isWin,
            }).where(eq(signalPerformance.id, row.id));
        } catch (err) {
            logger.warn('[SignalPerf] Failed 7d update for signalId=%d: %s', row.id, err instanceof Error ? err.message : String(err));
        }
    }

    const need30d = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price30d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '30 days'`),
            inArray(signalPerformance.coinSymbol, [...TRACKED_COINS])
        ))
        .limit(50);

    for (const row of need30d) {
        try {
            const priceResult = await getPriceWithFallback(row.coinSymbol);
            if (!priceResult) continue;
            const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
            const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
            const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
            const tradePnl = isBearish ? -pricePnl : pricePnl;
            const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;

            await db.update(signalPerformance).set({
                price30d: priceResult.price,
                pnl30d: tradePnl,
                isWin30d: isWin,
            }).where(eq(signalPerformance.id, row.id));
        } catch (err) {
            logger.warn('[SignalPerf] Failed 30d update for signalId=%d: %s', row.id, err instanceof Error ? err.message : String(err));
        }
    }

    logger.info('[SignalPerf] Updated: %d (24h), %d (7d), %d (30d)', need24h.length, need7d.length, need30d.length);
}

export function startSignalPerformanceCron(): void {
    cron.schedule('0 */6 * * *', guardCron('SignalPerformance', updateSignalPerformance));
    logger.info('[SignalPerf] Cron scheduled — every 6 hours');
}
