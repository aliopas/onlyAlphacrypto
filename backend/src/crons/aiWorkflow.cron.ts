import cron from 'node-cron';
import crypto from 'crypto';
import { db } from '../config/db';
import { marketInsights, priceSnapshots, coinNews, radarSignals } from '../models/market.model';
import { eq } from 'drizzle-orm';

import { getTopBoostedTokens, getTokenData } from '../services/dexscreener.service';
import { getHotCryptoTopics } from '../services/reddit.service';
import { extractSymbolsFromReddit } from '../utils/redditExtractor';
import { searchCryptoPanic } from '../services/cryptopanic.service';
import { searchTavily } from '../services/tavily.service';
import { generateDeepIntelligenceReport } from '../services/openai.service';
import { deleteCache } from '../config/redis';

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
        // --- PHASE 1: The Hunter (Discovery) ---
        console.log('--- Phase 1: Hunter ---');
        const memoryTopics: Array<{ symbol: string; address?: string; source: string; keyword: string }> = [];

        if (targetedPhase === 'all' || targetedPhase === '1') {
            const dexscreenerTokens = await getTopBoostedTokens();
            dexscreenerTokens.forEach(t => memoryTopics.push({ symbol: t.symbol, address: t.address, source: 'DexScreener', keyword: t.symbol }));

            const redditTopics = await getHotCryptoTopics();
            const redditSymbols = extractSymbolsFromReddit(redditTopics);
            
            redditSymbols.forEach(symbol => {
                const exists = memoryTopics.some(t => t.symbol === symbol);
                if (!exists) {
                    memoryTopics.push({
                        symbol,
                        source: 'Reddit',
                        keyword: symbol
                    });
                }
            });

            // To keep things simple and token-focused:
            console.log(`[Hunter] Found ${memoryTopics.length} unique topics (DexScreener + Reddit).`);
        }

        // --- PHASE 2: The Aggregator ---
        console.log('--- Phase 2: Aggregator ---');
        const aggregatedDataList: any[] = [];

        if (targetedPhase === 'all' || targetedPhase === '2') {
            const topicsToProcess = memoryTopics.slice(0, 10); // Expanded from 5 to 10 because we now have cost optimization
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            for (const topic of topicsToProcess) {
                console.log(`[Aggregator] Processing ${topic.symbol}...`);
                const tokenStats = topic.address ? await getTokenData(topic.address) : null;
                const actualSymbol = tokenStats?.symbol || topic.symbol;

                // 1. Fetch news
                const rawNews = actualSymbol !== 'UNKNOWN' ? await searchCryptoPanic(actualSymbol) : [];
                
                // 2. Intelligence Deduplication (Hash Check)
                const freshNews: string[] = [];
                const existingNewsContext: string[] = [];

                for (const headline of rawNews) {
                    const hash = crypto.createHash('sha256').update(headline).digest('hex');
                    const [existing] = await db.select().from(coinNews).where(eq(coinNews.sourceHash, hash)).limit(1);
                    
                    if (existing) {
                        existingNewsContext.push(`${headline} (Sentiment: ${existing.sentiment})`);
                    } else {
                        freshNews.push(headline);
                    }
                }

                const scamCheck = (actualSymbol !== 'UNKNOWN' && freshNews.length > 0) ? await searchTavily(`${actualSymbol} crypto scam team`) : '';

                aggregatedDataList.push({
                    symbol: actualSymbol,
                    name: tokenStats?.name || actualSymbol,
                    stats: tokenStats,
                    recentNews: freshNews, // Only send NEW news to the AI
                    existingContext: existingNewsContext, // Provide context of what we already know
                    scamReport: scamCheck
                });

                // Write price snapshot
                if (tokenStats && tokenStats.priceUsd) {
                    await db.insert(priceSnapshots).values({
                        coinSymbol: actualSymbol,
                        price: parseFloat(tokenStats.priceUsd),
                        liquidity: tokenStats.liquidityUsd,
                        volume24h: tokenStats.volume24h,
                    });
                }

                // Prevents 429 Rate Limiting from CryptoPanic
                await sleep(1000);
            }
        }

        // --- PHASE 3: The Brain (AI Analysis) ---
        console.log('--- Phase 3: Brain ---');
        const aiReports: any[] = [];

        if (targetedPhase === 'all' || targetedPhase === '3') {
            for (const data of aggregatedDataList) {
                console.log(`[Brain] Analyzing ${data.symbol}...`);

                // Wait for each response sequentially as requested
                try {
                    const report = await generateDeepIntelligenceReport(data.symbol, data);
                    aiReports.push({ ...data, aiReport: report });
                } catch (err: any) {
                    console.error(`[Brain] Failed to analyze ${data.symbol}:`, err.message);
                }
            }
        }

        // --- PHASE 4: The Publisher (Storage & Display) ---
        console.log('--- Phase 4: Publisher ---');
        if (targetedPhase === 'all' || targetedPhase === '4') {
            for (const item of aiReports) {
                const report = item.aiReport;

                await db.insert(marketInsights).values({
                    coinSymbol: item.symbol,
                    coinName: item.name,
                    coinSlug: generateSlug(item.name),
                    verdict: report.verdict,
                    confidenceScore: report.confidenceScore,
                    executiveSummary: report.executiveSummary,
                    riskLevel: report.riskVerdict,
                    redFlags: report.redFlags || [],
                    priceAtAnalysis: item.stats ? parseFloat(item.stats.priceUsd) : 0,
                });

                // 2. Insert extracted news to coinNews table
                if (item.recentNews && Array.isArray(item.recentNews)) {
                    for (const headline of item.recentNews) {
                        try {
                            const hash = crypto.createHash('sha256').update(headline).digest('hex');
                            await db.insert(coinNews).values({
                                coinSymbol: item.symbol,
                                headline: headline,
                                sourceHash: hash,
                                aiProcessed: 1,
                                sentiment: report.verdict === 'STRONG_BUY' || report.verdict === 'BUY' ? 'bullish' : 'neutral'
                            }).onConflictDoNothing();
                        } catch (err) { }
                    }
                }

                // 3. Insert Radar Signal if it's actionable or high risk
                if (report.verdict === 'STRONG_BUY' || report.verdict === 'STRONG_SELL' || report.riskVerdict === 'HIGH' || report.riskVerdict === 'SCAM') {
                    await db.insert(radarSignals).values({
                        coinSymbol: item.symbol,
                        signalText: report.executiveSummary,
                        sentiment: report.verdict,
                    });
                }
            }

            // Invalidate Caches if needed here
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
    // Run exactly at the top of every hour
    cron.schedule('0 * * * *', () => runAiWorkflow('all'));
    console.log('⏰ AI Intelligence Workflow scheduled — hourly');
}
