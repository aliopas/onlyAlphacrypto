import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { redis } from '../config/redis';

export async function guestLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (req.userId) {
        next();
        return;
    }

    if (!redis) {
        next();
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
    } catch {
        next();
    }
}
