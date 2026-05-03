import cron from 'node-cron';
import { db } from '../config/db';
import { env } from '../config/env';
import { coinNewsHistory } from '../models/market.model';
import { levelIntelligence, levelInteractions } from '../models/market.model';
import { marketScenarios, scenarioHorizonOutcomes } from '../models/market.model';
import { eq, sql, and, lt } from 'drizzle-orm';

export async function runMonitoringCron(): Promise<void> {
    if (!env.MONITORING_CRON_ENABLED) {
        return;
    }

    try {
        console.log('[MonitoringCron] Starting lightweight health summary...');

        // Row counts only (no heavy queries)
        const [eventHistoryCount] = await db.select({ count: sql`count(*)` }).from(coinNewsHistory);
        const [levelsCount] = await db.select({ count: sql`count(*)` }).from(levelIntelligence);
        const [interactionsCount] = await db.select({ count: sql`count(*)` }).from(levelInteractions);
        const [scenariosCount] = await db.select({ count: sql`count(*)` }).from(marketScenarios);
        const [outcomesCount] = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes);

        // Quick health checks
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [recentLevels] = await db.select({ count: sql`count(*)` }).from(levelIntelligence)
            .where(sql`${levelIntelligence.updatedAt} > ${oneDayAgo}`);

        const [recentScenarios] = await db.select({ count: sql`count(*)` }).from(marketScenarios)
            .where(sql`${marketScenarios.createdAt} > ${oneDayAgo}`);

        const [dueOutcomes] = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes)
            .where(and(eq(scenarioHorizonOutcomes.status, 'pending'), lt(scenarioHorizonOutcomes.dueAt, now)));

        console.log(`[MonitoringCron] Health Summary: Events=${eventHistoryCount.count}, Levels=${levelsCount.count}, Interactions=${interactionsCount.count}, Scenarios=${scenariosCount.count}, Outcomes=${outcomesCount.count}`);
        console.log(`[MonitoringCron] Recent Activity (24h): Levels=${recentLevels.count}, Scenarios=${recentScenarios.count}, Due Outcomes=${dueOutcomes.count}`);

        console.log('[MonitoringCron] Health check completed');
    } catch (error) {
        console.error('[MonitoringCron] Failed:', error instanceof Error ? error.message : String(error));
    }
}

export function startMonitoringCron(): void {
    if (!env.MONITORING_CRON_ENABLED) {
        console.log('[MonitoringCron] Disabled by MONITORING_CRON_ENABLED=false');
        return;
    }

    cron.schedule('0 */6 * * *', () => runMonitoringCron());
    console.log('[MonitoringCron] Scheduled — every 6 hours');
}