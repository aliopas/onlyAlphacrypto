import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { fetchAndStoreCandles, computeIndicators } from '../services/ohlcvSnapshot.service';
import { TRACKED_COINS } from '../config/coins';

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'] as const;
const CANDLE_LIMITS: Record<string, number> = { '15m': 5, '1h': 5, '4h': 5, '1d': 2, '1w': 2 };

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

export async function runOhlcvSnapshotHigherTf(): Promise<void> {
    if (!env.OHLCV_SNAPSHOT_ENABLED) return;

    const higherTfs = ['1h'] as const;
    for (const coin of TRACKED_COINS) {
        for (const tf of higherTfs) {
            try {
                const stored = await fetchAndStoreCandles(coin, tf, CANDLE_LIMITS[tf]);
                await computeIndicators(coin, tf);
                logger.info('[OHLCV] Updated %s %s: %d candles, indicators computed', coin, tf, stored);
            } catch (err) {
                logger.error('[OHLCV] Failed for %s %s: %s', coin, tf, err instanceof Error ? err.message : String(err));
            }
        }
    }
}

export async function runOhlcvSnapshot15m(): Promise<void> {
    if (!env.OHLCV_SNAPSHOT_ENABLED) return;

    for (const coin of TRACKED_COINS) {
        try {
            const stored = await fetchAndStoreCandles(coin, '15m', CANDLE_LIMITS['15m']);
            await computeIndicators(coin, '15m');
            logger.info('[OHLCV] Updated %s 15m: %d candles, indicators computed', coin, stored);
        } catch (err) {
            logger.error('[OHLCV] Failed for %s 15m: %s', coin, err instanceof Error ? err.message : String(err));
        }
    }
}

export function startOhlcvSnapshotCron(): void {
    cron.schedule('0 */4 * * *', () => {
        runOhlcvSnapshot().catch(err =>
            logger.error('[OHLCV] 4h snapshot failed: %s', err instanceof Error ? err.message : String(err))
        );
    });
    logger.info('[OHLCV] Snapshot cron scheduled — every 4 hours');

    cron.schedule('0 * * * *', () => {
        runOhlcvSnapshotHigherTf().catch(err =>
            logger.error('[OHLCV] 1h snapshot failed: %s', err instanceof Error ? err.message : String(err))
        );
    });
    logger.info('[OHLCV] 1h snapshot cron scheduled — every hour');

    cron.schedule('*/15 * * * *', () => {
        runOhlcvSnapshot15m().catch(err =>
            logger.error('[OHLCV] 15m snapshot failed: %s', err instanceof Error ? err.message : String(err))
        );
    });
    logger.info('[OHLCV] 15m snapshot cron scheduled — every 15 minutes');

    runOhlcvSnapshot().catch(err =>
        logger.error('[OHLCV] Initial 4h snapshot failed: %s', err instanceof Error ? err.message : String(err))
    );
    runOhlcvSnapshotHigherTf().catch(err =>
        logger.error('[OHLCV] Initial 1h snapshot failed: %s', err instanceof Error ? err.message : String(err))
    );
    runOhlcvSnapshot15m().catch(err =>
        logger.error('[OHLCV] Initial 15m snapshot failed: %s', err instanceof Error ? err.message : String(err))
    );
}