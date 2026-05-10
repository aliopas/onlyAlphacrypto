import cron from 'node-cron';
import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { calculateDailyTrend } from '../services/dailyTrend.service';
import { TRACKED_COINS } from '../config/coins';
import { env } from '../config/env';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const CRON_SCHEDULE = '0 */6 * * *';
let isRunning = false;

async function runDailyTrendUpdate(): Promise<void> {
    if (!env.DAILY_TREND_ENABLED) {
        return;
    }

    if (isRunning) {
        logger.info('[DailyTrendCron] Already running. Skipping.');
        return;
    }

    isRunning = true;
    logger.info('[DailyTrendCron] Starting daily trend update...');

    try {
        for (const coin of TRACKED_COINS) {
            try {
                const trend = await calculateDailyTrend(coin);
                await db
                    .update(coinIntelligenceCache)
                    .set({ dailyTrend: trend })
                    .where(eq(coinIntelligenceCache.coinSymbol, coin));

                logger.info(`[DailyTrendCron] ${coin}: ${trend}`);
            } catch (err) {
                logger.warn(`[DailyTrendCron] Failed to update trend for ${coin}:`, err);
            }
        }
    } catch (err) {
        logger.error('[DailyTrendCron] Error during trend update:', err);
    } finally {
        isRunning = false;
    }
}

export function startDailyTrendCron(): void {
    cron.schedule(CRON_SCHEDULE, async () => {
        await runDailyTrendUpdate();
    });
    logger.info(`[DailyTrendCron] Scheduled: ${CRON_SCHEDULE} (DAILY_TREND_ENABLED=${env.DAILY_TREND_ENABLED})`);
}