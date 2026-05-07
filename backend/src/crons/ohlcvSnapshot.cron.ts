import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { fetchAndStoreCandles, computeIndicators } from '../services/ohlcvSnapshot.service';
import { TRACKED_COINS } from '../config/coins';

const TIMEFRAMES = ['4h', '1d', '1w'] as const;
const CANDLE_LIMITS: Record<string, number> = { '4h': 5, '1d': 2, '1w': 2 };

export async function runOhlcvSnapshot(): Promise<void> {
    if (!env.OHLCV_SNAPSHOT_ENABLED) return;

    const startTime = Date.now();

    for (const coin of TRACKED_COINS) {
        for (const tf of TIMEFRAMES) {
            try {
                const stored = await fetchAndStoreCandles(coin, tf, CANDLE_LIMITS[tf]);
                await computeIndicators(coin, tf);
                logger.info('[OHLCV] Updated %s %s: %d candles, indicators computed', coin, tf, stored);
            } catch (err) {
                logger.error('[OHLCV] Failed for %s %s: %s', coin, tf, err instanceof Error ? err.message : String(err));
            }
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('[OHLCV] Snapshot complete in %ss — %d coins x %d timeframes', duration, TRACKED_COINS.length, TIMEFRAMES.length);
}

export function startOhlcvSnapshotCron(): void {
    cron.schedule('0 */4 * * *', () => {
        runOhlcvSnapshot().catch(err =>
            logger.error('[OHLCV] Snapshot run failed: %s', err instanceof Error ? err.message : String(err))
        );
    });
    logger.info('[OHLCV] Snapshot cron scheduled — every 4 hours');

    // Run once on startup
    runOhlcvSnapshot().catch(err =>
        logger.error('[OHLCV] Initial snapshot failed: %s', err instanceof Error ? err.message : String(err))
    );
}