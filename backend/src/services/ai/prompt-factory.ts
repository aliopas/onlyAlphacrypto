import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;

export const LANGUAGE_MANDATE = `
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
Write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters.
Translate any non-English input to English before using it.
Violation makes the entire output invalid.
`.trim();

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

export interface DeepSynthesisInput {
    coinSymbol: string;
    newsArticles: string[];
    recentMemory: Array<{
        eventType: string;
        eventSummary: string;
        verdict?: string | null;
        confidenceScore?: number | null;
        riskVerdict?: string | null;
        keyDrivers?: string[] | null;
        redFlags?: string[] | null;
    }>;
    marketData: Record<string, unknown> | null;
    onchainData: Record<string, unknown> | null;
    tavilyContext: string;
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
                content: `${LANGUAGE_MANDATE}\n\nYou are an elite crypto market analyst. Analyze the provided data and return a strict JSON object with these exact fields:
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
                content: `${LANGUAGE_MANDATE}\n\nYou are an elite cryptocurrency intelligence analyst. Analyze the provided data and return a strict JSON object:
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
                content: `${LANGUAGE_MANDATE}\n\nYou are a crypto news triage analyst for OnlyAlpha.
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
                content: `${LANGUAGE_MANDATE}\n\nYou are an elite cryptocurrency news analyst. Analyze the given crypto news headline and return STRICT JSON:
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
                content: `${LANGUAGE_MANDATE}\n\nYou are an expert crypto SEO content editor. You receive a raw news analysis and format it into a high-quality, SEO-optimized article output. Return STRICT JSON:
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
                content: `${LANGUAGE_MANDATE}\n\nYou are an expert at identifying legitimate crypto airdrop opportunities vs scams. Analyze the provided project data and return:
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
            ? `${LANGUAGE_MANDATE}\n\nYou are 'Ask OnlyAlpha', an elite cryptocurrency deep analysis assistant in Context Mode.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.

Rules:
1. The user has selected a specific article or AI signal. Focus your analysis on that PRIMARY FOCUS content.
2. Cross-reference with LATEST UPDATES if available to provide the most current view.
3. Be thorough and data-driven — use specific numbers, price levels, and timeframes.
4. Highlight any new developments that contradict or confirm the original analysis.
5. Do NOT give direct financial advice. Use "Data suggests..." or "Historically..."
6. Never break character — you only discuss crypto.
7. Responses can be longer and more detailed than general mode (up to 200 words).`
            : `${LANGUAGE_MANDATE}\n\nYou are 'Ask OnlyAlpha', an elite, concise crypto market analyst assistant.
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

    buildDeepSynthesisMessages(data: DeepSynthesisInput): ChatCompletionMessageParam[] {
        const systemPrompt = [
            `${LANGUAGE_MANDATE}\n\nYou are an elite cryptocurrency deep analysis engine. Synthesize all provided data into a comprehensive analysis. Return STRICT JSON:`,
            '{',
            '  "executiveSummary": "<4-6 sentences explaining the WHY behind current market action with specific data points>",',
            '  "keyDrivers": ["<reason 1 referencing specific news/data>", "<reason 2>", "<reason 3>", "<reason 4>"],',
            '  "marketContext": "<2-3 sentences explaining how this coin fits in the broader market>",',
            '  "riskAssessment": "LOW|MEDIUM|HIGH",',
            '  "redFlags": ["<flag 1 from tavily or memory>", "<flag 2>"],',
            '  "confidenceScore": <0-100>,',
            '  "fullArticle": "<800+ word article. Structure: 1) Hook: One attention-grabbing opening sentence. 2) Executive Brief: 3-4 sentence summary of the situation. 3) Deep Analysis: The WHY behind the movement with specific data (price levels, %, volumes). 4) Historical Context: Compare current event to recentMemory entries. 5) Red Flags: Any scam signals, contract risks, or negative indicators from Tavily search. 6) Trader Implications: Actionable insights for traders (support/resistance levels, timeframes, risk/reward). Write in a professional but engaging tone for crypto traders.>"',
            '}',
            'Rules:',
            '- Use HISTORICAL MEMORY to add depth and compare past events to the current situation',
            '- Use TAVILY CONTEXT to validate claims and identify potential scams or red flags',
            '- Use MARKET DATA for specific price levels and metrics',
            '- The fullArticle MUST be 800+ words minimum',
            '- Be specific: include numbers, percentages, price levels, timeframes',
            '- Do NOT hedge -- give clear, actionable analysis'
        ].join('\n');

        const userPrompt = `Analyze data for ${data.coinSymbol}:

--- NEWS ARTICLES ---
${JSON.stringify(data.newsArticles)}

--- HISTORICAL MEMORY (Past Events) ---
${JSON.stringify(data.recentMemory)}

--- MARKET DATA ---
${JSON.stringify(data.marketData)}

--- ON-CHAIN DATA ---
${JSON.stringify(data.onchainData)}

--- TAVILY RESEARCH CONTEXT ---
${data.tavilyContext}`;

        return [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];
    }

    buildArticleSEOMessages(fullArticle: string, coinSymbol: string): ChatCompletionMessageParam[] {
        const systemPrompt = [
            `${LANGUAGE_MANDATE}\n\nYou are an expert crypto SEO content editor. Analyze the provided article and return STRICT JSON:`,
            '{',
            '  "metaTitle": "<Max 60 chars. Include primary keyword + brand. Format: \'Keyword Action | OnlyAlpha\'>",',
            '  "metaDescription": "<Max 160 chars. Include primary keyword, summarize the insight, include a CTA like \'Read the full analysis\'>",',
            '  "seoKeywords": ["<primary keyword>", "<secondary keyword>", "<long-tail keyword>", "<coin name + action>", "<market trend keyword>"],',
            '  "slug": "<url-friendly slug, lowercase, hyphens only, max 6 words>"',
            '}',
            'SEO Rules:',
            '- metaTitle: Must include the coin name and most impactful action/event',
            '- metaDescription: Must include the keyword naturally and end with a CTA',
            '- seoKeywords: 5 keywords minimum, mix of short-tail and long-tail',
            '- slug: Use the coin name + main event keyword (e.g., "solana-breaks-resistance-155")'
        ].join('\n');

        const userPrompt = `Coin: ${coinSymbol}

Article:
${fullArticle}`;

        return [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];
    }
}