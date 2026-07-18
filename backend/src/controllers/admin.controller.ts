import { Request, Response } from 'express';
import { getShadowStats } from '../services/shadowSignals.service';
import { logAdminAction } from '../services/adminAudit.service';
import { pauseSignalGeneration, resumeSignalGeneration } from '../services/signalControl.service';
import { isPageInMaintenance, setMaintenanceMode, clearMaintenanceMode, getAllMaintenanceFlags } from '../services/maintenance.service';
import { collectSystemTelemetry } from '../services/telemetry.service';
import { getPriceWithFallback } from '../services/priceService';
import { deleteCache } from '../config/redis';
import { db } from '../config/db';
import { shadowSignals, signalPerformance } from '../models/market.model';
import { portfolioCoins, portfolioTransactions, telegramPortfolioPosts } from '../models/scorecard.model';
import {
    marketNewsItems,
    marketTelegramChannels,
    type MarketNewsSourceType,
    type MarketNewsTrust,
} from '../models/marketContext.model';
import { eq, and, gte, lte, desc, sql, isNull, inArray, count } from 'drizzle-orm';
import { env } from '../config/env';
import type { SignalState } from '../services/signalLifecycle.service';
import {
    processTelegramPortfolioPost,
    resetModelPortfolio,
} from '../services/scorecardPipeline.service';
import { normalizeAndUpsertNewsItem } from '../services/marketNews.service';
import {
    generateMarketContextSnapshot,
    listMarketContextSnapshots,
    publishMarketContextSnapshot,
    archiveMarketContextSnapshot,
    unpublishMarketContextSnapshot,
} from '../services/marketContextGenerator.service';

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
            isActive,
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

        // isActive filter: "open" = currently open positions (isActive=true),
        // regardless of lifecycle state (NEW/ACTIVE/PARTIAL_TP/BREAKEVEN...).
        if (isActive && typeof isActive === 'string') {
            whereConditions.push(eq(signalPerformance.isActive, isActive === 'true'));
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
 * Reactivate a falsely-closed signal_performance row
 */
export async function reactivateScoreRecordHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const signalId = parseInt(idParam, 10);
        if (isNaN(signalId)) {
            res.status(400).json({ error: 'Invalid signal ID' });
            return;
        }

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

        if (signal.isActive) {
            res.status(400).json({ error: 'Signal is already active' });
            return;
        }

        const CLOSED_STATE: SignalState = 'CLOSED';
        const ACTIVE_STATE: SignalState = 'ACTIVE';

        const oldValue = {
            isActive: signal.isActive,
            signalState: signal.signalState,
            exitPrice: signal.exitPrice,
            realizedPnl: signal.realizedPnl,
            closedAt: signal.closedAt,
            autoClosedReason: signal.autoClosedReason,
            closeReason: signal.closeReason,
            archivedAt: signal.archivedAt,
            outcomeClassification: signal.outcomeClassification,
            classificationConfidence: signal.classificationConfidence,
            isWin7d: signal.isWin7d,
            isWin30d: signal.isWin30d,
            isWin72h: signal.isWin72h,
            pnl24h: signal.pnl24h,
            pnl7d: signal.pnl7d,
            pnl30d: signal.pnl30d,
            pnl72h: signal.pnl72h,
        };

        const updates: Partial<typeof signalPerformance.$inferInsert> = {
            isActive: true,
            exitPrice: null,
            realizedPnl: null,
            closedAt: null,
            autoClosedReason: null,
            closeReason: null,
            archivedAt: null,
            outcomeClassification: null,
            classificationConfidence: null,
            isWin7d: null,
            isWin30d: null,
            isWin72h: null,
            pnl24h: null,
            pnl7d: null,
            pnl30d: null,
            pnl72h: null,
        };

        if (signal.signalState === CLOSED_STATE) {
            updates.signalState = ACTIVE_STATE;
        }

        await db
            .update(signalPerformance)
            .set(updates)
            .where(eq(signalPerformance.id, signalId));

        const newValue = {
            isActive: true,
            signalState: updates.signalState ?? signal.signalState,
            exitPrice: null,
            realizedPnl: null,
            closedAt: null,
            autoClosedReason: null,
            closeReason: null,
            archivedAt: null,
            outcomeClassification: null,
            classificationConfidence: null,
            isWin7d: null,
            isWin30d: null,
            isWin72h: null,
            pnl24h: null,
            pnl7d: null,
            pnl30d: null,
            pnl72h: null,
        };

        let currentPrice: number | null = null;
        try {
            const priceResult = await getPriceWithFallback(signal.coinSymbol);
            currentPrice = priceResult?.price ?? null;
        } catch (error) {
            console.warn('[ReactivateScoreRecord] Price fetch failed:', error instanceof Error ? error.message : String(error));
        }

        let unrealizedPnl: number | null = null;
        if (currentPrice !== null && signal.entryPrice > 0) {
            const rawPnl = (currentPrice - signal.entryPrice) / signal.entryPrice;
            const isBearish = signal.verdict === 'SELL' || signal.verdict === 'STRONG_SELL';
            unrealizedPnl = isBearish ? -rawPnl : rawPnl;
        }

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'reactivate_signal',
            targetTable: 'signal_performance',
            targetId: String(signalId),
            oldValue,
            newValue,
            ipAddress: getClientIp(req),
        });

        try {
            await deleteCache('scorecard:latest');
        } catch (error) {
            console.warn('[ReactivateScoreRecord] Cache invalidation failed:', error instanceof Error ? error.message : String(error));
        }

        res.json({
            success: true,
            data: {
                id: signal.id,
                isActive: true,
                signalState: updates.signalState ?? signal.signalState,
                currentPrice,
                unrealizedPnl,
            },
        });
    } catch (error) {
        console.error('[ReactivateScoreRecord] Failed to reactivate signal:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to reactivate signal' });
    }
}

/**
 * Restore any non-active-visible signal_performance row to active tracking + visibility.
 * Unified operation covering three cases in one handler:
 *   - closed (isActive=false)            -> clear false-closure fields
 *   - archived + closed                  -> clear false-closure fields + un-archive
 *   - archived + active (isActive=true)  -> un-archive only, closure fields untouched
 * Trade fields (entry/TP/SL/tp2/tp3/verdict) are immutable. Restore is never blocked
 * by a missing price; currentPrice/unrealizedPnl are response-only and direction is
 * derived from the TP-vs-entry relationship (not current-vs-entry) so it does not flip
 * under drawdown.
 */
export async function restoreScoreRecordHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const signalId = parseInt(idParam, 10);
        if (isNaN(signalId)) {
            res.status(400).json({ error: 'Invalid signal ID' });
            return;
        }

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

        if (signal.isActive && signal.archivedAt === null) {
            res.status(400).json({ error: 'Already active and visible' });
            return;
        }

        const CLOSED_STATE: SignalState = 'CLOSED';
        const ACTIVE_STATE: SignalState = 'ACTIVE';
        const wasClosed = signal.isActive === false;

        const oldValue = {
            isActive: signal.isActive,
            archivedAt: signal.archivedAt,
            exitPrice: signal.exitPrice,
            realizedPnl: signal.realizedPnl,
            closedAt: signal.closedAt,
            autoClosedReason: signal.autoClosedReason,
            closeReason: signal.closeReason,
            signalState: signal.signalState,
            outcomeClassification: signal.outcomeClassification,
            classificationConfidence: signal.classificationConfidence,
            isWin7d: signal.isWin7d,
            isWin30d: signal.isWin30d,
            isWin72h: signal.isWin72h,
            pnl24h: signal.pnl24h,
            pnl7d: signal.pnl7d,
            pnl30d: signal.pnl30d,
            pnl72h: signal.pnl72h,
        };

        const updates: Partial<typeof signalPerformance.$inferInsert> = {
            isActive: true,
            archivedAt: null,
        };

        if (wasClosed) {
            updates.exitPrice = null;
            updates.realizedPnl = null;
            updates.closedAt = null;
            updates.autoClosedReason = null;
            updates.closeReason = null;
            updates.outcomeClassification = null;
            updates.classificationConfidence = null;
            updates.isWin7d = null;
            updates.isWin30d = null;
            updates.isWin72h = null;
            updates.pnl24h = null;
            updates.pnl7d = null;
            updates.pnl30d = null;
            updates.pnl72h = null;
        }

        if (signal.signalState === CLOSED_STATE) {
            updates.signalState = ACTIVE_STATE;
        }

        await db
            .update(signalPerformance)
            .set(updates)
            .where(eq(signalPerformance.id, signalId));

        const newValue = {
            isActive: true as const,
            archivedAt: null,
            exitPrice: wasClosed ? null : signal.exitPrice,
            realizedPnl: wasClosed ? null : signal.realizedPnl,
            closedAt: wasClosed ? null : signal.closedAt,
            autoClosedReason: wasClosed ? null : signal.autoClosedReason,
            closeReason: wasClosed ? null : signal.closeReason,
            signalState: updates.signalState ?? signal.signalState,
            outcomeClassification: wasClosed ? null : signal.outcomeClassification,
            classificationConfidence: wasClosed ? null : signal.classificationConfidence,
            isWin7d: wasClosed ? null : signal.isWin7d,
            isWin30d: wasClosed ? null : signal.isWin30d,
            isWin72h: wasClosed ? null : signal.isWin72h,
            pnl24h: wasClosed ? null : signal.pnl24h,
            pnl7d: wasClosed ? null : signal.pnl7d,
            pnl30d: wasClosed ? null : signal.pnl30d,
            pnl72h: wasClosed ? null : signal.pnl72h,
        };

        let currentPrice: number | null = null;
        try {
            const priceResult = await getPriceWithFallback(signal.coinSymbol);
            currentPrice = priceResult?.price ?? null;
        } catch (error) {
            console.warn('[RestoreScoreRecord] Price fetch failed:', error instanceof Error ? error.message : String(error));
        }

        let unrealizedPnl: number | null = null;
        if (currentPrice !== null && signal.entryPrice > 0) {
            const rawPnl = (currentPrice - signal.entryPrice) / signal.entryPrice;
            const isShort = signal.takeProfitPrice !== null && signal.takeProfitPrice < signal.entryPrice;
            unrealizedPnl = isShort ? -rawPnl : rawPnl;
        }

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'restore_signal',
            targetTable: 'signal_performance',
            targetId: String(signalId),
            oldValue,
            newValue,
            ipAddress: getClientIp(req),
        });

        try {
            await deleteCache('scorecard:latest');
        } catch (error) {
            console.warn('[RestoreScoreRecord] Cache invalidation failed:', error instanceof Error ? error.message : String(error));
        }

        res.json({
            id: signal.id,
            status: 'restored',
            currentPrice,
            unrealizedPnl,
        });
    } catch (error) {
        console.error('[RestoreScoreRecord] Failed to restore signal:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to restore signal' });
    }
}

/**
 * Manually close an active signal_performance row at the current market price.
 * Mirrors autoCloseSignal (lifecycle cron) but is admin-triggered; the close
 * reason is recorded as 'MANUAL'. Closing with archivedAt left null keeps the
 * record visible on the public scorecard under Closed Signals.
 */
export async function closeScoreRecordHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const signalId = parseInt(idParam, 10);
        if (isNaN(signalId)) {
            res.status(400).json({ error: 'Invalid signal ID' });
            return;
        }

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

        if (!signal.isActive) {
            res.status(400).json({ error: 'Signal is already closed' });
            return;
        }

        const priceResult = await getPriceWithFallback(signal.coinSymbol);
        const currentPrice = priceResult?.price ?? null;
        if (currentPrice === null || currentPrice <= 0) {
            res.status(502).json({ error: 'Current price unavailable, try again' });
            return;
        }

        const isLong = (signal.takeProfitPrice ?? 0) > signal.entryPrice;
        const rawPnl = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;
        const realizedPnl = isLong ? rawPnl : -rawPnl;

        const oldValue = {
            isActive: signal.isActive,
            signalState: signal.signalState,
            exitPrice: signal.exitPrice,
            realizedPnl: signal.realizedPnl,
            closedAt: signal.closedAt,
            autoClosedReason: signal.autoClosedReason,
            closeReason: signal.closeReason,
        };

        await db
            .update(signalPerformance)
            .set({
                isActive: false,
                signalState: 'CLOSED',
                closeReason: 'MANUAL',
                autoClosedReason: 'MANUAL',
                exitPrice: currentPrice,
                realizedPnl,
                closedAt: new Date(),
            })
            .where(eq(signalPerformance.id, signalId));

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'close_signal',
            targetTable: 'signal_performance',
            targetId: String(signalId),
            oldValue,
            newValue: {
                isActive: false,
                signalState: 'CLOSED',
                closeReason: 'MANUAL',
                exitPrice: currentPrice,
                realizedPnl,
            },
            ipAddress: getClientIp(req),
        });

        try {
            await deleteCache('scorecard:latest');
        } catch (error) {
            console.warn('[CloseScoreRecord] Cache invalidation failed:', error instanceof Error ? error.message : String(error));
        }

        res.json({
            success: true,
            data: {
                id: signal.id,
                isActive: false,
                signalState: 'CLOSED',
                closeReason: 'MANUAL',
                exitPrice: currentPrice,
                realizedPnl,
            },
        });
    } catch (error) {
        console.error('[CloseScoreRecord] Failed to close signal:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to close signal' });
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

        const validated = await validateScorecardCoin({
            symbol,
            entryPrice: body.entryPrice,
            direction: 'LONG',
        });
        if (!validated) {
            res.status(400).json({ error: 'Coin failed validation gate' });
            return;
        }

        const tpslResult = await calculateScorecardTpsl({
            symbol: validated.symbol,
            entryPrice: validated.entryPrice,
        });

        const initialBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;
        const dcaBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT;

        const activeCountArr = await db
            .select({ count: count() })
            .from(portfolioCoins)
            .where(eq(portfolioCoins.status, 'active'))
            .limit(1);
        const activeCount = activeCountArr[0]?.count ?? 0;

        let finalStatus = status;
        let allocated = 0;
        let insertTx = false;

        if (status === 'active') {
            if (activeCount >= env.SCORECARD_MAX_ACTIVE) {
                finalStatus = 'watchlist';
            } else {
                const actives = await db.select().from(portfolioCoins).where(eq(portfolioCoins.status, 'active'));
                const openRisk = actives.reduce((sum, c) => {
                    const init = parseFloat(c.initialBudget || '0');
                    const dca = c.dcaFilled ? parseFloat(c.dcaBudget || '0') : 0;
                    const frac = parseFloat(c.remainingSizeFrac || '1');
                    return sum + (init + dca) * frac;
                }, 0);
                const cash = env.SCORECARD_TOTAL_BUDGET - openRisk;
                if (cash >= initialBudget) {
                    allocated = initialBudget;
                    insertTx = true;
                } else {
                    finalStatus = 'watchlist';
                }
            }
        }

        const inserted = await db.insert(portfolioCoins).values({
            symbol: validated.symbol,
            entryPrice: String(validated.entryPrice),
            currentPrice: String(validated.currentPrice),
            priceMovementAtEntry: String(validated.priceMovement),
            status: finalStatus,
            signalClassification: classification,
            cexListings: validated.cexListings,
            allocatedBudget: String(allocated),
            tp1: String(tpslResult.tp1),
            tp2: String(tpslResult.tp2),
            tp3: String(tpslResult.tp3),
            stopLoss: String(tpslResult.stopLoss),
            qualityScore: 0,
            direction: 'LONG',
            postedEntryPrice: String(validated.entryPrice),
            averageEntryPrice: String(validated.entryPrice),
            initialBudget: String(initialBudget),
            dcaBudget: String(dcaBudget),
            remainingSizeFrac: '1',
            dcaFilled: false,
            tp1Hit: false,
            tp2Hit: false,
            tp3Hit: false,
            realizedPnl: '0',
        } as typeof portfolioCoins.$inferInsert).returning({ id: portfolioCoins.id });

        const coinId = inserted[0]?.id;
        if (!coinId) {
            res.status(500).json({ error: 'Failed to insert coin' });
            return;
        }

        if (insertTx) {
            await db.insert(portfolioTransactions).values({
                coinId,
                type: 'entry',
                price: String(validated.entryPrice),
                amount: String(initialBudget),
            } as typeof portfolioTransactions.$inferInsert);
        }

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

        let newEntryPrice: number | undefined;
        if (body.entryPrice !== undefined) {
            if (typeof body.entryPrice !== 'number' || body.entryPrice <= 0) {
                res.status(400).json({ error: 'entryPrice must be a positive number' });
                return;
            }
            newEntryPrice = body.entryPrice;
            updates.entryPrice = String(body.entryPrice);
            updates.averageEntryPrice = String(body.entryPrice);
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

        const finalEntry = newEntryPrice ?? parseFloat(String(coin.averageEntryPrice || coin.entryPrice));
        const finalSl = parseFloat(String(updates.stopLoss ?? coin.stopLoss));
        const finalTp1 = parseFloat(String(updates.tp1 ?? coin.tp1));
        const finalTp2 = parseFloat(String(updates.tp2 ?? coin.tp2));
        const finalTp3 = parseFloat(String(updates.tp3 ?? coin.tp3));

        if (finalSl >= finalEntry || finalTp1 <= finalEntry || finalTp2 <= finalTp1 || finalTp3 <= finalTp2) {
            res.status(400).json({ error: 'Invalid TP/SL ladder: must satisfy sl < avgEntry < tp1 < tp2 < tp3' });
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

        const avgEntry = parseFloat(String(coin.averageEntryPrice || coin.entryPrice)) || 0;
        const initialBudget = parseFloat(String(coin.initialBudget)) || 0;
        const dcaBudget = coin.dcaFilled ? parseFloat(String(coin.dcaBudget)) || 0 : 0;
        const remainingFrac = parseFloat(String(coin.remainingSizeFrac)) || 1;
        const tp3 = parseFloat(String(coin.tp3)) || 0;
        const stopLoss = parseFloat(String(coin.stopLoss)) || 0;

        const openNotional = (initialBudget + dcaBudget) * remainingFrac;
        const pnl = avgEntry > 0 ? (openNotional * (body.closePrice - avgEntry) / avgEntry) : 0;

        const closeType = resolveCloseType(body.type, body.closePrice, tp3, stopLoss);

        const now = new Date();

        const realizedSoFar = parseFloat(String(coin.realizedPnl)) || 0;

        await db
            .update(portfolioCoins)
            .set({
                status: 'exited',
                currentPrice: String(body.closePrice),
                exitPrice: String(body.closePrice),
                exitedAt: now,
                exitReason: closeType,
                remainingSizeFrac: '0',
                allocatedBudget: '0',
                realizedPnl: String((realizedSoFar + pnl).toFixed(2)),
                updatedAt: now,
            })
            .where(eq(portfolioCoins.id, coinId));

        await db.insert(portfolioTransactions).values({
            coinId,
            type: closeType,
            price: String(body.closePrice),
            amount: String(openNotional.toFixed(2)),
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

// ─── Portfolio Posts Manual Intake + Hard Reset (MP-ADMIN-OPS) ───────────────

export async function getPortfolioPostsHandler(req: Request, res: Response): Promise<void> {
    try {
        const { page = '1', limit = '50', analyzed } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
        const offset = (pageNum - 1) * limitNum;

        const whereConditions = [];
        if (analyzed === 'true') {
            whereConditions.push(eq(telegramPortfolioPosts.isAnalyzed, true));
        } else if (analyzed === 'false') {
            whereConditions.push(eq(telegramPortfolioPosts.isAnalyzed, false));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(telegramPortfolioPosts)
            .where(whereClause);

        const total = Number(totalResult[0]?.count || 0);

        const posts = await db
            .select({
                id: telegramPortfolioPosts.id,
                messageId: telegramPortfolioPosts.messageId,
                content: telegramPortfolioPosts.content,
                imageUrl: telegramPortfolioPosts.imageUrl,
                isAnalyzed: telegramPortfolioPosts.isAnalyzed,
                extractedSymbols: telegramPortfolioPosts.extractedSymbols,
                analyzedAt: telegramPortfolioPosts.analyzedAt,
                createdAt: telegramPortfolioPosts.createdAt,
            })
            .from(telegramPortfolioPosts)
            .where(whereClause)
            .orderBy(desc(telegramPortfolioPosts.createdAt))
            .limit(limitNum)
            .offset(offset);

        res.json({
            posts: posts.map((p) => ({
                id: p.id,
                messageId: p.messageId,
                content: p.content,
                imageUrl: p.imageUrl,
                isAnalyzed: p.isAnalyzed ?? false,
                extractedSymbols: p.extractedSymbols,
                analyzedAt: p.analyzedAt ? p.analyzedAt.toISOString() : null,
                createdAt: p.createdAt ? p.createdAt.toISOString() : '',
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum) || 0,
            },
        });
    } catch (error) {
        console.error('[AdminPortfolio] Failed to fetch posts:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to fetch portfolio posts' });
    }
}

export async function processPortfolioPostHandler(req: Request, res: Response): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const postId = parseInt(idParam, 10);
        if (isNaN(postId)) {
            res.status(400).json({ error: 'Invalid post ID' });
            return;
        }

        const adminEmail = req.adminEmail;

        try {
            const result = await processTelegramPortfolioPost(postId);

            await logAdminAction({
                adminEmail: adminEmail ?? 'unknown',
                action: 'process_portfolio_post',
                targetTable: 'telegram_portfolio_posts',
                targetId: String(postId),
                newValue: {
                    messageId: result.messageId,
                    summary: result.summary,
                    results: result.results,
                },
                ipAddress: getClientIp(req),
            });

            res.json(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'POST_NOT_FOUND') {
                res.status(404).json({ error: 'Post not found' });
                return;
            }
            if (msg === 'NO_EXTRACTED_SYMBOLS') {
                res.status(400).json({ error: 'Post has no extracted symbols' });
                return;
            }
            throw err;
        }
    } catch (error) {
        console.error('[AdminPortfolio] Failed to process post:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to process portfolio post' });
    }
}

interface ResetModelPortfolioBody {
    confirm?: string;
}

export async function resetModelPortfolioHandler(req: Request, res: Response): Promise<void> {
    try {
        const body = req.body as ResetModelPortfolioBody;
        if (body.confirm !== 'RESET_MODEL_PORTFOLIO') {
            res.status(400).json({
                error: 'Confirmation required',
                hint: 'Body must include { "confirm": "RESET_MODEL_PORTFOLIO" }',
            });
            return;
        }

        const adminEmail = req.adminEmail;
        const result = await resetModelPortfolio();

        await logAdminAction({
            adminEmail: adminEmail ?? 'unknown',
            action: 'reset_model_portfolio',
            targetTable: 'portfolio_coins',
            targetId: 'all',
            newValue: {
                deleted: result.deleted,
                totalCapital: result.totalCapital,
            },
            ipAddress: getClientIp(req),
        });

        res.json(result);
    } catch (error) {
        console.error('[AdminPortfolio] Failed to reset portfolio:', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to reset model portfolio' });
    }
}

// ─── Market Context Admin (MC-2 / DEC-040) ───────────────────────────────────

const MARKET_NEWS_TRUST_VALUES: readonly MarketNewsTrust[] = ['pending', 'trusted', 'rejected'];
const MARKET_NEWS_SOURCE_VALUES: readonly MarketNewsSourceType[] = [
    'terminal',
    'rss',
    'telegram',
    'manual',
];

function isMarketNewsTrust(value: string): value is MarketNewsTrust {
    return (MARKET_NEWS_TRUST_VALUES as readonly string[]).includes(value);
}

function isMarketNewsSourceType(value: string): value is MarketNewsSourceType {
    return (MARKET_NEWS_SOURCE_VALUES as readonly string[]).includes(value);
}

function parseSymbolsInput(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => s.length > 0);
    }
    if (typeof raw === 'string' && raw.trim()) {
        return raw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => s.length > 0);
    }
    return [];
}

export async function getMarketContextNewsHandler(req: Request, res: Response): Promise<void> {
    try {
        const { page = '1', limit = '50', trust, sourceType, q } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
        const offset = (pageNum - 1) * limitNum;

        const whereConditions = [];

        if (typeof trust === 'string' && isMarketNewsTrust(trust)) {
            whereConditions.push(eq(marketNewsItems.trust, trust));
        }
        if (typeof sourceType === 'string' && isMarketNewsSourceType(sourceType)) {
            whereConditions.push(eq(marketNewsItems.sourceType, sourceType));
        }
        if (typeof q === 'string' && q.trim()) {
            const pattern = `%${q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
            whereConditions.push(
                sql`${marketNewsItems.title} ILIKE ${pattern} ESCAPE '\\'`
            );
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(marketNewsItems)
            .where(whereClause);

        const total = Number(totalResult[0]?.count || 0);

        const rows = await db
            .select({
                id: marketNewsItems.id,
                sourceType: marketNewsItems.sourceType,
                externalId: marketNewsItems.externalId,
                sourceHash: marketNewsItems.sourceHash,
                title: marketNewsItems.title,
                body: marketNewsItems.body,
                url: marketNewsItems.url,
                sourceName: marketNewsItems.sourceName,
                publishedAt: marketNewsItems.publishedAt,
                symbols: marketNewsItems.symbols,
                trust: marketNewsItems.trust,
                trustNote: marketNewsItems.trustNote,
                createdAt: marketNewsItems.createdAt,
                updatedAt: marketNewsItems.updatedAt,
            })
            .from(marketNewsItems)
            .where(whereClause)
            .orderBy(desc(marketNewsItems.publishedAt), desc(marketNewsItems.id))
            .limit(limitNum)
            .offset(offset);

        res.json({
            items: rows.map((r) => ({
                id: r.id,
                sourceType: r.sourceType,
                externalId: r.externalId,
                sourceHash: r.sourceHash,
                title: r.title,
                body: r.body,
                url: r.url,
                sourceName: r.sourceName,
                publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
                symbols: Array.isArray(r.symbols) ? r.symbols : [],
                trust: r.trust,
                trustNote: r.trustNote,
                createdAt: r.createdAt ? r.createdAt.toISOString() : '',
                updatedAt: r.updatedAt ? r.updatedAt.toISOString() : '',
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum) || 0,
            },
        });
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to list news:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to fetch market context news' });
    }
}

interface PatchNewsTrustBody {
    trust?: string;
    note?: string;
}

export async function patchMarketContextNewsTrustHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const newsId = parseInt(idParam, 10);
        if (isNaN(newsId)) {
            res.status(400).json({ error: 'Invalid news ID' });
            return;
        }

        const body = req.body as PatchNewsTrustBody;
        if (!body.trust || !isMarketNewsTrust(body.trust)) {
            res.status(400).json({
                error: 'Invalid trust',
                hint: 'trust must be pending | trusted | rejected',
            });
            return;
        }

        const existing = await db
            .select({
                id: marketNewsItems.id,
                trust: marketNewsItems.trust,
                trustNote: marketNewsItems.trustNote,
                title: marketNewsItems.title,
            })
            .from(marketNewsItems)
            .where(eq(marketNewsItems.id, newsId))
            .limit(1);

        if (existing.length === 0) {
            res.status(404).json({ error: 'News item not found' });
            return;
        }

        const note =
            typeof body.note === 'string' ? body.note.trim() || null : existing[0].trustNote;

        const updated = await db
            .update(marketNewsItems)
            .set({
                trust: body.trust,
                trustNote: note,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, newsId))
            .returning({
                id: marketNewsItems.id,
                trust: marketNewsItems.trust,
                trustNote: marketNewsItems.trustNote,
            });

        await logAdminAction({
            adminEmail: req.adminEmail ?? 'unknown',
            action: 'market_context_news_trust',
            targetTable: 'market_news_items',
            targetId: String(newsId),
            oldValue: {
                trust: existing[0].trust,
                trustNote: existing[0].trustNote,
                title: existing[0].title,
            },
            newValue: {
                trust: updated[0].trust,
                trustNote: updated[0].trustNote,
            },
            ipAddress: getClientIp(req),
        });

        res.json({
            id: updated[0].id,
            trust: updated[0].trust,
            trustNote: updated[0].trustNote,
        });
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to patch trust:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to update news trust' });
    }
}

interface ManualNewsBody {
    title?: string;
    body?: string;
    url?: string;
    sourceName?: string;
    publishedAt?: string;
    symbols?: string[] | string;
    trust?: string;
    trustNote?: string;
}

export async function postMarketContextNewsManualHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const body = req.body as ManualNewsBody;
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) {
            res.status(400).json({ error: 'title is required' });
            return;
        }

        let trust: MarketNewsTrust = 'pending';
        if (body.trust !== undefined) {
            if (!isMarketNewsTrust(body.trust)) {
                res.status(400).json({ error: 'Invalid trust value' });
                return;
            }
            trust = body.trust;
        }

        let publishedAt: Date | null = null;
        if (typeof body.publishedAt === 'string' && body.publishedAt.trim()) {
            const d = new Date(body.publishedAt);
            if (Number.isNaN(d.getTime())) {
                res.status(400).json({ error: 'Invalid publishedAt' });
                return;
            }
            publishedAt = d;
        } else {
            publishedAt = new Date();
        }

        const symbols = parseSymbolsInput(body.symbols);
        const url = typeof body.url === 'string' ? body.url.trim() || null : null;
        const sourceName =
            typeof body.sourceName === 'string' ? body.sourceName.trim() || 'manual' : 'manual';
        const newsBody = typeof body.body === 'string' ? body.body : null;
        const trustNote =
            typeof body.trustNote === 'string' ? body.trustNote.trim() || null : null;

        const outcome = await normalizeAndUpsertNewsItem({
            sourceType: 'manual',
            externalId: null,
            title,
            body: newsBody,
            url,
            sourceName,
            publishedAt,
            symbols,
            trust,
            trustNote,
            rawRef: { injectedBy: req.adminEmail ?? 'unknown' },
        });

        if (outcome === 'skipped') {
            res.status(409).json({
                error: 'Duplicate or empty item (sourceHash conflict)',
                outcome,
            });
            return;
        }

        const inserted = await db
            .select({
                id: marketNewsItems.id,
                sourceHash: marketNewsItems.sourceHash,
                trust: marketNewsItems.trust,
                title: marketNewsItems.title,
            })
            .from(marketNewsItems)
            .where(
                and(
                    eq(marketNewsItems.sourceType, 'manual'),
                    eq(marketNewsItems.title, title)
                )
            )
            .orderBy(desc(marketNewsItems.id))
            .limit(1);

        const item = inserted[0];

        await logAdminAction({
            adminEmail: req.adminEmail ?? 'unknown',
            action: 'market_context_news_manual',
            targetTable: 'market_news_items',
            targetId: item ? String(item.id) : undefined,
            newValue: {
                title,
                trust,
                url,
                sourceName,
                symbols,
            },
            ipAddress: getClientIp(req),
        });

        res.status(201).json({
            outcome: 'inserted',
            item: item
                ? {
                      id: item.id,
                      sourceHash: item.sourceHash,
                      trust: item.trust,
                      title: item.title,
                  }
                : null,
        });
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to inject manual news:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to inject manual news' });
    }
}

export async function getMarketContextTelegramChannelsHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const rows = await db
            .select()
            .from(marketTelegramChannels)
            .orderBy(desc(marketTelegramChannels.id));

        res.json({
            channels: rows.map((c) => ({
                id: c.id,
                usernameOrId: c.usernameOrId,
                title: c.title,
                enabled: c.enabled,
                lastCursor: c.lastCursor,
                notes: c.notes,
                createdAt: c.createdAt ? c.createdAt.toISOString() : '',
                updatedAt: c.updatedAt ? c.updatedAt.toISOString() : '',
            })),
        });
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to list channels:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to fetch telegram channels' });
    }
}

interface CreateChannelBody {
    usernameOrId?: string;
    title?: string;
    enabled?: boolean;
    notes?: string;
}

export async function postMarketContextTelegramChannelHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const body = req.body as CreateChannelBody;
        const usernameOrId =
            typeof body.usernameOrId === 'string' ? body.usernameOrId.trim() : '';
        if (!usernameOrId) {
            res.status(400).json({ error: 'usernameOrId is required' });
            return;
        }

        const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
        const title = typeof body.title === 'string' ? body.title.trim() || null : null;
        const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;

        try {
            const inserted = await db
                .insert(marketTelegramChannels)
                .values({
                    usernameOrId,
                    title,
                    enabled,
                    notes,
                    updatedAt: new Date(),
                })
                .returning();

            const channel = inserted[0];

            await logAdminAction({
                adminEmail: req.adminEmail ?? 'unknown',
                action: 'market_context_channel_create',
                targetTable: 'market_telegram_channels',
                targetId: String(channel.id),
                newValue: {
                    usernameOrId: channel.usernameOrId,
                    title: channel.title,
                    enabled: channel.enabled,
                    notes: channel.notes,
                },
                ipAddress: getClientIp(req),
            });

            res.status(201).json({
                channel: {
                    id: channel.id,
                    usernameOrId: channel.usernameOrId,
                    title: channel.title,
                    enabled: channel.enabled,
                    lastCursor: channel.lastCursor,
                    notes: channel.notes,
                    createdAt: channel.createdAt ? channel.createdAt.toISOString() : '',
                    updatedAt: channel.updatedAt ? channel.updatedAt.toISOString() : '',
                },
            });
        } catch (insertErr) {
            const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
            if (msg.includes('unique') || msg.includes('duplicate')) {
                res.status(409).json({ error: 'Channel usernameOrId already exists' });
                return;
            }
            throw insertErr;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to create channel:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to create telegram channel' });
    }
}

interface PatchChannelBody {
    title?: string;
    enabled?: boolean;
    notes?: string;
    usernameOrId?: string;
}

export async function patchMarketContextTelegramChannelHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const channelId = parseInt(idParam, 10);
        if (isNaN(channelId)) {
            res.status(400).json({ error: 'Invalid channel ID' });
            return;
        }

        const existing = await db
            .select()
            .from(marketTelegramChannels)
            .where(eq(marketTelegramChannels.id, channelId))
            .limit(1);

        if (existing.length === 0) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        const body = req.body as PatchChannelBody;
        const updates: {
            title?: string | null;
            enabled?: boolean;
            notes?: string | null;
            usernameOrId?: string;
            updatedAt: Date;
        } = { updatedAt: new Date() };

        if (body.title !== undefined) {
            updates.title = typeof body.title === 'string' ? body.title.trim() || null : null;
        }
        if (body.enabled !== undefined) {
            updates.enabled = Boolean(body.enabled);
        }
        if (body.notes !== undefined) {
            updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
        }
        if (body.usernameOrId !== undefined) {
            const u =
                typeof body.usernameOrId === 'string' ? body.usernameOrId.trim() : '';
            if (!u) {
                res.status(400).json({ error: 'usernameOrId cannot be empty' });
                return;
            }
            updates.usernameOrId = u;
        }

        try {
            const updated = await db
                .update(marketTelegramChannels)
                .set(updates)
                .where(eq(marketTelegramChannels.id, channelId))
                .returning();

            const channel = updated[0];

            await logAdminAction({
                adminEmail: req.adminEmail ?? 'unknown',
                action: 'market_context_channel_update',
                targetTable: 'market_telegram_channels',
                targetId: String(channelId),
                oldValue: {
                    usernameOrId: existing[0].usernameOrId,
                    title: existing[0].title,
                    enabled: existing[0].enabled,
                    notes: existing[0].notes,
                },
                newValue: {
                    usernameOrId: channel.usernameOrId,
                    title: channel.title,
                    enabled: channel.enabled,
                    notes: channel.notes,
                },
                ipAddress: getClientIp(req),
            });

            res.json({
                channel: {
                    id: channel.id,
                    usernameOrId: channel.usernameOrId,
                    title: channel.title,
                    enabled: channel.enabled,
                    lastCursor: channel.lastCursor,
                    notes: channel.notes,
                    createdAt: channel.createdAt ? channel.createdAt.toISOString() : '',
                    updatedAt: channel.updatedAt ? channel.updatedAt.toISOString() : '',
                },
            });
        } catch (updateErr) {
            const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
            if (msg.includes('unique') || msg.includes('duplicate')) {
                res.status(409).json({ error: 'Channel usernameOrId already exists' });
                return;
            }
            throw updateErr;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to patch channel:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to update telegram channel' });
    }
}

// ─── Market Context Snapshots (MC-3 / DEC-040) ────────────────────────────────

interface GenerateSnapshotBody {
    kind?: string;
    weekLabel?: string;
    newsLimit?: number;
    newsDaysBack?: number;
    marketDataVersion?: string;
}

export async function postMarketContextSnapshotGenerateHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        if (!env.MARKET_CONTEXT_ENABLED) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const body = (req.body ?? {}) as GenerateSnapshotBody;
        const adminEmail = req.adminEmail ?? 'unknown';

        try {
            const result = await generateMarketContextSnapshot({
                kind: typeof body.kind === 'string' ? body.kind : undefined,
                weekLabel: typeof body.weekLabel === 'string' ? body.weekLabel : undefined,
                newsLimit:
                    typeof body.newsLimit === 'number' ? body.newsLimit : undefined,
                newsDaysBack:
                    typeof body.newsDaysBack === 'number' ? body.newsDaysBack : undefined,
                marketDataVersion:
                    typeof body.marketDataVersion === 'string'
                        ? body.marketDataVersion
                        : undefined,
                createdBy: adminEmail,
            });

            const snap = result.snapshot;

            await logAdminAction({
                adminEmail,
                action: 'market_context_snapshot_generate',
                targetTable: 'market_context_snapshots',
                targetId: String(snap.id),
                newValue: {
                    snapshotKey: snap.snapshotKey,
                    kind: snap.kind,
                    weekLabel: snap.weekLabel,
                    status: snap.status,
                    newsCount: result.newsCount,
                    generatorVersion: snap.generatorVersion,
                    marketDataVersion: snap.marketDataVersion,
                },
                ipAddress: getClientIp(req),
            });

            res.status(201).json({
                snapshot: {
                    id: snap.id,
                    snapshotKey: snap.snapshotKey,
                    kind: snap.kind,
                    weekLabel: snap.weekLabel,
                    status: snap.status,
                    newsIds: Array.isArray(snap.newsIds) ? snap.newsIds : [],
                    marketDataVersion: snap.marketDataVersion,
                    generatorVersion: snap.generatorVersion,
                    generatedAt: snap.generatedAt ? snap.generatedAt.toISOString() : null,
                    publishedAt: snap.publishedAt ? snap.publishedAt.toISOString() : null,
                    createdBy: snap.createdBy,
                    createdAt: snap.createdAt ? snap.createdAt.toISOString() : '',
                    sectionKeys: result.sectionKeys,
                    newsCount: result.newsCount,
                },
            });
        } catch (genErr) {
            const msg = genErr instanceof Error ? genErr.message : String(genErr);
            if (msg === 'MARKET_CONTEXT_DISABLED') {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            throw genErr;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to generate snapshot:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to generate market context snapshot' });
    }
}

export async function getMarketContextSnapshotsHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const { page = '1', limit = '20', status } = req.query;
        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50);

        let statusFilter: 'draft' | 'published' | 'archived' | undefined;
        if (status === 'draft' || status === 'published' || status === 'archived') {
            statusFilter = status;
        }

        const result = await listMarketContextSnapshots({
            status: statusFilter,
            page: pageNum,
            limit: limitNum,
        });

        res.json(result);
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to list snapshots:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to list market context snapshots' });
    }
}

export async function patchMarketContextSnapshotPublishHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const snapshotId = parseInt(idParam, 10);
        if (isNaN(snapshotId)) {
            res.status(400).json({ error: 'Invalid snapshot ID' });
            return;
        }

        const adminEmail = req.adminEmail ?? 'unknown';

        try {
            const snap = await publishMarketContextSnapshot(snapshotId, adminEmail);

            await logAdminAction({
                adminEmail,
                action: 'market_context_snapshot_publish',
                targetTable: 'market_context_snapshots',
                targetId: String(snapshotId),
                newValue: {
                    status: snap.status,
                    publishedAt: snap.publishedAt ? snap.publishedAt.toISOString() : null,
                    snapshotKey: snap.snapshotKey,
                },
                ipAddress: getClientIp(req),
            });

            res.json({
                snapshot: {
                    id: snap.id,
                    snapshotKey: snap.snapshotKey,
                    status: snap.status,
                    publishedAt: snap.publishedAt ? snap.publishedAt.toISOString() : null,
                },
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'SNAPSHOT_NOT_FOUND') {
                res.status(404).json({ error: 'Snapshot not found' });
                return;
            }
            if (msg === 'SNAPSHOT_ARCHIVED') {
                res.status(400).json({ error: 'Cannot publish archived snapshot' });
                return;
            }
            if (msg === 'MARKET_CONTEXT_DISABLED') {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            throw err;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to publish snapshot:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to publish snapshot' });
    }
}

export async function patchMarketContextSnapshotArchiveHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const snapshotId = parseInt(idParam, 10);
        if (isNaN(snapshotId)) {
            res.status(400).json({ error: 'Invalid snapshot ID' });
            return;
        }

        const adminEmail = req.adminEmail ?? 'unknown';

        try {
            const snap = await archiveMarketContextSnapshot(snapshotId);

            await logAdminAction({
                adminEmail,
                action: 'market_context_snapshot_archive',
                targetTable: 'market_context_snapshots',
                targetId: String(snapshotId),
                newValue: { status: snap.status },
                ipAddress: getClientIp(req),
            });

            res.json({
                snapshot: {
                    id: snap.id,
                    snapshotKey: snap.snapshotKey,
                    status: snap.status,
                },
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'SNAPSHOT_NOT_FOUND') {
                res.status(404).json({ error: 'Snapshot not found' });
                return;
            }
            if (msg === 'MARKET_CONTEXT_DISABLED') {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            throw err;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to archive snapshot:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to archive snapshot' });
    }
}

export async function patchMarketContextSnapshotUnpublishHandler(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const snapshotId = parseInt(idParam, 10);
        if (isNaN(snapshotId)) {
            res.status(400).json({ error: 'Invalid snapshot ID' });
            return;
        }

        const adminEmail = req.adminEmail ?? 'unknown';

        try {
            const snap = await unpublishMarketContextSnapshot(snapshotId);

            await logAdminAction({
                adminEmail,
                action: 'market_context_snapshot_unpublish',
                targetTable: 'market_context_snapshots',
                targetId: String(snapshotId),
                newValue: { status: snap.status },
                ipAddress: getClientIp(req),
            });

            res.json({
                snapshot: {
                    id: snap.id,
                    snapshotKey: snap.snapshotKey,
                    status: snap.status,
                },
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'SNAPSHOT_NOT_FOUND') {
                res.status(404).json({ error: 'Snapshot not found' });
                return;
            }
            if (msg === 'SNAPSHOT_NOT_PUBLISHED') {
                res.status(400).json({ error: 'Snapshot is not published' });
                return;
            }
            if (msg === 'MARKET_CONTEXT_DISABLED') {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            throw err;
        }
    } catch (error) {
        console.error(
            '[AdminMarketContext] Failed to unpublish snapshot:',
            error instanceof Error ? error.message : String(error)
        );
        res.status(500).json({ error: 'Failed to unpublish snapshot' });
    }
}
