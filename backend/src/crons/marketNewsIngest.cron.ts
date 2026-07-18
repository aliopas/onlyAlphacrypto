import cron from 'node-cron';
import { env } from '../config/env';
import { runMarketNewsIngest } from '../services/marketNews.service';
import { logger } from '../utils/logger';

let isRunning = false;

export function startMarketNewsIngestCron(): void {
    if (!env.MARKET_CONTEXT_ENABLED || !env.MARKET_CONTEXT_INGEST_ENABLED) {
        logger.info(
            '[MarketNewsIngestCron] Disabled (MARKET_CONTEXT_ENABLED=%s MARKET_CONTEXT_INGEST_ENABLED=%s)',
            String(env.MARKET_CONTEXT_ENABLED),
            String(env.MARKET_CONTEXT_INGEST_ENABLED)
        );
        return;
    }

    cron.schedule('15 */2 * * *', async () => {
        if (isRunning) {
            logger.info('[MarketNewsIngestCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            logger.info('[MarketNewsIngestCron] Running market news ingest');
            const result = await runMarketNewsIngest();
            logger.info(
                '[MarketNewsIngestCron] Done — terminal:%d rss:%d telegram:%d',
                result.terminal.inserted,
                result.rss.inserted,
                result.telegram.inserted
            );
        } catch (err) {
            logger.error(
                '[MarketNewsIngestCron] Error: %s',
                err instanceof Error ? err.message : String(err)
            );
        } finally {
            isRunning = false;
        }
    });

    logger.info('[MarketNewsIngestCron] Scheduled: every 2 hours at :15');
}
