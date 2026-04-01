import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export async function guestLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (req.userId) {
        next();
        return;
    }

    if (!redis) {
        if (env.NODE_ENV === 'development') {
            logger.warn('[GuestLimit] Redis unavailable — bypassing in development');
            next();
            return;
        }
        logger.error('[GuestLimit] Redis unavailable — rejecting request');
        res.status(503).json({ error: 'Service temporarily unavailable' });
        return;
    }

    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `guest:chat:${ip}`;
        const count = await redis.incr(key);

        if (count === 1) {
            await redis.expire(key, 86400);
        }

        if (count > 3) {
            res.status(429).json({
                error: 'Guest limit reached. Login to continue chatting.',
                remaining: 0,
                loginUrl: '/auth',
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('[GuestLimit] Redis error:', error instanceof Error ? error.message : String(error));
        next();
    }
}
