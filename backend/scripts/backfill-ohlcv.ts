import { TRACKED_COINS } from '../src/config/coins';
import { backfillHistoricalCandles, computeIndicators } from '../src/services/ohlcvSnapshot.service';
import { env } from '../src/config/env';

const BACKFILL_CONFIG = {
    '4h': { daysBack: 90 },     // ~540 candles
    '1d': { daysBack: 180 },    // ~180 candles
    '1w': { daysBack: 365 },    // ~52 candles
} as const;

async function main(): Promise<void> {
    if (!env.BACKFILL_OHLCV_ENABLED) {
        console.log('BACKFILL_OHLCV_ENABLED is not set to true. Exiting.');
        process.exit(0);
    }

    console.log(`[Backfill] Starting OHLCV backfill for ${TRACKED_COINS.length} coins...`);

    for (const coin of TRACKED_COINS) {
        for (const [tf, config] of Object.entries(BACKFILL_CONFIG)) {
            const startTime = Date.now();
            try {
                const count = await backfillHistoricalCandles(coin, tf, config.daysBack);
                await computeIndicators(coin, tf);
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[Backfill] ${coin} ${tf}: ${count} candles backfilled (${duration}s)`);
            } catch (err) {
                console.error(`[Backfill] FAILED ${coin} ${tf}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    console.log('[Backfill] Complete.');
}

main().catch(err => {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
});