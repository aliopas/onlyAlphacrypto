import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env';

declare global {
    namespace Express {
        interface Request {
            adminEmail?: string;
        }
    }
}

interface AdminSession {
    email: string;
    expiresAt: Date;
}

// In-memory session store (not persistent across restarts)
// NOTE: In-memory only — sessions are lost on server restart.
// This is acceptable for Shadow Mode admin dashboard (single user, low traffic).
// TODO: Migrate to Redis-backed sessions when moving to production-grade auth.
// See: Phase 0.5 admin auth redesign in Master Plan.
const sessions = new Map<string, AdminSession>();

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

// Session cleanup interval (every hour)
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Schedule periodic cleanup of expired sessions
setInterval(() => {
    cleanupExpiredSessions();
}, SESSION_CLEANUP_INTERVAL_MS);

/**
 * Generate a secure HMAC-signed session token
 */
function generateSessionToken(): string {
    const payload = crypto.randomBytes(32).toString('hex');
    const signature = crypto
        .createHmac('sha256', env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest('hex');
    return `${payload}.${signature}`;
}

/**
 * Verify a session token
 */
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

/**
 * Extract session ID from token
 */
function extractSessionId(token: string): string | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    return verifySessionToken(token) ? parts[0] : null;
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
        if (session.expiresAt <= now) {
            sessions.delete(sessionId);
        }
    }
}

/**
 * Admin login handler
 */
export async function adminLogin(req: Request, res: Response): Promise<void> {
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

    // Validate email
    if (email !== env.ADMIN_EMAIL) {
        recordFailedAttempt(clientIp);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    // Compare password
    const passwordHash = env.ADMIN_PASSWORD;
    let isValidPassword = false;

    // Check if stored password is a bcrypt hash (starts with $2) or plaintext
    if (passwordHash.startsWith('$2')) {
        // It's a bcrypt hash
        try {
            isValidPassword = await bcrypt.compare(password, passwordHash);
        } catch {
            isValidPassword = false;
        }
    } else {
        // It's plaintext - timing-safe comparison
        isValidPassword = safeCompare(password, passwordHash);
    }

    if (!isValidPassword) {
        recordFailedAttempt(clientIp);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    // Successful login - reset rate limit
    resetLoginAttempts(clientIp);

    // Generate session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

    sessions.set(sessionToken, {
        email,
        expiresAt,
    });

    res.json({
        message: 'Login successful',
        sessionToken,
        expiresAt: expiresAt.toISOString(),
    });
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        // Constant-time comparison to avoid leaking length
        return crypto.timingSafeEqual(bufA, bufA);
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Admin logout handler
 */
export function adminLogout(req: Request, res: Response): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(404).json({ error: 'Not found' });
        return;
    }

    const token = authHeader.substring(7);
    sessions.delete(token);
    res.json({ message: 'Logout successful' });
}

/**
 * Admin authentication middleware
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
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

    const session = sessions.get(token);
    if (!session) {
        res.status(404).json({ error: 'Not found' });
        return;
    }

    // Check if session expired
    if (session.expiresAt <= new Date()) {
        sessions.delete(token);
        res.status(404).json({ error: 'Not found' });
        return;
    }

    // Session is valid, proceed
    req.adminEmail = session.email;
    next();
}