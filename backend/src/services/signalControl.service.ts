import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const PAUSE_KEY = 'oa:signal_generation:paused';
const DEFAULT_TTL_SECONDS = 86400;

export async function isSignalGenerationPaused(): Promise<boolean> {
    if (!redis) return false;
    try {
        const value = await redis.get(PAUSE_KEY);
        return value === '1';
    } catch (err) {
        logger.error('[SignalControl] Failed to check pause status: %s', err instanceof Error ? err.message : String(err));
        return false;
    }
}

export async function pauseSignalGeneration(ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    if (!redis) {
        throw new Error('Redis unavailable — cannot pause signal generation');
    }
    try {
        await redis.setex(PAUSE_KEY, ttlSeconds, '1');
        logger.info('[SignalControl] Signal generation paused for %d seconds', ttlSeconds);
    } catch (err) {
        logger.error('[SignalControl] Failed to pause signal generation: %s', err instanceof Error ? err.message : String(err));
        throw err;
    }
}

export async function resumeSignalGeneration(): Promise<void> {
    if (!redis) {
        throw new Error('Redis unavailable — cannot resume signal generation');
    }
    try {
        await redis.del(PAUSE_KEY);
        logger.info('[SignalControl] Signal generation resumed');
    } catch (err) {
        logger.error('[SignalControl] Failed to resume signal generation: %s', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
