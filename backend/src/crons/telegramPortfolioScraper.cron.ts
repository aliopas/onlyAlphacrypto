import cron from 'node-cron';
import { env } from '../config/env';
import { runScorecardPipeline } from '../services/scorecardPipeline.service';

let isRunning = false;

export function startTelegramPortfolioScraperCron(): void {
    if (!env.SCORECARD_SCRAPER_ENABLED) {
        return;
    }

    cron.schedule('0 0 * * *', async () => {
        if (isRunning) {
            console.log('[ScorecardScraperCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            console.log('[ScorecardScraperCron] Pipeline starting');
            await runScorecardPipeline();
            console.log('[ScorecardScraperCron] Pipeline complete');
        } catch (err) {
            console.error('[ScorecardScraperCron] Pipeline error:', err instanceof Error ? err.message : String(err));
        } finally {
            isRunning = false;
        }
    });

    console.log('[ScorecardScraperCron] Scheduled: daily at midnight');
}