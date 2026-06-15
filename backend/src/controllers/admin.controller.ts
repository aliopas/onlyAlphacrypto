import { Request, Response } from 'express';
import { getShadowStats } from '../services/shadowSignals.service';
import { logAdminAction } from '../services/adminAudit.service';
import { pauseSignalGeneration, resumeSignalGeneration } from '../services/signalControl.service';
import { isPageInMaintenance, setMaintenanceMode, clearMaintenanceMode, getAllMaintenanceFlags } from '../services/maintenance.service';
import { collectSystemTelemetry } from '../services/telemetry.service';
import { db } from '../config/db';
import { shadowSignals, signalPerformance } from '../models/market.model';
import { portfolioCoins, portfolioTransactions } from '../models/scorecard.model';
import { eq, and, gte, lte, desc, sql, isNull, inArray } from 'drizzle-orm';

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
        const idParam = Array.isArray(id) ? id[0] : id;
        const signalId = parseInt(idParam, 10);

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

function getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? (req.headers['x-real-ip'] as string | undefined)
        ?? req.socket.remoteAddress
        ?? 'unknown';
}

/**
 * Get score records (signal_performance) with filtering and pagination
 */
export async function getScoreRecordsHandler(req: Request, res: Response): Promise<void> {
    try {
        const {
            id,
            coin,
            state,
            startDate,
            endDate,
            includeArchived,
            page = '1',
            limit = '50',
        } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
        const offset = (pageNum - 1) * limitNum;

        const whereConditions = [];

        if (id && typeof id === 'string') {
            const idNum = parseInt(id, 10);
            if (!isNaN(idNum)) {
                whereConditions.push(eq(signalPerformance.id, idNum));
            }
        }

        if (coin && typeof coin === 'string') {
            whereConditions.push(eq(signalPerformance.coinSymbol, coin));
        }

        if (state && typeof state === 'string') {
            whereConditions.push(eq(signalPerformance.signalState, state));
        }

        if (startDate && typeof startDate === 'string') {
            whereConditions.push(gte(signalPerformance.createdAt, new Date(startDate)));
        }
        if (endDate && typeof endDate === 'string') {
            whereConditions.push(lte(signalPerformance.createdAt, new Date(endDate)));
        }

        if (includeArchived !== 'true') {
            whereConditions.push(isNull(signalPerformance.archivedAt));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(signalPerformance)
            .where(whereClause);

        const total = totalResult[0]?.count || 0;

        const records = await db
            .select()
            .from(signalPerformance)
            .where(whereClause)
            .orderBy(desc(signalPerformance.createdAt))
            .limit(limitNum)
            .offset(offset);

        res.json({
            records,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch score records' });
    }
}

/**
 * Bulk archive score records (soft delete)
 */
export async function archiveScoreRecordsHandler(req: Request, res: Response): Promise<void> {
    try {
        const { ids } = req.body;
        const adminEmail = req.adminEmail;

        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'ids array required' });
            return;
        }

        if (ids.length > 1000) {
            res.status(400).json({ error: 'Max 1000 records per archive request' });
            return;
        }

        const now = new Date();

        // Verify all records exist and are not already archived
        const existing = await db
            .select({ id: signalPerformance.id, archivedAt: signalPerformance.archivedAt })
            .from(signalPerformance)
            .where(and(
                inArray(signalPerformance.id, ids),
                isNull(signalPerformance.archivedAt)
            ));

        if (existing.length === 0) {
            res.status(404).json({ error: 'No eligible records found' });
            return;
        }

        const eligibleIds = existing.map(r => r.id);

        await db
            .update(signalPerformance)
            .set({ archivedAt: now })
            .where(inArray(signalPerformance.id, eligibleIds));

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'archive_records',
            targetTable: 'signal_performance',
            targetId: eligibleIds.join(','),
            newValue: { archivedAt: now.toISOString(), count: eligibleIds.length },
            ipAddress: getClientIp(req),
        });

        res.json({
            message: 'Records archived',
            archivedCount: eligibleIds.length,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to archive records' });
    }
}

/**
 * Auto-archive score records older than N days
 */
export async function archiveOldScoreRecordsHandler(req: Request, res: Response): Promise<void> {
    try {
        const days = parseInt(req.query.days as string, 10) || 90;
        const adminEmail = req.adminEmail;

        if (days < 7) {
            res.status(400).json({ error: 'Minimum archive age is 7 days' });
            return;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Count eligible records (cap at 1000)
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(signalPerformance)
            .where(and(
                lte(signalPerformance.createdAt, cutoffDate),
                isNull(signalPerformance.archivedAt)
            ));

        const eligibleCount = countResult[0]?.count || 0;

        if (eligibleCount === 0) {
            res.json({ message: 'No eligible records to archive', archivedCount: 0 });
            return;
        }

        const archiveCount = Math.min(eligibleCount, 1000);
        const now = new Date();

        // Archive up to 1000 oldest records
        await db.execute(sql`
            UPDATE signal_performance
            SET archived_at = ${now}
            WHERE id IN (
                SELECT id FROM signal_performance
                WHERE created_at <= ${cutoffDate}
                  AND archived_at IS NULL
                ORDER BY created_at ASC
                LIMIT 1000
            )
        `);

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'archive_old_records',
            targetTable: 'signal_performance',
            newValue: { days, cutoffDate: cutoffDate.toISOString(), archivedCount: archiveCount },
            ipAddress: getClientIp(req),
        });

        res.json({
            message: 'Old records archived',
            archivedCount: archiveCount,
            days,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to archive old records' });
    }
}

/**
 * Pause signal generation
 */
export async function pauseSignalGenerationHandler(req: Request, res: Response): Promise<void> {
    try {
        const adminEmail = req.adminEmail;
        const { ttl } = req.body;
        const ttlSeconds = typeof ttl === 'number' && ttl > 0 ? ttl : 86400;

        await pauseSignalGeneration(ttlSeconds);

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'pause_signal_generation',
            targetTable: 'redis',
            newValue: { ttlSeconds },
            ipAddress: getClientIp(req),
        });

        res.json({ message: 'Signal generation paused', ttlSeconds });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to pause signal generation';
        res.status(500).json({ error: msg });
    }
}

/**
 * Resume signal generation
 */
export async function resumeSignalGenerationHandler(req: Request, res: Response): Promise<void> {
    try {
        const adminEmail = req.adminEmail;

        await resumeSignalGeneration();

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'resume_signal_generation',
            targetTable: 'redis',
            ipAddress: getClientIp(req),
        });

        res.json({ message: 'Signal generation resumed' });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to resume signal generation';
        res.status(500).json({ error: msg });
    }
}

interface TpRaiseBody {
    takeProfitPrice?: number;
    tp2Price?: number;
    tp3Price?: number;
    stopLossPrice?: number;
}

const MAX_TP_RAISES = 3;

/**
 * Raise TP targets for an active signal
 */
export async function raiseTpHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const signalId = parseInt(idParam, 10);
        if (isNaN(signalId)) {
            res.status(400).json({ error: 'Invalid signal ID' });
            return;
        }

        const body = req.body as TpRaiseBody;
        const adminEmail = req.adminEmail;

        const [signal] = await db
            .select()
            .from(signalPerformance)
            .where(eq(signalPerformance.id, signalId))
            .limit(1);

        if (!signal) {
            res.status(404).json({ error: 'Signal not found' });
            return;
        }

        const eligibleStates = ['ACTIVE', 'PARTIAL_TP', 'PARTIAL_TP2'];
        if (!eligibleStates.includes(signal.signalState ?? '')) {
            res.status(400).json({ error: 'Signal is not active' });
            return;
        }

        const isLong = signal.takeProfitPrice != null
            ? signal.takeProfitPrice > signal.entryPrice
            : (signal.tp2Price ?? 0) > signal.entryPrice;

        const currentLog: unknown = signal.lifecycleActionsLog;
        const logEntries = Array.isArray(currentLog)
            ? currentLog as Array<{ action?: string }>
            : [];
        const tpRaiseCount = logEntries.filter(e => e?.action === 'TP_RAISE').length;

        if (tpRaiseCount >= MAX_TP_RAISES) {
            res.status(400).json({ error: `Maximum ${MAX_TP_RAISES} TP raises exceeded` });
            return;
        }

        const updates: Partial<typeof signalPerformance.$inferInsert> = {};
        const oldValues: Record<string, number | null> = {};
        const newValues: Record<string, number | null> = {};

        const entryPrice = signal.entryPrice;
        const sanityCap = entryPrice * 1.4;
        const sanityFloor = entryPrice * 0.6;

        if (body.takeProfitPrice !== undefined) {
            const newTp = body.takeProfitPrice;
            if (signal.takeProfitPrice != null && isLong && newTp <= signal.takeProfitPrice) {
                res.status(400).json({ error: 'New TP1 must be greater than current TP1' });
                return;
            }
            if (signal.takeProfitPrice != null && !isLong && newTp >= signal.takeProfitPrice) {
                res.status(400).json({ error: 'New TP1 must be less than current TP1' });
                return;
            }
            if (newTp < sanityFloor || newTp > sanityCap) {
                res.status(400).json({ error: 'New TP1 exceeds 40% sanity gate around entry' });
                return;
            }
            updates.takeProfitPrice = newTp;
            oldValues.takeProfitPrice = signal.takeProfitPrice;
            newValues.takeProfitPrice = newTp;
        }

        if (body.tp2Price !== undefined) {
            const newTp2 = body.tp2Price;
            if (signal.tp2Price != null && isLong && newTp2 <= signal.tp2Price) {
                res.status(400).json({ error: 'New TP2 must be greater than current TP2' });
                return;
            }
            if (signal.tp2Price != null && !isLong && newTp2 >= signal.tp2Price) {
                res.status(400).json({ error: 'New TP2 must be less than current TP2' });
                return;
            }
            if (newTp2 < sanityFloor || newTp2 > sanityCap) {
                res.status(400).json({ error: 'New TP2 exceeds 40% sanity gate around entry' });
                return;
            }
            updates.tp2Price = newTp2;
            oldValues.tp2Price = signal.tp2Price;
            newValues.tp2Price = newTp2;
        }

        if (body.tp3Price !== undefined) {
            const newTp3 = body.tp3Price;
            if (signal.tp3Price != null && isLong && newTp3 <= signal.tp3Price) {
                res.status(400).json({ error: 'New TP3 must be greater than current TP3' });
                return;
            }
            if (signal.tp3Price != null && !isLong && newTp3 >= signal.tp3Price) {
                res.status(400).json({ error: 'New TP3 must be less than current TP3' });
                return;
            }
            if (newTp3 < sanityFloor || newTp3 > sanityCap) {
                res.status(400).json({ error: 'New TP3 exceeds 40% sanity gate around entry' });
                return;
            }
            updates.tp3Price = newTp3;
            oldValues.tp3Price = signal.tp3Price;
            newValues.tp3Price = newTp3;
        }

        if (body.stopLossPrice !== undefined) {
            const newSl = body.stopLossPrice;
            if (newSl <= 0) {
                res.status(400).json({ error: 'Invalid stop loss price' });
                return;
            }
            updates.stopLossPrice = newSl;
            oldValues.stopLossPrice = signal.stopLossPrice;
            newValues.stopLossPrice = newSl;
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No target updates provided' });
            return;
        }

        await db
            .update(signalPerformance)
            .set({
                ...updates,
                lifecycleActionsLog: Array.isArray(signal.lifecycleActionsLog)
                    ? [...signal.lifecycleActionsLog, {
                        action: 'TP_RAISE',
                        timestamp: new Date().toISOString(),
                        details: { oldValues, newValues },
                    }]
                    : [{
                        action: 'TP_RAISE',
                        timestamp: new Date().toISOString(),
                        details: { oldValues, newValues },
                    }],
            })
            .where(eq(signalPerformance.id, signalId));

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'raise_tp',
            targetTable: 'signal_performance',
            targetId: String(signalId),
            oldValue: oldValues,
            newValue: newValues,
            ipAddress: getClientIp(req),
        });

        res.json({ message: 'Targets updated', signalId, updates: newValues });
    } catch (error) {
        res.status(500).json({ error: 'Failed to raise targets' });
    }
}

/**
 * Get maintenance status for a page (public endpoint)
 */
export async function getMaintenanceStatusHandler(req: Request, res: Response): Promise<void> {
    try {
        const { page } = req.query;
        const pageKey = typeof page === 'string' ? page : 'home';
        const inMaintenance = await isPageInMaintenance(pageKey);
        res.json({ inMaintenance, pageKey, retryAfter: 300 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check maintenance status' });
    }
}

/**
 * Toggle maintenance mode for a page (admin only)
 */
export async function toggleMaintenanceHandler(req: Request, res: Response): Promise<void> {
    try {
        const { pageKey, enabled, ttlSeconds } = req.body;
        const adminEmail = req.adminEmail;

        if (!pageKey || typeof pageKey !== 'string') {
            res.status(400).json({ error: 'pageKey required' });
            return;
        }

        if (enabled) {
            await setMaintenanceMode(pageKey, typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : 3600);
        } else {
            await clearMaintenanceMode(pageKey);
        }

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: enabled ? 'enable_maintenance' : 'disable_maintenance',
            targetTable: 'redis',
            targetId: pageKey,
            newValue: { enabled, ttlSeconds: typeof ttlSeconds === 'number' ? ttlSeconds : 3600 },
            ipAddress: getClientIp(req),
        });

        res.json({ message: 'Maintenance mode updated', pageKey, enabled });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to toggle maintenance';
        res.status(500).json({ error: msg });
    }
}

/**
 * Get all maintenance flags (admin only)
 */
export async function getAllMaintenanceStatusHandler(req: Request, res: Response): Promise<void> {
    try {
        const flags = await getAllMaintenanceFlags();
        res.json(flags);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch maintenance status' });
    }
}

/**
 * Get system telemetry dashboard data
 */
export async function getTelemetryHandler(req: Request, res: Response): Promise<void> {
    try {
        const telemetry = await collectSystemTelemetry();
        res.json(telemetry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to collect telemetry' });
    }
}

// ─── Portfolio Management ────────────────────────────────────────────────────

import { validateScorecardCoin } from '../services/scorecardValidation.service';
import { calculateScorecardTpsl } from '../services/scorecardTpslCalculator.service';

const PORTFOLIO_STATUSES = ['active', 'watchlist', 'exited'] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

const CLASSIFICATIONS = ['TACTICAL', 'STRATEGIC'] as const;
type Classification = typeof CLASSIFICATIONS[number];

function isPortfolioStatus(value: string): value is PortfolioStatus {
    return PORTFOLIO_STATUSES.includes(value as PortfolioStatus);
}

function isClassification(value: string): value is Classification {
    return CLASSIFICATIONS.includes(value as Classification);
}

export async function getPortfolioCoinsHandler(req: Request, res: Response): Promise<void> {
    try {
        const { status, symbol, page = '1', limit = '50' } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
        const offset = (pageNum - 1) * limitNum;

        const whereConditions = [];

        if (status && typeof status === 'string' && isPortfolioStatus(status)) {
            whereConditions.push(eq(portfolioCoins.status, status));
        }

        if (symbol && typeof symbol === 'string') {
            whereConditions.push(eq(portfolioCoins.symbol, symbol.toUpperCase()));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(portfolioCoins)
            .where(whereClause);

        const total = totalResult[0]?.count || 0;

        const coins = await db
            .select()
            .from(portfolioCoins)
            .where(whereClause)
            .orderBy(desc(portfolioCoins.createdAt))
            .limit(limitNum)
            .offset(offset);

        res.json({
            coins,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error('[AdminPortfolio] Failed to fetch coins:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to fetch portfolio coins' });
    }
}

interface CreatePortfolioCoinBody {
    symbol: string;
    entryPrice: number;
    signalClassification?: string;
    status?: string;
}

export async function createPortfolioCoinHandler(req: Request, res: Response): Promise<void> {
    try {
        const body = req.body as CreatePortfolioCoinBody;
        const adminEmail = req.adminEmail;

        if (!body.symbol || typeof body.symbol !== 'string') {
            res.status(400).json({ error: 'symbol is required' });
            return;
        }

        const symbol = body.symbol.toUpperCase().trim();
        if (!/^[A-Z]{1,10}$/.test(symbol)) {
            res.status(400).json({ error: 'Invalid symbol format' });
            return;
        }

        if (typeof body.entryPrice !== 'number' || body.entryPrice <= 0) {
            res.status(400).json({ error: 'entryPrice must be a positive number' });
            return;
        }

        const classification: Classification = body.signalClassification && isClassification(body.signalClassification)
            ? body.signalClassification
            : 'TACTICAL';

        const status: PortfolioStatus = body.status && isPortfolioStatus(body.status)
            ? body.status
            : 'watchlist';

        const [existing] = await db
            .select({ id: portfolioCoins.id })
            .from(portfolioCoins)
            .where(eq(portfolioCoins.symbol, symbol))
            .limit(1);

        if (existing) {
            res.status(409).json({ error: 'Coin already exists in portfolio' });
            return;
        }

        const validated = await validateScorecardCoin({ symbol, entryPrice: body.entryPrice });
        if (!validated) {
            res.status(400).json({ error: 'Coin failed validation gate' });
            return;
        }

        const tpslResult = await calculateScorecardTpsl({
            symbol: validated.symbol,
            entryPrice: validated.entryPrice,
            classification,
        });

        if (tpslResult.isRejected) {
            res.status(400).json({ error: 'Coin rejected by TP/SL filter', reason: tpslResult.rejectionReason });
            return;
        }

        const inserted = await db.insert(portfolioCoins).values({
            symbol: validated.symbol,
            entryPrice: String(validated.entryPrice),
            currentPrice: String(validated.currentPrice),
            priceMovementAtEntry: String(validated.priceMovement),
            status,
            signalClassification: classification,
            cexListings: validated.cexListings,
            allocatedBudget: String(tpslResult.allocatedBudget),
            tp1: String(tpslResult.tp1),
            tp2: String(tpslResult.tp2),
            tp3: String(tpslResult.tp3),
            stopLoss: String(tpslResult.stopLoss),
            qualityScore: Math.round(tpslResult.rr * 20),
        } as typeof portfolioCoins.$inferInsert).returning({ id: portfolioCoins.id });

        const coinId = inserted[0]?.id;
        if (!coinId) {
            res.status(500).json({ error: 'Failed to insert coin' });
            return;
        }

        await db.insert(portfolioTransactions).values({
            coinId,
            type: 'entry',
            price: String(validated.entryPrice),
            amount: String(tpslResult.allocatedBudget),
        } as typeof portfolioTransactions.$inferInsert);

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'create_portfolio_coin',
            targetTable: 'portfolio_coins',
            targetId: String(coinId),
            newValue: {
                symbol: validated.symbol,
                entryPrice: validated.entryPrice,
                status,
                classification,
                allocatedBudget: tpslResult.allocatedBudget,
            },
            ipAddress: getClientIp(req),
        });

        res.status(201).json({
            message: 'Portfolio coin created',
            coinId,
            symbol: validated.symbol,
            status,
            classification,
        });
    } catch (error) {
        console.error('[AdminPortfolio] Failed to create coin:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to create portfolio coin' });
    }
}

interface UpdatePortfolioCoinBody {
    entryPrice?: number;
    tp1?: number;
    tp2?: number;
    tp3?: number;
    stopLoss?: number;
    allocatedBudget?: number;
    status?: string;
    signalClassification?: string;
}

export async function updatePortfolioCoinHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const coinId = parseInt(idParam, 10);
        if (isNaN(coinId)) {
            res.status(400).json({ error: 'Invalid coin ID' });
            return;
        }

        const body = req.body as UpdatePortfolioCoinBody;
        const adminEmail = req.adminEmail;

        const [coin] = await db
            .select()
            .from(portfolioCoins)
            .where(eq(portfolioCoins.id, coinId))
            .limit(1);

        if (!coin) {
            res.status(404).json({ error: 'Coin not found' });
            return;
        }

        if (coin.status === 'exited') {
            res.status(400).json({ error: 'Cannot update an exited coin' });
            return;
        }

        const updates: Partial<typeof portfolioCoins.$inferInsert> = {};
        const oldValues: Record<string, unknown> = {};
        const newValues: Record<string, unknown> = {};

        if (body.entryPrice !== undefined) {
            if (typeof body.entryPrice !== 'number' || body.entryPrice <= 0) {
                res.status(400).json({ error: 'entryPrice must be a positive number' });
                return;
            }
            updates.entryPrice = String(body.entryPrice);
            oldValues.entryPrice = coin.entryPrice;
            newValues.entryPrice = body.entryPrice;
        }

        if (body.tp1 !== undefined) {
            if (typeof body.tp1 !== 'number' || body.tp1 <= 0) {
                res.status(400).json({ error: 'tp1 must be a positive number' });
                return;
            }
            updates.tp1 = String(body.tp1);
            oldValues.tp1 = coin.tp1;
            newValues.tp1 = body.tp1;
        }

        if (body.tp2 !== undefined) {
            if (typeof body.tp2 !== 'number' || body.tp2 <= 0) {
                res.status(400).json({ error: 'tp2 must be a positive number' });
                return;
            }
            updates.tp2 = String(body.tp2);
            oldValues.tp2 = coin.tp2;
            newValues.tp2 = body.tp2;
        }

        if (body.tp3 !== undefined) {
            if (typeof body.tp3 !== 'number' || body.tp3 <= 0) {
                res.status(400).json({ error: 'tp3 must be a positive number' });
                return;
            }
            updates.tp3 = String(body.tp3);
            oldValues.tp3 = coin.tp3;
            newValues.tp3 = body.tp3;
        }

        if (body.stopLoss !== undefined) {
            if (typeof body.stopLoss !== 'number' || body.stopLoss <= 0) {
                res.status(400).json({ error: 'stopLoss must be a positive number' });
                return;
            }
            updates.stopLoss = String(body.stopLoss);
            oldValues.stopLoss = coin.stopLoss;
            newValues.stopLoss = body.stopLoss;
        }

        if (body.allocatedBudget !== undefined) {
            if (typeof body.allocatedBudget !== 'number' || body.allocatedBudget <= 0) {
                res.status(400).json({ error: 'allocatedBudget must be a positive number' });
                return;
            }
            updates.allocatedBudget = String(body.allocatedBudget);
            oldValues.allocatedBudget = coin.allocatedBudget;
            newValues.allocatedBudget = body.allocatedBudget;
        }

        if (body.status !== undefined) {
            if (!isPortfolioStatus(body.status)) {
                res.status(400).json({ error: 'Invalid status' });
                return;
            }
            updates.status = body.status;
            oldValues.status = coin.status;
            newValues.status = body.status;
        }

        if (body.signalClassification !== undefined) {
            if (!isClassification(body.signalClassification)) {
                res.status(400).json({ error: 'Invalid signalClassification' });
                return;
            }
            updates.signalClassification = body.signalClassification;
            oldValues.signalClassification = coin.signalClassification;
            newValues.signalClassification = body.signalClassification;
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid fields provided for update' });
            return;
        }

        updates.updatedAt = new Date();

        await db
            .update(portfolioCoins)
            .set(updates)
            .where(eq(portfolioCoins.id, coinId));

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'update_portfolio_coin',
            targetTable: 'portfolio_coins',
            targetId: String(coinId),
            oldValue: oldValues,
            newValue: newValues,
            ipAddress: getClientIp(req),
        });

        res.json({ message: 'Portfolio coin updated', coinId, updates: newValues });
    } catch (error) {
        console.error('[AdminPortfolio] Failed to update coin:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to update portfolio coin' });
    }
}

interface ClosePortfolioCoinBody {
    closePrice: number;
    type?: string;
}

const CLOSE_TRANSACTION_TYPES = ['tp3_hit', 'sl_hit', 'manual_close'] as const;
type CloseTransactionType = typeof CLOSE_TRANSACTION_TYPES[number];

function isCloseTransactionType(value: string): value is CloseTransactionType {
    return CLOSE_TRANSACTION_TYPES.includes(value as CloseTransactionType);
}

function resolveCloseType(
    requestedType: string | undefined,
    closePrice: number,
    tp3: number,
    stopLoss: number
): CloseTransactionType {
    if (requestedType && isCloseTransactionType(requestedType)) {
        return requestedType;
    }
    if (tp3 > 0 && closePrice >= tp3) return 'tp3_hit';
    if (stopLoss > 0 && closePrice <= stopLoss) return 'sl_hit';
    return 'manual_close';
}

export async function closePortfolioCoinHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const coinId = parseInt(idParam, 10);
        if (isNaN(coinId)) {
            res.status(400).json({ error: 'Invalid coin ID' });
            return;
        }

        const body = req.body as ClosePortfolioCoinBody;
        const adminEmail = req.adminEmail;

        const [coin] = await db
            .select()
            .from(portfolioCoins)
            .where(eq(portfolioCoins.id, coinId))
            .limit(1);

        if (!coin) {
            res.status(404).json({ error: 'Coin not found' });
            return;
        }

        if (coin.status === 'exited') {
            res.status(400).json({ error: 'Coin is already exited' });
            return;
        }

        if (typeof body.closePrice !== 'number' || body.closePrice <= 0) {
            res.status(400).json({ error: 'closePrice must be a positive number' });
            return;
        }

        if (body.type !== undefined && !isCloseTransactionType(body.type)) {
            res.status(400).json({ error: 'Invalid close type' });
            return;
        }

        const entryPrice = parseFloat(String(coin.entryPrice)) || 0;
        const allocatedBudget = parseFloat(String(coin.allocatedBudget)) || 0;
        const tp3 = parseFloat(String(coin.tp3)) || 0;
        const stopLoss = parseFloat(String(coin.stopLoss)) || 0;
        const quantity = entryPrice > 0 ? allocatedBudget / entryPrice : 0;
        const exitValue = quantity * body.closePrice;
        const pnl = exitValue - allocatedBudget;

        const closeType = resolveCloseType(body.type, body.closePrice, tp3, stopLoss);

        const now = new Date();

        await db
            .update(portfolioCoins)
            .set({
                status: 'exited',
                currentPrice: String(body.closePrice),
                updatedAt: now,
            })
            .where(eq(portfolioCoins.id, coinId));

        await db.insert(portfolioTransactions).values({
            coinId,
            type: closeType,
            price: String(body.closePrice),
            amount: String(exitValue.toFixed(2)),
            pnl: String(pnl.toFixed(2)),
        } as typeof portfolioTransactions.$inferInsert);

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'close_portfolio_coin',
            targetTable: 'portfolio_coins',
            targetId: String(coinId),
            oldValue: { status: coin.status, currentPrice: coin.currentPrice },
            newValue: { status: 'exited', closePrice: body.closePrice, closeType, pnl: pnl.toFixed(2) },
            ipAddress: getClientIp(req),
        });

        res.json({
            message: 'Portfolio coin closed',
            coinId,
            closePrice: body.closePrice,
            closeType,
            pnl: pnl.toFixed(2),
        });
    } catch (error) {
        console.error('[AdminPortfolio] Failed to close coin:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to close portfolio coin' });
    }
}