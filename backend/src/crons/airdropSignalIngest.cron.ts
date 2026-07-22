import cron from 'node-cron';
import { env } from '../config/env';
import { runAirdropSignalIngest } from '../services/airdropSignalIngest.service';
import { logger } from '../utils/logger';

let isRunning = false;

export function startAirdropSignalIngestCron(): void {
    if (!env.AIRDROP_INTELLIGENCE_ENABLED || !env.AIRDROP_INTELLIGENCE_INGEST_ENABLED) {
        logger.info(
            '[AirdropSignalIngestCron] Disabled (AIRDROP_INTELLIGENCE_ENABLED=%s AIRDROP_INTELLIGENCE_INGEST_ENABLED=%s)',
            String(env.AIRDROP_INTELLIGENCE_ENABLED),
            String(env.AIRDROP_INTELLIGENCE_INGEST_ENABLED)
        );
        return;
    }

    cron.schedule('20 */2 * * *', async () => {
        if (isRunning) {
            logger.info('[AirdropSignalIngestCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            logger.info('[AirdropSignalIngestCron] Running unified airdrop signal ingest');
            const result = await runAirdropSignalIngest();
            logger.info(
                '[AirdropSignalIngestCron] Done — tgAlpha:%d tgCommunity:%d rss:%d mood:%d',
                result.telegramAlpha.inserted,
                result.telegramCommunity.inserted,
                result.rssAlpha.inserted,
                result.mood.snapshotsWritten
            );
        } catch (err) {
            logger.error(
                '[AirdropSignalIngestCron] Error: %s',
                err instanceof Error ? err.message : String(err)
            );
        } finally {
            isRunning = false;
        }
    });

    logger.info('[AirdropSignalIngestCron] Scheduled: every 2 hours at :20');
}
