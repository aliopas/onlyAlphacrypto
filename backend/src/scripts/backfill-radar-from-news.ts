import { backfillRadarSignals } from '../crons/aiWorkflow.cron';

async function main(): Promise<void> {
    console.log('=== Backfill Radar Signals from coinNews ===\n');
    const result = await backfillRadarSignals();
    console.log(`\nDone. Created ${result.created} radar signals.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
