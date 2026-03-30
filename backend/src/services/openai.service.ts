import OpenAI from 'openai';
import { env } from '../config/env';
import crypto from 'crypto';

// OpenRouter client — OpenAI-compatible with all models accessible via one API
const openrouter = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 90000, // 90s — prevents SIGTERM from slow DeepSeek reasoning
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

// ─── CACHING LAYER ──────────────────────────────────────────────────────────────
// Cache for AI analysis results to prevent redundant API calls
const analysisCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 1000; // Cleanup when cache exceeds this size

/**
 * Generate a cache key from function parameters
 */
function generateCacheKey(prefix: string, ...args: any[]): string {
    const keyData = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join('||');
    return `${prefix}:${crypto.createHash('sha256').update(keyData).digest('hex')}`;
}

/**
 * Clean up expired cache entries */
function cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of analysisCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            analysisCache.delete(key);
        }
    }

    // If still too large, remove oldest entries
    if (analysisCache.size > MAX_CACHE_SIZE) {
        const sortedEntries = Array.from(analysisCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest 20% of entries        const removeCount = Math.ceil(sortedEntries.length * 0.2);
        for (let i = 0; i < removeCount; i++) {
            analysisCache.delete(sortedEntries[i][0]);
        }
    }
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
    // Check cache first
    const cacheKey = generateCacheKey('marketVerdict', coinSymbol, data);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result as MarketVerdictResult;
    }

    const response = await openrouter.chat.completions.create({
        model: env.ANALYSIS_MODEL, // GLM-5
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are an elite crypto market analyst. Analyze the provided data and return a strict JSON object with these exact fields:
{
  "verdict": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore": <0-100>,
  "executiveSummary": "<2-3 sentence professional summary>",
  "supportLevels": [<price>, <price>],
  "resistanceLevels": [<price>, <price>]
}`,
            },
            {
                role: 'user',
                content: `Analyze ${coinSymbol}:
- Current Price: $${data.price}
- RSI: ${data.rsi}
- 24h Volume Change: ${data.volumeChange}%
- Recent News: ${data.recentNews.join(' | ')}`,
            },
        ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty response for market verdict');
    const result = JSON.parse(content) as MarketVerdictResult;

    // Store in cache
    analysisCache.set(cacheKey, { result, timestamp: Date.now() });
    cleanupCache(); // Periodic cleanup

    return result;
}

// ─── Deep Intelligence Report (Adaptive Model Routing) ───

export async function generateDeepIntelligenceReport(
    coinSymbol: string,
    aggregatedData: {
        recentNews: string[];
        existingContext?: string[];
        stats?: any;
        scamReport?: string;
    }
): Promise<DeepIntelligenceReport> {
    // Check cache first
    const cacheKey = generateCacheKey('deepIntelligence', coinSymbol, aggregatedData);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result as DeepIntelligenceReport;
    }

    // Adaptive Model Routing Logic
    const hasManyNews = aggregatedData.recentNews.length > 3;
    const hasScamAlerts = aggregatedData.scamReport && aggregatedData.scamReport.length > 100;
    // Threshold raised from >10% to >30% — small-cap DexScreener tokens routinely show
    // 100-5000% moves, so >10% was causing ALL tokens to route to DeepSeek-R1 unnecessarily.
    const isVolatile = aggregatedData.stats && Math.abs(aggregatedData.stats.priceChange24h || 0) > 30;

    // Both tiers now use DeepSeek-R1 via ANALYSIS_MODEL env var (GLM-5 removed — DeepSeek is cheaper at scale)
    // Complex tokens get DeepSeek with higher temperature, routine get lower temperature
    const aiModel = env.ANALYSIS_MODEL; // Always deepseek/deepseek-r1
    const temperature = (hasManyNews || hasScamAlerts || isVolatile) ? 0.4 : 0.2;

    console.log(`[ModelRouting] Using ${aiModel} for ${coinSymbol} (Volatile: ${isVolatile}, News: ${aggregatedData.recentNews.length}, Scam: ${!!hasScamAlerts}, Temp: ${temperature})`);

    const response = await openrouter.chat.completions.create({
        model: aiModel,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are an elite cryptocurrency intelligence analyst. Analyze the provided data and return a strict JSON object:
{
  "riskVerdict": "LOW|MEDIUM|HIGH|SCAM",
  "verdict": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore": <0-100>,
  "executiveSummary": "<4-6 sentences explaining the WHY behind the verdict with specific data points>",
  "keyDrivers": ["<numbered reason 1 referencing specific news>", "<reason 2>", "<reason 3>"],
  "marketContext": "<brief explanation of how this token fits in the broader market>",
  "redFlags": ["<issue 1>", "<issue 2>"]
} 
If 'Existing Context' is provided, it contains news we already analyzed. Use it for historical perspective but focus the 'Executive Summary' on what is NEW in 'Recent News'.`
            },
            {
                role: 'user',
                content: `Analyze data for ${coinSymbol}:
                
--- NEW DATA ---
Recent News: ${JSON.stringify(aggregatedData.recentNews)}
Technical Stats: ${JSON.stringify(aggregatedData.stats)}
Scam Search Results: ${aggregatedData.scamReport}

--- EXISTING CONTEXT (PREVIOUSLY ANALYZED) ---
${JSON.stringify(aggregatedData.existingContext || [])}`
            }
        ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty response for deep intelligence report');
    const result = JSON.parse(content) as DeepIntelligenceReport;

    // Store in cache
    analysisCache.set(cacheKey, { result, timestamp: Date.now() });
    cleanupCache(); // Periodic cleanup
    return result;
}

// ─── Lightweight Triage Function (Phase 1B) ───────────────────────────────────
/**
 * Generate lightweight triage scores for news batches
 * Uses cheap/fast model (GPT-5-nano equivalent) to score relevance (0-100)
 */
export async function generateLightweightTriage(
    newsBatch: Array<{ title: string; source?: string }>
): Promise<Array<{ title: string; source?: string; relevanceScore: number; sentimentHint: string | null }>> {
    // Check cache first
    const cacheKey = generateCacheKey('lightweightTriage', newsBatch);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result as Array<{ title: string; source?: string; relevanceScore: number; sentimentHint: string | null }>;
    }

    try {
        const response = await openrouter.chat.completions.create({
            model: env.SEO_MODEL, // GPT-5-nano equivalent (cheap/fast model)
            temperature: 0.2, // Low temperature for consistent scoring
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are a crypto news triage analyst. Your job is to quickly assess news items for their potential market impact and hype potential. For each news item, return a JSON object with:
{
  "relevanceScore": <0-100>, // 0 = irrelevant/noise, 100 = extremely high impact/hype
  "sentimentHint": "bullish|bearish|neutral|null" // Quick sentiment assessment (null if unclear)
}
Focus on: 
- Mentions of major cryptocurrencies (BTC, ETH, SOL, etc.)
- Price-moving events (listings, delistings, major partnerships, regulatory news)
- Social media virality indicators
- Avoid deep analysis - this is a quick filter for prioritization`
                },
                {
                    role: 'user',
                    content: `Assess these news items for triage (return JSON array in same order):
${newsBatch.map((item, index) => `${index + 1}. Title: "${item.title}"${item.source ? ` | Source: ${item.source}` : ''}`).join('\n')}`
                }
            ],
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('Empty response for lightweight triage');

        const parsed = JSON.parse(content);
        // Handle both array format and object format
        const resultsArray = Array.isArray(parsed) ? parsed :
            (parsed.results || parsed.triageScores || []);

        // Map results back to original news items        const triagedNews = newsBatch.map((item, index) => {
        const scoreObj = resultsArray[index] || {};
        return {
            ...item,
            relevanceScore: Math.max(0, Math.min(100, Number(scoreObj.relevanceScore) || 50)),
            sentimentHint: scoreObj.sentimentHint || null
        };
    });

    // Store in cache
    analysisCache.set(cacheKey, { result: triagedNews, timestamp: Date.now() });
    cleanupCache(); // Periodic cleanup

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
    const fallbackCacheKey = generateCacheKey('lightweightTriage_fallback', newsBatch);
    analysisCache.set(fallbackCacheKey, { result: fallbackResults, timestamp: Date.now() });

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
    marketData: any,
    onchainData: any,
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
// Step 1: DeepSeek-R1 analyzes the raw news and extracts structured data// Step 2: GPT-5-nano formats the analysis into SEO-optimized article output

interface RawAnalysis {
    analysis: string;       // Raw editorial analysis
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;    // 0-100
    isBreaking: boolean;
    coinSymbol?: string;
    signalText: string;     // 2-sentence radar signal
    keyFacts: string[];     // Bullet facts for GPT to format
}

export async function generateDualNewsOutput(
    rawNewsItem: string,
    trackedProjects: string[],
    recentContext?: string
): Promise<DualNewsOutput> {
    // Check cache first    const cacheKey = generateCacheKey('dualNewsOutput', rawNewsItem, trackedProjects, recentContext);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result as DualNewsOutput;
    }

    // ── STEP 1: DeepSeek-R1 — Deep Analysis ──────────────────────────────────
    const analysisMessages = [
        {
            role: 'system' as const,
            content: `You are an elite cryptocurrency news analyst. Analyze the given crypto news headline and return STRICT JSON:
{
  "analysis": "<3-4 sentence in-depth analysis with specific data points, market impact, and trader implications>",
  "sentiment": "bullish|bearish|neutral",
  "impactScore": <0-100>,
  "isBreaking": <true if headline contains: Snapshot, TGE, Claim, Hack, Exploit, SEC, Crash, Listing; else false>,
  "coinSymbol": "<ticker symbol if identifiable, else null>",
  "signalText": "<2 punchy sentences max 40 words for radar, MUST include specific data/price level>",
  "keyFacts": ["<fact 1>", "<fact 2>", "<fact 3>"]
}
Tracked projects for isBreaking check: ${trackedProjects.join(', ')}
${recentContext ? `Recent context (avoid repeating): ${recentContext}` : ''}`,
        },
        { role: 'user' as const, content: rawNewsItem },
    ];

    let rawAnalysis: RawAnalysis;
    for (let i = 0; i < 3; i++) {
        try {
            const res = await openrouter.chat.completions.create({
                model: env.ANALYSIS_MODEL, // deepseek/deepseek-r1
                temperature: 0.3,
                response_format: { type: 'json_object' },
                messages: analysisMessages,
            });
            const content = res.choices[0].message.content;
            if (!content) { if (i < 2) continue; throw new Error('Empty DeepSeek response'); }
            rawAnalysis = JSON.parse(content) as RawAnalysis;
            break;
        } catch (err) {
            if (i === 2) throw err;
        }
    }

    // ── STEP 2: GPT-5-nano — SEO Formatting & Polish ────────────────────────────
    const seoMessages = [
        {
            role: 'system' as const,
            content: `You are an expert crypto SEO content editor. You receive a raw news analysis and format it into a high-quality, SEO-optimized article output. Return STRICT JSON:
{
  "headline": "<SEO-rich, action-verb title, keyword-first, max 15 words>",
  "hook": "<1 powerful opening sentence that creates urgency or curiosity for the reader>",
  "summary": "<Full article: start with hook, then 3-4 sentences of deep analysis with data points. Write for crypto traders. Include price levels, % moves, or timeframes where possible.>",
  "metaTitle": "<Max 60 chars. Include primary keyword + brand: 'OnlyAlpha'>",
  "metaDescription": "<Max 160 chars. Include primary keyword, summarize the insight, include a call to action like 'Read the full analysis'>",
  "seoKeywords": ["<primary keyword>", "<secondary keyword>", "<long-tail keyword>", "<coin name + action>", "<market trend keyword>"]
}
SEO Rules:
- Keywords: include the coin name, action (buy/sell/pump/hack), and market context
- Headlines: Start with the most important keyword, use numbers/% where possible
- Hook: Should make the reader NEED to read more in one sentence
- metaTitle: Format as "Keyword Action | OnlyAlpha"
- metaDescription: Include the keyword naturally and end with a CTA`,
        },
        {
            role: 'user' as const,
            content: JSON.stringify(rawAnalysis!),
        },
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const res = await openrouter.chat.completions.create({
                model: env.SEO_MODEL, // openai/gpt-5-nano
                temperature: 0.5,
                response_format: { type: 'json_object' },
                messages: seoMessages,
            });
            const content = res.choices[0].message.content;
            if (!content) { if (i < 2) continue; throw new Error('Empty GPT-5-nano SEO response'); }
            const seoOutput = JSON.parse(content);

            const result = {
                wireCard: {
                    headline: seoOutput.headline || rawNewsItem.slice(0, 100),
                    hook: seoOutput.hook || '',
                    summary: seoOutput.summary || rawAnalysis!.analysis,
                    metaTitle: seoOutput.metaTitle || seoOutput.headline?.slice(0, 60) || '',
                    metaDescription: seoOutput.metaDescription || '',
                    seoKeywords: Array.isArray(seoOutput.seoKeywords) ? seoOutput.seoKeywords : [],
                    sentiment: rawAnalysis!.sentiment,
                    impactScore: rawAnalysis!.impactScore,
                    isBreaking: rawAnalysis!.isBreaking,
                    coinSymbol: rawAnalysis!.coinSymbol,
                },
                radarCard: {
                    signalText: rawAnalysis!.signalText,
                    sentiment: rawAnalysis!.sentiment,
                    impactScore: rawAnalysis!.impactScore,
                    coinSymbol: rawAnalysis!.coinSymbol,
                },
            } as DualNewsOutput;

            // Store in cache            analysisCache.set(cacheKey, { result, timestamp: Date.now() });
            cleanupCache(); // Periodic cleanup

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
    // Check cache first    const cacheKey = generateCacheKey('airdropValidation', projectData);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result as AirdropValidationResult;
    }

    const response = await openrouter.chat.completions.create({
        model: env.ANALYSIS_MODEL, // GLM-5
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are an expert at identifying legitimate crypto airdrop opportunities vs scams. Analyze the provided project data and return:
{
  "isLegitimate": <true|false>,
  "riskVerdict": "LOW|MEDIUM|HIGH|SCAM",
  "tasks": [
    {
      "description": "<human readable task>",
      "contractAddress": "<optional 0x...>",
      "minAmount": <optional number>,
      "tokenSymbol": "<optional>",
      "chain": "<optional: ethereum|zksync|linea|arbitrum>",
      "isAutoVerifiable": <true|false>
    }
  ],
  "estValue": "<e.g. $500-$2000>",
  "aiReport": "<3-4 paragraph professional audit report>"
}
Rules: isAutoVerifiable = true ONLY if the task involves a specific on-chain action with a verifiable contract.`,
            },
            { role: 'user', content: projectData },
        ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty response for airdrop validation');
    const result = JSON.parse(content) as AirdropValidationResult;

    // Store in cache    analysisCache.set(cacheKey, { result, timestamp: Date.now() });
    cleanupCache(); // Periodic cleanup

    return result;
}

// ─── AI Chat Stream (GPT-5-nano — SEO optimized, user-facing) ────────────────

export async function streamChatResponse(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    coinContext: { symbol: string; price: number; newsSummary: string }
) {
    // No caching for chat streams as they are unique interactions
    return openrouter.chat.completions.create({
        model: env.SEO_MODEL, // GPT-5-nano
        stream: true,
        temperature: 0.6,
        messages: [
            {
                role: 'system',
                content: `You are 'Ask OnlyAlpha', an elite, concise crypto market analyst assistant.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.
Recent context: ${coinContext.newsSummary}.

Rules:
1. Be extremely concise and direct, use bullet points where possible.
2. Focus on data, technical analysis, and market sentiment.
3. Keep responses under 50 words unless specifically asked for details.
4. Do NOT give direct financial advice. Use "Historically," or "Data suggests..."
5. Never break character — you only discuss crypto.`,
            },
            ...messages,
        ],
    });
}