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
const sessions = new Map<string, AdminSession>();

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
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
    }

    // Validate email
    if (email !== env.ADMIN_EMAIL) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    // Compare password against stored hash
    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, env.ADMIN_PASSWORD);
    } catch {
        // If comparison fails (e.g., not a valid hash), fall back to direct comparison
        // This handles the case where ADMIN_PASSWORD might be stored in different formats
        isValidPassword = password === env.ADMIN_PASSWORD;
    }

    if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

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