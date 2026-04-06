import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;
import type { CoinIntelligence } from '../coinIntelligence.service';
import type { TemporalPattern } from '../temporalIntelligence.service';
import type { PriceResult } from '../priceService';



// Define input interfaces
export interface MarketVerdictInput {
    price: number;
    rsi: number;
    volumeChange: number;
    recentNews: string[];
}

export interface DeepIntelligenceInput {
    recentNews: string[];
    existingContext?: string[];
    stats?: Record<string, number | string>;
    scamReport?: string;
}

export interface TriageInput {
    newsBatch: Array<{ title: string; source?: string }>;
}

export interface DualNewsStep1Input {
    rawNewsItem: string;
    trackedProjects: string[];
    recentContext?: string;
}

export interface DualNewsStep2Input {
    rawAnalysis: RawAnalysisData;
}

export interface AirdropValidationInput {
    projectData: string;
}

export interface ChatInput {
    messages: ChatMessage[];
    coinContext: CoinContext;
}

export interface ChatModeParams {
    messages: ChatMessage[];
    coinContext: CoinContext;
    mode?: 'general' | 'context';
}



export interface DeepAnalysisInput {
    headline: string;
    intelligence: CoinIntelligence | null;
    pattern: TemporalPattern | null;
    price: PriceResult | null;
}

// Define additional interfaces used in the prompts
export interface RawAnalysisData {
    analysis: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    isBreaking: boolean;
    coinSymbol?: string;
    signalText: string;
    keyFacts: string[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface CoinContext {
    symbol: string;
    price: number;
    newsSummary: string;
}

export class PromptFactory {
    buildMarketVerdictMessages(coinSymbol: string, data: MarketVerdictInput): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are an elite crypto market analyst. Analyze the provided data and return a strict JSON object with these exact fields:
{
  "verdict": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore": <0-100>,
  "executiveSummary": "<2-3 sentence professional summary>",
  "supportLevels": [<price>, <price>],
  "resistanceLevels": [<price>, <price>]`
            },
            {
                role: 'user',
                content: `Analyze ${coinSymbol}:
- Current Price: $${data.price}
- RSI: ${data.rsi}
- 24h Volume Change: ${data.volumeChange}%
- Recent News: ${data.recentNews.join(' | ')}`
            }
        ];
    }

    buildDeepIntelligenceMessages(coinSymbol: string, aggregatedData: DeepIntelligenceInput): ChatCompletionMessageParam[] {
        return [
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
        ];
    }

    buildTriageMessages(newsBatch: Array<{ title: string; source?: string }>): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are a crypto news triage analyst for OnlyAlpha.
For EACH headline in the input array, return one JSON object.
Return an array in the SAME ORDER as input, wrapped in { "results": [...] }.

Per item:
{
  "relevanceScore": <0-100>,
  "sentimentHint": "bullish|bearish|neutral",
  "symbolMentions": ["BTC", "ETH"],
  "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
  "eventSeverity": <1|2|3>
}

Scoring:
90-100  Exchange listings, hacks, SEC actions, ETF approvals, exploits, token launches
70-89   Price milestones, whale moves, mainnet upgrades, major funding (>$50M)
50-69   Minor updates, small partnerships, opinion pieces
0-49    Spam, rehashed news, promotional content

Severity:
3 = CRITICAL: Hack confirmed, SEC action, top-5 exchange listing, ETF approval, $100M+ funding
2 = MAJOR: Protocol upgrade, $10M-$100M funding, mid-tier listing, Fortune 500 partnership
1 = MINOR: Small partnership, minor update, community news`
            },
            {
                role: 'user',
                content: `Assess these news items for triage (return JSON array in same order):
${newsBatch.map((item, index) => `${index + 1}. Title: "${item.title}"${item.source ? ` | Source: ${item.source}` : ''}`).join('\n')}`
            }
        ];
    }

    buildDualNewsStep1Messages(rawNewsItem: string, trackedProjects: string[], recentContext?: string): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
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
${recentContext ? `Recent context (avoid repeating): ${recentContext}` : ''}`
            },
            {
                role: 'user',
                content: rawNewsItem
            }
        ];
    }

    buildDualNewsStep2Messages(rawAnalysis: RawAnalysisData): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
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
- metaDescription: Include the keyword naturally and end with a CTA`
            },
            {
                role: 'user',
                content: JSON.stringify(rawAnalysis)
            }
        ];
    }

    buildAirdropValidationMessages(projectData: string): ChatCompletionMessageParam[] {
        return [
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
Rules: isAutoVerifiable = true ONLY if the task involves a specific on-chain action with a verifiable contract.`
            },
            {
                role: 'user',
                content: projectData
            }
        ];
    }

    buildChatMessages(messages: ChatMessage[], coinContext: CoinContext, mode: 'general' | 'context' = 'general'): ChatCompletionMessageParam[] {
        const systemPrompt = mode === 'context'
            ? `You are 'Ask OnlyAlpha', an elite cryptocurrency deep analysis assistant in Context Mode.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.

Rules:
1. The user has selected a specific article or AI signal. Focus your analysis on that PRIMARY FOCUS content.
2. Cross-reference with LATEST UPDATES if available to provide the most current view.
3. Be thorough and data-driven — use specific numbers, price levels, and timeframes.
4. Highlight any new developments that contradict or confirm the original analysis.
5. Do NOT give direct financial advice. Use "Data suggests..." or "Historically..."
6. Never break character — you only discuss crypto.
7. Responses can be longer and more detailed than general mode (up to 200 words).`
            : `You are 'Ask OnlyAlpha', an elite, concise crypto market analyst assistant.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.
Recent context: ${coinContext.newsSummary}.

Rules:
1. Be extremely concise and direct, use bullet points where possible.
2. Focus on data, technical analysis, and market sentiment.
3. Keep responses under 50 words unless specifically asked for details.
4. Do NOT give direct financial advice. Use "Historically," or "Data suggests..."
5. Never break character -- you only discuss crypto.`;

        return [
            {
                role: 'system',
                content: systemPrompt
            },
            ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];
    }



    buildDeepAnalysisMessages(input: DeepAnalysisInput): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are a crypto data analyst. Your output feeds a downstream writing engine.
DO NOT write articles. DO NOT write prose. Output STRICT JSON only.

{
  "sentiment":       "bullish|bearish|neutral",
  "impactScore":     <0-100>,
  "isBreaking":      <true if: Hack|Exploit|SEC|Listing|ETF|TokenLaunch|Mainnet>,
  "coinSymbol":      "<TICKER>",
  "eventType":       "<ETF|Hack|Listing|Upgrade|Partnership|Funding|Regulatory|Other>",
  "eventSeverity":   <1|2|3>,
  "analysis": {
    "mainDriver":       "<1 sentence — core reason this matters>",
    "priceImplication": "<1 sentence — what this means for price>",
    "temporalContext":  "<1 sentence referencing historical pattern if provided, else null>",
    "riskNote":         "<1 sentence — biggest risk or red flag>"
  },
  "keyFacts": [
    "<fact with specific number>",
    "<fact with specific number>",
    "<fact with specific number>"
  ],
  "supportLevels":    [<price>, <price>],
  "resistanceLevels": [<price>, <price>],
  "signalText":       "<MAX 40 words. Bloomberg-style. One number required. English only.>",
  "verdict":          "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore":  <0-100>
}

Rules:
- Output ONLY the JSON object. No preamble. No text outside JSON.
- All string values in English.
- impactScore 80+: only events that directly move price (hacks, listings, SEC actions).
- If temporal pattern provided → always reference it in analysis.temporalContext.
- keyFacts: must contain specific numbers, dates, or verifiable claims.`
            },
            {
                role: 'user',
                content: `Analyze this news headline:

Headline: ${input.headline}

--- CURRENT PRICE ---
${input.price ? `Price: $${input.price.price} (${input.price.source}, 24h change: ${input.price.change24h ?? 'N/A'}%)` : 'Price data unavailable'}

--- COIN INTELLIGENCE ---
${input.intelligence ? JSON.stringify({
    ATH: input.intelligence.ath,
    'ATH Date': input.intelligence.athDate,
    '52w Range': `$${input.intelligence.week52Low ?? 'N/A'} - $${input.intelligence.week52High ?? 'N/A'}`,
    '8-Week Trend': input.intelligence.trend8w ?? 'N/A',
    '30d Change': input.intelligence.priceChange30d ? `${input.intelligence.priceChange30d}%` : 'N/A',
    Background: input.intelligence.wikiBackground || 'No background available',
    'DEX Boosted': input.intelligence.dexBoostActive,
}) : 'No intelligence data available'}

--- HISTORICAL PATTERN ---
${input.pattern ? JSON.stringify(input.pattern) : 'No historical pattern available'}`
            }
        ];
    }

    buildArticleWriterMessages(analysisJson: string, tone?: string): ChatCompletionMessageParam[] {
        const toneDirective = tone
            ? `\nTONE: Write in a ${tone} tone. Adjust your language, urgency, and emotional register accordingly.`
            : '';

        return [
            {
                role: 'system',
                content: `You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object. Transform it into a compelling article.

You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.${toneDirective}

Output STRICT JSON:
{
  "headline":        "<SEO headline. Action verb first. Coin + event. MAX 15 words.>",
  "hook":            "<One powerful opening sentence. Must include the most important number.>",
  "fullArticle":     "<800+ words. Sections:
    [HOOK] Expand the hook into 2-3 sentences.
    [WHAT HAPPENED] Factual summary using keyFacts from input.
    [WHY IT MATTERS] Use analysis.mainDriver and analysis.priceImplication.
    [HISTORY REPEATS?] If analysis.temporalContext is not null — expand it with numbers.
    [PRICE PICTURE] Use support/resistance levels. Reference trend and ATH distance.
    [RISK CHECK] Use analysis.riskNote honestly.
    [BOTTOM LINE] Verdict + confidenceScore. 'Analysis rates this as X with Y% confidence.'
    Rules: Bloomberg meets Reddit tone. One number per paragraph minimum.
    No vague language. No financial advice — use 'data suggests', 'analysis indicates'.>",
  "metaTitle":       "<MAX 60 chars. Format: 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars. Primary keyword. End: Read the analysis on OnlyAlpha.>",
  "seoKeywords":     ["<coin+event>", "<market action>", "<long-tail query>", "<coin+price>", "<trend>"]
}`
            },
            {
                role: 'user',
                content: analysisJson
            }
        ];
    }


}