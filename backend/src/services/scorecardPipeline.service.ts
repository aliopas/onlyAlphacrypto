import { db } from '../config/db';
import { env } from '../config/env';
import { eq, count } from 'drizzle-orm';
import {
    portfolioCoins,
    portfolioTransactions,
    portfolioSnapshots,
    telegramPortfolioPosts,
} from '../models';
import {
    runScorecardScraper,
    extractFromStoredPortfolioPost,
    type VisionExtractionResult,
} from './telegramPortfolioScraper.service';
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

export type ProcessPostOutcome =
    | 'added_active'
    | 'added_watchlist'
    | 'rejected'
    | 'skipped_exists'
    | 'failed';

export interface ProcessPostSymbolResult {
    symbol: string;
    outcome: ProcessPostOutcome;
    reason?: string;
    coinId?: number;
}

export interface ProcessPostResult {
    postId: number;
    messageId: string;
    results: ProcessPostSymbolResult[];
    summary: {
        added: number;
        watchlisted: number;
        rejected: number;
        skipped: number;
        failed: number;
    };
}

export interface ResetModelPortfolioResult {
    ok: true;
    deleted: {
        coins: number;
        transactions: number;
        snapshots: number;
    };
    totalCapital: number;
}

async function insertValidatedCoin(
    validated: {
        symbol: string;
        entryPrice: number;
        currentPrice: number;
        priceMovement: number;
        cexListings: string;
    },
    activeCount: number,
    cash: number
): Promise<{ outcome: 'added_active' | 'added_watchlist'; coinId: number; cashDelta: number }> {
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

    const inserted = await db.transaction(async (tx) => {
        const rows = await tx.insert(portfolioCoins).values({
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

        const id = rows[0]?.id;
        if (!id) {
            throw new Error('Insert returned no id');
        }

        if (insertTx) {
            await tx.insert(portfolioTransactions).values({
                coinId: id,
                type: 'entry',
                price: String(validated.entryPrice),
                amount: String(initialBudget),
            });
        }

        return id;
    });

    return {
        outcome: status === 'active' ? 'added_active' : 'added_watchlist',
        coinId: inserted,
        cashDelta: status === 'active' ? initialBudget : 0,
    };
}

/**
 * Process a single stored telegram portfolio post: re-extract symbol+entry for that
 * message only, then validate + insert using the same investment path as the pipeline.
 */
export async function processTelegramPortfolioPost(postId: number): Promise<ProcessPostResult> {
    const posts = await db
        .select()
        .from(telegramPortfolioPosts)
        .where(eq(telegramPortfolioPosts.id, postId))
        .limit(1);

    const post = posts[0];
    if (!post) {
        throw new Error('POST_NOT_FOUND');
    }

    const extractions: VisionExtractionResult[] = await extractFromStoredPortfolioPost({
        messageId: post.messageId,
        content: post.content,
        imageUrl: post.imageUrl,
    });

    if (extractions.length === 0) {
        throw new Error('NO_EXTRACTED_SYMBOLS');
    }

    const symbolList = extractions.map((e) => e.symbol.toUpperCase());
    await db
        .update(telegramPortfolioPosts)
        .set({
            isAnalyzed: true,
            extractedSymbols: symbolList.join(','),
            analyzedAt: new Date(),
        })
        .where(eq(telegramPortfolioPosts.id, postId));

    const existing = await db.select({ symbol: portfolioCoins.symbol }).from(portfolioCoins);
    const existingSymbols = new Set(existing.map((c) => c.symbol.toUpperCase()));

    const activeCountArr = await db
        .select({ count: count() })
        .from(portfolioCoins)
        .where(eq(portfolioCoins.status, 'active'))
        .limit(1);
    let activeCount = activeCountArr[0]?.count ?? 0;
    let cash = await getCashAvailable(env.SCORECARD_TOTAL_BUDGET);

    const results: ProcessPostSymbolResult[] = [];
    const summary = { added: 0, watchlisted: 0, rejected: 0, skipped: 0, failed: 0 };

    for (const extraction of extractions) {
        const symbol = extraction.symbol.toUpperCase();

        if (existingSymbols.has(symbol)) {
            results.push({ symbol, outcome: 'skipped_exists', reason: 'Already in portfolio_coins' });
            summary.skipped += 1;
            continue;
        }

        try {
            const validated = await validateScorecardCoin(extraction);
            if (!validated) {
                results.push({
                    symbol,
                    outcome: 'rejected',
                    reason: 'Failed validation (LONG only, Binance USDT, entry band)',
                });
                summary.rejected += 1;
                continue;
            }

            const inserted = await insertValidatedCoin(validated, activeCount, cash);
            existingSymbols.add(symbol);

            if (inserted.outcome === 'added_active') {
                activeCount += 1;
                cash -= inserted.cashDelta;
                results.push({
                    symbol,
                    outcome: 'added_active',
                    coinId: inserted.coinId,
                    reason: 'Inserted as active',
                });
                summary.added += 1;
            } else {
                results.push({
                    symbol,
                    outcome: 'added_watchlist',
                    coinId: inserted.coinId,
                    reason: activeCount >= env.SCORECARD_MAX_ACTIVE
                        ? 'Capacity full — watchlist'
                        : 'Insufficient cash — watchlist',
                });
                summary.watchlisted += 1;
            }
        } catch (err) {
            results.push({
                symbol,
                outcome: 'failed',
                reason: err instanceof Error ? err.message : 'Insert failed',
            });
            summary.failed += 1;
        }
    }

    return {
        postId: post.id,
        messageId: post.messageId,
        results,
        summary,
    };
}

/**
 * Hard-reset Model Portfolio: delete all transactions, coins, and snapshots.
 * Does NOT touch telegram_portfolio_posts.
 */
export async function resetModelPortfolio(): Promise<ResetModelPortfolioResult> {
    const result = await db.transaction(async (tx) => {
        const deletedTx = await tx.delete(portfolioTransactions).returning({ id: portfolioTransactions.id });
        const deletedCoins = await tx.delete(portfolioCoins).returning({ id: portfolioCoins.id });
        const deletedSnapshots = await tx.delete(portfolioSnapshots).returning({ id: portfolioSnapshots.id });
        return {
            transactions: deletedTx.length,
            coins: deletedCoins.length,
            snapshots: deletedSnapshots.length,
        };
    });

    return {
        ok: true,
        deleted: {
            coins: result.coins,
            transactions: result.transactions,
            snapshots: result.snapshots,
        },
        totalCapital: env.SCORECARD_TOTAL_BUDGET,
    };
}