# OnlyAlpha — Algorithm Intelligence Upgrade: Phase A

**Tech Lead Approval Document**
**Date:** May 13, 2026
**Status:** APPROVED — Phase A (7 Fixes)
**Source:** Shadow mode analysis revealed algorithm produces 100% NEUTRAL results

---

## Context

Shadow mode data shows the algorithm produces zero actionable signals while the AI produces excellent results. Root cause analysis identified 6 critical bugs that mathematically guarantee signal rejection.

## Guiding Principle

Fix first, measure, then enhance. One phase at a time with shadow mode validation.

## Phase A: Bug Fix Batch (6 Fixes)

**Objective:** Remove the 7 rejection bottlenecks so the algorithm can actually produce signals and shadow mode produces meaningful comparison data.

**Duration:** 1 week
**Files Modified:** 4 service files + 1 cron file
**New Files:** 0
**New Tables:** 0
**New Dependencies:** 0

---

### FIX-1: TP/SL V2 RR Fallback Math (DEC-021)
**File:** `backend/src/services/tpslCalculatorV2.service.ts`
**Lines:** 79-80 (ATR fallback), 113-118 (percentage fallback)

**Current (BROKEN):**
```
ATR:    TP = 1.5× ATR, SL = 1.0× ATR → RR = 1.5  (below min 2.0)
Pct:    TP = 15%,     SL = 8%        → RR = 1.875 (below min 2.0)
```

**Fix:**
```
TACTICAL ATR:  TP = 2.0× ATR, SL = 1.0× ATR → RR = 2.0
STRATEGIC ATR: TP = 3.0× ATR, SL = 1.0× ATR → RR = 3.0

TACTICAL Pct:  TP = 12%, SL = 5% → RR = 2.4
STRATEGIC Pct: TP = 18%, SL = 5% → RR = 3.6
```

**Rules:**
- S/R-based TP/SL (priority 1) remains unchanged
- Only fallback paths (ATR and percentage) change
- Must use `signalType` parameter to select tactical vs strategic multipliers
- TP/SL distance bounds (1%-40%) in sanity gate still enforced

---

### FIX-2: Hardcoded Direction in Classification (DEC-022)
**File:** `backend/src/services/signalClassification.service.ts`
**Line:** 112

**Current (BROKEN):**
```typescript
const direction: 'bullish' | 'bearish' = 'bullish'; // ALWAYS bullish
```

**Fix:**
```typescript
const direction = deriveDirectionFromVerdict(params.verdict);
// STRONG_BULLISH, BULLISH → 'bullish'
// STRONG_BEARISH, BEARISH → 'bearish'
// Default → 'bullish' (safe fallback)
```

**Additional Change:**
- `aiWorkflow.cron.ts` must pass `verdict` (or `direction`) to `classifySignal()` call
- Update `classifySignal` params interface to include optional `verdict` field

**Rules:**
- Backward compatible — add optional param, not required
- If verdict is missing, default to 'bullish' (same as current behavior)
- All bullish signal paths remain identical

---

### FIX-3: Lower S/R Strength Filter (DEC-023)
**File:** `backend/src/services/technicalAnalysis.service.ts`
**Line:** 277

**Current (OVERLY STRICT):**
```typescript
const filterAndSort = (levels: SRLevel[]) =>
    levels.filter(l => l.strengthScore >= 60).sort(...).slice(0, 5);
```

**Fix:**
```typescript
// Split into two lists:
// strongLevels: >= 60 — used for TP/SL AND quality scoring
// weakLevels: 40-59 — used for quality scoring ONLY

const strongLevels = levels.filter(l => l.strengthScore >= 60);
const allLevels = levels.filter(l => l.strengthScore >= 40);

// nearSR check uses allLevels (broader net)
// TP/SL calculator receives strongLevels only (safer targets)
```

**Rules:**
- `tpslCalculatorV2.service.ts` must receive `strongLevels` (>= 60) only for price targets
- `technicalAnalysis.service.ts` `nearSR` check uses `allLevels` (>= 40)
- Strength score formula itself is unchanged
- No new DB columns

---

### FIX-4: Daily Trend Directional Alignment (DEC-024)
**File:** `backend/src/crons/aiWorkflow.cron.ts`
**Lines:** 659-669

**Current (BROKEN):**
```typescript
if (bearishTrends.has(dailyTrend)) {
    console.log(`Skipping signal for ${symbol}: daily trend=${dailyTrend}`);
    continue; // BLOCKS EVERYTHING — even SELL on bearish coin
}
```

**Fix:**
```typescript
// Replace blanket rejection with directional alignment
const signalDirection = deriveSignalDirection(verdict); // bullish/bearish
const trendIsBearish = bearishTrends.has(dailyTrend);

if (trendIsBearish && signalDirection === 'bullish') {
    logger.info(`Skipping BULLISH signal for ${symbol}: counter-trend (daily=${dailyTrend})`);
    shouldSkipSignal = true;
}
// SELL on BEARISH trend = ALLOWED (trend-aligned)
// SIDEWAYS trend = ALLOWED (no bias)

// Replace `continue` with shouldSkipSignal flag
// Signal creation is skipped, but article/memory/news/cache processing CONTINUES
```

**Additional helper needed:**
```typescript
function deriveSignalDirection(verdict: string): 'bullish' | 'bearish' | 'neutral' {
    const bullish = new Set(['STRONG_BULLISH', 'BULLISH']);
    const bearish = new Set(['STRONG_BEARISH', 'BEARISH']);
    if (bullish.has(verdict)) return 'bullish';
    if (bearish.has(verdict)) return 'bearish';
    return 'neutral';
}
```

**Rules:**
- `continue` is REMOVED from this block
- `shouldSkipSignal` flag controls ONLY signal creation (line ~721)
- Article save, memory update, news history, cache invalidation ALWAYS run
- STRONG_BEARISH trend still blocks counter-trend BULLISH signals

---

### FIX-5: Raise VOLATILE Regime Threshold (DEC-025)
**File:** `backend/src/services/marketRegime.service.ts`
**Lines:** 109, 146

**Current (OVER-TRIGGERING):**
```typescript
// Line 109
const volatilityScore = atrPercent > 3 ? 1 : atrPercent > 1.5 ? 0.5 : 0;
// Line 146
if (atrPercent > 4 || volatilityScore >= 1) return 'VOLATILE';
```

**Fix:**
```typescript
// Line 109
const volatilityScore = atrPercent > 5 ? 1 : atrPercent > 2.5 ? 0.5 : 0;
// Line 146
if (atrPercent > 6 || volatilityScore >= 1) return 'VOLATILE';
```

**Rules:**
- VOLATILE regime still blocks ALL signals when triggered
- Only trigger threshold changes
- Fear & Greed triggers unchanged
- Macro keyword triggers unchanged

---

### FIX-6: Deduplicate RR Check (Complementary)
**Files:** `tpslCalculatorV2.service.ts`, `tpslSanityGate.service.ts`, `signalClassification.service.ts`

**Current (REDUNDANT):**
RR minimum is checked in 3 places:
1. `tpslCalculatorV2.service.ts:146` — `isRejected = riskRewardRatio < minRR`
2. `tpslSanityGate.service.ts:70` — `rrRatio >= minRR` check
3. `signalClassification.service.ts:140` — `meetsMinimumRR: rr >= minRR`

**Fix:**
Keep RR check in `tpslCalculatorV2` (source of truth) and `tpslSanityGate` (validation layer).
Remove RR check from `signalClassification.service.ts` — replace with reading the already-validated value from the classification params.

**Rules:**
- `tpslCalculatorV2` remains the primary RR gate
- `tpslSanityGate` remains the validation layer
- `signalClassification` reads RR status, does not recalculate it

---

### FIX-7: Algorithm Verdict Enrichment in Shadow Mode (DEC-028)
**File:** `backend/src/crons/aiWorkflow.cron.ts`
**Lines:** 73-97 (helper functions), 769-797 (shadow insertion block)

**Current (BROKEN):**
```typescript
// Line 773 — uses EMA trend ONLY
const algoVerdict = mapTrendToVerdict(taResult.trend);     // SIDEWAYS → NEUTRAL 95% of the time
const algoDirection = trendToDirection(taResult.trend);     // neutral always
```

`detectTrend()` has 9 return paths — 8 return SIDEWAYS. The algorithm already produces rich analysis (`structure`, `candlePattern`, `volume`, `qualityScore`) but NONE of it is used for the shadow mode algorithm verdict.

**Fix:**
Replace `mapTrendToVerdict(taResult.trend)` with `deriveAlgorithmVerdict(taResult)` using a priority chain:

```
Priority 1 — Structure Gate (highest confidence):
  BOS_BULLISH, HH_HL → 'BULLISH'
  BOS_BEARISH, LH_LL → 'BEARISH'
  CHOCH_BULLISH → 'BULLISH'
  CHOCH_BEARISH → 'BEARISH'
  FAILED_BOS → 'NEUTRAL' (DEC-017 preserved)
  NONE → fall through to Priority 2

Priority 2 — Candle Pattern (if structure = NONE):
  direction='bullish' AND isValid=true → 'BULLISH'
  direction='bearish' AND isValid=true → 'BEARISH'
  else → fall through to Priority 3

Priority 3 — EMA Trend (lowest confidence, existing logic):
  STRONG_BULLISH / BULLISH → 'BULLISH'
  STRONG_BEARISH / BEARISH → 'BEARISH'
  SIDEWAYS → 'NEUTRAL'

Override — Quality Gate:
  qualityScore < 40 → 'NEUTRAL' (weak analysis)
```

Replace `trendToDirection(taResult.trend)` with `deriveAlgorithmDirection(taResult)` — maps verdict to 'bullish'/'bearish'/'neutral'.

**Files:**
- `aiWorkflow.cron.ts`: Replace `mapTrendToVerdict` + `trendToDirection` functions (lines 73-97). Update shadow block (lines 773-775) to call new functions.

**Rules:**
- ONLY changes shadow mode insertion — live signal pipeline UNTOUCHED
- `deriveAlgorithmVerdict` receives full `TechnicalAnalysisFullResult` parameter
- No new files, tables, crons, dependencies
- FAILED_BOS = NEUTRAL preserved (DEC-017)
- VOLATILE regime = NEUTRAL preserved (DEC-014)
- Zero `any` types
- Backward compatible — no export changes

---

## Execution Order

```
FIX-3 (S/R filter) → FIX-1 (RR math) → FIX-5 (regime threshold)
→ FIX-2 (direction) → FIX-4 (daily trend) → FIX-6 (deduplicate) → FIX-7 (shadow verdict)
```

**Rationale:**
- FIX-3 first: more S/R levels available makes FIX-1 testing easier
- FIX-1 second: with more S/R + fixed fallback, RR should now pass
- FIX-5 third: regime stops over-blocking
- FIX-2 + FIX-4 together: both relate to signal direction logic
- FIX-6: cleanup redundancy after everything works
- FIX-7 last: shadow verdict enrichment depends on all prior fixes being in place

---

## Phase A Exit Gate

- [ ] All 7 fixes deployed
- [ ] Shadow mode running minimum 1 week
- [ ] Algorithm produces >= 10 non-NEUTRAL signals per week
- [ ] Shadow mode shows >= 30% non-NEUTRAL algorithm verdicts
- [ ] Algorithm disagreement win rate is measurable (even if < 60%)
- [ ] No regression in AI signal quality
- [ ] Zero TypeScript errors in modified files

**If gate fails:** Diagnose which fix didn't work, adjust, re-run 1 more week.
**If gate passes:** Proceed to Phase B (single intelligence upgrade, TBD).

---

## Tech Lead Guardrails

- No new files, tables, crons, or npm packages
- All changes behind existing env flags (already enabled for shadow mode)
- Zero `any` types
- Backward compatible — no export signature breaks
- Each fix is independently deployable
- Shadow mode data is the only acceptable proof

---

## Files Modified (Summary)

| File | Fixes | Risk |
|---|---|---|
| `tpslCalculatorV2.service.ts` | FIX-1 | LOW — multiplier values only |
| `signalClassification.service.ts` | FIX-2, FIX-6 | MEDIUM — direction logic change |
| `technicalAnalysis.service.ts` | FIX-3 | LOW — threshold change + list split |
| `aiWorkflow.cron.ts` | FIX-4, FIX-7 | MEDIUM — control flow change |
| `marketRegime.service.ts` | FIX-5 | LOW — threshold values only |
| `tpslSanityGate.service.ts` | — | None (no changes, just reference) |

---

## Decisions Issued

- DEC-021: Fix TP/SL V2 RR Fallback Math
- DEC-022: Fix Hardcoded Direction in Signal Classification
- DEC-023: Lower S/R Strength Score Filter from 60 to 40
- DEC-024: Fix Daily Trend Gate to Allow Directional Alignment
- DEC-025: Raise VOLATILE Regime ATR Threshold from 3% to 5%
- DEC-026: Algorithm Intelligence Upgrade — Sequential Delivery Strategy
- DEC-028: Fix Algorithm Verdict in Shadow Mode — Composite Direction Logic
