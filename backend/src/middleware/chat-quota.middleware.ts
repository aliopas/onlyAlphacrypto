import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';

type PlanTier = 'free' | 'pro' | 'institutional';

const QUOTAS: Record<PlanTier, number> = {
    free: 100,
    pro: 1000,
    institutional: 10000,
};

const QUOTA_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export async function chatQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (!redis || !req.userId) {
        next();
        return;
    }

    const plan = (req.userPlan as PlanTier) || 'free';
    const limit = QUOTAS[plan];
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const key = `quota:chat:${req.userId}:${yearMonth}`;

    try {
        const current = await redis.eval(QUOTA_LUA, 1, key, String(2592000)) as number;
        if (current > limit) {
            const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
            res.status(429).json({
                error: `Monthly chat quota exceeded for ${planName} plan (${limit} messages/month). Upgrade for higher limits.`,
                limit,
                used: current - 1,
                resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0],
                upgradeUrl: '/settings#upgrade',
            });
            return;
        }

        res.setHeader('X-Quota-Limit', limit);
        res.setHeader('X-Quota-Remaining', Math.max(0, limit - current));
        res.setHeader('X-Quota-Plan', plan);
        next();
    } catch (err) {
        logger.error('[ChatQuota] Redis eval error: %s', err instanceof Error ? err.message : String(err));
        next();
    }
}