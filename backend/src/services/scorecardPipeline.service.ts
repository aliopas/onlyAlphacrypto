import { db } from '../config/db';
import { env } from '../config/env';
import { eq, count } from 'drizzle-orm';
import { portfolioCoins, portfolioTransactions } from '../models';
import { runScorecardScraper } from './telegramPortfolioScraper.service';
import { validateScorecardCoin } from './scorecardValidation.service';
import { buildCoinProfile } from './scorecardProfileBuilder.service';
import { calculateInvestmentTpsl } from './scorecardTpslCalculator.service';

export interface PipelineStats {
    processed: number;
    validated: number;
    inserted: number;
    rejected: number;
    failed: number;
    watchlisted: number;
    promoted: number;
}

function getOpenRisk(coin: typeof portfolioCoins.$inferSelect): number {
    const initial = parseFloat(coin.initialBudget || '0');
    const dca = coin.dcaFilled ? parseFloat(coin.dcaBudget || '0') : 0;
    const frac = parseFloat(coin.remainingSizeFrac || '1');
    return (initial + dca) * frac;
}

async function getCashAvailable(totalBudget: number): Promise<number> {
    const active = await db
        .select()
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'));
    const openRisk = active.reduce((sum, c) => sum + getOpenRisk(c), 0);
    return totalBudget - openRisk;
}

export async function promoteWatchlistCoin(coinId: number): Promise<boolean> {
    const coins = await db
        .select()
        .from(portfolioCoins)
        .where(eq(portfolioCoins.id, coinId))
        .limit(1);
    const coin = coins[0];
    if (!coin || coin.status !== 'watchlist') return false;

    const validated = await validateScorecardCoin({
        symbol: coin.symbol,
        entryPrice: parseFloat(coin.postedEntryPrice || coin.entryPrice || '0'),
        direction: 'LONG',
    });
    if (!validated) return false;

    const activeCountArr = await db
        .select({ count: count() })
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'))
        .limit(1);
    const activeCount = activeCountArr[0]?.count ?? 0;
    if (activeCount >= env.SCORECARD_MAX_ACTIVE) return false;

    const cash = await getCashAvailable(env.SCORECARD_TOTAL_BUDGET);
    const tpsl = calculateInvestmentTpsl(validated.entryPrice, 'LONG');
    const initialBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;
    if (cash < initialBudget) return false;

    await db.transaction(async (tx) => {
        await tx.update(portfolioCoins)
            .set({
                status: 'active',
                entryPrice: String(validated.entryPrice),
                currentPrice: String(validated.currentPrice),
                priceMovementAtEntry: String(validated.priceMovement),
                allocatedBudget: String(initialBudget),
                initialBudget: String(initialBudget),
                dcaBudget: String(tpsl.dcaBudget),
                remainingSizeFrac: '1',
                dcaFilled: false,
                tp1Hit: false,
                tp2Hit: false,
                tp3Hit: false,
                realizedPnl: '0',
                tp1: String(tpsl.tp1),
                tp2: String(tpsl.tp2),
                tp3: String(tpsl.tp3),
                stopLoss: String(tpsl.stopLoss),
                averageEntryPrice: String(validated.entryPrice),
                postedEntryPrice: String(validated.entryPrice),
                direction: 'LONG',
            })
            .where(eq(portfolioCoins.id, coinId));

        await tx.insert(portfolioTransactions).values({
            coinId,
            type: 'entry',
            price: String(validated.entryPrice),
            amount: String(initialBudget),
        });
    });
    return true;
}

export async function runScorecardPipeline(): Promise<PipelineStats> {
    console.log('[ScorecardPipeline] === PIPELINE START ===');
    const stats: PipelineStats = { processed: 0, validated: 0, inserted: 0, rejected: 0, failed: 0, watchlisted: 0, promoted: 0 };

    console.log('[ScorecardPipeline] Step 1: Running scraper...');
    const scraperResult = await runScorecardScraper();
    if (scraperResult.extracted.length === 0) {
        console.log('[ScorecardPipeline] No coins extracted — skipping pipeline');
        return stats;
    }

    const existingSymbols = new Set<string>();
    const existing = await db
        .select({ symbol: portfolioCoins.symbol })
        .from(portfolioCoins);
    for (const coin of existing) {
        existingSymbols.add(coin.symbol.toUpperCase());
    }

    const activeCountArr = await db
        .select({ count: count() })
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'))
        .limit(1);
    let activeCount = activeCountArr[0]?.count ?? 0;
    let cash = await getCashAvailable(env.SCORECARD_TOTAL_BUDGET);
    console.log(`[ScorecardPipeline] Active: ${activeCount}, Cash: $${cash.toFixed(2)}`);

    for (const extraction of scraperResult.extracted) {
        stats.processed++;
        if (existingSymbols.has(extraction.symbol.toUpperCase())) continue;

        const validated = await validateScorecardCoin(extraction);
        if (!validated) {
            stats.rejected++;
            continue;
        }
        stats.validated++;

        const profile = await buildCoinProfile({ symbol: validated.symbol });
        const tpsl = calculateInvestmentTpsl(validated.entryPrice, 'LONG');
        const initialBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;

        let status: 'active' | 'watchlist' = 'active';
        let allocated = initialBudget;
        let insertTx = true;

        if (activeCount >= env.SCORECARD_MAX_ACTIVE) {
            status = 'watchlist';
            allocated = 0;
            insertTx = false;
        } else if (cash < initialBudget) {
            status = 'watchlist';
            allocated = 0;
            insertTx = false;
        }

        try {
            await db.transaction(async (tx) => {
                const inserted = await tx.insert(portfolioCoins).values({
                    symbol: validated.symbol,
                    entryPrice: String(validated.entryPrice),
                    currentPrice: String(validated.currentPrice),
                    priceMovementAtEntry: String(validated.priceMovement),
                    status,
                    signalClassification: 'STRATEGIC',
                    cexListings: validated.cexListings,
                    allocatedBudget: String(allocated),
                    tp1: String(tpsl.tp1),
                    tp2: String(tpsl.tp2),
                    tp3: String(tpsl.tp3),
                    stopLoss: String(tpsl.stopLoss),
                    projectProfile: profile,
                    direction: 'LONG',
                    postedEntryPrice: String(validated.entryPrice),
                    averageEntryPrice: String(validated.entryPrice),
                    initialBudget: String(initialBudget),
                    dcaBudget: String(env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT),
                    remainingSizeFrac: '1',
                    dcaFilled: false,
                    tp1Hit: false,
                    tp2Hit: false,
                    tp3Hit: false,
                    realizedPnl: '0',
                }).returning({ id: portfolioCoins.id });

                const id = inserted[0]?.id;
                if (insertTx && id) {
                    await tx.insert(portfolioTransactions).values({
                        coinId: id,
                        type: 'entry',
                        price: String(validated.entryPrice),
                        amount: String(initialBudget),
                    });
                }
            });

            existingSymbols.add(validated.symbol.toUpperCase());
            if (status === 'active') {
                stats.inserted++;
                activeCount += 1;
                cash -= initialBudget;
            } else {
                stats.watchlisted++;
            }
        } catch (err) {
            stats.failed++;
        }
    }

    console.log(`[ScorecardPipeline] DONE — processed:${stats.processed} validated:${stats.validated} inserted:${stats.inserted} watchlisted:${stats.watchlisted} rejected:${stats.rejected}`);
    return stats;
}