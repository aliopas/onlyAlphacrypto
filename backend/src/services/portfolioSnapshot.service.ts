import { db } from '../config/db';
import { env } from '../config/env';
import { portfolioCoins, portfolioSnapshots } from '../models';
import { eq, desc, sql } from 'drizzle-orm';

async function fetchCoinPrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    if (symbols.length === 0) return priceMap;

    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        if (!res.ok) return priceMap;

        const data = await res.json() as Array<{ symbol: string; price: string }>;
        const symbolSet = new Set(symbols.map(s => s.toUpperCase()));

        for (const ticker of data) {
            const cleanSymbol = ticker.symbol.replace('USDT', '');
            if (symbolSet.has(cleanSymbol)) {
                priceMap.set(cleanSymbol, parseFloat(ticker.price));
            }
        }
    } catch (err) {
        console.error('[PortfolioSnapshot] Failed to fetch prices:', err instanceof Error ? err.message : String(err));
    }

    return priceMap;
}

async function getLatestSnapshotDate(): Promise<Date | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latest = await db
        .select({ snapshotAt: portfolioSnapshots.snapshotAt })
        .from(portfolioSnapshots)
        .where(sql`DATE(${portfolioSnapshots.snapshotAt}) = ${today.toISOString().split('T')[0]}`)
        .orderBy(desc(portfolioSnapshots.snapshotAt))
        .limit(1);

    return latest[0]?.snapshotAt ?? null;
}

async function calculateMaxDrawdownPercent(currentValue: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const previousSnapshots = await db
        .select({
            currentValue: portfolioSnapshots.currentValue,
            snapshotAt: portfolioSnapshots.snapshotAt,
        })
        .from(portfolioSnapshots)
        .where(sql`DATE(${portfolioSnapshots.snapshotAt}) < ${today.toISOString().split('T')[0]}`)
        .orderBy(desc(portfolioSnapshots.snapshotAt))
        .limit(30);

    if (previousSnapshots.length === 0) {
        return 0;
    }

    const peakValue = Math.max(
        ...previousSnapshots.map(s => parseFloat(String(s.currentValue))),
        0
    );

    if (peakValue === 0) return 0;

    const drawdown = ((peakValue - currentValue) / peakValue) * 100;
    return Math.max(0, Math.round(drawdown * 10000) / 10000);
}

export interface SnapshotResult {
    totalBudget: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
    maxDrawdownPercent: number;
    cashBalance: number;
    snapshotAt: Date;
}

export async function createDailySnapshot(): Promise<SnapshotResult | null> {
    const existingToday = await getLatestSnapshotDate();
    if (existingToday) {
        console.log('[PortfolioSnapshot] Snapshot already exists for today — skipping');
        return null;
    }

    const activeCoins = await db
        .select()
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'));

    const watchlistCoins = await db
        .select()
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'watchlist'));

    const allCoins = [...activeCoins, ...watchlistCoins];
    const symbols = allCoins.map(c => c.symbol);

    const priceMap = await fetchCoinPrices(symbols);

    let totalBudget = 0;
    let totalCurrentValue = 0;
    let totalEntryValue = 0;

    for (const coin of allCoins) {
        const budget = parseFloat(String(coin.allocatedBudget)) || 0;
        totalBudget += budget;

        const currentPrice = priceMap.get(coin.symbol.toUpperCase());
        const entryPrice = parseFloat(String(coin.entryPrice)) || 0;

        if (currentPrice) {
            const quantity = entryPrice > 0 ? budget / entryPrice : 0;
            const currentValue = quantity * currentPrice;
            totalCurrentValue += currentValue;
            totalEntryValue += budget;
        } else {
            totalEntryValue += budget;
            totalCurrentValue += 0;
        }
    }

    const totalPnl = totalCurrentValue - totalBudget;
    const totalPnlPercent = totalBudget > 0
        ? ((totalCurrentValue - totalBudget) / totalBudget) * 100
        : 0;

    const totalPortfolioBudget = env.SCORECARD_TOTAL_BUDGET;
    const cashBalance = Math.max(0, totalPortfolioBudget - totalBudget);

    const maxDrawdownPercent = await calculateMaxDrawdownPercent(totalCurrentValue);

    const snapshotAt = new Date();

    const inserted = await db.insert(portfolioSnapshots).values({
        totalBudget: String(totalBudget.toFixed(2)),
        currentValue: String(totalCurrentValue.toFixed(2)),
        totalPnl: String(totalPnl.toFixed(2)),
        totalPnlPercent: String(totalPnlPercent.toFixed(4)),
        activeCoins: activeCoins.length,
        watchlistCoins: watchlistCoins.length,
        maxDrawdownPercent: String(maxDrawdownPercent.toFixed(4)),
        cashBalance: String(cashBalance.toFixed(2)),
        snapshotAt,
    } as typeof portfolioSnapshots.$inferInsert).returning();

    if (!inserted[0]) {
        console.error('[PortfolioSnapshot] Failed to insert snapshot');
        return null;
    }

    console.log(
        `[PortfolioSnapshot] Created — budget:${totalBudget.toFixed(2)} ` +
        `value:${totalCurrentValue.toFixed(2)} pnl:${totalPnl.toFixed(2)} ` +
        `active:${activeCoins.length} watchlist:${watchlistCoins.length}`
    );

    return {
        totalBudget,
        currentValue: totalCurrentValue,
        totalPnl,
        totalPnlPercent,
        activeCoins: activeCoins.length,
        watchlistCoins: watchlistCoins.length,
        maxDrawdownPercent,
        cashBalance,
        snapshotAt,
    };
}