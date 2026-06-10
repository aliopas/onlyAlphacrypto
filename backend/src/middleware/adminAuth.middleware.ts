import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env';
import { redis, getSession, setSession, deleteSession } from '../config/redis';
import { logger } from '../utils/logger';

declare global {
    namespace Express {
        interface Request {
            adminEmail?: string;
        }
    }
}

interface AdminSession {
    email: string;
    expiresAt: string;
}

// Fallback in-memory store when Redis is unavailable (backward compatibility)
const fallbackSessions = new Map<string, AdminSession>();

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

interface LoginAttempt {
    count: number;
    blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

function isIpBlocked(ip: string): boolean {
    const entry = loginAttempts.get(ip);
    if (!entry) return false;
    if (Date.now() >= entry.blockedUntil) {
        loginAttempts.delete(ip);
        return false;
    }
    return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
    const entry = loginAttempts.get(ip) ?? { count: 0, blockedUntil: 0 };
    entry.count++;
    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
        entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    }
    loginAttempts.set(ip, entry);
}

function resetLoginAttempts(ip: string): void {
    loginAttempts.delete(ip);
}

function getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? (req.headers['x-real-ip'] as string | undefined)
        ?? req.socket.remoteAddress
        ?? 'unknown';
}

// Session expiry time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = 86400;

// Session cleanup interval (every hour)
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

setInterval(() => {
    cleanupExpiredSessions().catch((err: unknown) => {
        logger.error('[AdminSession] Cleanup error: %s', err instanceof Error ? err.message : String(err));
    });
}, SESSION_CLEANUP_INTERVAL_MS);

// ─── Session Storage ─────────────────────────────────────────────────────────

async function storeSession(token: string, session: AdminSession): Promise<void> {
    if (redis) {
        await setSession(token, session, SESSION_TTL_SECONDS);
    } else {
        fallbackSessions.set(token, session);
    }
}

async function retrieveSession(token: string): Promise<AdminSession | null> {
    if (redis) {
        const data = await getSession<AdminSession>(token);
        if (!data) return null;
        return data;
    }
    return fallbackSessions.get(token) ?? null;
}

async function removeSession(token: string): Promise<void> {
    if (redis) {
        await deleteSession(token);
    } else {
        fallbackSessions.delete(token);
    }
}

// ─── Token Utilities ─────────────────────────────────────────────────────────

function generateSessionToken(): string {
    const payload = crypto.randomBytes(32).toString('hex');
    const signature = crypto
        .createHmac('sha256', env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest('hex');
    return `${payload}.${signature}`;
}

function verifySessionToken(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const expectedSignature = crypto
        .createHmac('sha256', env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
        return false;
    }
}

function extractSessionId(token: string): string | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    return verifySessionToken(token) ? parts[0] : null;
}

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Exported Handlers ───────────────────────────────────────────────────────

export async function cleanupExpiredSessions(): Promise<void> {
    if (redis) {
        try {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'oa:admin:session:*', 'COUNT', 100);
                cursor = nextCursor;
                for (const key of keys) {
                    const ttl = await redis.ttl(key);
                    if (ttl < 0) {
                        await redis.del(key);
                    }
                }
            } while (cursor !== '0');
        } catch (err) {
            logger.error('[AdminSession] Redis cleanup scan failed: %s', err instanceof Error ? err.message : String(err));
        }
    } else {
        const now = new Date();
        for (const [token, session] of fallbackSessions.entries()) {
            const expiresAt = new Date(session.expiresAt);
            if (expiresAt <= now) {
                fallbackSessions.delete(token);
            }
        }
    }
}

export async function adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const clientIp = getClientIp(req);

        if (isIpBlocked(clientIp)) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password required' });
            return;
        }

        if (email !== env.ADMIN_EMAIL) {
            recordFailedAttempt(clientIp);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const passwordHash = env.ADMIN_PASSWORD;
        let isValidPassword = false;

        if (passwordHash.startsWith('$2')) {
            try {
                isValidPassword = await bcrypt.compare(password, passwordHash);
            } catch {
                isValidPassword = false;
            }
        } else {
            isValidPassword = safeCompare(password, passwordHash);
        }

        if (!isValidPassword) {
            recordFailedAttempt(clientIp);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        resetLoginAttempts(clientIp);

        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

        await storeSession(sessionToken, {
            email,
            expiresAt: expiresAt.toISOString(),
        });

        res.json({
            message: 'Login successful',
            sessionToken,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
        next(err);
    }
}

export async function adminLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const token = authHeader.substring(7);
        await removeSession(token);
        res.json({ message: 'Logout successful' });
    } catch (err) {
        next(err);
    }
}

export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const token = authHeader.substring(7);
        const sessionId = extractSessionId(token);

        if (!sessionId) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const session = await retrieveSession(token);
        if (!session) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const expiresAt = new Date(session.expiresAt);
        if (expiresAt <= new Date()) {
            await removeSession(token);
            res.status(404).json({ error: 'Not found' });
            return;
        }

        req.adminEmail = session.email;
        next();
    } catch (err) {
        next(err);
    }
}
