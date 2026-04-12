import cron from 'node-cron';
import { db } from '../config/db';
import { coinMasterArticles, coinTimelineUpdates } from '../models/index';
import { eq, desc, max } from 'drizzle-orm';
import { getCache, setCache } from '../config/redis';
import { calculateIncrementalConviction, type ConvictionResult } from '../services/conviction.service';
import { logger } from '../utils/logger';

const REDIS_LAST_RUN_KEY = 'cron:last-conviction-run';
const CRON_SCHEDULE = '0 */6 * * *';

let isRunning = false;

async function getLastCronRun(): Promise<Date> {
    try {
        const cached = await getCache(REDIS_LAST_RUN_KEY);
        if (cached && typeof cached === 'string') {
            return new Date(cached);
        }
    } catch {}
    return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

async function saveLastCronRun(): Promise<void> {
    try {
        await setCache(REDIS_LAST_RUN_KEY, new Date().toISOString(), 24 * 60 * 60);
    } catch {}
}

async function runConvictionUpdate(): Promise<void> {
    if (isRunning) {
        logger.info('[ConvictionCron] Already running. Skipping.');
        return;
    }

    isRunning = true;
    logger.info('[ConvictionCron] Starting incremental conviction update...');

    try {
        const masters = await db
            .select({
                id: coinMasterArticles.id,
                coinSymbol: coinMasterArticles.coinSymbol,
                convictionScore: coinMasterArticles.convictionScore,
            })
            .from(coinMasterArticles);

        const lastRun = await getLastCronRun();
        logger.info('[ConvictionCron] Processing %d coins, events since %s', masters.length, lastRun.toISOString());

        let updated = 0;
        let errors = 0;

        for (const master of masters) {
            try {
                const currentScore = master.convictionScore ?? 50;
                const result: ConvictionResult = await calculateIncrementalConviction(
                    master.id,
                    currentScore,
                    lastRun
                );

                await db
                    .update(coinMasterArticles)
                    .set({
                        convictionScore: result.score,
                        posture: result.posture,
                        updatedAt: new Date(),
                    })
                    .where(eq(coinMasterArticles.id, master.id));

                updated++;
                logger.debug('[ConvictionCron] %s: score=%d posture=%s trend=%s',
                    master.coinSymbol, result.score, result.posture, result.trend);
            } catch (err) {
                errors++;
                logger.error('[ConvictionCron] Failed for %s: %s',
                    master.coinSymbol, err instanceof Error ? err.message : String(err));
            }
        }

        await saveLastCronRun();
        logger.info('[ConvictionCron] Complete. Updated: %d, Errors: %d', updated, errors);
    } catch (err) {
        logger.error('[ConvictionCron] Fatal error: %s', err instanceof Error ? err.message : String(err));
    } finally {
        isRunning = false;
    }
}

export function startConvictionUpdateCron(): void {
    cron.schedule(CRON_SCHEDULE, () => {
        runConvictionUpdate().catch((err) => {
            logger.error('[ConvictionCron] Unhandled error: %s', err instanceof Error ? err.message : String(err));
        });
    });

    logger.info('[ConvictionCron] Scheduled to run every 6 hours (%s)', CRON_SCHEDULE);
}
