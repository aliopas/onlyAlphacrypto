# THE NEXUS HUB — Active Task Board

**Last Updated:** May 13, 2026
**Active Mission:** Algorithm Intelligence Upgrade — Phase A (Bug Fix Batch)
**Source Plan:** `plans/ALGORITHM-INTELLIGENCE-UPGRADE.md`

---

## Mission Context

Shadow mode analysis revealed the algorithm produces 100% NATURAL results. Root cause: 6 critical bugs mathematically guarantee signal rejection. Phase A fixes all 6 bugs. No new files, tables, crons, or packages.

**Tech Lead Guardrails:**
- No new files, tables, crons, or npm packages
- All changes behind existing env flags
- Zero `any` types. Strict TypeScript
- Backward compatible — no export signature breaks
- Each fix is independently deployable
- Shadow mode data is the only acceptable proof

**Execution Order:**
```
FIX-3 (S/R filter) → FIX-1 (RR math) → FIX-5 (regime threshold)
→ FIX-2 (direction) → FIX-4 (daily trend) → FIX-6 (deduplicate RR)
```

**Decisions:** DEC-021 to DEC-026 in `plans/decisions/`

**Reference Files:**
- TP/SL V2: `backend/src/services/tpslCalculatorV2.service.ts`
- Classification: `backend/src/services/signalClassification.service.ts`
- Technical Analysis: `backend/src/services/technicalAnalysis.service.ts`
- AI Workflow: `backend/src/crons/aiWorkflow.cron.ts`
- Market Regime: `backend/src/services/marketRegime.service.ts`
- TP/SL Sanity: `backend/src/services/tpslSanityGate.service.ts`

---

## TASK FIX-3: Lower S/R Strength Filter (60 → 40)

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** HIGH — enables more S/R levels for quality scoring
**Decision:** DEC-023
**Estimate:** 20 min

### Objective
Split S/R level filtering into two tiers. Strong levels (>=60) for TP/SL price targets. All levels (>=40) for quality scoring (nearSR bonus).

### Target File
`backend/src/services/technicalAnalysis.service.ts`

### Exact Changes

**Line 277 — Replace single filter with dual-tier:**
```typescript
// BEFORE:
const filterAndSort = (levels: SRLevel[]) =>
    levels.filter(l => l.strengthScore >= 60).sort(...).slice(0, 5);

// AFTER:
const strongLevels = (levels: SRLevel[]) =>
    levels.filter(l => l.strengthScore >= 60).sort(...).slice(0, 5);
const allLevels = (levels: SRLevel[]) =>
    levels.filter(l => l.strengthScore >= 40).sort(...).slice(0, 8);
```

**Update nearSR check** to use `allLevels` (broader net for quality score).
**Update export** to expose both `strongLevels` and `allLevels` for TP/SL calculator to consume.

### Acceptance Criteria
- S/R levels with strengthScore 40-59 now contribute to nearSR quality bonus
- TP/SL calculator still only uses levels >= 60 for price targets
- Strength score formula unchanged
- File compiles without errors
- Zero `any` types

---

## TASK FIX-1: Fix TP/SL V2 RR Fallback Math

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** HIGH — guarantees rejection when no S/R levels exist
**Decision:** DEC-021
**Estimate:** 15 min

### Objective
Change ATR and percentage fallback multipliers to produce RR >= minimum by default.

### Target File
`backend/src/services/tpslCalculatorV2.service.ts`

### Exact Changes

**ATR fallback (TP):**
```typescript
// BEFORE: entryPrice + atr * 1.5
// TACTICAL AFTER: entryPrice + atr * 2.0
// STRATEGIC AFTER: entryPrice + atr * 3.0
```

**ATR fallback (SL):**
```typescript
// BEFORE: entryPrice - atr * 1.0
// AFTER: entryPrice - atr * 1.0 (unchanged)
```

**Percentage fallback (TP):**
```typescript
// BEFORE: entryPrice * 1.15
// TACTICAL AFTER: entryPrice * 1.12
// STRATEGIC AFTER: entryPrice * 1.18
```

**Percentage fallback (SL):**
```typescript
// BEFORE: entryPrice * 0.92
// AFTER: entryPrice * 0.95
```

**Must use `signalType` param** to select tactical vs strategic multipliers.

### Acceptance Criteria
- ATR fallback RR >= 2.0 for tactical, >= 3.0 for strategic
- Percentage fallback RR >= 2.0 for tactical, >= 3.0 for strategic
- S/R-based TP/SL (priority 1) unchanged
- TP/SL distance bounds (1%-40%) still pass sanity gate
- File compiles without errors

---

## TASK FIX-5: Raise VOLATILE Regime Threshold

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** MEDIUM — over-triggers in normal crypto volatility
**Decision:** DEC-025
**Estimate:** 10 min

### Objective
Raise ATR thresholds so VOLATILE regime triggers only during genuinely extreme volatility.

### Target File
`backend/src/services/marketRegime.service.ts`

### Exact Changes

**Line 109:**
```typescript
// BEFORE: atrPercent > 3 ? 1 : atrPercent > 1.5 ? 0.5 : 0
// AFTER:  atrPercent > 5 ? 1 : atrPercent > 2.5 ? 0.5 : 0
```

**Line 146:**
```typescript
// BEFORE: if (atrPercent > 4 || volatilityScore >= 1)
// AFTER:  if (atrPercent > 6 || volatilityScore >= 1)
```

### Acceptance Criteria
- VOLATILE only triggers at ATR > 5% (was 3%)
- SIDEWAYS regime unchanged
- Fear & Greed triggers unchanged
- Macro keyword triggers unchanged
- File compiles without errors

---

## TASK FIX-2: Fix Hardcoded Direction in Classification

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** HIGH — breaks all BEARISH signal TP/SL and RR
**Decision:** DEC-022
**Estimate:** 25 min

### Objective
Derive signal direction from verdict instead of hardcoding 'bullish'.

### Target Files
`backend/src/services/signalClassification.service.ts`
`backend/src/crons/aiWorkflow.cron.ts`

### Exact Changes

**signalClassification.service.ts — Line 112:**
```typescript
// BEFORE:
const direction: 'bullish' | 'bearish' = 'bullish';
// AFTER:
const direction = params.verdict
    ? (['STRONG_BULLISH', 'BULLISH'].includes(params.verdict) ? 'bullish' as const
       : ['STRONG_BEARISH', 'BEARISH'].includes(params.verdict) ? 'bearish' as const
       : 'bullish' as const)
    : 'bullish' as const;
```

**Add optional `verdict` to classifySignal params interface.**

**aiWorkflow.cron.ts:**
Pass verdict to `classifySignal()` call.

### Acceptance Criteria
- BULLISH verdict → direction = 'bullish'
- BEARISH verdict → direction = 'bearish'
- Missing verdict → direction = 'bullish' (safe fallback)
- classifySignal params interface backward compatible (optional field)
- Zero `any` types
- File compiles without errors

---

## TASK FIX-4: Fix Daily Trend Gate — Directional Alignment

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** HIGH — blocks valid SELL signals + aborts all processing
**Decision:** DEC-024
**Estimate:** 30 min

### Objective
Replace blanket bearish rejection with directional alignment check. Replace `continue` with shouldSkipSignal flag.

### Target File
`backend/src/crons/aiWorkflow.cron.ts`

### Exact Changes

**Lines 659-669 — Replace daily trend block:**
```typescript
// BEFORE:
if (bearishTrends.has(dailyTrend)) {
    console.log(`Skipping signal...`);
    continue; // BLOCKS EVERYTHING
}

// AFTER:
let shouldSkipSignal = false;
if (env.DAILY_TREND_ENABLED) {
    try {
        const dailyTrend = await calculateDailyTrend(symbol) as DailyTrendLabel;
        const bearishTrends = new Set(['BEARISH', 'STRONG_BEARISH']);
        const signalDir = deriveSignalDirection(verdict);
        if (bearishTrends.has(dailyTrend) && signalDir === 'bullish') {
            logger.info(`Skipping BULLISH signal for ${symbol}: counter-trend (daily=${dailyTrend})`);
            shouldSkipSignal = true;
        }
    } catch (err) {
        logger.warn(`[AI Workflow] Daily trend check failed for ${symbol}:`, err);
    }
}
```

**Add helper function:**
```typescript
function deriveSignalDirection(verdict: string): 'bullish' | 'bearish' | 'neutral' {
    const bullish = new Set(['STRONG_BULLISH', 'BULLISH']);
    const bearish = new Set(['STRONG_BEARISH', 'BEARISH']);
    if (bullish.has(verdict)) return 'bullish';
    if (bearish.has(verdict)) return 'bearish';
    return 'neutral';
}
```

**Wrap signal creation block** with `if (!shouldSkipSignal) { ... }`.
Article, memory, news history, and cache invalidation run REGARDLESS.

### Acceptance Criteria
- SELL on BEARISH trend → ALLOWED
- BUY on BEARISH trend → SKIPPED (signal only)
- SIDEWAYS trend → ALLOWED (no bias)
- Article/memory/news/cache ALWAYS run
- No `continue` in daily trend block
- File compiles without errors

---

## TASK FIX-6: Deduplicate RR Check

**Status:** ⬜ PENDING
**Assignee:** Senior Developer
**Priority:** LOW — redundancy cleanup
**Decision:** DEC-026 (partial)
**Estimate:** 10 min

### Objective
Remove redundant RR recalculation from signalClassification.service.ts. Read from already-validated values.

### Target File
`backend/src/services/signalClassification.service.ts`

### Exact Changes
Remove local RR calculation and `meetsMinimumRR` derivation.
Read RR status from the TP/SL V2 result passed via params (already validated by tpslCalculatorV2 + tpslSanityGate).

### Acceptance Criteria
- RR checked in exactly 2 places: tpslCalculatorV2 (source) + tpslSanityGate (validation)
- signalClassification reads RR, does not recalculate
- meetsMinimumRR still appears in classification result (from source data)
- File compiles without errors

---

## Phase A Exit Gate

- [ ] All 6 fixes deployed
- [ ] Shadow mode running minimum 1 week
- [ ] Algorithm produces >= 10 non-NATURAL signals per week
- [ ] Algorithm disagreement win rate measurable
- [ ] No regression in AI signal quality
- [ ] Zero TypeScript errors in modified files

---

## Execution Order

```
HF-4 (verify) → HF-1 (trim patterns) → HF-2 (impact filter) → HF-3 (scenario filter) → HF-5 (DB cleanup)
```

---

## TASK HF-4: Verify EventOutcomeChecker Filter is Correct

**Status:** ✅ DONE — Verified (filter already present)
**Assignee:** Senior Developer
**Priority:** HIGH — Read-only verification, confirms baseline
**Estimate:** 5 min

### Objective
Verify that `eventOutcomeChecker.cron.ts` already has the correct `TRACKED_COINS` filter in place. This is a READ-ONLY verification task — only fix if something is wrong.

### Target File
`backend/src/crons/eventOutcomeChecker.cron.ts`

### Verification Checklist
1. **Import check (line 7):** Confirm `TRACKED_COINS` is imported from `'../config/coins'`
2. **Import check (line 6):** Confirm `inArray` is imported from `'drizzle-orm'`
3. **Filter check (line 42):** Confirm `inArray(coinNewsHistory.coinSymbol, [...TRACKED_COINS])` exists inside the `and()` WHERE clause at lines 38-43
4. **No bypass check:** Confirm there is NO other query in the file that fetches rows without this filter (only the update at line 192 is exempt — it updates by `id`)

### Expected State (confirmed from codebase read)
- ✅ Line 6: `import { eq, isNotNull, isNull, and, lt, gte, sql, inArray } from 'drizzle-orm';`
- ✅ Line 7: `import { TRACKED_COINS } from '../config/coins';`
- ✅ Line 42: `inArray(coinNewsHistory.coinSymbol, [...TRACKED_COINS])`
- ✅ No other query bypasses the filter

### Acceptance Criteria
- All 4 checks pass → mark DONE, no code changes needed
- If ANY check fails → fix it (add missing import or filter), then mark DONE

### Agent Log Entry
```
Task ID: HF-4
Verdict: APPROVED after verification
Notes: Filter already present at correct location. No changes needed.
```

---

## TASK HF-1: Trim SYMBOL_PATTERNS to 11 Tracked Coins

**Status:** ✅ DONE
**Assignee:** Senior Developer
**Priority:** HIGH
**Estimate:** 10 min

### Objective
Remove 11 non-tracked coin entries from `SYMBOL_PATTERNS` in `aiWorkflow.cron.ts`. Currently 22 entries cause unnecessary regex matching on every news title for coins that get filtered out later anyway.

### Target File
`backend/src/crons/aiWorkflow.cron.ts` — Lines 144-166

### Current State
The `SYMBOL_PATTERNS` object (lines 144-166) contains 22 entries:
```
BTC, ETH, SOL, BNB, XRP, ADA, DOGE, DOT, AVAX, MATIC, LINK, UNI, ATOM, FIL, APT, SUI, NEAR, OP, ARB, WLD, PEPE
```
(22 entries total)

### Exact Change Required
**Keep** these 11 entries (they are in `TRACKED_COINS`):
```
BTC: /\b(bitcoin|btc)\b/i,
ETH: /\b(ethereum|eth\b)/i,
SOL: /\b(solana|sol\b)/i,
BNB: /\b(binance coin|bnb)\b/i,
XRP: /\b(ripple|xrp)\b/i,
ADA: /\b(cardano|ada)\b/i,
DOGE: /\b(dogecoin|doge)\b/i,
AVAX: /\b(avalanche|avax)\b/i,
LINK: /\b(chainlink|link)\b/i,
SUI: /\b(sui)\b/i,
TON: /\b(ton\b)/i,    ← NOTE: TON is tracked but MISSING from SYMBOL_PATTERNS — must ADD it
```

**Delete** these 11 entries:
```
DOT: /\b(polkadot|dot)\b/i,
MATIC: /\b(polygon|matic)\b/i,
UNI: /\b(uniswap|uni)\b/i,
ATOM: /\b(cosmos|atom)\b/i,
FIL: /\b(filecoin|fil)\b/i,
APT: /\b(aptos|apt)\b/i,
NEAR: /\b(near\b)/i,
OP: /\b(optimism|op\b)/i,
ARB: /\b(arbitrum|arb)\b/i,
WLD: /\b(worldcoin|wld)\b/i,
PEPE: /\b(pepe)\b/i,
```

### Rules
- Preserve exact regex patterns for kept coins
- **Add `TON: /\b(ton\b)/i`** — TON is tracked but missing from current patterns
- Final object must have exactly 11 entries
- No other changes to the file

### Acceptance Criteria
- `SYMBOL_PATTERNS` has exactly 11 keys: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, SUI, TON
- All 11 match entries in `TRACKED_COINS`
- File compiles without errors

### Agent Log Entry
```
Task ID: HF-1
Verdict: (APPROVED / REJECTED)
Notes: (confirm 11 entries, confirm TON added)
```

---

## TASK HF-2: Add TRACKED_COINS Filter to eventImpactOutcomeChecker

**Status:** ✅ DONE
**Assignee:** Senior Developer
**Priority:** HIGH — active errors in production
**Estimate:** 10 min

### Objective
Add `inArray` filter on `eventImpacts.coinSymbol` to the WHERE clause so non-tracked coins are never sent to `getCoinKlinesRange`.

### Target File
`backend/src/crons/eventImpactOutcomeChecker.cron.ts`

### Current State (Lines 7, 52-68)
- Line 7: `import { eq, and, lte } from 'drizzle-orm';` — **missing `inArray`**
- Lines 64-67: WHERE clause only has `eq(status, 'pending')` and `lte(dueAt, now)` — **no coin filter**

### Exact Changes Required

**Change 1 — Line 7:** Add `inArray` to drizzle-orm import
```typescript
// FROM:
import { eq, and, lte } from 'drizzle-orm';
// TO:
import { eq, and, lte, inArray } from 'drizzle-orm';
```

**Change 2 — After line 7:** Add TRACKED_COINS import
```typescript
import { TRACKED_COINS } from '../config/coins';
```

**Change 3 — Lines 64-67:** Add coin filter to WHERE clause
```typescript
// FROM:
.where(and(
    eq(eventImpactOutcomes.status, 'pending'),
    lte(eventImpactOutcomes.dueAt, now),
))
// TO:
.where(and(
    eq(eventImpactOutcomes.status, 'pending'),
    lte(eventImpactOutcomes.dueAt, now),
    inArray(eventImpacts.coinSymbol, [...TRACKED_COINS]),
))
```

### Rules
- Only modify the import lines and WHERE clause — no other logic changes
- Keep existing `eq(status, 'pending')` and `lte(dueAt, now)` conditions
- The `inArray` targets `eventImpacts.coinSymbol` (the joined table), NOT `eventImpactOutcomes`

### Acceptance Criteria
- `inArray` is imported from drizzle-orm
- `TRACKED_COINS` is imported from `config/coins`
- WHERE clause has 3 conditions: status=pending, dueAt<=now, coinSymbol IN TRACKED_COINS
- File compiles without errors

### Agent Log Entry
```
Task ID: HF-2
Verdict: (APPROVED / REJECTED)
Notes: (confirm 3 WHERE conditions, confirm correct table alias)
```

---

## TASK HF-3: Add TRACKED_COINS Filter to scenarioOutcomeChecker

**Status:** ✅ DONE
**Assignee:** Senior Developer
**Priority:** MEDIUM — currently disabled but ticking bomb
**Estimate:** 10 min

### Objective
Add `inArray` filter on `scenarioHorizonOutcomes.coinSymbol` to the WHERE clause. Currently disabled via env flag, but will cause identical Binance 400 errors when enabled.

### Target File
`backend/src/crons/scenarioOutcomeChecker.cron.ts`

### Current State (Lines 6, 20-33)
- Line 6: `import { eq, lte, and, sql } from 'drizzle-orm';` — **missing `inArray`**
- Lines 29-32: WHERE clause only has `eq(status, 'pending')` and `lte(dueAt, now)` — **no coin filter**

### Exact Changes Required

**Change 1 — Line 6:** Add `inArray` to drizzle-orm import
```typescript
// FROM:
import { eq, lte, and, sql } from 'drizzle-orm';
// TO:
import { eq, lte, and, sql, inArray } from 'drizzle-orm';
```

**Change 2 — After line 6:** Add TRACKED_COINS import
```typescript
import { TRACKED_COINS } from '../config/coins';
```

**Change 3 — Lines 29-32:** Add coin filter to WHERE clause
```typescript
// FROM:
.where(and(
    eq(scenarioHorizonOutcomes.status, 'pending'),
    lte(scenarioHorizonOutcomes.dueAt, now)
))
// TO:
.where(and(
    eq(scenarioHorizonOutcomes.status, 'pending'),
    lte(scenarioHorizonOutcomes.dueAt, now),
    inArray(scenarioHorizonOutcomes.coinSymbol, [...TRACKED_COINS]),
))
```

### Rules
- Only modify the import lines and WHERE clause — no other logic changes
- Keep existing WHERE conditions
- The `inArray` targets `scenarioHorizonOutcomes.coinSymbol`

### Acceptance Criteria
- `inArray` is imported from drizzle-orm
- `TRACKED_COINS` is imported from `config/coins`
- WHERE clause has 3 conditions: status=pending, dueAt<=now, coinSymbol IN TRACKED_COINS
- File compiles without errors

### Agent Log Entry
```
Task ID: HF-3
Verdict: (APPROVED / REJECTED)
Notes: (confirm 3 WHERE conditions)
```

---

## TASK HF-5: DB Cleanup Script — Remove Non-Tracked Coin Data

**Status:** ✅ DONE
**Assignee:** Senior Developer
**Priority:** MEDIUM
**Estimate:** 15 min

### Objective
Create a one-time SQL cleanup script that removes all rows with non-tracked `coin_symbol` values from affected tables. Uses `migration_flags` guard for idempotency.

### Target File (NEW)
`backend/scripts/cleanup-non-tracked-coins.sql`

### Reference
- `migration_flags` table schema: `backend/src/models/market.model.ts:335`
- Existing scripts follow pattern: transaction-wrapped, idempotent
- Tracked coins: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON

### Script Specification

```sql
-- Hotfix: Cleanup Non-Tracked Coin Data
-- Date: May 2026
-- Idempotent: guarded by migration_flags

BEGIN;

-- Guard: Check if already run
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'cleanup_non_tracked_coins') THEN
        RAISE NOTICE 'Cleanup already executed. Skipping.';
        ROLLBACK;
        RETURN;
    END IF;
END $$;

-- Step 1: Count rows to be deleted (for logging)
DO $$
DECLARE
    cnh_count BIGINT;
    ei_count BIGINT;
    sho_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO cnh_count FROM coin_news_history
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'coin_news_history rows to delete: %', cnh_count;

    SELECT COUNT(*) INTO ei_count FROM event_impacts
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'event_impacts rows to delete: %', ei_count;

    SELECT COUNT(*) INTO sho_count FROM scenario_horizon_outcomes
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'scenario_horizon_outcomes rows to delete: %', sho_count;
END $$;

-- Step 2: Delete stale rows from coin_news_history
DELETE FROM coin_news_history
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 3: Delete stale rows from event_impacts
DELETE FROM event_impacts
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 4: Delete stale rows from scenario_horizon_outcomes
DELETE FROM scenario_horizon_outcomes
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 5: Record migration flag
INSERT INTO migration_flags (flag_name) VALUES ('cleanup_non_tracked_coins');

COMMIT;
```

### Rules
- Must be idempotent — guard prevents double-run
- Transaction-wrapped (BEGIN/COMMIT)
- Log count of rows to be deleted per table BEFORE committing
- Only target tables that have `coin_symbol` column
- No new tables, indexes, or schema changes

### Acceptance Criteria
- File exists at `backend/scripts/cleanup-non-tracked-coins.sql`
- Script is transaction-wrapped
- Guard checks `migration_flags` for `'cleanup_non_tracked_coins'`
- Logs counts for all 3 tables before deleting
- Deletes from: `coin_news_history`, `event_impacts`, `scenario_horizon_outcomes`
- Inserts migration flag after cleanup
- SQL is valid PostgreSQL

### Agent Log Entry
```
Task ID: HF-5
Verdict: (APPROVED / REJECTED)
Notes: (confirm idempotent, confirm all 3 tables, confirm migration flag)
```

---

## Post-Deployment Verification

After ALL 5 tasks are deployed:
1. Check production logs for `[EventOutcomeChecker]` — should show ZERO non-tracked coin errors
2. Check `[EventImpactOutcomeChecker]` — same
3. Confirm `coin_news_history` has no rows with non-tracked symbols
4. Run for 24h and verify clean logs

---

## Agent Log

| Date | Task ID | Verdict | Executor | Reviewer | Notes |
|------|---------|---------|----------|----------|-------|
| May 11, 2026 | HF-4 | APPROVED | Senior Dev | — | Filter already present. No changes needed. |
| May 11, 2026 | HF-1 | APPROVED | Senior Dev | — | Trimmed SYMBOL_PATTERNS from 22 to 11. Added TON. |
| May 11, 2026 | HF-2 | APPROVED | Senior Dev | — | Added inArray filter + TRACKED_COINS import. |
| May 11, 2026 | HF-3 | APPROVED | Senior Dev | — | Added inArray filter + TRACKED_COINS import. |
| May 11, 2026 | HF-5 | APPROVED | Senior Dev | — | Created idempotent cleanup script. |
