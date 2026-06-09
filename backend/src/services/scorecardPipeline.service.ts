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
    console.log('[ScorecardPipeline] === PIPELINE START ===');
    const stats: PipelineStats = { processed: 0, validated: 0, inserted: 0, rejected: 0, failed: 0 };

    console.log('[ScorecardPipeline] Step 1: Running scraper...');
    const scraperResult = await runScorecardScraper();
    if (scraperResult.extracted.length === 0) {
        console.log('[ScorecardPipeline] No coins extracted — skipping pipeline');
        return stats;
    }
    console.log(`[ScorecardPipeline] Scraper returned ${scraperResult.extracted.length} coins: ${scraperResult.extracted.map(e => e.symbol).join(', ')}`);

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
    console.log(`[ScorecardPipeline] Active coins: ${activeCount}, Existing total: ${existing.length}`);

    for (const extraction of scraperResult.extracted) {
        stats.processed++;
        console.log(`[ScorecardPipeline] --- Processing ${extraction.symbol} (entryPrice=$${extraction.entryPrice}) ---`);

        if (existingSymbols.has(extraction.symbol.toUpperCase())) {
            console.log(`[ScorecardPipeline] ${extraction.symbol}: Already exists — skipping`);
            continue;
        }

        console.log(`[ScorecardPipeline] ${extraction.symbol}: Step 2 — Validating...`);
        const validated = await validateScorecardCoin(extraction);
        if (!validated) {
            console.log(`[ScorecardPipeline] ${extraction.symbol}: REJECTED at validation`);
            stats.rejected++;
            continue;
        }
        console.log(`[ScorecardPipeline] ${extraction.symbol}: Validated — price=$${validated.currentPrice}, movement=${validated.priceMovement.toFixed(2)}%, cex=${validated.cexListings}`);

        stats.validated++;

        console.log(`[ScorecardPipeline] ${extraction.symbol}: Step 3 — Building profile...`);
        const profile = await buildCoinProfile({
            symbol: validated.symbol,
        });
        console.log(`[ScorecardPipeline] ${extraction.symbol}: Profile built — project=${profile.projectName}`);

        console.log(`[ScorecardPipeline] ${extraction.symbol}: Step 4 — Calculating TP/SL (STRATEGIC)...`);
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
            console.log(`[ScorecardPipeline] ${extraction.symbol}: STRATEGIC accepted — RR=${tpslResult.rr.toFixed(2)}`);
        } else {
            console.log(`[ScorecardPipeline] ${extraction.symbol}: STRATEGIC rejected (${tpslResultStrategic.rejectionReason}) — trying TACTICAL...`);
            const tpslResultTactical = await calculateScorecardTpsl({
                symbol: validated.symbol,
                entryPrice: validated.entryPrice,
                classification: 'TACTICAL',
            });

            if (tpslResultTactical.isRejected) {
                console.log(`[ScorecardPipeline] ${extraction.symbol}: TACTICAL also rejected (${tpslResultTactical.rejectionReason})`);
                stats.rejected++;
                continue;
            }

            tpslResult = tpslResultTactical;
            finalClassification = 'TACTICAL';
            console.log(`[ScorecardPipeline] ${extraction.symbol}: TACTICAL accepted — RR=${tpslResult.rr.toFixed(2)}`);
        }

        let status: 'active' | 'watchlist' | 'exited' = 'active';
        if (activeCount >= 20 && activeCount < 30) {
            status = 'watchlist';
        } else if (activeCount >= env.SCORECARD_MAX_COINS) {
            console.log(`[ScorecardPipeline] Capacity full (${activeCount} active) — skipping ${validated.symbol}`);
            stats.rejected++;
            continue;
        }

        console.log(`[ScorecardPipeline] ${extraction.symbol}: Step 5 — Inserting (status=${status}, class=${finalClassification})...`);
        console.log(`[ScorecardPipeline] ${extraction.symbol}: TP1=${tpslResult.tp1} TP2=${tpslResult.tp2} TP3=${tpslResult.tp3} SL=${tpslResult.stopLoss}`);

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
                console.log(`[ScorecardPipeline] ${extraction.symbol}: INSERTED successfully (id=${insertedCoin.id})`);
            }
        } catch (err) {
            console.error(`[ScorecardPipeline] ${extraction.symbol}: INSERT FAILED:`, err instanceof Error ? err.message : String(err));
            stats.failed++;
        }
    }

    console.log(`[ScorecardPipeline] === PIPELINE DONE — processed:${stats.processed} validated:${stats.validated} inserted:${stats.inserted} rejected:${stats.rejected} failed:${stats.failed} ===`);
    return stats;
}