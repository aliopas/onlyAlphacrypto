import { db } from '../config/db';
import { env } from '../config/env';
import { portfolioCoins, portfolioTransactions, portfolioSnapshots } from '../models';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getLivePrices } from './binance.service';
import { logger } from '../utils/logger';

export interface PortfolioMonitorResult {
    evaluated: number;
    closed: number;
    tpHits: number;
    paused: boolean;
    drawdownPercent: number;
}

const DRAWDOWN_PAUSE_PERCENT = env.SCORECARD_MAX_DRAWDOWN_PERCENT;

async function fetchBinancePrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    if (symbols.length === 0) return priceMap;

    try {
        // Use the resilient binance.service bulk price endpoint (cached, rate-limited, retried)
        // instead of a raw fetch that downloads ALL thousands of symbols and has no protection.
        const prices = await getLivePrices(symbols);
        for (const [symbol, price] of Object.entries(prices)) {
            if (price > 0) {
                priceMap.set(symbol, price);
            }
        }
    } catch (err) {
        logger.error('[PortfolioMonitor] Failed to fetch Binance prices: %s', err instanceof Error ? err.message : String(err));
    }

    return priceMap;
}

async function getLatestDrawdownPercent(): Promise<number> {
    try {
        const latest = await db
            .select({ maxDrawdownPercent: portfolioSnapshots.maxDrawdownPercent })
            .from(portfolioSnapshots)
            .orderBy(desc(portfolioSnapshots.snapshotAt))
            .limit(1);

        if (!latest[0]?.maxDrawdownPercent) return 0;
        return parseFloat(String(latest[0].maxDrawdownPercent)) || 0;
    } catch (err) {
        console.error('[PortfolioMonitor] Failed to fetch latest drawdown:', err instanceof Error ? err.message : String(err));
        return 0;
    }
}

async function getExistingPartialTpHits(coinIds: number[]): Promise<Set<string>> {
    if (coinIds.length === 0) return new Set<string>();

    const rows = await db
        .select({
            coinId: portfolioTransactions.coinId,
            type: portfolioTransactions.type,
        })
        .from(portfolioTransactions)
        .where(and(
            inArray(portfolioTransactions.coinId, coinIds),
            inArray(portfolioTransactions.type, ['tp1_hit', 'tp2_hit'])
        ));

    return new Set(rows.map(r => `${r.coinId}:${r.type}`));
}

function parseNumeric(value: string | null): number {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function computeRealizedPnl(coin: typeof portfolioCoins.$inferSelect, currentPrice: number): number {
    const entry = parseNumeric(coin.entryPrice);
    const budget = parseNumeric(coin.allocatedBudget);
    if (entry <= 0 || budget <= 0) return 0;

    const quantity = budget / entry;
    const exitValue = quantity * currentPrice;
    return exitValue - budget;
}

async function recordPortfolioTransaction(
    coinId: number,
    type: 'tp1_hit' | 'tp2_hit' | 'tp3_hit' | 'sl_hit',
    currentPrice: number,
    pnl: number
): Promise<void> {
    await db.insert(portfolioTransactions).values({
        coinId,
        type,
        price: String(currentPrice),
        amount: null,
        pnl: String(pnl.toFixed(2)),
    });
}

async function closeCoin(coin: typeof portfolioCoins.$inferSelect, currentPrice: number, reason: 'tp3_hit' | 'sl_hit'): Promise<void> {
    const pnl = computeRealizedPnl(coin, currentPrice);

    await db.update(portfolioCoins)
        .set({
            status: 'exited',
            currentPrice: String(currentPrice),
            updatedAt: new Date(),
        })
        .where(eq(portfolioCoins.id, coin.id));

    await recordPortfolioTransaction(coin.id, reason, currentPrice, pnl);

    console.log(`[PortfolioMonitor] Closed ${coin.symbol} (${reason}) at $${currentPrice.toFixed(8)} pnl=$${pnl.toFixed(2)}`);
}

async function recordPartialTp(coin: typeof portfolioCoins.$inferSelect, currentPrice: number, reason: 'tp1_hit' | 'tp2_hit'): Promise<void> {
    await db.update(portfolioCoins)
        .set({
            currentPrice: String(currentPrice),
            updatedAt: new Date(),
        })
        .where(eq(portfolioCoins.id, coin.id));

    await recordPortfolioTransaction(coin.id, reason, currentPrice, 0);

    console.log(`[PortfolioMonitor] ${coin.symbol} ${reason} at $${currentPrice.toFixed(8)}`);
}

export async function runPortfolioMonitor(): Promise<PortfolioMonitorResult> {
    const result: PortfolioMonitorResult = {
        evaluated: 0,
        closed: 0,
        tpHits: 0,
        paused: false,
        drawdownPercent: 0,
    };

    const drawdown = await getLatestDrawdownPercent();
    result.drawdownPercent = drawdown;

    if (drawdown >= DRAWDOWN_PAUSE_PERCENT) {
        console.warn(`[PortfolioMonitor] PAUSED — portfolio drawdown ${drawdown.toFixed(2)}% >= ${DRAWDOWN_PAUSE_PERCENT}%`);
        result.paused = true;
        return result;
    }

    const activeCoins = await db
        .select()
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'));

    if (activeCoins.length === 0) {
        console.log('[PortfolioMonitor] No active coins to evaluate');
        return result;
    }

    const coinIds = activeCoins.map(c => c.id);
    const existingHits = await getExistingPartialTpHits(coinIds);

    const symbols = activeCoins.map(c => c.symbol);
    const priceMap = await fetchBinancePrices(symbols);

    for (const coin of activeCoins) {
        result.evaluated++;

        const currentPrice = priceMap.get(coin.symbol.toUpperCase());
        if (!currentPrice || currentPrice <= 0) {
            console.warn(`[PortfolioMonitor] No Binance price for ${coin.symbol} — skipping`);
            continue;
        }

        const sl = parseNumeric(coin.stopLoss);
        const tp1 = parseNumeric(coin.tp1);
        const tp2 = parseNumeric(coin.tp2);
        const tp3 = parseNumeric(coin.tp3);

        if (sl > 0 && currentPrice <= sl) {
            await closeCoin(coin, currentPrice, 'sl_hit');
            result.closed++;
            continue;
        }

        if (tp3 > 0 && currentPrice >= tp3) {
            await closeCoin(coin, currentPrice, 'tp3_hit');
            result.closed++;
            continue;
        }

        if (tp2 > 0 && currentPrice >= tp2 && !existingHits.has(`${coin.id}:tp2_hit`)) {
            await recordPartialTp(coin, currentPrice, 'tp2_hit');
            result.tpHits++;
            continue;
        }

        if (tp1 > 0 && currentPrice >= tp1 && !existingHits.has(`${coin.id}:tp1_hit`)) {
            await recordPartialTp(coin, currentPrice, 'tp1_hit');
            result.tpHits++;
            continue;
        }
    }

    return result;
}
