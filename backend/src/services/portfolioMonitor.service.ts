import { db } from '../config/db';
import { env } from '../config/env';
import { portfolioCoins, portfolioTransactions, portfolioSnapshots } from '../models';
import { eq, desc } from 'drizzle-orm';
import { getLivePrices } from './binance.service';
import { logger } from '../utils/logger';
import { calculateInvestmentTpsl } from './scorecardTpslCalculator.service';
import { promoteWatchlistCoin } from './scorecardPipeline.service';

export interface PortfolioMonitorResult {
    evaluated: number;
    closed: number;
    tpHits: number;
    dcaFills: number;
    promoted: number;
    paused: boolean;
    drawdownPercent: number;
}

const DRAWDOWN_PAUSE_PERCENT = env.SCORECARD_MAX_DRAWDOWN_PERCENT;

function parseNumeric(v: string | null | undefined): number {
    if (!v) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function getOpenRisk(coin: typeof portfolioCoins.$inferSelect): number {
    const init = parseNumeric(coin.initialBudget);
    const dca = coin.dcaFilled ? parseNumeric(coin.dcaBudget) : 0;
    const frac = parseNumeric(coin.remainingSizeFrac);
    return (init + dca) * frac;
}

async function getLatestDrawdownPercent(): Promise<number> {
    try {
        const latest = await db
            .select({ maxDrawdownPercent: portfolioSnapshots.maxDrawdownPercent })
            .from(portfolioSnapshots)
            .orderBy(desc(portfolioSnapshots.snapshotAt))
            .limit(1);
        return parseNumeric(latest[0]?.maxDrawdownPercent);
    } catch {
        return 0;
    }
}

async function fetchPrices(symbols: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!symbols.length) return map;
    try {
        const prices = await getLivePrices(symbols);
        for (const [s, p] of Object.entries(prices)) if (p > 0) map.set(s, p);
    } catch (e) {
        logger.error('[PortfolioMonitor] price fetch: %s', e instanceof Error ? e.message : String(e));
    }
    return map;
}

async function recordTx(coinId: number, type: string, price: number, amount: number | null, pnl: number | null) {
    await db.insert(portfolioTransactions).values({
        coinId,
        type: type as 'entry' | 'tp1_hit' | 'tp2_hit' | 'tp3_hit' | 'sl_hit' | 'dca',
        price: String(price),
        amount: amount !== null ? String(amount) : null,
        pnl: pnl !== null ? String(pnl.toFixed(2)) : null,
    });
}

export async function runPortfolioMonitor(): Promise<PortfolioMonitorResult> {
    const result: PortfolioMonitorResult = { evaluated: 0, closed: 0, tpHits: 0, dcaFills: 0, promoted: 0, paused: false, drawdownPercent: 0 };

    const drawdown = await getLatestDrawdownPercent();
    result.drawdownPercent = drawdown;
    const paused = drawdown >= DRAWDOWN_PAUSE_PERCENT;
    result.paused = paused;
    if (paused) console.warn(`[PortfolioMonitor] PAUSED drawdown=${drawdown.toFixed(2)}%`);

    const actives = await db.select().from(portfolioCoins).where(eq(portfolioCoins.status, 'active'));
    if (!actives.length) return result;

    const symbols = actives.map(c => c.symbol);
    const priceMap = await fetchPrices(symbols);

    for (const coin of actives) {
        result.evaluated++;
        const price = priceMap.get(coin.symbol.toUpperCase());
        if (!price || price <= 0) continue;

        const avg = parseNumeric(coin.averageEntryPrice || coin.entryPrice);
        const sl = parseNumeric(coin.stopLoss);
        const tp1 = parseNumeric(coin.tp1);
        const tp2 = parseNumeric(coin.tp2);
        const tp3 = parseNumeric(coin.tp3);
        const posted = parseNumeric(coin.postedEntryPrice || coin.entryPrice);
        let frac = parseNumeric(coin.remainingSizeFrac);
        let dcaFilled = !!coin.dcaFilled;
        let tp1Hit = !!coin.tp1Hit;
        let tp2Hit = !!coin.tp2Hit;
        let realized = parseNumeric(coin.realizedPnl);

        // SL
        if (sl > 0 && price <= sl) {
            const notional = (parseNumeric(coin.initialBudget) + (dcaFilled ? parseNumeric(coin.dcaBudget) : 0)) * frac;
            const pnl = notional * ((price - avg) / avg);
            await db.update(portfolioCoins).set({
                status: 'exited', exitPrice: String(price), exitedAt: new Date(), exitReason: 'sl_hit',
                realizedPnl: String((realized + pnl).toFixed(2)), remainingSizeFrac: '0',
            }).where(eq(portfolioCoins.id, coin.id));
            await recordTx(coin.id, 'sl_hit', price, notional, pnl);
            result.closed++;
            continue;
        }

        // DCA
        if (!paused && !dcaFilled) {
            const trigger = posted * (1 + env.SCORECARD_DCA_TRIGGER_PCT);
            const plannedDca = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT;
            const cash = env.SCORECARD_TOTAL_BUDGET - actives.reduce((s, c) => s + getOpenRisk(c), 0);
            if (price <= trigger && cash >= plannedDca) {
                const newAvg = ((parseNumeric(coin.initialBudget) * posted) + (plannedDca * price)) / (parseNumeric(coin.initialBudget) + plannedDca);
                const newTpsl = calculateInvestmentTpsl(newAvg, 'LONG');
                await db.update(portfolioCoins).set({
                    dcaBudget: String(plannedDca), dcaFilled: true, averageEntryPrice: String(newAvg),
                    entryPrice: String(newAvg), tp1: String(newTpsl.tp1), tp2: String(newTpsl.tp2),
                    tp3: String(newTpsl.tp3), stopLoss: String(newTpsl.stopLoss),
                }).where(eq(portfolioCoins.id, coin.id));
                await recordTx(coin.id, 'dca', price, plannedDca, 0);
                dcaFilled = true;
                result.dcaFills++;
            }
        }

        // TP1
        if (!tp1Hit && tp1 > 0 && price >= tp1) {
            const sellFrac = env.SCORECARD_TP1_SELL_FRAC;
            const newFrac = Math.max(0, frac - sellFrac);
            const originalCapital = parseNumeric(coin.initialBudget) + (dcaFilled ? parseNumeric(coin.dcaBudget) : 0);
            const notional = originalCapital * sellFrac;
            const pnl = notional * ((price - avg) / avg);
            await db.update(portfolioCoins).set({
                tp1Hit: true, remainingSizeFrac: String(newFrac),
                realizedPnl: String((realized + pnl).toFixed(2)),
                allocatedBudget: String((originalCapital * newFrac).toFixed(2)),
            }).where(eq(portfolioCoins.id, coin.id));
            await recordTx(coin.id, 'tp1_hit', price, notional, pnl);
            tp1Hit = true;
            frac = newFrac;
            realized += pnl;
            result.tpHits++;
            if (newFrac <= 0) continue;
        }

        // TP2
        if (tp1Hit && !tp2Hit && tp2 > 0 && price >= tp2) {
            const sellFrac = env.SCORECARD_TP2_SELL_FRAC;
            const newFrac = Math.max(0, frac - sellFrac);
            const originalCapital = parseNumeric(coin.initialBudget) + (dcaFilled ? parseNumeric(coin.dcaBudget) : 0);
            const notional = originalCapital * sellFrac;
            const pnl = notional * ((price - avg) / avg);
            await db.update(portfolioCoins).set({
                tp2Hit: true, remainingSizeFrac: String(newFrac),
                realizedPnl: String((realized + pnl).toFixed(2)),
                allocatedBudget: String((originalCapital * newFrac).toFixed(2)),
            }).where(eq(portfolioCoins.id, coin.id));
            await recordTx(coin.id, 'tp2_hit', price, notional, pnl);
            tp2Hit = true;
            frac = newFrac;
            realized += pnl;
            result.tpHits++;
            if (newFrac <= 0) continue;
        }

        // TP3
        if (tp3 > 0 && price >= tp3) {
            const notional = (parseNumeric(coin.initialBudget) + (dcaFilled ? parseNumeric(coin.dcaBudget) : 0)) * frac;
            const pnl = notional * ((price - avg) / avg);
            await db.update(portfolioCoins).set({
                status: 'exited', exitPrice: String(price), exitedAt: new Date(), exitReason: 'tp3_hit',
                tp3Hit: true, realizedPnl: String((realized + pnl).toFixed(2)), remainingSizeFrac: '0',
            }).where(eq(portfolioCoins.id, coin.id));
            await recordTx(coin.id, 'tp3_hit', price, notional, pnl);
            result.closed++;
            continue;
        }
    }

    if (!paused) {
        const watchlist = await db.select().from(portfolioCoins).where(eq(portfolioCoins.status, 'watchlist')).orderBy(portfolioCoins.createdAt);
        for (const w of watchlist) {
            const ok = await promoteWatchlistCoin(w.id);
            if (ok) { result.promoted++; break; }
        }
    }

    return result;
}
