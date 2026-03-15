import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AuthRequest } from './auth.middleware';

interface RateLimitOptions {
    windowSeconds: number;
    maxRequests: number;
}

// ── Per-plan request limits (requests per hour) ─────────────────────────────
export const PLAN_LIMITS: Record<string, number> = {
    free: 60,
    pro: 500,
    institutional: 5000,
};

// ── Generic rate limiter (IP-based) ─────────────────────────────────────────
export function rateLimiter(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!redis) { next(); return; }

        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `rl:${req.path}:${ip}`;

        const current = await redis.incr(key);
        if (current === 1) await redis.expire(key, options.windowSeconds);

        if (current > options.maxRequests) {
            res.status(429).json({ error: 'Too many requests', retryAfter: options.windowSeconds });
            return;
        }

        res.setHeader('X-RateLimit-Limit', options.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - current));
        next();
    };
}

// ── Tiered rate limiter (plan-aware, per user) ──────────────────────────────
// Reads req.userId and req.plan injected by authMiddleware
export function tieredLimiter(windowSeconds = 3600) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!redis || !req.userId) { next(); return; }

        const plan = (req as any).plan || 'free';
        const maxRequests = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
        const key = `rl:tier:${req.userId}`;

        const current = await redis.incr(key);
        if (current === 1) await redis.expire(key, windowSeconds);

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
    };
}

// ── Pre-configured limiters ──────────────────────────────────────────────────
export const apiLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 60 });
export const chatLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 5 });
export const authLimiter = rateLimiter({ windowSeconds: 900, maxRequests: 10 }); // 15-min
