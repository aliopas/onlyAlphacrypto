import OpenAI from 'openai';
import { env } from '../config/env';

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
    return JSON.parse(content) as MarketVerdictResult;
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
                content: `You are an elite cryptocurrency intelligence analyst. 
Analyze the provided data and return a strict JSON object:
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
    return JSON.parse(content) as DeepIntelligenceReport;
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
    signalText: string;     // 2-sentence radar signal
    keyFacts: string[];     // Bullet facts for GPT to format
}

export async function generateDualNewsOutput(
    rawNewsItem: string,
    trackedProjects: string[],
    recentContext?: string
): Promise<DualNewsOutput> {

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

            return {
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
    return JSON.parse(content) as AirdropValidationResult;
}

// ─── AI Chat Stream (GPT-5-nano — SEO optimized, user-facing) ────────────────

export async function streamChatResponse(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    coinContext: { symbol: string; price: number; newsSummary: string }
) {
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
