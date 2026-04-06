import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { fetchHistoricalNewsForCoins, buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter } from '../services/openai.service';
import { coinNews, radarSignals, rawNewsBuffer } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne } from 'drizzle-orm';
import { deleteCache } from '../config/redis';

// Simple boolean lock for the cron job to avoid running concurrently
let isAiWorkflowRunning = false;

// Helpers
function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function runAiWorkflow(): Promise<void> {
    if (isAiWorkflowRunning) {
        console.log('⏳ [AI Workflow] Already running. Skipping this cycle.');
        return;
    }
    isAiWorkflowRunning = true;
    console.log('🤖 [AI Workflow] Started.');

    try {
        // Step 1: Hard cap
        const hourlyCount = await countPublishedLastHour();
        if (hourlyCount >= 5) {
            console.log('[AI Workflow] Hourly cap reached (5). Skipping.');
            return;
        }

        // Step 2: Dynamic threshold
        const threshold = await getDynamicThreshold();
        console.log(`[AI Workflow] Dynamic threshold: ${threshold}`);

        // Step 3: Fetch eligible items from rawNewsBuffer
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

        // Step 4: Loop through items
        for (const item of items) {
            const mentions = (item.symbolMentions as string[]) || [];
            if (mentions.length === 0) continue;
            const symbol = mentions[0];
            const eventType = typeof item.eventType === 'string' ? item.eventType : 'Other';
            const eventSeverity = typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;

            console.log(`[AI Workflow] Processing: ${symbol} — "${item.title.slice(0, 60)}..."`);

            try {
                // 4a. Coin Intelligence
                const intelligence = await getCoinIntelligence(symbol);

                // 4b. Temporal Pattern
                await fetchHistoricalNewsForCoins([symbol]);
                const pattern = await buildTemporalPattern(symbol, eventType, eventSeverity);

                // 4c. Current Price
                const price = await getPriceWithFallback(symbol);

                // 4d. DeepSeek Analysis (circuit breaker)
                if (deepseekBreaker.isOpen()) {
                    console.warn(`[AI Workflow] DeepSeek circuit open — skipping ${symbol}`);
                    continue;
                }

                const analysisResult = await callDeepSeekAnalysis({
                    headline: item.title,
                    intelligence,
                    pattern,
                    price,
                });
                deepseekBreaker.recordSuccess();

                // 4e. GPT-nano Article (circuit breaker)
                if (gptNanoBreaker.isOpen()) {
                    console.warn(`[AI Workflow] GPT-nano circuit open — skipping ${symbol}`);
                    continue;
                }

                const article = await callGptNanoWriter(JSON.stringify(analysisResult));
                gptNanoBreaker.recordSuccess();

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
                deepseekBreaker.recordFailure('DeepSeek');
                gptNanoBreaker.recordFailure('GPT-nano');
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
