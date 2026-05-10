import cron from 'node-cron';
import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { eq, inArray } from 'drizzle-orm';
import { TRACKED_COINS } from '../config/coins';
import { detectMarketRegime, type MarketRegime } from '../services/marketRegime.service';
import { getCache, setCache } from '../config/redis';
import { logger } from '../utils/logger';

const REDIS_LAST_RUN_KEY = 'cron:last-regime-run';
const REDIS_CURRENT_REGIME_KEY = 'cron:current-regime';
const CRON_SCHEDULE = '0 */4 * * *';

let isRunning = false;

async function getLastCronRun(): Promise<Date> {
    try {
        const cached = await getCache(REDIS_LAST_RUN_KEY);
        if (cached && typeof cached === 'string') {
            return new Date(cached);
        }
    } catch {}
    return new Date(Date.now() - 4 * 60 * 60 * 1000);
}

async function saveLastCronRun(): Promise<void> {
    try {
        await setCache(REDIS_LAST_RUN_KEY, new Date().toISOString(), 24 * 60 * 60);
    } catch {}
}

async function runRegimeUpdate(): Promise<void> {
    if (isRunning) {
        logger.info('[RegimeCron] Already running. Skipping.');
        return;
    }

    isRunning = true;
    logger.info('[RegimeCron] Starting market regime detection...');

    try {
        const lastRun = await getLastCronRun();
        const regime: MarketRegime = await detectMarketRegime();

        logger.info('[RegimeCron] Detected regime: %s (computed at %s)', regime, new Date().toISOString());

        try {
            await db
                .update(coinIntelligenceCache)
                .set({ currentRegime: regime })
                .where(inArray(coinIntelligenceCache.coinSymbol, [...TRACKED_COINS]));

            logger.info('[RegimeCron] Batch-updated regime for %d coins: %s', TRACKED_COINS.length, regime);
        } catch (err) {
            logger.error('[RegimeCron] Failed to batch-update regime: %s',
                err instanceof Error ? err.message : String(err));
        }

        try {
            await setCache(REDIS_CURRENT_REGIME_KEY, regime, 6 * 60 * 60);
        } catch {}

        await saveLastCronRun();
        logger.info('[RegimeCron] Complete. Regime: %s, Coins: %d', regime, TRACKED_COINS.length);
    } catch (err) {
        logger.error('[RegimeCron] Fatal error: %s', err instanceof Error ? err.message : String(err));
    } finally {
        isRunning = false;
    }
}

export function startRegimeUpdateCron(): void {
    cron.schedule(CRON_SCHEDULE, () => {
        runRegimeUpdate().catch((err) => {
            logger.error('[RegimeCron] Unhandled error: %s', err instanceof Error ? err.message : String(err));
        });
    });

    logger.info('[RegimeCron] Scheduled to run every 4 hours (%s)', CRON_SCHEDULE);
}