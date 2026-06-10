import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const MAINTENANCE_KEY_PREFIX = 'oa:maintenance:';

export async function isPageInMaintenance(pageKey: string): Promise<boolean> {
    if (!redis) return false;
    try {
        const value = await redis.get(`${MAINTENANCE_KEY_PREFIX}${pageKey}`);
        return value === '1';
    } catch (err) {
        logger.error('[Maintenance] Failed to check status for %s: %s', pageKey, err instanceof Error ? err.message : String(err));
        return false;
    }
}

export async function setMaintenanceMode(pageKey: string, ttlSeconds = 3600): Promise<void> {
    if (!redis) throw new Error('Redis unavailable — cannot enable maintenance mode');
    try {
        await redis.setex(`${MAINTENANCE_KEY_PREFIX}${pageKey}`, ttlSeconds, '1');
        logger.info('[Maintenance] Enabled for %s (%ds)', pageKey, ttlSeconds);
    } catch (err) {
        logger.error('[Maintenance] Failed to enable for %s: %s', pageKey, err instanceof Error ? err.message : String(err));
        throw err;
    }
}

export async function clearMaintenanceMode(pageKey: string): Promise<void> {
    if (!redis) throw new Error('Redis unavailable — cannot clear maintenance mode');
    try {
        await redis.del(`${MAINTENANCE_KEY_PREFIX}${pageKey}`);
        logger.info('[Maintenance] Cleared for %s', pageKey);
    } catch (err) {
        logger.error('[Maintenance] Failed to clear for %s: %s', pageKey, err instanceof Error ? err.message : String(err));
        throw err;
    }
}

export async function getAllMaintenanceFlags(): Promise<Record<string, number>> {
    if (!redis) return {};
    try {
        let cursor = '0';
        const flags: Record<string, number> = {};
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${MAINTENANCE_KEY_PREFIX}*`, 'COUNT', 100);
            cursor = nextCursor;
            for (const key of keys) {
                const pageKey = key.replace(MAINTENANCE_KEY_PREFIX, '');
                const ttl = await redis.ttl(key);
                flags[pageKey] = ttl > 0 ? ttl : 0;
            }
        } while (cursor !== '0');
        return flags;
    } catch (err) {
        logger.error('[Maintenance] Failed to scan flags: %s', err instanceof Error ? err.message : String(err));
        return {};
    }
}
