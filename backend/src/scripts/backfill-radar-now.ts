import { backfillRadarSignals } from '../crons/aiWorkflow.cron';
import { db } from '../config/db';
import { radarSignals } from '../models/market.model';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
    const before = await db.select({ total: sql<number>`count(*)::int` }).from(radarSignals);
    console.log(`Radar signals before: ${before[0].total}`);

    const result = await backfillRadarSignals();
    console.log(`Created: ${result.created}`);

    const after = await db.select({ total: sql<number>`count(*)::int` }).from(radarSignals);
    console.log(`Radar signals after: ${after[0].total}`);
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
