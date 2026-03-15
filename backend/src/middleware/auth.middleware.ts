import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
    userId?: number;
    userPlan?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; plan: string };
        req.userId = decoded.userId;
        req.userPlan = decoded.plan;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Optional auth — doesn't block if no token
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; plan: string };
            req.userId = decoded.userId;
            req.userPlan = decoded.plan;
        } catch {
            // ignore
        }
    }
    next();
}
