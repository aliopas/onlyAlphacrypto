# OnlyAlpha — Architectural Plan (Phase 3: Writer Model Migration + Historical Depth)

**Author:** THE ARCHITECT (GLM-5.1)
**Date:** April 16, 2026
**Status:** APPROVED FOR EXECUTION — Post Supreme Review v2
**Scope:** Replace DeepSeek-hijacked article writing with Gemini 2.5 Flash + Fix empty sections + Fix superficial historical analysis
**Reference:** `plans/issues_actions.md`, `agent_gedens/AGENT_LOGS.md`

---

## 0. Executive Summary

### Problem (Updated)
The 7 analysis sections in the Deep Dive accordion are partially empty or filled with placeholder garbage ("Additional price analysis pending..."). **Root cause (confirmed by Supreme):** Lines 345-346, 427-428, 483-484 in `openai.service.ts` route article writing through `deepseekGateway` (a reasoning model), which produces analysis-style JSON rather than prose article content.

**Secondary problem:** The historical analysis layer is superficial — event types are never indexed, the writer has no access to raw historical cases, and `temporalContext` is compressed to 1 sentence, forcing the writer to hallucinate details.

### Solution
9 micro-tasks in 2 parallel tracks:

```
Track A (Writer Fix):  3.1 → 3.2 → 3.3 → 3.4
Track B (Historical):  3.5.A → 3.5.B → 3.5.C → 3.5.D
```

### New Model Roles
```
BEFORE:
  DeepSeek (deepseek-r1) → Deep Analysis (verdict, sentiment, levels)
  DeepSeek-chat           → Article Writing (HIJACKED — reasoning model, not writer)

AFTER:
  DeepSeek (deepseek-r1) → Deep Analysis (verdict, sentiment, levels)    [UNCHANGED]
  Gemini 2.5 Flash       → Article Writing (7 sections)                  [NEW]
  GPT-5-nano             → SEO only (meta tags, hooks) + Minor Updates   [DEMOTED]
```

---

## 1. Architecture Context — Current Writer Flow

### Current File Structure
```
backend/src/services/
  ├── openai.service.ts          ← Writer functions + export extraction + schemas
  ├── temporalIntelligence.service.ts ← Historical news fetch + pattern builder
  ├── ai/
  │   ├── prompt-factory.ts      ← ALL prompts (analysis, writer stage2A/B, SEO, chat)
  │   ├── ai-gateway.ts          ← AIGateway class (OpenAI-compatible)
  │   ├── cache-manager.ts       ← CacheManager (replaces old analysisCache)
  │   ├── quality-auditor.ts     ← Cross-model audit (log-only)
  │   └── factual-grounding.ts   ← Price level validation
backend/src/crons/
  └── aiWorkflow.cron.ts         ← Pipeline orchestrator (L308: analysisJson serialization)
```

### Current Writer Functions in `openai.service.ts`

| Function | Lines | Role | Model Used (BUG) |
|----------|-------|------|-------------------|
| `callGptNanoWriter()` | 341-417 | Single-call writer (deprecated fallback) | `deepseekGateway ?? gateway` (line 345) |
| `callWriterStage2A()` | 419-473 | Stage 2A — front 4 sections | `deepseekGateway ?? gateway` (line 427) |
| `callWriterStage2B()` | 475-529 | Stage 2B — back 3 sections | `deepseekGateway ?? gateway` (line 483) |
| `mergeArticleStages()` | 531-568 | Stitch Stage2A + Stage2B | Local (no AI) |
| `buildFallbackArticle()` | 663-697 | Last-resort synthetic generator | Local (no AI) |
| `callGptNanoMinorUpdate()` | 585-604 | MINOR path — 1-2 paragraph update | `env.SEO_MODEL` |
| `callGptNanoMasterUpdate()` | 606-661 | EXISTING article partial update | `env.SEO_MODEL` |

### Current Schema Gates

| Schema | Location | Strictness |
|--------|----------|-----------|
| `ArticleSchema` | line 112-119 | `fullArticle.min(3500)`, `hook.min(20)`, `seoKeywords.min(3).max(7)` |
| `Stage2ASchema` | line 121-133 | Each of 4 sections: `.min(200)` |
| `Stage2BSchema` | line 135-141 | Each of 3 sections: `.min(200)`, bottomLine `.min(150)` |

---

## 2. Track A — Writer Model Fix (Micro-Tasks 3.1 → 3.4)

### Micro-Task 3.1: Add WRITER_MODEL config + Writer Gateway

**File:** `backend/src/config/env.ts`
**Action:** Add `WRITER_MODEL` env variable. **Insert AFTER line 25 (`SEO_MODEL`) and BEFORE line 28 (`CHAT_MODEL`).**

```typescript
// Line 26 — INSERT HERE (after SEO_MODEL, before CHAT_MODEL):
WRITER_MODEL: z.string().default('google/gemini-2.5-flash'),
```

**File:** `backend/src/services/openai.service.ts`
**Action:** Add a module-level `writerGateway` constant. **Insert AFTER line 166 (end of `deepseekGateway` block) and BEFORE line 168 (`const prompts = ...`).**

```typescript
// Writer gateway — always OpenRouter (Gemini 2.5 Flash or any writer model)
const writerGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 120000,
    defaultHeaders: { 'HTTP-Referer': 'https://onlyalpha.app', 'X-Title': 'OnlyAlpha' }
});
```

**CRITICAL — Supreme Correction Applied:** The module-level variable is named `writerGateway`. In Micro-Task 3.2, the Junior must **DELETE** the local shadow-declarations inside the 3 writer functions (lines 345-346, 427-428, 483-484) — NOT create a new variable with the same name.

**Model Role Rules:**
- `env.WRITER_MODEL` + `writerGateway` = used for `callWriterStage2A`, `callWriterStage2B`, `callGptNanoWriter`
- `env.SEO_MODEL` + `gateway` = used for `callGptNanoMinorUpdate`, `callGptNanoMasterUpdate`, SEO tasks
- `env.DEEPSEEK_MODEL_DIRECT` + `deepseekGateway` = analysis only (UNCHANGED)

---

### Micro-Task 3.2: Fix Writer Model Routing

**File:** `backend/src/services/openai.service.ts`
**Action:** In the 3 writer functions, **DELETE** the local `const writerGateway = deepseekGateway ?? gateway;` and `const writerModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.SEO_MODEL;` lines. Replace all model references with the module-level `writerGateway` + `env.WRITER_MODEL`.

**Function 1 — `callGptNanoWriter()` (lines 341-417):**

```typescript
// DELETE these 2 lines (345-346):
// const writerGateway = deepseekGateway ?? gateway;
// const writerModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.SEO_MODEL;

// In the chatRaw call, change:
//   model: writerModel    →    model: env.WRITER_MODEL
// The writerGateway reference already points to module scope now
```

**Function 2 — `callWriterStage2A()` (lines 419-473):**

```typescript
// DELETE these 2 lines (427-428):
// const writerGateway = deepseekGateway ?? gateway;
// const writerModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.SEO_MODEL;

// In the chatRaw call, change:
//   model: writerModel    →    model: env.WRITER_MODEL
```

**Function 3 — `callWriterStage2B()` (lines 475-529):**

```typescript
// DELETE these 2 lines (483-484):
// const writerGateway = deepseekGateway ?? gateway;
// const writerModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.SEO_MODEL;

// In the chatRaw call, change:
//   model: writerModel    →    model: env.WRITER_MODEL
```

**Functions to KEEP unchanged:**

| Function | Line | Model (stays same) |
|----------|------|-------------------|
| `callGptNanoMinorUpdate()` | 598 | `env.SEO_MODEL` via `gateway` |
| `callGptNanoMasterUpdate()` | 631 | `env.SEO_MODEL` via `gateway` |
| `callDeepSeekAnalysis()` | ~200+ | `deepseekGateway ?? gateway` + `DEEPSEEK_MODEL` |

---

### Micro-Task 3.3: Relax Validation Schemas + Fix Master Update + Remove Placeholders

**File:** `backend/src/services/openai.service.ts`

**Action A — Relax Stage2ASchema min chars (lines 121-133):**
```typescript
// BEFORE:
sections: z.object({
    HOOK: z.string().min(200),
    'WHAT HAPPENED': z.string().min(200),
    'WHY IT MATTERS': z.string().min(200),
    'HISTORY REPEATS?': z.string().min(200),
}),

// AFTER:
sections: z.object({
    HOOK: z.string().min(100),
    'WHAT HAPPENED': z.string().min(100),
    'WHY IT MATTERS': z.string().min(100),
    'HISTORY REPEATS?': z.string().min(100),
}),
```

**Action B — Relax Stage2BSchema min chars (lines 135-141):**
```typescript
// BEFORE:
const Stage2BSchema = z.object({
    sections: z.object({
        'PRICE PICTURE': z.string().min(200),
        'RISK CHECK': z.string().min(200),
        'BOTTOM LINE': z.string().min(150),
    }),
});

// AFTER:
const Stage2BSchema = z.object({
    sections: z.object({
        'PRICE PICTURE': z.string().min(100),
        'RISK CHECK': z.string().min(100),
        'BOTTOM LINE': z.string().min(80),
    }),
});
```

**Action C — Fix `callGptNanoMasterUpdate` to inject null-section directive (line ~617-626):**
```typescript
// BEFORE (line 617):
const existingSections = sections.map(section => `${section}: ${existingArticle[section] || 'N/A'}`).join('\n\n');

// AFTER:
const nullSections = sections.filter(s => !existingArticle[s] || String(existingArticle[s]).length < 50);
const existingSections = sections.map(section => `${section}: ${existingArticle[section] || 'N/A'}`).join('\n\n');
const sectionDirective = nullSections.length > 0
    ? `\n\nIMPORTANT: The following sections are currently empty and MUST be generated: ${nullSections.join(', ')}. Do NOT skip them.`
    : '';
```

Then append `sectionDirective` to the user prompt at line 626:
```typescript
// BEFORE:
content: `Update the following living article sections based on this new analysis: ${JSON.stringify(analysisResult)}\n\nExisting sections:\n${existingSections}\n\nOutput ONLY the sections that need updating as JSON.`

// AFTER:
content: `Update the following living article sections based on this new analysis: ${JSON.stringify(analysisResult)}\n\nExisting sections:\n${existingSections}\n\nOutput ONLY the sections that need updating as JSON.${sectionDirective}`
```

**Action D — Remove placeholder fallback from `mergeArticleStages` (lines 532-541):**
```typescript
// BEFORE:
const fallbackSections = {
    'PRICE PICTURE': 'Additional price analysis pending. See the full breakdown in the living article for this coin.',
    'RISK CHECK': 'Risk assessment pending. Standard risk management practices are advised in volatile market conditions.',
    'BOTTOM LINE': 'Analysis pending. Monitor the situation for updates.',
};
const sections = {
    ...stage2A.sections,
    ...(stage2B ? stage2B.sections : fallbackSections),
};

// AFTER:
const sections = {
    ...stage2A.sections,
    ...(stage2B ? stage2B.sections : {
        'PRICE PICTURE': null,
        'RISK CHECK': null,
        'BOTTOM LINE': null,
    }),
};
```

---

### Micro-Task 3.4: Update Repair Script + Verification

**File:** `backend/src/scripts/repair-incomplete-articles.ts`

**Action A — Improve `isSectionIncomplete` to detect placeholders:**
```typescript
// BEFORE:
function isSectionIncomplete(value: string | null): boolean {
    return value === null || value.trim().length < 10;
}

// AFTER:
const PLACEHOLDER_PATTERNS = [
    'Additional analysis pending',
    'Risk assessment pending',
    'Analysis pending',
    'Additional price analysis pending',
];

function isSectionIncomplete(value: string | null): boolean {
    if (value === null || value.trim().length < 50) return true;
    return PLACEHOLDER_PATTERNS.some(p => value.includes(p));
}
```

**Action B — TypeScript check:**
```bash
cd backend && npx tsc --noEmit
```

---

## 3. Track B — Historical Analysis Depth (Micro-Task 3.5)

> **Supreme Finding:** The plan fixes the writer model, but the deeper architectural weakness is that the historical analysis layer feeds the writer garbage data. All 5 sub-tasks below address this.

### Micro-Task 3.5.A — Fix Historical News Fetch to Use Event Types

**File:** `backend/src/services/temporalIntelligence.service.ts`
**Current bug (line 23):** `await fetchCoinHistoricalNews(symbol, 'Other');` — hardcoded, so all history is tagged "Other" and pattern matching by event type is semantically meaningless.

**Fix:**
```typescript
const EVENT_TYPES = ['ETF', 'Hack', 'Listing', 'Upgrade', 'Regulatory', 'Funding'];

export async function fetchHistoricalNewsForCoins(coins: string[]): Promise<void> {
    for (const symbol of coins) {
        for (const eventType of EVENT_TYPES) {
            await sleep(3000 + Math.random() * 1000);
            await fetchCoinHistoricalNews(symbol, eventType);
        }
        console.log(`[Temporal] Fetched all event types for ${symbol}`);
    }
}
```

---

### Micro-Task 3.5.B — Add EventType Filtering to `buildTemporalPattern`

**File:** `backend/src/services/temporalIntelligence.service.ts`
**Current bug (line 63-75):** The `eventType` param is passed in but never used in the SQL query. Zero filtering.

**Fix — replace entire `buildTemporalPattern` function body:**
```typescript
export async function buildTemporalPattern(
    symbol: string,
    eventType: string,
    severity: number
): Promise<TemporalPattern | null> {
    const exactRows = await db.select()
        .from(coinNewsHistory)
        .where(and(
            eq(coinNewsHistory.coinSymbol, symbol),
            eq(coinNewsHistory.eventType, eventType),
            gte(coinNewsHistory.eventSeverity, Math.max(1, severity - 1)),
            lte(coinNewsHistory.eventSeverity, severity + 1),
            isNotNull(coinNewsHistory.price7dAfter),
            gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '365 days'`)
        ))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(15);

    const rows = exactRows.length >= 3 ? exactRows : await db.select()
        .from(coinNewsHistory)
        .where(and(
            eq(coinNewsHistory.coinSymbol, symbol),
            gte(coinNewsHistory.eventSeverity, Math.max(1, severity - 1)),
            isNotNull(coinNewsHistory.price7dAfter),
            gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '365 days'`)
        ))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(15);

    if (rows.length === 0) return null;

    const historicalCases = rows.map(r => ({
        date: r.publishedAt.toISOString().split('T')[0],
        headline: r.title,
        outcome: r.isRugPull ? 'RUG PULL — token went to zero' : `${r.priceChange7d != null && r.priceChange7d > 0 ? '+' : ''}${Number(r.priceChange7d ?? 0).toFixed(1)}% in 7 days`
    }));
    const live = rows.filter(r => !r.isRugPull);
    const rugCount = rows.filter(r => r.isRugPull).length;
    const rugPullRate = `${Math.round(rugCount / rows.length * 100)}%`;
    const bullishRate = live.length ? `${Math.round(live.filter(r => Number(r.priceChange7d ?? 0) > 0).length / live.length * 100)}%` : 'N/A';
    const avgChange = live.length ? live.reduce((sum, r) => sum + Number(r.priceChange7d ?? 0), 0) / live.length : null;
    const avgOutcome7d = avgChange !== null ? `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%` : 'N/A';

    return { eventType, severity, sampleSize: rows.length, rugPullRate, bullishRate, avgOutcome7d, historicalCases };
}
```

**Key changes:**
1. Try exact `eventType` filter first (line with `eq(coinNewsHistory.eventType, eventType)`)
2. Fallback to broader query if < 3 exact results
3. Window extended from 180 days → 365 days
4. Limit increased from 10 → 15
5. Rest of the function (historicalCases calculation) unchanged

---

### Micro-Task 3.5.C — Pass Raw Historical Cases to the Writer

**File:** `backend/src/crons/aiWorkflow.cron.ts`
**Current bug (line 308):** `const analysisJson = JSON.stringify(analysisResult);` — the rich `historicalCases[]` from `TemporalPattern` never reaches the writer.

**Fix — around line 308, need access to `pattern` variable.** The Junior must find where `pattern` is defined (look for `buildTemporalPattern` call earlier in the function) and inject cases:

```typescript
// BEFORE (line 308):
const analysisJson = JSON.stringify(analysisResult);

// AFTER:
const analysisJson = JSON.stringify({
    ...analysisResult,
    _historicalCases: pattern?.historicalCases?.slice(0, 3) ?? [],
    _historicalStats: pattern ? {
        sampleSize: pattern.sampleSize,
        bullishRate: pattern.bullishRate,
        avgOutcome7d: pattern.avgOutcome7d,
    } : null,
});
```

**File:** `backend/src/services/ai/prompt-factory.ts` — `buildArticleStage2AMessages` (line ~320)

Change the `HISTORY REPEATS?` section instruction:

```typescript
// BEFORE:
"HISTORY REPEATS?": "<If analysis.temporalContext is not null, expand it with specific numbers and dates. If null, write a brief but specific historical comparison relevant to the event type. Include at least one concrete past example with numbers. Write 3-4 substantive sentences.>"

// AFTER:
"HISTORY REPEATS?": "<Use _historicalCases from input if available. Cite SPECIFIC past events with dates and percentage outcomes from _historicalCases array. Format: 'In [Month Year], when [coin] faced similar [eventType], the price moved [X]% over 7 days.' If _historicalCases is empty, use analysis.temporalContext. Write 3-4 substantive sentences with at least one concrete number.>"
```

---

### Micro-Task 3.5.D — Expand temporalContext in DeepSeek Prompt

**File:** `backend/src/services/ai/prompt-factory.ts` — `buildDeepAnalysisMessages` (line 187)

```typescript
// BEFORE (line 187):
"temporalContext":  "<1 sentence referencing historical pattern if provided, else null>",

// AFTER:
"temporalContext":  "<If historical pattern provided: summarize the statistical outcome. Format: 'Based on [N] similar [eventType] events for [symbol], bullish rate was [X]%, avg 7d return was [Y]%. Most recent case: [headline, date, outcome].' If no pattern: use domain knowledge to reference 1 specific comparable historical event with numbers. MAX 2 sentences.>",
```

---

## 4. File Change Summary (Complete)

| File | Micro-Task | Change |
|------|-----------|--------|
| `backend/src/config/env.ts` | 3.1 | Add `WRITER_MODEL` after `SEO_MODEL` (line 26) |
| `backend/src/services/openai.service.ts` | 3.1-3.3 | Add `writerGateway` (after L166), delete 3×2 local shadow-declarations, relax schemas, null-section directive, remove placeholder fallback |
| `backend/src/scripts/repair-incomplete-articles.ts` | 3.4 | Improve `isSectionIncomplete` with placeholder patterns |
| `backend/src/services/temporalIntelligence.service.ts` | 3.5.A + 3.5.B | Event type iteration in fetch + exact eventType filter + fallback + 365d window |
| `backend/src/crons/aiWorkflow.cron.ts` | 3.5.C | Inject `_historicalCases` + `_historicalStats` into analysisJson |
| `backend/src/services/ai/prompt-factory.ts` | 3.5.C + 3.5.D | Update `HISTORY REPEATS?` writer prompt + expand `temporalContext` analysis prompt |

### Files NOT Changed
- `backend/src/services/ai/ai-gateway.ts` — gateway class unchanged
- `backend/src/services/ai/cache-manager.ts` — unchanged
- `backend/src/services/ai/quality-auditor.ts` — unchanged
- `backend/src/services/ai/factual-grounding.ts` — unchanged
- `backend/src/controllers/market.controller.ts` — unchanged
- All frontend files — unchanged
- All route files — unchanged

---

## 5. Risk Assessment

### Track A Risks

| Risk | Mitigation |
|------|-----------|
| Gemini 2.5 Flash fails schema validation | Relaxed schemas (min 100 chars) + fallback to `buildFallbackArticle` still exists |
| Gemini response format differs from OpenAI | `AIGateway` already handles `stripThinkingBlocks()` for `<think/>` tags |
| OpenRouter rate limits Gemini | Circuit breaker (`gptNanoBreaker`) already exists in `aiWorkflow.cron.ts` |
| Existing articles stay broken | Repair script with improved `isSectionIncomplete` will detect and fix them |
| `writerGateway` timeout (120s vs 90s) | Intentional for Gemini generation time; monitor in production |

### Track B Risks

| Risk | Mitigation |
|------|-----------|
| Historical fetch over-queries Google News RSS | Rate limiting already in place (`sleep(3000)` per call × 6 event types) |
| `_historicalCases` bloats token count | Sliced to top 3 cases (~200 chars max), negligible overhead |
| Writer hallucinates if `_historicalCases` is empty | Fallback to `temporalContext` string preserved |
| eventType mismatch between triage and history labels | Fuzzy fallback query (3.5.B — < 3 exact results → broader match) |

---

## 6. Validation Criteria

1. `npx tsc --noEmit` passes with zero errors
2. No existing exports or function signatures are changed (backward compatibility)
3. `env.WRITER_MODEL` is configurable via `.env` (can swap models without code changes)
4. `buildTemporalPattern` returns results filtered by eventType when available
5. `analysisJson` string in aiWorkflow contains `_historicalCases` array when pattern exists

---

## 7. Execution Order

```
Track A:  3.1 (config + gateway) → 3.2 (writer routing fix) → 3.3 (schemas + master update + placeholders) → 3.4 (repair + tsc)
Track B:  3.5.A (event type fetch) → 3.5.B (query filter) → 3.5.C (inject cases + writer prompt) → 3.5.D (analysis prompt)
```

**Parallelization:** Track B (3.5.A–3.5.D) can execute **in parallel** with Track A (3.1–3.4) since they touch different files.

**Dependencies within tracks:**
- Track A: 3.1+3.2 together → 3.3 → 3.4
- Track B: 3.5.A → 3.5.B → 3.5.C → 3.5.D (sequential — data pipeline must be built top-down)

---

## 8. Additional Identified Issues (Out of Scope — Do NOT Touch)

### Issue 1: Article Duplication & Incomplete Data Refresh
**Scope:** Backend Logic / AI Workflow Orchestration

**Problem:**
The system fails to maintain a 1:1 relationship between an asset and its master article. When a "Major" update occurs, it spawns a new article entity instead of updating the existing one. Only `Signal Intelligence` is updated while the 7 Deep Dive sections remain stale.

**Expected Solution:**
- Enforce strict **one article per currency** rule.
- `Signal Intelligence` must dynamically update with incoming data.
- **Deep Dive / 7 Sections Refresh**: When a major update arrives, regenerate core sections based on new analysis.
- Timeline updates must log within the existing entity.

### Issue 2: Terminal Deep Dive UX & Button Behavior
**Scope:** Frontend Terminal UI

**Problem:**
Deep Dive Analytics section is hidden/collapsed by default. "Read Deep Dive" button acts as accordion toggle, contradicting always-open UX requirement.

**Expected Solution:**
- Deep Dive defaults to **open/expanded state** permanently.
- "Read Deep Dive" button becomes **scroll-to anchor** only.

### Issue 3: Critical UI State Bug (Stuck Collapse)
**Scope:** Frontend Article UI / Accordion State

**Problem:**
Collapsing/closing analysis sections gets permanently stuck — refuses to reopen without navigating away.

**Expected Solution:**
- Repair React state logic for expand/collapse toggle reliability.
