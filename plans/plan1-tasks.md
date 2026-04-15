# Task Breakdown: AI Article Generation — Prompt Chaining Refactor

**Parent Plan:** `plans/plan1.md`
**Status:** READY FOR ASSIGNMENT

---

## Dependency Graph

```
Track A ──┐
           ├──► Track C ──► Track D ──► Track E
Track B ──┘
```

- **Track A** + **Track B** = parallel (no dependencies between them)
- **Track C** depends on both A and B
- **Track D** depends on C
- **Track E** (validation) depends on D

---

## TRACK A: Prompt Templates (prompt-factory.ts)

**Assignee:** Senior Developer 1
**Files:** `services/ai/prompt-factory.ts` only
**Dependencies:** NONE (can start immediately)

### Task A1: Add `buildArticleStage2AMessages()` method
- **Location:** After `buildArticleWriterMessages()` method (~line 297)
- **What:** New method that returns system + user messages for Stage 2A (front-half article)
- **Input:** `analysisJson: string, tone: string`
- **Output:** `{ system: string, user: string }` (follow existing method signature pattern)
- **System prompt:** Must instruct the LLM to output STRICT JSON with: `headline`, `hook`, `metaTitle`, `metaDescription`, `seoKeywords`, `sections` (HOOK, WHAT HAPPENED, WHY IT MATTERS, HISTORY REPEATS?)
- **Rules in prompt:**
  - Each section ≥300 characters
  - Bloomberg meets Reddit tone
  - No vague language, no financial advice
  - Narrative direction must match verdict/sentiment from input
- **Reference:** Section 3.1 in `plan1.md`

### Task A2: Add `buildArticleStage2BMessages()` method
- **Location:** After `buildArticleStage2AMessages()`
- **What:** New method that returns system + user messages for Stage 2B (back-half article)
- **Input:** `analysisJson: string, stage2AContext: { headline: string, hook: string, sentiment: string, verdict: string }, tone: string`
- **Output:** `{ system: string, user: string }`
- **System prompt:** Must instruct the LLM to output STRICT JSON with `sections` (PRICE PICTURE, RISK CHECK, BOTTOM LINE)
- **Rules in prompt:**
  - Each section ≥300 characters
  - Verdict in [BOTTOM LINE] must exactly match input JSON verdict
  - Tone consistent with provided headline + hook context
  - Bloomberg meets Reddit tone
  - No vague language, no financial advice
- **Reference:** Section 3.2 in `plan1.md`

---

## TRACK B: Interfaces & Schemas (openai.service.ts)

**Assignee:** Senior Developer 2
**Files:** `services/openai.service.ts` only (top of file, near existing interfaces)
**Dependencies:** NONE (can start immediately)

### Task B1: Add new TypeScript interfaces
- **Location:** Near existing `ArticleWriterResult` and `DeepAnalysisResult` interfaces (top of file)
- **What:** Add these 3 interfaces:

```typescript
interface ArticleStage2AResult {
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

interface ArticleStage2BResult {
  sections: {
    'PRICE PICTURE': string;
    'RISK CHECK': string;
    'BOTTOM LINE': string;
  };
}

interface Stage2AContext {
  headline: string;
  hook: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}
```

- **Constraints:**
  - DO NOT modify or move any existing interfaces
  - Use `export` if existing interfaces are exported
  - Follow the same naming and formatting conventions as surrounding code
- **Reference:** Section 4.1 in `plan1.md`

### Task B2: Add Zod validation schemas
- **Location:** Near existing Zod schemas in the same file (or wherever schemas are defined)
- **What:** Add 2 Zod schemas:

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

- **Constraints:**
  - Check if `z` (zod) is already imported; if not, add import
  - Follow existing Zod schema patterns in the file
- **Reference:** Section 4.3 in `plan1.md`

---

## TRACK C: Orchestration Functions (openai.service.ts)

**Assignee:** Senior Developer 3 (or Developer 2 after Track B is done)
**Files:** `services/openai.service.ts` (after interfaces/schemas section)
**Dependencies:** Track A (prompts) + Track B (interfaces/schemas) must be COMPLETE

### Task C1: Add `callWriterStage2A()` function
- **What:** LLM call function for front-half article generation
- **Signature:** `callWriterStage2A(analysisJson: string, tone: string): Promise<ArticleStage2AResult | null>`
- **Logic:**
  1. Get messages from `buildArticleStage2AMessages(analysisJson, tone)`
  2. Call gateway with: `model = SEO_MODEL` (same as current writer), `temperature = 0.5`, `maxTokens = DEFAULT_MAX_TOKENS (4096)`, `response_format = { type: 'json_object' }`
  3. Parse JSON response
  4. Validate with `Stage2ASchema.safeParse()`
  5. On failure: retry up to 3 attempts
  6. On all retries exhausted: return `null`
- **Pattern:** Follow the exact same structure as the existing `callGptNanoWriter()` function (retry loop, error handling, gateway call pattern)
- **Reference:** Section 5.1 in `plan1.md`

### Task C2: Add `callWriterStage2B()` function
- **What:** LLM call function for back-half article generation
- **Signature:** `callWriterStage2B(analysisJson: string, stage2AContext: Stage2AContext, tone: string): Promise<ArticleStage2BResult | null>`
- **Logic:**
  1. Get messages from `buildArticleStage2BMessages(analysisJson, stage2AContext, tone)`
  2. Call gateway with same params as Stage 2A
  3. Parse JSON response
  4. Validate with `Stage2BSchema.safeParse()`
  5. On failure: retry up to 3 attempts
  6. On all retries exhausted: return `null`
- **Reference:** Section 5.1 in `plan1.md`

### Task C3: Add `mergeArticleStages()` function
- **What:** Pure function, NO LLM call — merges 2A + 2B results into final `ArticleWriterResult`
- **Signature:** `mergeArticleStages(stage2A: ArticleStage2AResult, stage2B: ArticleStage2BResult | null): ArticleWriterResult`
- **Logic:**
  1. If `stage2B` is null, use padded fallback sections
  2. Combine all 7 sections into `fullArticle` string with `[TAG]` prefixes
  3. Return `ArticleWriterResult` object
- **Fallback padded sections:**
  - `PRICE PICTURE`: 'Additional price analysis pending. See the full breakdown in the living article for this coin.'
  - `RISK CHECK`: 'Risk assessment pending. Standard risk management practices are advised in volatile market conditions.'
  - `BOTTOM LINE`: 'Analysis pending. Monitor the situation for updates.'
- **Reference:** Section 6.2 in `plan1.md`

### Task C4: Mark `callGptNanoWriter()` as deprecated
- **What:** Add `/** @deprecated Use callWriterStage2A + callWriterStage2B + mergeArticleStages instead */` JSDoc comment above the function
- **Constraint:** DO NOT delete, modify, or break `callGptNanoWriter()`. It stays fully functional as fallback.

---

## TRACK D: Cron Integration (aiWorkflow.cron.ts)

**Assignee:** Senior Developer 4 (or any developer after Track C is done)
**Files:** `crons/aiWorkflow.cron.ts`
**Dependencies:** Track C must be COMPLETE

### Task D1: Replace article generation call block
- **Location:** Lines ~316-327 (the `callGptNanoWriter` call inside the MAJOR path)
- **What:** Replace the existing call block with the new chained flow:

```typescript
const tone = selectTone(eventType);
const analysisJson = JSON.stringify(analysisResult);

let article: ArticleWriterResult;

const stage2A = await callWriterStage2A(analysisJson, tone);
if (!stage2A) {
    article = await callGptNanoWriter(analysisJson, tone);
} else {
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
    article = mergeArticleStages(stage2A, stage2B);
}
```

- **Constraints:**
  - Add imports for `callWriterStage2A`, `callWriterStage2B`, `mergeArticleStages` at top of file
  - Everything below this block (DB writes, coinNews, radarSignals, etc.) stays UNCHANGED
  - Circuit breaker integration (`gptNanoBreaker.recordSuccess()`) must still work
- **Reference:** Section 5.2 in `plan1.md`

### Task D2: Verify circuit breaker integration
- **What:** Ensure the existing circuit breaker pattern still wraps the new calls correctly
- **Check:** `gptNanoBreaker.recordSuccess()` and `gptNanoBreaker.recordFailure()` are called appropriately for both Stage 2A and 2B (or only on the final merged result — match existing pattern)

---

## TRACK E: Validation & Testing

**Assignee:** QA / Any Developer
**Dependencies:** Track D must be COMPLETE

### Task E1: Manual integration test
- Trigger `forceSeed` and verify articles generate correctly
- Check `coinMasterArticles` sections are populated
- Check `coinNews` receives merged fullArticle

### Task E2: Fallback test
- Temporarily force Stage 2B to fail
- Verify padded article is published (partial success)
- Verify Stage 2A fallback to legacy `callGptNanoWriter` works

### Task E3: Quality audit verification
- Verify `auditArticleQuality` still runs on high-impact articles
- Confirm it has no knowledge of the 2-stage vs legacy path

---

## Summary: Parallel Execution Timeline

```
Time ──────────────────────────────────────────────────────────►

Dev 1:  [═══ Track A ═══]───────────────────[═══ Track E ═══]
Dev 2:  [═══ Track B ═══]──[══ Track C ══]──
Dev 3:  ─────────────────[══ Track D ══]────
```

| Track | Tasks | Est. Lines | Parallel? |
|-------|-------|-----------|-----------|
| **A** | A1, A2 | ~160 lines | YES (immediate) |
| **B** | B1, B2 | ~50 lines | YES (immediate) |
| **C** | C1, C2, C3, C4 | ~200 lines | After A + B |
| **D** | D1, D2 | ~20 lines changed | After C |
| **E** | E1, E2, E3 | Manual testing | After D |
