import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
    });

    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('❌ Redis error:', err));
}

export { redis };

// Helper cache functions
export async function getCache<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis) return;
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
    if (!redis) return;
    await redis.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
    if (!redis) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}
