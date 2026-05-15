import cron from 'node-cron';
import {
    processActiveSignals,
    checkExpiredSignals,
    processPartialTpSignals,
    processPartialTp2Signals,
    processDynamicSL,
    processThesisValidation,
} from '../services/signalLifecycle.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const CRON_SCHEDULE_V1 = '*/15 * * * *';
const CRON_SCHEDULE_V2 = '*/2 * * * *';
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

        if (env.LIFECYCLE_V2_ENABLED) {
            await processPartialTpSignals();
            await processPartialTp2Signals();
            await processDynamicSL();
            await processThesisValidation();
        }
    } catch (err) {
        logger.error('[SignalLifecycleCron] Error during lifecycle update:', err);
    } finally {
        isRunning = false;
    }
}

export function startSignalLifecycleCron(): void {
    const schedule = env.LIFECYCLE_V2_ENABLED ? CRON_SCHEDULE_V2 : CRON_SCHEDULE_V1;
    cron.schedule(schedule, async () => {
        await runLifecycleUpdate();
    });
    logger.info(`[SignalLifecycleCron] Scheduled: ${schedule} (SIGNAL_LIFECYCLE_ENABLED=${env.SIGNAL_LIFECYCLE_ENABLED}, LIFECYCLE_V2_ENABLED=${env.LIFECYCLE_V2_ENABLED})`);
}