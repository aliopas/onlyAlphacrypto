import { db } from '../config/db';
import { env } from '../config/env';
import { portfolioCoins, portfolioSnapshots } from '../models';
import { eq, desc, sql } from 'drizzle-orm';
import { getLivePrices } from './binance.service';
import { logger } from '../utils/logger';

async function fetchCoinPrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    if (symbols.length === 0) return priceMap;

    try {
        // Use the resilient binance.service bulk price endpoint (cached, rate-limited, retried)
        // instead of a raw fetch to /ticker/price that downloads ALL thousands of symbols and
        // has no retry/cache/rate-limit protection.
        const prices = await getLivePrices(symbols);
        for (const [symbol, price] of Object.entries(prices)) {
            priceMap.set(symbol, price);
        }
    } catch (err) {
        logger.error('[PortfolioSnapshot] Failed to fetch prices: %s', err instanceof Error ? err.message : String(err));
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

    const symbols = activeCoins.map(c => c.symbol);
    const priceMap = await fetchCoinPrices(symbols);

    let deployed = 0;
    let positionsValue = 0;

    for (const coin of activeCoins) {
        const risk = (parseFloat(coin.initialBudget || '0') + (coin.dcaFilled ? parseFloat(coin.dcaBudget || '0') : 0)) * parseFloat(coin.remainingSizeFrac || '1');
        deployed += risk;

        const live = priceMap.get(coin.symbol.toUpperCase());
        const avg = parseFloat(coin.averageEntryPrice || coin.entryPrice || '0');
        if (live && avg > 0) {
            const qty = risk / avg;
            positionsValue += qty * live;
        }
    }

    const totalBudget = env.SCORECARD_TOTAL_BUDGET;
    const cashBalance = Math.max(0, totalBudget - deployed);
    const currentValue = cashBalance + positionsValue;
    const totalPnl = currentValue - totalBudget;
    const totalPnlPercent = totalBudget > 0 ? (totalPnl / totalBudget) * 100 : 0;

    const maxDrawdownPercent = await calculateMaxDrawdownPercent(currentValue);

    const snapshotAt = new Date();

    const inserted = await db.insert(portfolioSnapshots).values({
        totalBudget: String(totalBudget.toFixed(2)),
        currentValue: String(currentValue.toFixed(2)),
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
        `value:${currentValue.toFixed(2)} pnl:${totalPnl.toFixed(2)} ` +
        `active:${activeCoins.length} watchlist:${watchlistCoins.length}`
    );

    return {
        totalBudget,
        currentValue,
        totalPnl,
        totalPnlPercent,
        activeCoins: activeCoins.length,
        watchlistCoins: watchlistCoins.length,
        maxDrawdownPercent,
        cashBalance,
        snapshotAt,
    };
}