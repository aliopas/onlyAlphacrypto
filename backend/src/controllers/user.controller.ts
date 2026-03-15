import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { users, userWallets } from '../models/index';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkAndGrantOgBadge } from './apiKey.controller';

// POST /api/auth/register
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { email, password } = req.body as { email: string; password: string };
        if (!email || !password) throw new AppError('Email and password required', 400);

        const existing = await db.select().from(users).where(eq(users.email, email));
        if (existing.length) throw new AppError('Email already registered', 409);

        const passwordHash = await bcrypt.hash(password, 12);
        const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email, plan: users.plan });

        // Grant OG Genesis badge to first 500 users (non-blocking)
        checkAndGrantOgBadge(user.id).catch(() => { });

        const token = jwt.sign({ userId: user.id, plan: user.plan }, env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user });
    } catch (err) { next(err); }
}

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { email, password } = req.body as { email: string; password: string };
        if (!email || !password) throw new AppError('Email and password required', 400);

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user || !user.passwordHash) throw new AppError('Invalid credentials', 401);

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new AppError('Invalid credentials', 401);

        const token = jwt.sign({ userId: user.id, plan: user.plan }, env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } });
    } catch (err) { next(err); }
}

// GET /api/user/wallets  (requires auth)
export async function getWallets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const wallets = await db.select().from(userWallets).where(eq(userWallets.userId, req.userId!));
        res.json(wallets);
    } catch (err) { next(err); }
}

// POST /api/user/wallets  (requires auth)
export async function addWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { address, label, chains } = req.body as { address: string; label?: string; chains?: string[] };
        if (!address) throw new AppError('Wallet address is required', 400);

        // Max 10 wallets
        const existing = await db.select().from(userWallets).where(eq(userWallets.userId, req.userId!));
        if (existing.length >= 10) throw new AppError('Maximum 10 wallets allowed', 400);

        const [wallet] = await db.insert(userWallets).values({
            userId: req.userId!,
            address: address.toLowerCase(),
            label,
            chains: chains as string[] | undefined,
        }).returning();

        res.status(201).json(wallet);
    } catch (err) { next(err); }
}

// DELETE /api/user/wallets/:id  (requires auth)
export async function deleteWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(String(req.params['id']), 10);
        const [wallet] = await db.select().from(userWallets).where(eq(userWallets.id, id));
        if (!wallet || wallet.userId !== req.userId) throw new AppError('Wallet not found', 404);

        await db.delete(userWallets).where(eq(userWallets.id, id));
        res.status(204).send();
    } catch (err) { next(err); }
}
