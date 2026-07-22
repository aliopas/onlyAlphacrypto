import cron from 'node-cron';
import { env } from '../config/env';
import { runAirdropGatePipeline } from '../services/airdropGatePipeline.service';
import { logger } from '../utils/logger';

let isRunning = false;

export function startAirdropGatePipelineCron(): void {
    if (!env.AIRDROP_INTELLIGENCE_ENABLED) {
        logger.info(
            '[AirdropGatePipelineCron] Disabled (AIRDROP_INTELLIGENCE_ENABLED=%s)',
            String(env.AIRDROP_INTELLIGENCE_ENABLED)
        );
        return;
    }

    // After signal ingest (:20), run gates at :35 every 2h
    cron.schedule('35 */2 * * *', async () => {
        if (isRunning) {
            logger.info('[AirdropGatePipelineCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            logger.info('[AirdropGatePipelineCron] Running Gate-1/2 + publish rules');
            const result = await runAirdropGatePipeline();
            logger.info(
                '[AirdropGatePipelineCron] Done — auto:%d hold:%d reject:%d',
                result.autoPublish,
                result.holdRecheck,
                result.reject
            );
        } catch (err) {
            logger.error(
                '[AirdropGatePipelineCron] Error: %s',
                err instanceof Error ? err.message : String(err)
            );
        } finally {
            isRunning = false;
        }
    });

    logger.info('[AirdropGatePipelineCron] Scheduled: every 2 hours at :35');
}
