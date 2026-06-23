import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, lt, inArray, sql } from 'drizzle-orm';
import { getConfirmedClosePrice } from '../services/priceService';
import { autoCloseSignal, type CloseReason } from '../services/signalLifecycle.service';
import { TRACKED_COINS } from '../config/coins';
import { logger } from '../utils/logger';
import { guardCron } from '../utils/cronGuard';

function isBullishVerdict(verdict: string): boolean {
    return verdict === 'BUY' || verdict === 'STRONG_BUY';
}

async function monitorTpsl(): Promise<void> {
    try {
        const activeSignals = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, true),
                sql`(${signalPerformance.takeProfitPrice} IS NOT NULL OR ${signalPerformance.stopLossPrice} IS NOT NULL)`,
                inArray(signalPerformance.coinSymbol, [...TRACKED_COINS])
            ))
            .limit(50);

        for (const signal of activeSignals) {
            try {
                if (!signal.takeProfitPrice || !signal.stopLossPrice || !signal.entryPrice) {
                    continue;
                }

                const confirmed = await getConfirmedClosePrice(signal.coinSymbol);
                if (!confirmed || !confirmed.validated || confirmed.price === null || confirmed.price <= 0) {
                    logger.warn({
                        message: 'TPSL Monitor skipped signal: no validated confirmed price',
                        signalId: signal.id,
                        coinSymbol: signal.coinSymbol,
                        reason: confirmed?.reason ?? 'null confirmed price'
                    });
                    continue;
                }

                const currentPrice = confirmed.price;
                const isBullish = isBullishVerdict(signal.verdict);

                const tpHit = isBullish
                    ? currentPrice >= signal.takeProfitPrice
                    : currentPrice <= signal.takeProfitPrice;

                const slHit = isBullish
                    ? currentPrice <= signal.stopLossPrice
                    : currentPrice >= signal.stopLossPrice;

                if (tpHit || slHit) {
                    const reason: CloseReason = tpHit ? 'TP_HIT' : 'SL_HIT';
                    await autoCloseSignal(signal.id, reason, confirmed);
                }
            } catch (err) {
                logger.error(`[TPSL Monitor] Failed to process signal #${signal.id} for ${signal.coinSymbol}:`, err instanceof Error ? err.message : String(err));
            }
        }
    } catch (err) {
        logger.error('[TPSL Monitor] Failed to fetch active signals:', err instanceof Error ? err.message : String(err));
    }
}

async function expireOldSignals(): Promise<void> {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const oldSignals = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, true),
                lt(signalPerformance.entryAt, thirtyDaysAgo),
                inArray(signalPerformance.coinSymbol, [...TRACKED_COINS])
            ))
            .limit(50);

        for (const signal of oldSignals) {
            try {
                const confirmed = await getConfirmedClosePrice(signal.coinSymbol);
                if (!confirmed || !confirmed.validated || confirmed.price === null || confirmed.price <= 0) {
                    logger.warn({
                        message: 'TPSL Monitor skipped expiry: no validated confirmed price',
                        signalId: signal.id,
                        coinSymbol: signal.coinSymbol,
                        reason: confirmed?.reason ?? 'null confirmed price'
                    });
                    continue;
                }

                await autoCloseSignal(signal.id, 'EXPIRED', confirmed);
            } catch (err) {
                logger.error(`[TPSL Monitor] Failed to expire signal #${signal.id} for ${signal.coinSymbol}:`, err instanceof Error ? err.message : String(err));
            }
        }
    } catch (err) {
        logger.error('[TPSL Monitor] Failed to fetch old signals for expiry:', err instanceof Error ? err.message : String(err));
    }
}

export function startTpslMonitorCron(): void {
    // Every 15 minutes. Guarded so a slow price-fetch run cannot overlap the next tick —
    // important because autoCloseSignal is now idempotent, but we still avoid double work.
    cron.schedule('*/15 * * * *', guardCron('TpslMonitor', async () => {
        await monitorTpsl();
        await expireOldSignals();
    }));
}
