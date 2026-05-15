import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;
import type { CoinIntelligence } from '../coinIntelligence.service';
import type { TemporalPattern } from '../temporalIntelligence.service';
import type { PriceResult } from '../priceService';
import type { HistoricalStatsOutput } from '../historicalEventStats.service';
import type { MtfContext } from '../mtfContext.service';



// Define input interfaces
export interface TriageInput {
    newsBatch: Array<{ title: string; source?: string }>;
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
    coinSymbol: string;
    historicalStats?: string;
    eventImpactContext?: string;
    recentMemory?: ReadonlyArray<{
        eventType: string;
        eventSummary: string;
        priceAtEvent: number | null;
        verdict: string | null;
        confidenceScore: number | null;
        riskVerdict: string | null;
        keyDrivers: string[] | null;
        redFlags: string[] | null;
        createdAt: Date;
    }>;
    nearPriceLevels?: ReadonlyArray<{
        levelPrice: number;
        levelType: 'support' | 'resistance';
        confidenceScore: number;
        timeframe: string;
        touchCount: number;
        bounceCount: number;
        breakCount: number;
        lastTouchedAt?: Date;
    }>;
    mtfContext?: MtfContext | null;
}

export interface MasterUpdateInput {
    analysisResult: unknown;
    existingSections: string;
    sectionDirective: string;
}

export interface MinorUpdateInput {
    newsTitle: string;
    existingHeadline: string;
    coinSymbol: string;
    currentPrice: number | null;
    priceChange24h: number | null;
    recentTimeline: ReadonlyArray<{
        updateText: string;
        createdAt: Date;
        severity: string;
    }>;
}

// Define additional interfaces used in the prompts

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
  "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Fed_Rate|CPI|Geopolitical|Influencer_Statement|Executive_Change|Large_Transfer|Token_Unlock|Exchange_Netflow|Other>",
  "eventSeverity": <1|2|3>,
  "classification": "MAJOR|MINOR|NOISE",
  "confidence": <0.0-1.0 — how confident are you in this classification? 1.0 = very confident, 0.0 = guessing. Consider: is the event type clear? Is the sentiment obvious? Is the coin impact direct or indirect?>
}

Classification rules:
- MAJOR: ETF approvals, major hacks/exploits, SEC actions, top-10 exchange listings, mainnet launches, $100M+ funding, protocol breaking changes
- MINOR: Price milestones, whale moves, partnerships, upgrades, small-to-medium funding
- NOISE: Rehashed/duplicate news, promotional content, opinion pieces, old news rewritten

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
Rules:
- BE GENEROUS: If the project is a tokenless DeFi protocol with TVL, funding, or active users, it likely has a future airdrop. Set isLegitimate = true and use riskVerdict to express confidence level.
- ONLY set isLegitimate = false for confirmed scams, phishing, or completely inactive/dead projects.
- Tokenless protocols (no token yet) are prime airdrop candidates — default to isLegitimate = true with MEDIUM or HIGH risk.
- Infer reasonable tasks based on the protocol type (e.g., provide liquidity, bridge, trade, stake).
- isAutoVerifiable = true ONLY if the task involves a specific on-chain action with a verifiable contract.`
            },
            {
                role: 'user',
                content: projectData
            }
        ];
    }

    buildAirdropFromArticleMessages(articleContext: string): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are an expert at extracting structured airdrop data from raw crypto news articles.
Analyze the provided article text and return a JSON object with EXACTLY this shape:
{
  "isLegitimate": <true|false>,
  "riskVerdict": "LOW|MEDIUM|HIGH|SCAM",
  "projectName": "<the protocol/project name extracted from the article>",
  "network": "<primary blockchain, e.g. 'Ethereum', 'Solana', 'zkSync Era'>",
  "tasks": [
    {
      "description": "<human-readable task>",
      "contractAddress": "<optional 0x...>",
      "minAmount": <optional number>,
      "tokenSymbol": "<optional>",
      "chain": "<optional: ethereum|zksync|linea|arbitrum|solana>",
      "isAutoVerifiable": <true|false>
    }
  ],
  "estValue": "<e.g. '$500-$2000'>",
  "snapshotDate": "<ISO 8601 date or null>",
  "tgeDate": "<ISO 8601 date or null>",
  "aiReport": "<3-4 paragraph professional analysis of this airdrop opportunity>"
}

Rules:
- BE GENEROUS: If the article mentions ANY crypto project with airdrop, token, TGE, snapshot, claim, or testnet reward activity, set isLegitimate = true. Use the riskVerdict field to express uncertainty (MEDIUM or HIGH) instead of rejecting.
- ONLY set isLegitimate = false if the article is completely unrelated to crypto (e.g., sports, politics, weather) or is clearly a scam warning/phishing alert article.
- Even brief mentions of upcoming airdrops, token distributions, or testnet incentives are VALID — extract the project and create an entry.
- projectName: extract the actual protocol name from the article. If unclear, use the most prominent project mentioned.
- network: the primary blockchain where this airdrop operates. Default to "Unknown" if not specified.
- snapshotDate / tgeDate: if a specific date is mentioned, return it in ISO 8601 format (YYYY-MM-DD). Otherwise return null.
- tasks: infer reasonable tasks based on the protocol type (e.g., bridge assets, provide liquidity, trade, stake, follow on social media).
- isAutoVerifiable = true ONLY for specific on-chain actions with verifiable contract addresses.
- estValue: estimate based on similar projects if not specified. Use ranges like "$100-$500", "$500-$2000".
- Output ONLY the JSON object. No preamble. No text outside JSON.`
            },
            {
                role: 'user',
                content: articleContext
            }
        ];
    }

    buildChatMessages(messages: ChatMessage[], coinContext: CoinContext, mode: 'general' | 'context' = 'general'): ChatCompletionMessageParam[] {
        const systemPrompt = mode === 'context'
            ? `You are 'Ask OnlyAlpha', an elite cryptocurrency deep analysis assistant in Context Mode.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.

The context includes:
- Master Article: The core ongoing story for this coin
- Timeline Updates: Recent developments and events
- Historical Memory: Past significant events and their impacts

Rules:
1. Focus your analysis on the Master Article as the primary context.
2. Cross-reference with Timeline Updates and Historical Memory to provide the most current and comprehensive view.
3. Be thorough and data-driven — use specific numbers, price levels, and timeframes from the provided context.
4. Highlight any new developments that contradict or confirm the original analysis.
5. Do NOT give direct financial advice. Use "Data suggests..." or "Historically..."
6. Never break character — you only discuss crypto.
7. Responses can be longer and more detailed than general mode (up to 200 words).`
            : `You are 'Ask OnlyAlpha', an elite, concise crypto market analyst assistant.
The user is currently analyzing: ${coinContext.symbol} at price: $${coinContext.price}.
Recent context from master article, timeline updates, and historical memory: ${coinContext.newsSummary}.

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
ANTI-HALLUCINATION: Only reference provided data. For levels: if nearPriceLevels provided and at least one has confidenceScore > 50, include levelContext for the strongest level. If no valid levels, omit levelContext field entirely. Never invent levels or statistics.

{
  "sentiment":       "bullish|bearish|neutral",
  "impactScore":     <0-100>,
  "isBreaking":      <true if: Hack|Exploit|SEC|Listing|ETF|TokenLaunch|Mainnet>,
  "coinSymbol":      "<TICKER>",
   "eventType":       "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Fed_Rate|CPI|Geopolitical|Influencer_Statement|Executive_Change|Large_Transfer|Token_Unlock|Exchange_Netflow|Other>",
  "eventSeverity":   <1|2|3>,
  "analysis": {
    "mainDriver":       "<1 sentence — core reason this matters>",
    "priceImplication": "<1 sentence — what this means for price>",
    "temporalContext":  "<If historical pattern provided: summarize the statistical outcome. Format: 'Based on [N] similar [eventType] events for [symbol], bullish rate was [X]%, avg 7d return was [Y]%. Most recent case: [headline, date, outcome].' If no pattern: use domain knowledge to reference 1 specific comparable historical event with numbers. MAX 2 sentences.>",
    "riskNote":         "<1 sentence — biggest risk or red flag>",
    "levelContext":     "<If valid levels exist: 'Price near [support/resistance] level at $[levelPrice] ([timeframe], [confidenceScore]% confidence, [touchCount] touches, [bounceCount] bounces).'. Use strongest level only.>"
  },
  "keyFacts": [
    "<fact with specific number>",
    "<fact with specific number>",
    "<fact with specific number>"
  ],
  "supportLevels":    [<price>, <price>],
  "resistanceLevels": [<price>, <price>],
  "signalText":       "<MAX 70 words. Bloomberg-style. Include: specific dollar amount, source attribution in brackets [Source]. End with '| NFA'. English only.>",
  "verdict":          "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore":  <0-100>,
  "strategicOutlook": {
    "shortTerm": {
      "direction": "bullish|bearish|neutral",
      "target": <next key price level — must be a resistance or support from data>,
      "invalidation": <price that breaks the thesis — a key support/resistance>,
      "catalysts": ["upcoming event 1", "upcoming event 2"],
      "confidence": <0-100>
    },
    "longTerm": {
      "marketPhase": "accumulation|markup|distribution|markdown",
      "bullRunProbability": <0-100>,
      "majorSupport": <key long-term support price>,
      "majorResistance": <key long-term resistance price>,
      "isBottomIn": <true|false>,
      "isTopIn": <true|false>,
      "bullEvidence": ["specific data-backed reason with number", "reason 2"],
      "bearEvidence": ["specific data-backed reason with number", "reason 2"]
    },
    "action": {
      "recommendation": "accumulate|hold|reduce|avoid|watch",
      "rationale": "<1 paragraph data-driven rationale — NEVER use buy/sell/invest>",
      "riskManagement": "<specific: 'If [coin] breaks $X → [action description]'>"
    }
  }
}

Rules:
- Output ONLY the JSON object. No preamble. No text outside JSON.
- All string values in English.
- impactScore 80+: only events that directly move price (hacks, listings, SEC actions).
- If temporal pattern provided → always reference it in analysis.temporalContext.
- keyFacts: must contain specific numbers, dates, or verifiable claims.
- CONSISTENCY RULE: The textual summary in signalText MUST strictly match the JSON verdict. Do NOT write bullish text if verdict is SELL. Do NOT write bearish text if verdict is BUY. The sentiment, signalText, and verdict must all be perfectly aligned.

STRATEGIC OUTLOOK RULES:
- shortTerm.target MUST be a resistance or support level from the provided data, not invented.
- shortTerm.invalidation MUST be a key level — if price breaks it, the directional thesis fails.
- longTerm.marketPhase: use Wyckoff phases based on price action + trend data provided.
- bullEvidence and bearEvidence MUST contain specific numbers and data points, not vague statements.
- action.recommendation: frame as market analysis, NOT financial advice.
- action.riskManagement MUST include a specific invalidation price and what to do if broken.

SAFE HARBOR COMPLIANCE (MANDATORY):
- signalText MUST end with "| NFA"
- NEVER use these words in any field: buy, sell, invest, recommend, should, must
- Use "data suggests", "metrics indicate", "analysis points to" instead
- action.rationale must be framed as: "data suggests [X]", "metrics indicate [Y]"
- This is market intelligence analysis, not financial advice`
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
${input.pattern ? JSON.stringify(input.pattern) : 'No historical pattern available'}

--- HISTORICAL EVENT STATS ---
${input.historicalStats ?? 'No historical event stats available'}

--- HISTORICAL EVENT IMPACT DATA ---
${input.eventImpactContext ?? 'No historical event impact data available'}

--- RECENT EVENTS FOR THIS COIN ---
${input.recentMemory && input.recentMemory.length > 0
    ? input.recentMemory.map((m, i) =>
        `${i + 1}. [${m.createdAt.toISOString().split('T')[0]}] ${m.eventType}: ${m.eventSummary} | Price: $${m.priceAtEvent ?? 'N/A'} | Verdict: ${m.verdict ?? 'N/A'} | Confidence: ${m.confidenceScore ?? 'N/A'}${m.redFlags && m.redFlags.length > 0 ? ` | Red Flags: ${m.redFlags.join(', ')}` : ''}${m.keyDrivers && m.keyDrivers.length > 0 ? ` | Drivers: ${m.keyDrivers.join(', ')}` : ''}`
    ).join('\n')
    : 'No prior events recorded for this coin.'}

--- MULTI-TIMEFRAME CONTEXT ---
${input.mtfContext ? `Dominant Trend: ${input.mtfContext.dominantTrend} (Confluence: ${input.mtfContext.confluence.confluenceScore}%)
Alignment: ${input.mtfContext.confluence.trendAlignment}
${input.mtfContext.timeframes.map(tf => `- ${tf.timeframe}: ${tf.trend} | ATR: ${tf.atr ?? 'N/A'}`).join('\n')}` : 'No MTF context available'}`
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
You receive a JSON analysis object. Transform it into a compelling, in-depth article.

You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.${toneDirective}

Output STRICT JSON:
{
  "headline":        "<SEO headline. Action verb first. Coin + event. MAX 15 words.>",
  "hook":            "<One powerful opening sentence. Must include the most important number.>",
  "fullArticle":     "<2500+ characters. You MUST include ALL 7 section tags EXACTLY as shown below. Do NOT skip any tag. Do NOT merge sections. Each tag MUST appear on its own line. Do NOT rename tags.>",
  "metaTitle":       "<MAX 60 chars. Format: 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars. Primary keyword. End: Read the analysis on OnlyAlpha.>",
  "seoKeywords":     ["<coin+event>", "<market action>", "<long-tail query>", "<coin+price>", "<trend>"]
}

The fullArticle string MUST contain these 7 tags in this exact order:

[HOOK]
Expand the hook into 3-4 sentences. Must include the most important number from the analysis. Set the scene for why this matters RIGHT NOW.

[WHAT HAPPENED]
Factual summary using keyFacts from the input JSON. Every paragraph must contain a number. Provide context about the event — who, what, when, where, how much. Write 4-5 substantive sentences.

[WHY IT MATTERS]
Use analysis.mainDriver and analysis.priceImplication. Explain the market significance and broader implications for the sector. How does this compare to similar events? Write 3-4 substantive sentences.

[HISTORY REPEATS?]
Use _historicalCases from input if available. Cite SPECIFIC past events with dates and percentage outcomes from _historicalCases array. Format: 'In [Month Year], when [coin] faced similar [eventType], the price moved [X]% over 7 days.' If _historicalCases is empty, use analysis.temporalContext. Write 3-4 substantive sentences with at least one concrete number.

[PRICE PICTURE]
Use supportLevels and resistanceLevels from the input. Reference the current price trend and distance from ATH. Discuss volume, momentum, and key technical levels with specific numbers. Write 3-4 substantive sentences.

[RISK CHECK]
Use analysis.riskNote honestly. Add context about downside scenarios, liquidation risks, or regulatory overhang. Be specific about what could go wrong. Write 3-4 substantive sentences.

[BOTTOM LINE]
Provide a data-driven synthesis of the overall market assessment. Summarize the key data points and trend indicators. Format: "Current on-chain metrics and social sentiment indicate a [sentiment direction] trend, supported by a [confidenceScore]% trend strength index." Write 2-3 substantive sentences using phrases like "data suggests", "analysis indicates", "metrics point to". NEVER use BUY, SELL, HOLD, or any imperative action words. Use policy-safe terminology: Upside Target Zone, Risk Zone, Reference Price, Market Scenario, Historical Outcome. Never use: Buy, Sell, Take Profit, Stop Loss, Entry. Describe the state of the market, not a decision to make.

CRITICAL RULES:
- ALL 7 tags MUST appear in the output. Missing even ONE tag will cause the output to be REJECTED.
- MINIMUM 3500 characters total for fullArticle. You MUST write at least 5-6 sentences for EACH of the 7 sections. Missing a tag or writing short sections will trigger a system failure.
- Each section MUST be at least 300 characters of substantive content.
- Bloomberg meets Reddit tone. One number per paragraph minimum.
- No vague language. No financial advice — use "data suggests", "analysis indicates".
- The fullArticle MUST be at least 3500 characters total.
- Write REAL content, not filler. Every sentence must add value or information.
- CONSISTENCY RULE: The textual summary in [BOTTOM LINE] MUST reflect the sentiment direction from the JSON verdict field. Map BUY→Bullish, SELL→Bearish, HOLD/NEUTRAL→Neutral. The narrative must describe market conditions, not prescribe actions.`
            },
            {
                role: 'user',
                content: analysisJson
            }
        ];
    }

    buildArticleStage2AMessages(analysisJson: string, tone: string): { system: string, user: string } {
        const toneDirective = tone
            ? `\nTONE: Write in a ${tone} tone. Adjust your language, urgency, and emotional register accordingly.`
            : '';

        const system = `You are OnlyAlpha's senior market analyst and writer for Stage 2A.
You receive a JSON analysis object. Transform it into a compelling front-half article structure.

You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.${toneDirective}

Output STRICT JSON:
{
  "headline": "<SEO headline. Action verb first. Coin + event. MAX 15 words.>",
  "hook": "<One powerful opening sentence. Must include the most important number.>",
  "metaTitle": "<MAX 60 chars. Format: 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars. Primary keyword. End: Read the analysis on OnlyAlpha.>",
  "seoKeywords": ["<coin+event>", "<market action>", "<long-tail query>", "<coin+price>", "<trend>"],
  "sections": {
    "HOOK": "<Expand the hook into 3-4 sentences. Must include the most important number from the analysis. Set the scene for why this matters RIGHT NOW.>",
    "WHAT HAPPENED": "<Factual summary using keyFacts from the input JSON. Every paragraph must contain a number. Provide context about the event — who, what, when, where, how much. Write 4-5 substantive sentences.>",
    "WHY IT MATTERS": "<Use analysis.mainDriver and analysis.priceImplication. Explain the market significance and broader implications for the sector. How does this compare to similar events? Write 3-4 substantive sentences.>",
    "HISTORY REPEATS?": "<Use _historicalCases from input if available. Cite SPECIFIC past events with dates and percentage outcomes from _historicalCases array. Format: 'In [Month Year], when [coin] faced similar [eventType], the price moved [X]% over 7 days.' If _historicalCases is empty, use analysis.temporalContext. Write 3-4 substantive sentences with at least one concrete number.>"
  }
}

CRITICAL RULES:
- Each section MUST be at least 300 characters of substantive content.
- Bloomberg meets Reddit tone. One number per paragraph minimum.
- No vague language. No financial advice — use "data suggests", "analysis indicates".
- Narrative direction must match verdict/sentiment from input.
- Output ONLY the JSON object. No preamble. No text outside JSON.
`;
        const user = analysisJson;
        return { system, user };
    }

    buildArticleStage2BMessages(analysisJson: string, stage2AContext: { headline: string, hook: string, sentiment: string, verdict: string }, tone: string): { system: string, user: string } {
        const toneDirective = tone
            ? `\nTONE: Write in a ${tone} tone. Adjust your language, urgency, and emotional register accordingly.`
            : '';

        const system = `You are OnlyAlpha's senior market analyst and writer for Stage 2B.
You receive the original JSON analysis and context from Stage 2A.
Continue the article with the back-half sections.

Do NOT add new analysis. Do NOT change verdicts.${toneDirective}

Output STRICT JSON:
{
  "sections": {
    "PRICE PICTURE": "<Use supportLevels and resistanceLevels from the input. Reference the current price trend and distance from ATH. Discuss volume, momentum, and key technical levels with specific numbers. Write 3-4 substantive sentences.>",
    "RISK CHECK": "<Use analysis.riskNote honestly. Add context about downside scenarios, liquidation risks, or regulatory overhang. Be specific about what could go wrong. Write 3-4 substantive sentences.>",
    "BOTTOM LINE": "<Provide a data-driven synthesis of the overall market assessment. Map '${stage2AContext.verdict}' to sentiment direction (BUY→Bullish, SELL→Bearish, HOLD/NEUTRAL→Neutral). Format: 'Current on-chain metrics and social sentiment indicate a [sentiment direction] trend, supported by a [confidenceScore]% trend strength index.' Use phrases like 'data suggests', 'analysis indicates', 'metrics point to'. NEVER use BUY, SELL, HOLD, or any imperative action words. Write 2-3 substantive sentences describing market conditions, not prescribing actions.>"
  }
}

CRITICAL RULES:
- Each section MUST be at least 300 characters of substantive content (BOTTOM LINE at least 150).
- Tone consistent with provided headline + hook context.
- Bloomberg meets Reddit tone.
- No vague language, no financial advice. NEVER use BUY, SELL, HOLD in any section text.
- Use policy-safe terminology: Upside Target Zone, Risk Zone, Reference Price, Market Scenario, Historical Outcome. Never use: Buy, Sell, Take Profit, Stop Loss, Entry.
- Sentiment in BOTTOM LINE must map from input JSON verdict (BUY→Bullish, SELL→Bearish, NEUTRAL→Neutral).
- Output ONLY the JSON object. No preamble. No text outside JSON.
`;
        const user = `Original Analysis JSON:
${analysisJson}

Stage 2A Context:
Headline: ${stage2AContext.headline}
Hook: ${stage2AContext.hook}
Sentiment: ${stage2AContext.sentiment}
Verdict: ${stage2AContext.verdict}
`;
        return { system, user };
    }

    buildMasterUpdateMessages(input: MasterUpdateInput): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are a crypto living article updater for OnlyAlpha. Your job is to refresh article sections based on new analysis data.

Output ONLY a valid JSON object with any of these keys that need updating:
{
  "coreCatalyst":     "<updated text>",
  "marketContext":    "<updated text>",
  "strategicImpact":  "<updated text>",
  "historicalContext":"<updated text>",
  "technicalLevels":  "<updated text>",
  "riskAssessment":   "<updated text>",
  "bottomLine":       "<updated text>",
  "headline":         "<SEO headline. Action verb first. Coin + event. MAX 15 words.>",
  "hook":             "<One powerful opening sentence with the most important number.>",
  "metaTitle":        "<STRICT MAX 60 chars. Format MUST be: 'Coin Action | OnlyAlpha'. Example: 'ETH Exploit Alert | OnlyAlpha'>",
  "metaDescription":  "<STRICT MAX 160 chars. Start with primary keyword. Must end with: Read the analysis on OnlyAlpha.>",
  "seoKeywords":      ["<coin+event>", "<market action>", "<long-tail query>", "<coin+price>", "<trend>"],
  "sentiment":        "bullish|bearish|neutral",
  "verdict":          "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore":  <0-100>
}

CRITICAL RULES:
- metaTitle: MUST be under 60 characters total including spaces. Format: 'Coin Event | OnlyAlpha'. Count characters carefully.
- metaDescription: MUST be under 160 characters total. Must end with 'Read the analysis on OnlyAlpha.'
- Only include keys that actually changed. Do NOT include keys that didn't change.
- Output ONLY the JSON object. No preamble. No explanation. No markdown fences.${input.sectionDirective}`
            },
            {
                role: 'user',
                content: `New analysis data:\n${JSON.stringify(input.analysisResult)}\n\nExisting sections:\n${input.existingSections}`
            }
        ];
    }

    buildMinorUpdateMessages(input: MinorUpdateInput): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: `You are OnlyAlpha's senior market analyst writing a living article timeline update.
You receive a new development and context about the coin's current state.
Write a concise, data-rich timeline update (2-3 paragraphs).
Rules:
- Include specific numbers (price, percentages, timeframes) when available.
- Reference the coin's current price and 24h change if provided.
- If this is a continuation of a recent trend, say so explicitly.
- Do NOT repeat what was already said in the existing story — add new information only.
- Tone: factual, analytical, Bloomberg-style.
- Output: plain text, 150-400 words. No JSON. No headers.`
            },
            {
                role: 'user',
                content: `New Development: ${input.newsTitle}
Coin: ${input.coinSymbol}
Current Price: ${input.currentPrice !== null ? `$${input.currentPrice.toLocaleString()}` : 'N/A'}${input.priceChange24h !== null ? ` (24h change: ${input.priceChange24h > 0 ? '+' : ''}${input.priceChange24h.toFixed(2)}%)` : ''}

Existing Story: ${input.existingHeadline}

Recent Timeline Updates (last 3):
${input.recentTimeline.length > 0
    ? input.recentTimeline.map((t, i) =>
        `${i + 1}. [${t.createdAt.toISOString().split('T')[0]}] (${t.severity}) ${t.updateText.slice(0, 200)}`
    ).join('\n')
    : 'No prior timeline updates for this article.'}

Write a 2-3 paragraph timeline update that incorporates the new development into the ongoing story. Include the current price context if available. Do not repeat what was already covered in the existing story or recent timeline.`
            }
        ];
    }

    buildHistoricalStatsContext(stats: HistoricalStatsOutput): string {
        if (stats.sampleSize === 0) {
            return `These statistics come from OnlyAlpha database records. AI must use only the provided statistics. AI must not invent historical returns, outcome rates, sample sizes, price levels, or performance claims.

No historical data available for this market scenario.`;
        }

        let context = `These statistics come from OnlyAlpha database records. AI must use only the provided statistics. AI must not invent historical returns, outcome rates, sample sizes, price levels, or performance claims.

Historical event statistics (sample size: ${stats.sampleSize})`;

        if (stats.confidenceLevel === 'very_low' || stats.confidenceLevel === 'low') {
            context += ` - limited historical sample`;
        }

        context += `:\n`;

        const horizons = ['1h', '4h', '24h', '3d', '7d'] as const;
        horizons.forEach(horizon => {
            const hStats = stats.horizonStats[horizon];
            if (hStats.available) {
                const median = hStats.medianReturn !== null ? `${hStats.medianReturn >= 0 ? '+' : ''}${hStats.medianReturn.toFixed(2)}%` : 'N/A';
                const bullish = hStats.bullishRate !== null ? `${hStats.bullishRate.toFixed(1)}%` : 'N/A';
                context += `- ${horizon}: Median historical outcome ${median}, bullish bias rate ${bullish} (n=${hStats.sampleSize})\n`;
            }
        });

        if (stats.averageMaxUpside !== null || stats.averageMaxDrawdown !== null) {
            context += `Aggregate extremes: `;
            if (stats.averageMaxUpside !== null) {
                context += `Average max upside ${stats.averageMaxUpside.toFixed(2)}%`;
            }
            if (stats.averageMaxDrawdown !== null) {
                if (stats.averageMaxUpside !== null) context += `, `;
                context += `Average max drawdown ${stats.averageMaxDrawdown.toFixed(2)}%`;
            }
            context += `\n`;
        }

        if (stats.limitations.length > 0) {
            context += `Limitations: ${stats.limitations.join('; ')}\n`;
        }

        return context;
    }

    buildEventImpactContext(contextString: string): string {
        return `
## Historical Event Impact Data (from OnlyAlpha Database)
The following statistics are from real historical events in our database.
Use this data to inform your analysis. Explain these statistics to the reader.
Do NOT invent additional historical data beyond what is provided.

${contextString}

Remember: This is historical context, not a prediction. Past events do not guarantee future outcomes. Not financial advice.
`;
    }

}