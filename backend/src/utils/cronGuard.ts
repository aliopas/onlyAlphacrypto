import { redis } from '../config/redis';
import { logger } from './logger';

/**
 * In-process concurrency guard for cron jobs.
 *
 * Returns true if the caller may proceed (no other instance of this cron is running
 * in this process), false if a previous run is still in flight. The matching
 * `releaseInProcessGuard` MUST be called in a finally block.
 *
 * This only protects within a single Node.js process. For cross-instance protection
 * use `withRedisMutex` below.
 */
const inProcessRunning = new Set<string>();

export function acquireInProcessGuard(name: string): boolean {
    if (inProcessRunning.has(name)) {
        logger.info('[CronGuard] %s already running in-process — skipping this tick.', name);
        return false;
    }
    inProcessRunning.add(name);
    return true;
}

export function releaseInProcessGuard(name: string): void {
    inProcessRunning.delete(name);
}

/**
 * Wrap a cron handler with an in-process concurrency guard + structured error logging.
 *
 * Usage:
 *   cron.schedule('<crontab expr>', guardCron('TerminalEngine', runTerminalEngine));
 */
export function guardCron(name: string, fn: () => Promise<void>): () => Promise<void> {
    return async () => {
        if (!acquireInProcessGuard(name)) return;
        const startedAt = Date.now();
        try {
            await fn();
        } catch (err) {
            logger.error('[CronGuard] %s failed: %s', name, err instanceof Error ? err.message : String(err));
        } finally {
            releaseInProcessGuard(name);
            const durationMs = Date.now() - startedAt;
            if (durationMs > 5 * 60 * 1000) {
                logger.warn('[CronGuard] %s took %dms (>5min) — consider reviewing.', name, durationMs);
            }
        }
    };
}

/**
 * Cross-instance Redis mutex. Returns true if the lock was acquired.
 *
 * Pattern: SET key value EX ttl NX. Caller is responsible for releasing in a finally block
 * via `releaseRedisMutex`. If Redis is unavailable, returns true (degrades to in-process-only
 * protection) so a single-instance deploy is not blocked.
 */
export async function acquireRedisMutex(key: string, ttlSeconds: number, holder: string = '1'): Promise<boolean> {
    if (!redis) return true;
    try {
        const acquired = await redis.set(key, holder, 'EX', ttlSeconds, 'NX');
        return acquired === 'OK';
    } catch (err) {
        logger.warn('[CronGuard] Redis mutex acquire failed for %s: %s — falling back to in-process guard.', key, err instanceof Error ? err.message : String(err));
        return true;
    }
}

export async function releaseRedisMutex(key: string, holder: string = '1'): Promise<void> {
    if (!redis) return;
    try {
        // Only release if we still own it (avoid releasing a lock re-acquired by another instance
        // after our TTL expired). Lua script: GET → compare → DEL atomically.
        const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
        await redis.eval(script, 1, key, holder);
    } catch (err) {
        logger.warn('[CronGuard] Redis mutex release failed for %s: %s', key, err instanceof Error ? err.message : String(err));
    }
}

/**
 * Full protection: in-process guard + Redis mutex. Use for crons that must not overlap
 * across instances AND within an instance (heavy jobs like aiWorkflow, terminalEngine).
 *
 * Usage:
 *   cron.schedule('0 * * * *', () => { void guardedCronRun('AiWorkflow', 900, runAiWorkflow); });
 */
export async function guardedCronRun(name: string, mutexTtlSeconds: number, fn: () => Promise<void>): Promise<void> {
    if (!acquireInProcessGuard(name)) return;
    const lockKey = `cron:${name.toLowerCase()}:lock`;
    const holder = `${process.pid}-${Date.now()}`;
    const mutexAcquired = await acquireRedisMutex(lockKey, mutexTtlSeconds, holder);
    if (!mutexAcquired) {
        logger.info('[CronGuard] %s mutex held by another instance — skipping.', name);
        releaseInProcessGuard(name);
        return;
    }
    const startedAt = Date.now();
    try {
        await fn();
    } catch (err) {
        logger.error('[CronGuard] %s failed: %s', name, err instanceof Error ? err.message : String(err));
    } finally {
        await releaseRedisMutex(lockKey, holder);
        releaseInProcessGuard(name);
        const durationMs = Date.now() - startedAt;
        if (durationMs > 5 * 60 * 1000) {
            logger.warn('[CronGuard] %s took %dms (>5min) — consider reviewing.', name, durationMs);
        }
    }
}
