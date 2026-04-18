import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter, callGptNanoMinorUpdate, callGptNanoMasterUpdate, extractSection, gateway, deepseekGateway, callWriterStage2A, callWriterStage2B, mergeArticleStages } from '../services/openai.service';
import type { DeepAnalysisResult } from '../services/openai.service';
import type { ArticleWriterResult } from '../services/openai.service';
import { AIRateLimitError } from '../services/ai/ai-gateway';
import { validateFactualGrounding } from '../services/ai/factual-grounding';
import { auditArticleQuality } from '../services/ai/quality-auditor';
import { saveMemory } from '../services/coin-memory.service';
import { isDuplicateByEmbedding } from '../services/similarity.service';
import { storeEmbedding } from '../services/embedding.service';
import { coinNews, radarSignals, rawNewsBuffer, coinMasterArticles, coinTimelineUpdates } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne, or, isNull } from 'drizzle-orm';
import { deleteCache, deleteCachePattern, redis } from '../config/redis';

async function markBufferItemConsumed(bufferId: number): Promise<void> {
    await db.update(rawNewsBuffer)
        .set({ consumed: true })
        .where(eq(rawNewsBuffer.id, bufferId));
}

let isAiWorkflowRunning = false;

const TRIGGER_TYPE_MAP: Record<string, string> = {
    'Hack': 'security',
    'Exploit': 'security',
    'ETF': 'regulation',
    'Regulatory': 'regulation',
    'Listing': 'market',
    'Delisting': 'market',
    'Funding': 'whale',
    'Partnership': 'news',
    'Upgrade': 'technical',
};

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function selectTone(eventType: string): string {
    switch (eventType) {
        case 'Hack':
        case 'Exploit':
            return 'urgent';
        case 'ETF':
        case 'Listing':
        case 'TokenLaunch':
            return 'exciting';
        case 'Regulatory':
            return 'cautious';
        case 'Funding':
        case 'Partnership':
            return 'optimistic';
        case 'Delisting':
            return 'solemn';
        case 'Upgrade':
            return 'analytical';
        default:
            return 'professional';
    }
}

function deriveRiskLevel(impactScore: number, verdict: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM' {
    if (verdict === 'STRONG_SELL' || impactScore >= 85) return 'HIGH';
    if (verdict === 'SELL' || impactScore >= 65) return 'MEDIUM';
    return 'LOW';
}

const SYMBOL_PATTERNS: Record<string, RegExp> = {
    BTC: /\b(bitcoin|btc)\b/i,
    ETH: /\b(ethereum|eth\b)/i,
    SOL: /\b(solana|sol\b)/i,
    BNB: /\b(binance coin|bnb)\b/i,
    XRP: /\b(ripple|xrp)\b/i,
    ADA: /\b(cardano|ada)\b/i,
    DOGE: /\b(dogecoin|doge)\b/i,
    DOT: /\b(polkadot|dot)\b/i,
    AVAX: /\b(avalanche|avax)\b/i,
    MATIC: /\b(polygon|matic)\b/i,
    LINK: /\b(chainlink|link)\b/i,
    UNI: /\b(uniswap|uni)\b/i,
    ATOM: /\b(cosmos|atom)\b/i,
    FIL: /\b(filecoin|fil)\b/i,
    APT: /\b(aptos|apt)\b/i,
    SUI: /\b(sui)\b/i,
    NEAR: /\b(near\b)/i,
    OP: /\b(optimism|op\b)/i,
    ARB: /\b(arbitrum|arb)\b/i,
    WLD: /\b(worldcoin|wld)\b/i,
    PEPE: /\b(pepe)\b/i,
};

function inferSymbolFromTitle(title: string): string | null {
    for (const [symbol, pattern] of Object.entries(SYMBOL_PATTERNS)) {
        if (pattern.test(title)) return symbol;
    }
    return null;
}

const WORKFLOW_TIMEOUT_MS = 10 * 60 * 1000;

export async function runAiWorkflow(): Promise<void> {
    if (isAiWorkflowRunning) {
        console.log('⏳ [AI Workflow] Already running. Skipping this cycle.');
        return;
    }
    isAiWorkflowRunning = true;
    console.log('🤖 [AI Workflow] Started.');

    const workflowTimer = setTimeout(() => {
        console.error('[AI Workflow] TIMEOUT — forced release after 10 minutes');
        isAiWorkflowRunning = false;
        if (redis) {
            redis.del('cron:aiworkflow:lock').catch(() => {});
        }
    }, WORKFLOW_TIMEOUT_MS);

    const lockKey = 'cron:aiworkflow:lock';
    if (redis) {
        const lockAcquired = await redis.set(lockKey, '1', 'EX', 900, 'NX');
        if (!lockAcquired) {
            console.log('⏳ [AI Workflow] Mutex locked. Skipping.');
            isAiWorkflowRunning = false;
            clearTimeout(workflowTimer);
            return;
        }
    }

    try {
        const hourlyCount = await countPublishedLastHour();
        if (hourlyCount >= 5) {
            console.log('[AI Workflow] Hourly cap reached (5). Skipping.');
            return;
        }

        const threshold = await getDynamicThreshold();
        console.log(`[AI Workflow] Dynamic threshold: ${threshold}`);

        const itemsWithSymbols = await db.select()
            .from(rawNewsBuffer)
            .where(and(
                gte(rawNewsBuffer.relevanceScore, threshold),
                eq(rawNewsBuffer.processed, true),
                eq(rawNewsBuffer.consumed, false),
                isNotNull(rawNewsBuffer.symbolMentions),
                ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
            ))
            .orderBy(desc(rawNewsBuffer.relevanceScore))
            .limit(5 - hourlyCount);

        const itemsWithoutSymbols = await db.select()
            .from(rawNewsBuffer)
            .where(and(
                gte(rawNewsBuffer.relevanceScore, Math.max(threshold, 75)),
                eq(rawNewsBuffer.processed, true),
                eq(rawNewsBuffer.consumed, false),
                or(
                    isNull(rawNewsBuffer.symbolMentions),
                    eq(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
                )
            ))
            .orderBy(desc(rawNewsBuffer.relevanceScore))
            .limit(2);

        const allItems = [...itemsWithSymbols, ...itemsWithoutSymbols];

        if (allItems.length === 0) {
            console.log('[AI Workflow] No qualifying items found.');
            return;
        }

        console.log(`[AI Workflow] Found ${itemsWithSymbols.length} items with symbols, ${itemsWithoutSymbols.length} items to infer.`);

        for (const item of allItems) {
            const mentions = (item.symbolMentions as string[]) || [];
            let symbol = mentions.length > 0 ? mentions[0] : null;

            if (!symbol) {
                symbol = inferSymbolFromTitle(item.title);
            }

            if (!symbol) {
                console.log(`[AI Workflow] No symbol found for: "${item.title.slice(0, 60)}..." — skipping`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            const eventType = typeof item.eventType === 'string' ? item.eventType : 'Other';
            const eventSeverity = typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;
            let classification = (typeof item.classification === 'string' && ['MAJOR', 'MINOR', 'NOISE'].includes(item.classification)) ? item.classification : 'MINOR';

            const existingMaster = await db.select({ id: coinMasterArticles.id })
                .from(coinMasterArticles)
                .where(eq(coinMasterArticles.coinSymbol, symbol))
                .limit(1);

            if (classification === 'MINOR' && existingMaster.length === 0) {
                console.log(`[AI Workflow] Upgrading MINOR → MAJOR for ${symbol} (no master article — bootstrap)`);
                classification = 'MAJOR';
            }

            console.log(`[AI Workflow] Processing: ${symbol} (${classification}) — "${item.title.slice(0, 60)}..."`);

            if (await isDuplicateByEmbedding(item.title, symbol)) {
                console.log(`[AI Workflow] Skipping duplicate: ${symbol}`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            const triggerType = TRIGGER_TYPE_MAP[eventType] ?? 'news';

            if (classification === 'NOISE') {
                console.log(`[AI Workflow] Skipping NOISE: ${symbol}`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            if (classification === 'MINOR') {
                const master = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
                if (master.length === 0) {
                    console.log(`[AI Workflow] No master article for MINOR ${symbol}, skipping`);
                    await markBufferItemConsumed(item.id);
                    continue;
                }
                const existingHeadline = master[0].headline;
                const updateText = await callGptNanoMinorUpdate(item.title, existingHeadline);

                await db.insert(coinTimelineUpdates).values({
                    coinSymbol: symbol,
                    masterArticleId: master[0].id,
                    updateText,
                    triggerType,
                    severity: 'MINOR',
                    sourceTitle: item.title,
                    sourceHash: item.sourceHash,
                    sentiment: item.sentimentHint || null,
                    impactScore: item.relevanceScore || null,
                    convictionDelta: null,
                });

                await db.update(coinMasterArticles).set({
                    minorUpdateCount: sql`${coinMasterArticles.minorUpdateCount} + 1`,
                    lastMinorUpdate: sql`NOW()`,
                    updatedAt: sql`NOW()`,
                }).where(eq(coinMasterArticles.id, master[0].id));



                await storeEmbedding(item.id, item.title);

                console.log(`[AI Workflow] MINOR update for ${symbol}`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            // MAJOR path

            try {
                const intelligence = await getCoinIntelligence(symbol);

                const pattern = await buildTemporalPattern(symbol, eventType, eventSeverity);

                const price = await getPriceWithFallback(symbol);

                // 4d. DeepSeek Analysis (circuit breaker)
                if (deepseekBreaker.isOpen()) {
                    console.warn(`[AI Workflow] DeepSeek circuit open — skipping ${symbol}`);
                    continue;
                }

                let analysisResult: DeepAnalysisResult;
                try {
                    analysisResult = await callDeepSeekAnalysis({
                        headline: item.title,
                        intelligence,
                        pattern,
                        price,
                    });
                    deepseekBreaker.recordSuccess();
                } catch (err) {
                    if (err instanceof AIRateLimitError) {
                        console.warn(`[AI Workflow] DeepSeek rate limited for ${symbol}, retry after ${err.retryAfterMs}ms — skipping`);
                        continue;
                    }
                    deepseekBreaker.recordFailure('DeepSeek');
                    throw err;
                }

                // B2. Factual grounding — sanitize price levels
                const currentPrice = price?.price ?? 0;
                if (currentPrice > 0) {
                    const grounding = validateFactualGrounding(
                        analysisResult.supportLevels,
                        analysisResult.resistanceLevels,
                        currentPrice,
                    );
                    if (grounding.removedLevels.length > 0) {
                        console.warn(`[AI Workflow] Factual grounding removed hallucinated levels for ${symbol}:`, grounding.removedLevels);
                        analysisResult.supportLevels = grounding.sanitizedSupport;
                        analysisResult.resistanceLevels = grounding.sanitizedResistance;
                    }
                }

                // 4e. GPT-nano Article (circuit breaker)
                if (gptNanoBreaker.isOpen()) {
                    console.warn(`[AI Workflow] GPT-nano circuit open — skipping ${symbol}`);
                    continue;
                }

                const tone = selectTone(eventType);
                console.log(`[AI Workflow] Selected tone "${tone}" for ${eventType} event on ${symbol}`);

                let article: ArticleWriterResult;
                try {
                    const analysisJson = JSON.stringify({
                        ...analysisResult,
                        _historicalCases: pattern?.historicalCases?.slice(0, 3) ?? [],
                        _historicalStats: pattern ? {
                            sampleSize: pattern.sampleSize,
                            bullishRate: pattern.bullishRate,
                            avgOutcome7d: pattern.avgOutcome7d,
                        } : null,
                    });

                    const stage2A = await callWriterStage2A(analysisJson, tone);
                    if (!stage2A) {
                        article = await callGptNanoWriter(analysisJson, tone);
                    } else {
                        const stage2B = await callWriterStage2B(
                            analysisJson,
                            {
                                headline: stage2A.headline,
                                hook: stage2A.hook,
                                sentiment: analysisResult.sentiment,
                                verdict: analysisResult.verdict,
                            },
                            tone
                        );
                        article = mergeArticleStages(stage2A, stage2B);
                    }
                    gptNanoBreaker.recordSuccess();
                } catch (err) {
                    if (err instanceof AIRateLimitError) {
                        console.warn(`[AI Workflow] GPT-nano rate limited for ${symbol}, retry after ${err.retryAfterMs}ms — skipping`);
                        continue;
                    }
                    gptNanoBreaker.recordFailure('GPT-nano');
                    throw err;
                }

                // Master article logic
                const fullArticle = article.fullArticle;
                const extractedSections = {
                    coreCatalyst: extractSection(fullArticle, 'HOOK') || article.hook,
                    marketContext: extractSection(fullArticle, 'WHAT HAPPENED'),
                    strategicImpact: extractSection(fullArticle, 'WHY IT MATTERS'),
                    historicalContext: extractSection(fullArticle, 'HISTORY REPEATS?'),
                    technicalLevels: extractSection(fullArticle, 'PRICE PICTURE'),
                    riskAssessment: extractSection(fullArticle, 'RISK CHECK'),
                    bottomLine: extractSection(fullArticle, 'BOTTOM LINE'),
                };
                const missingSections = Object.entries(extractedSections)
                    .filter(([, v]) => !v)
                    .map(([k]) => k);
                if (missingSections.length > 0) {
                    console.warn(`[AI Workflow] Master article for ${symbol} has ${missingSections.length} missing sections: ${missingSections.join(', ')}`);
                }

                const master = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
                if (master.length === 0) {
                    const newMaster = {
                        coinSymbol: symbol,
                        headline: article.headline,
                        hook: article.hook,
                        metaTitle: article.metaTitle,
                        metaDescription: article.metaDescription,
                        seoKeywords: article.seoKeywords,
                        sentiment: analysisResult.sentiment,
                        verdict: analysisResult.verdict,
                        confidenceScore: analysisResult.confidenceScore,
                        convictionScore: analysisResult.confidenceScore || 0,
                        posture: 'neutral',
                        riskTags: [],
                        triggerType,
                        ...extractedSections,
                        majorUpdateCount: 1,
                        lastMajorUpdate: sql`NOW()`,
                    };
                    const insertedMaster = await db.insert(coinMasterArticles).values(newMaster).returning({ id: coinMasterArticles.id });
                    const masterId = insertedMaster[0].id;

                    // Insert MAJOR timeline
                    await db.insert(coinTimelineUpdates).values({
                        coinSymbol: symbol,
                        masterArticleId: masterId,
                        updateText: article.fullArticle.slice(0, 1000),
                        triggerType,
                        severity: 'MAJOR',
                        sourceTitle: item.title,
                        sourceHash: item.sourceHash,
                        sentiment: analysisResult.sentiment,
                        impactScore: analysisResult.impactScore,
                        convictionDelta: null,
                    });
                } else {
                    // Update existing master article
                    const existing = master[0];
                    const updatedSections = await callGptNanoMasterUpdate(analysisResult, existing);

                    await db.update(coinMasterArticles).set({
                        ...updatedSections,
                        majorUpdateCount: sql`${coinMasterArticles.majorUpdateCount} + 1`,
                        lastMajorUpdate: sql`NOW()`,
                        updatedAt: sql`NOW()`,
                    }).where(eq(coinMasterArticles.id, existing.id));

                    // Insert MAJOR timeline
                    await db.insert(coinTimelineUpdates).values({
                        coinSymbol: symbol,
                        masterArticleId: existing.id,
                        updateText: article.fullArticle.slice(0, 1000),
                        triggerType,
                        severity: 'MAJOR',
                        sourceTitle: item.title,
                        sourceHash: item.sourceHash,
                        sentiment: analysisResult.sentiment,
                        impactScore: analysisResult.impactScore,
                        convictionDelta: null,
                    });
                }

                // B1. Quality audit (cross-model: DeepSeek-R1 audits GPT-5-nano) — only for high-impact or breaking news
                if (analysisResult.impactScore >= 75 || analysisResult.isBreaking) {
                    const audit = await auditArticleQuality(deepseekGateway || gateway, JSON.stringify(analysisResult), article);
                    if (!audit.passed) {
                        console.warn(`[AI Workflow] Quality audit FAILED for ${symbol} (score: ${audit.score}):`, audit.issues);
                        if (audit.suggestion) {
                            console.warn(`[AI Workflow] Audit suggestion: ${audit.suggestion}`);
                        }
                    } else {
                        console.log(`[AI Workflow] Quality audit PASSED for ${symbol} (score: ${audit.score})`);
                    }
                } else {
                    console.log(`[AI Workflow] Skipping quality audit for ${symbol} (impact: ${analysisResult.impactScore}, breaking: ${analysisResult.isBreaking})`);
                }

                const sourceHash = crypto.createHash('sha256').update(article.headline).digest('hex');

                await storeEmbedding(item.id, item.title);

                const newsId = null;

                // 4g. Radar signal for actionable verdicts
                const actionableVerdicts = ['STRONG_BUY', 'STRONG_SELL', 'BUY', 'SELL'];
                if (actionableVerdicts.includes(analysisResult.verdict)) {
                    await db.insert(radarSignals).values({
                        coinSymbol: symbol,
                        signalText: analysisResult.signalText,
                        sentiment: analysisResult.sentiment,
                        impactScore: analysisResult.impactScore,
                        newsId,
                    }).onConflictDoNothing();
                }

                // 4h. Save to coinMemory (non-blocking)
                try {
                    await saveMemory({
                        coinSymbol: symbol,
                        eventType: eventType,
                        eventSummary: article.headline,
                        priceAtEvent: price?.price,
                        verdict: analysisResult.verdict,
                        confidenceScore: analysisResult.confidenceScore,
                        riskVerdict: deriveRiskLevel(analysisResult.impactScore, analysisResult.verdict),
                        keyDrivers: [analysisResult.analysis.mainDriver],
                        redFlags: analysisResult.analysis.riskNote ? [analysisResult.analysis.riskNote] : [],
                        sourceNewsHashes: [sourceHash],
                    });
                } catch (memErr) {
                    console.error(`[AI Workflow] Failed to save memory for ${symbol}:`, memErr);
                }

                // 4i. Redis invalidation (targeted only)
                await deleteCache(`news:${symbol}`);
                await deleteCache('insight:all');

                console.log(`[AI Workflow] Published: ${symbol} — "${article.headline.slice(0, 50)}..."`);

                await markBufferItemConsumed(item.id);

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[AI Workflow] Failed for ${symbol}:`, message);
            }
        }

        console.log('✅ [AI Workflow] Completed successfully.');

    } catch (err) {
        console.error('❌ [AI Workflow] Failed:', err);
    } finally {
        clearTimeout(workflowTimer);
        isAiWorkflowRunning = false;
        if (redis) {
            await redis.del(lockKey);
        }
    }
}

export async function backfillRadarSignals(): Promise<{ created: number }> {
    const actionableSentiments = ['bullish', 'bearish', 'strong_bullish', 'strong_bearish'];

    const existingNews = await db.select().from(coinNews).where(
        and(
            isNotNull(coinNews.sentiment),
            isNotNull(coinNews.coinSymbol),
        )
    );

    const existingRadar = await db.select({ newsId: radarSignals.newsId }).from(radarSignals);
    const radarNewsIds = new Set(existingRadar.filter(r => r.newsId != null).map(r => r.newsId));

    let created = 0;
    for (const article of existingNews) {
        if (radarNewsIds.has(article.id)) continue;
        if (!actionableSentiments.includes(article.sentiment ?? '')) continue;

        await db.insert(radarSignals).values({
            coinSymbol: article.coinSymbol,
            signalText: article.hook || article.headline,
            sentiment: article.sentiment,
            impactScore: article.impactScore,
            newsId: article.id,
        }).onConflictDoNothing();
        created++;
    }

    console.log(`[Backfill] Created ${created} radar signals from existing articles.`);
    await deleteCachePattern('radar:latest:*');
    return { created };
}

export function startAiWorkflowCron(): void {
    cron.schedule('0 * * * *', () => runAiWorkflow());
    console.log('⏰ AI Intelligence Workflow scheduled — hourly');
}
