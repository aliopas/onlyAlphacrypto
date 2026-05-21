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
import { getHistoricalEventStats } from '../services/historicalEventStats.service';
import { compareWithHistoricalEvents } from '../services/historicalEventComparison.service';
import { updateEventImpactConfidence } from '../services/eventImpactPersistence.service';
import { PromptFactory } from '../services/ai/prompt-factory';
import { isTrackedCoin } from '../config/coins';
import { AIRateLimitError } from '../services/ai/ai-gateway';
import { validateFactualGrounding } from '../services/ai/factual-grounding';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { auditArticleQuality } from '../services/ai/quality-auditor';
import { saveMemory } from '../services/coin-memory.service';
import { isDuplicateByEmbedding } from '../services/similarity.service';
import { storeEmbedding } from '../services/embedding.service';
import { coinNews, radarSignals, rawNewsBuffer, coinMasterArticles, coinTimelineUpdates, signalPerformance, coinNewsHistory } from '../models/market.model';
import { shouldUpdateOutlook, saveStrategicOutlook, buildSmartEventResponse } from '../services/strategicOutlook.service';
import { decideSignalAction, executeSignalDecision } from '../services/signalManager.service';
import { classifySignalOutcome, classifySignal, deriveDirectionFromVerdict } from '../services/signalClassification.service';
import { calculateTpsl } from '../services/tpslCalculator.service';
import { calculateTpslV2 } from '../services/tpslCalculatorV2.service';
import { validateTpslSanity } from '../services/tpslSanityGate.service';
import { analyzeTechnicals } from '../services/technicalAnalysis.service';
import { insertShadowSignal } from '../services/shadowSignals.service';
import type { TrendLabel, TechnicalAnalysisFullResult } from '../services/technicalAnalysis.service';
import { buildMtfContext } from '../services/mtfContext.service';
import { getNearbyLevels } from '../services/levelIntelligence.service';
import { ScenarioTrackerService } from '../services/scenarioTracker.service';
import { calculateDailyTrend } from '../services/dailyTrend.service';
import type { TrendLabel as DailyTrendLabel } from '../services/dailyTrend.service';
import { detectMarketRegime, getRegimeEffects } from '../services/marketRegime.service';
import { eq, gte, and, desc, sql, isNotNull, ne, or, isNull } from 'drizzle-orm';
import { deleteCache, deleteCachePattern, redis } from '../config/redis';

async function markBufferItemConsumed(bufferId: number): Promise<void> {
    await db.update(rawNewsBuffer)
        .set({ consumedAt: sql`NOW()` })
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
    'TokenLaunch': 'market',
    'Fed_Rate': 'macro',
    'CPI': 'macro',
    'Geopolitical': 'macro',
    'Influencer_Statement': 'personality',
    'Executive_Change': 'corporate',
    'Large_Transfer': 'whale',
    'Token_Unlock': 'protocol',
    'Exchange_Netflow': 'whale',
};

// ─── Shadow Mode Helper Functions ─────────────────────────────────────────────

function deriveAlgorithmDirection(taResult: TechnicalAnalysisFullResult): 'bullish' | 'bearish' | 'neutral' {
    const verdict = deriveAlgorithmVerdict(taResult);
    if (verdict === 'BULLISH') return 'bullish';
    if (verdict === 'BEARISH') return 'bearish';
    return 'neutral';
}

/**
 * Maps AI output verdict (BUY/SELL/STRONG_BUY/STRONG_SELL) to internal direction.
 * This receives AI output — BUY/SELL terminology is expected here (AI returns these values).
 */
function verdictToDirection(verdict: string): 'bullish' | 'bearish' | 'neutral' {
    if (verdict === 'STRONG_BUY' || verdict === 'BUY') return 'bullish';
    if (verdict === 'STRONG_SELL' || verdict === 'SELL') return 'bearish';
    return 'neutral';
}

function deriveAlgorithmVerdict(taResult: TechnicalAnalysisFullResult): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    let verdict: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    const sp = taResult.structure.pattern;
    if (sp === 'BOS_BULLISH' || sp === 'HH_HL') {
        verdict = 'BULLISH';
    } else if (sp === 'BOS_BEARISH' || sp === 'LH_LL') {
        verdict = 'BEARISH';
    } else if (sp === 'CHOCH_BULLISH') {
        verdict = 'BULLISH';
    } else if (sp === 'CHOCH_BEARISH') {
        verdict = 'BEARISH';
    } else if (sp === 'FAILED_BOS') {
        verdict = 'NEUTRAL';
    } else if (sp === 'NONE') {
        const cp = taResult.candlePattern;
        if (cp.direction === 'bullish' && cp.isValid) {
            verdict = 'BULLISH';
        } else if (cp.direction === 'bearish' && cp.isValid) {
            verdict = 'BEARISH';
        } else {
            switch (taResult.trend) {
                case 'STRONG_BULLISH':
                case 'BULLISH':
                    verdict = 'BULLISH';
                    break;
                case 'STRONG_BEARISH':
                case 'BEARISH':
                    verdict = 'BEARISH';
                    break;
                default:
                    verdict = 'NEUTRAL';
            }
        }
    }

    return verdict;
}

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
        case 'Fed_Rate':
            return 'cautious';
        case 'CPI':
            return 'analytical';
        case 'Geopolitical':
            return 'cautious';
        case 'Influencer_Statement':
            return 'exciting';
        case 'Executive_Change':
            return 'analytical';
        case 'Large_Transfer':
            return 'analytical';
        case 'Token_Unlock':
            return 'analytical';
        case 'Exchange_Netflow':
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
    AVAX: /\b(avalanche|avax)\b/i,
    LINK: /\b(chainlink|link)\b/i,
    SUI: /\b(sui)\b/i,
    TON: /\b(ton\b)/i,
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

        // Cache for Phase 1 event tracking (per workflow run)
        let btcPriceCached: number | null = null;
        let ethPriceCached: number | null = null;
        let fearGreedCached: number | null = null;
        let btcPriceFetched = false;
        let ethPriceFetched = false;
        let fearGreedFetched = false;

        const itemsWithSymbols = await db.select()
            .from(rawNewsBuffer)
            .where(and(
                gte(rawNewsBuffer.relevanceScore, threshold),
                eq(rawNewsBuffer.processed, true),
                isNull(rawNewsBuffer.consumedAt),
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
                isNull(rawNewsBuffer.consumedAt),
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

            // Coin filter: skip non-tracked coins
            if (symbol && !isTrackedCoin(symbol)) {
                console.log(`[AI Workflow] Coin ${symbol} not in tracked list — skipping item ${item.id}`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            if (!symbol) {
                console.log(`[AI Workflow] No symbol found for: "${item.title.slice(0, 60)}..." — skipping`);
                await markBufferItemConsumed(item.id);
                continue;
            }

            const eventType = typeof item.eventType === 'string' ? item.eventType : 'Other';
            const eventSeverity = typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;
            let classification = (typeof item.classification === 'string' && ['MAJOR', 'MINOR', 'NOISE'].includes(item.classification)) ? item.classification : 'MINOR';

            const eventScope = eventType === 'ETF' || eventType === 'Regulatory' ? 'MARKET' : 'COIN';

            // Fetch historical event stats for AI context
            let historicalStats: string | undefined;
            try {
                const stats = await getHistoricalEventStats({
                    coinSymbol: symbol,
                    eventType,
                    eventScope,
                    sentiment: item.sentimentHint || 'neutral',
                });
                historicalStats = new PromptFactory().buildHistoricalStatsContext(stats);
            } catch (statsErr) {
                console.warn(`[AI Workflow] Failed to fetch historical stats for ${symbol}:`, statsErr);
                historicalStats = undefined;
            }

            // Fetch event impact stats for AI context (behind flag)
            let eventImpactContext: string | undefined;
            if (env.EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED) {
                try {
                    const comparisonResult = await compareWithHistoricalEvents({
                        eventType,
                        coinSymbol: symbol,
                        horizon: '24h',
                    });

                    if (comparisonResult.status === 'success' && comparisonResult.contextString) {
                        eventImpactContext = new PromptFactory().buildEventImpactContext(comparisonResult.contextString);
                        console.log(`[AI Workflow] Event impact stats injected for ${symbol} — ${eventType}`);
                    } else {
                        console.log(`[AI Workflow] Event impact stats skipped for ${symbol} — ${comparisonResult.status}`);
                    }
                } catch (statsErr) {
                    console.error(`[AI Workflow] Failed to fetch event impact stats for ${symbol}:`, statsErr instanceof Error ? statsErr.message : String(statsErr));
                }
            }

            // TODO: Store classification confidence if available (requires triage result with confidence)

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
                const recentTimelineRows = await db.select({
                    updateText: coinTimelineUpdates.updateText,
                    createdAt: coinTimelineUpdates.createdAt,
                    severity: coinTimelineUpdates.severity,
                })
                    .from(coinTimelineUpdates)
                    .where(eq(coinTimelineUpdates.masterArticleId, master[0].id))
                    .orderBy(desc(coinTimelineUpdates.createdAt))
                    .limit(3);

                const updatePrice = await getPriceWithFallback(symbol);

                const updateText = await callGptNanoMinorUpdate({
                    newsTitle: item.title,
                    existingHeadline: existingHeadline,
                    coinSymbol: symbol,
                    currentPrice: updatePrice?.price ?? null,
                    priceChange24h: updatePrice?.change24h ?? null,
                    recentTimeline: recentTimelineRows.map(r => ({
                        updateText: r.updateText,
                        createdAt: r.createdAt,
                        severity: r.severity,
                    })),
                });

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

                // 4c. Fetch nearby levels (non-blocking)
                let nearPriceLevels;
                try {
                    if (price?.price) {
                        nearPriceLevels = await getNearbyLevels(symbol, price.price, 5);
                    }
                } catch (error) {
                    console.warn(`[AI Workflow] Failed to fetch levels for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
                }

                // 4d. DeepSeek Analysis (circuit breaker)
                if (deepseekBreaker.isOpen()) {
                    console.warn(`[AI Workflow] DeepSeek circuit open — skipping ${symbol}`);
                    continue;
                }

                let mtfContext: Parameters<typeof callDeepSeekAnalysis>[0]['mtfContext'] = undefined;
                if (env.MTF_CONTEXT_ENABLED) {
                    try {
const built = await buildMtfContext(symbol);
                        if (built) {
                            mtfContext = built;
                            console.log(`[AI Workflow] MTF context for ${symbol}: confluence=${built.confluence.confluenceScore}, alignment=${built.confluence.trendAlignment}, dominant=${built.dominantTrend}`);
                        }
                    } catch (mtfErr) {
                        console.warn(`[AI Workflow] MTF context failed for ${symbol}: ${mtfErr instanceof Error ? mtfErr.message : String(mtfErr)}`);
                    }
                }

                let analysisResult: DeepAnalysisResult;
                try {
                    analysisResult = await callDeepSeekAnalysis({
                        headline: item.title,
                        intelligence,
                        pattern,
                        price,
                        coinSymbol: symbol,
                        historicalStats,
                        eventImpactContext,
                        nearPriceLevels,
                        mtfContext,
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

                // 4d-ii. Strategic Outlook update (only for structurally significant events)
                if (analysisResult.strategicOutlook) {
                    const triggerInput = {
                        classification,
                        eventType,
                        impactScore: analysisResult.impactScore,
                        eventSeverity: analysisResult.eventSeverity,
                        priceChange24h: price?.change24h ?? undefined,
                    };

                    if (shouldUpdateOutlook(triggerInput)) {
                        try {
                            await saveStrategicOutlook(symbol, analysisResult.strategicOutlook, item.title);
                            console.log(`[AI Workflow] Strategic outlook updated for ${symbol}`);
                        } catch (outlookErr) {
                            console.error(`[AI Workflow] Failed to save strategic outlook for ${symbol}:`, outlookErr);
                        }
                    } else {
                        console.log(`[AI Workflow] Outlook update skipped for ${symbol} - event not structurally significant`);
                    }
                }

                // 4d-iii. Smart Event Response (for high-severity negative events)
                const negativeEventTypes = ['Hack', 'Exploit', 'Regulatory', 'Delisting'];
                if (
                    analysisResult.sentiment === 'bearish' &&
                    analysisResult.eventSeverity >= 2 &&
                    negativeEventTypes.includes(eventType)
                ) {
                    try {
                        await buildSmartEventResponse(symbol, eventType, item.title, currentPrice);
                        console.log(`[AI Workflow] Smart event response generated for ${symbol} - ${eventType}`);
                    } catch (eventErr) {
                        console.error(`[AI Workflow] Failed to build smart event response for ${symbol}:`, eventErr);
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

                // 4g. Radar signal — algorithm-driven direction, AI advisory
                try {
                    const taResult = await analyzeTechnicals(symbol);
                    if (!taResult || !price?.price) {
                        console.warn(`[AI Workflow] No TA result or price for ${symbol}, skipping signal pipeline`);
                    } else {
                        // ── Algorithm-first, AI fallback when algorithm is NEUTRAL ──
                        const algoVerdict = deriveAlgorithmVerdict(taResult);
                        const algoDirection = deriveAlgorithmDirection(taResult);
                        const aiDirection = verdictToDirection(analysisResult.verdict);
                        const agreement = algoDirection === aiDirection;

                        const finalDirection = algoDirection !== 'neutral' ? algoDirection : aiDirection;
                        let finalVerdict: 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL' | 'NEUTRAL';

                        if (finalDirection === 'neutral') {
                            finalVerdict = 'NEUTRAL';
                        } else if (finalDirection === 'bullish') {
                            finalVerdict = agreement ? 'STRONG_BUY' : 'BUY';
                        } else {
                            finalVerdict = agreement ? 'STRONG_SELL' : 'SELL';
                        }

                        // ── PHASE 6: Market Regime Integration ──
                        let marketRegime: string = 'UNKNOWN';
                        let regimeAllowsSignals = true;
                        try {
                            const { detectMarketRegime } = await import('../services/marketRegime.service');
                            const { getRegimeEffects } = await import('../services/marketRegime.service');
                            marketRegime = await detectMarketRegime();
                            const effects = getRegimeEffects(marketRegime as 'RISK_ON' | 'RISK_OFF' | 'TRENDING' | 'SIDEWAYS' | 'VOLATILE');
                            regimeAllowsSignals = effects.allowSignals;
                        } catch (err) {
                            logger.warn('[AI Workflow] Market regime detection failed for %s: %s', symbol, err instanceof Error ? err.message : String(err));
                        }

                        // ── PHASE 1: Pipeline Telemetry ──
                        const { incrementAnalyzed, incrementSignalCreated, incrementSignalSkipped, incrementRejection, logPipelineTelemetry } = await import('../utils/pipelineTelemetry');
                        incrementAnalyzed();

                        let rejectionStage: string | null = null;
                        let shouldSkipSignal = false;

                        // Failed BOS = hard reject (immutable rule)
                        if (taResult.structure.isFailedBos) {
                            shouldSkipSignal = true;
                            rejectionStage = 'failed_bos';
                            incrementRejection('failed_bos');
                            logger.info('[AI Workflow] Signal rejected for %s: FAILED_BOS', symbol);
                        }

                        // Quality gate: only reject if both algorithm AND AI have no direction AND quality is very low
                        if (!shouldSkipSignal && finalDirection === 'neutral' && taResult.qualityScore.score < 30) {
                            shouldSkipSignal = true;
                            rejectionStage = 'quality_threshold';
                            incrementRejection('quality_threshold');
                            logger.info('[AI Workflow] Signal rejected for %s: neutral+quality=%d < 30', symbol, taResult.qualityScore.score);
                        }

                        // Regime gate (VOLATILE blocks signals, SIDEWAYS now allows)
                        if (!regimeAllowsSignals && !shouldSkipSignal) {
                            shouldSkipSignal = true;
                            rejectionStage = marketRegime === 'VOLATILE' ? 'volatility_blocked' : 'regime_blocked';
                            incrementRejection(marketRegime === 'VOLATILE' ? 'volatility_blocked' : 'regime_blocked');
                            logger.info('[AI Workflow] Signal blocked by regime=%s for %s', marketRegime, symbol);
                        }

                        // ── PHASE 5: Relaxed counter-trend for SIDEWAYS daily trend ──
                        let dailyTrend: string = 'SIDEWAYS';
                        if (!shouldSkipSignal && env.DAILY_TREND_ENABLED) {
                            try {
                                dailyTrend = await calculateDailyTrend(symbol) as DailyTrendLabel;
                                const bearishTrends = new Set(['BEARISH', 'STRONG_BEARISH']);
                                const bullishTrends = new Set(['BULLISH', 'STRONG_BULLISH']);
                                const isCounterTrend = (bearishTrends.has(dailyTrend) && finalDirection === 'bullish')
                                    || (bullishTrends.has(dailyTrend) && finalDirection === 'bearish');

                                if (isCounterTrend && dailyTrend !== 'SIDEWAYS') {
                                    // Only block counter-trend when daily trend is clearly directional (not SIDEWAYS)
                                    shouldSkipSignal = true;
                                    rejectionStage = 'counter_trend';
                                    incrementRejection('counter_trend');
                                    logger.info('[AI Workflow] Counter-trend blocked for %s: daily=%s dir=%s', symbol, dailyTrend, finalDirection);
                                }
                            } catch (err) {
                                logger.warn('[AI Workflow] Daily trend check failed for %s: %s', symbol, err instanceof Error ? err.message : String(err));
                            }
                        }

                        const actionableVerdicts: ReadonlyArray<'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL'> = ['STRONG_BUY', 'STRONG_SELL', 'BUY', 'SELL'];

                        if (!shouldSkipSignal && actionableVerdicts.includes(finalVerdict as 'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL')) {
                            const decision = await decideSignalAction(symbol, finalVerdict as 'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL');
                            logger.info('[AI Workflow] Signal decision for %s: %s — %s', symbol, decision.action, decision.reason);

                            if (decision.action === 'skip') {
                                shouldSkipSignal = true;
                                rejectionStage = 'lifecycle_constraint';
                                incrementRejection('lifecycle_constraint');
                            }

                            if (!shouldSkipSignal) {
                                let tpslData: { takeProfitPrice: number; stopLossPrice: number } | null = null;

                                const signalTypeFromEvent = eventType.toLowerCase() === 'ETF_approval' || eventType.toLowerCase() === 'ETF_rejection' || eventType.toLowerCase() === 'regulation' || eventType.toLowerCase() === 'hack' || eventType.toLowerCase() === 'delisting'
                                    ? 'strategic'
                                    : eventType.toLowerCase() === 'mainnet_launch' || eventType.toLowerCase() === 'major_funding' || eventType.toLowerCase() === 'protocol_upgrade'
                                        ? 'strategic'
                                        : 'tactical';

                                if (env.TPSL_V2_ENABLED) {
                                    if (finalDirection !== 'neutral') {
                                        const tpslV2 = await calculateTpslV2({
                                            entryPrice: price.price,
                                            direction: finalDirection as 'bullish' | 'bearish',
                                            signalType: signalTypeFromEvent,
                                            taResult,
                                            mtfContext,
                                        });

                                        const sanity = validateTpslSanity({
                                            entryPrice: price.price,
                                            direction: finalDirection as 'bullish' | 'bearish',
                                            tpPrice: tpslV2.takeProfitPrice,
                                            slPrice: tpslV2.stopLossPrice,
                                            rrRatio: tpslV2.riskRewardRatio,
                                            signalType: signalTypeFromEvent,
                                        });

                                        if (!sanity.isValid) {
                                            logger.warn('[TPSLv2] Signal rejected for %s: %s', symbol, sanity.failures.join(', '));
                                        } else {
                                            tpslData = {
                                                takeProfitPrice: tpslV2.takeProfitPrice,
                                                stopLossPrice: tpslV2.stopLossPrice,
                                            };
                                        }
                                    }
                                }

                                if (!tpslData) {
                                    tpslData = calculateTpsl({
                                        entryPrice: price.price,
                                        verdict: finalVerdict as 'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL',
                                        supportLevels: taResult.supportLevels.length > 0 ? taResult.supportLevels.map(l => l.price) : (analysisResult.supportLevels || []),
                                        resistanceLevels: taResult.resistanceLevels.length > 0 ? taResult.resistanceLevels.map(l => l.price) : (analysisResult.resistanceLevels || []),
                                    });
                                }

                                const signalId = await executeSignalDecision(
                                    symbol,
                                    analysisResult.signalText,
                                    analysisResult.sentiment,
                                    analysisResult.impactScore,
                                    decision,
                                    tpslData
                                );

                                if (decision.action === 'close_and_replace' && decision.closedSignal) {
                                    const closedSignalId = decision.closedSignal.id;
                                    (async () => {
                                        try {
                                            await classifySignalOutcome(closedSignalId);
                                        } catch (err) {
                                            console.error(`[AI Workflow] Signal classification failed for ${closedSignalId}:`, err instanceof Error ? err.message : String(err));
                                        }
                                    })();
                                }

                                if (env.SIGNAL_CLASSIFICATION_ENABLED && signalId !== null && taResult) {
                                    try {
                                        const classification = classifySignal({ eventType, taResult, currentPrice: price.price, verdict: finalVerdict });

                                        if (!classification.meetsMinimumRR) {
                                            logger.warn('[Classification] Signal rejected: RR %s below minimum for %s', classification.riskRewardRatio.toFixed(2), symbol);
                                            rejectionStage = 'rr_minimum';
                                            incrementRejection('rr_minimum');
                                        } else {
                                            await db.update(radarSignals).set({
                                                signalType: classification.signalType,
                                                horizonDays: classification.horizonDays,
                                                qualityScore: taResult.qualityScore?.score ?? 0,
                                                trendContext: taResult.trend,
                                                entryZoneLow: classification.entryZoneLow,
                                                entryZoneHigh: classification.entryZoneHigh,
                                                invalidationLevel: classification.invalidationLevel,
                                                invalidationReason: classification.invalidationReason,
                                            }).where(eq(radarSignals.id, signalId));

                                            logger.info('[Classification] Signal %d classified as %s (horizon: %dd, RR: %s)', signalId, classification.signalType, classification.horizonDays, classification.riskRewardRatio.toFixed(2));
                                        }
                                    } catch (classErr) {
                                        logger.error('[Classification] Failed for signal: %s', classErr instanceof Error ? classErr.message : String(classErr));
                                    }
                                }

                                // Shadow Mode Integration
                                if (env.SHADOW_MODE_ENABLED && taResult?.qualityScore) {
                                    (async () => {
                                        try {
                                            let mtfConfluence: number | undefined;
                                            let mtfTrendAlignment: string | undefined;
                                            let mtfDominantTrend: string | undefined;
                                            if (env.MTF_CONTEXT_ENABLED && mtfContext) {
                                                mtfConfluence = mtfContext.confluence.confluenceScore;
                                                mtfTrendAlignment = mtfContext.confluence.trendAlignment;
                                                mtfDominantTrend = mtfContext.dominantTrend;
                                            }

                                            await insertShadowSignal({
                                                coinSymbol: symbol,
                                                algorithmVerdict: algoVerdict,
                                                aiVerdict: analysisResult.verdict,
                                                algorithmEntry: price.price,
                                                aiEntry: price.price,
                                                algorithmTp: taResult.nearestResistance?.price ?? undefined,
                                                algorithmSl: taResult.nearestSupport?.price ?? undefined,
                                                aiTp: tpslData.takeProfitPrice,
                                                aiSl: tpslData.stopLossPrice,
                                                qualityScore: taResult.qualityScore?.score ?? 0,
                                                trendContext: taResult.trend,
                                                agreement,
                                                mtfConfluenceScore: mtfConfluence,
                                                mtfTrendAlignment,
                                                mtfDominantTrend,
                                            });
                                        } catch (err) {
                                            logger.error('[ShadowMode] Failed to insert shadow signal: %s', err instanceof Error ? err.message : String(err));
                                        }
                                    })();
                                }

                                if (signalId !== null) {
                                    incrementSignalCreated();
                                }
                            }
                        }

                        if (shouldSkipSignal) {
                            incrementSignalSkipped();
                        }

                        // Log pipeline telemetry
                        logPipelineTelemetry({
                            symbol,
                            timestamp: new Date().toISOString(),
                            marketRegime,
                            trend4h: taResult.trend,
                            trendDaily: dailyTrend,
                            qualityScore: taResult.qualityScore.score,
                            qualityBreakdown: taResult.qualityScore.breakdown,
                            algorithmVerdict: algoVerdict,
                            aiVerdict: analysisResult.verdict,
                            finalVerdict,
                            finalDirection,
                            rejectionReason: taResult.qualityScore.rejectionReason,
                            rejectionStage,
                            signalAction: shouldSkipSignal ? 'SKIP' : 'CREATE',
                            signalId: null,
                            regimeAllowsSignals,
                            counterTrendBlocked: rejectionStage === 'counter_trend',
                            qualityRejected: rejectionStage === 'quality_threshold',
                            rrRejected: rejectionStage === 'rr_minimum',
                        });
                    }
                    } catch (sigErr) {
                        console.error(`[AI Workflow] Signal management failed for ${symbol}:`, sigErr instanceof Error ? sigErr.message : String(sigErr));
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

                // Phase 1: Insert MAJOR event into coin_news_history
                try {
                    // Cache BTC/ETH/FearGreed (attempt each at most once per run)
                    if (!btcPriceFetched) {
                        btcPriceFetched = true;
                        try {
                            const btcData = await getPriceWithFallback('BTC');
                            btcPriceCached = btcData?.price ?? null;
                        } catch (btcErr) {
                            console.warn(`[AI Workflow] Failed to fetch BTC price:`, btcErr);
                            btcPriceCached = null;
                        }
                    }
                    if (!ethPriceFetched) {
                        ethPriceFetched = true;
                        try {
                            const ethData = await getPriceWithFallback('ETH');
                            ethPriceCached = ethData?.price ?? null;
                        } catch (ethErr) {
                            console.warn(`[AI Workflow] Failed to fetch ETH price for ${symbol}:`, ethErr);
                            ethPriceCached = null;
                        }
                    }
                    if (!fearGreedFetched) {
                        fearGreedFetched = true;
                        try {
                            const response = await fetch('https://api.alternative.me/fng/?limit=1');
                            if (response.ok) {
                                const data = await response.json() as { data?: { value: string }[] };
                                fearGreedCached = data.data && data.data[0] ? parseInt(data.data[0].value, 10) : null;
                            } else {
                                fearGreedCached = null;
                            }
                        } catch (fgErr) {
                            console.warn(`[AI Workflow] Failed to fetch Fear & Greed index:`, fgErr);
                            fearGreedCached = null;
                        }
                    }

                    // Compute source hash for dedup (stable content only)
                    const sourceHashInput = `${symbol}|${item.source}|${item.title}`;
                    const sourceHash = crypto.createHash('sha256').update(sourceHashInput).digest('hex').slice(0, 64);

                    // Determine event scope (COIN for coin-specific events, MARKET for broader)
                    const eventScope = eventType === 'ETF' || eventType === 'Regulatory' ? 'MARKET' : 'COIN';

                    // Insert event tracking record
                    await db.insert(coinNewsHistory).values({
                        coinSymbol: symbol,
                        title: item.title,
                        source: item.source,
                        publishedAt: item.retrievedAt,
                        sentiment: analysisResult.sentiment,
                        eventType: eventType,
                        eventSeverity: 3, // MAJOR
                        priceAtTime: price?.price ?? null,
                        sourceHash: sourceHash,
                        eventScope: eventScope,
                        btcPriceAtEvent: btcPriceCached,
                        ethPriceAtEvent: ethPriceCached,
                        fearGreedAtEvent: fearGreedCached,
                    }).onConflictDoNothing();

                    console.log(`[AI Workflow] Inserted MAJOR event into coin_news_history for ${symbol}`);

                    // Phase 4.5: Controlled scenario creation
                    if (env.SCENARIO_TRACKER_ENABLED) {
                        try {
                            // Eligibility check
                            const eligibleSeverities = ['high', 'major'];
                            const eventSeverityStr = eventSeverity === 5 ? 'high' : eventSeverity === 3 ? 'major' : 'low';
                            if (!eligibleSeverities.includes(eventSeverityStr)) {
                                console.log(`[AI Workflow] Skipping scenario creation for ${symbol}: ineligible severity ${eventSeverityStr}`);
                            } else if (!price?.price) {
                                console.log(`[AI Workflow] Skipping scenario creation for ${symbol}: no reference price`);
                            } else if (!['bullish', 'bearish'].includes(analysisResult.sentiment)) {
                                console.log(`[AI Workflow] Skipping scenario creation for ${symbol}: ineligible bias ${analysisResult.sentiment}`);
                            } else {
                                // Create scenario
                                const scenarioId = await ScenarioTrackerService.createScenario({
                                    sourceType: 'event',
                                    sourceId: sourceHash,
                                    coinSymbol: symbol,
                                    scenarioType: 'speculation',
                                    bias: analysisResult.sentiment as 'bullish' | 'bearish',
                                    eventType: eventType,
                                    eventSeverity: eventSeverityStr,
                                    eventScope: eventScope,
                                    referencePrice: price.price,
                                    referencePriceSource: 'binance',
                                    referencePriceAt: item.retrievedAt,
                                    thesis: analysisResult.analysis.mainDriver,
                                    publicSafeSummary: analysisResult.signalText,
                                    // TODO: Add historicalStatsSnapshot and levelContextSnapshot in future phases
                                });

                                if (scenarioId) {
                                    console.log(`[AI Workflow] Created scenario ${scenarioId} for ${symbol}`);
                                } else {
                                    console.log(`[AI Workflow] Scenario creation returned null for ${symbol}`);
                                }
                            }
                        } catch (scenarioErr) {
                            console.warn(`[AI Workflow] Scenario creation failed for ${symbol}:`, scenarioErr instanceof Error ? scenarioErr.message : String(scenarioErr));
                        }
                    } else {
                        console.log(`[AI Workflow] Scenario creation disabled for ${symbol}`);
                    }
                } catch (insertErr) {
                    console.warn(`[AI Workflow] Failed to insert into coin_news_history for ${symbol}:`, insertErr);
                }

                // 4i. Redis invalidation (targeted only)
                await deleteCache(`master:${symbol}`);
                await deleteCache(`news:${symbol}`);
                await deleteCache('insight:all');
                await deleteCache(`outlook:${symbol}`);

                console.log(`[AI Workflow] Published: ${symbol} — "${article.headline.slice(0, 50)}..."`);

                await markBufferItemConsumed(item.id);

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[AI Workflow] Failed for ${symbol}:`, message);
                // Always consume the item even on failure to prevent infinite re-processing loops.
                // If the error is transient (rate limit, timeout), the next news cycle will provide fresh input.
                await markBufferItemConsumed(item.id);
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
        try {
            const { logRejectionSummary } = await import('../utils/pipelineTelemetry');
            logRejectionSummary();
        } catch {}
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
