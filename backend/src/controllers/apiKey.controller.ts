import { Response, NextFunction } from 'express';
import { db } from '../config/db';
import { apiKeys, users, userWallets, userPreferences } from '../models/index';
import { eq, count } from 'drizzle-orm';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

// How many OG Genesis spots exist
const OG_GENESIS_MAX = 500;

// ── Helper: Hash raw API key ────────────────────────────────────────────────
function hashKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── GET /api/user/me ────────────────────────────────────────────────────────
export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const [user] = await db.select({
            id: users.id,
            email: users.email,
            plan: users.plan,
            isOgGenesis: users.isOgGenesis,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.id, req.userId!));

        if (!user) throw new AppError('User not found', 404);

        const wallets = await db.select().from(userWallets).where(eq(userWallets.userId, req.userId!));
        const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, req.userId!));

        res.json({ ...user, wallets, preferences: prefs ?? null });
    } catch (err) { next(err); }
}

// ── PATCH /api/user/me ──────────────────────────────────────────────────────
export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const {
            emailAlerts, breakingNewsAlerts, airdropDeadlineAlerts, alphaFocusAlerts, preferredCoins
        } = req.body as {
            emailAlerts?: boolean;
            breakingNewsAlerts?: boolean;
            airdropDeadlineAlerts?: boolean;
            alphaFocusAlerts?: boolean;
            preferredCoins?: string[];
        };

        // Upsert: insert if not exists, update if exists
        await db.insert(userPreferences).values({
            userId: req.userId!,
            emailAlerts,
            breakingNewsAlerts,
            airdropDeadlineAlerts,
            alphaFocusAlerts,
            preferredCoins: preferredCoins as string[] | undefined,
        }).onConflictDoUpdate({
            target: userPreferences.userId,
            set: { emailAlerts, breakingNewsAlerts, airdropDeadlineAlerts, alphaFocusAlerts, preferredCoins: preferredCoins as string[] | undefined },
        });

        res.json({ success: true });
    } catch (err) { next(err); }
}

// ── PATCH /api/user/plan ────────────────────────────────────────────────────
export async function upgradePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { plan } = req.body as { plan: string };
        if (!['free', 'pro', 'institutional'].includes(plan)) {
            throw new AppError('Invalid plan. Must be free, pro, or institutional.', 400);
        }

        await db.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, req.userId!));
        res.json({ success: true, plan });
    } catch (err) { next(err); }
}

// ── POST /api/user/api-keys ─────────────────────────────────────────────────
export async function createApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        // Only Pro and Institutional users
        const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, req.userId!));
        if (user?.plan === 'free') throw new AppError('API key generation requires a Pro or Institutional plan.', 403);

        // Max 5 keys per user
        const existingKeys = await db.select().from(apiKeys).where(eq(apiKeys.userId, req.userId!));
        if (existingKeys.length >= 5) throw new AppError('Maximum 5 API keys allowed.', 400);

        const { name } = req.body as { name?: string };
        const rawKey = `onlyalpha_live_${crypto.randomBytes(24).toString('hex')}`;
        const keyHash = hashKey(rawKey);

        const rateLimit = user?.plan === 'institutional' ? 5000 : 500;

        const [created] = await db.insert(apiKeys).values({
            userId: req.userId!,
            keyHash,
            name: name || 'My API Key',
            rateLimit,
        }).returning({ id: apiKeys.id, name: apiKeys.name, rateLimit: apiKeys.rateLimit, createdAt: apiKeys.createdAt });

        // Return the raw key ONCE — it cannot be recovered after this
        res.status(201).json({ ...created, key: rawKey, warning: 'Store this key securely. It will not be shown again.' });
    } catch (err) { next(err); }
}

// ── GET /api/user/api-keys ──────────────────────────────────────────────────
export async function listApiKeys(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const keys = await db.select({
            id: apiKeys.id,
            name: apiKeys.name,
            rateLimit: apiKeys.rateLimit,
            lastUsedAt: apiKeys.lastUsedAt,
            createdAt: apiKeys.createdAt,
        }).from(apiKeys).where(eq(apiKeys.userId, req.userId!));

        res.json(keys);
    } catch (err) { next(err); }
}

// ── DELETE /api/user/api-keys/:id ──────────────────────────────────────────
export async function revokeApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(String(req.params['id']), 10);
        const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));

        if (!key || key.userId !== req.userId) throw new AppError('API key not found', 404);
        await db.delete(apiKeys).where(eq(apiKeys.id, id));
        res.status(204).send();
    } catch (err) { next(err); }
}

// ── OG Genesis Badge check (runs at register) ───────────────────────────────
export async function checkAndGrantOgBadge(userId: number): Promise<void> {
    try {
        const result = await db.select({ value: count() }).from(users);
        const totalUsers = Number(result[0]?.value ?? 0);
        if (totalUsers <= OG_GENESIS_MAX) {
            await db.update(users).set({ isOgGenesis: true }).where(eq(users.id, userId));
        }
    } catch {
        // Non-critical, swallow error
    }
}
