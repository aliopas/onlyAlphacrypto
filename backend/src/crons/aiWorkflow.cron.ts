import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { marketInsights, coinNews, radarSignals } from '../models/market.model';
import { eq } from 'drizzle-orm';

import { getTopBoostedTokens, getTokenData, DexTokenInfo } from '../services/dexscreener.service';
import { searchTavily } from '../services/tavily.service';
import { generateDeepIntelligenceReport, DeepIntelligenceReport } from '../services/openai.service';
import { deleteCache } from '../config/redis';
import { fetchTopItemsForDeepAnalysis } from '../services/ai/deep-analysis-router';

// Simple boolean lock for the cron job to avoid running concurrently
let isAiWorkflowRunning = false;

// Helpers
function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function runAiWorkflow(targetedPhase: string = 'all'): Promise<void> {
    if (isAiWorkflowRunning) {
        console.log('⏳ [AI Workflow] Already running. Skipping this cycle.');
        return;
    }
    isAiWorkflowRunning = true;
    console.log(`🤖 [AI Workflow] Started. Mode: ${targetedPhase}`);

    try {
        // --- PHASE 1: Fetch top-scored items from buffer (replaces Hunter + Aggregator) ---
        console.log('--- Phase 1: Deep Analysis Router ---');
        const groupedCoins = await fetchTopItemsForDeepAnalysis(15);

        if (groupedCoins.length === 0) {
            console.log('[AI Workflow] No high-scoring items to analyze.');
            return;
        }

        const coinsToAnalyze = groupedCoins.filter(g => g.coinSymbol !== 'UNKNOWN');
        console.log(`[AI Workflow] Found ${coinsToAnalyze.length} coins to analyze.`);

        // --- PHASE 2: The Brain (AI Analysis via DeepSeek R1) ---
        console.log('--- Phase 2: Brain ---');
        const aiReports: Array<{
            symbol: string;
            name: string;
            stats: DexTokenInfo | null;
            recentNews: string[];
            aiReport: DeepIntelligenceReport;
        }> = [];

        // Pre-fetch DexScreener tokens for address resolution
        const dexTokens = await getTopBoostedTokens();
        const dexMap = new Map(dexTokens.map(t => [t.symbol.toUpperCase(), t.address]));

        for (const coin of coinsToAnalyze) {
            console.log(`[Brain] Analyzing ${coin.coinSymbol} (${coin.newsTitles.length} news, avg score: ${coin.avgRelevanceScore.toFixed(0)})...`);

            try {
                // Try to get token stats from DexScreener via known address
                const address = dexMap.get(coin.coinSymbol.toUpperCase());
                const tokenStats = address ? await getTokenData(address) : null;

                // Deduplication: check which news items already exist in coin_news
                const existingContext: string[] = [];
                const freshNews: string[] = [];

                for (const title of coin.newsTitles) {
                    const hash = crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex');
                    const [existing] = await db.select().from(coinNews).where(eq(coinNews.sourceHash, hash)).limit(1);
                    if (existing) {
                        existingContext.push(`${title} (Sentiment: ${existing.sentiment})`);
                    } else {
                        freshNews.push(title);
                    }
                }

                // Scam check via Tavily
                const scamCheck = freshNews.length > 0 ? await searchTavily(`${coin.coinSymbol} crypto scam team`) : '';

                // Deep analysis via DeepSeek R1
                const report = await generateDeepIntelligenceReport(coin.coinSymbol, {
                    recentNews: freshNews,
                    existingContext,
                    stats: tokenStats ? tokenStats as unknown as Record<string, number | string> : undefined,
                    scamReport: scamCheck,
                });

                aiReports.push({
                    symbol: coin.coinSymbol,
                    name: tokenStats?.name || coin.coinSymbol,
                    stats: tokenStats,
                    recentNews: freshNews,
                    aiReport: report,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[Brain] Failed to analyze ${coin.coinSymbol}:`, message);
            }
        }

        // --- PHASE 3: The Publisher (Storage & Display) ---
        console.log('--- Phase 3: Publisher ---');
        if (aiReports.length === 0) {
            console.log('[Publisher] No reports generated. Skipping publish.');
        } else {
            for (const item of aiReports) {
                const report = item.aiReport;

                await db.insert(marketInsights).values({
                    coinSymbol: item.symbol,
                    coinName: item.name,
                    coinSlug: generateSlug(item.name),
                    verdict: report.verdict,
                    confidenceScore: report.confidenceScore,
                    executiveSummary: report.executiveSummary,
                    keyDrivers: report.keyDrivers || [],
                    marketContext: report.marketContext || '',
                    riskLevel: report.riskVerdict,
                    redFlags: report.redFlags || [],
                    priceAtAnalysis: item.stats?.priceUsd ? parseFloat(item.stats.priceUsd) : 0,
                });

                for (const headline of item.recentNews) {
                    try {
                        const hash = crypto.createHash('sha256').update(headline.trim().toLowerCase()).digest('hex');
                        await db.insert(coinNews).values({
                            coinSymbol: item.symbol,
                            headline: headline,
                            sourceHash: hash,
                            aiProcessed: 1,
                            sentiment: report.verdict === 'STRONG_BUY' || report.verdict === 'BUY' ? 'bullish' : 'neutral'
                        }).onConflictDoNothing();
                    } catch (_err) { }
                }

                if (report.verdict === 'STRONG_BUY' || report.verdict === 'STRONG_SELL' || report.riskVerdict === 'HIGH' || report.riskVerdict === 'SCAM') {
                    await db.insert(radarSignals).values({
                        coinSymbol: item.symbol,
                        signalText: report.executiveSummary,
                        sentiment: report.verdict,
                    });
                }
            }

            await deleteCache('insight:all');
            console.log(`[Publisher] Saved ${aiReports.length} insights.`);
        }

        console.log('✅ [AI Workflow] Completed successfully.');

    } catch (err) {
        console.error('❌ [AI Workflow] Failed:', err);
    } finally {
        isAiWorkflowRunning = false;
    }
}

export function startAiWorkflowCron(): void {
    cron.schedule('0 * * * *', () => runAiWorkflow('all'));
    console.log('⏰ AI Intelligence Workflow scheduled — hourly');
}
