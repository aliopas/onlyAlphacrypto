# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: Phase 14 — Article Content Disappears After Update + Cache Invalidation Fix

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 2 (T-01 through T-02, Single Batch P0)
**Priority Order:** Single Batch (both tasks are independent and can be done in parallel)
**Executor:** Senior Developer
**Scope:** 2 files modified. Zero new files. Zero new npm packages.

---

### 1. Planning Stage (Planner)

**Target:** Fix two bugs: (1) Article content disappears from terminal page after being updated by AI cron. (2) Missing `master:${symbol}` Redis cache invalidation after article updates causes stale data.

**Root Cause — Primary Bug (Stale radarId):**
1. Article published for BTC → radar signal **id=42** created
2. `RadarGrid` links to `/terminal/BTC?radarId=42`
3. Article updated by AI cron → new radar signal **id=43** created (new row, new auto-increment ID)
4. User revisits `/terminal/BTC?radarId=42` → `getRadarSignals` returns only id=43 (DISTINCT ON latest per coin)
5. `TerminalPageClient.tsx:24` sets `selectedRadarId = 42` blindly (no validation against available signals)
6. `activeRadar = signals.find(r => r.id === 42)` → **`undefined`**
7. `AlphaStream` receives `newsId=null, radarSignal=undefined` → renders standby view (no content)
8. Chart still works (unrelated to radarId)

**Root Cause — Secondary Bug (Missing Cache Invalidation):**
- `aiWorkflow.cron.ts:490` deletes `news:${symbol}` and `insight:all` but **NEVER** invalidates `master:${symbol}`
- Stale master article data served for up to 60s after update

**Key Constraints (Tech Lead Guardrails):**
1. **DO NOT** touch `DeepDiveSection.tsx`, `LivingArticle.tsx`, `AlphaStream.tsx`, or any routing files
2. **DO NOT** modify `getRadarSignals` DISTINCT ON logic — it's correct
3. **DO NOT** add `onConflictDoUpdate` to radar signals insert — out of scope
4. **DO NOT** change `market.model.ts` (no schema changes)
5. **DO NOT** install new packages
6. **DO NOT** modify any route, controller, or cron files EXCEPT `aiWorkflow.cron.ts` (single line addition)
7. Only modify `TerminalPageClient.tsx` (lines 23-25) and `aiWorkflow.cron.ts` (line 490)

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** T-01 and T-02 are independent. Execute in parallel.

---

#### T-01: Validate Stale radarId in TerminalPageClient
**File:** `frontend/src/features/terminal/components/TerminalPageClient.tsx`
**Lines:** 23-25
**Assigned To:** Senior Developer
**Status:** ✅ Done

**BEFORE (current — broken):**
```typescript
const latestRadarForCoin = validSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase())?.id;
const defaultRadarId = initialRadarId ?? (isAlphaFocus ? latestRadarForCoin : null);
const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;
```

**AFTER (fixed):**
```typescript
const latestRadarForCoin = validSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase());
const safeInitialRadarId = initialRadarId != null && validSignals.some(r => r.id === initialRadarId) ? initialRadarId : null;
const defaultRadarId = isAlphaFocus
    ? (safeInitialRadarId ?? latestRadarForCoin?.id ?? null)
    : safeInitialRadarId;
const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;
```

**Logic Change — Fallback Priority:**
1. `initialRadarId` — ONLY if it actually exists in `validSignals` (not stale/orphaned)
2. Latest radar signal for the same coin — if `isAlphaFocus` is true
3. First available signal — universal fallback
4. `null` — no signals at all (standby view)

**What Changed:**
- `latestRadarForCoin` now stores the full signal object (not just `.id`) so it can be used as a fallback reference
- `safeInitialRadarId` validates `initialRadarId` against `validSignals.some(r => r.id === initialRadarId)` before using it
- `defaultRadarId` now uses `safeInitialRadarId` instead of raw `initialRadarId`
- If `isAlphaFocus`, falls back to `latestRadarForCoin?.id` when `safeInitialRadarId` is null
- If NOT `isAlphaFocus` but `initialRadarId` was provided and valid → uses it; otherwise null (no forced radar selection)

**Verification Checklist:**
- `validSignals` variable on line 21 is unchanged
- `defaultTab` on line 22 is unchanged
- `useState` for `selectedRadarId` on line 29 still uses `finalDefaultRadarId` — unchanged
- Zero new imports needed
- Zero `any` types

---

#### T-02: Add Missing `master:${symbol}` Cache Invalidation in Cron
**File:** `backend/src/crons/aiWorkflow.cron.ts`
**Line:** 490
**Assigned To:** Senior Developer
**Status:** ✅ Done

**BEFORE (current — missing invalidation):**
```typescript
// 4i. Redis invalidation (targeted only)
await deleteCache(`news:${symbol}`);
await deleteCache('insight:all');
```

**AFTER (fixed):**
```typescript
// 4i. Redis invalidation (targeted only)
await deleteCache(`master:${symbol}`);
await deleteCache(`news:${symbol}`);
await deleteCache('insight:all');
```

**Logic Change:**
- Add `await deleteCache(\`master:${symbol}\`);` as the FIRST invalidation call (before `news:${symbol}`)
- This ensures `getMasterArticle(symbol)` fetches fresh data after article updates
- The `master:${symbol}` cache has a 60s TTL (`market.controller.ts:361`) — without invalidation, stale article content is served for up to 60s after an update

**What Changed:**
- Single line addition: `await deleteCache(\`master:${symbol}\`);`
- Placed before existing `news:${symbol}` deletion for logical ordering (master data invalidated first)
- Comment unchanged

**Verification Checklist:**
- `deleteCache` is already imported and available in scope (verified: used on line 490-491)
- `symbol` variable is in scope (verified: function parameter)
- No new imports needed
- No type changes
- Existing `news:${symbol}` and `insight:all` deletions remain untouched

---

### 3. QA & Security Stage (QA Hunter)

**Status:** ✅ PASS — All Checks Clear
**QA Date:** April 23, 2026

**QA Notes:**
- T-01: `safeInitialRadarId` correctly validates against `validSignals.some()`. Fallback chain verified (valid → latest coin → first → null). Zero `any`, zero new imports, only lines 23-25 modified. No re-render issues.
- T-02: `master:${symbol}` deletion present before `news:${symbol}`. Cache key matches `market.controller.ts:361`. `symbol` always uppercase. `deleteCache` has internal try-catch (no cascade failures). Single line addition confirmed via `git diff`.
- Both: No guardrails violated. Frontend & backend `tsc --noEmit` clean.

---

### 4. Deployment Stage (Release Manager)

**Status:** ✅ Ready for Deployment — QA Passed

---

---

## 📦 Completed Phases (Archived)

### Phase 13 — 404 Fix: Dynamic AI Radar Coins
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 4 (T-01 through T-04, Single Batch)
**Status:** ✅ All Tasks Done — QA Passed — Awaiting Deployment

### Phase 12 — Airdrop UX Overhaul: From Functional to Premium
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 15 (T-01 through T-15, in Batches)
**Status:** ✅ All Tasks Done — Awaiting Final QA
