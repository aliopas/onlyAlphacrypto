import { Response, NextFunction } from 'express';
import { db } from '../config/db';
import { apiKeys, users, userWallets, userPreferences } from '../models/index';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { hashKey, sanitizeString } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

const OG_GENESIS_MAX = 500;

const updatePrefsSchema = z.object({
    emailAlerts: z.boolean().optional(),
    breakingNewsAlerts: z.boolean().optional(),
    airdropDeadlineAlerts: z.boolean().optional(),
    alphaFocusAlerts: z.boolean().optional(),
    preferredCoins: z.array(z.string()).max(20).optional(),
});

const upgradePlanSchema = z.object({
    plan: z.enum(['free', 'pro', 'institutional']),
});

const createApiKeySchema = z.object({
    name: z.string().max(100).optional(),
});

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const [user] = await db.select({
            id: users.id,
            email: users.email,
            plan: users.plan,
            isOgGenesis: users.isOgGenesis,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.id, userId));

        if (!user) throw new AppError('User not found', 404);

        const wallets = await db.select().from(userWallets).where(eq(userWallets.userId, userId));
        const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

        res.json({ ...user, wallets, preferences: prefs ?? null });
    } catch (err) { next(err); }
}

export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const parsed = updatePrefsSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { emailAlerts, breakingNewsAlerts, airdropDeadlineAlerts, alphaFocusAlerts, preferredCoins } = parsed.data;

        await db.insert(userPreferences).values({
            userId,
            emailAlerts,
            breakingNewsAlerts,
            airdropDeadlineAlerts,
            alphaFocusAlerts,
            preferredCoins,
        }).onConflictDoUpdate({
            target: userPreferences.userId,
            set: { emailAlerts, breakingNewsAlerts, airdropDeadlineAlerts, alphaFocusAlerts, preferredCoins },
        });

        res.json({ success: true });
    } catch (err) { next(err); }
}

export async function upgradePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const parsed = upgradePlanSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { plan } = parsed.data;

        if (plan !== 'free') {
            throw new AppError('Plan upgrades require payment. Please use the checkout flow.', 403);
        }

        await db.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, userId));
        res.json({ success: true, plan });
    } catch (err) { next(err); }
}

export async function createApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
        if (user?.plan === 'free') throw new AppError('API key generation requires a Pro or Institutional plan.', 403);

        const parsed = createApiKeySchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { count: keyCount } = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(apiKeys)
            .where(eq(apiKeys.userId, userId))
            .then(rows => rows[0]);
        if ((keyCount ?? 0) >= 5) throw new AppError('Maximum 5 API keys allowed.', 400);

        const rawName = parsed.data.name || 'My API Key';
        const cleanName = sanitizeString(rawName, 100);

        const { randomBytes } = await import('crypto');
        const rawKey = `onlyalpha_live_${randomBytes(24).toString('hex')}`;
        const keyHash = hashKey(rawKey);

        const rateLimit = user?.plan === 'institutional' ? 5000 : 500;

        const [created] = await db.insert(apiKeys).values({
            userId,
            keyHash,
            name: cleanName,
            rateLimit,
        }).returning({ id: apiKeys.id, name: apiKeys.name, rateLimit: apiKeys.rateLimit, createdAt: apiKeys.createdAt });

        res.status(201).json({ ...created, key: rawKey, warning: 'Store this key securely. It will not be shown again.' });
    } catch (err) { next(err); }
}

export async function listApiKeys(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const keys = await db.select({
            id: apiKeys.id,
            name: apiKeys.name,
            rateLimit: apiKeys.rateLimit,
            lastUsedAt: apiKeys.lastUsedAt,
            createdAt: apiKeys.createdAt,
        }).from(apiKeys).where(eq(apiKeys.userId, userId));

        res.json(keys);
    } catch (err) { next(err); }
}

export async function revokeApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const idParam = String(req.params['id']);
        const id = parseInt(idParam, 10);
        if (isNaN(id)) throw new AppError('Invalid key ID', 400);

        const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
        if (!key || key.userId !== userId) throw new AppError('API key not found', 404);

        await db.delete(apiKeys).where(eq(apiKeys.id, id));
        res.status(204).send();
    } catch (err) { next(err); }
}

export async function checkAndGrantOgBadge(userId: number): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            const [result] = await tx
                .select({ value: sql<number>`count(*)::int` })
                .from(users)
                .for('share');

            const totalUsers = result?.value ?? 0;
            if (totalUsers <= OG_GENESIS_MAX) {
                await tx.update(users).set({ isOgGenesis: true }).where(eq(users.id, userId));
            }
        });
    } catch {
        // Non-critical, swallow error
    }
}
