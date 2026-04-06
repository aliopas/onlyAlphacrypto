import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error: %s', err.message));
}

export { redis };

export async function getCache<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    } catch (err) {
        logger.error('[Cache] Failed to parse cache key "%s": %s', key, err instanceof Error ? err.message : String(err));
        try { await redis.del(key); } catch {}
        return null;
    }
}

export async function setCache(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis) return;
    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        logger.error('[Cache] Failed to set cache key "%s": %s', key, err instanceof Error ? err.message : String(err));
    }
}

export async function deleteCache(key: string): Promise<void> {
    if (!redis) return;
    try {
        await redis.del(key);
    } catch (err) {
        logger.error('[Cache] Failed to delete cache key "%s": %s', key, err instanceof Error ? err.message : String(err));
    }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
    if (!redis) return;
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
    } catch (err) {
        logger.error('[Cache] Failed to delete cache pattern "%s": %s', pattern, err instanceof Error ? err.message : String(err));
    }
}
