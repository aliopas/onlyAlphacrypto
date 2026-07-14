import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { portfolioCoins, portfolioTransactions, portfolioSnapshots } from '../models/scorecard.model';
import { eq, desc, count, sql, gte, and } from 'drizzle-orm';
import { getLivePrices as fetchBinancePrices } from '../services/binance.service';
import { env } from '../config/env';

export interface CoinRow {
    id: number;
    symbol: string;
    entryPrice: string;
    currentPrice: string | null;
    priceMovementAtEntry: string | null;
    status: string;
    signalClassification: string | null;
    cexListings: string | null;
    allocatedBudget: string;
    tp1: string | null;
    tp2: string | null;
    tp3: string | null;
    stopLoss: string | null;
    qualityScore: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface TransactionRow {
    id: number;
    coinId: number;
    symbol: string | null;
    type: string;
    price: string;
    amount: string | null;
    pnl: string | null;
    createdAt: Date;
}

export interface SnapshotRow {
    id: number;
    totalBudget: string;
    currentValue: string;
    totalPnl: string;
    totalPnlPercent: string;
    activeCoins: number;
    watchlistCoins: number;
    maxDrawdownPercent: string;
    cashBalance: string;
    snapshotAt: Date;
}

export interface ScorecardSummary {
    totalBudget: number;
    totalCapital: number;
    deployed: number;
    positionsValue: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
    cashBalance: number;
}

export interface ScorecardSummaryResponse {
    summary: ScorecardSummary;
    active: CoinRow[];
    watchlist: CoinRow[];
}

export interface CoinDetailResponse extends CoinRow {
    projectProfile: Record<string, unknown> | null;
    technicalAnalysis: Record<string, unknown> | null;
}

export interface TransactionHistoryResponse {
    transactions: TransactionRow[];
    total: number;
    limit: number;
    offset: number;
}

export interface SnapshotsResponse {
    snapshots: SnapshotRow[];
}

function getOpenRisk(coin: typeof portfolioCoins.$inferSelect): number {
    const init = parseFloat(coin.initialBudget || '0');
    const dca = coin.dcaFilled ? parseFloat(coin.dcaBudget || '0') : 0;
    const frac = parseFloat(coin.remainingSizeFrac || '1');
    return (init + dca) * frac;
}

export async function getScorecardSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const activeRows = await db
            .select()
            .from(portfolioCoins)
            .where(eq(portfolioCoins.status, 'active'))
            .orderBy(desc(portfolioCoins.createdAt));

        const watchlistRows = await db
            .select()
            .from(portfolioCoins)
            .where(eq(portfolioCoins.status, 'watchlist'))
            .orderBy(desc(portfolioCoins.createdAt));

        const symbols = [...activeRows, ...watchlistRows].map(c => c.symbol);
        const priceMap = await fetchBinancePrices(symbols);

        const totalCapital = env.SCORECARD_TOTAL_BUDGET;
        const deployed = activeRows.reduce((sum, c) => sum + getOpenRisk(c), 0);
        const cashBalance = Math.max(0, totalCapital - deployed);

        let positionsValue = 0;
        const enrichedActive = activeRows.map(coin => {
            const livePrice = (priceMap as Record<string, number>)[coin.symbol.toUpperCase()];
            const currentPriceStr = livePrice ? String(livePrice) : coin.currentPrice;
            const avg = parseFloat(coin.averageEntryPrice || coin.entryPrice || '0');
            const risk = getOpenRisk(coin);
            if (livePrice && avg > 0) {
                const qty = risk / avg;
                positionsValue += qty * livePrice;
            }
            return { ...coin, currentPrice: currentPriceStr };
        });

        const enrichedWatchlist = watchlistRows.map(coin => {
            const livePrice = (priceMap as Record<string, number>)[coin.symbol.toUpperCase()];
            return {
                ...coin,
                currentPrice: livePrice ? String(livePrice) : coin.currentPrice,
            };
        });

        const currentValue = cashBalance + positionsValue;
        const totalPnl = currentValue - totalCapital;
        const totalPnlPercent = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;

        const summary: ScorecardSummary = {
            totalBudget: totalCapital,
            totalCapital,
            deployed,
            positionsValue,
            currentValue,
            totalPnl,
            totalPnlPercent,
            activeCoins: activeRows.length,
            watchlistCoins: watchlistRows.length,
            cashBalance,
        };

        const response: ScorecardSummaryResponse = {
            summary,
            active: enrichedActive as CoinRow[],
            watchlist: enrichedWatchlist as CoinRow[],
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}

export async function getScorecardCoinBySymbol(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const symbol = String(req.params['symbol'] || '').toUpperCase();

        const [coin] = await db
            .select()
            .from(portfolioCoins)
            .where(eq(portfolioCoins.symbol, symbol));

        if (!coin) {
            res.status(404).json({ error: 'Coin not found' });
            return;
        }

        const livePriceMap = await fetchBinancePrices([symbol]);
        const livePrice = (livePriceMap as Record<string, number>)[symbol.toUpperCase()];
        const coinRow = coin as unknown as CoinRow & {
            projectProfile: unknown;
            technicalAnalysis: unknown;
        };
        const response: CoinDetailResponse = {
            ...coinRow,
            currentPrice: livePrice ? String(livePrice) : coinRow.currentPrice,
            projectProfile:
                coinRow.projectProfile && typeof coinRow.projectProfile === 'object'
                    ? (coinRow.projectProfile as Record<string, unknown>)
                    : null,
            technicalAnalysis:
                coinRow.technicalAnalysis && typeof coinRow.technicalAnalysis === 'object'
                    ? (coinRow.technicalAnalysis as Record<string, unknown>)
                    : null,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}

export async function getScorecardTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query['limit'] || '50'), 10), 1), 100);
        const offset = Math.max(parseInt(String(req.query['offset'] || '0'), 10), 0);

        const countResult = await db
            .select({ count: count() })
            .from(portfolioTransactions)
            .limit(1);

        const total = Number(countResult[0]?.count ?? 0);

        const txRows = await db
            .select({
                id: portfolioTransactions.id,
                coinId: portfolioTransactions.coinId,
                symbol: portfolioCoins.symbol,
                type: portfolioTransactions.type,
                price: portfolioTransactions.price,
                amount: portfolioTransactions.amount,
                pnl: portfolioTransactions.pnl,
                createdAt: portfolioTransactions.createdAt,
            })
            .from(portfolioTransactions)
            .leftJoin(portfolioCoins, eq(portfolioTransactions.coinId, portfolioCoins.id))
            .orderBy(desc(portfolioTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        const response: TransactionHistoryResponse = {
            transactions: txRows as TransactionRow[],
            total,
            limit,
            offset,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}

export async function getScorecardSnapshots(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const snapshots = await db
            .select()
            .from(portfolioSnapshots)
            .where(gte(portfolioSnapshots.snapshotAt, thirtyDaysAgo))
            .orderBy(desc(portfolioSnapshots.snapshotAt));

        const response: SnapshotsResponse = {
            snapshots: snapshots as SnapshotRow[],
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}