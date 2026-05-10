# OnlyAlpha — Phase Implementation Prompts

> **How to use:** Give the Senior Developer the **Quick Summary** for the phase. If they need full detail, point them to the corresponding prompt section below.

---

## Quick Reference — All Phases

| Phase | Summary | Dependencies | Batch | Status |
|---|---|---|---|---|
| **Phase 1** | Technical Analysis Engine — EMA, S/R, Market Structure, Candle Patterns, Volume, Quality Score. Single new service file. Zero Binance calls (all data from ohlcvSnapshot service). | Phase 0.1 (DONE) | 1 | READY |
| **Phase 9** | Airdrop Redesign — Drop old task/progress tables. Add ecosystem, effort, confidence, quality_score to airdrop_projects. Quality gate < 60 = reject. | Phase 0 (DONE) | 1 | READY |
| **Phase 1.5** | Backtesting Framework — Run Phase 1 engine on 90 days of historical 4H candles. Validate 5 pass criteria before shadow mode. READ-ONLY script. | Phase 1 | 2 | BLOCKED |
| **Phase 0.5** | Shadow Mode + Admin Dashboard — Compare algorithm vs AI side-by-side. shadow_signals table, checker cron every 15min, Redis admin auth, dashboard UI. | Phase 1 + 1.5 | 3 | BLOCKED |
| **Phase 2** | Market Regime Detection — RISK_ON/OFF/TRENDING/SIDEWAYS/VOLATILE. Uses BTC 4H analysis + Fear & Greed API + macro keyword scan. | Phase 1 | 3 | BLOCKED |
| **Phase 3** | Signal Classification — TACTICAL (3d) vs STRATEGIC (14d/21d). RR minimums (1:2 / 1:3). Entry zones, invalidation levels. Additive migration to radar_signals. | Phase 1 | 3 | BLOCKED |
| **Phase 4** | TP/SL Engine Overhaul — Algorithm-based TP (S/R → Liquidity → ATR) and SL (Invalidation → S/R → ATR). Sanity gate validation. Replace existing calculator. | Phase 1 + 3 | 4 | BLOCKED |
| **Phase 6** | AI Role Refinement — AI reduced to catalyst validator only. Tiny JSON prompt. One call per signal. `valid`/`thesis`/`modifier`. Final confidence = algorithm + AI modifier + regime. | Phase 1 + 2 | 4 | BLOCKED |
| **Phase 5** | Signal Lifecycle — NEW → WAITING_CONFIRMATION → ACTIVE → PARTIAL_TP → BREAKEVEN → CLOSED. Auto-close rules per signal type. Breakeven after partial TP. | Phase 3 + 4 | 5 | BLOCKED |
| **Phase 7** | Multi-Timeframe — Daily trend, Weekly bias, 4H entry levels, Multi-TF classification label (TREND_FOLLOWING / COUNTER_TREND / PULLBACK / NO_SIGNAL). | Phase 1 | 5 | BLOCKED |
| **Phase 8** | Scorecard Redesign — 4 stat cards, Tactical/Strategic tabs, lifecycle badges, quality score colors, per-coin table, completed timeline. | Phase 5 + 6 | 6 | BLOCKED |

---

## Execution Order

```
BATCH 1 (Can run in parallel NOW):
  ├── Phase 1  (Technical Analysis Engine)
  └── Phase 9  (Airdrop Redesign)

BATCH 2 (After Phase 1):
  └── Phase 1.5  (Backtesting — must PASS before Batch 3)

BATCH 3 (After Phase 1.5 passes):
  ├── Phase 2   (Market Regime)
  ├── Phase 3   (Signal Classification)
  └── Phase 0.5 (Shadow Mode — after backtest pass)

BATCH 4 (After Phase 3):
  ├── Phase 4   (TP/SL Engine)
  └── Phase 6   (AI Role Refinement)

BATCH 5 (After Phase 4):
  ├── Phase 5   (Signal Lifecycle)
  └── Phase 7   (Multi-Timeframe)

BATCH 6 (After Phase 5 + 6):
  └── Phase 8   (Scorecard Redesign)
```

---

# PROMPT: Phase 1 — Technical Analysis Engine

**Summary:** Create `technicalAnalysis.service.ts` with 7 exported functions: trend detection (EMA alignment), support/resistance (swing lows/highs + clustering + strength scoring), market structure (HH/HL, BOS, CHOCH), candle patterns (3-condition gate: pattern + volume + S/R alignment), volume confirmation, quality score (0-100), and a master `runFullAnalysis()` that combines all. All data from `ohlcvSnapshot.service.ts` — no direct Binance calls. Quality < 60 = rejected.

---

## Context

You are the Senior Developer on OnlyAlpha. Phase 0 (Coin Filter) and Phase 0.1 (OHLCV Data Infrastructure) are COMPLETE. The following infrastructure exists:

- `backend/src/config/coins.ts` — 11 tracked coins (`TRACKED_COINS`, `isTrackedCoin`)
- `backend/src/services/ohlcvSnapshot.service.ts` — `fetchAndStoreCandles`, `computeIndicators`, `getCandles`, `getLatestIndicator`, `getIndicatorAtTime`
- `backend/src/models/market.model.ts` — `ohlcvCandles`, `ohlcvIndicators` tables
- `backend/src/services/binance.service.ts` — `getCoinKlinesRange`, `getLivePrices`
- All EMA-20/50/200, ATR-14, volume_avg_20 are pre-computed in `ohlcv_indicators`

## File to Create

`backend/src/services/technicalAnalysis.service.ts`

## Exports Required

### 1. `calculateTrend(coin: string, timeframe: string): Promise<TrendResult>`

Reads latest `ohlcv_indicators` for `(coin, timeframe)`. Uses live price from `getLivePrices()`.

Trend detection using EMA alignment:

| Condition | Trend Label |
|---|---|
| Price > EMA20 > EMA50 > EMA200 | STRONG_BULLISH |
| Price > EMA50, EMA20 > EMA50 | BULLISH |
| EMAs intertwined (all within 1% of each other) | SIDEWAYS |
| Price < EMA50, EMA20 < EMA50 | BEARISH |
| Price < EMA20 < EMA50 < EMA200 | STRONG_BEARISH |

If any required EMA is null (insufficient data), return `TREND_UNKNOWN`.

```typescript
interface TrendResult {
    trend: 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH' | 'TREND_UNKNOWN';
    price: number;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
}
```

### 2. `calculateSupportResistance(coin: string, timeframe: string, lookback?: number): Promise<SRResult>`

Extracts S/R levels from real candles only — no AI involvement.

**Support identified from:**
- Swing Lows — lowest point between two higher candles on each side (window=3)
- Repeated reaction zones — price bounced from same level 2+ times
- High volume areas — volume spike at level = stronger support

**Resistance identified from:**
- Swing Highs — highest point between two lower candles on each side (window=3)
- Rejection zones — long upper wicks at same level
- Liquidity areas — clusters of equal highs

**Clustering:** Merge levels within 1.5% of each other into single levels.

**Level Strength Score (0-100):**

| Factor | Weight |
|---|---|
| Number of touches | 30% |
| Volume at level (avg volume of touching candles vs overall avg) | 30% |
| Rejection strength (upper/lower wick ratio at touch candles) | 20% |
| Timeframe weight (4h=10, 1d=15, 1w=25, capped at 10%) | 10% |
| Recency (more recent touches weighted higher) | 10% |

Only return levels with **strength >= 60**.

```typescript
interface SRLevel {
    price: number;
    type: 'support' | 'resistance';
    strength: number;
    touchCount: number;
    lastTouchedAt: Date;
}

interface SRResult {
    coin: string;
    timeframe: string;
    supports: SRLevel[];
    resistances: SRLevel[];
}
```

### 3. `analyzeMarketStructure(coin: string, timeframe: string, candles: OhlcvCandleRow[]): Promise<StructureResult>`

Reads the real structure of price action — no AI.

| Pattern | Meaning |
|---|---|
| Higher Highs + Higher Lows | UPTREND_CONFIRMED |
| Lower Highs + Lower Lows | DOWNTREND_CONFIRMED |
| Break of Structure (BOS) | TREND_CONTINUATION |
| Change of Character (CHOCH) | POTENTIAL_REVERSAL |
| Failed BOS | FAKE_BREAKOUT |

**CHOCH Rule:** If CHOCH detected, signal confidence auto-drops by 20 points.
**Failed BOS Rule:** If detected, no signal generation.

```typescript
interface StructureResult {
    structure: 'UPTREND_CONFIRMED' | 'DOWNTREND_CONFIRMED' | 'RANGING'
              | 'BOS_BULLISH' | 'BOS_BEARISH'
              | 'CHOCH_BULLISH' | 'CHOCH_BEARISH'
              | 'FAKE_BREAKOUT';
    higherHighs: boolean;
    higherLows: boolean;
    lowerHighs: boolean;
    lowerLows: boolean;
    lastSwingHigh: number | null;
    lastSwingLow: number | null;
    chochDetected: boolean;
    fakeBreakoutDetected: boolean;
}
```

### 4. `detectCandlePatterns(candles: OhlcvCandleRow[], srLevels: SRLevel[], volumeAvg20: number | null): Promise<PatternResult | null>`

Pattern recognition with strict **3-condition gate** — ALL three must be true:

| Condition | Rule |
|---|---|
| Pattern present | Hammer, Engulfing (Bullish/Bearish), Morning Star, Evening Star, Shooting Star, Doji |
| Volume confirmation | Pattern candle volume > 20% above `volume_avg_20` |
| Structure alignment | Pattern forms at or near identified S/R level (within 2%) |

If **ANY** condition fails → return null. Pattern is ignored entirely.

```typescript
type PatternType = 'HAMMER' | 'BULLISH_ENGULFING' | 'BEARISH_ENGULFING'
    | 'MORNING_STAR' | 'EVENING_STAR' | 'SHOOTING_STAR' | 'DOJI';

interface PatternResult {
    pattern: PatternType;
    direction: 'BULLISH' | 'BEARISH';
    candleIndex: number;
    confidence: number;
    nearSR: boolean;
    volumeConfirmed: boolean;
}
```

### 5. `calculateVolumeConfirmation(coin: string, timeframe: string): Promise<VolumeResult>`

| Condition | Signal Weight |
|---|---|
| Volume > 20% above average | +15 quality points |
| Volume spike > 2x average | +25 quality points |
| Movement with no volume (< 50% of avg) | Signal REJECTED entirely |

```typescript
interface VolumeResult {
    currentVolume: number;
    averageVolume: number | null;
    volumeRatio: number | null;
    status: 'HIGH' | 'NORMAL' | 'LOW' | 'INSUFFICIENT_DATA';
    qualityModifier: number; // +25, +15, 0, or -Infinity (rejected)
}
```

### 6. `calculateQualityScore(factors: QualityFactors): number`

Algorithmic score 0-100. Signal only proceeds if score >= 60.

```typescript
interface QualityFactors {
    trendConfirmed: boolean;       // +25
    priceNearSR: boolean;          // +25
    volumeConfirmed: boolean;      // +25
    candlePatternAtSR: boolean;    // +25
    chochDetected: boolean;        // -20
    lowVolumeMovement: boolean;    // -15
    priceSpike24h: boolean;        // -20 (>25% move = manipulation flag)
}
// Returns final score clamped to 0-100
```

### 7. `runFullAnalysis(coin: string, timeframe: string): Promise<FullAnalysisResult>`

Master function that runs all above in sequence and returns combined result.

```typescript
interface FullAnalysisResult {
    coin: string;
    timeframe: string;
    trend: TrendResult;
    structure: StructureResult;
    supportResistance: SRResult;
    candlePattern: PatternResult | null;
    volume: VolumeResult;
    qualityScore: number;
    signalValid: boolean; // qualityScore >= 60 && !fakeBreakout && volume not REJECTED
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    suggestedEntry: number | null;
    suggestedTP: number | null;  // nearest resistance for bullish, nearest support for bearish
    suggestedSL: number | null;  // below support for bullish, above resistance for bearish
    analyzedAt: Date;
}
```

## Critical Rules

1. **Zero `any` types.** Use specific interfaces for everything.
2. All candle/indicator data comes from `ohlcvSnapshot.service.ts` — **NO direct Binance calls**.
3. All EMA/ATR values come from `ohlcv_indicators` table (pre-computed) — do NOT recalculate.
4. Only import from existing project files: `coins.ts`, `ohlcvSnapshot.service.ts`, `market.model.ts`, `db.ts`.
5. Each function has its own try/catch. Individual failures don't break `runFullAnalysis`.
6. Never modify existing files. This is a **NEW file only**.
7. No BUY/SELL terminology — use BULLISH/BEARISH.
8. Quality score < 60 → `signalValid = false`. Never downgrade.
9. Fake breakout detected → `signalValid = false` regardless of quality score.

## Acceptance Criteria

- File created at `backend/src/services/technicalAnalysis.service.ts`
- All 7 functions exported with correct signatures
- Zero `any` types
- `tsc --noEmit` clean
- No imports from `binance.service.ts` (all data via `ohlcvSnapshot.service.ts`)
- Quality score formula matches spec exactly
- EMA trend detection uses live price + indicator values
- S/R clustering within 1.5% threshold
- S/R strength scoring with 5-factor weighted formula
- Candle pattern 3-condition gate enforced
- Volume confirmation with 3-tier modifier system

---
---

# PROMPT: Phase 9 — Airdrop System Redesign

**Summary:** Remove `airdrop_tasks` and `user_progress` tables. Add `ecosystem`, `effort_level`, `reward_confidence`, `quality_score` columns to `airdrop_projects`. Create quality scoring service (5-factor weighted: ecosystem 30%, funding 25%, community 20%, effort 15%, risk 10%). Score < 60 = never inserted. Score < 75 = LOW confidence. Update discovery cron with quality gate. Update frontend cards (remove task lists, add quality badges).

---

## Context

You are the Senior Developer on OnlyAlpha. Phase 0 (Coin Filter) is COMPLETE. The 11 tracked coins are defined in `backend/src/config/coins.ts`.

## What Gets Removed

- `airdrop_tasks` table — no task tracking needed
- `user_progress` table — no per-user completion tracking
- Wallet verification logic — complexity with zero intelligence value
- Auto-verification system — same reason

## DB Migration

New file: `backend/scripts/migrate-airdrop-redesign.sql`

```sql
-- Guard: migration_flags
INSERT INTO migration_flags (flag_name) VALUES ('airdrop_redesign') ON CONFLICT DO NOTHING;

ALTER TABLE airdrop_projects ADD COLUMN IF NOT EXISTS ecosystem VARCHAR(50);
ALTER TABLE airdrop_projects ADD COLUMN IF NOT EXISTS effort_level VARCHAR(20) DEFAULT 'MEDIUM';
ALTER TABLE airdrop_projects ADD COLUMN IF NOT EXISTS reward_confidence VARCHAR(20) DEFAULT 'UNVERIFIED';
ALTER TABLE airdrop_projects ADD COLUMN IF NOT EXISTS quality_score INT DEFAULT 0;

DROP TABLE IF EXISTS airdrop_tasks;
DROP TABLE IF EXISTS user_progress;
```

## Drizzle Model Changes

Update `airdropProjects` in `market.model.ts` to add:

```typescript
ecosystem: varchar('ecosystem', { length: 50 }),
effortLevel: varchar('effort_level', { length: 20 }).default('MEDIUM'),
rewardConfidence: varchar('reward_confidence', { length: 20 }).default('UNVERIFIED'),
qualityScore: integer('quality_score').default(0),
```

Remove Drizzle models for `airdrop_tasks` and `user_progress` tables (if they exist).

## Ecosystem Scope per Coin

```typescript
const ECOSYSTEM_MAP: Record<string, string[]> = {
    'ETH': ['L2', 'DeFi', 'Restaking', 'Ethereum'],
    'SOL': ['DePIN', 'Gaming', 'Consumer', 'Solana'],
    'TON': ['Telegram', 'TON'],
    'BNB': ['BSC', 'DeFi', 'GameFi', 'BNB Chain'],
};
// All other tracked coins (BTC, XRP, DOGE, ADA, AVAX, LINK, SUI): ['Direct Project Airdrops']
```

## Quality Scoring Service

Create `backend/src/services/airdropQuality.service.ts`:

```typescript
interface AirdropQualityInput {
    ecosystem: string | null;
    hasVerifiedFunding: boolean;
    communitySize: number;
    effortLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AirdropQualityResult {
    score: number;       // 0-100
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
    reject: boolean;     // true if score < 60
}

// Scoring weights:
// Ecosystem connection to 11 coins: 30%
// Verified funding or backing:        25%
// Real community size:                20%
// Effort vs reward ratio:             15%
// Risk level:                         10%
```

**Hard rules:**
- Score < 60 → never reaches database (reject in service, don't INSERT)
- Score < 75 → marked LOW confidence
- Score >= 75 → marked MEDIUM or HIGH confidence
- Ecosystem must map to one of the 11 tracked coins

## Airdrop Discovery Cron Updates

Modify `backend/src/crons/airdropDiscovery.cron.ts`:
- After AI validates an airdrop article, run it through `airdropQuality.service.ts`
- If rejected (score < 60) → don't INSERT, log and skip
- If accepted → INSERT with `ecosystem`, `effortLevel`, `rewardConfidence`, `qualityScore` populated

## Airdrop Controller Updates

Modify `backend/src/controllers/airdrop.controller.ts`:
- Remove any endpoints related to `airdrop_tasks` or `user_progress`
- Add query param filtering: `ecosystem`, `effortLevel`, `rewardConfidence`
- Response should include `qualityScore` and `confidence`
- Default sort by `qualityScore DESC`

## Frontend Card Updates

Modify `frontend/src/features/airdrops/` components:
- Show: effort indicator (LOW/MEDIUM/HIGH badge), ecosystem badge, risk verdict, deadline urgency, reward confidence badge, quality score bar
- Remove: task lists, progress bars, wallet connection UI
- Sort by `quality_score DESC` by default
- Quality score visual: color bar (red < 60, yellow 60-75, green >= 75)

## Critical Rules

1. Zero `any` types
2. Drop `airdrop_tasks` and `user_progress` tables completely
3. Quality score < 60 → never inserted into DB
4. All ecosystem values mapped to one of the 11 coins
5. Migration guarded by `migration_flags`
6. No new npm packages
7. Effort levels: LOW, MEDIUM, HIGH only
8. Reward confidence: HIGH, MEDIUM, LOW, UNVERIFIED only
9. Remove all wallet-related code from frontend airdrop pages
10. Backward compatible — existing `airdrop_projects` rows get DEFAULT values for new columns

## Acceptance Criteria

- Migration script created and guarded by `migration_flags`
- Old tables dropped in migration
- Drizzle model updated (old tables removed, new columns added)
- Quality scoring service created with 5-factor weighted formula
- Airdrop discovery cron updated with quality gate
- Controller updated (old endpoints removed, new filters added)
- Frontend cards updated (task lists removed, quality badges added)
- Zero `any` types
- `tsc --noEmit` clean on both backend and frontend

---
---

# PROMPT: Phase 1.5 — Backtesting Framework

**Summary:** Create standalone script `backtest-technical.ts`. Run Phase 1 TA engine on 90 days of 4H candles every 24h. Record signals, look ahead to check 72h/7d outcomes. Print structured pass/fail report with 5 criteria: win rate > 40%, quality >= 60 on 20%+ days, directional diversity > 10%, trend accuracy > 55%, S/R hit rate > 50%. READ-ONLY — no DB writes.

---

## Context

Phase 1 (Technical Analysis Engine) is COMPLETE. `backend/src/services/technicalAnalysis.service.ts` exists with `runFullAnalysis(coin, timeframe)` that returns trend, structure, S/R, pattern, volume, quality score, and suggested entry/TP/SL.

OHLCV data exists in `ohlcv_candles` for all 11 coins x 3 timeframes (4h, 1d, 1w) with 90+ days of history.

## File to Create

`backend/scripts/backtest-technical.ts` — standalone script, NOT a service.

## Purpose

Run the Phase 1 TA engine on historical data to validate signal quality BEFORE enabling shadow mode. This is a one-time validation gate.

## Interfaces

```typescript
interface BacktestSignal {
    coin: string;
    timestamp: Date;
    direction: 'BULLISH' | 'BEARISH';
    entry: number;
    tp: number | null;
    sl: number | null;
    qualityScore: number;
    trend: string;
    pattern: string | null;
}

interface BacktestOutcome {
    signal: BacktestSignal;
    actualPnl72h: number;      // % change at 72h
    actualPnl7d: number;       // % change at 7d
    hitTP: boolean;
    hitSL: boolean;
    winner: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING';
}
```

## Algorithm

1. For each of the 11 coins:
   a. Fetch all candles for '4h' timeframe, ordered ASC, from (now - 90 days)
   b. Every 6 candles (24h), run `runFullAnalysis(coin, '4h')` using candles UP TO that point
   c. If `signalValid = true` → record as `BacktestSignal`
   d. Look ahead in candle data to check outcome:
      - At 72h (18 candles later): check if price hit TP or SL first
      - At 7d (42 candles later): check final P&L
   e. Record `BacktestOutcome`

## Pass Criteria (ALL must be met)

| # | Criteria | Threshold |
|---|---|---|
| 1 | Win rate | > 40% (TP hit before SL, or positive P&L at 72h) |
| 2 | Quality coverage | Quality >= 60 on at least 20% of analyzed days |
| 3 | Directional diversity | At least 10% opposing direction signals |
| 4 | Trend accuracy | Trend label matches actual price movement > 55% of time |
| 5 | S/R hit rate | Support/resistance levels acted as support/resistance > 50% |

## Console Output Format

```
=== BACKTEST RESULTS ===
Coins analyzed: 11
Timeframe: 4h
Period: 90 days
Total analysis points: XXX
Valid signals generated: XXX

--- PASS/FAIL CRITERIA ---
1. Win Rate: XX% [PASS/FAIL] (threshold: 40%)
2. Quality >= 60 days: XX% [PASS/FAIL] (threshold: 20%)
3. Directional diversity: XX% opposing [PASS/FAIL] (threshold: 10%)
4. Trend accuracy: XX% [PASS/FAIL] (threshold: 55%)
5. S/R hit rate: XX% [PASS/FAIL] (threshold: 50%)

OVERALL: PASS/FAIL

--- PER-COIN BREAKDOWN ---
BTC: XX signals, XX% win rate
ETH: XX signals, XX% win rate
...
```

## Critical Rules

1. Zero `any` types
2. Use `getCandles(coin, '4h', 1000)` from `ohlcvSnapshot.service.ts` for historical data
3. Use `runFullAnalysis(coin, '4h')` from `technicalAnalysis.service.ts` — do NOT reimplement TA logic
4. Look-ahead is ONLY for outcome measurement — analysis only uses candles up to the analysis point
5. This is a **READ-ONLY script** — no database writes
6. Execution: `npx ts-node backend/scripts/backtest-technical.ts`
7. No new npm packages

## Acceptance Criteria

- Script created at `backend/scripts/backtest-technical.ts`
- Iterates all 11 coins x 90 days of 4H data
- Runs `runFullAnalysis` every 24h (6 candles)
- Checks outcomes at 72h and 7d
- Prints structured pass/fail report
- All 5 pass criteria evaluated
- Per-coin breakdown included
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 0.5 — Shadow Mode + Admin Dashboard

**Summary:** Create `shadow_signals` table to store algorithm vs AI comparison. Insert shadow records in `aiWorkflow` after existing signal save (zero impact on production). Create `shadowChecker.cron.ts` every 15min to fill 72h/7d price outcomes. Admin auth via Redis sessions + bcrypt. Admin routes: login, stats, signals list with filters. Frontend dashboard: 6 stat cards, decision banner (shows at 20+ resolved), signals table.

---

## Context

Phase 1 (TA Engine) COMPLETE. Phase 1.5 (Backtesting) PASSED all 5 criteria. The algorithm is validated and ready for shadow comparison against the existing AI system.

## Part A: Shadow Signals Table

### DB Migration

New file: `backend/scripts/migrate-shadow-signals.sql`

```sql
INSERT INTO migration_flags (flag_name) VALUES ('shadow_signals') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS shadow_signals (
    id                  SERIAL PRIMARY KEY,
    coin_symbol         VARCHAR(20)    NOT NULL,
    algorithm_verdict   VARCHAR(20)    NOT NULL,
    ai_verdict          VARCHAR(20)    NOT NULL,
    algorithm_entry     REAL           NOT NULL,
    ai_entry            REAL           NOT NULL,
    algorithm_tp        REAL,
    algorithm_sl        REAL,
    ai_tp               REAL,
    ai_sl               REAL,
    quality_score       INT,
    trend_context       VARCHAR(20),
    agreement           BOOLEAN        DEFAULT false,
    price_72h           REAL,
    price_7d            REAL,
    algorithm_pnl_72h   REAL,
    ai_pnl_72h          REAL,
    algorithm_win_72h   BOOLEAN,
    ai_win_72h          BOOLEAN,
    algorithm_pnl_7d    REAL,
    ai_pnl_7d           REAL,
    algorithm_win_7d    BOOLEAN,
    ai_win_7d           BOOLEAN,
    winner              VARCHAR(20),
    created_at          TIMESTAMP      DEFAULT NOW(),
    resolved_at         TIMESTAMP
);
```

### Drizzle Model

Add to `market.model.ts` as `shadowSignals` table.

### Shadow Signal Insertion

Modify `backend/src/crons/aiWorkflow.cron.ts` — AFTER the existing signal is saved to `radar_signals`:

1. Run `runFullAnalysis(coin, '4h')` from `technicalAnalysis.service.ts` on same coin
2. Create `shadow_signals` row with:
   - `algorithm_verdict` from `FullAnalysisResult.direction` + trend
   - `ai_verdict` from the existing signal's verdict
   - Both entries = live price at that moment (from `getLivePrices`)
   - `algorithm_tp/sl` from `FullAnalysisResult.suggestedTP/SL`
   - `ai_tp/sl` from the existing signal
   - `quality_score` from `FullAnalysisResult.qualityScore`
   - `trend_context` from `FullAnalysisResult.trend.trend`
   - `agreement` = (algorithm and AI agree on direction)
3. Wrap in try/catch — shadow insertion failure MUST NOT affect existing signal generation

## Part B: Shadow Checker Cron

New file: `backend/src/crons/shadowChecker.cron.ts`

Runs every 15 minutes.

```
For each unresolved shadow_signal (resolved_at IS NULL):
  if age >= 72h AND price_72h IS NULL:
    fetch live price from Binance
    fill price_72h
    calculate algorithm_pnl_72h = ((price_72h - algorithm_entry) / algorithm_entry) * 100
    calculate ai_pnl_72h = ((price_72h - ai_entry) / ai_entry) * 100
    algorithm_win_72h = algorithm_pnl_72h > 0 (or TP hit)
    ai_win_72h = ai_pnl_72h > 0 (or TP hit)
    set winner: compare which performed better

  if age >= 7d AND price_7d IS NULL:
    fetch live price
    fill price_7d
    calculate pnl_7d for both
    set win_7d for both
    update winner if changed
    set resolved_at = NOW()
```

## Part C: Admin Dashboard

### Security

- Admin credentials from env: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt), `ADMIN_SESSION_SECRET`
- Login: `POST /admin/login` → bcrypt compare → create session in Redis (key: `admin:session:{uuid}`, TTL: 24h)
- Middleware: `backend/src/middleware/adminAuth.middleware.ts` — check Redis for valid session, return 401 if not found
- Rate limit: 5 attempts per 15 minutes on login endpoint (use existing `apiLimiter` pattern)
- Session stored in Redis only (NOT in DB, NOT in-memory)

### Env Flags

```typescript
SHADOW_MODE_ADMIN_ENABLED: z.boolean().default(false),
ADMIN_EMAIL: z.string().email(),
ADMIN_PASSWORD_HASH: z.string(),
ADMIN_SESSION_SECRET: z.string().min(32),
```

### Routes

New file: `backend/src/routes/admin.routes.ts`

| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` | Authenticate, create Redis session |
| GET | `/admin/shadow/stats` | Header stats (6 cards) |
| GET | `/admin/shadow/signals` | Signals table with filters |
| GET | `/admin/shadow/signals/:id` | Single signal detail |

All routes protected by `adminAuth` middleware.

### Stats Endpoint Response

```typescript
{
    totalSignals: number,
    resolvedCount: number,
    algorithmWinRate72h: number,             // wins / resolved
    aiWinRate72h: number,
    agreeingSignals: number,
    disagreeingSignals: number,
    algorithmWinOnDisagreement: number,      // THE key stat
    showBanner: boolean,                      // resolvedCount >= 20
    bannerMessage: string | null,             // recommendation text
}
```

### Signals Endpoint Query Params

- `coin` — filter by `coin_symbol`
- `agreement` — true / false / all
- `status` — pending / resolved / all
- `limit` — default 50
- `offset` — default 0

## Part D: Frontend Admin Dashboard Page

New file: `frontend/src/app/admin/shadow/page.tsx` (client component)

1. **Login screen** (if no session) — email + password form
2. **Dashboard** with:
   - 6 stat cards (top row)
   - Decision Helper Banner (when resolved >= 20)
   - Signals table with filters (coin, agreement, status)
   - Pagination

Banner logic:

| Algorithm Disagreement Win Rate | Banner Color | Message |
|---|---|---|
| > 60% | Green | READY TO SWITCH |
| 50-60% | Yellow | NEEDS MORE DATA |
| < 50% | Red | ALGORITHM NEEDS TUNING |

## Critical Rules

1. Zero `any` types
2. `shadow_signals` is READ-ONLY for users — never in public API
3. Admin routes never in public API docs
4. Algorithm runs silently — never affects existing signals
5. Decision to switch is MANUAL — banner recommends only
6. Admin session in Redis only (TTL 24h)
7. All admin routes return 401 for unauthenticated
8. Rate limit on login: 5 per 15 minutes
9. Use existing `bcryptjs` for password hashing
10. Migration guarded by `migration_flags`
11. New cron flagged (`SHADOW_MODE_ADMIN_ENABLED`, default false)
12. Shadow insertion failure must NOT crash existing aiWorkflow

## Acceptance Criteria

- `shadow_signals` table created with migration
- Shadow signal insertion in aiWorkflow after existing signal save
- Shadow insertion wrapped in try/catch (non-blocking)
- Shadow checker cron running every 15min
- Admin login with Redis session + bcrypt
- Admin middleware protecting all admin routes
- Stats endpoint with 6 metrics + banner logic
- Signals endpoint with filters and pagination
- Frontend dashboard page with login, cards, banner, table
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 2 — Market Regime Detection

**Summary:** Create `marketRegime.service.ts` to detect RISK_ON / RISK_OFF / TRENDING / SIDEWAYS / VOLATILE market state. Sources: BTC 4H TA analysis (primary), Fear & Greed Index API (cached 4h in Redis), macro keyword scan from `coin_news_history`. RISK_OFF = bullish confidence -20, SL widen +15%. VOLATILE = pause all signals. SIDEWAYS = no signals. Store `current_regime` in `coin_intelligence_cache`, refresh every 4h via `convictionUpdate.cron.ts`.

---

## Context

Phase 1 (TA Engine) COMPLETE. `technicalAnalysis.service.ts` exists with trend, structure, volume analysis.

## File to Create

`backend/src/services/marketRegime.service.ts`

## File to Modify

- `backend/src/models/market.model.ts` — add `current_regime` column to `coin_intelligence_cache`
- `backend/src/crons/convictionUpdate.cron.ts` — call regime detection every 4 hours

## Regime Types

```typescript
type RegimeType = 'RISK_ON' | 'RISK_OFF' | 'TRENDING' | 'SIDEWAYS' | 'VOLATILE';

interface RegimeResult {
    coin: string;
    regime: RegimeType;
    confidence: number;       // 0-100
    sources: string[];        // which sources contributed
    modifiers: RegimeModifiers;
}

interface RegimeModifiers {
    regime: RegimeType;
    bullishConfidenceAdjustment: number;  // RISK_OFF: -20, VOLATILE: -30, others: 0
    slWidenPercent: number;               // RISK_OFF: 15, others: 0
    signalSuppressed: boolean;            // SIDEWAYS: true, VOLATILE: true
}
```

## Detection Logic

### Source 1: BTC 4H Technical Analysis (primary)

Run `runFullAnalysis('BTC', '4h')` and use:

| Condition | Regime |
|---|---|
| BULLISH/STRONG_BULLISH + volume HIGH + UPTREND_CONFIRMED | RISK_ON |
| BEARISH/STRONG_BEARISH + volume LOW + DOWNTREND_CONFIRMED | RISK_OFF |
| Clear EMA alignment + BOS confirmed | TRENDING |
| SIDEWAYS + volume LOW + no BOS | SIDEWAYS |
| abs(priceChange24h) > 8% + volume spike > 2x | VOLATILE |

### Source 2: Fear & Greed Index

Fetch from `https://api.alternative.me/fng/` (GET request).

| Value | Classification | Effect |
|---|---|---|
| 0-25 | EXTREME_FEAR | RISK_OFF modifier |
| 25-45 | FEAR | Mild RISK_OFF modifier |
| 45-55 | NEUTRAL | No modifier |
| 55-75 | GREED | Mild RISK_ON modifier |
| 75-100 | EXTREME_GREED | RISK_ON modifier |

Cache in Redis for 4 hours (key: `fear_greed_index`).

### Source 3: Macro Keywords (existing RSS pipeline)

Scan recent `coin_news_history` for macro keywords in titles:

```
['war', 'sanctions', 'fed rate', 'inflation', 'crisis', 'ban', 'regulation', 'hack', 'exploit']
```

If 2+ macro keywords found in last 24h → **force RISK_OFF** regardless of technicals.

### Rule Priority

1. VOLATILE check first (price spike + volume) → pause signals
2. Macro keywords → force RISK_OFF regardless of technicals
3. Technical analysis → determine base regime
4. Fear & Greed → apply confidence modifier

## Regime Storage

- Stored in `coin_intelligence_cache.current_regime` (new column)
- Refreshed every 4 hours inside `convictionUpdate.cron.ts`
- Add a call to `detectRegime(coin)` for each tracked coin

## DB Migration

```sql
INSERT INTO migration_flags (flag_name) VALUES ('market_regime') ON CONFLICT DO NOTHING;
ALTER TABLE coin_intelligence_cache ADD COLUMN IF NOT EXISTS current_regime VARCHAR(20) DEFAULT 'SIDEWAYS';
```

## Critical Rules

1. Zero `any` types
2. Macro keyword matching is text-based only — no AI calls
3. Fear & Greed API is a simple GET — cache for 4 hours in Redis
4. BTC regime sets the market-wide tone for all coins
5. VOLATILE regime pauses ALL signals — no exceptions
6. SIDEWAYS regime generates NO signals
7. Migration guarded by `migration_flags`
8. Zero modifications to existing AI workflow — regime is READ by signal generation, not pushed
9. No new npm packages

## Acceptance Criteria

- Service created with `detectRegime(coin)` function
- `RegimeModifiers` exported for use by signal generation
- BTC 4H analysis as primary source
- Fear & Greed API integration with Redis cache (4h TTL)
- Macro keyword scanning from `coin_news_history`
- `current_regime` column added to `coin_intelligence_cache`
- `convictionUpdate.cron.ts` calls regime detection every 4h
- Priority order enforced (VOLATILE > Macro > Technical > F&G)
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 3 — Signal Classification System

**Summary:** Add `signal_type` (TACTICAL/STRATEGIC), `horizon_days` (3/14/21), `quality_score`, `trend_context`, `entry_zone_low/high`, `invalidation_level/reason` columns to `radar_signals`. Classification by event type: Listing/Whale/Partnership = TACTICAL 3d, ETF/Regulation/Hack = STRATEGIC 14d, Mainnet/Funding/Upgrade = STRATEGIC 21d. RR minimums: TACTICAL 1:2, STRATEGIC 1:3. Signal rejected if RR below minimum.

---

## Context

Phase 1 (TA Engine) COMPLETE. `technicalAnalysis.service.ts` exists with `runFullAnalysis()`.

## DB Migration

New file: `backend/scripts/migrate-signal-classification.sql`

```sql
INSERT INTO migration_flags (flag_name) VALUES ('signal_classification') ON CONFLICT DO NOTHING;

ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS signal_type VARCHAR(20) DEFAULT 'TACTICAL';
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS horizon_days INT DEFAULT 3;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS quality_score INT DEFAULT 0;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS trend_context VARCHAR(20);
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS entry_zone_low REAL;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS entry_zone_high REAL;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS invalidation_level REAL;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS invalidation_reason TEXT;
```

## Drizzle Model

Update `radarSignals` in `market.model.ts` with the new columns.

## Signal Classification Logic

```typescript
type SignalType = 'TACTICAL' | 'STRATEGIC';

interface ClassificationResult {
    signalType: SignalType;
    horizonDays: number;
    reason: string;
}

const STRATEGIC_TRIGGERS_14D = new Set(['ETF', 'Regulatory', 'Hack', 'Delisting']);
const STRATEGIC_TRIGGERS_21D = new Set(['Mainnet_Launch', 'Major_Funding', 'Protocol_Upgrade']);
const TACTICAL_TRIGGERS = new Set(['Listing', 'Whale_Movement', 'Partnership', 'Price_Action', 'Volume_Spike']);

function classifySignal(eventType: string): ClassificationResult {
    if (STRATEGIC_TRIGGERS_21D.has(eventType)) {
        return { signalType: 'STRATEGIC', horizonDays: 21, reason: 'Long-term protocol event' };
    }
    if (STRATEGIC_TRIGGERS_14D.has(eventType)) {
        return { signalType: 'STRATEGIC', horizonDays: 14, reason: 'Major structural event' };
    }
    if (TACTICAL_TRIGGERS.has(eventType)) {
        return { signalType: 'TACTICAL', horizonDays: 3, reason: 'Short-term catalyst detected' };
    }
    return { signalType: 'TACTICAL', horizonDays: 3, reason: 'Default classification' };
}
```

## Risk/Reward Rules

| Signal Type | Minimum RR | SL Placement |
|---|---|---|
| TACTICAL | 1:2 | Below/above nearest S/R from Phase 1 |
| STRATEGIC | 1:3 | Below/above major S/R from Phase 1 |

**Hard rule:** If RR cannot meet minimum → signal is **REJECTED**. Not downgraded. Rejected.

## Entry Zone Calculation

From Phase 1 S/R levels:

```typescript
entry_zone_low  = suggested_entry * 0.995   // 0.5% below entry
entry_zone_high = suggested_entry * 1.005   // 0.5% above entry
```

## Invalidation Level

- Bullish signal: below nearest support with strength >= 60
- Bearish signal: above nearest resistance with strength >= 60
- `invalidation_reason`: "Structure break below/above [price]"

## Integration Point

Modify signal generation in `aiWorkflow.cron.ts`:
After signal is approved (quality >= 60), before saving to `radar_signals`:

1. Call `classifySignal(eventType)` to get `signal_type` and `horizon_days`
2. Get `trend_context` from `FullAnalysisResult.trend.trend`
3. Calculate `entry_zone_low`/`high`
4. Get `invalidation_level` from S/R levels
5. Calculate RR ratio and validate against minimum
6. If RR < minimum → reject signal (log + skip INSERT)
7. Store all new fields in `radar_signals` INSERT

## Critical Rules

1. Zero `any` types
2. All existing columns untouched — additive migration only
3. Signal rejected if RR < minimum for its type
4. Default to TACTICAL if event type not recognized
5. Migration guarded by `migration_flags`
6. No new npm packages

## Acceptance Criteria

- Migration adds 8 new columns to `radar_signals`
- Drizzle model updated with all new columns
- `classifySignal` function with correct event type mappings
- RR validation (reject if below minimum)
- Entry zone calculation from S/R levels
- Invalidation level from S/R levels
- Integration in `aiWorkflow.cron.ts` before INSERT
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 4 — TP/SL Engine Overhaul

**Summary:** Create `tpslEngine.service.ts` to replace AI-generated TP/SL entirely. TP priority: nearest S/R level → liquidity target (equal highs) → ATR 1.5x extension. SL priority: invalidation level (structure break) → nearest S/R → ATR 1x. Sanity gate: 7 validation checks (bullish TP above entry, distance 1-40%, RR minimum). Any check fails = signal rejected, never saved. Replace existing `tpslCalculator.service.ts` logic.

---

## Context

Phase 1 (TA Engine with S/R engine) and Phase 3 (Signal Classification with RR rules) are COMPLETE.

## File to Create

`backend/src/services/tpslEngine.service.ts`

## File to Modify

- `backend/src/crons/aiWorkflow.cron.ts` — replace existing TP/SL logic with engine calls
- `backend/src/services/tpslCalculator.service.ts` — DEPRECATE (keep file, redirect exports to new engine)

## TP Calculation (Priority Order)

1. **Nearest resistance** from Phase 1 S/R engine (strength >= 60) — for bullish signals
2. **Liquidity target** — equal highs zone from swing highs (within 1% clustering)
3. **ATR extension** — 1.5x ATR-14 from entry — only if no S/R found

For bearish signals, flip: use nearest support as TP.

## SL Calculation (Priority Order)

1. **Invalidation level** — structure break point from Phase 1 market structure analysis
2. **Nearest support** (for bullish) or **nearest resistance** (for bearish) with strength >= 60
3. **ATR-based** — 1x ATR-14 below/above entry — only if no S/R found

## Interfaces

```typescript
interface TPSLResult {
    tp: number;
    sl: number;
    tpSource: 'SR_LEVEL' | 'LIQUIDITY_TARGET' | 'ATR_EXTENSION';
    slSource: 'INVALIDATION_LEVEL' | 'SR_LEVEL' | 'ATR_BASED';
    riskRewardRatio: number;       // |tp - entry| / |entry - sl|
    rrMeetsMinimum: boolean;       // TACTICAL: 1:2, STRATEGIC: 1:3
    reasoning: string;
}

function calculateTPSL(params: {
    direction: 'BULLISH' | 'BEARISH';
    entry: number;
    signalType: 'TACTICAL' | 'STRATEGIC';
    supportResistance: SRResult;
    structure: StructureResult;
    atr14: number | null;
}): TPSLResult;
```

## TP/SL Sanity Gate

```typescript
interface SanityCheck {
    check: string;
    passed: boolean;
    detail: string;
}

function validateTPSL(direction: string, entry: number, tp: number, sl: number, signalType: string): SanityCheck[] {
    return [
        { check: 'bullish_tp_above_entry',  passed: direction !== 'BULLISH' || tp > entry, detail: '...' },
        { check: 'bullish_sl_below_entry',  passed: direction !== 'BULLISH' || sl < entry, detail: '...' },
        { check: 'bearish_tp_below_entry',  passed: direction !== 'BEARISH' || tp < entry, detail: '...' },
        { check: 'bearish_sl_above_entry',  passed: direction !== 'BEARISH' || sl > entry, detail: '...' },
        { check: 'distance_min_1pct',       passed: Math.abs(tp - entry) / entry >= 0.01, detail: '...' },
        { check: 'distance_max_40pct',      passed: Math.abs(tp - entry) / entry <= 0.40, detail: '...' },
        { check: 'rr_minimum',              passed: rr >= minRR, detail: '...' },
    ];
}

function isTPSLValid(checks: SanityCheck[]): boolean {
    return checks.every(c => c.passed);
}
```

If **ANY** check fails → signal rejected + logged. **Never saved.**

## Critical Rules

1. Zero `any` types
2. TP/SL ALWAYS from algorithm — NEVER from AI response
3. ATR values come from `ohlcv_indicators` (pre-computed) — do NOT recalculate
4. S/R levels come from `technicalAnalysis.service.ts` — do NOT re-query
5. Signal rejected if sanity gate fails — never saved, never downgraded
6. Replace existing `tpslCalculator.service.ts` logic (keep file for backward compat, but redirect exports)
7. No new npm packages

## Acceptance Criteria

- Engine created with `calculateTPSL` and `validateTPSL` functions
- TP calculation uses 3-tier priority (S/R → Liquidity → ATR)
- SL calculation uses 3-tier priority (Invalidation → S/R → ATR)
- Sanity gate validates all 7 checks
- Integration in `aiWorkflow` replaces existing TP/SL logic
- Existing `tpslCalculator.service.ts` deprecated (redirects to new engine)
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 6 — AI Role Refinement

**Summary:** Reduce AI to catalyst validator only. New prompt in `prompt-factory.ts`: structured input (trend, quality, entry, S/R, regime, event, type) → JSON output (`valid`, `thesis`, `modifier -20 to +20`). New function `validateSignalCatalyst` in `openai.service.ts` using GPT-5-nano. One call per signal. If `valid=false` → reject signal. Final confidence = base quality + AI modifier + regime modifier. If JSON parse fails after retry → fail-safe (modifier=0, valid=true).

---

## Context

Phase 1 (TA Engine) and Phase 2 (Market Regime) are COMPLETE. The algorithm now generates all numbers (direction, entry, TP, SL, quality score). The AI's role is reduced to: catalyst validation + thesis writing + confidence modifier.

## File to Modify

- `backend/src/services/prompt-factory.ts` — new prompt template
- `backend/src/services/openai.service.ts` — new AI call function
- `backend/src/crons/aiWorkflow.cron.ts` — replace existing deep analysis call with validation call

## New AI Prompt Structure

### Input (structured, from algorithm):

```
trend = {BULLISH}
quality_score = {78}
entry = {94200}
support = {91000}
resistance = {97500}
regime = {RISK_ON}
event = {ETF approval rumor}
signal_type = {TACTICAL}
```

### AI Task (3 things only):

1. Is this catalyst real or noise? (yes/no)
2. Write thesis in one sentence max
3. Confidence modifier: -20 to +20 (adjust quality score)

### Required AI Output (JSON only):

```json
{ "valid": true, "thesis": "...", "modifier": 10 }
```

## Prompt Template

Add to `prompt-factory.ts`:

```typescript
export function buildSignalValidationMessages(params: {
    trend: string;
    qualityScore: number;
    entry: number;
    support: number | null;
    resistance: number | null;
    regime: string;
    event: string;
    signalType: string;
}): MessageParam[] {
    const systemPrompt = `You are a crypto catalyst validator. You receive algorithmic analysis and determine if a news catalyst is real or noise.

Rules:
- Reply in JSON only: { "valid": boolean, "thesis": string, "modifier": number }
- valid: true if catalyst is real and actionable, false if noise or already priced in
- thesis: one sentence max explaining why
- modifier: -20 to +20 confidence adjustment (positive = more confident, negative = less confident)
- No explanation, no markdown, just the JSON object`;

    const userPrompt = `Given:
trend = ${params.trend}
quality_score = ${params.qualityScore}
entry = ${params.entry}
support = ${params.support ?? 'none identified'}
resistance = ${params.resistance ?? 'none identified'}
regime = ${params.regime}
event = ${params.event}
signal_type = ${params.signalType}

Is this catalyst real or noise? Write thesis. Assign modifier.`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}
```

## New AI Call Function

Add to `openai.service.ts`:

```typescript
interface SignalValidationInput {
    trend: string;
    qualityScore: number;
    entry: number;
    support: number | null;
    resistance: number | null;
    regime: string;
    event: string;
    signalType: string;
}

interface SignalValidationResult {
    valid: boolean;
    thesis: string;
    modifier: number;
}

export async function validateSignalCatalyst(params: SignalValidationInput): Promise<SignalValidationResult> {
    const messages = buildSignalValidationMessages(params);
    // Use cheapest model for structured JSON response (GPT-5-nano or equivalent)
    // Parse JSON response
    // Validate: valid is boolean, thesis is string <= 200 chars, modifier is number between -20 and +20
    // Retry once on parse failure
    // Fail-safe: if parse fails after retry → return { valid: true, thesis: '', modifier: 0 }
    // Return structured result
}
```

## Final Confidence Score Formula

```
base_quality_score (from Phase 1 algorithm)
+ AI modifier (-20 to +20)
+ regime_modifier (RISK_OFF: -20, RISK_ON: 0, VOLATILE: -30, TRENDING: 0, SIDEWAYS: 0)
= final_confidence_score (clamped to 0-100)
```

If `valid === false` → signal **rejected entirely** regardless of quality score.

## Critical Rules

1. Zero `any` types
2. Prompt is ~80% smaller than current deep analysis prompt
3. One AI call per signal (not 3)
4. Output is structured JSON only — no free text parsing
5. If AI returns `valid=false` → signal is REJECTED
6. If AI JSON parse fails after 1 retry → use `modifier=0` and `valid=true` (fail-safe)
7. Keep existing retry logic (3 attempts) from `generateDualNewsOutput` for backward compat
8. Keep existing fallback logic from `generateLightweightTriage` unchanged
9. No new npm packages

## Acceptance Criteria

- `buildSignalValidationMessages` added to `prompt-factory.ts`
- `validateSignalCatalyst` added to `openai.service.ts`
- JSON-only response parsing with validation
- AI modifier clamped to -20 / +20
- Final confidence formula implemented
- `valid=false` rejects signal
- Fail-safe on parse failure (modifier=0, valid=true)
- `aiWorkflow.cron.ts` updated to use new validation
- Existing retry/fallback logic preserved
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 5 — Signal Lifecycle System

**Summary:** Add `signal_state` lifecycle to radar_signals: NEW → WAITING_CONFIRMATION → ACTIVE → PARTIAL_TP → BREAKEVEN → CLOSED. Create `signalLifecycle.service.ts` with state machine. Auto-close rules: TACTICAL 72h, STRATEGIC 21d. Close reasons: TP_HIT, SL_HIT, EXPIRED, THESIS_REVERSED, HTF_BREAK. Breakeven: move SL to entry after PARTIAL_TP. Integrate with `tpslMonitor.cron.ts` (every 15min). Add 7d/30d checkpoints for STRATEGIC.

---

## Context

Phase 3 (Signal Classification) and Phase 4 (TP/SL Engine) are COMPLETE. Signals now have `signal_type`, `horizon_days`, `quality_score`, `trend_context`, `entry_zone`, `invalidation_level`.

## DB Migration

New file: `backend/scripts/migrate-signal-lifecycle.sql`

```sql
INSERT INTO migration_flags (flag_name) VALUES ('signal_lifecycle') ON CONFLICT DO NOTHING;

ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS signal_state VARCHAR(30) DEFAULT 'NEW';
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS partial_tp_hit_at TIMESTAMP;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS breakeven_moved_at TIMESTAMP;
ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS close_reason VARCHAR(50);
```

Note: `price72h`, `pnl72h`, `is_win72h` already exist from Phase 18 implementation.

## Lifecycle States

```
NEW → WAITING_CONFIRMATION → ACTIVE → PARTIAL_TP → BREAKEVEN → CLOSED
```

### State Transitions

| Current State | Next State | Trigger |
|---|---|---|
| NEW | WAITING_CONFIRMATION | quality_score >= 60 but price NOT in entry zone |
| NEW | ACTIVE | quality_score >= 60 and price IN entry zone |
| WAITING_CONFIRMATION | ACTIVE | Price enters entry zone |
| ACTIVE | PARTIAL_TP | Price hits 50% of TP distance |
| ACTIVE | CLOSED | TP hit, SL hit, expired, thesis reversed |
| PARTIAL_TP | BREAKEVEN | SL moved to entry price |
| BREAKEVEN | CLOSED | TP hit, SL hit (at entry), expired, thesis reversed |

### State Descriptions

- **NEW**: Signal just created by aiWorkflow
- **WAITING_CONFIRMATION**: Approved but price not yet in entry zone
- **ACTIVE**: Price entered the entry zone (between `entry_zone_low` and `entry_zone_high`)
- **PARTIAL_TP**: Price hit 50% of TP distance
- **BREAKEVEN**: SL moved to entry price after partial TP
- **CLOSED**: Terminal state

## File to Create

`backend/src/services/signalLifecycle.service.ts`

### Exports

```typescript
interface StateTransition {
    newState: string;
    reason: string;
    action: 'NONE' | 'MOVE_SL_TO_BREAKEVEN' | 'CLOSE_SIGNAL' | 'UPDATE_STAGE';
}

function evaluateSignalState(
    signal: RadarSignalRow,
    currentPrice: number
): StateTransition;

interface AutoCloseCheck {
    shouldClose: boolean;
    reason: 'TP_HIT' | 'SL_HIT' | 'EXPIRED' | 'THESIS_REVERSED' | 'HTF_BREAK' | null;
}

function checkAutoClose(
    signal: RadarSignalRow,
    currentPrice: number,
    opposingNewsCount: number
): AutoCloseCheck;
```

## Auto-Close Rules

**TACTICAL signals:**

| Condition | Action |
|---|---|
| Auto-close after 72h (horizon_days) | Calculate realized P&L |
| TP hit | CLOSE (TP_HIT) |
| SL hit | CLOSE (SL_HIT) |
| MAJOR opposing news for same coin | CLOSE (THESIS_REVERSED) |

**STRATEGIC signals:**

| Condition | Action |
|---|---|
| Auto-close after 21 days (horizon_days) | Calculate realized P&L |
| TP hit | CLOSE (TP_HIT) |
| SL hit | CLOSE (SL_HIT) |
| Weekly structure breaks against signal direction | CLOSE (HTF_BREAK) |

## Cron Integration

Modify `backend/src/crons/tpslMonitor.cron.ts` to also evaluate lifecycle state transitions on each tick (every 15 minutes):

1. Fetch all non-CLOSED signals
2. For each: `evaluateSignalState` with current live price
3. Apply state transitions (UPDATE radar_signals SET signal_state = ...)
4. Check auto-close conditions
5. If PARTIAL_TP → update SL to entry (breakeven), set `breakeven_moved_at`

## Checkpoint Schedule

Modify `signalPerformance.cron.ts` to add:

| Checkpoint | Applies To | Purpose |
|---|---|---|
| 24h | All signals | Unrealized P&L snapshot (already exists) |
| 72h | TACTICAL only | Primary win/loss decision (already exists) |
| 7d | STRATEGIC only | Mid-term check (new) |
| 30d | STRATEGIC only | Final outcome (new) |

## Critical Rules

1. Zero `any` types
2. State machine is deterministic — same inputs always produce same transition
3. BREAKEVEN only applies after PARTIAL_TP is confirmed
4. CLOSED is terminal — no transitions out of CLOSED
5. THESIS_REVERSED requires a MAJOR news event (not minor updates)
6. HTF_BREAK uses Phase 1 structure analysis on Weekly timeframe
7. Migration guarded by `migration_flags`
8. Existing TP/SL monitoring logic preserved — lifecycle is additive
9. No new npm packages

## Acceptance Criteria

- Migration adds `signal_state`, `partial_tp_hit_at`, `breakeven_moved_at`, `close_reason`
- Lifecycle service with state machine
- All 6 states with correct transitions
- Auto-close rules for TACTICAL (72h) and STRATEGIC (21d)
- Breakeven logic after partial TP
- THESIS_REVERSED and HTF_BREAK close reasons
- Integration with `tpslMonitor` cron
- Checkpoint updates for 7d and 30d
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 7 — Multi-Timeframe Analysis (All 4 Tasks)

**Summary:** Four incremental tasks. 7.1: Add `daily_trend` to `coin_intelligence_cache`, update every 6h. 7.2: Add `weekly_bias`, update daily at 04:00 UTC. Rule: STRONG_BEARISH weekly = suppress TACTICAL bullish. 7.3: Create `coin_technical_levels` table for 4H S/R, refresh every 6h. 7.4: Multi-TF label: TREND_FOLLOWING (full confidence), COUNTER_TREND (-20), PULLBACK_ENTRY (normal), NO_SIGNAL (rejected). Use `calculateTrend` from Phase 1.

---

## Context

Phase 1 (TA Engine) COMPLETE. OHLCV data exists for 4h, 1d, 1w timeframes. `technicalAnalysis.service.ts` has `calculateTrend()`.

## Task 7.1 — Daily Trend Context

### DB Migration

```sql
INSERT INTO migration_flags (flag_name) VALUES ('daily_trend') ON CONFLICT DO NOTHING;
ALTER TABLE coin_intelligence_cache ADD COLUMN IF NOT EXISTS daily_trend VARCHAR(20) DEFAULT 'SIDEWAYS';
```

### Implementation

Add to `technicalAnalysis.service.ts` or create `multiTimeframe.service.ts`:

```typescript
async function updateDailyTrend(): Promise<void> {
    for (const coin of TRACKED_COINS) {
        const trend = await calculateTrend(coin, '1d');
        await db.update(coinIntelligenceCache)
            .set({ dailyTrend: trend.trend })
            .where(eq(coinIntelligenceCache.coinSymbol, coin));
    }
}
```

Call every 6 hours (add to `ohlcvSnapshot.cron.ts` or create separate cron).

**Rule:** Uptrend signals only generate when `daily_trend` is BULLISH or STRONG_BULLISH.

---

## Task 7.2 — Weekly Bias Layer

### DB Migration

```sql
INSERT INTO migration_flags (flag_name) VALUES ('weekly_bias') ON CONFLICT DO NOTHING;
ALTER TABLE coin_intelligence_cache ADD COLUMN IF NOT EXISTS weekly_bias VARCHAR(20) DEFAULT 'SIDEWAYS';
```

### Implementation

```typescript
async function updateWeeklyBias(): Promise<void> {
    for (const coin of TRACKED_COINS) {
        const trend = await calculateTrend(coin, '1w');
        await db.update(coinIntelligenceCache)
            .set({ weeklyBias: trend.trend })
            .where(eq(coinIntelligenceCache.coinSymbol, coin));
    }
}
```

Refreshed once daily at 04:00 UTC (add to `historicalNews.cron.ts` or separate cron).

**Rule:** If `weekly_bias` is STRONG_BEARISH → TACTICAL bullish signals are **SUPPRESSED** entirely.

---

## Task 7.3 — 4H Entry Timing

### DB Migration

```sql
INSERT INTO migration_flags (flag_name) VALUES ('coin_technical_levels') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS coin_technical_levels (
    id          SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL,
    timeframe   VARCHAR(5)  NOT NULL DEFAULT '4h',
    level_type  VARCHAR(10) NOT NULL,   -- 'support' or 'resistance'
    price       REAL        NOT NULL,
    strength    INT         NOT NULL,
    updated_at  TIMESTAMP   DEFAULT NOW(),
    UNIQUE(coin_symbol, timeframe, level_type, price)
);
```

### Drizzle Model

Add `coinTechnicalLevels` to `market.model.ts`.

### Implementation

```typescript
async function update4HLevels(): Promise<void> {
    for (const coin of TRACKED_COINS) {
        const sr = await calculateSupportResistance(coin, '4h', 100);
        // Upsert supports and resistances into coin_technical_levels
        // Delete old levels not in current set
    }
}
```

Refreshed every 6 hours.

**Used for:** Entry zone refinement. 4H nearest support/resistance becomes the primary entry zone for TACTICAL signals.

---

## Task 7.4 — Multi-TF Signal Classification

### Implementation

```typescript
type MultiTFLabel = 'TREND_FOLLOWING' | 'COUNTER_TREND' | 'PULLBACK_ENTRY' | 'NO_SIGNAL';

function classifyMultiTimeframe(
    weeklyTrend: string,
    dailyTrend: string,
    h4Trend: string
): MultiTFLabel {
    if (weeklyTrend === 'SIDEWAYS' || dailyTrend === 'SIDEWAYS' || h4Trend === 'SIDEWAYS') {
        return 'NO_SIGNAL';
    }

    const isBullish = (t: string) => ['BULLISH', 'STRONG_BULLISH'].includes(t);
    const isBearish = (t: string) => ['BEARISH', 'STRONG_BEARISH'].includes(t);

    // All aligned
    if (isBullish(weeklyTrend) && isBullish(dailyTrend) && isBullish(h4Trend)) {
        return 'TREND_FOLLOWING';   // full confidence
    }
    if (isBearish(weeklyTrend) && isBearish(dailyTrend) && isBearish(h4Trend)) {
        return 'TREND_FOLLOWING';   // full confidence
    }

    // Counter trend
    if (isBearish(weeklyTrend) && isBearish(dailyTrend) && isBullish(h4Trend)) {
        return 'COUNTER_TREND';     // reduced confidence -20
    }
    if (isBullish(weeklyTrend) && isBullish(dailyTrend) && isBearish(h4Trend)) {
        return 'COUNTER_TREND';     // reduced confidence -20
    }

    // Pullback
    if (isBullish(weeklyTrend) && isBullish(dailyTrend) && !isBearish(h4Trend)) {
        return 'PULLBACK_ENTRY';    // normal confidence
    }
    if (isBearish(weeklyTrend) && isBearish(dailyTrend) && !isBullish(h4Trend)) {
        return 'PULLBACK_ENTRY';    // normal confidence
    }

    return 'NO_SIGNAL';
}
```

### Integration Rules

| Label | Action |
|---|---|
| TREND_FOLLOWING | Full confidence, proceed normally |
| PULLBACK_ENTRY | Normal confidence, proceed normally |
| COUNTER_TREND | Reduced confidence by 20 points |
| NO_SIGNAL | Signal **rejected** entirely |

## Critical Rules

1. Zero `any` types
2. All migrations guarded by `migration_flags`
3. Reuse `calculateTrend` from `technicalAnalysis.service.ts` — do NOT reimplement
4. NO_SIGNAL suppresses signal generation entirely
5. COUNTER_TREND applies -20 confidence penalty
6. Weekly refresh at 04:00 UTC, Daily/4H refresh every 6 hours
7. No new npm packages

## Acceptance Criteria

- `daily_trend` column added to `coin_intelligence_cache`
- `weekly_bias` column added to `coin_intelligence_cache`
- `coin_technical_levels` table created with Drizzle model
- Daily trend updated every 6 hours
- Weekly bias updated daily at 04:00 UTC
- 4H levels updated every 6 hours (upsert + cleanup old levels)
- Multi-TF classification function implemented
- NO_SIGNAL → signal rejected
- COUNTER_TREND → -20 confidence
- Weekly STRONG_BEARISH → TACTICAL bullish suppressed
- Zero `any` types
- `tsc --noEmit` clean

---
---

# PROMPT: Phase 8 — Scorecard Redesign

**Summary:** Rewrite scorecard with 4 stat cards (Tactical Win Rate, Strategic Win Rate, Best Trade, Avg RR). Active signals split into TACTICAL/STRATEGIC tabs with: price vs entry + unrealized P&L%, time remaining progress bar, TP/SL in dollars, quality score badge (color coded), lifecycle state badge, trend context label. Per-coin performance table (3+ closed signals). Completed timeline (last 50, color coded by close reason).

---

## Context

Phase 5 (Signal Lifecycle) and Phase 6 (AI Role Refinement) are COMPLETE. Signals now have full lifecycle states, quality scores, trend context, and multi-timeframe labels.

## Frontend File to Rewrite

`frontend/src/app/scorecard/page.tsx`

## Header Stats (4 Cards)

| Card | Data Source |
|---|---|
| Tactical Win Rate | `signal_performance.is_win72h` (closed tactical signals only) |
| Strategic Win Rate | `signal_performance` (combined `is_win7d` + `is_win30d`) |
| Best Trade | Max `realizedPnl` with coin name + date |
| Avg RR Achieved | Average of actual `(exit_price - entry_price) / abs(entry_price - sl)` for all closed signals |

## Active Signals Section

Split into two tabs: **TACTICAL ACTIVE** and **STRATEGIC ACTIVE**.

Each signal card shows:

- Coin name + signal type badge (TACTICAL / STRATEGIC)
- Current price vs entry price + unrealized P&L% (colored green/red)
- Time remaining with progress bar (elapsed time / `horizon_days`)
- TP and SL in real dollar amounts
- Quality score badge (color coded: green >= 80, yellow >= 60, red < 60)
- Signal lifecycle state badge (NEW, WAITING_CONFIRMATION, ACTIVE, PARTIAL_TP, BREAKEVEN)
- Trend context label (STRONG_BULLISH, BULLISH, SIDEWAYS, BEARISH, STRONG_BEARISH)

## Performance by Coin

Table per coin showing:

| Column | Data |
|---|---|
| Coin | coin_symbol |
| Signals | Total closed signal count |
| Win Rate | wins / total |
| Best Trade | Max realizedPnl |
| Worst Trade | Min realizedPnl |
| Avg Hold | Average hold duration |

Only shows coins with **3+ closed signals**.

## Completed Signals Timeline

- Sorted newest first
- Capped at last **50** completed signals
- Each entry: type badge, entry → exit price, P&L%, hold duration, close reason
- Color coded by close reason:

| Close Reason | Color |
|---|---|
| TP_HIT | Green |
| SL_HIT | Red |
| EXPIRED | Grey |
| THESIS_REVERSED | Orange |
| HTF_BREAK | Purple |

## Backend API Updates

Update `backend/src/controllers/market.controller.ts` scorecard handler:

- Add `quality_score`, `trend_context`, `signal_state`, `signal_type` to response
- Add tactical/strategic split in active signals
- Add best trade calculation (max realizedPnl)
- Add avg RR calculation
- Add per-coin performance aggregation
- Add completed signals with close_reason and color mapping

## Critical Rules

1. Zero `any` types on frontend
2. All data from existing API — extend existing scorecard endpoint (no new routes)
3. Use existing Tailwind dark theme tokens
4. Tabs: simple state toggle, no new packages
5. Progress bar: CSS only (width % based on elapsed / total time)
6. No BUY/SELL terminology — use BULLISH/BEARISH
7. No new npm packages

## Acceptance Criteria

- 4 header stat cards with correct data sources
- Active signals split into TACTICAL / STRATEGIC tabs
- Signal cards show all required fields
- Progress bar for time remaining
- Quality score badge color coded (3 tiers)
- Lifecycle state badge
- Trend context label
- Per-coin performance table (3+ signals minimum)
- Completed signals timeline (last 50, 5 color codes)
- Backend API extended with new fields
- Zero `any` types
- `tsc --noEmit` clean on frontend

---

## END OF PHASE PROMPTS
