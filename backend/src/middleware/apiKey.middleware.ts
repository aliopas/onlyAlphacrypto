import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { apiKeys, users } from '../models/index';
import { eq } from 'drizzle-orm';
import { redis } from '../config/redis';
import { hashKey } from '../utils/crypto';
import { logger } from '../utils/logger';

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export interface ApiKeyRequest extends Request {
    userId?: number;
    plan?: string;
    apiKeyId?: number;
}

export async function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const rawKey = req.headers['x-api-key'] as string | undefined;
    if (!rawKey) {
        res.status(401).json({ error: 'Authentication required. Include X-API-Key header.' });
        return;
    }

    try {
        const keyHash = hashKey(rawKey);

        const [row] = await db
            .select({
                id: apiKeys.id,
                userId: apiKeys.userId,
                rateLimit: apiKeys.rateLimit,
                plan: users.plan,
            })
            .from(apiKeys)
            .innerJoin(users, eq(apiKeys.userId, users.id))
            .where(eq(apiKeys.keyHash, keyHash));

        if (!row) {
            res.status(401).json({ error: 'Authentication required. Invalid or expired API key.' });
            return;
        }

        if (redis) {
            const rlKey = `rl:apikey:${row.id}`;
            const rateLimit = row.rateLimit ?? 100;
            const count = await redis.eval(RATE_LIMIT_LUA, 1, rlKey, '3600') as number;
            if (count > rateLimit) {
                res.status(429).json({ error: 'Rate limit exceeded. Please retry later.', retryAfter: 3600 });
                return;
            }
        }

        db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, row.id))
            .execute()
            .catch((err) => {
                logger.error('[ApiKeyAuth] Failed to update lastUsedAt: %s', err instanceof Error ? err.message : String(err));
            });

        req.userId = row.userId;
        req.plan = row.plan ?? 'free';
        req.apiKeyId = row.id;
        next();
    } catch (err) {
        next(err);
    }
}
