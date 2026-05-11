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

---

# Master Plan v2.1 — v2.Phase 1.5: Backtesting Framework

**Status:** 📋 PLANNED — Awaiting Senior Developer
**Date:** May 8, 2026
**Priority:** P0 (Tranche 1 Exit Gate — BLOCKS Shadow Mode + ALL Tranche 2+)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md` (lines 339-365)
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

## PHASE SCOPE

| Sub-Task | Description | Task ID | Status |
|---|---|---|---|
| Env Flag | `BACKTEST_TECHNICAL_ENABLED` env flag | T-V2-1R | ⬜ NOT STARTED |
| Historical Query Helper | `getCandlesAtTime()` + `getCandlesRange()` in ohlcvSnapshot.service.ts | T-V2-1S | ⬜ NOT STARTED |
| Backtest Engine | Core backtest logic + historical TA replay in `scripts/backtest-technical.ts` | T-V2-1T | ⬜ NOT STARTED |
| Metrics + Validation | Output metrics, pass/fail criteria, console report | T-V2-1U | ⬜ NOT STARTED |
| QA | Audit backtest script for correctness | T-V2-1V | ⬜ NOT STARTED |

## GUARDRAILS (Apply to ALL v2.Phase 1.5 tasks)

1. **Zero `any` types** — strict TypeScript throughout.
2. **Zero modifications to `technicalAnalysis.service.ts`** — the TA engine is QA PASSED and frozen. The backtest script calls its exported functions; it does NOT modify them.
3. **Zero modifications to existing crons** — this is a standalone manual script, not a cron.
4. **Zero modifications to routes/controllers** — no API exposure.
5. **No new DB tables** — backtest reads from existing `ohlcv_candles` + `ohlcv_indicators`. Results printed to console, not stored in DB.
6. **No new npm packages** — use existing dependencies only.
7. **Zero BUY/SELL terminology** — all labels BULLISH/BEARISH only.
8. **Backward compatible** — zero impact on production code. New file + 2 new query helpers only.
9. **All DB queries via Drizzle ORM** — zero raw SQL.
10. **Commit only after QA PASS**.

## PHASE ARCHITECTURE CONTEXT

**What exists today (from v2.Phase 1 — COMPLETE, QA PASSED):**
- `backend/src/services/technicalAnalysis.service.ts` — 771 lines, fully production-ready
  - Exported functions: `analyzeTechnicals(symbol)` → `TechnicalAnalysisFullResult | null`
  - Exported functions: `detectTrend(symbol)` → `TrendLabel`
  - Exported functions: `detectSupportResistance(symbol)` → `{ supportLevels, resistanceLevels }`
  - Exported functions: `analyzeMarketStructure(symbol)` → `MarketStructureResult`
  - Exported functions: `detectCandlePattern(symbol, supportLevels, resistanceLevels)` → `CandlePatternResult`
  - Exported functions: `analyzeVolumeConfirmation(symbol)` → `VolumeConfirmationResult`
  - Exported functions: `calculateQualityScore(params)` → `QualityScoreResult`
  - Exported functions: `checkSignalHealth()` → `SignalHealthResult`
  - Exported helpers: `isNearLevel(price, level, thresholdPercent)` → `boolean`
  - Exported helpers: `priceDistancePercent(price, level)` → `number`
  - **CRITICAL LIMITATION:** `analyzeTechnicals()` and all sub-engines call `getLatestIndicator()` and `getCandles()` which fetch the MOST RECENT data. They do NOT accept a timestamp parameter. For backtesting historical points, we need a way to feed them historical data.

**What exists in ohlcvSnapshot.service.ts:**
- `getCandles(symbol, timeframe, limit)` → latest N candles, DESC by openTime
- `getLatestIndicator(symbol, timeframe)` → latest indicator row
- `getIndicatorAtTime(symbol, timeframe, timestamp)` → indicator at or before timestamp
- **MISSING:** No way to get candles at a specific timestamp (needed for sliding window backtest)

**Backtest Challenge:**
The existing TA engine reads from the DB using current-time queries. To backtest, we need either:
- (Option A) Add timestamp-aware query variants to ohlcvSnapshot.service.ts, then temporarily mock/override the DB reads
- (Option B) Refactor TA engine to accept optional data injection (violates "zero modifications" rule)
- (Option C) **Create a backtest-specific replay function** that loads historical candle data into memory, computes indicators inline (same algorithm as ohlcvSnapshot), then calls the pure-logic parts of the TA engine

**SELECTED APPROACH: Option C — In-Memory Replay**
- The backtest script loads ALL required historical candles upfront (90 days x 11 coins x 2 timeframes = manageable)
- For each historical date point, it slices the candle array to create a "window" ending at that date
- It computes EMA/ATR indicators in-memory using the same algorithm from `computeIndicators()`
- It then calls modified versions of the TA sub-engines that accept arrays instead of DB queries
- **KEY RULE:** The backtest script duplicates the indicator computation logic (copied from computeIndicators) but does NOT duplicate the TA engine logic. Instead, it will import and call the pure analytical functions directly by creating a thin adapter layer that feeds them in-memory data.

**CORRECTION — SIMPLER APPROACH:**
After analysis, the cleanest approach is:
1. Add `getCandlesAtTime(symbol, timeframe, timestamp, limit)` to ohlcvSnapshot.service.ts — returns N candles ending at or before timestamp
2. Add `getIndicatorAtTimeRange(symbol, timeframe, startTimestamp, endTimestamp)` to ohlcvSnapshot.service.ts — returns indicators in a time range (for pre-computed indicator lookup)
3. The backtest script creates a **mock module override** at the top of the script that temporarily replaces `getCandles` and `getLatestIndicator` with historical versions using `jest-style` module interception (or simpler: pass the data directly by calling sub-engine logic inline)
4. **FINAL DECISION:** The backtest script will NOT call `analyzeTechnicals()`. Instead, it will import the **individual pure-logic helper functions** (EMA comparison logic, swing detection logic, etc.) and build its own `backtestAnalyzeAtPoint(symbol, date)` that mirrors the orchestration of `analyzeTechnicals` but uses historical data. This avoids modifying the frozen TA engine.

**WAIT — SIMPLEST CORRECT APPROACH:**
Re-reading the spec carefully: "For each day, for each coin: a. Run v2.Phase 1 engine (EMA, S/R, Structure, Volume, Quality Score)". The spec says to run the engine. The practical approach:
1. Add `getCandlesAtTime(symbol, timeframe, beforeTimestamp, limit)` to ohlcvSnapshot.service.ts
2. In the backtest script, dynamically override `getCandles` and `getLatestIndicator` via a **runtime swap pattern** — set module-level variables that the TA engine reads. BUT the TA engine doesn't support this.

**FINAL FINAL DECISION — Practical & Clean:**
The backtest script will:
1. Load all historical candles for each coin into memory (一次性 bulk query)
2. For each historical date point, construct the indicator data in-memory (same algorithm as computeIndicators)
3. Call the TA sub-engine functions directly by **monkey-patching** the ohlcvSnapshot service's exported functions at runtime using `jest.mock`-style approach — OR simpler: **the backtest script will re-implement the orchestration loop** calling the pure-analysis functions from technicalAnalysis.service.ts where possible, and re-implementing the DB-dependent parts (trend detection from in-memory EMA, S/R from in-memory candles, etc.)

**ACTUAL IMPLEMENTATION DECISION:**
Given the constraints (zero modifications to TA engine), the backtest will:
1. Query all 4H candles for each coin (last 90 days) in a single bulk DB read
2. Query all corresponding indicators in a single bulk DB read
3. For each historical day in the range, use the indicators that existed at that point in time
4. Re-implement the orchestration logic (a simplified version of `analyzeTechnicals`) inside the backtest script that uses the historical indicator data directly
5. This means the backtest is a **faithful re-implementation** of the TA logic using the same formulas but reading from in-memory arrays instead of DB queries

**WHY THIS IS ACCEPTABLE:**
- The backtest doesn't need to be the TA engine. It needs to validate the TA engine's algorithms produce reasonable results on historical data.
- The EMA comparison logic, swing detection logic, quality score formula are all documented in the spec and can be faithfully re-implemented
- The backtest runs once (manual), not in production — it's a validation tool
- After backtest passes, the TA engine itself goes into shadow mode for the real validation

---

## REQUIRED TASKS

### T-V2-1R — Backtest Env Flag

**Task ID:** T-V2-1R
**Phase:** v2.Phase 1.5 — Backtesting Framework
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** A (no dependencies)

**Objective:**
Add `BACKTEST_TECHNICAL_ENABLED` env flag to `env.ts`. Default `false`. This flag gates execution of the backtest script.

**File to modify:**
- `backend/src/config/env.ts`

**Exact change:**
Add after the existing `BACKFILL_OHLCV_ENABLED` line (line 98):
```typescript
BACKTEST_TECHNICAL_ENABLED: z.boolean().default(false),
```

**Constraints:**
- Default `false` — backtest only runs when explicitly enabled
- Follows existing pattern (zod boolean with default false)
- Zero `any` types

**Dependencies:** None

**Rollback:** Remove the line from env.ts

---

### T-V2-1S — Historical Query Helpers in ohlcvSnapshot.service.ts

**Task ID:** T-V2-1S
**Phase:** v2.Phase 1.5 — Backtesting Framework
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** B (depends on T-V2-1R)

**Objective:**
Add two new query helper functions to `ohlcvSnapshot.service.ts` that allow the backtest script to fetch historical candle and indicator data for a specific point in time. These functions are also useful for future features (e.g., historical signal analysis).

**File to modify:**
- `backend/src/services/ohlcvSnapshot.service.ts`

**Function 1 signature:**
```typescript
export async function getCandlesAtTime(
    symbol: string,
    timeframe: string,
    beforeTimestamp: Date,
    limit: number
): Promise<typeof ohlcvCandles.$inferSelect[]>
```

**Function 1 logic:**
- Query `ohlcv_candles` WHERE `coinSymbol = symbol AND timeframe = timeframe AND openTime <= beforeTimestamp`
- ORDER BY `openTime DESC`
- LIMIT `limit`
- Returns the N most recent candles at or before the given timestamp
- Same return type as existing `getCandles()` — DESC order

**Function 2 signature:**
```typescript
export async function getIndicatorsRange(
    symbol: string,
    timeframe: string,
    startTimestamp: Date,
    endTimestamp: Date
): Promise<typeof ohlcvIndicators.$inferSelect[]>
```

**Function 2 logic:**
- Query `ohlcv_indicators` WHERE `coinSymbol = symbol AND timeframe = timeframe AND openTime >= startTimestamp AND openTime <= endTimestamp`
- ORDER BY `openTime ASC`
- No limit (returns all indicators in the range — needed for bulk historical analysis)
- Returns all indicator rows in the time range, ASC order

**Constraints:**
- Zero raw SQL — Drizzle ORM only
- Zero `any` types
- Additive only — zero modifications to existing functions
- Use the same import pattern as existing functions (`sql`, `desc`, `asc` from `drizzle-orm`)

**Dependencies:** T-V2-1R (env flag pattern established)

**Rollback:** Remove the 2 new functions from ohlcvSnapshot.service.ts

---

### T-V2-1T — Backtest Engine Core (`scripts/backtest-technical.ts`)

**Task ID:** T-V2-1T
**Phase:** v2.Phase 1.5 — Backtesting Framework
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** C (depends on T-V2-1S)

**Objective:**
Create the main backtest script that replays the v2.Phase 1 Technical Analysis engine against 90 days of historical data for all 11 tracked coins. The script validates the TA algorithms produce reasonable results before shadow mode is authorized.

**File to create:**
- `backend/scripts/backtest-technical.ts`

**Spec reference:** nextstep2-v2.md lines 339-365

**Script execution pattern:**
Follow existing pattern from `backend/scripts/backfill-ohlcv.ts` — standalone ts-node script with env flag check at top.

**High-level flow:**

```
1. Check BACKTEST_TECHNICAL_ENABLED === true, else exit
2. Import TRACKED_COINS from config/coins.ts
3. Import db from config/db
4. Import { ohlcvCandles, ohlcvIndicators } from models/market.model
5. Import { getCandlesAtTime, getIndicatorsRange } from services/ohlcvSnapshot.service
6. Log: "[BACKTEST] Starting technical analysis backtest..."

7. Load all historical data upfront (minimize DB round-trips):
   For each coin in TRACKED_COINS:
     a. Fetch all 4H candles from last 90 days → store in Map<string, CandleRow[]>
        Query: getCandlesAtTime(symbol, '4h', new Date(), 540) // 90 days * 6 candles/day
        Reverse to ASC order for processing
     b. Fetch all 4H indicators from last 90 days → store in Map<string, IndicatorRow[]>
        Query: getIndicatorsRange(symbol, '4h', 90DaysAgo, now)
        Already in ASC order

8. Walk through history day by day:
   startDate = oldest candle date + 14 days (need 14 days for EMA warmup)
   endDate = newest candle date - 3 days (need 3 days forward for P&L check)

   For each day from startDate to endDate:
     For each coin:
       a. Get the indicator row closest to this day's timestamp
       b. If no indicator exists for this coin on this day → SKIP
       c. Extract: ema20, ema50 (from 4H), ema200 (from 1d — if available)
       d. Get the candle at this day's timestamp
       e. Run inline TA analysis (re-implemented orchestration):
          - detectTrendAtPoint(ema20, ema50, ema200, price)
          - detectSupportResistanceAtPoint(candlesUpToThisPoint)
          - analyzeVolumeConfirmationAtPoint(currentCandle, volumeAvg20)
          - calculateQualityScore(...) — reuse imported function directly
       f. Record result:
          {
            coin, date, trend, qualityScore, isRejected,
            nearestSupport, nearestResistance,
            patternFound, volumeConfirmed,
            priceAtPoint, price72hLater
          }

9. After all days processed → call computeMetrics(results)
10. Print report to console
11. Evaluate pass/fail criteria → print VERDICT
```

**Critical implementation detail — Re-implemented TA functions in the backtest script:**

The backtest script CANNOT call `analyzeTechnicals()` or `detectTrend()` directly because those functions call `getLatestIndicator()` which always returns the CURRENT data. Instead, the backtest re-implements the pure-logic parts:

```typescript
// ─── In-Memory Trend Detection (same algorithm as detectTrend) ───
function backtestDetectTrend(
    price: number,
    ema20: number | null,
    ema50: number | null,
    ema200: number | null
): TrendLabel {
    // Exact same logic as technicalAnalysis.service.ts detectTrend()
    // but takes parameters directly instead of querying DB
}

// ─── In-Memory S/R Detection (same algorithm as detectSupportResistance) ───
function backtestDetectSR(
    candles: CandleRow[]  // ASC order, sliced to window ending at backtest point
): { supportLevels: SRLevel[]; resistanceLevels: SRLevel[] } {
    // Exact same swing detection, clustering, and strength scoring
    // but operates on in-memory array instead of DB query
}

// ─── In-Memory Volume Confirmation ───
function backtestAnalyzeVolume(
    currentCandle: CandleRow,
    volumeAvg20: number | null
): VolumeConfirmationResult {
    // Exact same ratio/spike logic
}

// ─── Quality Score ───
// Import calculateQualityScore directly from technicalAnalysis.service.ts
// It's a pure function — no DB calls
import { calculateQualityScore } from '../src/services/technicalAnalysis.service';
```

**Key imports to use directly from technicalAnalysis.service.ts (pure functions, no DB):**
- `calculateQualityScore(params)` — pure function, no DB calls
- `TrendLabel` type
- `SRLevel` interface
- `QualityScoreResult` interface
- `VolumeConfirmationResult` interface
- `CandlePatternResult` interface

**In-memory EMA computation (for backtest indicator warmup):**
The backtest loads pre-computed indicators from `ohlcv_indicators`. If indicators don't exist for a given historical date (e.g., early in the 90-day window), it computes EMA inline:
```typescript
function computeEMAInline(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period; // SMA seed
    for (let i = period; i < closes.length; i++) {
        ema = closes[i] * multiplier + ema * (1 - multiplier);
    }
    return ema;
}
```

**Data structures for results:**

```typescript
interface BacktestDayResult {
    coin: string;
    date: Date;
    price: number;
    price72h: number | null;
    trend: TrendLabel;
    qualityScore: number;
    isRejected: boolean;
    rejectionReason: string | null;
    nearestSupport: number | null;
    nearestResistance: number | null;
    patternFound: string | null;
    volumeConfirmed: boolean;
    volumeSpike: boolean;
    hypotheticalPnl72h: number | null;
    hypotheticalWin72h: boolean | null;
    trendPredictedCorrectly: boolean | null;
    supportHit72h: boolean | null;
    resistanceHit72h: boolean | null;
}
```

**Hypothetical P&L calculation:**
For each day where qualityScore >= 60:
- If trend is BULLISH or STRONG_BULLISH: hypothetical long entry at price
- If trend is BEARISH or STRONG_BEARISH: hypothetical short entry at price
- If SIDEWAYS: skip (no directional signal)
- Calculate P&L at 72h: `(price72h - price) / price * 100` for long, `(price - price72h) / price * 100` for short
- Win if P&L > 0

**Trend accuracy check:**
- For each day, record the trend label
- Check if next 24h direction matches: if BULLISH and price24h > price → correct
- Accuracy = correct predictions / total predictions (excluding SIDEWAYS)

**S/R hit rate check:**
- For each day where nearestSupport or nearestResistance is identified
- Check if price reached within 1% of that level in the next 72h
- Hit rate = levels reached / levels identified

**Constraints:**
- Zero `any` types
- Zero modifications to existing files (except T-V2-1S additions)
- Console output only — zero DB writes
- Progress logging every 10 coin-days: `[BACKTEST] Processing BTC day 15/60...`
- Total runtime target: < 2 minutes for all 11 coins x 90 days
- Use `import` from `../src/services/technicalAnalysis.service` for pure functions

**Dependencies:** T-V2-1S (historical query helpers)

**Rollback:** Delete `backend/scripts/backtest-technical.ts`

---

### T-V2-1U — Backtest Metrics + Pass/Fail Validation

**Task ID:** T-V2-1U
**Phase:** v2.Phase 1.5 — Backtesting Framework
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** D (depends on T-V2-1T)

**Objective:**
Implement the metrics computation and pass/fail validation logic within the backtest script. This produces the final report that determines whether the TA engine is validated for shadow mode.

**File to modify:**
- `backend/scripts/backtest-technical.ts` (add computeMetrics + printReport functions)

**Spec reference:** nextstep2-v2.md lines 353-365

**Function 1: `computeMetrics(results: BacktestDayResult[])`**

Returns:
```typescript
interface BacktestMetrics {
    totalCoinDays: number;
    daysWithQuality60Plus: number;
    qualityPassRate: number;          // daysWithQuality60Plus / totalCoinDays

    // Per-coin breakdown
    perCoin: Map<string, {
        totalDays: number;
        quality60PlusDays: number;
        avgQualityScore: number;
        trendDistribution: Record<TrendLabel, number>;
        bullishDays: number;
        bearishDays: number;
        sidewaysDays: number;
    }>;

    // Aggregate metrics
    winRate72h: number | null;         // % of quality>=60 signals that were profitable at 72h
    totalHypotheticalSignals: number;  // quality>=60 AND not SIDEWAYS
    hypotheticalWins: number;

    trendAccuracy: number | null;      // % of trend labels that predicted next 24h direction
    trendPredictions: number;          // total directional predictions (excl SIDEWAYS)
    trendCorrect: number;

    srHitRate: number | null;          // % of identified S/R levels reached within 72h
    srLevelsIdentified: number;
    srLevelsHit: number;

    qualityScoreHistogram: Record<string, number>;  // "0-20": count, "20-40": count, etc.

    directionalDiversity: boolean;     // both BULLISH and BEARISH signals exist
}
```

**Pass Criteria (ALL 5 must be met — from spec lines 358-363):**

| # | Criterion | Threshold | Metric Field |
|---|---|---|---|
| 1 | Win rate estimate | > 40% | `winRate72h > 0.40` |
| 2 | Quality score >= 60 days | >= 20% of coin-days | `qualityPassRate >= 0.20` |
| 3 | Directional diversity | Both BULLISH and BEARISH exist | `directionalDiversity === true` |
| 4 | Trend accuracy | > 55% | `trendAccuracy > 0.55` |
| 5 | S/R hit rate | > 50% | `srHitRate > 0.50` |

**Function 2: `printReport(metrics: BacktestMetrics, results: BacktestDayResult[])`**

Console output format (structured, readable):

```
╔══════════════════════════════════════════════════════════════╗
║           ONLYALPHA — TECHNICAL ANALYSIS BACKTEST           ║
║                    v2.Phase 1.5 Validation                   ║
╚══════════════════════════════════════════════════════════════╝

Data Range: [startDate] → [endDate] (90 days)
Coins Analyzed: 11
Total Coin-Days: {totalCoinDays}

── PER-COIN BREAKDOWN ──────────────────────────────────────────
Coin         Days  QS≥60  AvgQS  Bull  Bear  Side
BTC            60     18   72.3    22    15    23
ETH            60     14   68.1    20    12    28
...

── AGGREGATE METRICS ───────────────────────────────────────────
Quality Pass Rate (QS≥60):    {qualityPassRate}%  (threshold: 20%)
Win Rate 72h (hypothetical):  {winRate72h}%      (threshold: 40%)
Trend Accuracy:               {trendAccuracy}%    (threshold: 55%)
S/R Hit Rate:                 {srHitRate}%        (threshold: 50%)
Directional Diversity:        {directionalDiversity ? 'YES' : 'NO'}

── QUALITY SCORE HISTOGRAM ────────────────────────────────────
0-20:   ██░░░░░░░░  12 (3.3%)
20-40:  ████░░░░░░  45 (12.5%)
40-60:  ██████░░░░  89 (24.7%)
60-80:  █████████░  134 (37.2%)  ← PASS THRESHOLD
80-100: ████████░░  80 (22.2%)

── PASS/FAIL VERDICT ──────────────────────────────────────────
[✅ PASS] Win Rate > 40%          → {winRate72h}%
[✅ PASS] Quality≥60 ≥ 20%       → {qualityPassRate}%
[✅ PASS] Directional Diversity   → {directionalDiversity}
[✅ PASS] Trend Accuracy > 55%    → {trendAccuracy}%
[✅ PASS] S/R Hit Rate > 50%      → {srHitRate}%

══════════════════════════════════════════════════════════════
  FINAL VERDICT: ✅ ALL CRITERIA PASSED — Shadow mode authorized
══════════════════════════════════════════════════════════════
```

If ANY criterion fails:
```
══════════════════════════════════════════════════════════════
  FINAL VERDICT: ❌ FAILED — {N} criteria not met
  Action: Fix TA engine before proceeding to shadow mode.
  Failed: {list of failed criteria with actual vs threshold}
══════════════════════════════════════════════════════════════
```

**Process exit code:**
- All pass: `process.exit(0)`
- Any fail: `process.exit(1)`

**Constraints:**
- Zero `any` types
- All percentage calculations use proper rounding (2 decimal places)
- Per-coin table sorted by avgQualityScore DESC
- Histogram ranges: 0-20, 20-40, 40-60, 60-80, 80-100
- If insufficient data (e.g., < 30 coin-days with indicators), warn and exit with code 2

**Dependencies:** T-V2-1T (backtest engine produces results)

**Rollback:** Part of T-V2-1T rollback (same file)

---

### T-V2-1V — QA Verification (v2.Phase 1.5)

**Task ID:** T-V2-1V
**Phase:** v2.Phase 1.5 — Backtesting Framework
**Assigned Agent:** QA & Security Hunter
**Status:** ⬜ NOT STARTED
**Deploy Group:** E (depends on ALL above tasks)

**Objective:**
Full audit of the backtest script and new query helpers. Verify the backtest faithfully represents the TA engine's algorithms and produces valid results.

**Audit checklist:**

**Code Quality:**
1. Zero `any` types — grep entire backtest script
2. Zero BUY/SELL terminology — grep for `buy`, `sell`, `BUY`, `SELL`
3. Zero modifications to `technicalAnalysis.service.ts` — verify file unchanged
4. Zero modifications to existing cron files
5. Zero new DB tables or writes

**Algorithmic Faithfulness:**
6. **Trend detection logic** — verify backtest's `backtestDetectTrend()` matches the exact algorithm in `detectTrend()` (5 states, EMA-200 fallback, 1% intertwined check)
7. **S/R detection logic** — verify swing point detection uses same 2-candle lookback/lookahead, same clustering threshold (1.5%), same strength formula (30/30/20/10/10 weights)
8. **Volume confirmation** — verify same thresholds (1.2x = above, 2.0x = spike, 0.5x = low)
9. **Quality score** — verify `calculateQualityScore()` is called directly (imported) NOT re-implemented
10. **EMA computation** — verify inline EMA uses same multiplier formula: `2 / (period + 1)`

**Data Integrity:**
11. **Candle ordering** — verify DESC from DB is reversed to ASC before processing
12. **Date window** — verify backtest starts at least 14 days after oldest candle (EMA warmup)
13. **72h P&L** — verify hypothetical P&L correctly handles both long (BULLISH) and short (BEARISH) directions
14. **Null handling** — verify null indicators (early window) are handled gracefully (SKIP day)
15. **Edge case:** coins with < 30 days of data → verify handled

**Performance:**
16. **DB queries** — verify data loaded upfront (not N+1 per coin-day)
17. **Memory** — verify no unbounded arrays (candles capped per coin)
18. **Runtime** — verify no unnecessary recomputation

**Output Validation:**
19. **Pass criteria thresholds** — verify exactly match spec (>40%, >=20%, >55%, >50%, both directions)
20. **Exit codes** — verify 0 (pass), 1 (fail), 2 (insufficient data)
21. **Histogram** — verify 5 bins, correct ranges, percentages add up to 100%

**New Query Helpers (T-V2-1S):**
22. `getCandlesAtTime()` — verify correct WHERE clause (<= beforeTimestamp), DESC order, limit applied
23. `getIndicatorsRange()` — verify correct WHERE clause (>= start AND <= end), ASC order, no limit
24. Both functions — verify Drizzle ORM used (no raw SQL), proper TypeScript types

**Result:** PASS or REJECT with specific corrections.

**Dependencies:** ALL Phase 1.5 tasks (T-V2-1R through T-V2-1U)

---

## EXECUTION GROUPS (Dependency Order)

```
Group A: T-V2-1R (env flag — 1 minute task)
    ↓
Group B: T-V2-1S (historical query helpers — ohlcvSnapshot.service.ts)
    ↓
Group C: T-V2-1T (backtest engine core — scripts/backtest-technical.ts)
    ↓
Group D: T-V2-1U (metrics + validation — same file as T-V2-1T)
    ↓
Group E: T-V2-1V (QA — depends on ALL)
```

**Minimum sequential steps:** 5 (Groups A→B→C→D→E)

Note: T-V2-1T and T-V2-1U can be combined into a single Senior Developer session since they're the same file.

---

## FILES SUMMARY (Phase 1.5)

| File | Status | Change |
|------|--------|--------|
| `backend/src/config/env.ts` | ⬜ NEW TASK | Add 1 env flag (T-V2-1R) |
| `backend/src/services/ohlcvSnapshot.service.ts` | ⬜ NEW TASK | Add 2 query helpers (T-V2-1S) |
| `backend/scripts/backtest-technical.ts` | ⬜ NEW TASK | New backtest script (T-V2-1T + T-V2-1U) |

**Total: 1 new file, 2 modified files**

---

## TRANCHE 1 EXIT GATE REMINDER

After T-V2-1V QA PASS:

1. **Run backfill script** (`scripts/backfill-ohlcv.ts`) if not already run
   - Verify 90 days of 4H data for all 11 coins
   - Verify indicators computed for all coin x timeframe combinations
2. **Run backtest** (`BACKTEST_TECHNICAL_ENABLED=true npx ts-node scripts/backtest-technical.ts`)
3. **Verify ALL 5 pass criteria:**
   - [ ] Win rate > 40%
   - [ ] Quality ≥ 60 on ≥ 20% of coin-days
   - [ ] Both BULLISH and BEARISH signals produced
   - [ ] Trend accuracy > 55%
   - [ ] S/R hit rate > 50%
4. **If ALL pass:** Update PROJECT_STATE.md → v2.Phase 1.5 COMPLETE → Unblock Tranche 2
5. **If ANY fail:** Fix TA engine, re-run backtest. DO NOT proceed to shadow mode.

---

*Plan authored: May 8, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md (v2.1 — APPROVED)*
*Next: Senior Developer executes T-V2-1R → T-V2-1S → T-V2-1T → T-V2-1U → T-V2-1V*

---
---

# Master Plan v2.1 — Tranche 2: Shadow Mode + Classification + Regime + TP/SL

**Status:** ⬜ PLANNED — Awaiting Tranche 1 Exit Gate (backfill + backtest execution)
**Date:** May 8, 2026
**Priority:** P0 (Validates algorithm before replacing AI signal generation)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2.md` (lines 22-148, 150-237, 199-306, 228-237)
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

## TRANCHE 2 SCOPE

| v2 Phase | Description | Tasks | Status |
|---|---|---|---|
| v2.Phase 0.5 | Shadow Mode + Admin Dashboard | T-V2-05A → T-V2-05Q | ⬜ PLANNED |
| v2.Phase 3 | Signal Classification System | T-V2-3A → T-V2-3Q | ⬜ PLANNED |
| v2.Phase 2 | Market Regime Detection | T-V2-2A → T-V2-2Q | ⬜ PLANNED |
| v2.Phase 4 | TP/SL Engine Overhaul | T-V2-4A → T-V2-4Q | ⬜ PLANNED |
| v2.Phase 6 | AI Role Refinement [DEFERRED] | T-V2-6A → T-V2-6Q | ⬜ BLOCKED until shadow exit gate |

**Tranche 2 Exit Gate:**
- [ ] Shadow mode running minimum 2 weeks
- [ ] 20+ resolved shadow signals
- [ ] Algorithm disagreement win rate > 60%
- [ ] Phase 6 activation only after exit gate passes

## GLOBAL GUARDRAILS (Apply to ALL Tranche 2 tasks)

1. **Zero `any` types** — strict TypeScript throughout.
2. **Never hardcode coin symbols** — always import from `config/coins.ts`.
3. **All DB migrations guarded by `migration_flags`** — run exactly once.
4. **All new crons flagged** — default `false` in `env.ts`.
5. **Backward compatible** — zero changes to existing public API responses.
6. **No BUY/SELL terminology** — use BULLISH/BEARISH only.
7. **All DB queries via Drizzle ORM** — zero raw SQL in TypeScript files.
8. **No new npm packages** — use existing dependencies only.
9. **Existing signal pipeline untouched until explicitly authorized** — shadow mode is purely additive.
10. **Admin routes return 404 (not 401) for unauthenticated** — security by obscurity.
11. **Admin session never stored in DB** — memory only with 24h expiry.
12. **shadow_signals read-only for users** — never exposed via public API.
13. **Zero modifications to existing cron schedules** — new crons are additive.
14. **Commit only after QA PASS** — each task or deploy group individually.

## PHASE ARCHITECTURE CONTEXT

**What exists today (Tranche 1 COMPLETE):**
- `backend/src/config/coins.ts` — 11 tracked coins (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON)
- `backend/src/services/technicalAnalysis.service.ts` — 771 lines, full TA engine (QA PASSED)
  - `analyzeTechnicals(symbol)` → `TechnicalAnalysisFullResult | null`
  - `detectTrend(symbol)` → `TrendLabel`
  - `detectSupportResistance(symbol)` → `{ supportLevels: SRLevel[], resistanceLevels: SRLevel[] }`
  - `analyzeMarketStructure(symbol)` → `MarketStructureResult`
  - `detectCandlePattern(symbol, supportLevels, resistanceLevels)` → `CandlePatternResult`
  - `analyzeVolumeConfirmation(symbol)` → `VolumeConfirmationResult`
  - `calculateQualityScore(params)` → `QualityScoreResult`
  - `checkSignalHealth()` → `SignalHealthResult`
  - `isNearLevel(price, level, thresholdPercent)` → `boolean`
- `backend/src/services/ohlcvSnapshot.service.ts` — OHLCV data + query helpers
- `backend/src/crons/ohlcvSnapshot.cron.ts` — every 4H refresh
- `backend/src/crons/marketFilter.cron.ts` — every 6H coin health check
- `backend/scripts/backtest-technical.ts` — backtesting framework (QA PASSED)

**Signal pipeline (aiWorkflow.cron.ts):**
- Line 245-247: `eventType` and `classification` extracted from buffer item
- Line 376-421: MAJOR path — `callDeepSeekAnalysis()` generates full verdict
- Line 423-435: Factual grounding sanitizes AI S/R levels
- Line 622-647: Signal generation — `decideSignalAction()` → `calculateTpsl()` → `executeSignalDecision()`
- `signalManager.service.ts`: Manages create/upgrade/close_and_replace/skip decisions
- `tpslCalculator.service.ts`: Pure math TP/SL from support/resistance arrays (no ATR, no RR check)

**DB tables (market.model.ts):**
- `radarSignals` (line 100): id, coinSymbol, signalText, sentiment, impactScore, newsId, createdAt
- `signalPerformance` (line 111): id, signalId, coinSymbol, verdict, sentiment, entryPrice, entryAt, price24h/7d/30d, pnl24h/7d/30d, isWin7d/30d, isActive, closedAt, exitPrice, realizedPnl, stopLossPrice, takeProfitPrice, autoClosedReason, createdAt
- `coinIntelligenceCache` (line 195): coinSymbol (PK), ath, athDate, trend8w, week52High, week52Low, priceChange30d, wikiBackground, dexBoostActive, dataSource, cachedAt, isTradeable
- `migrationFlags` (line 315): id, flagName (unique), executedAt

**No admin infrastructure exists** — no admin routes, no admin middleware, no admin auth.

---

## EXECUTION GROUPS (Dependency Order)

```
Group A: T-V2-05A, T-V2-05B, T-V2-3A, T-V2-2A (DB migrations + env flags — 4 tasks, parallel)
    ↓
Group B: T-V2-05C, T-V2-05D, T-V2-2B, T-V2-3B (service layer — 4 tasks, parallel)
    ↓
Group C: T-V2-05E, T-V2-05F, T-V2-05G, T-V2-2C, T-V2-3C (cron + route + signalManager — 5 tasks, parallel)
    ↓
Group D: T-V2-05H, T-V2-3D, T-V2-4A (aiWorkflow integration + TP/SL service — 3 tasks)
    ↓
Group E: T-V2-4B, T-V2-4C (TP/SL gate + wiring — 2 tasks, sequential)
    ↓
Group F: T-V2-05I (admin frontend — 1 task)
    ↓
Group G: T-V2-2Q, T-V2-3Q, T-V2-4Q, T-V2-05Q (per-phase QA — 4 tasks, parallel)
    ↓
Group H: T-V2-6A, T-V2-6B, T-V2-6C, T-V2-6Q (Phase 6 — DEFERRED until shadow exit gate)
    ↓
Group I: T-V2-T2Q (Tranche 2 combined QA)
```

**Minimum sequential steps:** 9 (Groups A→B→C→D→E→F→G→H→I)

---

---

## PHASE 0.5 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-05A | shadow_signals DB table (migration + Drizzle model) | ⬜ |
| T-V2-05B | SHADOW_MODE_ENABLED env flag | ⬜ |
| T-V2-05C | Shadow Signals Service (`shadowSignals.service.ts`) | ⬜ |
| T-V2-05D | Shadow Checker Cron (`shadowChecker.cron.ts`) | ⬜ |
| T-V2-05E | Admin Auth Middleware (`adminAuth.middleware.ts`) | ⬜ |
| T-V2-05F | Admin Routes (`admin.routes.ts`) | ⬜ |
| T-V2-05G | AiWorkflow Shadow Integration (signal generation hook) | ⬜ |
| T-V2-05H | Admin Dashboard Frontend (`admin/shadow/page.tsx`) | ⬜ |
| T-V2-05Q | Phase 0.5 QA | ⬜ |

---

### T-V2-05A — shadow_signals DB Table (Migration + Drizzle Model)

**Task ID:** T-V2-05A
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** A (no dependencies)

**Objective:**
Create the `shadow_signals` table via SQL migration and add it to the Drizzle model in `market.model.ts`. This table stores dual verdicts (algorithm + AI) for parallel comparison during shadow mode.

**Files created/modified:**
- `backend/scripts/migrate-shadow-signals.sql` (new)
- `backend/src/models/market.model.ts` (add `shadowSignals` table)

**Table schema:**
```sql
CREATE TABLE shadow_signals (
    id                  SERIAL PRIMARY KEY,
    coin_symbol         VARCHAR(20) NOT NULL,
    algorithm_verdict   VARCHAR(20) NOT NULL,
    ai_verdict          VARCHAR(20) NOT NULL,
    algorithm_entry     REAL NOT NULL,
    ai_entry            REAL NOT NULL,
    algorithm_tp       REAL,
    algorithm_sl       REAL,
    ai_tp              REAL,
    ai_sl              REAL,
    quality_score      INT,
    trend_context      VARCHAR(20),
    agreement          BOOLEAN NOT NULL DEFAULT false,
    price_72h          REAL,
    price_7d           REAL,
    algorithm_pnl_72h  REAL,
    ai_pnl_72h         REAL,
    algorithm_win_72h  BOOLEAN,
    ai_win_72h         BOOLEAN,
    algorithm_pnl_7d   REAL,
    ai_pnl_7d          REAL,
    algorithm_win_7d   BOOLEAN,
    ai_win_7d          BOOLEAN,
    winner             VARCHAR(20),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at        TIMESTAMP
);
```

**Migration guard:** Insert into `migration_flags` with `flagName = 'shadow_signals_table'`.

**Drizzle model:** Add `shadowSignals` table to `market.model.ts` with columns matching the schema above.

**Constraints:** Zero `any` types. All column types exact. Migration idempotent. `agreement` defaults to `false`. `created_at` defaults to `NOW()`.

**Dependencies:** None

**Rollback:** DROP TABLE shadow_signals; DELETE FROM migration_flags WHERE flagName = 'shadow_signals_table';

---

### T-V2-05B — SHADOW_MODE_ENABLED Env Flag

**Task ID:** T-V2-05B
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** A (no dependencies)

**Objective:** Add `SHADOW_MODE_ENABLED` env flag to `env.ts`. Default `false`.

**File to modify:** `backend/src/config/env.ts`

**Exact change:**
```typescript
SHADOW_MODE_ENABLED: z.boolean().default(false),
```

**Dependencies:** None

**Rollback:** Remove the line from env.ts

---

### T-V2-05C — Shadow Signals Service

**Task ID:** T-V2-05C
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** B (depends on T-V2-05A, T-V2-05B)

**Objective:** Create `backend/src/services/shadowSignals.service.ts` — service layer for shadow signal management. Handles insertion, resolution, and statistical queries.

**File to create:** `backend/src/services/shadowSignals.service.ts`

**Exported functions:**
```typescript
export async function insertShadowSignal(params: {
    coinSymbol: string;
    algorithmVerdict: string;
    aiVerdict: string;
    algorithmEntry: number;
    aiEntry: number;
    algorithmTp?: number;
    algorithmSl?: number;
    aiTp?: number;
    aiSl?: number;
    qualityScore: number;
    trendContext: string;
    agreement: boolean;
}): Promise<number>

export async function resolveShadowSignal72h(id: number, price72h: number): Promise<void>
export async function resolveShadowSignal7d(id: number, price7d: number): Promise<void>
export async function getUnresolvedShadowSignals(): Promise<ShadowSignalRow[]>
export async function getShadowStats(): Promise<ShadowStats>
```

**ShadowStats interface:**
```typescript
interface ShadowStats {
    totalSignals: number;
    resolved72h: number;
    algorithmWins72h: number;
    aiWins72h: number;
    resolved7d: number;
    algorithmWins7d: number;
    aiWins7d: number;
    agreeingSignals: number;
    disagreeingSignals: number;
    algorithmDisagreementWinRate: number | null;
}
```

**P&L calculation:** Bullish: `((price72h - entryPrice) / entryPrice) * 100`. Bearish: `((entryPrice - price72h) / entryPrice) * 100`. Win = P&L > 0.

**Winner:** Higher P&L wins. Both <= 0 → NEITHER. 7d: update winner if changed, set resolved_at when complete.

**Constraints:** Zero `any` types. All DB via Drizzle ORM. Zero live Binance calls.

**Dependencies:** T-V2-05A (shadowSignals table), T-V2-05B (env flag)

**Rollback:** Delete `backend/src/services/shadowSignals.service.ts`

---

### T-V2-05D — Shadow Checker Cron

**Task ID:** T-V2-05D
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** B (depends on T-V2-05C)

**Objective:** Create `backend/src/crons/shadowChecker.cron.ts` — runs every 15 minutes to resolve shadow signals at 72h and 7d checkpoints.

**File to create:** `backend/src/crons/shadowChecker.cron.ts`

**Schedule:** `*/15 * * * *`

**Algorithm:**
```
1. If SHADOW_MODE_ENABLED === false: exit
2. Fetch all unresolved shadow signals
3. For each shadow signal:
   a. age = now - created_at
   b. If age >= 72h AND price_72h IS NULL:
      - Fetch live price, fill price_72h, calculate P&L, set win flags, determine winner
   c. If age >= 7d AND price_7d IS NULL:
      - Fetch live price, fill price_7d, calculate P&L, set win flags, update winner, set resolved_at
```

**Price fetching:** Use `getLivePrices()` from `priceService` — batch by coin first. If fetch fails: log error, skip signal, continue.

**Dependencies:** T-V2-05C (shadowSignals service), T-V2-05B (env flag)

**Rollback:** Delete `backend/src/crons/shadowChecker.cron.ts`

---

### T-V2-05E — Admin Auth Middleware

**Task ID:** T-V2-05E
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** C (depends on T-V2-05B)

**Objective:** Create `backend/src/middleware/adminAuth.middleware.ts` — protects admin routes with email/password auth. Session in memory (Map), 24h expiry.

**File to create:** `backend/src/middleware/adminAuth.middleware.ts`

**Design:** In-memory session store (Map<sessionId, { email, expiresAt }>), bcrypt hashing, 64-char random session ID, 404 for unauthenticated requests.

**Env vars to add:**
```typescript
ADMIN_EMAIL: z.string().email().default('admin@onlyalpha.io'),
ADMIN_PASSWORD: z.string().min(12).default('change_me_in_prod'),
ADMIN_SESSION_SECRET: z.string().length(32).default('00000000000000000000000000000000'),
```

**Exported:** `adminLogin`, `adminLogout`, `adminAuth` (middleware), `cleanupExpiredSessions`

**Dependencies:** T-V2-05B (env flag)

**Rollback:** Delete middleware file, remove env vars

---

### T-V2-05F — Admin Routes

**Task ID:** T-V2-05F
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** C (depends on T-V2-05C, T-V2-05E)

**Objective:** Create `backend/src/routes/admin.routes.ts` — protected admin API routes for shadow mode statistics.

**File to create:** `backend/src/routes/admin.routes.ts`

**Routes:**
| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | /admin/login | adminLogin | No |
| POST | /admin/logout | adminLogout | No |
| GET | /admin/shadow/stats | getShadowStats | Yes |
| GET | /admin/shadow/signals | getShadowSignals | Yes |
| GET | /admin/shadow/signals/:id | getShadowSignalById | Yes |

**Filters:** coin, agreement, status, date range, page, limit. Controller: `backend/src/controllers/admin.controller.ts`.

**Dependencies:** T-V2-05C (shadowSignals service), T-V2-05E (auth middleware)

**Rollback:** Delete admin.routes.ts, delete admin.controller.ts

---

### T-V2-05G — AiWorkflow Shadow Integration

**Task ID:** T-V2-05G
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** D (depends on T-V2-05C)

**Objective:** In `aiWorkflow.cron.ts`, after `executeSignalDecision` call, insert shadow signal record. Fire-and-forget — does not block existing flow.

**File to modify:** `backend/src/crons/aiWorkflow.cron.ts`

**Location:** After line 643 where `signalId` is set.

**Injection:**
```typescript
if (env.SHADOW_MODE_ENABLED && signalId !== null) {
    (async () => {
        try {
            const taResult = await analyzeTechnicals(symbol);
            if (taResult && !taResult.qualityScore.isRejected) {
                const algoVerdict = mapTrendToVerdict(taResult.trend);
                const entryPrice = price.price;
                const aiVerdict = analysisResult.verdict;
                const algoDirection = trendToDirection(taResult.trend);
                const aiDirection = verdictToDirection(aiVerdict);
                const agreement = algoDirection === aiDirection;
                
                await insertShadowSignal({
                    coinSymbol: symbol,
                    algorithmVerdict: algoVerdict,
                    aiVerdict: aiVerdict,
                    algorithmEntry: entryPrice,
                    aiEntry: entryPrice,
                    algorithmTp: taResult.nearestResistance?.price ?? null,
                    algorithmSl: taResult.nearestSupport?.price ?? null,
                    aiTp: tpslData.takeProfitPrice,
                    aiSl: tpslData.stopLossPrice,
                    qualityScore: taResult.qualityScore.score,
                    trendContext: taResult.trend,
                    agreement,
                });
            }
        } catch (err) {
            logger.error('[ShadowMode] Failed to insert shadow signal: %s', err);
        }
    })();
}
```

**New imports:**
```typescript
import { analyzeTechnicals } from '../services/technicalAnalysis.service';
import { insertShadowSignal } from '../services/shadowSignals.service';
import type { TrendLabel } from '../services/technicalAnalysis.service';
```

**Helper functions:**
```typescript
function trendToDirection(trend: TrendLabel): 'bullish' | 'bearish' | 'neutral' {
    if (trend === 'STRONG_BULLISH' || trend === 'BULLISH') return 'bullish';
    if (trend === 'STRONG_BEARISH' || trend === 'BEARISH') return 'bearish';
    return 'neutral';
}

function verdictToDirection(verdict: string): 'bullish' | 'bearish' | 'neutral' {
    if (verdict === 'STRONG_BUY' || verdict === 'BUY') return 'bullish';
    if (verdict === 'STRONG_SELL' || verdict === 'SELL') return 'bearish';
    return 'neutral';
}

function mapTrendToVerdict(trend: TrendLabel): string {
    switch (trend) {
        case 'STRONG_BULLISH': return 'STRONG_BUY';
        case 'BULLISH': return 'BUY';
        case 'STRONG_BEARISH': return 'STRONG_SELL';
        case 'BEARISH': return 'SELL';
        default: return 'BUY';
    }
}
```

**Key constraint:** Existing flow 100% untouched. Fire-and-forget only.

**Dependencies:** T-V2-05C (shadowSignals service), T-V2-05B (env flag)

**Rollback:** Remove shadow block + new imports

---

### T-V2-05H — Admin Dashboard Frontend

**Task ID:** T-V2-05H
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** E (depends on T-V2-05F)

**Objective:** Create `frontend/src/app/admin/shadow/page.tsx` — admin dashboard for shadow mode statistics.

**File to create:** `frontend/src/app/admin/shadow/page.tsx`

**Layout:** 6 stat cards (Algorithm WIN Rate 72h, AI WIN Rate 72h, Total Signals, Agreeing, Disagreeing, Algorithm Disagreement WIN Rate). Decision Helper Banner (shows at 20+ resolved). Signals table (10 columns). Filters (coin, agreement, status, date range).

**Constraints:** Zero `any` types. All data via `/admin/shadow/*` API routes. No modifications to public frontend.

**Dependencies:** T-V2-05F (admin routes)

**Rollback:** Delete admin directory

---

### T-V2-05Q — Phase 0.5 QA

**Task ID:** T-V2-05Q
**Phase:** v2.Phase 0.5 — Shadow Mode
**Assigned Agent:** QA & Security Hunter
**Status:** ⬜ NOT STARTED
**Deploy Group:** F (depends on ALL above tasks)

**Audit checklist:** Schema, migration guards, admin auth security (404, memory session, bcrypt, 24h expiry), shadow logic (72h/7d resolution), aiWorkflow integration (fire-and-forget), admin routes (5 routes), frontend (6 cards, filters).

**Dependencies:** T-V2-05A through T-V2-05H

---

---

# Phase 3 — Signal Classification System

## PHASE 3 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-3A | radar_signals + signal_performance DB additions | ✅ DONE |
| T-V2-3B | Signal Classification Service | ✅ DONE |
| T-V2-3C | aiWorkflow Classification Integration | ✅ DONE |
| T-V2-3Q | Phase 3 QA | ✅ DONE (QA PASSED — Round 2) |

---

### T-V2-3A — Signal Classification DB Additions

**Task ID:** T-V2-3A
**Phase:** v2.Phase 3 — Signal Classification
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** A (parallel with T-V2-05A/B)

**Objective:** Add classification columns to `radar_signals` and `signal_performance` tables.

**Files created/modified:** `backend/scripts/migrate-signal-classification.sql` (new), `backend/src/models/market.model.ts`

**Migration SQL:**
```sql
ALTER TABLE radar_signals ADD COLUMN signal_type VARCHAR(20);
ALTER TABLE radar_signals ADD COLUMN horizon_days INT;
ALTER TABLE radar_signals ADD COLUMN quality_score INT;
ALTER TABLE radar_signals ADD COLUMN trend_context VARCHAR(20);
ALTER TABLE radar_signals ADD COLUMN entry_zone_low REAL;
ALTER TABLE radar_signals ADD COLUMN entry_zone_high REAL;
ALTER TABLE radar_signals ADD COLUMN invalidation_level REAL;
ALTER TABLE radar_signals ADD COLUMN invalidation_reason TEXT;

ALTER TABLE signal_performance ADD COLUMN signal_state VARCHAR(30) DEFAULT 'NEW';
ALTER TABLE signal_performance ADD COLUMN price72h REAL;
ALTER TABLE signal_performance ADD COLUMN pnl72h REAL;
ALTER TABLE signal_performance ADD COLUMN is_win72h BOOLEAN;
ALTER TABLE signal_performance ADD COLUMN partial_tp_hit_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN breakeven_moved_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN close_reason VARCHAR(50);
```

**Migration guard:** Insert `signal_classification_schema` into `migration_flags`. All new columns nullable or with defaults (backward compatible).

**Dependencies:** None

**Rollback:** Revert ALTER TABLE statements

---

### T-V2-3B — Signal Classification Service

**Task ID:** T-V2-3B
**Phase:** v2.Phase 3 — Signal Classification
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** B (depends on T-V2-3A)

**Objective:** Create `backend/src/services/signalClassification.service.ts` — determines signal type, horizon, entry zones, and invalidation levels.

**File to create:** `backend/src/services/signalClassification.service.ts`

**Event → Signal Type Mapping:**

| Signal Type | Horizon | Triggered By |
|---|---|---|
| TACTICAL | 3 days | Listing, whale movement, partnership, price action, volume spike |
| STRATEGIC | 14 days | ETF approval/rejection, regulation, hack, delisting |
| STRATEGIC | 21 days | Mainnet launch, major funding, protocol upgrade |

**Exported function:**
```typescript
export async function classifySignal(params: {
    eventType: string;
    taResult: TechnicalAnalysisFullResult;
}): Promise<ClassificationResult>
```

**ClassificationResult:**
```typescript
interface ClassificationResult {
    signalType: 'tactical' | 'strategic';
    horizonDays: 3 | 14 | 21;
    entryZoneLow: number;
    entryZoneHigh: number;
    invalidationLevel: number;
    invalidationReason: string;
    riskRewardRatio: number;
    meetsMinimumRR: boolean;  // TACTICAL >= 2, STRATEGIC >= 3
}
```

**Algorithm:** Map eventType → signalType + horizonDays. Entry zone from nearest S/R ± buffer. Invalidation from structure break point. RR = TP_distance / SL_distance. Reject if RR below minimum (not downgrade — reject).

**Dependencies:** T-V2-3A (schema), Phase 1 TA engine

**Rollback:** Delete service file

---

### T-V2-3C — aiWorkflow Classification Integration

**Task ID:** T-V2-3C
**Phase:** v2.Phase 3 — Signal Classification
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** C (depends on T-V2-3B)

**Objective:** Wire signal classification into `aiWorkflow.cron.ts` after signal creation.

**File to modify:** `backend/src/crons/aiWorkflow.cron.ts`

**Location:** After `executeSignalDecision` call (line 643).

**Flow:**
```typescript
if (env.SIGNAL_CLASSIFICATION_ENABLED && taResult && signalId !== null) {
    const classification = await classifySignal({ eventType, taResult });
    
    if (!classification.meetsMinimumRR) {
        logger.warn(`[Classification] Signal rejected: RR ${classification.riskRewardRatio.toFixed(2)} below minimum`);
        // Close just-created signal, clear radar signal
    } else {
        await db.update(radarSignals).set({...}).where(eq(radarSignals.id, signalId));
    }
}
```

**Env flag:** `SIGNAL_CLASSIFICATION_ENABLED: z.boolean().default(false)`

**Key constraint:** RR rejection = signal rejected entirely, not downgraded.

**Dependencies:** T-V2-3B (classification service)

**Rollback:** Remove classification block + env flag

---

### T-V2-3Q — Phase 3 QA

**Task ID:** T-V2-3Q
**Phase:** v2.Phase 3 — Signal Classification
**Assigned Agent:** QA & Security Hunter
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** D (depends on ALL above tasks)

**Audit checklist:** All 8 radar_signals columns, all 7 signal_performance columns, eventType mapping (8 types), horizonDays correct, RR calculation correct, rejection when RR < minimum.

**Dependencies:** T-V2-3A through T-V2-3C

---

---

# Phase 2 — Market Regime Detection

## PHASE 2 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-2A | Regime DB field + env flags | ⬜ |
| T-V2-2B | Market Regime Service | ⬜ |
| T-V2-2C | Regime Update Cron | ⬜ |
| T-V2-2Q | Phase 2 QA | ⬜ |

---

### T-V2-2A — Regime DB Field + Env Flags

**Task ID:** T-V2-2A
**Phase:** v2.Phase 2 — Market Regime Detection
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** A (parallel with T-V2-05A/B)

**Objective:** Add `currentRegime` field to `coin_intelligence_cache` and regime-related env flags.

**Files created/modified:** `backend/scripts/migrate-regime.sql` (new), `backend/src/models/market.model.ts`, `backend/src/config/env.ts`

**Migration SQL:**
```sql
ALTER TABLE coin_intelligence_cache ADD COLUMN current_regime VARCHAR(20) DEFAULT 'SIDEWAYS';
```

**Migration guard:** Insert `market_regime_schema` into `migration_flags`.

**Env flags:**
```typescript
MARKET_REGIME_ENABLED: z.boolean().default(false),
MARKET_REGIME_REFRESH_INTERVAL_MS: z.number().default(4 * 60 * 60 * 1000),
```

**Dependencies:** None

**Rollback:** Revert ALTER TABLE

---

### T-V2-2B — Market Regime Service

**Task ID:** T-V2-2B
**Phase:** v2.Phase 2 — Market Regime Detection
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** B (depends on T-V2-2A)

**Objective:** Create `backend/src/services/marketRegime.service.ts` — determines regime (RISK_ON, RISK_OFF, TRENDING, SIDEWAYS, VOLATILE) per coin.

**File to create:** `backend/src/services/marketRegime.service.ts`

**Regime Types:**

| Regime | Conditions | Modifier |
|---|---|---|
| RISK_ON | Low volatility + strong volume + bullish structure | 0 |
| RISK_OFF | Macro fear + declining volume + bearish structure | -20 |
| TRENDING | Clear EMA alignment + BOS confirmed | 0 |
| SIDEWAYS | EMAs intertwined + low volume + no BOS | -10 |
| VOLATILE | Price change > 8% in 4h + volume spike | -30 |

**Exported functions:**
```typescript
export async function detectRegime(symbol: string): Promise<RegimeResult>
export async function detectAllRegimes(): Promise<Map<string, RegimeResult>>
```

**RegimeResult:**
```typescript
type RegimeType = 'RISK_ON' | 'RISK_OFF' | 'TRENDING' | 'SIDEWAYS' | 'VOLATILE';

interface RegimeResult {
    regime: RegimeType;
    confidence: number;
    regimeModifier: number;
    reasoning: string;
    keyIndicators: {
        priceChange4h: number;
        volumeRatio: number;
        emaAlignment: 'bullish' | 'bearish' | 'neutral';
        bosConfirmed: boolean;
        fearGreedIndex: number | null;
        macroKeywordsDetected: string[];
    };
}
```

**Algorithm:**
```
1. VOLATILE check first (priority): priceChange4h > 8% → return VOLATILE, -30
2. MACRO KEYWORDS check: detected → return RISK_OFF, -20
3. RISK_ON: volumeRatio > 1.2 AND bullish alignment AND bosConfirmed → 0
4. TRENDING: EMA20 > EMA50 > EMA200 AND bosConfirmed → 0
5. Default: SIDEWAYS → -10
```

**Dependencies:** T-V2-2A (schema), Phase 1 TA engine

**Rollback:** Delete service file

---

### T-V2-2C — Regime Update Cron

**Task ID:** T-V2-2C
**Phase:** v2.Phase 2 — Market Regime Detection
**Assigned Agent:** Senior Developer
**Status:** ⬜ NOT STARTED
**Deploy Group:** C (depends on T-V2-2B)

**Objective:** Create `backend/src/crons/regimeUpdate.cron.ts` — runs every 4 hours to refresh regime for all 11 tracked coins.

**File to create:** `backend/src/crons/regimeUpdate.cron.ts`

**Schedule:** `0 */4 * * *`

**Algorithm:**
```
1. If MARKET_REGIME_ENABLED === false: exit
2. For each coin in TRACKED_COINS:
   a. detectRegime(coin)
   b. Update coin_intelligence_cache.currentRegime
```

**Dependencies:** T-V2-2B (regime service), T-V2-2A (env flag)

**Rollback:** Delete cron file

---

### T-V2-2Q — Phase 2 QA

**Task ID:** T-V2-2Q
**Phase:** v2.Phase 2 — Market Regime Detection
**Assigned Agent:** QA & Security Hunter
**Status:** ⬜ NOT STARTED
**Deploy Group:** D (depends on T-V2-2A, T-V2-2B, T-V2-2C)

**Audit checklist:** Schema column, 5 regime types, VOLATILE priority, macro keywords → RISK_OFF, RISK_ON conditions, TRENDING conditions, SIDEWAYS default, modifier values, cron schedule.

**Dependencies:** T-V2-2A through T-V2-2C

---

---

# Phase 4 — TP/SL Engine Overhaul

## PHASE 4 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-4A | New TP/SL Calculator Service | ✅ DONE |
| T-V2-4B | TP/SL Sanity Gate | ✅ DONE |
| T-V2-4C | aiWorkflow TP/SL Wiring | ✅ DONE |
| T-V2-4Q | Phase 4 QA | ✅ DONE (QA PASSED — Round 2) |

---

### T-V2-4A — New TP/SL Calculator Service

**Task ID:** T-V2-4A
**Phase:** v2.Phase 4 — TP/SL Engine Overhaul
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** A (depends on T-V2-3B)

**Objective:** Create `backend/src/services/tpslCalculatorV2.service.ts` — algorithm-driven TP/SL from Phase 1 S/R engine with RR-gated rejection.

**File to create:** `backend/src/services/tpslCalculatorV2.service.ts`

**Exported function:**
```typescript
export async function calculateTpslV2(params: {
    entryPrice: number;
    direction: 'bullish' | 'bearish';
    signalType: 'tactical' | 'strategic';
    taResult: TechnicalAnalysisFullResult;
}): Promise<TpslV2Result>
```

**TpslV2Result:**
```typescript
interface TpslV2Result {
    takeProfitPrice: number;
    stopLossPrice: number;
    tpSource: 'resistance' | 'liquidity' | 'atr';
    slSource: 'invalidation' | 'support' | 'atr';
    riskRewardRatio: number;
    isRejected: boolean;
    rejectionReason: string | null;
    entryZoneLow: number;
    entryZoneHigh: number;
}
```

**TP Priority:** resistance → liquidity → ATR (1.5x). **SL Priority:** invalidation → support (strength>=60) → ATR (1x). **RR Gate:** TACTICAL < 2 → rejected. STRATEGIC < 3 → rejected.

**Dependencies:** T-V2-3B (classification service), Phase 1 TA engine

**Rollback:** Delete service file

---

### T-V2-4B — TP/SL Sanity Gate

**Task ID:** T-V2-4B
**Phase:** v2.Phase 4 — TP/SL Engine Overhaul
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** B (depends on T-V2-4A)

**Objective:** Create `backend/src/services/tpslSanityGate.service.ts` — validates TP/SL before any signal is saved.

**File to create:** `backend/src/services/tpslSanityGate.service.ts`

**Exported function:**
```typescript
export function validateTpslSanity(params: {
    entryPrice: number;
    direction: 'bullish' | 'bearish';
    tpPrice: number;
    slPrice: number;
    rrRatio: number;
    signalType: 'tactical' | 'strategic';
}): SanityValidationResult
```

**SanityValidationResult:**
```typescript
interface SanityValidationResult {
    isValid: boolean;
    failures: string[];
}
```

**Checks:** Bullish TP > entry, Bullish SL < entry, Bearish TP < entry, Bearish SL > entry, TP distance 1-40%, SL distance 1-40%, RR meets minimum.

**Dependencies:** T-V2-4A (V2 calculator)

**Rollback:** Delete service file

---

### T-V2-4C — aiWorkflow TP/SL Wiring

**Task ID:** T-V2-4C
**Phase:** v2.Phase 4 — TP/SL Engine Overhaul
**Assigned Agent:** Senior Developer
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** C (depends on T-V2-4B)

**Objective:** Wire the V2 TP/SL calculator into `aiWorkflow.cron.ts`, replacing the old call.

**File to modify:** `backend/src/crons/aiWorkflow.cron.ts`

**Changes:** Add imports for `calculateTpslV2` and `validateTpslSanity`. Replace old `calculateTpsl` call with V2 flow (calculateTpslV2 → validateTpslSanity → reject if invalid else use V2 TP/SL). Old `calculateTpsl` remains as fallback when `TPSL_V2_ENABLED === false`.

**Env flag:** `TPSL_V2_ENABLED: z.boolean().default(false)`

**Key constraint:** Sanity gate rejection = signal not saved (not downgraded).

**Dependencies:** T-V2-4A (V2 calculator), T-V2-4B (sanity gate)

**Rollback:** Revert aiWorkflow changes, remove env flag

---

### T-V2-4Q — Phase 4 QA

**Task ID:** T-V2-4Q
**Phase:** v2.Phase 4 — TP/SL Engine Overhaul
**Assigned Agent:** QA & Security Hunter
**Status:** ✅ DONE (QA PASSED — Round 2)
**Deploy Group:** D (depends on T-V2-4A, T-V2-4B, T-V2-4C)

**Audit checklist:** TP priority (resistance→liquidity→ATR), SL priority (invalidation→support→ATR), RR gates (tactical<2 rejected, strategic<3 rejected), sanity checks (6 checks), fallback when flag off.

**Dependencies:** T-V2-4A through T-V2-4C

---

---

## FILES SUMMARY (Tranche 2)

| File | Tasks |
|---|---|
| `backend/scripts/migrate-shadow-signals.sql` | T-V2-05A |
| `backend/scripts/migrate-signal-classification.sql` | T-V2-3A |
| `backend/scripts/migrate-regime.sql` | T-V2-2A |
| `backend/src/models/market.model.ts` | T-V2-05A, T-V2-3A, T-V2-2A |
| `backend/src/config/env.ts` | T-V2-05B, T-V2-05E, T-V2-2A |
| `backend/src/services/shadowSignals.service.ts` | T-V2-05C |
| `backend/src/crons/shadowChecker.cron.ts` | T-V2-05D |
| `backend/src/middleware/adminAuth.middleware.ts` | T-V2-05E |
| `backend/src/routes/admin.routes.ts` | T-V2-05F |
| `backend/src/controllers/admin.controller.ts` | T-V2-05F |
| `backend/src/services/signalClassification.service.ts` | T-V2-3B |
| `backend/src/services/marketRegime.service.ts` | T-V2-2B |
| `backend/src/crons/regimeUpdate.cron.ts` | T-V2-2C |
| `backend/src/services/tpslCalculatorV2.service.ts` | T-V2-4A |
| `backend/src/services/tpslSanityGate.service.ts` | T-V2-4B |
| `backend/src/crons/aiWorkflow.cron.ts` | T-V2-05G, T-V2-3C, T-V2-4C |
| `frontend/src/app/admin/shadow/page.tsx` | T-V2-05H |

**Total: 10 new files, 4 modified files, 3 migration scripts**

---

*Plan authored: May 10, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/nextstep2.md (v2.0 — APPROVED)*
*Next: Senior Developer executes Phase 0.5 → Phase 3 → Phase 2 → Phase 4*

## PHASE 0.5 SCOPE

## REQUIRED TASKS

---

# Phase 5 — Signal Lifecycle System

## PHASE 5 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-5A | signal_performance lifecycle columns + migration | ✅ DONE (QA PASSED) |
| T-V2-5B | Signal Lifecycle Service (lifecycle state machine) | ✅ DONE (QA PASSED) |
| T-V2-5C | Lifecycle State Cron (partial_tp, breakeven, auto-close) | ✅ DONE (QA PASSED) |
| T-V2-5D | aiWorkflow Lifecycle Integration (signal_state field) | ✅ DONE (QA PASSED) |
| T-V2-5Q | Phase 5 QA | ✅ DONE (QA PASSED) |

---

### T-V2-5A — signal_performance Lifecycle Columns

**Task ID:** T-V2-5A
**Phase:** v2.Phase 5 — Signal Lifecycle
**Status:** ⬜ NOT STARTED
**Deploy Group:** A

**Files:** backend/scripts/migrate-signal-lifecycle.sql (new) + backend/src/models/market.model.ts

**Migration SQL:**
```sql
ALTER TABLE signal_performance ADD COLUMN signal_state VARCHAR(30) DEFAULT 'NEW';
ALTER TABLE signal_performance ADD COLUMN price72h REAL;
ALTER TABLE signal_performance ADD COLUMN pnl72h REAL;
ALTER TABLE signal_performance ADD COLUMN is_win72h BOOLEAN;
ALTER TABLE signal_performance ADD COLUMN partial_tp_hit_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN breakeven_moved_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN close_reason VARCHAR(50);
```

**Migration guard:** INSERT INTO migration_flags VALUES ('signal_lifecycle_schema')

**Drizzle model:** Update signalPerformance — add signalState, price72h, pnl72h, isWin72h, partialTpHitAt, breakevenMovedAt, closeReason
**Rollback:** Revert ALTER TABLE

---

### T-V2-5B — Signal Lifecycle Service

**Task ID:** T-V2-5B
**Phase:** v2.Phase 5 — Signal Lifecycle
**Status:** ⬜ NOT STARTED
**Deploy Group:** B

**File:** backend/src/services/signalLifecycle.service.ts (new)

**Exported functions:**
```typescript
export async function updateSignalState(signalId: number, newState: SignalState): Promise<void>
export async function checkPartialTp(signalId: number, currentPrice: number, entryPrice: number, tp: number): Promise<boolean>
export async function moveStopToBreakeven(signalId: number): Promise<void>
export async function autoCloseSignal(signalId: number, reason: CloseReason): Promise<void>
export async function getSignalsByState(state: SignalState): Promise<SignalPerformanceRow[]>
```

**SignalState enum:** 'NEW' | 'WAITING_CONFIRMATION' | 'ACTIVE' | 'PARTIAL_TP' | 'BREAKEVEN' | 'CLOSED'

**State machine:**
- NEW → WAITING_CONFIRMATION (quality >= 60 but not at entry zone)
- WAITING_CONFIRMATION → ACTIVE (price enters entry zone)
- ACTIVE → PARTIAL_TP (price reaches 50% of TP distance)
- PARTIAL_TP → BREAKEVEN (SL moved to entry)
- ANY → CLOSED (TP hit / SL hit / Expired / Thesis reversed)

**Checkpoint schedule:** 24h (all), 72h (TACTICAL), 7d (STRATEGIC), 30d (STRATEGIC)

**Dependencies:** T-V2-5A
**Rollback:** Delete service file

---

### T-V2-5C — Lifecycle State Cron

**Task ID:** T-V2-5C
**Phase:** v2.Phase 5 — Signal Lifecycle
**Status:** ⬜ NOT STARTED
**Deploy Group:** C

**File:** backend/src/crons/signalLifecycle.cron.ts (new)

**Schedule:** */15 * * * * (every 15 minutes)

**Logic:**
1. Fetch all ACTIVE signals
2. For each: check if PARTIAL_TP or BREAKEVEN conditions met
3. Check 72h checkpoint for TACTICAL signals
4. Check 7d checkpoint for STRATEGIC signals
5. Auto-close expired signals (72h TACTICAL, 21d STRATEGIC)

**Env flag:** SIGNAL_LIFECYCLE_ENABLED (default false)
**Dependencies:** T-V2-5B, env flag
**Rollback:** Delete cron file

---

### T-V2-5D — aiWorkflow Lifecycle Integration

**Task ID:** T-V2-5D
**Phase:** v2.Phase 5 — Signal Lifecycle
**Status:** ⬜ NOT STARTED
**Deploy Group:** D

**File:** backend/src/crons/aiWorkflow.cron.ts

**Change:** After executeSignalDecision, set signal_state = 'NEW' on the new signal_performance row.

**Dependencies:** T-V2-5B
**Rollback:** Revert aiWorkflow changes

---

### T-V2-5Q — Phase 5 QA

**Task ID:** T-V2-5Q
**Phase:** v2.Phase 5 — Signal Lifecycle
**Status:** ⬜ NOT STARTED
**Deploy Group:** E

**Audit:** signal_state enum values, state machine transitions, auto-close rules, checkpoint schedule.

**Dependencies:** T-V2-5A through T-V2-5D

---

---

# Phase 7.1 — Daily Trend Context

## PHASE 7.1 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-71A | daily_trend column in coin_intelligence_cache + env flag | ✅ DONE (QA PASSED) |
| T-V2-71B | Daily Trend Service (EMA from 1d candles) | ✅ DONE (QA PASSED) |
| T-V2-71C | Daily Trend Cron (refresh every 6h) | ✅ DONE (QA PASSED) |
| T-V2-71D | aiWorkflow Daily Trend Integration | ✅ DONE (QA PASSED) |
| T-V2-71Q | Phase 7.1 QA | ✅ DONE (QA PASSED) |

---

### T-V2-71A — daily_trend Column

**Task ID:** T-V2-71A
**Phase:** v2.Phase 7.1 — Daily Trend Context
**Status:** ⬜ NOT STARTED
**Deploy Group:** A

**Files:** backend/scripts/migrate-daily-trend.sql (new) + backend/src/models/market.model.ts + backend/src/config/env.ts

**Migration SQL:**
```sql
ALTER TABLE coin_intelligence_cache ADD COLUMN daily_trend VARCHAR(20) DEFAULT 'SIDEWAYS';
```

**Env flag:** DAILY_TREND_ENABLED: z.boolean().default(false)

**Migration guard:** INSERT INTO migration_flags VALUES ('daily_trend_column')
**Rollback:** Revert ALTER TABLE

---

### T-V2-71B — Daily Trend Service

**Task ID:** T-V2-71B
**Phase:** v2.Phase 7.1 — Daily Trend Context
**Status:** ⬜ NOT STARTED
**Deploy Group:** B

**File:** backend/src/services/dailyTrend.service.ts (new)

**Exported function:**
```typescript
export async function calculateDailyTrend(symbol: string): Promise<TrendLabel>
```

**Logic:**
- Read EMA-20, EMA-50, EMA-200 from ohlcv_indicators (timeframe='1d')
- Apply same trend detection algorithm as detectTrend() in technicalAnalysis.service.ts
- Return: STRONG_BULLISH | BULLISH | SIDEWAYS | BEARISH | STRONG_BEARISH

**Rule:** Uptrend signals ONLY generate when daily_trend is BULLISH or STRONG_BULLISH

**Dependencies:** T-V2-71A, Phase 1 TA engine
**Rollback:** Delete service file

---

### T-V2-71C — Daily Trend Cron

**Task ID:** T-V2-71C
**Phase:** v2.Phase 7.1 — Daily Trend Context
**Status:** ⬜ NOT STARTED
**Deploy Group:** C

**File:** backend/src/crons/dailyTrend.cron.ts (new)

**Schedule:** 0 */6 * * * (every 6 hours)

**Logic:**
1. If DAILY_TREND_ENABLED === false: exit
2. For each coin in TRACKED_COINS:
   a. calculateDailyTrend(coin)
   b. Update coin_intelligence_cache.daily_trend for that coin

**Dependencies:** T-V2-71B, T-V2-71A (env flag)
**Rollback:** Delete cron file

---

### T-V2-71D — aiWorkflow Daily Trend Integration

**Task ID:** T-V2-71D
**Phase:** v2.Phase 7.1 — Daily Trend Context
**Status:** ⬜ NOT STARTED
**Deploy Group:** D

**File:** backend/src/crons/aiWorkflow.cron.ts

**Change:** Before generating signal, check coin_intelligence_cache for daily_trend. If BEARISH or STRONG_BEARISH for the coin, skip signal generation (reduced confidence mode).

**New import:** calculateDailyTrend from dailyTrend.service.ts

**Dependencies:** T-V2-71B, T-V2-71C
**Rollback:** Revert aiWorkflow changes

---

### T-V2-71Q — Phase 7.1 QA

**Task ID:** T-V2-71Q
**Phase:** v2.Phase 7.1 — Daily Trend Context
**Status:** ⬜ NOT STARTED
**Deploy Group:** E

**Audit:** daily_trend column, EMA calculation from 1d indicators, 6h refresh, aiWorkflow integration (skip if BEARISH/STRONG_BEARISH).

**Dependencies:** T-V2-71A through T-V2-71D

---

---

# Phase 9 — Airdrop System Redesign

## PHASE 9 SCOPE

| Task ID | Description | Status |
|---|---|---|
| T-V2-9A | airdrop_projects schema changes + migration | ✅ DONE (QA PASSED) |
| T-V2-9B | Airdrop Quality Scoring Service | ✅ DONE (QA PASSED) |
| T-V2-9C | Airdrop Service Updates (remove tasks/wallet/auto-verify) | ✅ DONE (QA PASSED) |
| T-V2-9D | Airdrop Frontend Card Redesign | ✅ DONE (QA PASSED) |
| T-V2-9Q | Phase 9 QA | ✅ DONE (QA PASSED) |

---

### T-V2-9A — airdrop_projects Schema Changes

**Task ID:** T-V2-9A
**Phase:** v2.Phase 9 — Airdrop System Redesign
**Status:** ⬜ NOT STARTED
**Deploy Group:** A

**Files:** backend/scripts/migrate-airdrop-redesign.sql (new) + backend/src/models/market.model.ts

**REMOVED tables:**
- airdrop_tasks table (DROP TABLE airdrop_tasks)
- user_progress table (DROP TABLE user_progress)

**ADDED columns to airdrop_projects:**
```sql
ALTER TABLE airdrop_projects ADD COLUMN ecosystem VARCHAR(20);
ALTER TABLE airdrop_projects ADD COLUMN effort_level VARCHAR(10);
ALTER TABLE airdrop_projects ADD COLUMN reward_confidence VARCHAR(20);
ALTER TABLE airdrop_projects ADD COLUMN quality_score INT DEFAULT 0;
```

**ecosystem mapping:**
- ETH: L2s, DeFi protocols, restaking
- SOL: DePIN, Gaming, consumer apps
- TON: Telegram-native projects only
- BNB: BSC DeFi, GameFi
- Others: Direct project airdrops only

**Migration guard:** INSERT INTO migration_flags VALUES ('airdrop_redesign_schema')
**Rollback:** Revert changes + recreate dropped tables if needed

---

### T-V2-9B — Airdrop Quality Scoring Service

**Task ID:** T-V2-9B
**Phase:** v2.Phase 9 — Airdrop System Redesign
**Status:** ⬜ NOT STARTED
**Deploy Group:** B

**File:** backend/src/services/airdropQuality.service.ts (new)

**Exported function:**
```typescript
export function calculateAirdropQuality(project: AirdropProjectInput): AirdropQualityResult
```

**AirdropQualityResult:**
```typescript
{
  qualityScore: number;
  ecosystem: string;
  effortLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  rewardConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  isEligible: boolean;
}
```

**Quality Scoring (weighted):**
- Ecosystem connection to 11 coins: 30%
- Verified funding or backing: 25%
- Real community size: 20%
- Effort vs reward ratio: 15%
- Risk level: 10%

**Hard rule:** Score < 60 → never reaches database. Score < 75 → marked low confidence.

**Dependencies:** T-V2-9A
**Rollback:** Delete service file

---

### T-V2-9C — Airdrop Service Updates

**Task ID:** T-V2-9C
**Phase:** v2.Phase 9 — Airdrop System Redesign
**Status:** ⬜ NOT STARTED
**Deploy Group:** C

**Files:** backend/src/services/airdrop.service.ts (modify)

**Changes:**
1. Remove wallet verification logic
2. Remove auto-verification system
3. Remove user_progress tracking
4. Remove airdrop_tasks table references
5. Add quality score calculation on project insertion
6. Add ecosystem badge logic

**Frontend card should show:** Effort indicator, ecosystem badge, risk verdict, deadline urgency, reward confidence, quality score. NO tasks, NO progress bars, NO wallet connection.

**Dependencies:** T-V2-9A, T-V2-9B
**Rollback:** Revert airdrop.service.ts changes

---

### T-V2-9D — Airdrop Frontend Card Redesign

**Task ID:** T-V2-9D
**Phase:** v2.Phase 9 — Airdrop System Redesign
**Status:** ⬜ NOT STARTED
**Deploy Group:** D

**Files:** frontend/src/features/airdrops/components/AirdropCard.tsx (modify)

**New card shows:**
- Effort indicator (LOW/MEDIUM/HIGH)
- Ecosystem badge (ETH/SOL/TON/BNB/Other)
- Risk verdict
- Deadline urgency
- Reward confidence (HIGH/MEDIUM/LOW/UNVERIFIED)
- Quality score (0-100, color coded)

**Removed:**
- Task list
- Progress bar
- Wallet connection

**Dependencies:** T-V2-9C
**Rollback:** Revert frontend changes

---

### T-V2-9Q — Phase 9 QA

**Task ID:** T-V2-9Q
**Phase:** v2.Phase 9 — Airdrop System Redesign
**Status:** ⬜ NOT STARTED
**Deploy Group:** E

**Audit:** Removed tables (airdrop_tasks, user_progress), new columns, quality scoring formula, ecosystem filtering, frontend card redesign.

**Dependencies:** T-V2-9A through T-V2-9D

---

---

## FILES SUMMARY (Tranche 3 — Can Start Now)

| File | Tasks |
|---|---|
| backend/scripts/migrate-signal-lifecycle.sql | T-V2-5A |
| backend/scripts/migrate-daily-trend.sql | T-V2-71A |
| backend/scripts/migrate-airdrop-redesign.sql | T-V2-9A |
| backend/src/models/market.model.ts | T-V2-5A, T-V2-71A, T-V2-9A |
| backend/src/config/env.ts | T-V2-5A, T-V2-71A |
| backend/src/services/signalLifecycle.service.ts | T-V2-5B |
| backend/src/services/dailyTrend.service.ts | T-V2-71B |
| backend/src/services/airdropQuality.service.ts | T-V2-9B |
| backend/src/services/airdrop.service.ts | T-V2-9C |
| backend/src/crons/signalLifecycle.cron.ts | T-V2-5C |
| backend/src/crons/dailyTrend.cron.ts | T-V2-71C |
| backend/src/crons/aiWorkflow.cron.ts | T-V2-5D, T-V2-71D |
| frontend/src/features/airdrops/components/AirdropCard.tsx | T-V2-9D |

**Total: 8 new files, 4 modified files, 3 migration scripts**

---

*Plan authored: May 10, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/nextstep2.md*
*Next: Senior Developer executes Phase 5 + Phase 7.1 + Phase 9 in parallel (Groups A→B→C→D→E)*

---
---

# HOTFIX — Shadow Mode Dashboard Fixes + Scorecard Soft-Launch Popup

**Status:** 🟡 IN PROGRESS — Group 1 DONE (T-HF-01, T-HF-02, T-HF-05 ✅ QA PASSED) | Group 2 STARTED
**Date:** May 11, 2026
**Priority:** P0 (Hotfix — post-QA fixes for existing Shadow Mode dashboard)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/hotfix-shadow-mode-scorecard.md`
**Assigned Agent:** Senior Developer

> **⚠️ IMPORTANT:** These are NEW tasks (T-HF-01 through T-HF-12, T-SC-01, T-SC-02, T-HF-QA).
> Do NOT confuse with old tasks (HF-1 through HF-5) which are from a different plan and already DONE.

## SCOPE — 15 Micro-Tasks

| # | Task ID | Description | File | Status |
|---|---|---|---|---|
| 1 | T-HF-01 | Fix BUY/SELL in `mapTrendToVerdict()` | `aiWorkflow.cron.ts:85-93` | ✅ DONE (QA PASSED) |
| 2 | T-HF-02 | Extract `getVerdictDirection()` helper + refactor `calculatePnl()` | `shadowSignals.service.ts:185-196` | ✅ DONE (QA PASSED) |
| 3 | T-HF-03 | Fix frontend double-fetch on Apply/Clear Filters | `admin/shadow/page.tsx:362-379` | ✅ DONE |
| 4 | T-HF-04 | Fix AbortController leak | `admin/shadow/page.tsx:83-84,203` | ✅ DONE |
| 5 | T-HF-05 | Fix `taResult.qualityScore.score` null guard | `aiWorkflow.cron.ts:784` | ✅ DONE (QA PASSED) |
| 6 | T-HF-06 | Add rate limiting to admin login | `adminAuth.middleware.ts:~89` | ⬜ NOT STARTED |
| 7 | T-HF-07 | Fix N+1 in shadow resolution (eliminate redundant SELECTs) | `shadowChecker.cron.ts:52-87` + `shadowSignals.service.ts` | ⬜ NOT STARTED |
| 8 | T-HF-08 | Fix plaintext password comparison (timing-safe) | `adminAuth.middleware.ts:117` | ⬜ NOT STARTED |
| 9 | T-HF-09 | Add partial index for unresolved signals query | New: `migrate-shadow-signals-index.sql` | ⬜ NOT STARTED |
| 10 | T-HF-10 | Add Redis migration comment to session store | `adminAuth.middleware.ts` | ⬜ NOT STARTED |
| 11 | T-HF-11 | Optimize `getShadowStats()` to single query | `shadowSignals.service.ts:123-178` | ⬜ NOT STARTED |
| 12 | T-HF-12 | Add auto-refresh to shadow dashboard | `admin/shadow/page.tsx` | ⬜ NOT STARTED |
| 13 | T-SC-01 | Create ScorecardSoftLaunchPopup component | New: `scorecard/ScorecardSoftLaunchPopup.tsx` | ⬜ NOT STARTED |
| 14 | T-SC-02 | Integrate popup into scorecard page | `scorecard/page.tsx` | ⬜ NOT STARTED |
| 15 | T-HF-QA | Final QA — full verification | All modified files | ⬜ NOT STARTED |

## EXECUTION GROUPS (Parallel Where Possible)

```
Group 1 — Backend Critical (SEQUENTIAL within group):
  T-HF-01 → T-HF-02 → T-HF-05

Group 2 — Frontend Critical (PARALLEL with Group 1):
  T-HF-03 + T-HF-04

─── Groups 1+2 must complete before Groups 3+4+5 ───

Group 3 — Security (PARALLEL):
  T-HF-06 + T-HF-08

Group 4 — Performance (PARALLEL with Group 3):
  T-HF-07 + T-HF-09 + T-HF-11

Group 5 — Medium + Scorecard (PARALLEL with Groups 3+4):
  T-HF-10 + T-HF-12 + T-SC-01 + T-SC-02

─── All groups must complete before QA ───

Group 6 — Final QA:
  T-HF-QA
```

## HARD RULES

1. **No new packages** — everything uses existing dependencies
2. **Zero `any` types** in any modified file
3. **All DB migrations** guarded by `migration_flags`
4. **BUY/SELL** terminology only allowed in AI-input mapping functions (with comment)
5. **Admin routes** return 404 for unauthenticated/blocked (never 401/429)
6. **Scorecard popup** is client-only — no SSR impact
7. **Backward compatible** — old shadow signals with BUY/SELL verdicts must still resolve correctly

## DETAILED TASK SPECS

Full implementation details for each task are in:
**`plans/THE SUPREME REVIEWER_plans/hotfix-shadow-mode-scorecard.md`**

The Senior Developer MUST read that file before starting execution.

---

*Plan authored: May 11, 2026 | Strategic Planner*
*Plan source: plans/THE SUPREME REVIEWER_plans/hotfix-shadow-mode-scorecard.md*
*Next: Senior Developer executes Group 1 (T-HF-01 → T-HF-02 → T-HF-05)*

