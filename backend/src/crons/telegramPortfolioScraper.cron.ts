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
            console.log('[ScorecardScraperCron] Scheduled pipeline starting');
            await runScorecardPipeline();
            console.log('[ScorecardScraperCron] Scheduled pipeline complete');
        } catch (err) {
            console.error('[ScorecardScraperCron] Scheduled pipeline error:', err instanceof Error ? err.message : String(err));
        } finally {
            isRunning = false;
        }
    });

    setTimeout(async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            console.log('[ScorecardScraperCron] === STARTUP RUN — testing pipeline ===');
            await runScorecardPipeline();
            console.log('[ScorecardScraperCron] === STARTUP RUN complete ===');
        } catch (err) {
            console.error('[ScorecardScraperCron] === STARTUP RUN error:', err instanceof Error ? err.message : String(err));
        } finally {
            isRunning = false;
        }
    }, 30_000);

    console.log('[ScorecardScraperCron] Scheduled: daily at midnight + startup run in 30s');
}