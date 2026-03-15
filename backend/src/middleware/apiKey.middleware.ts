import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { apiKeys, users } from '../models/index';
import { eq } from 'drizzle-orm';
import { redis } from '../config/redis';
import crypto from 'crypto';

export interface ApiKeyRequest extends Request {
    userId?: number;
    plan?: string;
    apiKeyId?: number;
}

// ── Hash helper ─────────────────────────────────────────────────────────────
function hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// ── API Key Auth Middleware ──────────────────────────────────────────────────
// Accepts: X-API-Key: onlyalpha_live_<random>
// Attaches: req.userId, req.plan, req.apiKeyId
export async function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const rawKey = req.headers['x-api-key'] as string | undefined;
    if (!rawKey) {
        res.status(401).json({ error: 'API key required. Include X-API-Key header.' });
        return;
    }

    try {
        const keyHash = hashKey(rawKey);
        const [keyRow] = await db.select({
            id: apiKeys.id,
            userId: apiKeys.userId,
            rateLimit: apiKeys.rateLimit,
        }).from(apiKeys).where(eq(apiKeys.keyHash, keyHash));

        if (!keyRow) {
            res.status(401).json({ error: 'Invalid API key.' });
            return;
        }

        // Enforce this key's own rate limit using Redis
        if (redis) {
            const rlKey = `rl:apikey:${keyRow.id}`;
            const count = await redis.incr(rlKey);
            if (count === 1) await redis.expire(rlKey, 3600);
            if (count > (keyRow.rateLimit ?? 100)) {
                res.status(429).json({ error: 'API key rate limit exceeded.', retryAfter: 3600 });
                return;
            }
        }

        // Look up user plan
        const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, keyRow.userId));

        // Update lastUsedAt asynchronously (don't await to avoid latency)
        db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, keyRow.id))
            .execute()
            .catch(() => { });

        req.userId = keyRow.userId;
        req.plan = user?.plan ?? 'free';
        req.apiKeyId = keyRow.id;
        next();
    } catch (err) {
        next(err);
    }
}
