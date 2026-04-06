import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { users, userWallets } from '../models/index';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { isValidEthereumAddress } from '../utils/crypto';
import { checkAndGrantOgBadge } from './apiKey.controller';

const registerSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(10, 'Password must be at least 10 characters').max(128),
});

const loginSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(1),
});

const addWalletSchema = z.object({
    address: z.string().refine(
        (val) => isValidEthereumAddress(val),
        'Invalid Ethereum wallet address (must be 0x + 40 hex characters)'
    ),
    label: z.string().max(50).optional(),
    chains: z.array(z.string()).max(10).optional(),
});

function generateToken(userId: number, plan: string): string {
    return jwt.sign({ userId, plan }, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { email, password } = parsed.data;

        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
        if (existing) throw new AppError('Email already registered', 409);

        const passwordHash = await bcrypt.hash(password, 12);
        const [user] = await db.insert(users).values({
            email: email.toLowerCase(),
            passwordHash,
        }).returning({ id: users.id, email: users.email, plan: users.plan });

        checkAndGrantOgBadge(user.id).catch(() => {});

        const token = generateToken(user.id, user.plan);
        res.status(201).json({ token, user });
    } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { email, password } = parsed.data;

        const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
        if (!user || !user.passwordHash) throw new AppError('Invalid credentials', 401);

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new AppError('Invalid credentials', 401);

        const token = generateToken(user.id, user.plan);
        res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } });
    } catch (err) { next(err); }
}

export async function getWallets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const wallets = await db.select().from(userWallets).where(eq(userWallets.userId, userId));
        res.json(wallets);
    } catch (err) { next(err); }
}

export async function addWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const parsed = addWalletSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

        const { address, label, chains } = parsed.data;

        const { count: walletCount } = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(userWallets)
            .where(eq(userWallets.userId, userId))
            .then(rows => rows[0]);
        if ((walletCount ?? 0) >= 10) throw new AppError('Maximum 10 wallets allowed', 400);

        const [wallet] = await db.insert(userWallets).values({
            userId,
            address: address.toLowerCase(),
            label,
            chains,
        }).returning();

        res.status(201).json(wallet);
    } catch (err) { next(err); }
}

export async function deleteWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) throw new AppError('Unauthorized', 401);

        const idParam = String(req.params['id']);
        const id = parseInt(idParam, 10);
        if (isNaN(id)) throw new AppError('Invalid wallet ID', 400);

        const [wallet] = await db.select().from(userWallets).where(eq(userWallets.id, id));
        if (!wallet || wallet.userId !== userId) throw new AppError('Wallet not found', 404);

        await db.delete(userWallets).where(eq(userWallets.id, id));
        res.status(204).send();
    } catch (err) { next(err); }
}
