# Master Plan v2.1 — Tranche 1: Foundation + Validation

**Status:** ✅ COMPLETE — v2.Phase 0 + v2.Phase 0.1 QA PASSED
**Date:** May 7, 2026
**Priority:** P0 (Blocks all subsequent v2 phases)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md`
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

## TRANCHE 1 SCOPE

| v2 Phase | Description | Tasks | Status |
|---|---|---|---|
| v2.Phase 0.0 | Coin Constants (`config/coins.ts`) | T-V2-0A | ✅ DONE |
| v2.Phase 0.0 | Coin Filter — TriageEngine gate | T-V2-0B | ✅ DONE (QA PASSED) |
| v2.Phase 0.0 | Coin Filter — AiWorkflow gate | T-V2-0C | ✅ DONE (QA PASSED) |
| v2.Phase 0.0 | Coin Filter — TerminalEngine gate | T-V2-0D | ✅ DONE (QA PASSED) |
| v2.Phase 0.0 | Market Filter Layer + Cron | T-V2-0E | ✅ DONE (QA PASSED) |
| v2.Phase 0.0 | Phase 0 Env Flags + Server Registration | T-V2-0F | ✅ DONE (QA PASSED) |
| v2.Phase 0.1 | OHLCV DB Schema (migration + Drizzle model) | T-V2-01A | ✅ DONE (QA PASSED) |
| v2.Phase 0.1 | OHLCV Snapshot Service | T-V2-01B | ✅ DONE (QA PASSED) |
| v2.Phase 0.1 | OHLCV Snapshot Cron | T-V2-01C | ✅ DONE (QA PASSED) |
| v2.Phase 0.1 | Historical Backfill Script | T-V2-01D | ✅ DONE (QA PASSED) |
| v2.Phase 0.1 | Phase 0.1 Env Flags + Server Registration | T-V2-01E | ✅ DONE (QA PASSED) |
| v2.Phase 0 | QA Verification (Phase 0 + 0.1) | T-V2-0Q | ✅ DONE (QA PASSED) |

## GUARDRAILS (Apply to ALL v2.Phase 0 + 0.1 tasks)

1. **Zero `any` types** across all new/modified files.
2. **Never hardcode coin symbols** — always import from `config/coins.ts`.
3. **All DB migrations guarded by `migration_flags`** — run exactly once.
4. **All new crons flagged** — default `false` in env.ts.
5. **Backward compatible** — zero changes to existing public API responses.
6. **No BUY/SELL terminology** — use BULLISH/BEARISH only.
7. **All DB queries via Drizzle ORM** — zero raw SQL in TypeScript files.
8. **No new npm packages** — use existing `ioredis`, `bcryptjs`, `node-cron`, `drizzle-orm`, `axios`.
9. **No modifications to existing crons' behavior** — new code is additive only.
10. **Commit only after QA PASS** — each task or deploy group individually.

## PHASE ARCHITECTURE CONTEXT

**What exists today:**
- `SYMBOL_PATTERNS` in `aiWorkflow.cron.ts:110-132` — 21 hardcoded coins (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, DOT, AVAX, MATIC, LINK, UNI, ATOM, FIL, APT, SUI, NEAR, OP, ARB, WLD, PEPE)
- `MAJOR_COINS` in `levelIntelligenceCron.ts:9` — 8 hardcoded coins (BTC, ETH, SOL, ADA, LINK, DOT, AVAX, MATIC)
- No centralized coin config exists
- `binance.service.ts` has `getCoinKlinesRange()` (paginated, max 1500 candles) and `getLivePrices()` — production-ready
- `migration_flags` table in `market.model.ts:283-287` — id, flagName (unique), executedAt
- `coin_intelligence_cache` in `market.model.ts:195-207` — coinSymbol (PK), ath, athDate, trend8w, week52High, week52Low, priceChange30d, wikiBackground, dexBoostActive, dataSource, cachedAt
- Redis via `ioredis` (config/redis.ts) — getCache, setCache, deleteCache, deleteCachePattern
- `bcryptjs` already installed (pure JS, no native dep)
- `express-rate-limit` NOT installed (use existing `apiLimiter` pattern from market.routes.ts for any rate limiting needs)
- `express-session` NOT installed (admin dashboard needs it later — NOT needed for Phase 0/0.1)

**What v2.Phase 0 creates:**
- `backend/src/config/coins.ts` — single source of truth for 11 tracked coins
- Coin filter wired into 3 cron entry points (Triage, Workflow, Terminal)
- `backend/src/crons/marketFilter.cron.ts` — market health check every 6 hours
- `is_tradeable` flag on `coin_intelligence_cache`

**What v2.Phase 0.1 creates:**
- `ohlcv_candles` table (11 coins x 3 timeframes, ~16,500 rows at steady state)
- `ohlcv_indicators` table (pre-computed EMA-20/50/200, ATR-14, volume_avg_20)
- `backend/src/services/ohlcvSnapshot.service.ts` — fetch, store, compute
- `backend/src/crons/ohlcvSnapshot.cron.ts` — every 4 hours
- `backend/scripts/backfill-ohlcv.ts` — one-time 90-day historical fill

---

## REQUIRED TASKS

### T-V2-0A — Tracked Coins Constants (`config/coins.ts`)

**Task ID:** T-V2-0A
**Phase:** v2.Phase 0 — Coin Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** A (no dependencies)

**Objective:**
Create `backend/src/config/coins.ts` as the single source of truth for all 11 tracked coins. Every service, cron, and controller will import from this file. Zero hardcoding anywhere else.

**File to create:**
- `backend/src/config/coins.ts`

**Design specification:**

```typescript
export const TRACKED_COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
    'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON',
] as const;

export type TrackedCoin = typeof TRACKED_COINS[number];

export const TRACKED_COIN_SET: ReadonlySet<string> = new Set(TRACKED_COINS);

export function isTrackedCoin(symbol: string): boolean {
    return TRACKED_COIN_SET.has(symbol.toUpperCase());
}

export function isMacroEvent(eventType: string): boolean {
    const MACRO_TYPES = ['Fed_Rate', 'CPI', 'Geopolitical', 'ETF', 'Regulatory'];
    return MACRO_TYPES.includes(eventType);
}
```

**Macro exception rule:** Macro news (Fed, ETF, regulation) with no specific coin mention → tag as BTC by default. The `isMacroEvent()` helper enables this check.

**Constraints:**
- `as const` for full literal type inference
- `ReadonlySet` for O(1) lookups
- Case-insensitive matching via `.toUpperCase()`
- Zero `any` types
- Zero dependencies (no imports from other project files)

**Dependencies:** None

**Rollback:** Delete `backend/src/config/coins.ts`

---

### T-V2-0B — Coin Filter: TriageEngine Gate

**Task ID:** T-V2-0B
**Phase:** v2.Phase 0 — Coin Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** B (depends on T-V2-0A)

**Objective:**
After AI triage returns `symbolMentions` in `triageEngine.cron.ts`, force `classification: 'NOISE'` for any item whose mentioned symbols are NOT in the tracked coins list. Macro events with no coin mention default to BTC.

**File to modify:**
- `backend/src/crons/triageEngine.cron.ts`

**Dependencies:** T-V2-0A (coins.ts must exist)

**Rollback:** Remove the filter block + import from triageEngine.cron.ts

---

### T-V2-0C — Coin Filter: AiWorkflow Gate

**Task ID:** T-V2-0C
**Phase:** v2.Phase 0 — Coin Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** B (depends on T-V2-0A)

**Objective:**
In `aiWorkflow.cron.ts`, after the symbol is resolved, if the symbol is NOT in the tracked coins list, skip processing entirely and mark the buffer item as consumed.

**File to modify:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Dependencies:** T-V2-0A

**Rollback:** Remove the filter block + import from aiWorkflow.cron.ts

---

### T-V2-0D — Coin Filter: TerminalEngine Gate

**Task ID:** T-V2-0D
**Phase:** v2.Phase 0 — Coin Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** B (depends on T-V2-0A)

**Objective:**
In `terminalEngine.cron.ts`, items with no mention of the 11 tracked coins in their title should never enter the `raw_news_buffer`. Keyword-based pre-filter.

**File to modify:**
- `backend/src/crons/terminalEngine.cron.ts`

**Dependencies:** T-V2-0A

**Rollback:** Remove the filter block + import from terminalEngine.cron.ts

---

### T-V2-0E — Market Filter Layer + Cron

**Task ID:** T-V2-0E
**Phase:** v2.Phase 0 — Market Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** C (depends on T-V2-0A, T-V2-0F)

**Objective:**
Create `backend/src/crons/marketFilter.cron.ts` that runs every 6 hours. For each of the 11 tracked coins, fetch 24h volume and price change from Binance. Coins failing any criteria get flagged `is_tradeable = false` in `coin_intelligence_cache`.

**Files created/modified:**
- `backend/src/crons/marketFilter.cron.ts` (new)
- `backend/scripts/migrate-market-filter.sql` (new)
- `backend/src/models/market.model.ts` (add isTradeable column)
- `backend/src/server.ts` (conditional registration)

**Criteria:**
- 24h quote volume (USDT) > $50M
- abs(priceChangePercent) <= 25% (manipulation flag)

**Dependencies:** T-V2-0A (coins.ts), T-V2-0F (env flag)

**Rollback:** Delete cron file, revert server.ts, revert Drizzle model, DROP COLUMN is_tradeable

---

### T-V2-0F — Phase 0 Env Flags + Server Registration

**Task ID:** T-V2-0F
**Phase:** v2.Phase 0 — Coin Filter + Market Filter
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** A (no dependencies)

**Objective:**
Add env flag `MARKET_FILTER_ENABLED` to `env.ts`. Default `false`.

**Dependencies:** None

---

### T-V2-01A — OHLCV Database Schema (Migration + Drizzle Model)

**Task ID:** T-V2-01A
**Phase:** v2.Phase 0.1 — OHLCV Data Infrastructure
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** D (depends on T-V2-01E)

**Objective:**
Create `ohlcv_candles` and `ohlcv_indicators` tables via SQL migration and Drizzle ORM model.

**Files created/modified:**
- `backend/scripts/migrate-ohlcv.sql` (new)
- `backend/src/models/market.model.ts` (add 2 new tables)

**Dependencies:** T-V2-01E (env flags)

---

### T-V2-01B — OHLCV Snapshot Service

**Task ID:** T-V2-01B
**Phase:** v2.Phase 0.1 — OHLCV Data Infrastructure
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** E (depends on T-V2-01A)

**Objective:**
Create `backend/src/services/ohlcvSnapshot.service.ts` — the core service for fetching candle data from Binance, storing it in `ohlcv_candles`, computing EMA/ATR indicators, and storing them in `ohlcv_indicators`.

**Exported functions:**
1. `fetchAndStoreCandles(symbol, timeframe, limit)` — fetch latest candles, batch upsert
2. `backfillHistoricalCandles(symbol, timeframe, daysBack)` — paginated historical fetch, batch upsert
3. `computeIndicators(symbol, timeframe)` — reads candles, computes EMA/ATR/SMA, batch upsert indicators
4. `getCandles(symbol, timeframe, limit)` — query helper
5. `getLatestIndicator(symbol, timeframe)` — query helper
6. `getIndicatorAtTime(symbol, timeframe, timestamp)` — query helper

**Dependencies:** T-V2-01A (DB schema must exist)

---

### T-V2-01C — OHLCV Snapshot Cron

**Task ID:** T-V2-01C
**Phase:** v2.Phase 0.1 — OHLCV Data Infrastructure
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** E (depends on T-V2-01B)

**Objective:**
Create `backend/src/crons/ohlcvSnapshot.cron.ts` — runs every 4 hours, fetches latest candles for all 11 coins across 3 timeframes, computes indicators.

**File created:**
- `backend/src/crons/ohlcvSnapshot.cron.ts`

**Dependencies:** T-V2-01B (snapshot service)

---

### T-V2-01D — Historical Backfill Script

**Task ID:** T-V2-01D
**Phase:** v2.Phase 0.1 — OHLCV Data Infrastructure
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** F (depends on T-V2-01B)

**Objective:**
Create `backend/scripts/backfill-ohlcv.ts` — a one-time manual script to fetch 90 days of historical candle data for all 11 coins across 3 timeframes.

**File created:**
- `backend/scripts/backfill-ohlcv.ts`

**Backfill config:** 4h: 90 days, 1d: 180 days, 1w: 365 days

**Dependencies:** T-V2-01B (snapshot service with backfillHistoricalCandles)

---

### T-V2-01E — Phase 0.1 Env Flags

**Task ID:** T-V2-01E
**Phase:** v2.Phase 0.1 — OHLCV Data Infrastructure
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** A (no dependencies)

**Objective:**
Add 2 env flags to `env.ts`: `OHLCV_SNAPSHOT_ENABLED`, `BACKFILL_OHLCV_ENABLED`. Both default `false`.

**Dependencies:** None

---

### T-V2-0Q — QA Verification (Phase 0 + Phase 0.1)

**Task ID:** T-V2-0Q
**Phase:** v2.Phase 0 + v2.Phase 0.1
**Assigned Agent:** QA & Security Hunter
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** G (depends on ALL above tasks)

**Result:** 3 audit rounds. 2 critical bugs found and fixed (Binance URL typo, N+1 DB performance). Final pass clean.

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/src/config/coins.ts` | ✅ DONE | Coin constants (T-V2-0A) |
| `backend/src/crons/triageEngine.cron.ts` | ✅ DONE | Coin filter (T-V2-0B) |
| `backend/src/crons/aiWorkflow.cron.ts` | ✅ DONE | Coin filter (T-V2-0C) |
| `backend/src/crons/terminalEngine.cron.ts` | ✅ DONE | Coin filter (T-V2-0D) |
| `backend/src/crons/marketFilter.cron.ts` | ✅ DONE | Market health check (T-V2-0E) |
| `backend/scripts/migrate-market-filter.sql` | ✅ DONE | is_tradeable migration (T-V2-0E) |
| `backend/src/models/market.model.ts` | ✅ DONE | is_tradeable + ohlcv tables (T-V2-01A) |
| `backend/scripts/migrate-ohlcv.sql` | ✅ DONE | OHLCV tables migration (T-V2-01A) |
| `backend/src/services/ohlcvSnapshot.service.ts` | ✅ DONE | OHLCV fetch+compute (T-V2-01B) |
| `backend/src/crons/ohlcvSnapshot.cron.ts` | ✅ DONE | OHLCV refresh cron (T-V2-01C) |
| `backend/scripts/backfill-ohlcv.ts` | ✅ DONE | Historical backfill (T-V2-01D) |
| `backend/src/config/env.ts` | ✅ DONE | 3 new flags (T-V2-0F + T-V2-01E) |
| `backend/src/server.ts` | ✅ DONE | Register 2 new crons (T-V2-0E + T-V2-01C) |

**Total: 4 new files, 5 modified files, 3 new scripts/migrations**

---

*Plan authored: May 7, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md (v2.1 — APPROVED)*
*Tranche 1 Phase 0 + 0.1: ✅ COMPLETE*

---
---

# Master Plan v2.1 — v2.Phase 1: Technical Analysis Engine

**Status:** ✅ COMPLETE — All 9 tasks done, QA PASSED (Round 3)
**Date:** May 8, 2026
**Priority:** P0 (Blocks v2.Phase 1.5 Backtesting → blocks v2.Phase 0.5 Shadow Mode → blocks Tranche 2+3)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md` (lines 271-338)
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

## PHASE SCOPE

| Sub-Engine | Spec Ref | Description | Tasks | Status |
|---|---|---|---|---|
| 1.0 | Foundation | Types, Interfaces, Helpers | T-V2-1A | ✅ DONE |
| 1.1 | Trend Detection | EMA Trend Calculator (5 states) | T-V2-1B | ✅ DONE |
| 1.2 | Support/Resistance | S/R Engine with Strength Scoring | T-V2-1C | ✅ DONE |
| 1.3 | Market Structure | BOS, CHOCH, Failed BOS detection | T-V2-1D | ✅ DONE |
| 1.4 | Candle Patterns | Pattern Recognition with 3-condition gate | T-V2-1E | ✅ DONE |
| 1.5 + 1.7 | Scoring | Volume Confirmation + Quality Score | T-V2-1F | ✅ DONE |
| Orchestrator | Main Entry | Full `analyzeTechnicals()` rewrite | T-V2-1G | ✅ DONE |
| Health Monitor | Starvation | Signal starvation detection + reduced confidence | T-V2-1H | ✅ DONE |
| QA | Verification | Full audit of all sub-engines | T-V2-1Q | ✅ DONE (QA PASSED) |

## GUARDRAILS (Apply to ALL v2.Phase 1 tasks)

1. **Zero `any` types** — strict TypeScript, use `unknown` or specific interfaces.
2. **Zero BUY/SELL terminology** — all labels: STRONG_BULLISH / BULLISH / SIDEWAYS / BEARISH / STRONG_BEARISH.
3. **Zero live Binance calls during signal generation** — ALL data reads from `ohlcv_candles` + `ohlcv_indicators` (pre-computed).
4. **Zero AI involvement** — this is pure algorithm. No `AIGateway`, no `PromptFactory`.
5. **Single file output** — all code goes into `backend/src/services/technicalAnalysis.service.ts`. No new service files.
6. **No new DB tables** — this phase only READS from existing `ohlcv_candles` and `ohlcv_indicators`.
7. **No modifications to existing crons** — no cron changes in Phase 1 (starvation monitor wired later).
8. **No modifications to routes/controllers** — purely a backend service layer.
9. **Backward compatible** — existing `analyzeTechnicals()` export signature changes internally but remains the primary entry point. Add new exports alongside it — never break imports.
10. **All existing functions in the skeleton may be REPLACED** — the current `technicalAnalysis.service.ts` is a placeholder skeleton. Full rewrite is authorized.
11. **No new npm packages**.
12. **Commit only after QA PASS** — each task or deploy group individually.

## PHASE ARCHITECTURE CONTEXT

**What exists today (skeleton — authorized for full rewrite):**
- `backend/src/services/technicalAnalysis.service.ts` — 255 lines, naive implementations
  - `CandleData`, `SupportResistance`, `MarketStructure`, `CandlePattern`, `VolumeAnalysis`, `QualityScore`, `TechnicalAnalysisResult` interfaces
  - `calculateEMA()` — basic EMA (will be removed, reads from indicators instead)
  - `detectSupportResistance()` — naive (sorts lows/highs, no swing detection)
  - `analyzeMarketStructure()` — naive (only checks last 3 candles for HH/HL)
  - `detectCandlePattern()` — basic (doji, hammer, engulfing only, no S/R confirmation)
  - `analyzeVolume()` — basic (current vs 20-candle avg, reads raw candles not indicators)
  - `calculateQualityScore()` — naive (4-component average, no penalty modifiers)
  - `analyzeTechnicals(symbol, timeframe)` — main export (will be rewritten)

**Data sources available (from v2.Phase 0.1):**
- `ohlcv_candles` table — columns: coinSymbol, timeframe, openTime, open, high, low, close, volume, closeTime
- `ohlcv_indicators` table — columns: coinSymbol, timeframe, openTime, ema20, ema50, ema200, atr14, volumeAvg20, computedAt
- Query helpers from `ohlcvSnapshot.service.ts`:
  - `getCandles(symbol, timeframe, limit)` → `ohlcvCandles.$inferSelect[]` (DESC by openTime)
  - `getLatestIndicator(symbol, timeframe)` → `ohlcvIndicators.$inferSelect | null`
  - `getIndicatorAtTime(symbol, timeframe, timestamp)` → `ohlcvIndicators.$inferSelect | null`

**Critical architecture rule from v2.1 spec (line 603):**
> "All TA calculations read from ohlcv_indicators — never compute at signal-generation time"
> "ATR always uses period 14 with Wilder's smoothing"

**Key spec clarifications:**
- EMA-20 and EMA-50: read from 4H timeframe indicators (`timeframe='4h'`)
- EMA-200: read from Daily timeframe indicators (`timeframe='1d'`)
- ATR-14 for TP/SL: read from Daily timeframe indicators
- ATR-14 for entry zones: read from 4H timeframe indicators
- volumeAvg20: read from 4H timeframe indicators
- S/R analysis window: last 200 4H candles (~33 days)
- Structure analysis window: last 100 4H candles (~16 days)
- If EMA-200 is null (insufficient Daily history): fall back to EMA-20/50 only
- If EMA-50 is also null: return SIDEWAYS. **Never guess.**

---

## REQUIRED TASKS

### T-V2-1A — Types, Interfaces & Helper Functions

**Task ID:** T-V2-1A
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** A (no dependencies)

**Objective:**
Replace the existing skeleton interfaces in `technicalAnalysis.service.ts` with production-grade types matching the v2.1 spec. Define all TypeScript interfaces, enums, and helper functions that every sub-engine depends on.

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts` (full rewrite — replace all existing interfaces)

**Design specification — Interfaces to export:**

```typescript
// ─── Trend Label Enum ─────────────────────────────────────
export type TrendLabel = 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH';

// ─── Support / Resistance Level ───────────────────────────
export interface SRLevel {
    price: number;
    type: 'support' | 'resistance';
    strengthScore: number;        // 0-100, only >= 60 used for TP/SL
    touchCount: number;           // number of price reactions
    volumeAtLevel: number;        // avg volume when price was near this level
    rejectionStrength: number;    // avg wick size as % of candle range
    lastTouchedAt: Date;
}

// ─── Market Structure Result ──────────────────────────────
export type StructurePattern = 'HH_HL' | 'LH_LL' | 'BOS_BULLISH' | 'BOS_BEARISH' | 'CHOCH_BULLISH' | 'CHOCH_BEARISH' | 'FAILED_BOS' | 'NONE';

export interface MarketStructureResult {
    pattern: StructurePattern;
    trend: 'bullish' | 'bearish' | 'sideways';
    isChocho: boolean;             // CHOCH detected → -20 penalty
    isFailedBos: boolean;          // Failed BOS → no signal
    lastSwingHigh: number | null;
    lastSwingLow: number | null;
}

// ─── Candle Pattern Result ────────────────────────────────
export type RecognizedPattern = 'hammer' | 'shooting_star' | 'bullish_engulfing' | 'bearish_engulfing' | 'morning_star' | 'evening_star';

export interface CandlePatternResult {
    pattern: RecognizedPattern | null;
    direction: 'bullish' | 'bearish' | null;  // direction the pattern suggests
    volumeConfirmed: boolean;     // volume > volumeAvg20
    srAligned: boolean;           // pattern forms at S/R level
    isValid: boolean;             // all 3 conditions must be true
}

// ─── Volume Confirmation Result ───────────────────────────
export interface VolumeConfirmationResult {
    currentVolume: number;
    avgVolume: number;
    volumeRatio: number;          // current / avg
    isAboveAverage: boolean;      // > 20% above avg
    isSpike: boolean;             // > 2x average
    isLowVolume: boolean;         // movement without volume → reject
    scoreModifier: number;        // +15, +25, or 0 (and -15 penalty flag)
}

// ─── Quality Score Result ─────────────────────────────────
export interface QualityScoreResult {
    score: number;                // 0-100, signal only proceeds if >= 60
    trendConfirmed: boolean;      // +25 if true
    nearSR: boolean;              // +25 if true
    volumeConfirmed: boolean;     // +25 if true
    patternAtSR: boolean;         // +25 if true
    chochPenalty: number;         // -20 if CHOCH detected
    lowVolumePenalty: number;     // -15 if low volume movement
    manipulationPenalty: number;  // -20 if price > 25% move in 24h
    isRejected: boolean;          // true if score < 60
    rejectionReason: string | null;
}

// ─── Technical Analysis Full Result ───────────────────────
export interface TechnicalAnalysisFullResult {
    symbol: string;
    timestamp: Date;
    trend: TrendLabel;
    supportLevels: SRLevel[];     // sorted by strength DESC, only strength >= 60
    resistanceLevels: SRLevel[];  // sorted by strength DESC, only strength >= 60
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
    structure: MarketStructureResult;
    candlePattern: CandlePatternResult;
    volume: VolumeConfirmationResult;
    qualityScore: QualityScoreResult;
    atrDaily: number | null;      // ATR-14 from Daily indicators (for TP/SL)
    atr4h: number | null;         // ATR-14 from 4H indicators (for entry zones)
}

// ─── Signal Health Result ─────────────────────────────────
export interface SignalHealthResult {
    signalCount48h: number;
    status: 'healthy' | 'caution' | 'starvation';
    message: string;
    reducedConfidenceMode: boolean;
}
```

**Design specification — Helper functions to export:**

```typescript
// Price distance percentage helper
export function priceDistancePercent(price: number, level: number): number;

// Check if price is within X% of a level
export function isNearLevel(price: number, level: number, thresholdPercent: number): boolean;
```

**Constraints:**
- All interfaces must have zero `any` types
- All date fields use `Date` type, not `string` or `number`
- `TrendLabel` uses the exact 5 states from the spec — no additional states
- The existing `analyzeTechnicals` export signature may change, but a compatibility adapter must remain

**Dependencies:** None (first task)

**Rollback:** Git revert

---

### T-V2-1B — EMA Trend Calculator (Sub-engine 1.1)

**Task ID:** T-V2-1B
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** B (depends on T-V2-1A)

**Objective:**
Implement `detectTrend()` — reads pre-computed EMA values from `ohlcv_indicators` and classifies the current trend into one of 5 states. Zero recalculation at runtime.

**Spec reference:** nextstep2-v2.md lines 276-283

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function detectTrend(symbol: string): Promise<TrendLabel>
```

**Data source:**
- EMA-20: `getLatestIndicator(symbol, '4h')` → `.ema20`
- EMA-50: `getLatestIndicator(symbol, '4h')` → `.ema50`
- EMA-200: `getLatestIndicator(symbol, '1d')` → `.ema200`

**Algorithm (exact from spec):**

```
IF EMA-200 is null:
    IF EMA-50 is null OR EMA-20 is null:
        RETURN SIDEWAYS
    ELSE:
        // Fall back to EMA-20/50 only
        IF price > EMA-20 > EMA-50:
            RETURN BULLISH
        ELSE IF price < EMA-20 < EMA-50:
            RETURN BEARISH
        ELSE:
            RETURN SIDEWAYS

ELSE (EMA-200 exists):
    IF price > EMA-20 > EMA-50 > EMA-200:
        RETURN STRONG_BULLISH
    ELSE IF price > EMA-50 AND EMA-20 > EMA-50:
        RETURN BULLISH
    ELSE IF all EMAs within 1% of each other (intertwined):
        RETURN SIDEWAYS
    ELSE IF price < EMA-50 AND EMA-20 < EMA-50:
        RETURN BEARISH
    ELSE IF price < EMA-20 < EMA-50 < EMA-200:
        RETURN STRONG_BEARISH
    ELSE:
        RETURN SIDEWAYS
```

**"Price" for comparison:** Use the latest 4H candle close price. Fetch via `getCandles(symbol, '4h', 1)` → `[0].close`.

**"EMAs within 1%" check:** `max(ema20, ema50, ema200) - min(ema20, ema50, ema200) <= 0.01 * max(ema20, ema50, ema200)` — only when all 3 exist.

**Error handling:**
- If `getLatestIndicator` returns null for 4H: return SIDEWAYS with error log
- If `getLatestIndicator` returns null for Daily EMA-200: fall back as specified above
- Never throw — always return a TrendLabel

**Dependencies:** T-V2-1A (TrendLabel type)

**Rollback:** Git revert

---

### T-V2-1C — Support & Resistance Engine (Sub-engine 1.2)

**Task ID:** T-V2-1C
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** C (depends on T-V2-1A)

**Objective:**
Implement `detectSupportResistance()` — analyzes last 200 4H candles from `ohlcv_candles` to identify swing lows (support), swing highs (resistance), reaction zones, and rejection zones. Each level gets a strength score (0-100). Only levels with strength >= 60 are returned.

**Spec reference:** nextstep2-v2.md lines 285-301

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function detectSupportResistance(symbol: string): Promise<{
    supportLevels: SRLevel[];
    resistanceLevels: SRLevel[];
}>
```

**Data source:**
- `getCandles(symbol, '4h', 200)` — last 200 4H candles from `ohlcv_candles`
  - NOTE: `getCandles` returns DESC by openTime. Reverse to ASC before processing.

**Algorithm — Step 1: Swing Point Detection**

For each candle at index `i` (where `i >= 2` and `i <= candles.length - 3`):
- **Swing Low:** `candles[i].low < candles[i-1].low AND candles[i].low < candles[i+1].low AND candles[i].low < candles[i-2].low AND candles[i].low < candles[i+2].low`
- **Swing High:** `candles[i].high > candles[i-1].high AND candles[i].high > candles[i+1].high AND candles[i].high > candles[i-2].high AND candles[i].high > candles[i+2].high`

**Algorithm — Step 2: Reaction Zone Clustering**

Group swing points that are within 1.5% of each other into a single level:
- Use the average price of the cluster as the level price
- Sum the touch counts
- Average the volumes

**Algorithm — Step 3: Level Strength Score**

For each clustered level, compute:

| Factor | Weight | Calculation |
|---|---|---|
| Number of touches | 30% | `min(touchCount / 5, 1) * 100` — capped at 5 touches |
| Volume at level | 30% | `min(avgVolumeAtLevel / overallAvgVolume, 1.5) / 1.5 * 100` |
| Rejection strength | 20% | Average wick-to-body ratio at level as percentage (0-100) |
| Timeframe weight | 10% | All from 4H → always 100 (fixed for now) |
| Recency | 10% | `100 - (daysSinceLastTouch / 30 * 100)`, min 0 |

**Rejection strength calculation:**
For each candle near the level (within 0.5%):
- For resistance: `upperWick / candleRange` where `upperWick = high - max(open, close)` and `range = high - low`
- For support: `lowerWick / candleRange` where `lowerWick = min(open, close) - low`
- Average all rejection strengths at the level

**Algorithm — Step 4: Filter**
- Only return levels where `strengthScore >= 60`
- Sort by `strengthScore` DESC
- Limit to top 5 per side (support, resistance)

**Constraints:**
- Zero live API calls — all data from `ohlcv_candles`
- Handle edge case: less than 5 candles → return empty arrays
- Handle edge case: no swing points found → return empty arrays

**Dependencies:** T-V2-1A (SRLevel interface)

**Rollback:** Git revert

---

### T-V2-1D — Market Structure Engine (Sub-engine 1.3)

**Task ID:** T-V2-1D
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** C (depends on T-V2-1A — parallel with T-V2-1C)

**Objective:**
Implement `analyzeMarketStructure()` — reads the last 100 4H candles to detect Higher Highs + Higher Lows (uptrend), Lower Highs + Lower Lows (downtrend), Break of Structure (BOS), Change of Character (CHOCH), and Failed BOS.

**Spec reference:** nextstep2-v2.md lines 303-307

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function analyzeMarketStructure(symbol: string): Promise<MarketStructureResult>
```

**Data source:**
- `getCandles(symbol, '4h', 100)` — last 100 4H candles, reversed to ASC order

**Algorithm — Step 1: Identify Swing Points (reuse logic from T-V2-1C but within 100-candle window)**

Same swing detection as T-V2-1C but over the 100-candle window:
- Swing Highs and Swing Lows identified with 2-candle lookback/lookahead

**Algorithm — Step 2: Determine Structure Pattern**

```
swings = ordered list of { type: 'high'|'low', price, index }

// Find last 3+ swing points to determine pattern
recentSwings = last 6 swing points (or all if < 6)

// Extract swing highs and swing lows separately
swingHighs = recentSwings.filter(s => s.type === 'high')
swingLows = recentSwings.filter(s => s.type === 'low')

// Check for Higher Highs + Higher Lows (uptrend)
hh_hl = swingHighs have ascending prices AND swingLows have ascending prices
  → at least 2 swing highs and 2 swing lows needed

// Check for Lower Highs + Lower Lows (downtrend)
lh_ll = swingHighs have descending prices AND swingLows have descending prices
  → at least 2 swing highs and 2 swing lows needed

// Break of Structure (BOS) — trend continuation
// BOS Bullish: price breaks above the most recent swing high while in uptrend
bos_bullish = last swing high was broken (current price > lastSwingHigh.price) AND hh_hl is true

// BOS Bearish: price breaks below the most recent swing low while in downtrend
bos_bearish = last swing low was broken (current price < lastSwingLow.price) AND lh_ll is true

// Change of Character (CHOCH) — potential reversal
// CHOCH Bullish: price breaks above swing high BUT was in downtrend (reversal)
choch_bullish = current price > lastSwingHigh.price AND lh_ll was true (downtrend broken)

// CHOCH Bearish: price breaks below swing low BUT was in uptrend (reversal)
choch_bearish = current price < lastSwingLow.price AND hh_hl was true (uptrend broken)

// Failed BOS: price broke structure but immediately returned (within 3 candles)
// Check if the last 3 candles show the break was rejected
failed_bos = BOS detected BUT price returned below/above the broken level within 3 candles
```

**Priority of pattern detection (check in order, return first match):**
1. FAILED_BOS (most urgent — no signal)
2. CHOCH_BULLISH or CHOCH_BEARISH (reversal — -20 penalty)
3. BOS_BULLISH or BOS_BEARISH (trend continuation)
4. HH_HL or LH_LL (confirmed structure)
5. NONE (no clear structure)

**Algorithm — Step 3: Determine trend**
- HH_HL, BOS_BULLISH, CHOCH_BULLISH → trend = 'bullish'
- LH_LL, BOS_BEARISH, CHOCH_BEARISH → trend = 'bearish'
- FAILED_BOS, NONE → trend = 'sideways'

**Return:**
```typescript
{
    pattern: detected pattern,
    trend: bullish | bearish | sideways,
    isChocho: true if CHOCH pattern,
    isFailedBos: true if FAILED_BOS pattern,
    lastSwingHigh: price of most recent swing high (null if none),
    lastSwingLow: price of most recent swing low (null if none),
}
```

**Error handling:**
- Less than 5 candles → return `{ pattern: 'NONE', trend: 'sideways', isChocho: false, isFailedBos: false, lastSwingHigh: null, lastSwingLow: null }`
- Less than 2 swing points on each side → same default

**Dependencies:** T-V2-1A (MarketStructureResult, StructurePattern types)

**Rollback:** Git revert

---

### T-V2-1E — Candle Pattern Recognition (Sub-engine 1.4)

**Task ID:** T-V2-1E
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** D (depends on T-V2-1A, T-V2-1C)

**Objective:**
Implement `detectCandlePattern()` — recognizes 6 candlestick patterns (Hammer, Shooting Star, Bullish Engulfing, Bearish Engulfing, Morning Star, Evening Star). **Pattern is ONLY valid if all 3 conditions are met:** pattern present, volume confirmed, S/R alignment.

**Spec reference:** nextstep2-v2.md lines 309-312

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function detectCandlePattern(
    symbol: string,
    supportLevels: SRLevel[],
    resistanceLevels: SRLevel[]
): Promise<CandlePatternResult>
```

**Data sources:**
- `getCandles(symbol, '4h', 5)` — last 5 candles (need current + previous for engulfing/star patterns)
- `getLatestIndicator(symbol, '4h')` — for `volumeAvg20`

**Pattern Definitions (strict thresholds):**

| Pattern | Direction | Body Rule | Wick Rule | Context |
|---|---|---|---|---|
| Hammer | bullish | Small body (body < 30% of range) | Lower wick >= 2x body | At/near support |
| Shooting Star | bearish | Small body (body < 30% of range) | Upper wick >= 2x body | At/near resistance |
| Bullish Engulfing | bullish | Current candle body fully engulfs previous | N/A | Previous was bearish (close < open) |
| Bearish Engulfing | bearish | Current candle body fully engulfs previous | N/A | Previous was bullish (close > open) |
| Morning Star | bullish | 3-candle: bearish → small body → bullish | N/A | Third candle body >= 50% of first candle body |
| Evening Star | bearish | 3-candle: bullish → small body → bearish | N/A | Third candle body >= 50% of first candle body |

**3-Condition Gate (ALL must be true for isValid):**

1. **Pattern present:** One of the 6 patterns detected (above definitions)
2. **Volume confirmed:** Current candle volume > `volumeAvg20` from `ohlcv_indicators`
3. **S/R alignment:**
   - Bullish patterns (Hammer, Bullish Engulfing, Morning Star): pattern forms within 2% of a support level
   - Bearish patterns (Shooting Star, Bearish Engulfing, Evening Star): pattern forms within 2% of a resistance level
   - Use `isNearLevel()` helper from T-V2-1A with threshold = 2

**Return:**
```typescript
{
    pattern: RecognizedPattern | null,    // null if no pattern detected
    direction: 'bullish' | 'bearish' | null,
    volumeConfirmed: boolean,
    srAligned: boolean,
    isValid: false  // ALWAYS false if any condition fails
}
```

**Critical rule:** If `volumeConfirmed` is false OR `srAligned` is false → `isValid = false`. Pattern is ignored entirely. This means `isValid = false AND pattern = 'hammer'` is possible (pattern found but not confirmed).

**Dependencies:** T-V2-1A (CandlePatternResult, RecognizedPattern, SRLevel, isNearLevel), T-V2-1C (SRLevel data from detectSupportResistance)

**Rollback:** Git revert

---

### T-V2-1F — Volume Confirmation + Signal Quality Score (Sub-engines 1.5 + 1.7)

**Task ID:** T-V2-1F
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** E (depends on T-V2-1A)

**Objective:**
Implement two functions: `analyzeVolumeConfirmation()` and `calculateQualityScore()`. Volume uses pre-computed indicators. Quality Score combines all sub-engine outputs into a final 0-100 score with penalty modifiers.

**Spec reference:** nextstep2-v2.md lines 314-337

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function 1 signature:**
```typescript
export async function analyzeVolumeConfirmation(symbol: string): Promise<VolumeConfirmationResult>
```

**Function 1 data source:**
- `getCandles(symbol, '4h', 1)` → latest candle `.volume`
- `getLatestIndicator(symbol, '4h')` → `.volumeAvg20`

**Function 1 algorithm:**
```
currentVolume = latest candle volume
avgVolume = volumeAvg20 from indicators (or 0 if null)

IF avgVolume === 0:
    RETURN { currentVolume, avgVolume: 0, ratio: 0, above: false, spike: false, low: true, modifier: 0 }

ratio = currentVolume / avgVolume
isAboveAverage = ratio > 1.2        // > 20% above
isSpike = ratio > 2.0               // > 2x average
isLowVolume = ratio < 0.5           // < 50% of average

scoreModifier:
  IF isSpike: +25
  ELSE IF isAboveAverage: +15
  ELSE: 0
```

**Function 2 signature:**
```typescript
export function calculateQualityScore(params: {
    trend: TrendLabel;
    currentPrice: number;
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
    volumeConfirmed: boolean;
    volumeSpike: boolean;
    patternAtSR: boolean;
    isChocho: boolean;
    isFailedBos: boolean;
    priceChange24h: number | null;    // from Binance or market filter, null if unavailable
}): QualityScoreResult
```

**Function 2 algorithm (exact from spec):**

```
// Base scoring (4 factors, each +25 if true)
trendConfirmed = true if trend is BULLISH/STRONG_BULLISH (for bullish signal) or BEARISH/STRONG_BEARISH (for bearish signal)
  → For now: any non-SIDEWAYS trend counts as confirmed → +25
nearSR = nearestSupport or nearestResistance exists AND isNearLevel(currentPrice, level.price, 2)
  → +25 if true
volumeConfirmed = volumeConfirmed param (from T-V2-1F Function 1 result) → +25 if true
patternAtSR = patternAtSR param (from T-V2-1E isValid) → +25 if true

baseScore = 0
IF trendConfirmed: baseScore += 25
IF nearSR: baseScore += 25
IF volumeConfirmed: baseScore += 25
IF patternAtSR: baseScore += 25

// Bonus from volume spike
IF volumeSpike: baseScore += 10  // bonus on top of volumeConfirmed +25

// Penalty modifiers
chochPenalty = isChocho ? -20 : 0
lowVolumePenalty = (NOT volumeConfirmed AND NOT volumeSpike) ? -15 : 0
manipulationPenalty = (priceChange24h !== null AND abs(priceChange24h) > 25) ? -20 : 0

finalScore = clamp(baseScore + chochPenalty + lowVolumePenalty + manipulationPenalty, 0, 100)

isRejected = finalScore < 60
rejectionReason:
  IF isFailedBos: "Failed Break of Structure — no signal"
  ELSE IF finalScore < 60: "Quality score {finalScore} below threshold 60"
  ELSE: null
```

**Note:** `isFailedBos` is a hard rejection outside of score — if `isFailedBos` is true, the signal should be rejected regardless of score. The `calculateQualityScore` function reports this via `rejectionReason` but does NOT auto-reject (the caller decides).

**Dependencies:** T-V2-1A (QualityScoreResult, VolumeConfirmationResult, TrendLabel, SRLevel, isNearLevel)

**Rollback:** Git revert

---

### T-V2-1G — Main Orchestrator (Full analyzeTechnicals Rewrite)

**Task ID:** T-V2-1G
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** F (depends on T-V2-1B, T-V2-1C, T-V2-1D, T-V2-1E, T-V2-1F)

**Objective:**
Rewrite the main `analyzeTechnicals()` function to orchestrate all sub-engines (Trend, S/R, Structure, Pattern, Volume, Quality Score) into a single comprehensive result. This is the primary entry point that all downstream phases (1.5 backtesting, 4 TP/SL, 0.5 shadow mode) will call.

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function analyzeTechnicals(symbol: string): Promise<TechnicalAnalysisFullResult | null>
```

**Orchestration flow:**

```
1. Validate symbol is tracked (isTrackedCoin)
   → if not: return null

2. Fetch current price
   → getCandles(symbol, '4h', 1) → latest 4H candle close

3. Fetch ATR values
   → getLatestIndicator(symbol, '1d') → atrDaily
   → getLatestIndicator(symbol, '4h') → atr4h

4. Run all sub-engines (can run trend + structure + volume in parallel):
   → detectTrend(symbol) → TrendLabel
   → detectSupportResistance(symbol) → { supportLevels, resistanceLevels }
   → analyzeMarketStructure(symbol) → MarketStructureResult
   → detectCandlePattern(symbol, supportLevels, resistanceLevels) → CandlePatternResult
   → analyzeVolumeConfirmation(symbol) → VolumeConfirmationResult

5. Determine nearest S/R
   → nearestSupport = support level closest to currentPrice (above = null if no support below)
   → nearestResistance = resistance level closest to currentPrice (below = null if no resistance above)
   → Use absolute price distance, pick minimum

6. Calculate quality score
   → calculateQualityScore({
       trend,
       currentPrice,
       nearestSupport,
       nearestResistance,
       volumeConfirmed: volumeResult.isAboveAverage,
       volumeSpike: volumeResult.isSpike,
       patternAtSR: candlePatternResult.isValid,
       isChocho: structure.isChocho,
       isFailedBos: structure.isFailedBos,
       priceChange24h: null  // not available from indicators alone, set null for now
     })

7. Assemble full result
   → Return TechnicalAnalysisFullResult
```

**Error handling:**
- Any sub-engine failure → log error, set that component to its "empty" default, continue
- If ALL sub-engines fail → return null
- Never throw from this function — it's the top-level entry point

**Backward compatibility:**
- The old `TechnicalAnalysisResult` interface and its field names are REPLACED by `TechnicalAnalysisFullResult`
- The old `analyzeTechnicals(symbol, timeframe)` 2-arg signature is REMOVED — the new function takes only `symbol`
- Any existing imports of the old interface should be updated (search codebase for imports)
- The `CandleData` interface used internally by the old skeleton is kept only if sub-engines need it internally

**Dependencies:** ALL previous tasks (T-V2-1A through T-V2-1F)

**Rollback:** Git revert

---

### T-V2-1H — Signal Starvation Monitor

**Task ID:** T-V2-1H
**Phase:** v2.Phase 1 — Technical Analysis Engine (built here, wired in Phase 5)
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** F (depends on T-V2-1A, parallel with T-V2-1G)

**Objective:**
Implement `checkSignalHealth()` — a standalone exported function that counts signals generated in the last 48 hours and reports health status. This function is called by `tpslMonitor.cron` in Phase 5, but the logic is built here as part of Phase 1.

**Spec reference:** nextstep2-v2.md lines 449-463

**File to modify:**
- `backend/src/services/technicalAnalysis.service.ts`

**Function signature:**
```typescript
export async function checkSignalHealth(): Promise<SignalHealthResult>
```

**Data source:**
- Query `radar_signals` table: `SELECT COUNT(*) WHERE created_at > NOW() - INTERVAL '48 hours'`
- Use Drizzle ORM via `db.select(...).from(radarSignals).where(gt(radarSignals.createdAt, ...))`

**Algorithm:**
```
signalCount48h = count of radar_signals in last 48 hours

IF signalCount48h === 0:
    status = 'starvation'
    message = '[SIGNAL-HEALTH] WARNING: Zero signals in 48h. Check market conditions and filter gates.'
    reducedConfidenceMode = true

ELSE IF signalCount48h < 3:
    status = 'caution'
    message = `[SIGNAL-HEALTH] CAUTION: Low signal rate (${signalCount48h} in 48h).`
    reducedConfidenceMode = false

ELSE:
    status = 'healthy'
    message = `[SIGNAL-HEALTH] OK: ${signalCount48h} signals in 48h.`
    reducedConfidenceMode = false
```

**Important:** This function only RETURNS the health status. It does NOT modify any behavior. The caller (tpslMonitor.cron in Phase 5) will decide what to do with the result. The `reducedConfidenceMode` flag is informational — the actual threshold change happens in the calling cron.

**Dependencies:** T-V2-1A (SignalHealthResult interface)

**Rollback:** Git revert

---

### T-V2-1Q — QA Verification (v2.Phase 1)

**Task ID:** T-V2-1Q
**Phase:** v2.Phase 1 — Technical Analysis Engine
**Assigned Agent:** QA & Security Hunter
**Status:** ✅ DONE (QA PASSED)
**Deploy Group:** G (depends on ALL above tasks)

**Objective:**
Full audit of the rewritten `technicalAnalysis.service.ts` — verify correctness, security, performance, and spec compliance.

**Audit checklist:**
1. **Zero `any` types** — grep entire file for `any`
2. **Zero BUY/SELL terminology** — grep for `buy`, `sell`, `BUY`, `SELL`
3. **Zero live Binance calls** — verify no imports from `binance.service.ts` (only `ohlcvSnapshot.service.ts`)
4. **Zero AI calls** — verify no imports from `aiGateway`, `promptFactory`, `openai.service`
5. **All data reads from ohlcv_indicators** — verify EMA/ATR/volumeAvg read from indicators, not computed
6. **EMA-200 null fallback** — verify SIDEWAYS returned when EMA-200 unavailable
7. **S/R strength >= 60 filter** — verify only strong levels returned
8. **3-condition pattern gate** — verify pattern isValid requires all 3 conditions
9. **Quality score penalties** — verify CHOCH (-20), low volume (-15), manipulation (-20)
10. **Score < 60 rejection** — verify isRejected flag set correctly
11. **Candle ordering** — verify `getCandles` DESC output is reversed to ASC before swing detection
12. **Edge cases** — insufficient candles (< 5 for structure, < 10 for S/R), null indicators
13. **Export completeness** — verify all interfaces and functions listed in tasks are properly exported
14. **Type safety** — no type assertions (`as`), no `!` non-null assertions on potentially null values
15. **Performance** — no N+1 DB queries, no unnecessary data fetching

**Result:** PASS or REJECT with specific line-by-line corrections.

**Dependencies:** ALL Phase 1 tasks (T-V2-1A through T-V2-1H)

---

## EXECUTION GROUPS (Dependency Order)

```
Group A: T-V2-1A (types/interfaces — foundation)
    ↓
Group B: T-V2-1B (trend detector — depends on types)
    ↓
Group C: T-V2-1C + T-V2-1D (S/R + Structure — parallel, both depend on types only)
    ↓
Group D: T-V2-1E (candle patterns — depends on types + S/R levels)
    ↓
Group E: T-V2-1F (volume + quality score — depends on types)
    ↓
Group F: T-V2-1G + T-V2-1H (orchestrator + starvation monitor — parallel)
    ↓
Group G: T-V2-1Q (QA — depends on ALL)
```

**Minimum sequential steps:** 7 ( Groups A→B→C→D→E→F→G )

---

## FILES SUMMARY (Phase 1)

| File | Status | Change |
|------|--------|--------|
| `backend/src/services/technicalAnalysis.service.ts` | ✅ DONE (QA PASSED) | Full rewrite — all sub-engines |
| `backend/src/config/env.ts` | ⬜ NOT NEEDED | No new env flags for Phase 1 |
| `backend/src/server.ts` | ⬜ NOT NEEDED | No cron registration for Phase 1 |
| `backend/src/models/market.model.ts` | ⬜ NOT NEEDED | No new DB tables for Phase 1 |

**Total: 1 file modified (full rewrite) — QA PASSED Round 3**

---

*v2.Phase 1 Complete: May 8, 2026 | Senior Developer + QA Hunter*

---

## POST-PHASE 1 NEXT STEPS

After T-V2-1Q QA PASS:
1. **Run backfill script** (`scripts/backfill-ohlcv.ts`) if not already run — ensure 90 days of 4H + 180 days Daily + 365 days Weekly data
2. **Write v2.Phase 1.5 micro-tasks** (Backtesting Framework) — Strategic Planner
3. **Run backtest** against historical data — validate pass criteria
4. **If pass:** Proceed to Tranche 2 (Shadow Mode)
5. **If fail:** Fix TA engine, re-run backtest

---

*Plan authored: May 7, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md (v2.1 — APPROVED)*
*Next: Senior Developer executes T-V2-1A → T-V2-1B → ... → T-V2-1Q*
