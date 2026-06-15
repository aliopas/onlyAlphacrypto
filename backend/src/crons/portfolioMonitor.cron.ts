import cron from 'node-cron';
import { env } from '../config/env';
import { runPortfolioMonitor } from '../services/portfolioMonitor.service';

let isRunning = false;

export function startPortfolioMonitorCron(): void {
    if (!env.SCORECARD_MONITOR_ENABLED) {
        console.log('[PortfolioMonitorCron] Disabled via SCORECARD_MONITOR_ENABLED');
        return;
    }

    cron.schedule('0 * * * *', async () => {
        if (isRunning) {
            console.log('[PortfolioMonitorCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            console.log('[PortfolioMonitorCron] Running portfolio monitor');
            const result = await runPortfolioMonitor();
            console.log(
                `[PortfolioMonitorCron] Done — ` +
                `evaluated:${result.evaluated} closed:${result.closed} tpHits:${result.tpHits} ` +
                `drawdown:${result.drawdownPercent.toFixed(2)}% paused:${result.paused}`
            );
        } catch (err) {
            console.error('[PortfolioMonitorCron] Error:', err instanceof Error ? err.message : String(err));
        } finally {
            isRunning = false;
        }
    });

    console.log('[PortfolioMonitorCron] Scheduled: hourly');
}
