import { Request, Response } from 'express';
import { getShadowStats } from '../services/shadowSignals.service';
import { db } from '../config/db';
import { shadowSignals } from '../models/market.model';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * Get shadow mode statistics
 */
export async function getShadowStatsHandler(req: Request, res: Response): Promise<void> {
    try {
        const stats = await getShadowStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shadow stats' });
    }
}

/**
 * Get shadow signals with filtering and pagination
 */
export async function getShadowSignalsHandler(req: Request, res: Response): Promise<void> {
    try {
        const {
            coin,
            agreement,
            status,
            startDate,
            endDate,
            page = '1',
            limit = '50',
        } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100); // Max 100
        const offset = (pageNum - 1) * limitNum;

        let whereConditions = [];

        // Coin filter
        if (coin && typeof coin === 'string') {
            whereConditions.push(eq(shadowSignals.coinSymbol, coin));
        }

        // Agreement filter
        if (agreement !== undefined) {
            const agreementBool = agreement === 'true';
            whereConditions.push(eq(shadowSignals.agreement, agreementBool));
        }

        // Status filter
        if (status && typeof status === 'string') {
            if (status === 'unresolved') {
                whereConditions.push(sql`${shadowSignals.price7d} IS NULL`);
            } else if (status === 'resolved') {
                whereConditions.push(sql`${shadowSignals.price7d} IS NOT NULL`);
            }
        }

        // Date range filter
        if (startDate && typeof startDate === 'string') {
            whereConditions.push(gte(shadowSignals.createdAt, new Date(startDate)));
        }
        if (endDate && typeof endDate === 'string') {
            whereConditions.push(lte(shadowSignals.createdAt, new Date(endDate)));
        }

        // Build query
        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Get total count
        const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(shadowSignals)
            .where(whereClause);

        const total = totalResult[0]?.count || 0;

        // Get paginated results
        const signals = await db
            .select()
            .from(shadowSignals)
            .where(whereClause)
            .orderBy(desc(shadowSignals.createdAt))
            .limit(limitNum)
            .offset(offset);

        res.json({
            signals,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shadow signals' });
    }
}

/**
 * Get a specific shadow signal by ID
 */
export async function getShadowSignalByIdHandler(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const signalId = parseInt(id, 10);

        if (isNaN(signalId)) {
            res.status(400).json({ error: 'Invalid signal ID' });
            return;
        }

        const signals = await db
            .select()
            .from(shadowSignals)
            .where(eq(shadowSignals.id, signalId))
            .limit(1);

        if (signals.length === 0) {
            res.status(404).json({ error: 'Shadow signal not found' });
            return;
        }

        res.json(signals[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shadow signal' });
    }
}