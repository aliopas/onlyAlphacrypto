import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { fetchHistoricalNewsForCoins, buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter, gateway } from '../services/openai.service';
import type { DeepAnalysisResult } from '../services/openai.service';
import type { ArticleWriterResult } from '../services/openai.service';
import { AIRateLimitError } from '../services/ai/ai-gateway';
import { validateFactualGrounding } from '../services/ai/factual-grounding';
import { auditArticleQuality } from '../services/ai/quality-auditor';
import { coinNews, radarSignals, rawNewsBuffer } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne } from 'drizzle-orm';
import { deleteCache } from '../config/redis';

let isAiWorkflowRunning = false;

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

            console.log(`[AI Workflow] Processing: ${symbol} — "${item.title.slice(0, 60)}..."`);

            try {
                const intelligence = await getCoinIntelligence(symbol);

                await fetchHistoricalNewsForCoins([symbol]);
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

                // B1. Quality audit (cross-model: DeepSeek-R1 audits GPT-5-nano)
                const audit = await auditArticleQuality(gateway, JSON.stringify(analysisResult), article);
                if (!audit.passed) {
                    console.warn(`[AI Workflow] Quality audit FAILED for ${symbol} (score: ${audit.score}):`, audit.issues);
                    if (audit.suggestion) {
                        console.warn(`[AI Workflow] Audit suggestion: ${audit.suggestion}`);
                    }
                } else {
                    console.log(`[AI Workflow] Quality audit PASSED for ${symbol} (score: ${audit.score})`);
                }

                // 4f. Save to coinNews
                const sourceHash = crypto.createHash('sha256').update(article.headline).digest('hex');
                await db.insert(coinNews).values({
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
                }).onConflictDoNothing();

                // 4g. Radar signal for strong verdicts
                if (analysisResult.verdict === 'STRONG_BUY' || analysisResult.verdict === 'STRONG_SELL') {
                    await db.insert(radarSignals).values({
                        coinSymbol: symbol,
                        signalText: analysisResult.signalText,
                        sentiment: analysisResult.sentiment,
                        impactScore: analysisResult.impactScore,
                    }).onConflictDoNothing();
                }

                // 4h. Redis invalidation (targeted only)
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
    }
}

export function startAiWorkflowCron(): void {
    cron.schedule('0 * * * *', () => runAiWorkflow());
    console.log('⏰ AI Intelligence Workflow scheduled — hourly');
}
