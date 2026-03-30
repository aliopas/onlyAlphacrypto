import { env } from '../config/env';
import { CacheManager } from './ai/cache-manager';
import { AIGateway } from './ai/ai-gateway';
import { PromptFactory } from './ai/prompt-factory';

// Define interfaces locally to avoid circular imports
export interface MarketVerdictResult {
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
    executiveSummary: string;
    supportLevels: number[];
    resistanceLevels: number[];
}

export interface DeepIntelligenceReport {
    riskVerdict: 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM';
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
    executiveSummary: string;
    keyDrivers: string[];
    marketContext: string;
    redFlags: string[];
}

export interface DualNewsOutput {
    wireCard: {
        headline: string;        // SEO-optimized title (GPT-5-nano)
        hook: string;            // Opening hook sentence to capture attention
        summary: string;         // Full 3-5 sentence deep analysis
        metaTitle: string;       // SEO meta title ≤60 chars
        metaDescription: string; // SEO meta description ≤160 chars
        seoKeywords: string[];   // Target search keywords
        sentiment: 'bullish' | 'bearish' | 'neutral';
        impactScore: number;
        isBreaking: boolean;
        coinSymbol?: string;
    };
    radarCard: {
        signalText: string;
        sentiment: 'bullish' | 'bearish' | 'neutral';
        impactScore: number;
        coinSymbol?: string;
    };
}

export interface AirdropValidationResult {
    isLegitimate: boolean;
    riskVerdict: 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM';
    tasks: Array<{
        description: string;
        contractAddress?: string;
        minAmount?: number;
        tokenSymbol?: string;
        chain?: string;
        isAutoVerifiable: boolean;
    }>;
    estValue: string;
    aiReport: string;
}

// Instantiate the modular components
const cache = new CacheManager();
const gateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 90000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    }
});
const prompts = new PromptFactory();

// ─── Market Verdict (GLM-5 — deep analysis) ──────────────────────────────────

export async function generateMarketVerdict(
    coinSymbol: string,
    data: {
        price: number;
        rsi: number;
        volumeChange: number;
        recentNews: string[];
    }
): Promise<MarketVerdictResult> {
    // Check cache first    const cacheKey = cache.generateKey('marketVerdict', coinSymbol, data);
    const cached = cache.get<MarketVerdictResult>(cacheKey);
    if (cached) {
        return cached;
    }

    const messages = prompts.buildMarketVerdictMessages(coinSymbol, data);
    const result = await gateway.chat<MarketVerdictResult>({
        model: env.ANALYSIS_MODEL,
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
        messages
    });

    // Store in cache
    cache.set(cacheKey, result);
    return result;
}

// ─── Deep Intelligence Report (Adaptive Model Routing) ───

export async function generateDeepIntelligenceReport(
    coinSymbol: string,
    aggregatedData: {
        recentNews: string[];
        existingContext?: string[];
        stats?: Record<string, number | string>;
        scamReport?: string;
    }
): Promise<DeepIntelligenceReport> {
    // Check cache first
    const cacheKey = cache.generateKey('deepIntelligence', coinSymbol, aggregatedData);
    const cached = cache.get<DeepIntelligenceReport>(cacheKey);
    if (cached) {
        return cached;
    }

    // Adaptive Model Routing Logic    const hasManyNews = aggregatedData.recentNews.length > 3;
    const hasScamAlerts = aggregatedData.scamReport && aggregatedData.scamReport.length > 100;
    // Threshold raised from >10% to >30% — small-cap DexScreener tokens routinely show
    // 100-5000% moves, so >10% was causing ALL tokens to route to DeepSeek-R1 unnecessarily.
    const isVolatile = aggregatedData.stats && Math.abs(aggregatedData.stats.priceChange24h || 0) > 30;

    // Both tiers now use DeepSeek-R1 via ANALYSIS_MODEL env var (GLM-5 removed — DeepSeek is cheaper at scale)
    // Complex tokens get DeepSeek with higher temperature, routine get lower temperature
    const aiModel = env.ANALYSIS_MODEL; // Always deepseek/deepseek-r1
    const temperature = (hasManyNews || hasScamAlerts || isVolatile) ? 0.4 : 0.2;

    console.log(`[ModelRouting] Using ${aiModel} for ${coinSymbol} (Volatile: ${isVolatile}, News: ${aggregatedData.recentNews.length}, Scam: ${!!hasScamAlerts}, Temp: ${temperature})`);

    const messages = prompts.buildDeepIntelligenceMessages(coinSymbol, aggregatedData);
    const result = await gateway.chat<DeepIntelligenceReport>({
        model: aiModel,
        temperature,
        responseFormat: { type: 'json_object' },
        messages
    });

    // Store in cache
    cache.set(cacheKey, result);
    return result;
}

// ─── Lightweight Triage Function (Phase 1B) ───────────────────────────────────/**
 * Generate lightweight triage scores for news batches
 * Uses cheap/fast model (GPT-5-nano equivalent) to score relevance (0-100)
 */
export async function generateLightweightTriage(
    newsBatch: Array<{ title: string; source?: string }>
): Promise<Array<{ title: string; source?: string; relevanceScore: number; sentimentHint: string | null }>> {
    // Check cache first
    const cacheKey = cache.generateKey('lightweightTriage', newsBatch);
    const cached = cache.get<Array<{ title: string; source?: string; relevanceScore: number; sentimentHint: string | null }>>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const messages = prompts.buildTriageMessages(newsBatch);
        const parsed = await gateway.chat<{ 
            results?: Array<{ relevanceScore: number; sentimentHint: string | null }>; 
            triageScores?: Array<{ relevanceScore: number; sentimentHint: string | null }>         }>({
            model: env.SEO_MODEL, // GPT-5-nano equivalent (cheap/fast model)
            temperature: 0.2, // Low temperature for consistent scoring
            responseFormat: { type: 'json_object' },
            messages
        });

        // Handle both array format and object format
        const resultsArray = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : 
            (parsed.results || parsed.triageScores || []);

        // Map results back to original news items
        const triagedNews = newsBatch.map((item, index) => {
            const scoreObj = resultsArray[index] || {};
            return {
                ...item,
                relevanceScore: Math.max(0, Math.min(100, Number(scoreObj.relevanceScore) || 50)),
                sentimentHint: scoreObj.sentimentHint || null
            };
        });

        // Store in cache
        cache.set(cacheKey, triagedNews);
        return triagedNews;
    } catch (error) {
        console.error('[OpenAI Service] Error in lightweight triage:', error);
        // Fallback: return neutral scores for all items
        const fallbackResults = newsBatch.map(item => ({
            ...item,
            relevanceScore: 50, // Neutral score
            sentimentHint: null
        }));

        // Cache fallback results briefly (5 minutes) to prevent repeated failures on same batch
        const fallbackCacheKey = cache.generateKey('lightweightTriage_fallback', newsBatch);
        cache.set(fallbackCacheKey, fallbackResults);
        // Note: We're not setting a shorter TTL here as the CacheManager doesn't support per-entry TTL
        // In a production app, we might want to enhance CacheManager to support this

        return fallbackResults;
    }
}

// ─── Deep Synthesis Function Signature (Phase 2) ───────────────────────────────
/**
 * DEEP SYNTHESIS FUNCTION - MUST USE DEEPSEEK R1 * 
 * This function performs deep analysis using the most capable model (DeepSeek R1 via ANALYSIS_MODEL)
 * It synthesizes multiple data sources:
 * - Multiple news articles about the same coin
 * - Real-time market data (price, volume)
 * - On-chain data from Moralis
 * - Tavily research/scamming context
 * 
 * Output structured for insertion into coin_news table and coin_memory table
 * 
 * NOTE: Implementation will be completed in later phases. This is the function signature only.
 */
export async function generateDeepSynthesis(
    coinSymbol: string,
    newsArticles: string[],
    marketData: Record<string, number | string>,
    onchainData: Record<string, unknown>,
    tavilyContext: string
): Promise<{
    executiveSummary: string;
    keyDrivers: string[];
    marketContext: string;
    riskAssessment: string; // 'LOW' | 'MEDIUM' | 'HIGH'
    redFlags: string[];
    confidenceScore: number;
}> {
    // Placeholder implementation - to be replaced in Phase 2
    // This function will use DeepSeek R1 (env.ANALYSIS_MODEL) for deep analysis
    throw new Error('generateDeepSynthesis not yet implemented - placeholder for Phase 2');
}

// ─── Dual News Output: 2-Step Pipeline ───────────────────────────────────────
// Step 1: DeepSeek-R1 analyzes the raw news and extracts structured data
// Step 2: GPT-5-nano formats the analysis into SEO-optimized article output

interface RawAnalysis {
    analysis: string;       // Raw editorial analysis
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;    // 0-100
    isBreaking: boolean;
    coinSymbol?: string;
    signalText: string;     // 2-sentence radar signal    keyFacts: string[];     // Bullet facts for GPT to format
}

export async function generateDualNewsOutput(
    rawNewsItem: string,
    trackedProjects: string[],
    recentContext?: string
): Promise<DualNewsOutput> {
    // Check cache first
    const cacheKey = cache.generateKey('dualNewsOutput', rawNewsItem, trackedProjects, recentContext);
    const cached = cache.get<DualNewsOutput>(cacheKey);
    if (cached) {
        return cached;
    }

    // ── STEP 1: DeepSeek-R1 — Deep Analysis ──────────────────────────────────
    const analysisMessages = prompts.buildDualNewsStep1Messages(rawNewsItem, trackedProjects, recentContext);

    let rawAnalysis: RawAnalysis;
    for (let i = 0; i < 3; i++) {
        try {
            const res = await gateway.chat<RawAnalysis>({
                model: env.ANALYSIS_MODEL, // deepseek/deepseek-r1
                temperature: 0.3,
                responseFormat: { type: 'json_object' },
                messages: analysisMessages
            });
            rawAnalysis = res;
            break;
        } catch (err) {
            if (i === 2) throw err;
        }
    }

    // ── STEP 2: GPT-5-nano — SEO Formatting & Polish ────────────────────────────    const seoMessages = prompts.buildDualNewsStep2Messages(rawAnalysis);

    for (let i = 0; i < 3; i++) {
        try {
            const seoOutput = await gateway.chat<{
                headline: string;
                hook: string;
                summary: string;
                metaTitle: string;
                metaDescription: string;
                seoKeywords: string[];
            }>({
                model: env.SEO_MODEL, // openai/gpt-5-nano
                temperature: 0.5,
                responseFormat: { type: 'json_object' },
                messages: seoMessages
            });

            const result = {
                wireCard: {
                    headline: seoOutput.headline || rawNewsItem.slice(0, 100),
                    hook: seoOutput.hook || '',
                    summary: seoOutput.summary || rawAnalysis.analysis,
                    metaTitle: seoOutput.metaTitle || seoOutput.headline?.slice(0, 60) || '',
                    metaDescription: seoOutput.metaDescription || '',
                    seoKeywords: Array.isArray(seoOutput.seoKeywords) ? seoOutput.seoKeywords : [],
                    sentiment: rawAnalysis.sentiment,
                    impactScore: rawAnalysis.impactScore,
                    isBreaking: rawAnalysis.isBreaking,
                    coinSymbol: rawAnalysis.coinSymbol,
                },
                radarCard: {
                    signalText: rawAnalysis.signalText,
                    sentiment: rawAnalysis.sentiment,
                    impactScore: rawAnalysis.impactScore,
                    coinSymbol: rawAnalysis.coinSymbol,
                },
            } as DualNewsOutput;

            // Store in cache
            cache.set(cacheKey, result);
            return result;
        } catch (err) {
            if (i === 2) throw err;
        }
    }
    throw new Error('Failed to generate dual news output after retries');
}

// ─── Airdrop Validation (GLM-5 — deep analysis) ──────────────────────────────

export async function validateAirdrop(
    projectData: string
): Promise<AirdropValidationResult> {
    // Check cache first
    const cacheKey = cache.generateKey('airdropValidation', projectData);
    const cached = cache.get<AirdropValidationResult>(cacheKey);
    if (cached) {
        return cached;
    }

    const messages = prompts.buildAirdropValidationMessages(projectData);
    const result = await gateway.chat<AirdropValidationResult>({
        model: env.ANALYSIS_MODEL, // GLM-5
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
        messages
    });

    // Store in cache
    cache.set(cacheKey, result);
    return result;
}

// ─── AI Chat Stream (GPT-5-nano — SEO optimized, user-facing) ────────────────

export async function streamChatResponse(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    coinContext: { symbol: string; price: number; newsSummary: string }
) {
    // No caching for chat streams as they are unique interactions
    const chatMessages = prompts.buildChatMessages(messages, coinContext);
    return gateway.chatStream({
        model: env.SEO_MODEL, // GPT-5-nano
        temperature: 0.6,
        messages: chatMessages
    });
}