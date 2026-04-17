import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;
import type { CoinIntelligence } from '../coinIntelligence.service';
import type { TemporalPattern } from '../temporalIntelligence.service';
import type { PriceResult } from '../priceService';



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
}

export interface MasterUpdateInput {
    analysisResult: unknown;
    existingSections: string;
    sectionDirective: string;
}

export interface MinorUpdateInput {
    newsTitle: string;
    existingHeadline: string;
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
  "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
  "eventSeverity": <1|2|3>,
  "classification": "MAJOR|MINOR|NOISE"
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
    "temporalContext":  "<If historical pattern provided: summarize the statistical outcome. Format: 'Based on [N] similar [eventType] events for [symbol], bullish rate was [X]%, avg 7d return was [Y]%. Most recent case: [headline, date, outcome].' If no pattern: use domain knowledge to reference 1 specific comparable historical event with numbers. MAX 2 sentences.>",
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
- keyFacts: must contain specific numbers, dates, or verifiable claims.
- CONSISTENCY RULE: The textual summary in signalText MUST strictly match the JSON verdict. Do NOT write bullish text if verdict is SELL. Do NOT write bearish text if verdict is BUY. The sentiment, signalText, and verdict must all be perfectly aligned.`
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
State the verdict and confidenceScore. Provide a clear summary of the overall assessment. Format: "Analysis rates this as [verdict] with [confidenceScore]% confidence." Write 2-3 substantive sentences.

CRITICAL RULES:
- ALL 7 tags MUST appear in the output. Missing even ONE tag will cause the output to be REJECTED.
- MINIMUM 3500 characters total for fullArticle. You MUST write at least 5-6 sentences for EACH of the 7 sections. Missing a tag or writing short sections will trigger a system failure.
- Each section MUST be at least 300 characters of substantive content.
- Bloomberg meets Reddit tone. One number per paragraph minimum.
- No vague language. No financial advice — use "data suggests", "analysis indicates".
- The fullArticle MUST be at least 3500 characters total.
- Write REAL content, not filler. Every sentence must add value or information.
- CONSISTENCY RULE: The textual summary in [BOTTOM LINE] MUST strictly match the JSON verdict field. Do NOT write "BUY" in text if the verdict is "SELL" or vice versa. The verdict and the narrative must be perfectly aligned.`
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
    "BOTTOM LINE": "<State the verdict and confidenceScore. Provide a clear summary of the overall assessment. Verdict in BOTTOM LINE must exactly match '${stage2AContext.verdict}'. Format: 'Analysis rates this as [verdict] with [confidenceScore]% confidence.' Write 2-3 substantive sentences.>"
  }
}

CRITICAL RULES:
- Each section MUST be at least 300 characters of substantive content (BOTTOM LINE at least 150).
- Tone consistent with provided headline + hook context.
- Bloomberg meets Reddit tone.
- No vague language, no financial advice.
- Verdict in BOTTOM LINE must exactly match input JSON verdict.
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
                content: 'You are a crypto article updater. Output ONLY JSON with updated sections.'
            },
            {
                role: 'user',
                content: `Update the following living article sections based on this new analysis: ${JSON.stringify(input.analysisResult)}\n\nExisting sections:\n${input.existingSections}\n\nOutput ONLY the sections that need updating as JSON.${input.sectionDirective}`
            }
        ];
    }

    buildMinorUpdateMessages(input: MinorUpdateInput): ChatCompletionMessageParam[] {
        return [
            {
                role: 'system',
                content: 'You are a crypto news update writer. Write factual, concise updates.'
            },
            {
                role: 'user',
                content: `Given this new development: ${input.newsTitle}, in context of the existing story: ${input.existingHeadline}, write a concise 1-2 paragraph timeline update. Factual, no filler.`
            }
        ];
    }

}