import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';
import { env } from '../config/env';

type PlanTier = 'free' | 'pro' | 'institutional';

interface RateLimitOptions {
    windowSeconds: number;
    maxRequests: number;
}

export const PLAN_LIMITS: Record<PlanTier, number> = {
    free: 60,
    pro: 500,
    institutional: 5000,
};

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export function rateLimiter(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!redis) {
            if (env.NODE_ENV === 'development') {
                logger.warn('[RateLimit] Redis unavailable — bypassing in development');
                next();
                return;
            }
            logger.error('[RateLimit] Redis unavailable — rejecting request');
            res.status(503).json({ error: 'Service temporarily unavailable' });
            return;
        }

        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `rl:${req.path}:${ip}`;

        try {
            const current = await redis.eval(RATE_LIMIT_LUA, 1, key, String(options.windowSeconds)) as number;

            if (current > options.maxRequests) {
                res.status(429).json({ error: 'Too many requests', retryAfter: options.windowSeconds });
                return;
            }

            res.setHeader('X-RateLimit-Limit', options.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - current));
            next();
        } catch (err) {
            logger.error('[RateLimit] Redis eval error: %s', err instanceof Error ? err.message : String(err));
            next();
        }
    };
}

export function tieredLimiter(windowSeconds = 3600) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!redis || !req.userId) {
            if (!redis) {
                if (env.NODE_ENV === 'development') {
                    logger.warn('[RateLimit] Redis unavailable — bypassing in development');
                    next();
                    return;
                }
                logger.error('[RateLimit] Redis unavailable — rejecting request');
                res.status(503).json({ error: 'Service temporarily unavailable' });
                return;
            }
            next();
            return;
        }

        const plan = (req.userPlan as PlanTier) || 'free';
        const maxRequests = PLAN_LIMITS[plan];
        const key = `rl:tier:${req.userId}`;

        try {
            const current = await redis.eval(RATE_LIMIT_LUA, 1, key, String(windowSeconds)) as number;

            if (current > maxRequests) {
                const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
                res.status(429).json({
                    error: `Rate limit exceeded for ${planName} plan (${maxRequests} req/hr). Upgrade for higher limits.`,
                    limit: maxRequests,
                    retryAfter: windowSeconds,
                    upgradeUrl: '/settings#upgrade',
                });
                return;
            }

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
            res.setHeader('X-RateLimit-Plan', plan);
            next();
        } catch (err) {
            logger.error('[TieredLimit] Redis eval error: %s', err instanceof Error ? err.message : String(err));
            next();
        }
    };
}

export const apiLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 60 });
export const chatLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 5 });
export const authLimiter = rateLimiter({ windowSeconds: 900, maxRequests: 10 });
