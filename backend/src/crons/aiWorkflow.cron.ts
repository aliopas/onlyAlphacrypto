import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter, callGptNanoMinorUpdate, callGptNanoMasterUpdate, extractSection, gateway, deepseekGateway } from '../services/openai.service';
import type { DeepAnalysisResult } from '../services/openai.service';
import type { ArticleWriterResult } from '../services/openai.service';
import { AIRateLimitError } from '../services/ai/ai-gateway';
import { validateFactualGrounding } from '../services/ai/factual-grounding';
import { auditArticleQuality } from '../services/ai/quality-auditor';
import { saveMemory } from '../services/coin-memory.service';
import { coinNews, radarSignals, rawNewsBuffer, coinMasterArticles, coinTimelineUpdates } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne } from 'drizzle-orm';
import { deleteCache, deleteCachePattern, redis } from '../config/redis';

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

export async function runAiWorkflow(): Promise<void> {
    if (isAiWorkflowRunning) {
        console.log('⏳ [AI Workflow] Already running. Skipping this cycle.');
        return;
    }
    isAiWorkflowRunning = true;
    console.log('🤖 [AI Workflow] Started.');

    // Redis mutex
    const lockKey = 'cron:aiworkflow:lock';
    if (redis) {
        const lockAcquired = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
        if (!lockAcquired) {
            console.log('⏳ [AI Workflow] Mutex locked. Skipping.');
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

        const items = await db.select()
            .from(rawNewsBuffer)
            .where(and(
                gte(rawNewsBuffer.relevanceScore, threshold),
                eq(rawNewsBuffer.processed, true),
                isNotNull(rawNewsBuffer.symbolMentions),
                ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
            ))
            .orderBy(desc(rawNewsBuffer.relevanceScore))
            .limit(5 - hourlyCount);

        for (const item of items) {
            const mentions = (item.symbolMentions as string[]) || [];
            if (mentions.length === 0) continue;
            const symbol = mentions[0];
            const eventType = typeof item.eventType === 'string' ? item.eventType : 'Other';
            const eventSeverity = typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;
            const classification = (typeof item.classification === 'string' && ['MAJOR', 'MINOR', 'NOISE'].includes(item.classification)) ? item.classification : 'MINOR';

            console.log(`[AI Workflow] Processing: ${symbol} (${classification}) — "${item.title.slice(0, 60)}..."`);

            const triggerType = TRIGGER_TYPE_MAP[eventType] ?? 'news';

            if (classification === 'NOISE') {
                console.log(`[AI Workflow] Skipping NOISE: ${symbol}`);
                continue;
            }

            if (classification === 'MINOR') {
                const master = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
                if (master.length === 0) {
                    console.log(`[AI Workflow] No master article for MINOR ${symbol}, skipping`);
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

                // Write to coinNews for backward compatibility
                const sourceHash = crypto.createHash('sha256').update(item.title).digest('hex');
                await db.insert(coinNews).values({
                    coinSymbol: symbol,
                    headline: `Update: ${item.title.slice(0, 50)}...`,
                    summary: updateText,
                    sentiment: item.sentimentHint || null,
                    impactScore: item.relevanceScore || null,
                    sourceHash,
                    aiProcessed: 1,
                }).onConflictDoNothing();

                console.log(`[AI Workflow] MINOR update for ${symbol}`);
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
                    article = await callGptNanoWriter(JSON.stringify(analysisResult), tone);
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
                const master = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
                if (master.length === 0) {
                    // Create new master article
                    const fullArticle = article.fullArticle;
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
                        coreCatalyst: extractSection(fullArticle, 'HOOK') || article.hook,
                        marketContext: extractSection(fullArticle, 'WHAT HAPPENED'),
                        strategicImpact: extractSection(fullArticle, 'WHY IT MATTERS'),
                        historicalContext: extractSection(fullArticle, 'HISTORY REPEATS?'),
                        technicalLevels: extractSection(fullArticle, 'PRICE PICTURE'),
                        riskAssessment: extractSection(fullArticle, 'RISK CHECK'),
                        bottomLine: extractSection(fullArticle, 'BOTTOM LINE'),
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

                // 4f. Save to coinNews
                const sourceHash = crypto.createHash('sha256').update(article.headline).digest('hex');
                const insertedNews = await db.insert(coinNews).values({
                    coinSymbol: symbol,
                    headline: article.headline,
                    summary: article.fullArticle,
                    hook: article.hook,
                    metaTitle: article.metaTitle,
                    metaDescription: article.metaDescription,
                    seoKeywords: article.seoKeywords,
                    sentiment: analysisResult.sentiment,
                    impactScore: analysisResult.impactScore,
                    isBreaking: analysisResult.isBreaking ? 1 : 0,
                    sourceHash,
                    aiProcessed: 1,
                }).onConflictDoNothing().returning({ id: coinNews.id });

                const newsId = insertedNews.length > 0 ? insertedNews[0].id : null;

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
                        riskVerdict: analysisResult.analysis.riskNote,
                        keyDrivers: [analysisResult.analysis.mainDriver],
                        redFlags: analysisResult.keyFacts,
                        sourceNewsHashes: [sourceHash],
                    });
                } catch (memErr) {
                    console.error(`[AI Workflow] Failed to save memory for ${symbol}:`, memErr);
                }

                // 4i. Redis invalidation (targeted only)
                await deleteCache(`news:${symbol}`);
                await deleteCache('insight:all');

                console.log(`[AI Workflow] Published: ${symbol} — "${article.headline.slice(0, 50)}..."`);

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[AI Workflow] Failed for ${symbol}:`, message);
            }
        }

        console.log('✅ [AI Workflow] Completed successfully.');

    } catch (err) {
        console.error('❌ [AI Workflow] Failed:', err);
    } finally {
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
