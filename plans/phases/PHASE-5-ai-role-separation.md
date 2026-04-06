# PHASE 5 — AI Role Separation & Prompts

> **Depends on:** Phase 3 + Phase 4 (so prompts can reference the new context fields).
> **Goal:** DeepSeek = analyst (JSON). GPT-nano = writer (prose).
> **Modified:** `prompt-factory.ts`, `openai.service.ts`

---

## Task 5-A: New Prompt Builders in prompt-factory.ts

**File:** `backend/src/services/ai/prompt-factory.ts`

### New Interface: `DeepAnalysisInput`

```typescript
export interface DeepAnalysisInput {
    headline: string;
    intelligence: CoinIntelligence | null;
    pattern: TemporalPattern | null;
    price: PriceResult | null;
}
```

Import `CoinIntelligence` from `../coinIntelligence.service` and `TemporalPattern` from `../temporalIntelligence.service` and `PriceResult` from `../priceService`.

### Method 1: `buildDeepAnalysisMessages(input: DeepAnalysisInput): ChatCompletionMessageParam[]`

**System prompt** (start with `${LANGUAGE_MANDATE}\n\n`):

```
You are a crypto data analyst. Your output feeds a downstream writing engine.
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
- keyFacts: must contain specific numbers, dates, or verifiable claims.
```

**User prompt** — dynamically built from input:

```
Analyze this news headline:

Headline: ${input.headline}

--- CURRENT PRICE ---
${input.price ? `Price: $${input.price.price} (${input.price.source}, 24h change: ${input.price.change24h}%)` : 'Price data unavailable'}

--- COIN INTELLIGENCE ---
${input.intelligence ? JSON.stringify({
    ATH: input.intelligence.ath,
    ATH Date: input.intelligence.athDate,
    52w Range: `$${input.intelligence.week52Low} - $${input.intelligence.week52High}`,
    8-Week Trend: input.intelligence.trend8w,
    30d Change: input.intelligence.priceChange30d ? `${input.intelligence.priceChange30d}%` : 'N/A',
    Background: input.intelligence.wikiBackground || 'No background available',
    DEX Boosted: input.intelligence.dexBoostActive,
}, null, 2) : 'No intelligence data available'}

--- HISTORICAL PATTERN ---
${input.pattern ? JSON.stringify(input.pattern, null, 2) : 'No historical pattern available'}
```

### Method 2: `buildArticleWriterMessages(analysisJson: string): ChatCompletionMessageParam[]`

**System prompt** (start with `${LANGUAGE_MANDATE}\n\n`):

```
You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object. Transform it into a compelling article.

You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.

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
}
```

**User prompt:**
```json
${analysisJson}
```

---

## Task 5-B: New Functions in openai.service.ts

**File:** `backend/src/services/openai.service.ts`

### New Exported Interfaces:

```typescript
export interface DeepAnalysisResult {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    isBreaking: boolean;
    coinSymbol: string;
    eventType: string;
    eventSeverity: number;
    analysis: {
        mainDriver: string;
        priceImplication: string;
        temporalContext: string | null;
        riskNote: string;
    };
    keyFacts: string[];
    supportLevels: number[];
    resistanceLevels: number[];
    signalText: string;
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
}

export interface ArticleWriterResult {
    headline: string;
    hook: string;
    fullArticle: string;
    metaTitle: string;
    metaDescription: string;
    seoKeywords: string[];
}
```

### Function 1: `callDeepSeekAnalysis(input: DeepAnalysisInput): Promise<DeepAnalysisResult>`

```typescript
const messages = prompts.buildDeepAnalysisMessages(input);
const result = await gateway.chat<DeepAnalysisResult>({
    model: env.ANALYSIS_MODEL,
    temperature: 0.2,
    responseFormat: { type: 'json_object' },
    messages,
});
return result;
```

**No caching** — every analysis is unique based on the headline + current context.

### Function 2: `callGptNanoWriter(analysisJson: string): Promise<ArticleWriterResult>`

```typescript
const messages = prompts.buildArticleWriterMessages(analysisJson);
const result = await gateway.chat<ArticleWriterResult>({
    model: env.SEO_MODEL,
    temperature: 0.5,
    responseFormat: { type: 'json_object' },
    messages,
});
return result;
```

**No caching** — every article is unique.

### CRITICAL RULES:
- Do NOT modify any existing exported functions
- Do NOT modify the module-level instances (`cache`, `gateway`, `prompts`)
- Add the new functions AFTER the existing ones (before `streamChatResponse`)
- Import `DeepAnalysisInput` from prompt-factory

---

### Prompt for Senior AI — Task 5:

```
You are the Senior Developer for OnlyAlpha. Make precise changes across 2 files.

=== FILE 1: backend/src/services/ai/prompt-factory.ts ===

STEP 1: Add new import at the top (after existing imports):
```typescript
import type { CoinIntelligence } from '../coinIntelligence.service';
import type { TemporalPattern } from '../temporalIntelligence.service';
import type { PriceResult } from '../priceService';
```

STEP 2: Add new interface after existing interfaces:
```typescript
export interface DeepAnalysisInput {
    headline: string;
    intelligence: CoinIntelligence | null;
    pattern: TemporalPattern | null;
    price: PriceResult | null;
}
```

STEP 3: Add method buildDeepAnalysisMessages(input: DeepAnalysisInput) inside the PromptFactory class, BEFORE buildArticleSEOMessages:

System message content (start with ${LANGUAGE_MANDATE}\n\n):
```
You are a crypto data analyst. Your output feeds a downstream writing engine.
DO NOT write articles. DO NOT write prose. Output STRICT JSON only.

{
  "sentiment": "bullish|bearish|neutral",
  "impactScore": <0-100>,
  "isBreaking": <true if: Hack|Exploit|SEC|Listing|ETF|TokenLaunch|Mainnet>,
  "coinSymbol": "<TICKER>",
  "eventType": "<ETF|Hack|Listing|Upgrade|Partnership|Funding|Regulatory|Other>",
  "eventSeverity": <1|2|3>,
  "analysis": {
    "mainDriver": "<1 sentence>",
    "priceImplication": "<1 sentence>",
    "temporalContext": "<1 sentence or null>",
    "riskNote": "<1 sentence>"
  },
  "keyFacts": ["<fact with number>", "<fact with number>", "<fact with number>"],
  "supportLevels": [<price>, <price>],
  "resistanceLevels": [<price>, <price>],
  "signalText": "<MAX 40 words. Bloomberg-style. One number. English only>",
  "verdict": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore": <0-100>
}

Rules:
- Output ONLY the JSON object. No preamble.
- All string values in English.
- impactScore 80+: only price-moving events.
- If temporal pattern provided → reference in analysis.temporalContext.
- keyFacts: specific numbers, dates, or verifiable claims.
```

User message — dynamically built with template literal using input.headline, input.price, input.intelligence, input.pattern.

STEP 4: Add method buildArticleWriterMessages(analysisJson: string) inside the PromptFactory class:

System message content (start with ${LANGUAGE_MANDATE}\n\n):
```
You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object. Transform it into a compelling article.
You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.
Output STRICT JSON:
{
  "headline": "<SEO headline. Action verb first. Coin + event. MAX 15 words>",
  "hook": "<One powerful opening sentence with the most important number>",
  "fullArticle": "<800+ words. [HOOK] [WHAT HAPPENED] [WHY IT MATTERS] [HISTORY REPEATS?] [PRICE PICTURE] [RISK CHECK] [BOTTOM LINE]. Bloomberg meets Reddit tone. One number per paragraph. No financial advice>",
  "metaTitle": "<MAX 60 chars. 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars. End: Read the analysis on OnlyAlpha.>",
  "seoKeywords": ["<coin+event>", "<market action>", "<long-tail>", "<coin+price>", "<trend>"]
}
```

User message: analysisJson string directly.

=== FILE 2: backend/src/services/openai.service.ts ===

STEP 1: Add import:
```typescript
import { PromptFactory, DeepAnalysisInput } from './ai/prompt-factory';
```
(DeepAnalysisInput is already exported from prompt-factory.ts after Task 5-A)

STEP 2: Add interfaces BEFORE the module-level instances:
```typescript
export interface DeepAnalysisResult {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    isBreaking: boolean;
    coinSymbol: string;
    eventType: string;
    eventSeverity: number;
    analysis: {
        mainDriver: string;
        priceImplication: string;
        temporalContext: string | null;
        riskNote: string;
    };
    keyFacts: string[];
    supportLevels: number[];
    resistanceLevels: number[];
    signalText: string;
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
}

export interface ArticleWriterResult {
    headline: string;
    hook: string;
    fullArticle: string;
    metaTitle: string;
    metaDescription: string;
    seoKeywords: string[];
}
```

STEP 3: Add 2 new exported functions BEFORE streamChatResponse (after validateAirdrop):

```typescript
export async function callDeepSeekAnalysis(input: DeepAnalysisInput): Promise<DeepAnalysisResult> {
    const messages = prompts.buildDeepAnalysisMessages(input);
    return gateway.chat<DeepAnalysisResult>({
        model: env.ANALYSIS_MODEL,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
        messages,
    });
}

export async function callGptNanoWriter(analysisJson: string): Promise<ArticleWriterResult> {
    const messages = prompts.buildArticleWriterMessages(analysisJson);
    return gateway.chat<ArticleWriterResult>({
        model: env.SEO_MODEL,
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
        messages,
    });
}
```

NO caching on these functions — every analysis/article is unique.
DO NOT modify any existing functions or the module-level instances.

Rules: ZERO `any` types. Do NOT modify any existing function signatures or logic.
```

---

## Phase 5 Completion Checklist

- [ ] `DeepAnalysisInput` interface added to `prompt-factory.ts`
- [ ] `buildDeepAnalysisMessages()` method added — JSON-only analyst prompt
- [ ] `buildArticleWriterMessages()` method added — 800+ word article prompt
- [ ] Both methods start with `${LANGUAGE_MANDATE}`
- [ ] `DeepAnalysisResult` interface added to `openai.service.ts`
- [ ] `ArticleWriterResult` interface added to `openai.service.ts`
- [ ] `callDeepSeekAnalysis()` added — uses `ANALYSIS_MODEL`, temp 0.2
- [ ] `callGptNanoWriter()` added — uses `SEO_MODEL`, temp 0.5
- [ ] All existing functions in both files unchanged
- [ ] Zero `any` types
