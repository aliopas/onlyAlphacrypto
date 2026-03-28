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
        headline: string;
        summary: string;
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

    // Tier-1 (Complex): DeepSeek-R1 for high-stakes/complex data (many news OR scam signals OR extreme volatility)
    // Tier-2 (Routine): GLM-5 for standard tracking
    const aiModel = (hasManyNews || hasScamAlerts || isVolatile) 
        ? 'deepseek/deepseek-r1' 
        : env.ANALYSIS_MODEL; 

    console.log(`[ModelRouting] Using ${aiModel} for ${coinSymbol} (Volatile: ${isVolatile}, News: ${aggregatedData.recentNews.length}, Scam: ${!!hasScamAlerts})`);

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

// ─── Dual News Output (GLM-5 — analysis + radar) ─────────────────────────────

export async function generateDualNewsOutput(
    rawNewsItem: string,
    trackedProjects: string[],
    recentContext?: string
): Promise<DualNewsOutput> {
    const messages = [
        {
            role: 'system' as const,
            content: `You process crypto news and produce two SEO-optimized outputs in one JSON:
{
  "wireCard": {
    "headline": "<SEO-friendly, keyword-rich, compelling title, max 15 words>",
    "summary": "<3-5 sentence deep analysis with specific data points, written for a crypto audience>",
    "sentiment": "bullish|bearish|neutral",
    "impactScore": <0-100>,
    "isBreaking": <true|false>,
    "coinSymbol": "<optional, e.g. SOL>"
  },
  "radarCard": {
    "signalText": "<2 punchy sentences, max 40 words, MUST include a specific data point or price level>",
    "sentiment": "bullish|bearish|neutral",
    "impactScore": <0-100>,
    "coinSymbol": "<optional>"
  }
}
SEO Instructions: Use strong action verbs, include price levels/percentages where relevant, and mention timeframes.
isBreaking = true if the news contains keywords: Snapshot, TGE, Claim, Hack, Exploit, SEC, Crash.
Tracked projects for keyword matching: ${trackedProjects.join(', ')}
${recentContext ? `\nIf recent analysis context is provided, use it to avoid repeating the same insights and to build on previous analysis.\nRecent context: ${recentContext}` : ''}`,
        },
        { role: 'user' as const, content: rawNewsItem },
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const response = await openrouter.chat.completions.create({
                model: env.WRITER_MODEL, // GPT-5.4-nano for writing/SEO
                temperature: 0.5,
                response_format: { type: 'json_object' },
                messages,
            });

            const content = response.choices[0].message.content;
            if (!content) {
                if (i < 2) continue; // retry
                throw new Error('Empty response for news dual output');
            }
            return JSON.parse(content) as DualNewsOutput;
        } catch (error) {
            if (i === 2) throw error;
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
