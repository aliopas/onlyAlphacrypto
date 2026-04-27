# THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## Active Phase: NONE — All Phases Complete

---

## Completed Phases (Archived)

### Phase 20 — AI Pipeline Quality Fix: Memory Injection, Minor Update Overhaul & Model Upgrade (P0)
**Priority:** P0 — Analysis quality is degrading, minor updates are generic filler
**Total Tasks:** 8 (T-01 through T-08) — All Done, Verified
**Executor:** Senior Developer
**Scope:** 5 modified files, 0 new files, 0 new dependencies
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` — Phase 20 section (lines 1550-1950)

**Summary:**
- Fix 1: Coin memory injection — `DeepAnalysisInput` expanded with `coinSymbol` and `recentMemory`, memory fetched before analysis
- Fix 2: Minor update overhaul — `MinorUpdateInput` expanded with price/timeline context, prompts rewritten for Bloomberg-style updates
- Fix 3: Model upgrade — Primary analysis model changed from `deepseek-chat` to `deepseek-reasoner`

---

### 1. Planning Stage (Planner)

**Target:** Three targeted fixes to the AI pipeline based on a full codebase audit:
1. Deep Analysis has no memory — `coin_memory` populated but never read during analysis
2. Minor updates are generic filler — 1-line prompt, only headline context, cheapest model
3. Primary analysis model is wrong — `deepseek-chat` (V3 non-thinking) is primary while `deepseek-reasoner` (R1 thinking) is fallback

**What Needs Doing:**
- T-01: Fix 3 — Change `DEEPSEEK_MODEL_DIRECT` default from `deepseek-chat` to `deepseek-reasoner` in `env.ts`
- T-02: Fix 1A — Expand `DeepAnalysisInput` interface + add coin memory section to user prompt in `prompt-factory.ts`
- T-03: Fix 1B — Fetch `getRecentMemory()` inside `callDeepSeekAnalysis()` and attach to input in `openai.service.ts`
- T-04: Fix 1C — Add `symbol` to `callDeepSeekAnalysis({...})` call in `aiWorkflow.cron.ts`
- T-05: Fix 2A — Expand `MinorUpdateInput` + rewrite `buildMinorUpdateMessages()` in `prompt-factory.ts`
- T-06: Fix 2B — Update `callGptNanoMinorUpdate()` signature to accept `MinorUpdateInput` in `openai.service.ts`
- T-07: Fix 2C — Fetch timeline + price before calling minor update in `aiWorkflow.cron.ts`
- T-08: Verify — `tsc --noEmit`, zero `any`, backward compatibility

**Key Constraints (Tech Lead Guardrails):**
1. **ZERO `any` types** across all modified code
2. **ZERO new files** — all changes are to existing files
3. **ZERO new npm packages**
4. **ZERO route/controller/DB changes** — only env, prompts, service signatures, and workflow call sites
5. System prompt for deep analysis stays UNCHANGED (it already has excellent JSON structure)
6. System prompt for article writer stays UNCHANGED
7. `callGptNanoMinorUpdate()` must continue returning `Promise<string>` (plain text, not JSON)
8. `callDeepSeekAnalysis()` must continue returning `Promise<DeepAnalysisResult>` (unchanged)
9. All existing exports and signatures must remain backward-compatible
10. Keep existing retry logic (3 attempts) for `callDeepSeekAnalysis`
11. Keep existing fallback logic for `generateLightweightTriage`
12. Memory section must handle `recentMemory = []` or `undefined` gracefully — show "No prior events recorded for this coin"
13. Do NOT change the article writer model (`google/gemini-2.5-flash`)
14. Do NOT change the chat model (`openai/gpt-4.1-mini`)
15. Do NOT change the SEO model (`openai/gpt-5-nano`) — still used for minor updates
16. `AIGateway` already strips thinking blocks via `stripThinkingBlocks()` — no change needed for `deepseek-reasoner`

**Verified References (exact line numbers from current codebase):**
- `backend/src/config/env.ts:37` — `DEEPSEEK_MODEL_DIRECT: z.string().default('deepseek-chat')` ← change to `'deepseek-reasoner'`
- `backend/src/services/ai/prompt-factory.ts:31-36` — `DeepAnalysisInput` interface ← add `coinSymbol` + `recentMemory`
- `backend/src/services/ai/prompt-factory.ts:44-47` — `MinorUpdateInput` interface ← expand with 4 new fields
- `backend/src/services/ai/prompt-factory.ts:225-328` — `buildDeepAnalysisMessages()` ← add memory section to user prompt (after line 326, before closing)
- `backend/src/services/ai/prompt-factory.ts:508-519` — `buildMinorUpdateMessages()` ← rewrite system + user prompts
- `backend/src/services/openai.service.ts:390-416` — `callDeepSeekAnalysis(input: DeepAnalysisInput, ...)` ← fetch memory before line 394
- `backend/src/services/openai.service.ts:667-677` — `callGptNanoMinorUpdate(newsTitle: string, existingHeadline: string)` ← change to accept `MinorUpdateInput`
- `backend/src/crons/aiWorkflow.cron.ts:278-294` — `callDeepSeekAnalysis({headline, intelligence, pattern, price})` ← add `symbol`
- `backend/src/crons/aiWorkflow.cron.ts:233` — `callGptNanoMinorUpdate(item.title, existingHeadline)` ← replace with expanded call
- `backend/src/services/coin-memory.service.ts:22-24` — `getRecentMemory(coinSymbol, limit=5)` ← already exists, no changes needed
- `backend/src/services/priceService.ts:76-98` — `getPriceWithFallback(symbol)` ← already exists, no changes needed
- `backend/src/models/market.model.ts:157-170` — `coinMemory` table columns (eventType, eventSummary, priceAtEvent, verdict, confidenceScore, riskVerdict, keyDrivers, redFlags)

**Status:** PLANNING COMPLETE — READY FOR EXECUTION

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08
>
> **DEPENDENCY CHAIN:**
> - T-01 is independent (1-line env change)
> - T-02, T-03, T-04 are sequential (Fix 1 — prompt-factory → openai.service → workflow)
> - T-05, T-06, T-07 are sequential (Fix 2 — prompt-factory → openai.service → workflow)
> - T-08 is final verification

---

#### T-01: Change Primary Analysis Model to DeepSeek Reasoner (Fix 3)
**File (MODIFY):** `backend/src/config/env.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** None

**Target:** Change the default DeepSeek direct model from `deepseek-chat` (V3, non-thinking) to `deepseek-reasoner` (R1, thinking mode). This immediately upgrades analysis quality since the thinking model is already mapped to `deepseek-v4-flash` thinking mode under the hood.

**Exact change at line 37:**

**BEFORE:**
```typescript
DEEPSEEK_MODEL_DIRECT: z.string().default('deepseek-chat'),
```

**AFTER:**
```typescript
DEEPSEEK_MODEL_DIRECT: z.string().default('deepseek-reasoner'),
```

**Why this is safe:**
- `deepseek-reasoner` currently works and maps to v4-flash thinking mode under the hood
- Same cost as `deepseek-chat` (both map to same underlying model)
- `AIGateway.stripThinkingBlocks()` at `ai-gateway.ts:35-39` already strips thinking tokens from response
- No other code changes needed — model name flows through existing routing

**Verification Checklist:**
- Only line 37 modified in `env.ts`
- No other env vars changed
- `tsc --noEmit` clean
- Zero `any` types (no new code)

---

#### T-02: Add Coin Memory to Deep Analysis Prompt (Fix 1A — Prompt Factory)
**File (MODIFY):** `backend/src/services/ai/prompt-factory.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** None

**Target:** Expand the `DeepAnalysisInput` interface to include `coinSymbol` and `recentMemory`, and add a new "RECENT EVENTS FOR THIS COIN" section to the user prompt in `buildDeepAnalysisMessages()`.

**Sub-task 2A: Expand `DeepAnalysisInput` interface (lines 31-36)**

**BEFORE (lines 31-36):**
```typescript
export interface DeepAnalysisInput {
    headline: string;
    intelligence: CoinIntelligence | null;
    pattern: TemporalPattern | null;
    price: PriceResult | null;
}
```

**AFTER:**
```typescript
export interface DeepAnalysisInput {
    headline: string;
    intelligence: CoinIntelligence | null;
    pattern: TemporalPattern | null;
    price: PriceResult | null;
    coinSymbol: string;
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
}
```

**Notes:**
- `coinSymbol` is required (not optional) — the caller always has the symbol
- `recentMemory` is optional — coins with no history will have `undefined` or empty array
- Use `ReadonlyArray` instead of raw `Array` for immutability
- All inner fields are nullable because the DB columns are nullable (matches `coinMemory` table schema at `market.model.ts:157-170`)

**Sub-task 2B: Add memory section to user prompt in `buildDeepAnalysisMessages()`**

Insert a new section in the user message (inside the template literal), AFTER the `--- HISTORICAL PATTERN ---` section and BEFORE the final analysis instruction. The developer must read the current file to find the exact insertion point (the user message template literal spans lines 305-326 approximately).

**New section to insert:**
```
--- RECENT EVENTS FOR THIS COIN ---
${input.recentMemory && input.recentMemory.length > 0
    ? input.recentMemory.map((m, i) =>
        `${i + 1}. [${m.createdAt.toISOString().split('T')[0]}] ${m.eventType}: ${m.eventSummary} | Price: $${m.priceAtEvent ?? 'N/A'} | Verdict: ${m.verdict ?? 'N/A'} | Confidence: ${m.confidenceScore ?? 'N/A'}${m.redFlags && m.redFlags.length > 0 ? ` | Red Flags: ${m.redFlags.join(', ')}` : ''}${m.keyDrivers && m.keyDrivers.length > 0 ? ` | Drivers: ${m.keyDrivers.join(', ')}` : ''}`
    ).join('\n')
    : 'No prior events recorded for this coin.'}
```

**Rules for the memory section:**
- Must NOT be injected as system prompt (system prompt stays unchanged per guardrail)
- Must use `input.recentMemory` (from the interface, not a DB call)
- Must handle empty/undefined memory gracefully — show "No prior events recorded for this coin."
- Keep each event on one line for readability
- Include: date, eventType, summary, price, verdict, confidence, red flags, key drivers
- Date format: ISO date only (YYYY-MM-DD), not full timestamp

**Verification Checklist:**
- `DeepAnalysisInput` now has `coinSymbol: string` (required) and `recentMemory` (optional)
- `recentMemory` uses `ReadonlyArray` with properly typed inner fields
- User prompt has new "RECENT EVENTS FOR THIS COIN" section
- Empty memory handled gracefully (no crash, shows "No prior events")
- System prompt unchanged
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-03: Fetch Memory Inside callDeepSeekAnalysis (Fix 1B — OpenAI Service)
**File (MODIFY):** `backend/src/services/openai.service.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-02 (DeepAnalysisInput must have `coinSymbol` and `recentMemory` fields)

**Target:** Inside `callDeepSeekAnalysis()`, fetch recent memory using `getRecentMemory()` and attach it to the input object BEFORE building messages.

**Add import at top of file (with existing imports):**
```typescript
import { getRecentMemory } from './coin-memory.service';
```

**Modify `callDeepSeekAnalysis()` at line 390-394:**

**BEFORE (lines 390-394 approximately):**
```typescript
export async function callDeepSeekAnalysis(input: DeepAnalysisInput, attempt: number = 1): Promise<DeepAnalysisResult> {
    // ... existing code ...
    const messages = prompts.buildDeepAnalysisMessages(input);
    // ... rest of function ...
```

**AFTER:**
```typescript
export async function callDeepSeekAnalysis(input: DeepAnalysisInput, attempt: number = 1): Promise<DeepAnalysisResult> {
    // ... existing code ...
    const memory = await getRecentMemory(input.coinSymbol, 5);
    const enrichedInput: DeepAnalysisInput = {
        ...input,
        recentMemory: memory.length > 0 ? memory : undefined,
    };
    const messages = prompts.buildDeepAnalysisMessages(enrichedInput);
    // ... rest of function uses `enrichedInput` only if needed, but `messages` is what matters ...
```

**Important notes:**
- `getRecentMemory` returns an array of full `coinMemory` rows. The field names may not exactly match the `recentMemory` interface in `DeepAnalysisInput` — the developer MUST verify the column names from `market.model.ts:157-170` match the interface fields defined in T-02. If column names differ (e.g., snake_case vs camelCase), a mapping step is required.
- The `enrichedInput` preserves all original fields via spread, then overlays `recentMemory`.
- If `getRecentMemory` fails or returns empty, we set `recentMemory` to `undefined` (triggers the "No prior events" message in the prompt).
- Do NOT add try-catch around `getRecentMemory` here — the existing outer try-catch in `callDeepSeekAnalysis()` will handle failures. If memory fetch fails, the analysis should still proceed without memory (fail-safe).
- Actually, wrapping in try-catch IS safer — if memory DB is down, we don't want to block analysis. Add a try-catch that falls back to `undefined` on error.

**Safer approach:**
```typescript
let recentMemory: DeepAnalysisInput['recentMemory'];
try {
    const memory = await getRecentMemory(input.coinSymbol, 5);
    recentMemory = memory.length > 0 ? memory as unknown as NonNullable<DeepAnalysisInput['recentMemory']>[number][] : undefined;
} catch {
    recentMemory = undefined;
}
const enrichedInput: DeepAnalysisInput = { ...input, recentMemory };
```

**IMPORTANT:** The developer must verify that the return type of `getRecentMemory` is compatible with the `recentMemory` field in `DeepAnalysisInput`. If the `coinMemory` table uses different field names or types, a mapping step is required. Check `market.model.ts:157-170` for column definitions and compare with the interface in T-02.

**Verification Checklist:**
- `getRecentMemory` imported from `coin-memory.service`
- Memory fetched BEFORE `buildDeepAnalysisMessages()` call
- Fail-safe: if memory fetch fails, analysis continues without memory
- `enrichedInput` passed to `buildDeepAnalysisMessages()` (not original `input`)
- Existing retry logic unchanged
- Existing fallback logic unchanged
- `tsc --noEmit` clean
- Zero `any` types (avoid `as unknown as` — use proper mapping if needed)

---

#### T-04: Pass Symbol to callDeepSeekAnalysis in Workflow (Fix 1C — Cron)
**File (MODIFY):** `backend/src/crons/aiWorkflow.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-02 (DeepAnalysisInput must have `coinSymbol` field)

**Target:** Add `symbol` to the input object passed to `callDeepSeekAnalysis()` at line ~278.

**Exact change at lines 278-294:**

**BEFORE (lines 278-294 approximately):**
```typescript
analysisResult = await callDeepSeekAnalysis({
    headline: item.title,
    intelligence,
    pattern,
    price,
});
```

**AFTER:**
```typescript
analysisResult = await callDeepSeekAnalysis({
    headline: item.title,
    intelligence,
    pattern,
    price,
    coinSymbol: symbol,
});
```

**Note:** `symbol` is already available in scope at this point — it's the coin symbol being processed in the current loop iteration. The developer should verify this by reading the surrounding code context.

**Verification Checklist:**
- Only the `callDeepSeekAnalysis({...})` call is modified
- `symbol` is a string in the current scope (verify by reading code)
- No other changes to the workflow
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-05: Overhaul Minor Update Prompts (Fix 2A — Prompt Factory)
**File (MODIFY):** `backend/src/services/ai/prompt-factory.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** None (independent of Fix 1)

**Target:** Expand `MinorUpdateInput` interface and completely rewrite `buildMinorUpdateMessages()` to produce data-rich, Bloomberg-style timeline updates instead of generic filler.

**Sub-task 5A: Expand `MinorUpdateInput` interface (lines 44-47)**

**BEFORE (lines 44-47):**
```typescript
export interface MinorUpdateInput {
    newsTitle: string;
    existingHeadline: string;
}
```

**AFTER:**
```typescript
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
```

**Sub-task 5B: Rewrite `buildMinorUpdateMessages()` (lines 508-519)**

**BEFORE (current — minimal prompt):**
The current implementation has a 1-line system prompt and a user prompt that only uses `newsTitle` and `existingHeadline`.

**AFTER — New system prompt:**
```
You are OnlyAlpha's senior market analyst writing a living article timeline update.
You receive a new development and context about the coin's current state.
Write a concise, data-rich timeline update (2-3 paragraphs).
Rules:
- Include specific numbers (price, percentages, timeframes) when available.
- Reference the coin's current price and 24h change if provided.
- If this is a continuation of a recent trend, say so explicitly.
- Do NOT repeat what was already said in the existing story — add new information only.
- Tone: factual, analytical, Bloomberg-style.
- Output: plain text, 150-400 words. No JSON. No headers.
```

**AFTER — New user prompt:**
```
New Development: ${input.newsTitle}
Coin: ${input.coinSymbol}
Current Price: ${input.currentPrice !== null ? `$${input.currentPrice.toLocaleString()}` : 'N/A'}${input.priceChange24h !== null ? ` (24h change: ${input.priceChange24h > 0 ? '+' : ''}${input.priceChange24h.toFixed(2)}%)` : ''}

Existing Story: ${input.existingHeadline}

Recent Timeline Updates (last 3):
${input.recentTimeline.length > 0
    ? input.recentTimeline.map((t, i) =>
        `${i + 1}. [${t.createdAt.toISOString().split('T')[0]}] (${t.severity}) ${t.updateText.slice(0, 200)}`
    ).join('\n')
    : 'No prior timeline updates for this article.'}

Write a 2-3 paragraph timeline update that incorporates the new development into the ongoing story. Include the current price context if available. Do not repeat what was already covered in the existing story or recent timeline.
```

**Key design decisions:**
- Output is PLAIN TEXT (not JSON) — matches existing `callGptNanoMinorUpdate()` which uses `chatRaw()` not `chat()`
- 150-400 words — enough for substance, not a full article
- Handles missing data gracefully (price N/A, no prior timeline)
- `recentTimeline` limited to last 3 updates by the caller (not the prompt)
- No JSON enforcement needed — plain text output

**Verification Checklist:**
- `MinorUpdateInput` expanded with 4 new fields (coinSymbol, currentPrice, priceChange24h, recentTimeline)
- `recentTimeline` uses `ReadonlyArray`
- System prompt is Bloomberg-style, factual tone
- User prompt includes price context, coin symbol, existing story, recent timeline
- Handles missing data (null price, empty timeline) gracefully
- Output spec: plain text, 150-400 words, no JSON
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-06: Update callGptNanoMinorUpdate Signature (Fix 2B — OpenAI Service)
**File (MODIFY):** `backend/src/services/openai.service.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-05 (MinorUpdateInput interface must be expanded)

**Target:** Change `callGptNanoMinorUpdate()` to accept `MinorUpdateInput` instead of two separate strings.

**Add import at top (with existing imports from prompt-factory):**
```typescript
import type { MinorUpdateInput } from './ai/prompt-factory';
```

**Check if `MinorUpdateInput` is already imported — it may not be since `callGptNanoMinorUpdate` currently constructs the object inline.**

**Exact change at lines 667-677:**

**BEFORE:**
```typescript
export async function callGptNanoMinorUpdate(newsTitle: string, existingHeadline: string): Promise<string> {
    const messages = prompts.buildMinorUpdateMessages({ newsTitle, existingHeadline });
    // ... rest of function
```

**AFTER:**
```typescript
export async function callGptNanoMinorUpdate(input: MinorUpdateInput): Promise<string> {
    const messages = prompts.buildMinorUpdateMessages(input);
    // ... rest of function
```

**CRITICAL — Backward compatibility:**
This is a **breaking signature change**. Every caller of `callGptNanoMinorUpdate()` must be updated. The ONLY caller is `aiWorkflow.cron.ts:233` — which is updated in T-07. If there are other callers, they must also be updated. The developer should search the codebase for all usages of `callGptNanoMinorUpdate` before making this change.

**Verification Checklist:**
- `MinorUpdateInput` imported from prompt-factory
- Function signature changed from `(newsTitle: string, existingHeadline: string)` to `(input: MinorUpdateInput)`
- Return type unchanged: `Promise<string>`
- Internal body passes `input` directly to `buildMinorUpdateMessages(input)`
- Model routing unchanged (still uses `gateway` + `env.SEO_MODEL`)
- `chatRaw()` call unchanged (plain text, not JSON)
- `stripSectionTags()` call unchanged
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-07: Expand Minor Update Caller in Workflow (Fix 2C — Cron)
**File (MODIFY):** `backend/src/crons/aiWorkflow.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-06 (callGptNanoMinorUpdate signature changed)

**Target:** Before calling `callGptNanoMinorUpdate`, fetch recent timeline entries and current price, then pass the expanded `MinorUpdateInput` object.

**Check required imports:**
- `coinTimelineUpdates` from `../models/market.model` — verify this is imported (used elsewhere in the file)
- `desc` from `drizzle-orm` — verify this is imported
- `getPriceWithFallback` from `../services/priceService` — verify this is imported (used at line ~270)

**Exact change at line ~233:**

**BEFORE (inside the MINOR classification block):**
```typescript
const updateText = await callGptNanoMinorUpdate(item.title, existingHeadline);
```

**AFTER:**
```typescript
const recentTimelineRows = await db.select({
    updateText: coinTimelineUpdates.updateText,
    createdAt: coinTimelineUpdates.createdAt,
    severity: coinTimelineUpdates.severity,
})
    .from(coinTimelineUpdates)
    .where(eq(coinTimelineUpdates.masterArticleId, master[0].id))
    .orderBy(desc(coinTimelineUpdates.createdAt))
    .limit(3);

const updatePrice = await getPriceWithFallback(symbol);

const updateText = await callGptNanoMinorUpdate({
    newsTitle: item.title,
    existingHeadline: existingHeadline,
    coinSymbol: symbol,
    currentPrice: updatePrice?.price ?? null,
    priceChange24h: updatePrice?.change24h ?? null,
    recentTimeline: recentTimelineRows.map(r => ({
        updateText: r.updateText,
        createdAt: r.createdAt,
        severity: r.severity,
    })),
});
```

**Important notes:**
- `master[0].id` is the master article ID — verify this variable is in scope at line 233 (it should be, from the `master` query earlier in the MINOR block)
- `symbol` is the coin symbol — verify it's in scope
- The `recentTimelineRows` query fetches the last 3 timeline updates for this master article — provides context about what was already written
- `getPriceWithFallback` is already imported and used elsewhere in this file — no new import needed
- The `coinTimelineUpdates` table may use `masterArticleId` or `master_article_id` — developer must verify the Drizzle column name from the model definition
- If `coinTimelineUpdates` is not imported, add it to the existing model import line
- The existing `existingHeadline` variable (from `master[0].headline`) is preserved — it's used in the new input object

**Also add required imports if missing (at the top of the file):**
- Verify `coinTimelineUpdates` is imported from `'../models/market.model'`
- Verify `desc` is imported from `'drizzle-orm'`

**Verification Checklist:**
- `recentTimelineRows` fetched from `coinTimelineUpdates` with `LIMIT 3`
- `updatePrice` fetched via `getPriceWithFallback`
- `callGptNanoMinorUpdate` now receives `MinorUpdateInput` object (not two strings)
- All 6 fields populated: newsTitle, existingHeadline, coinSymbol, currentPrice, priceChange24h, recentTimeline
- Null-safe: `updatePrice?.price ?? null`, `updatePrice?.change24h ?? null`
- Empty timeline handled (map of empty array = empty array, prompt handles it)
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-08: Final Verification
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** All previous tasks (T-01 through T-07)

**Target:** Verify the complete implementation works correctly.

**Verification Checklist (Developer self-check):**
1. Run `tsc --noEmit` in `backend/` — zero errors
2. Search for `any` in all 4 modified files — zero matches (excluding comments)
3. Verify `DEEPSEEK_MODEL_DIRECT` default is `'deepseek-reasoner'` (not `'deepseek-chat'`)
4. Verify `DeepAnalysisInput` has `coinSymbol: string` and `recentMemory?`
5. Verify `callDeepSeekAnalysis()` fetches memory before building messages
6. Verify `aiWorkflow.cron.ts:278` passes `coinSymbol: symbol` to analysis
7. Verify `MinorUpdateInput` has all 6 fields
8. Verify `buildMinorUpdateMessages()` uses new system + user prompts with price/timeline context
9. Verify `callGptNanoMinorUpdate()` accepts `MinorUpdateInput` (not two strings)
10. Verify `aiWorkflow.cron.ts:233` fetches timeline + price before calling minor update
11. Verify all existing exports are backward-compatible (except `callGptNanoMinorUpdate` which has no external callers)
12. Verify `callDeepSeekAnalysis` still returns `Promise<DeepAnalysisResult>`
13. Verify `callGptNanoMinorUpdate` still returns `Promise<string>`
14. Verify no new files created
15. Verify no new npm packages installed

---

### 3. QA & Security Stage (QA Hunter)

> **Status:** ✅ PASS — All 8 tasks + bonus file audited. Phase approved for deployment.

**QA Verdict:** PASS
**Audited By:** QA Hunter
**Audit Date:** April 27, 2026

**Audit Results:**
- T-01: ✅ PASS — `DEEPSEEK_MODEL_DIRECT` default changed to `deepseek-reasoner` at env.ts:37
- T-02: ✅ PASS — `DeepAnalysisInput` expanded with `coinSymbol` + `recentMemory`, memory section in user prompt
- T-03: ✅ PASS — Memory fetched with fail-safe try-catch, field mapping via explicit casts (Drizzle `json` → `string[]` justification)
- T-04: ✅ PASS — `coinSymbol: symbol` passed to `callDeepSeekAnalysis` at aiWorkflow.cron.ts:308
- T-05: ✅ PASS — `MinorUpdateInput` expanded with 4 fields, Bloomberg-style prompts, null-safe
- T-06: ✅ PASS — Signature changed to `MinorUpdateInput`, return type unchanged, all callers verified
- T-07: ✅ PASS — Timeline rows fetched (LIMIT 3), price fetched, null-safe mapping
- T-08: ✅ PASS — `tsc --noEmit` clean, zero `any` types (only in English prompt strings), all exports backward-compatible
- Bonus: ✅ PASS — `repair-incomplete-articles.ts:139` correctly passes `coinSymbol: symbol`

**Security:** No SQL injection (Drizzle ORM), no secrets exposed, no PII leaks, prompt data from trusted AI pipeline only.

**Advisory (non-blocking):** Memory mapping at openai.service.ts:398 uses `Record<string, unknown>` + `as` casts. Functionally correct (Drizzle `json` columns return `unknown`), but consider using the Drizzle inferred type directly for stricter compile-time safety in a future pass.

---

### 4. Deployment Stage (Release Manager)

> **Status:** ✅ READY FOR DEPLOYMENT

---

### 4. Deployment Stage (Release Manager)

> **Status:** Ready for Deployment after QA pass.

---

## Completed Phases (Archived)

### Phase 20 — AI Pipeline Quality Fix: Memory Injection, Minor Update Overhaul & Model Upgrade (P0)
**Priority:** P0 — Analysis quality is degrading, minor updates are generic filler
**Total Tasks:** 8 (T-01 through T-08) — All Done, Verified
**Executor:** Senior Developer
**Scope:** 5 modified files, 0 new files, 0 new dependencies
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` — Phase 20 section (lines 1550-1950)

**Summary:**
- Fix 1: Coin memory injection — `DeepAnalysisInput` expanded with `coinSymbol` and `recentMemory`, memory fetched before analysis
- Fix 2: Minor update overhaul — `MinorUpdateInput` expanded with price/timeline context, prompts rewritten for Bloomberg-style updates
- Fix 3: Model upgrade — Primary analysis model changed from `deepseek-chat` to `deepseek-reasoner`

**Modified Files:**
1. `backend/src/config/env.ts` — Model default changed
2. `backend/src/services/ai/prompt-factory.ts` — Interfaces expanded, prompts rewritten
3. `backend/src/services/openai.service.ts` — Memory fetch logic added, signature updated
4. `backend/src/crons/aiWorkflow.cron.ts` — Call sites updated with new fields
5. `backend/src/scripts/repair-incomplete-articles.ts` — Fixed to pass `coinSymbol`

### Phase 19 — AdSense Legal Pages + Footer (P0)
**Tasks:** 12 (T-01 through T-12) — All Done, QA Passed

### Phase 18 — Signal P&L Tracker / Scorecard (P2)
**Tasks:** 8 (T-01 through T-08) — All Done, QA Passed

### Phase 17 — Telegram Pipeline Feed + Z.ai Airdrop Enrichment (P2)
**Tasks:** 7 (T-01 through T-07) — All Done, QA Passed

### Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)
**Tasks:** 9 (T-01 through T-09) — Deploy 1 Complete

### Phase 15 — Strategic Intelligence Layer
**Tasks:** 5 (T-01 through T-05) — All Done, QA Passed
