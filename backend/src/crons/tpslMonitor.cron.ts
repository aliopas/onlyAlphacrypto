import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNotNull, sql, lt, inArray } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';
import { deleteCache } from '../config/redis';
import { TRACKED_COINS } from '../config/coins';

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
                const price = await getPriceWithFallback(signal.coinSymbol);
                if (!price || price.price <= 0) {
                    continue;
                }

                const currentPrice = price.price;
                let closeReason: 'take_profit' | 'stop_loss' | null = null;

                if (signal.verdict === 'BUY' || signal.verdict === 'STRONG_BUY') {
                    if (signal.takeProfitPrice && currentPrice >= signal.takeProfitPrice) {
                        closeReason = 'take_profit';
                    } else if (signal.stopLossPrice && currentPrice <= signal.stopLossPrice) {
                        closeReason = 'stop_loss';
                    }
                } else if (signal.verdict === 'SELL' || signal.verdict === 'STRONG_SELL') {
                    if (signal.takeProfitPrice && currentPrice <= signal.takeProfitPrice) {
                        closeReason = 'take_profit';
                    } else if (signal.stopLossPrice && currentPrice >= signal.stopLossPrice) {
                        closeReason = 'stop_loss';
                    }
                }

                if (closeReason) {
                    const isBearish = signal.verdict === 'SELL' || signal.verdict === 'STRONG_SELL';
                    const rawPnl = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;
                    const realizedPnl = isBearish ? -rawPnl : rawPnl;

                    await db.update(signalPerformance)
                        .set({
                            isActive: false,
                            exitPrice: currentPrice,
                            realizedPnl,
                            closedAt: new Date(),
                            autoClosedReason: closeReason
                        })
                        .where(eq(signalPerformance.id, signal.id));

                    const percentageChange = realizedPnl.toFixed(2);
                    const sign = realizedPnl >= 0 ? '+' : '';
                    console.log(`[TPSL Monitor] Closed signal #${signal.id} for ${signal.coinSymbol}: ${closeReason} hit at $${currentPrice} (${sign}${percentageChange}%)`);

                    await deleteCache('scorecard:latest');
                }
            } catch (err) {
                console.error(`[TPSL Monitor] Failed to process signal #${signal.id} for ${signal.coinSymbol}:`, err instanceof Error ? err.message : String(err));
            }
        }
    } catch (err) {
        console.error('[TPSL Monitor] Failed to fetch active signals:', err instanceof Error ? err.message : String(err));
    }
}

async function expireOldSignals(): Promise<void> {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const oldSignals = await db.select()
            .from(signalPerformance)
            .where(and(
                eq(signalPerformance.isActive, true),
                lt(signalPerformance.entryAt, thirtyDaysAgo)
            ))
            .limit(50);

        for (const signal of oldSignals) {
            try {
                const price = await getPriceWithFallback(signal.coinSymbol);
                const currentPrice = price?.price ?? signal.entryPrice;

                const isBearish = signal.verdict === 'SELL' || signal.verdict === 'STRONG_SELL';
                const rawPnl = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;
                const realizedPnl = isBearish ? -rawPnl : rawPnl;

                await db.update(signalPerformance)
                    .set({
                        isActive: false,
                        exitPrice: currentPrice,
                        realizedPnl,
                        closedAt: new Date(),
                        autoClosedReason: 'time_expiry'
                    })
                    .where(eq(signalPerformance.id, signal.id));

                console.log(`[TPSL Monitor] Expired old signal #${signal.id} for ${signal.coinSymbol} (30+ days) at $${currentPrice}`);

                await deleteCache('scorecard:latest');
            } catch (err) {
                console.error(`[TPSL Monitor] Failed to expire signal #${signal.id} for ${signal.coinSymbol}:`, err instanceof Error ? err.message : String(err));
            }
        }
    } catch (err) {
        console.error('[TPSL Monitor] Failed to fetch old signals for expiry:', err instanceof Error ? err.message : String(err));
    }
}

export function startTpslMonitorCron(): void {
    cron.schedule('*/15 * * * *', async () => {
        await monitorTpsl();
        await expireOldSignals();
    });
}
