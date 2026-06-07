import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { portfolioCoins, portfolioTransactions, portfolioSnapshots } from '../models/scorecard.model';
import { eq, desc, count, sql, gte, and } from 'drizzle-orm';

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
    snapshotAt: Date;
}

export interface ScorecardSummary {
    totalBudget: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
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

const priceCache: { data: Map<string, number> | null; ts: number } = { data: null, ts: 0 };
const PRICE_CACHE_TTL = 60_000;

async function getLivePrices(): Promise<Map<string, number>> {
    const now = Date.now();
    if (priceCache.data && (now - priceCache.ts) < PRICE_CACHE_TTL) {
        return priceCache.data;
    }

    const priceMap = new Map<string, number>();
    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        if (!res.ok) return priceCache.data ?? priceMap;
        const data = await res.json() as Array<{ symbol: string; price: string }>;
        for (const ticker of data) {
            const clean = ticker.symbol.replace('USDT', '');
            priceMap.set(clean, parseFloat(ticker.price));
        }
        priceCache.data = priceMap;
        priceCache.ts = now;
    } catch {
        return priceCache.data ?? priceMap;
    }
    return priceMap;
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

        const priceMap = await getLivePrices();

        const enrichedActive = activeRows.map(coin => {
            const livePrice = priceMap.get(coin.symbol.toUpperCase());
            return {
                ...coin,
                currentPrice: livePrice ? String(livePrice) : coin.currentPrice,
            };
        });

        const enrichedWatchlist = watchlistRows.map(coin => {
            const livePrice = priceMap.get(coin.symbol.toUpperCase());
            return {
                ...coin,
                currentPrice: livePrice ? String(livePrice) : coin.currentPrice,
            };
        });

        const latestSnapshotArr = await db
            .select()
            .from(portfolioSnapshots)
            .orderBy(desc(portfolioSnapshots.snapshotAt))
            .limit(1);

        const latestSnapshot = latestSnapshotArr[0];

        const summary: ScorecardSummary = {
            totalBudget: latestSnapshot ? parseFloat(String(latestSnapshot.totalBudget)) : 0,
            currentValue: latestSnapshot ? parseFloat(String(latestSnapshot.currentValue)) : 0,
            totalPnl: latestSnapshot ? parseFloat(String(latestSnapshot.totalPnl)) : 0,
            totalPnlPercent: latestSnapshot ? parseFloat(String(latestSnapshot.totalPnlPercent)) : 0,
            activeCoins: latestSnapshot ? Number(latestSnapshot.activeCoins) : enrichedActive.length,
            watchlistCoins: latestSnapshot ? Number(latestSnapshot.watchlistCoins) : enrichedWatchlist.length,
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

        const livePrice = await getLivePrices().then(m => m.get(symbol.toUpperCase()));
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

        const transactions = await db
            .select()
            .from(portfolioTransactions)
            .orderBy(desc(portfolioTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        const response: TransactionHistoryResponse = {
            transactions: transactions as TransactionRow[],
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