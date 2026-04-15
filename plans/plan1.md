# Technical Execution Plan: AI Article Generation — Prompt Chaining Refactor

**Date:** 2025-04-15
**Status:** PENDING APPROVAL
**Scope:** `prompt-factory.ts`, `openai.service.ts`, `aiWorkflow.cron.ts`
**Risk Level:** LOW (additive changes, legacy fallback preserved)

---

## 1. Current Architecture Analysis

### 1.1 Data Flow Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW  (aiWorkflow.cron.ts :: MAJOR path, lines 261–480)   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Gathering]                                                        │
│    rawNewsBuffer → triage → classification (MAJOR / MINOR / NOISE)  │
│                                                                     │
│  [Enrichment]  (parallel, no LLM)                                   │
│    getCoinIntelligence(symbol)  → CoinIntelligence | null           │
│    buildTemporalPattern(symbol) → TemporalPattern | null            │
│    getPriceWithFallback(symbol) → PriceResult | null                │
│                                                                     │
│  [Step 1] callDeepSeekAnalysis(input)                               │
│    Model: DeepSeek-R1 / DeepSeek Direct                             │
│    Input: DeepAnalysisInput { headline, intelligence, pattern, price}│
│    Output: DeepAnalysisResult (structured JSON, ~500-800 tokens)    │
│    Status: ✅ Works reliably, small payload, no truncation          │
│                                                                     │
│  [Step 2] callGptNanoWriter(analysisResult JSON, tone)              │
│    Model: DeepSeek Direct / OpenRouter (fallback)                   │
│    Input: stringified DeepAnalysisResult + tone directive           │
│    Output: ArticleWriterResult                                      │
│    Constraints:                                                      │
│      - fullArticle MUST contain 7 section tags in order             │
│      - fullArticle MUST be ≥3500 characters                         │
│      - Each section MUST be ≥300 characters                         │
│      - max_tokens = 8192 (LONG_RESPONSE_MAX_TOKENS)                 │
│    Status: ⚠️ BOTTLENECK — truncates on complex/long events         │
│                                                                     │
│  [Post-Processing]                                                  │
│    validateFactualGrounding() → sanitize support/resistance levels  │
│    extractSection() × 7 → split fullArticle into DB fields          │
│    validateSectionTags() → ensure all 7 tags present                │
│    auditArticleQuality() → cross-model quality check (optional)     │
│                                                                     │
│  [DB Writes]                                                        │
│    coinMasterArticles  → upsert 7 section columns + metadata        │
│    coinTimelineUpdates → insert MAJOR update text                   │
│    coinNews            → insert full article as summary              │
│    radarSignals        → insert if actionable verdict               │
│    coinMemory          → insert event memory (non-blocking)         │
│    Redis invalidation  → targeted cache busting                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Root Cause: Why Truncation Happens

| Factor | Detail |
|--------|--------|
| **Token budget** | `LONG_RESPONSE_MAX_TOKENS = 8192` — but a 3500+ char article with 7 sections of 300+ chars each, plus metadata fields, can approach or exceed this |
| **Complex events** | Hacks, ETF approvals, SEC actions produce richer `DeepAnalysisResult` → the writer has more facts to include → longer output |
| **JSON overhead** | `response_format: { type: 'json_object' }` wraps everything in JSON, the LLM also generates key names and punctuation |
| **All-or-nothing** | If any section is truncated, `validateSectionTags()` fails → triggers retry → same truncation risk on retry |
| **Retry waste** | 3 retries each regenerate the ENTIRE article from scratch, even if only 1 section was truncated |

### 1.3 Key Files and Their Responsibilities

| File | Role | Lines |
|------|------|-------|
| `services/ai/prompt-factory.ts` | All prompt templates (system + user messages) | 300 lines |
| `services/ai/ai-gateway.ts` | LLM API client (chat, chatRaw, chatStream) | 225 lines |
| `services/ai/cache-manager.ts` | In-memory cache with TTL | 87 lines |
| `services/ai/factual-grounding.ts` | Sanitize hallucinated price levels | 38 lines |
| `services/ai/quality-auditor.ts` | Cross-model quality audit | 60 lines |
| `services/openai.service.ts` | Orchestration layer (calls prompts + gateway) | 499 lines |
| `crons/aiWorkflow.cron.ts` | Main cron job — drives the entire pipeline | 537 lines |
| `models/market.model.ts` | Drizzle schema (coinMasterArticles, coinNews, etc.) | 231 lines |
| `controllers/market.controller.ts` | HTTP read endpoints — NO writes, untouched | 350 lines |

---

## 2. Target Architecture: 3-Stage Prompt Chaining

### 2.1 New Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NEW FLOW                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Stage 1] callDeepSeekAnalysis(input)     ← UNCHANGED                   │
│    → Returns: DeepAnalysisResult                                         │
│    → Already reliable, no changes needed                                 │
│                                                                          │
│  [Stage 2A] callWriterStage2A(analysisResult, tone)   ← NEW              │
│    → Generates: headline, hook, metaTitle, metaDescription,              │
│      seoKeywords, + article sections:                                    │
│        [HOOK], [WHAT HAPPENED], [WHY IT MATTERS], [HISTORY REPEATS?]    │
│    → Returns: ArticleStage2AResult                                       │
│    → Estimated output: ~2000 tokens (comfortable within 4096 default)    │
│                                                                          │
│  [Stage 2B] callWriterStage2B(analysisResult, stage2AContext, tone) ←NEW │
│    → Generates: article sections:                                        │
│        [PRICE PICTURE], [RISK CHECK], [BOTTOM LINE]                      │
│    → Receives brief context from Stage 2A (headline + hook + sentiment)  │
│    → Returns: ArticleStage2BResult                                       │
│    → Estimated output: ~1500 tokens (well within limits)                 │
│                                                                          │
│  [Stage 3] mergeArticleStages(stage2A, stage2B)   ← NEW (no LLM call)   │
│    → Concatenate all 7 sections into fullArticle string                  │
│    → Validate all 7 section tags present                                 │
│    → Construct final ArticleWriterResult object                          │
│    → Run ArticleSchema.safeParse() validation                            │
│                                                                          │
│  [Post-Processing]  ← UNCHANGED                                          │
│    validateFactualGrounding(), extractSection(), auditArticleQuality()   │
│                                                                          │
│  [DB Writes]  ← UNCHANGED                                               │
│    Same tables, same columns, same values                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why Sequential (Not Parallel) for 2A → 2B

| Consideration | Sequential (Chosen) | Parallel |
|---------------|---------------------|----------|
| **Narrative consistency** | 2B receives headline + hook from 2A → [BOTTOM LINE] verdict matches [HOOK] sentiment | Risk: 2A writes bullish hook, 2B writes bearish bottom line |
| **Tone alignment** | 2B knows the urgency level set by 2A's opening | 2B might mismatch tone (urgent opening vs calm close) |
| **Token savings** | 2B context is a 50-char summary, not the full analysis duplication | Both calls receive full analysis → more input tokens |
| **Latency** | ~20-30s total (2 sequential calls) | ~12-15s total (parallel) but with consistency risks |
| **Error isolation** | If 2A fails, 2B never runs (saves API cost) | Both run even if one will be discarded |

### 2.3 Section Distribution Rationale

| Stage | Sections | Rationale |
|-------|----------|-----------|
| **2A** | [HOOK], [WHAT HAPPENED], [WHY IT MATTERS], [HISTORY REPEATS?] | These are the **narrative/story sections** — they flow naturally together, build on keyFacts, mainDriver, priceImplication, temporalContext |
| **2B** | [PRICE PICTURE], [RISK CHECK], [BOTTOM LINE] | These are the **analytical/verdict sections** — they depend on supportLevels, resistanceLevels, riskNote, verdict, confidenceScore. Also: verdict stated in [BOTTOM LINE] is the most critical — isolating it reduces the chance of it being truncated |

---

## 3. Stage 1 — Prompt Modifications

### 3.1 New Method: `buildArticleStage2AMessages()`

**File:** `prompt-factory.ts`
**Location:** After `buildArticleWriterMessages()` method (after line ~297)

```
System Prompt Outline:
─────────────────────
You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object. Your job is to write the FIRST HALF of a market article.

Output STRICT JSON:
{
  "headline": "<SEO headline, action verb first, coin + event, MAX 15 words>",
  "hook": "<One powerful opening sentence with the most important number>",
  "metaTitle": "<MAX 60 chars, format: 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars, primary keyword, end with 'Read the analysis on OnlyAlpha.'>",
  "seoKeywords": ["<5 keywords>"],
  "sections": {
    "HOOK": "<3-4 sentences expanding the hook, include most important number>",
    "WHAT HAPPENED": "<4-5 sentences, factual summary using keyFacts, every paragraph needs a number>",
    "WHY IT MATTERS": "<3-4 sentences using mainDriver and priceImplication>",
    "HISTORY REPEATS?": "<3-4 sentences using temporalContext or relevant historical comparison>"
  }
}

Rules:
- Each section MUST be at least 300 characters of substantive content
- Bloomberg meets Reddit tone
- No vague language, no financial advice
- CONSISTENCY: The narrative direction must match the verdict and sentiment from the input
```

### 3.2 New Method: `buildArticleStage2BMessages()`

**File:** `prompt-factory.ts`
**Location:** After `buildArticleStage2AMessages()`

```
System Prompt Outline:
─────────────────────
You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object AND context about the first half of an article already written.
Your job is to write the SECOND HALF (final 3 sections).

Context from first half:
- Headline: <provided>
- Hook: <provided>
- Sentiment direction: <provided>

Output STRICT JSON:
{
  "sections": {
    "PRICE PICTURE": "<3-4 sentences using supportLevels, resistanceLevels, current price, ATH context>",
    "RISK CHECK": "<3-4 sentences using riskNote, downside scenarios, specific what-could-go-wrong>",
    "BOTTOM LINE": "<2-3 sentences, state verdict and confidenceScore, format: 'Analysis rates this as [verdict] with [score]% confidence.'>"
  }
}

Rules:
- Each section MUST be at least 300 characters of substantive content
- The verdict in [BOTTOM LINE] MUST exactly match the verdict from the input JSON
- Tone must be consistent with the provided headline and hook context
- Bloomberg meets Reddit tone
- No vague language, no financial advice
```

### 3.3 Context Passing (2A → 2B)

The context object passed from Stage 2A to Stage 2B:

```typescript
interface Stage2AContext {
  headline: string;
  hook: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}
```

This is extracted from the `ArticleStage2AResult` + the original `DeepAnalysisResult` (sentiment/verdict are from Stage 1, not re-generated).

---

## 4. Stage 2 — TypeScript Interfaces

### 4.1 New Interfaces (in `openai.service.ts`)

```typescript
// Stage 2A Response — front-half of article + metadata
export interface ArticleStage2AResult {
  headline: string;
  hook: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  sections: {
    HOOK: string;
    'WHAT HAPPENED': string;
    'WHY IT MATTERS': string;
    'HISTORY REPEATS?': string;
  };
}

// Stage 2B Response — back-half of article (3 analytical sections)
export interface ArticleStage2BResult {
  sections: {
    'PRICE PICTURE': string;
    'RISK CHECK': string;
    'BOTTOM LINE': string;
  };
}

// Context passed from 2A → 2B for narrative consistency
export interface Stage2AContext {
  headline: string;
  hook: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}
```

### 4.2 Existing Interfaces — UNCHANGED

```typescript
// ArticleWriterResult — still the final output shape, constructed by merge
export interface ArticleWriterResult {
  headline: string;
  hook: string;
  fullArticle: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
}

// DeepAnalysisResult — unchanged, produced by Stage 1
export interface DeepAnalysisResult { ... }
```

### 4.3 Zod Schemas for Validation

```typescript
const Stage2ASchema = z.object({
  headline: z.string().max(120),
  hook: z.string().min(20),
  metaTitle: z.string().max(60),
  metaDescription: z.string().max(160),
  seoKeywords: z.array(z.string()).min(3).max(7),
  sections: z.object({
    HOOK: z.string().min(200),
    'WHAT HAPPENED': z.string().min(200),
    'WHY IT MATTERS': z.string().min(200),
    'HISTORY REPEATS?': z.string().min(200),
  }),
});

const Stage2BSchema = z.object({
  sections: z.object({
    'PRICE PICTURE': z.string().min(200),
    'RISK CHECK': z.string().min(200),
    'BOTTOM LINE': z.string().min(150),
  }),
});
```

---

## 5. Stage 3 — Controller/Cron Logic Changes

### 5.1 New Functions in `openai.service.ts`

#### `callWriterStage2A(analysisJson, tone, attempt?)`

```
Purpose: Call LLM to generate front-half article (sections 1-4 + metadata)
Gateway: deepseekGateway || gateway (same as current callGptNanoWriter)
Model: DeepSeek Direct or SEO_MODEL (same routing)
Temperature: 0.5 (same as current writer)
maxTokens: DEFAULT_MAX_TOKENS (4096) — no longer needs LONG_RESPONSE_MAX_TOKENS
Response Format: { type: 'json_object' }
Retry: 3 attempts on truncation or parse failure
Fallback: On total failure → return null (caller decides next action)
```

#### `callWriterStage2B(analysisJson, stage2AContext, tone, attempt?)`

```
Purpose: Call LLM to generate back-half article (sections 5-7)
Gateway: same routing as 2A
Model: same as 2A
Temperature: 0.5
maxTokens: DEFAULT_MAX_TOKENS (4096)
Response Format: { type: 'json_object' }
Retry: 3 attempts on truncation or parse failure
Fallback: On total failure → generate padded missing sections
```

#### `mergeArticleStages(stage2A, stage2B): ArticleWriterResult`

```
Purpose: In-memory merge, no LLM call
Logic:
  1. Combine all 7 sections from both results
  2. Build fullArticle string with [TAG] prefixes
  3. Validate all 7 tags present via validateSectionTags()
  4. Run ArticleSchema.safeParse() on final object
  5. Return ArticleWriterResult
```

### 5.2 Changes in `aiWorkflow.cron.ts`

**Current code (line ~316-327):**
```typescript
const tone = selectTone(eventType);
let article: ArticleWriterResult;
try {
    article = await callGptNanoWriter(JSON.stringify(analysisResult), tone);
    gptNanoBreaker.recordSuccess();
} catch (err) { ... }
```

**New code (replacement):**
```typescript
const tone = selectTone(eventType);
const analysisJson = JSON.stringify(analysisResult);

let article: ArticleWriterResult;

// Stage 2A: Front-half article
const stage2A = await callWriterStage2A(analysisJson, tone);
if (!stage2A) {
    // Fallback to legacy single-call path
    article = await callGptNanoWriter(analysisJson, tone);
} else {
    // Stage 2B: Back-half article (receives context from 2A)
    const stage2B = await callWriterStage2B(
        analysisJson,
        {
            headline: stage2A.headline,
            hook: stage2A.hook,
            sentiment: analysisResult.sentiment,
            verdict: analysisResult.verdict,
        },
        tone
    );
    // Stage 3: Merge
    article = mergeArticleStages(stage2A, stage2B);
}
```

**Everything below line ~327 in the cron (master article logic, coinNews, radarSignals, etc.) remains UNCHANGED** — it all consumes `ArticleWriterResult`, which is the same shape.

### 5.3 Impact Map

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `prompt-factory.ts` | **Additive** | 2 new methods, ~80 lines each |
| `openai.service.ts` | **Additive + Deprecation** | 3 new functions, `callGptNanoWriter` marked deprecated but NOT removed |
| `aiWorkflow.cron.ts` | **Minimal edit** | Replace ~12 lines (the GPT-nano call block) with ~20 lines (chained calls) |
| `market.model.ts` | **NONE** | — |
| `market.controller.ts` | **NONE** | — |
| `ai-gateway.ts` | **NONE** | — |
| `cache-manager.ts` | **NONE** | — |
| `factual-grounding.ts` | **NONE** | — |
| `quality-auditor.ts` | **NONE** | — |
| Routes / Middleware | **NONE** | — |

---

## 6. Stage 4 — Error Handling Strategy

### 6.1 Per-Stage Failure Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│  FAILURE SCENARIO          │  ACTION                                  │
├────────────────────────────┼──────────────────────────────────────────┤
│  Stage 2A: parse failure   │  Retry up to 3× (existing pattern)       │
│  Stage 2A: truncation      │  Retry up to 3× (AITruncationError)      │
│  Stage 2A: all retries     │  Fall back to callGptNanoWriter()        │
│          exhausted         │  (legacy single-call path)               │
│                            │                                          │
│  Stage 2A: null response   │  Fall back to callGptNanoWriter()        │
│                            │                                          │
│  Stage 2B: parse failure   │  Retry up to 3× (independent of 2A)      │
│  Stage 2B: truncation      │  Retry up to 3×                          │
│  Stage 2B: all retries     │  Generate padded sections:               │
│          exhausted         │  "Additional analysis pending. See the   │
│                            │  full breakdown in the living article."  │
│                            │  (same pattern as current fallback)       │
│                            │                                          │
│  Merge: missing tags       │  Pad missing sections (existing logic)   │
│  Merge: schema failure     │  If only length issue → publish partial  │
│                            │  If structural → fall back to legacy     │
│                            │                                          │
│  Legacy also fails         │  buildFallbackArticle() (existing)       │
│                            │                                          │
│  Rate limit (any stage)    │  Skip item, continue to next (existing)  │
│  Circuit breaker open      │  Skip item (existing)                    │
└────────────────────────────┴──────────────────────────────────────────┘
```

### 6.2 Key Principle: Preserve Partial Success

If Stage 2A succeeds but Stage 2B fails completely, we DO NOT discard the 2A output. The merge function handles this:

```typescript
function mergeArticleStages(
  stage2A: ArticleStage2AResult,
  stage2B: ArticleStage2BResult | null
): ArticleWriterResult {
  const frontSections = { ...stage2A.sections };

  const backSections = stage2B?.sections ?? {
    'PRICE PICTURE': 'Additional price analysis pending. See the full breakdown in the living article for this coin.',
    'RISK CHECK': 'Risk assessment pending. Standard risk management practices are advised in volatile market conditions.',
    'BOTTOM LINE': 'Analysis pending. Monitor the situation for updates.',
  };

  const fullArticle = [
    '[HOOK]\n' + frontSections.HOOK,
    '[WHAT HAPPENED]\n' + frontSections['WHAT HAPPENED'],
    '[WHY IT MATTERS]\n' + frontSections['WHY IT MATTERS'],
    '[HISTORY REPEATS?]\n' + frontSections['HISTORY REPEATS?'],
    '[PRICE PICTURE]\n' + backSections['PRICE PICTURE'],
    '[RISK CHECK]\n' + backSections['RISK CHECK'],
    '[BOTTOM LINE]\n' + backSections['BOTTOM LINE'],
  ].join('\n\n');

  return {
    headline: stage2A.headline,
    hook: stage2A.hook,
    fullArticle,
    metaTitle: stage2A.metaTitle,
    metaDescription: stage2A.metaDescription,
    seoKeywords: stage2A.seoKeywords,
  };
}
```

### 6.3 Retry Isolation

Each stage retries independently. A failure in Stage 2B does NOT re-trigger Stage 2A:

```
callWriterStage2A() fails attempt 1/3 → retry 2A (not 2B)
callWriterStage2A() succeeds
callWriterStage2B() fails attempt 1/3 → retry 2B only (2A result preserved in memory)
callWriterStage2B() fails all 3 → merge with padded back-half
```

### 6.4 Quality Audit Compatibility

The quality auditor (`auditArticleQuality`) receives the merged `ArticleWriterResult`. It has no knowledge of whether the article was generated via:
- New 2-stage path
- Legacy single-call path
- Fallback padded article

The audit interface remains unchanged.

---

## 7. Implementation Order (Micro-Tasks)

### Phase 1: Interfaces & Prompts (No breaking changes)

| Micro-Task | File | Description |
|------------|------|-------------|
| 1.1 | `openai.service.ts` | Add `ArticleStage2AResult`, `ArticleStage2BResult`, `Stage2AContext` interfaces |
| 1.2 | `openai.service.ts` | Add `Stage2ASchema`, `Stage2BSchema` Zod schemas |
| 1.3 | `prompt-factory.ts` | Add `buildArticleStage2AMessages()` method |
| 1.4 | `prompt-factory.ts` | Add `buildArticleStage2BMessages()` method |

### Phase 2: Orchestration Functions

| Micro-Task | File | Description |
|------------|------|-------------|
| 2.1 | `openai.service.ts` | Add `callWriterStage2A()` function |
| 2.2 | `openai.service.ts` | Add `callWriterStage2B()` function |
| 2.3 | `openai.service.ts` | Add `mergeArticleStages()` function |
| 2.4 | `openai.service.ts` | Mark `callGptNanoWriter()` as `@deprecated` (keep fully functional) |

### Phase 3: Cron Integration

| Micro-Task | File | Description |
|------------|------|-------------|
| 3.1 | `aiWorkflow.cron.ts` | Import new functions |
| 3.2 | `aiWorkflow.cron.ts` | Replace `callGptNanoWriter()` call block with chained 2A→2B→merge |
| 3.3 | `aiWorkflow.cron.ts` | Verify circuit breaker integration still works |

### Phase 4: Validation

| Micro-Task | Description |
|------------|-------------|
| 4.1 | Manual test: trigger `forceSeed` and verify articles generate correctly |
| 4.2 | Verify `coinMasterArticles` sections are populated correctly |
| 4.3 | Verify `coinNews` receives the merged fullArticle |
| 4.4 | Verify quality audit still runs on high-impact articles |
| 4.5 | Test fallback: temporarily break Stage 2B → verify padded article published |

---

## 8. Rollback Strategy

Since `callGptNanoWriter()` is **not deleted**, only deprecated, rollback is a single-line change:

```typescript
// In aiWorkflow.cron.ts, revert to:
article = await callGptNanoWriter(JSON.stringify(analysisResult), tone);
```

No database migrations, no model changes, no controller changes needed.

---

## 9. Expected Improvements

| Metric | Current | Target |
|--------|---------|--------|
| **Truncation rate** | ~15-20% on complex events (estimated from retry frequency) | <2% (each stage stays well under token limits) |
| **Token cost per article** | 1 call × 8192 max_tokens | 2 calls × 4096 max_tokens (same budget, but higher success rate) |
| **Retry efficiency** | Full article re-generated on retry | Only the failing stage is retried |
| **Partial recovery** | All-or-nothing (fallback article on failure) | Front-half preserved even if back-half fails |
| **Article quality** | Sometimes ends abruptly due to truncation | Each section gets full token budget |
