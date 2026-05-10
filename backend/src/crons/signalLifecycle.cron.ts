import cron from 'node-cron';
import { processActiveSignals, checkExpiredSignals, getSignalsByState } from '../services/signalLifecycle.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const CRON_SCHEDULE = '*/15 * * * *';
let isRunning = false;

async function runLifecycleUpdate(): Promise<void> {
    if (!env.SIGNAL_LIFECYCLE_ENABLED) {
        return;
    }

    if (isRunning) {
        logger.info('[SignalLifecycleCron] Already running. Skipping.');
        return;
    }

    isRunning = true;
    logger.info('[SignalLifecycleCron] Starting signal lifecycle check...');

    try {
        await processActiveSignals();
        await checkExpiredSignals();
    } catch (err) {
        logger.error('[SignalLifecycleCron] Error during lifecycle update:', err);
    } finally {
        isRunning = false;
    }
}

export function startSignalLifecycleCron(): void {
    cron.schedule(CRON_SCHEDULE, async () => {
        await runLifecycleUpdate();
    });
    logger.info(`[SignalLifecycleCron] Scheduled: ${CRON_SCHEDULE} (SIGNAL_LIFECYCLE_ENABLED=${env.SIGNAL_LIFECYCLE_ENABLED})`);
}