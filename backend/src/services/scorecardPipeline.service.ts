import { db } from '../config/db';
import { env } from '../config/env';
import { eq, count, and } from 'drizzle-orm';
import { portfolioCoins, portfolioTransactions } from '../models';
import { runScorecardScraper } from './telegramPortfolioScraper.service';
import { validateScorecardCoin } from './scorecardValidation.service';
import { buildCoinProfile } from './scorecardProfileBuilder.service';
import { calculateScorecardTpsl } from './scorecardTpslCalculator.service';

export interface PipelineStats {
    processed: number;
    validated: number;
    inserted: number;
    rejected: number;
    failed: number;
}

export async function runScorecardPipeline(): Promise<PipelineStats> {
    const stats: PipelineStats = { processed: 0, validated: 0, inserted: 0, rejected: 0, failed: 0 };

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
    const activeCount = activeCountArr[0]?.count ?? 0;

    for (const extraction of scraperResult.extracted) {
        stats.processed++;

        if (existingSymbols.has(extraction.symbol.toUpperCase())) {
            continue;
        }

        const validated = await validateScorecardCoin(extraction);
        if (!validated) {
            stats.rejected++;
            continue;
        }

        stats.validated++;

        const profile = await buildCoinProfile({
            symbol: validated.symbol,
            coinGeckoId: validated.coinGeckoId,
        });

        const tpslResultStrategic = await calculateScorecardTpsl({
            symbol: validated.symbol,
            entryPrice: validated.entryPrice,
            classification: 'STRATEGIC',
        });

        let tpslResult: typeof tpslResultStrategic;
        let finalClassification: 'TACTICAL' | 'STRATEGIC';

        if (!tpslResultStrategic.isRejected) {
            tpslResult = tpslResultStrategic;
            finalClassification = 'STRATEGIC';
        } else {
            const tpslResultTactical = await calculateScorecardTpsl({
                symbol: validated.symbol,
                entryPrice: validated.entryPrice,
                classification: 'TACTICAL',
            });

            if (tpslResultTactical.isRejected) {
                stats.rejected++;
                continue;
            }

            tpslResult = tpslResultTactical;
            finalClassification = 'TACTICAL';
        }

        let status: 'active' | 'watchlist' | 'exited' = 'active';
        if (activeCount >= 20 && activeCount < 30) {
            status = 'watchlist';
        } else if (activeCount >= env.SCORECARD_MAX_COINS) {
            console.log(`[ScorecardPipeline] Capacity full (${activeCount} active) — skipping ${validated.symbol}`);
            stats.rejected++;
            continue;
        }

        try {
            const insertedResult = await db.insert(portfolioCoins).values({
                symbol: validated.symbol,
                entryPrice: String(validated.entryPrice),
                currentPrice: String(validated.currentPrice),
                priceMovementAtEntry: String(validated.priceMovement),
                status,
                signalClassification: finalClassification,
                cexListings: validated.cexListings,
                allocatedBudget: String(tpslResult.allocatedBudget),
                tp1: String(tpslResult.tp1),
                tp2: String(tpslResult.tp2),
                tp3: String(tpslResult.tp3),
                stopLoss: String(tpslResult.stopLoss),
                qualityScore: Math.round(tpslResult.rr * 20),
                projectProfile: profile,
                technicalAnalysis: {
                    tpSource: tpslResult.tpSource,
                    slSource: tpslResult.slSource,
                    rr: tpslResult.rr,
                    calculatedAt: new Date().toISOString(),
                },
            } as typeof portfolioCoins.$inferInsert).returning({ id: portfolioCoins.id });

            if (insertedResult[0]) {
                const insertedCoin = insertedResult[0];
                await db.insert(portfolioTransactions).values({
                    coinId: insertedCoin.id,
                    type: 'entry',
                    price: String(validated.entryPrice),
                    amount: String(tpslResult.allocatedBudget),
                } as typeof portfolioTransactions.$inferInsert);

                existingSymbols.add(validated.symbol.toUpperCase());
                stats.inserted++;
            }
        } catch (err) {
            console.error(`[ScorecardPipeline] Failed to insert ${validated.symbol}:`, err instanceof Error ? err.message : String(err));
            stats.failed++;
        }
    }

    console.log(`[ScorecardPipeline] Done — processed:${stats.processed} validated:${stats.validated} inserted:${stats.inserted} rejected:${stats.rejected} failed:${stats.failed}`);
    return stats;
}