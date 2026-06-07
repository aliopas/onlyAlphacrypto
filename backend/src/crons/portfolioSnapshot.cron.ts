import cron from 'node-cron';
import { env } from '../config/env';
import { createDailySnapshot } from '../services/portfolioSnapshot.service';

let isRunning = false;

export function startPortfolioSnapshotCron(): void {
    if (!env.SCORECARD_SNAPSHOT_ENABLED) {
        return;
    }

    cron.schedule('0 0 * * *', async () => {
        if (isRunning) {
            console.log('[PortfolioSnapshotCron] Previous run still active — skipping');
            return;
        }

        isRunning = true;
        try {
            console.log('[PortfolioSnapshotCron] Creating daily snapshot');
            const result = await createDailySnapshot();
            if (result) {
                console.log(
                    `[PortfolioSnapshotCron] Snapshot created — ` +
                    `value:${result.currentValue.toFixed(2)} pnl:${result.totalPnl.toFixed(2)}%`
                );
            }
        } catch (err) {
            console.error('[PortfolioSnapshotCron] Error:', err instanceof Error ? err.message : String(err));
        } finally {
            isRunning = false;
        }
    });

    console.log('[PortfolioSnapshotCron] Scheduled: daily at midnight');
}