# THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## Active Phase: Phase 23 — TP/SL Auto-Close & Signal Lifecycle (P0)

**Priority:** P0 — Signals hit 10-90% profit but never close, Scorecard Win Rate destroyed
**Authorized By:** Tech Lead — May 1, 2026
**Planned By:** Tech Lead — May 1, 2026
**Total Tasks:** 9 (T-01 through T-09) — Granular Micro-Tasks Ready

**Core Problem (Production):**
- Zero stop-loss or take-profit mechanism — signals stay active indefinitely
- Trades that hit +10% to +90% never close — profit evaporates as market reverses
- Signals only close when AI reverses direction (could be days/weeks)
- Scorecard Win Rate and Avg P&L are artificially terrible
- No time-based auto-expiry — dead signals accumulate

**AI Already Outputs S/R Levels** (prompt-factory.ts:277-278):
- `supportLevels: [price, price]`
- `resistanceLevels: [price, price]`
- These are PERFECT for deriving TP/SL — just not being used

---

### PHASE 23 — MICRO-TASKS BREAKDOWN

#### T-01: SQL Migration — Add TP/SL + Auto-Close Columns
**File:** `backend/scripts/migrate-tpsl-columns.sql` (NEW)
**What:**
```sql
ALTER TABLE signal_performance
    ADD COLUMN stop_loss_price REAL,
    ADD COLUMN take_profit_price REAL,
    ADD COLUMN auto_closed_reason VARCHAR(20);

CREATE INDEX idx_signal_perf_tpsl
    ON signal_performance (is_active, take_profit_price, stop_loss_price)
    WHERE is_active = true AND (take_profit_price IS NOT NULL OR stop_loss_price IS NOT NULL);
```
**Plus backfill:** For each active signal, calculate default TP/SL:
- BUY/STRONG_BUY: `TP = entry_price * 1.15`, `SL = entry_price * 0.92`
- SELL/STRONG_SELL: `TP = entry_price * 0.85`, `SL = entry_price * 1.08`
**Guardrails:** No data deletion. Existing columns untouched. NULL-safe.

---

#### T-02: Drizzle Model Update — Add 3 New Columns
**File:** `backend/src/models/market.model.ts` (lines 117-122)
**What:** Add after `realizedPnl` (line 120):
```typescript
stopLossPrice: real('stop_loss_price'),
takeProfitPrice: real('take_profit_price'),
autoClosedReason: varchar('auto_closed_reason', { length: 20 }),
```
**Guardrails:** Only add 3 lines. No other schema changes. All existing imports/re-exports untouched.

---

#### T-03: TP/SL Calculator Utility
**File:** `backend/src/services/tpslCalculator.service.ts` (NEW)
**What:** Pure function to calculate TP/SL from analysis data:
```typescript
interface TpslInput {
    entryPrice: number;
    verdict: 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL';
    supportLevels?: number[];
    resistanceLevels?: number[];
}

interface TpslOutput {
    stopLossPrice: number;
    takeProfitPrice: number;
}

export function calculateTpsl(input: TpslInput): TpslOutput
```
**Logic:**
- For BUY/STRONG_BUY:
  - TP = nearest resistance above entry (from `resistanceLevels`), else `entry * 1.15`
  - SL = nearest support below entry (from `supportLevels`), else `entry * 0.92`
- For SELL/STRONG_SELL:
  - TP = nearest support below entry (from `supportLevels`), else `entry * 0.85`
  - SL = nearest resistance above entry (from `resistanceLevels`), else `entry * 1.08`
- If no S/R levels provided → fall back to default percentages
- Guard: TP and SL must be at least 2% away from entry (prevent instant triggers)
**Guardrails:** Pure function. No DB calls. No side effects. Fully testable.

---

#### T-04: Signal Manager — Store TP/SL on Create
**File:** `backend/src/services/signalManager.service.ts`
**What:**
1. Add optional `tpslData?: { stopLossPrice: number; takeProfitPrice: number }` to `executeSignalDecision` parameters
2. In the `create` / `close_and_replace` branches (lines 157-189), include `stopLossPrice` and `takeProfitPrice` in the `signalPerformance` INSERT
3. Add import for `calculateTpsl` from `tpslCalculator.service.ts`
**Guardrails:** Don't change the `decideSignalAction` function. Don't change upgrade/skip logic. Only touch the INSERT in `executeSignalDecision`.

---

#### T-05: AI Workflow — Pass S/R Levels to Signal Manager
**File:** `backend/src/crons/aiWorkflow.cron.ts` (lines 527-532)
**What:**
1. Import `calculateTpsl` from `tpslCalculator.service.ts`
2. Before calling `executeSignalDecision`, compute TP/SL:
```typescript
const tpslData = calculateTpsl({
    entryPrice: price?.price ?? 0,
    verdict: analysisResult.verdict,
    supportLevels: analysisResult.supportLevels,
    resistanceLevels: analysisResult.resistanceLevels,
});
```
3. Pass `tpslData` as new parameter to `executeSignalDecision`
**Guardrails:** Only modify the radar signal block (lines 520-537). Don't touch any other section.

---

#### T-06: TP/SL Monitor Cron
**File:** `backend/src/crons/tpslMonitor.cron.ts` (NEW)
**What:**
```typescript
import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';

async function monitorTpsl(): Promise<void> {
    // 1. Fetch all active signals with TP/SL set
    // 2. For each: get current price via getPriceWithFallback
    // 3. Check TP hit:
    //    - BUY/STRONG_BUY: currentPrice >= takeProfitPrice → CLOSE with reason 'take_profit'
    //    - SELL/STRONG_SELL: currentPrice <= takeProfitPrice → CLOSE with reason 'take_profit'
    // 4. Check SL hit:
    //    - BUY/STRONG_BUY: currentPrice <= stopLossPrice → CLOSE with reason 'stop_loss'
    //    - SELL/STRONG_SELL: currentPrice >= stopLossPrice → CLOSE with reason 'stop_loss'
    // 5. Update: is_active=false, exit_price=currentPrice, realized_pnl=calculated, auto_closed_reason
    // 6. Invalidate scorecard cache: deleteCache('scorecard:latest')
}

async function expireOldSignals(): Promise<void> {
    // Auto-close signals older than 30 days
    // WHERE is_active=true AND entry_at < NOW() - 30 days
    // Set auto_closed_reason='time_expiry'
}

export function startTpslMonitorCron(): void {
    cron.schedule('*/15 * * * *', async () => {
        await monitorTpsl();
        await expireOldSignals();
    });
}
```
**Guardrails:**
- LIMIT 50 per batch (same pattern as signalPerformance.cron.ts)
- Never modify radarSignals table (append-only)
- Try-catch per signal (one failure doesn't stop batch)
- Log every close: `[TPSL Monitor] Closed signal #ID for SYMBOL: TP hit at $PRICE (+X.X%)`

---

#### T-07: Server Registration — Register TP/SL Cron
**File:** `backend/src/server.ts`
**What:**
1. Add import: `import { startTpslMonitorCron } from './crons/tpslMonitor.cron';`
2. Add to crons array (after SignalPerformance): `{ name: 'TpslMonitor', fn: startTpslMonitorCron }`
**Guardrails:** Only 2 lines added. Nothing else changed.

---

#### T-08: Scorecard API — Return TP/SL + Close Reason
**File:** `backend/src/controllers/market.controller.ts` (lines 531-616)
**What:**
1. In tactical signals type (line 544-553), add: `stopLossPrice: number | null`, `takeProfitPrice: number | null`
2. In tactical push (lines 563-572), add: `stopLossPrice` and `takeProfitPrice` from DB row
3. In closed signals type (lines 575-591), add: `autoClosedReason: string | null`
4. In closed response (line 602), include `autoClosedReason`
5. Invalidate `scorecard:latest` cache when building response (already cached at 300s — keep as is)
**Guardrails:** Don't change route. Don't change strategic section. Backward-compatible (new fields are nullable).

---

#### T-09: Frontend Scorecard — Display TP/SL + Close Reason
**File:** `frontend/src/app/(standard)/scorecard/page.tsx`
**What:**
1. Update `TacticalSignal` interface: add `stopLossPrice: number | null`, `takeProfitPrice: number | null`
2. Update `ClosedSignal` interface: add `autoClosedReason: string | null`
3. Tactical table: add 2 columns "SL" and "TP" after "Entry $" showing formatted prices
4. Closed table: add "Reason" column showing badge:
   - `take_profit` → green badge "TP Hit"
   - `stop_loss` → red badge "SL Hit"
   - `time_expiry` → gray badge "Expired"
   - `null` → gray badge "Reversed" (direction change)
5. Add helper `closeReasonBadge(reason)` similar to `verdictBadge()`
**Guardrails:** Dark theme tokens. No new packages. No layout changes. Server component pattern preserved.

---

### EXECUTION ORDER

```
DEPLOY GROUP 1 (Schema — parallel OK):
  T-01 (SQL migration) + T-02 (Drizzle model)

DEPLOY GROUP 2 (Core Logic — sequential):
  T-03 (TP/SL calculator) → T-04 (signalManager update) → T-05 (workflow integration)

DEPLOY GROUP 3 (Monitoring — after core logic):
  T-06 (TP/SL monitor cron) + T-07 (server registration) — deploy together

DEPLOY GROUP 4 (API + Frontend — after monitoring):
  T-08 (API update) → T-09 (Frontend update)

T-VERIFY: tsc --noEmit on both backend + frontend, grep for `any` types
```

### GUARDRAILS (TECH LEAD — MANDATORY)

1. **Zero `any` types** — strict TypeScript
2. **No new packages** — all infrastructure exists
3. **radarSignals is append-only** — NEVER update or delete
4. **Backward compatibility** — old signals without TP/SL must work (NULL handling)
5. **One active signal per coin** — enforced by signalManager, don't bypass
6. **P&L formula consistency** — direction-adjusted: `isBearish ? -rawPnl : rawPnl`
7. **Cache invalidation** — `scorecard:latest` must be invalidated on every auto-close
8. **Batch processing** — LIMIT 50, try-catch per signal
9. **Price fetch safety** — if `getPriceWithFallback` returns null, skip that signal
10. **Default TP/SL fallback** — TP: +15%, SL: -8% if AI doesn't provide S/R levels

---

### ARCHIVED PHASES

## Active Phase: Phase 21 — Multi-Timeframe Signal System & Scorecard Overhaul (P0)

**Priority:** P0 — Production scorecard shows duplicate/conflicting signals, empty P&L, zero dedup
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` — Phase 21 section (lines 1955-2724)
**Authorized By:** Tech Lead — April 29, 2026
**Planned By:** Strategic Planner — April 29, 2026
**Total Tasks:** 7 (T-01 through T-07) — Granular Micro-Tasks Ready

**Core Problem (Production):**
- 8 BTC signals with conflicting BUY/SELL verdicts at $77,479-$77,809 range
- 4 LTC SELL signals within $0.26 of each other
- Win Rate, Avg Return, Best Call all empty (no 7d data yet)
- Every MAJOR event blindly creates a new signal regardless of existing signals

---

### Execution Order & Dependency Chain

```
DEPLOY GROUP 1 (DB Schema):
  T-01 (SQL migration) + T-02 (Drizzle model) — parallel OK, deploy together

DEPLOY GROUP 2 (Core Logic):
  T-03 (signalManager.service.ts) — independent, can deploy alone

DEPLOY GROUP 3 (Pipeline Integration):
  T-04 (aiWorkflow.cron.ts) + T-05 (signalPerformance.cron.ts) — both depend on T-01+T-02+T-03

DEPLOY GROUP 4 (UI Overhaul):
  T-06 (scorecard controller) + T-07 (scorecard frontend) — T-07 depends on T-06
```

---

### Tech Lead Guardrails (MANDATORY)

1. **`radarSignals` table stays append-only** — never UPDATE or DELETE from it. It's a feed.
2. **All state management goes through `signalPerformance`** — that's where isActive, upgrades, closes happen.
3. **One active signal per coin** — enforced at application level, not DB constraint (DB can have multiple if race condition, but decision logic picks the first).
4. **Signal upgrade does NOT reset entryAt or entryPrice** — the upgrade just changes verdict on the existing row.
5. **`decideSignalAction()` must be fail-safe** — if price API is down, default to skip, never block the pipeline.
6. **Zero `any` types** across all new/modified code.
7. **Backward-compatible** — existing `getScorecardHandler` consumers must not break until T-06/T-07 deploy together.
8. **SQL migration must include data reconciliation** — Close duplicate signals per coin: keep latest as `is_active = true`, close older ones with `exit_price = next signal's entry_price` and `realized_pnl` calculated by direction.

---

### ⚠️ GUARDRAIL CONFLICT FLAGGED

**Guardrail #1 vs nextstep.md Task 3 Code:**
The nextstep.md blueprint includes an `UPDATE radarSignals` call inside `executeSignalDecision()` (upgrade path). This **VIOLATES** Guardrail #1 ("radarSignals stays append-only"). The Strategic Planner has **removed** the radar update from T-03 below. Only `signalPerformance` gets the verdict upgrade. The radar feed remains untouched.

---

## 1. Planning Stage — Strategic Planner Breakdown

---

### T-01: SQL Migration — Add Lifecycle Columns + Data Reconciliation

**File (CREATE):** `backend/scripts/migrate-signal-active.sql`
**Assigned To:** Senior Developer
**Status:** 🔴 NEEDS RE-RUN (Updated by Tech Lead — added data reconciliation)
**Depends On:** None (must run FIRST before any code changes)

**Target:** Create SQL migration to add 4 new columns to `signal_performance` table, create a partial index for active signal lookups, backfill existing rows, AND **reconcile duplicate signals** so each coin has exactly 1 active signal.

**Tech Lead Directive (April 29, 2026):** The original T-01 only did schema changes + backfill. It did NOT fix the existing duplicate data (8 BTC, 4 LTC). This updated version adds a reconciliation step that closes older duplicate signals with correct `exit_price` and `realized_pnl` based on the next signal's entry price.

**Exact SQL to write:**

```sql
-- Phase 21: Multi-Timeframe Signal System
-- Add active/closed tracking to signal_performance

ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS exit_price REAL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS realized_pnl REAL;

-- Index for finding active signals per coin (partial index — only WHERE is_active = true)
CREATE INDEX IF NOT EXISTS idx_signal_perf_active ON signal_performance(coin_symbol, is_active) WHERE is_active = true;

-- Backfill existing rows: mark all current rows as active first
UPDATE signal_performance SET is_active = true WHERE is_active IS NULL;

-- ============================================================
-- DATA RECONCILIATION: Fix duplicate signals per coin
-- Logic: For each coin with multiple signals, keep the LATEST
-- as active. Close older signals with exit_price = next signal's
-- entry_price and realized_pnl calculated.
--
-- Example: BTC has 8 signals. After this:
--   Signal 1-7: is_active=false, exit_price=next signal's entry, realized_pnl=calculated
--   Signal 8:   is_active=true (the latest stays active)
--
-- P&L direction logic:
--   BUY/STRONG_BUY: pnl = (exit - entry) / entry * 100
--   SELL/STRONG_SELL: pnl = (entry - exit) / entry * 100
-- ============================================================

UPDATE signal_performance sp
SET
    is_active = false,
    exit_price = next_sp.entry_price,
    closed_at = next_sp.entry_at,
    realized_pnl = CASE
        WHEN sp.verdict IN ('BUY', 'STRONG_BUY') THEN
            ROUND(((next_sp.entry_price - sp.entry_price) / sp.entry_price) * 100, 2)
        WHEN sp.verdict IN ('SELL', 'STRONG_SELL') THEN
            ROUND(((sp.entry_price - next_sp.entry_price) / sp.entry_price) * 100, 2)
        ELSE 0
    END
FROM (
    SELECT
        sp1.id AS current_id,
        MIN(sp2.id) AS next_id
    FROM signal_performance sp1
    INNER JOIN signal_performance sp2
        ON sp1.coin_symbol = sp2.coin_symbol
        AND sp2.id > sp1.id
    GROUP BY sp1.id
) AS chain
INNER JOIN signal_performance next_sp
    ON next_sp.id = chain.next_id
WHERE sp.id = chain.current_id;

-- VERIFY: Should return 0 rows (no duplicates remaining)
-- SELECT coin_symbol, COUNT(*) FROM signal_performance WHERE is_active = true GROUP BY coin_symbol HAVING COUNT(*) > 1;
```

**Column details:**
| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| `is_active` | `BOOLEAN` | `TRUE` | `NOT NULL` | Tracks whether signal is currently active (one per coin) |
| `closed_at` | `TIMESTAMP` | `NULL` | nullable | Set when signal is closed (direction change) |
| `exit_price` | `REAL` | `NULL` | nullable | Price at close time |
| `realized_pnl` | `REAL` | `NULL` | nullable | Final P&L percentage at close |

**Reconciliation logic explained:**
1. First: all rows get `is_active = true` (backfill)
2. Then: for every signal that has a NEWER signal for the same coin, it gets closed
3. `exit_price` = the entry_price of the next signal (represents the actual price when the thesis was superseded)
4. `closed_at` = the entry_at of the next signal
5. `realized_pnl` = calculated based on direction (BUY profitable when price went up, SELL profitable when price went down)
6. The LAST signal per coin has no newer signal → stays `is_active = true`

**How to run:**
```bash
psql $DATABASE_URL -f backend/scripts/migrate-signal-active.sql
```

**Precedent files (existing migrations for reference):**
- `backend/scripts/migrate-signal-performance.sql` (Phase 18)
- `backend/scripts/migrate-strategic-outlook.sql` (Phase 15)

**Verification Checklist:**
- [ ] File created at `backend/scripts/migrate-signal-active.sql`
- [ ] 4 `ALTER TABLE` statements with `IF NOT EXISTS`
- [ ] 1 `CREATE INDEX` with partial `WHERE is_active = true`
- [ ] 1 backfill `UPDATE` statement
- [ ] 1 reconciliation `UPDATE` statement that closes duplicates
- [ ] `SELECT coin_symbol, COUNT(*) FROM signal_performance WHERE is_active = true GROUP BY coin_symbol HAVING COUNT(*) > 1` returns **0 rows**
- [ ] BTC has exactly 1 active signal
- [ ] LTC has exactly 1 active signal
- [ ] Closed signals have non-null `exit_price`, `closed_at`, `realized_pnl`
- [ ] SQL syntax is valid PostgreSQL (no MySQL-isms)
- [ ] Column names match snake_case convention used by Drizzle

---

### T-02: Update Drizzle Model — Add 4 New Columns to `signalPerformance`

**File (MODIFY):** `backend/src/models/market.model.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** None (can be done in parallel with T-01, must deploy together)

**Target:** Add `isActive`, `closedAt`, `exitPrice`, `realizedPnl` columns to the Drizzle `signalPerformance` table definition to match the SQL migration in T-01.

**Exact insertion point — AFTER line 115 (`isWin30d`) and BEFORE line 117 (`createdAt`):**

**BEFORE (lines 96-118):**
```typescript
export const signalPerformance = pgTable('signal_performance', {
    id: serial('id').primaryKey(),
    signalId: integer('signal_id').references(() => radarSignals.id).notNull(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    verdict: varchar('verdict', { length: 20 }).notNull(),
    sentiment: varchar('sentiment', { length: 20 }),

    entryPrice: real('entry_price').notNull(),
    entryAt: timestamp('entry_at').notNull(),

    price24h: real('price_24h'),
    price7d: real('price_7d'),
    price30d: real('price_30d'),

    pnl24h: real('pnl_24h'),
    pnl7d: real('pnl_7d'),
    pnl30d: real('pnl_30d'),

    isWin7d: boolean('is_win_7d'),
    isWin30d: boolean('is_win_30d'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**AFTER (lines 96-122):**
```typescript
export const signalPerformance = pgTable('signal_performance', {
    id: serial('id').primaryKey(),
    signalId: integer('signal_id').references(() => radarSignals.id).notNull(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    verdict: varchar('verdict', { length: 20 }).notNull(),
    sentiment: varchar('sentiment', { length: 20 }),

    entryPrice: real('entry_price').notNull(),
    entryAt: timestamp('entry_at').notNull(),

    price24h: real('price_24h'),
    price7d: real('price_7d'),
    price30d: real('price_30d'),

    pnl24h: real('pnl_24h'),
    pnl7d: real('pnl_7d'),
    pnl30d: real('pnl_30d'),

    isWin7d: boolean('is_win_7d'),
    isWin30d: boolean('is_win_30d'),

    isActive:       boolean('is_active').default(true).notNull(),
    closedAt:       timestamp('closed_at'),
    exitPrice:      real('exit_price'),
    realizedPnl:    real('realized_pnl'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**New columns (4):**
| Drizzle Name | DB Column | Type | Default | Nullable |
|---|---|---|---|---|
| `isActive` | `is_active` | `boolean()` | `true` | `notNull()` |
| `closedAt` | `closed_at` | `timestamp()` | none | yes |
| `exitPrice` | `exit_price` | `real()` | none | yes |
| `realizedPnl` | `realized_pnl` | `real()` | none | yes |

**Important notes:**
- `boolean` is already imported at line 3 from `drizzle-orm/pg-core` — no new import needed
- `timestamp` is already imported at line 2 — no new import needed
- `real` is already imported at line 2 — no new import needed
- Column ordering: lifecycle columns (isActive, closedAt, exitPrice, realizedPnl) placed after tracking columns (isWin7d, isWin30d) and before createdAt
- This matches the SQL migration column order from T-01

**Verification Checklist:**
- [x] 4 new columns added between lines 116-119 (after `isWin30d`, before `createdAt`)
- [x] `isActive` uses `boolean('is_active').default(true).notNull()`
- [x] `closedAt` uses `timestamp('closed_at')` — no default, nullable
- [x] `exitPrice` uses `real('exit_price')` — no default, nullable
- [x] `realizedPnl` uses `real('realized_pnl')` — no default, nullable
- [x] No new imports needed (boolean, timestamp, real already imported)
- [x] DB column names (snake_case) match SQL migration exactly
- [x] Drizzle column names (camelCase) follow existing convention
- [x] `tsc --noEmit` clean
- [x] Zero `any` types

---

### T-03: Create `signalManager.service.ts` — Signal Decision Logic Engine

**File (CREATE):** `backend/src/services/signalManager.service.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-01 + T-02 (Drizzle model must have isActive column before queries reference it)

**Target:** Create the core signal decision engine that implements the multi-timeframe signal system. Two exported functions: `decideSignalAction()` (pure decision) and `executeSignalDecision()` (side-effect executor).

**Full implementation outline:**

**Imports required:**
```typescript
import { db } from '../config/db';
import { radarSignals, signalPerformance } from '../models/market.model';
import { eq, and, desc } from 'drizzle-orm';
import { getPriceWithFallback, type PriceResult } from './priceService';
```

**Types to define:**
```typescript
type SignalDirection = 'bullish' | 'bearish';
type SignalVerdict = 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL';

interface SignalDecision {
    action: 'create' | 'upgrade' | 'close_and_replace' | 'skip';
    verdict: SignalVerdict;
    closedSignal?: {
        id: number;
        exitPrice: number;
        realizedPnl: number;
        closedAt: Date;
    };
    reason: string;
}
```

**Helper functions (internal, not exported):**

1. `verdictToDirection(verdict: string): SignalDirection` — returns `'bullish'` for STRONG_BUY/BUY, `'bearish'` for SELL/STRONG_SELL
2. `isStrongVerdict(verdict: string): boolean` — returns `true` only for STRONG_BUY or STRONG_SELL
3. `canUpgrade(oldVerdict: string): boolean` — returns `true` only for BUY or SELL (not STRONG_*)

**Export 1: `decideSignalAction(coinSymbol: string, newVerdict: SignalVerdict): Promise<SignalDecision>`**

**Logic flow (MUST follow the Decision Matrix from nextstep.md:2037-2049):**

```
Step 1: Find active signal for coinSymbol
  → Query: db.select().from(signalPerformance).where(and(eq(signalPerformance.coinSymbol, coinSymbol), eq(signalPerformance.isActive, true))).limit(1)
  → If no active signal found → return { action: 'create', verdict: newVerdict, reason: '...' }

Step 2: Determine directions
  → oldDirection = verdictToDirection(activeSignal.verdict)
  → newDirection = verdictToDirection(newVerdict)

Step 3: Same direction check
  → If oldDirection === newDirection:
    → If canUpgrade(active.verdict) AND isStrongVerdict(newVerdict):
      → Fetch price via getPriceWithFallback(coinSymbol)
      → If price fails OR price.price <= 0 → return { action: 'skip', ... }  ← FAIL-SAFE
      → Calculate tradePnl: ((price - entryPrice) / entryPrice) * 100, negate for bearish
      → If tradePnl > 0 → return { action: 'upgrade', verdict: newVerdict, reason: '...' }
    → Otherwise → return { action: 'skip', verdict: active.verdict, reason: '...' }

Step 4: Direction changed
  → Fetch price via getPriceWithFallback(coinSymbol)
  → If price fails OR price.price <= 0 → return { action: 'skip', ... }  ← FAIL-SAFE
  → Calculate tradePnl for the closing signal
  → return { action: 'close_and_replace', verdict: newVerdict, closedSignal: { id, exitPrice, realizedPnl, closedAt }, reason: '...' }
```

**Export 2: `executeSignalDecision(coinSymbol: string, signalText: string, sentiment: string, impactScore: number, decision: SignalDecision): Promise<number | null>`**

**Logic flow:**

```
Step 1: Close old signal (if action === 'close_and_replace')
  → UPDATE signalPerformance SET isActive=false, closedAt, exitPrice, realizedPnl WHERE id = decision.closedSignal.id
  → console.log with signal close details

Step 2: Upgrade existing signal (if action === 'upgrade')
  → UPDATE signalPerformance SET verdict=decision.verdict WHERE coinSymbol=coinSymbol AND isActive=true
  → ⚠️ DO NOT update radarSignals (Guardrail #1 — append-only feed)
  → console.log with upgrade details
  → return null (no new radar row created)

Step 3: Skip (if action === 'skip')
  → console.log with skip reason
  → return null

Step 4: Create new signal (if action === 'create')
  → INSERT into radarSignals: { coinSymbol, signalText, sentiment, impactScore, newsId: null }
  → Get returned ID
  → Fetch price via getPriceWithFallback(coinSymbol)
  → If price available AND insertedRadar exists:
    → INSERT into signalPerformance: { signalId, coinSymbol, verdict, sentiment, entryPrice, entryAt: new Date(), isActive: true }
    → console.log creation details
    → return radar ID
  → return null
```

**Critical design notes:**

1. **Price fetch fail-safe (Guardrail #5):** EVERY `getPriceWithFallback` call must be guarded. If it returns `null` or `price <= 0`, default to `skip`. Never throw. Never block the pipeline.

2. **No radar UPDATE (Guardrail #1):** The upgrade path only touches `signalPerformance`. The `radarSignals` table is NEVER updated. On upgrade, the old radar row stays as-is — it's a feed, not state.

3. **Entry preservation (Guardrail #4):** Upgrade only changes `verdict`. The `entryAt` and `entryPrice` fields are NEVER touched during upgrade.

4. **Close+Replace closes FIRST, then creates:** The DB operations must be sequential — close the old signal before creating the new one. This prevents a race condition where both are active.

5. **`impactScore` type:** The function parameter is `number`. The caller passes `analysisResult.impactScore` which is a `number` from `DeepAnalysisResult`. No type coercion needed.

6. **`sentiment` type:** The function parameter is `string`. The caller passes `analysisResult.sentiment` which is a `string` ('bullish'|'bearish'|'neutral'). No type coercion needed.

**Precedent for reference:**
- `backend/src/services/coin-memory.service.ts` — similar pattern of DB operations + console.log
- `backend/src/services/priceService.ts:76-98` — `getPriceWithFallback(symbol)` returns `Promise<PriceResult | null>`

**Verification Checklist:**
- [x] File created at `backend/src/services/signalManager.service.ts`
- [x] Zero `any` types (use `SignalDirection`, `SignalVerdict`, `SignalDecision` interfaces)
- [x] `PriceResult` imported as type from `./priceService` (line 64-72 of priceService.ts)
- [x] `decideSignalAction` exported — takes `(coinSymbol: string, newVerdict: SignalVerdict)` returns `Promise<SignalDecision>`
- [x] `executeSignalDecision` exported — takes `(coinSymbol: string, signalText: string, sentiment: string, impactScore: number, decision: SignalDecision)` returns `Promise<number | null>`
- [x] Price fetch is fail-safe: null check + `price <= 0` check → defaults to skip
- [x] `radarSignals` is NEVER updated (Guardrail #1 — only INSERT in create path)
- [x] Upgrade only changes `verdict` on `signalPerformance` (Guardrail #4 — no entryAt/entryPrice reset)
- [x] Close sets `isActive=false, closedAt, exitPrice, realizedPnl`
- [x] `SignalVerdict` is `'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL'` — no `NEUTRAL`
- [x] `SignalDecision.action` is `'create' | 'upgrade' | 'close_and_replace' | 'skip'`
- [x] Every DB operation has console.log for observability
- [x] `tsc --noEmit` clean

---

### T-04: Integrate Signal Manager into AI Workflow Cron

**File (MODIFY):** `backend/src/crons/aiWorkflow.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-01 + T-02 + T-03

**Target:** Replace the current blind radar signal INSERT block (lines 521-548) with the smart signal management system using `decideSignalAction()` + `executeSignalDecision()`.

**Sub-task 4A: Add import at top of file (line 19 area, with other service imports)**

Add after line 19:
```typescript
import { decideSignalAction, executeSignalDecision } from '../services/signalManager.service';
```

**Sub-task 4B: Replace lines 519-548 (the 4g radar signal block)**

**BEFORE (lines 519-548):**
```typescript
                const newsId = null;

                // 4g. Radar signal for actionable verdicts
                const actionableVerdicts = ['STRONG_BUY', 'STRONG_SELL', 'BUY', 'SELL'];
                if (actionableVerdicts.includes(analysisResult.verdict)) {
                    const insertedRadar = await db.insert(radarSignals).values({
                        coinSymbol: symbol,
                        signalText: analysisResult.signalText,
                        sentiment: analysisResult.sentiment,
                        impactScore: analysisResult.impactScore,
                        newsId,
                    }).returning({ id: radarSignals.id });

                    // 4g-2. Record signal performance (entry price)
                    try {
                        const priceResult = await getPriceWithFallback(symbol);
                        if (priceResult && priceResult.price > 0 && insertedRadar.length > 0) {
                            await db.insert(signalPerformance).values({
                                signalId: insertedRadar[0].id,
                                coinSymbol: symbol,
                                verdict: analysisResult.verdict,
                                sentiment: analysisResult.sentiment,
                                entryPrice: priceResult.price,
                                entryAt: new Date(),
                            });
                        }
                    } catch (perfErr) {
                        console.error(`[AI Workflow] Failed to record signal performance for ${symbol}:`, perfErr instanceof Error ? perfErr.message : String(perfErr));
                    }
                }
```

**AFTER:**
```typescript
                // 4g. Radar signal for actionable verdicts (with smart signal management)
                const actionableVerdicts: ReadonlyArray<'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL'> = ['STRONG_BUY', 'STRONG_SELL', 'BUY', 'SELL'];
                if (actionableVerdicts.includes(analysisResult.verdict as 'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL')) {
                    try {
                        const decision = await decideSignalAction(symbol, analysisResult.verdict as 'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL');
                        console.log(`[AI Workflow] Signal decision for ${symbol}: ${decision.action} — ${decision.reason}`);

                        const signalId = await executeSignalDecision(
                            symbol,
                            analysisResult.signalText,
                            analysisResult.sentiment,
                            analysisResult.impactScore,
                            decision
                        );
                    } catch (sigErr) {
                        console.error(`[AI Workflow] Signal management failed for ${symbol}:`, sigErr instanceof Error ? sigErr.message : String(sigErr));
                    }
                }
```

**What changed:**
- **Removed:** Direct `db.insert(radarSignals)` — now handled inside `executeSignalDecision`
- **Removed:** Direct `db.insert(signalPerformance)` — now handled inside `executeSignalDecision`
- **Removed:** `const newsId = null;` — no longer needed (passed as `null` inside `executeSignalDecision`)
- **Added:** `decideSignalAction(symbol, verdict)` call — determines what to do
- **Added:** `executeSignalDecision(...)` call — executes the decision
- **Added:** `actionableVerdicts` typed as `ReadonlyArray<'STRONG_BUY' | 'STRONG_SELL' | 'BUY' | 'SELL'>` (zero `any`)
- **Added:** Type assertion on `analysisResult.verdict` (because `DeepAnalysisResult.verdict` may be typed as `string`)

**Note:** The `newsId` variable at line 519 is no longer used. It should be REMOVED. The `executeSignalDecision` function hardcodes `newsId: null` internally.

**Variable in scope (verified from reading the file):**
- `symbol` — coin symbol, string, available from the for loop at line 181
- `analysisResult.verdict` — the AI verdict string
- `analysisResult.signalText` — the signal text
- `analysisResult.sentiment` — the sentiment ('bullish'|'bearish'|'neutral')
- `analysisResult.impactScore` — the impact score number

**Verification Checklist:**
- [x] Import added for `decideSignalAction` and `executeSignalDecision` from `'../services/signalManager.service'`
- [x] Lines 519-548 replaced with new signal management block
- [x] `const newsId = null;` removed (no longer needed)
- [x] No direct `db.insert(radarSignals)` remains in this file (except `backfillRadarSignals` function at line 618 which is a one-time utility)
- [x] No direct `db.insert(signalPerformance)` remains in this file
- [x] `actionableVerdicts` is properly typed — no `any`
- [x] `analysisResult.verdict` cast to the narrow verdict type (no `any`)
- [x] try-catch wraps the entire signal block — failure is non-blocking
- [x] Error message uses `sigErr instanceof Error ? sigErr.message : String(sigErr)` pattern (no `any`)
- [x] All other code in the file is UNTOUCHED — article writing, memory save, cache invalidation, etc.
- [x] `tsc --noEmit` clean
- [x] Zero `any` types

---

### T-05: Update Signal Performance Cron — Active-Only P&L Tracking

**File (MODIFY):** `backend/src/crons/signalPerformance.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-01 + T-02 (signalPerformance model must have `isActive` column)

**Target:** Add `isActive = true` filter to all three P&L queries (24h, 7d, 30d) so the cron only processes active signals. Closed signals already have `realizedPnl` and should not be updated.

**Current file structure (85 lines total):**
- Lines 1-5: Imports
- Lines 7-80: `updateSignalPerformance()` function
  - Lines 10-29: 24h P&L block (`need24h`)
  - Lines 31-53: 7d P&L block (`need7d`)
  - Lines 55-77: 30d P&L block (`need30d`)
- Lines 82-85: `startSignalPerformanceCron()` scheduler

**Sub-task 5A: Add `eq` import if not already present**

**BEFORE (line 4):**
```typescript
import { eq, isNull, lte, and, sql } from 'drizzle-orm';
```
`eq` is already imported — no change needed.

**Sub-task 5B: Add `isActive = true` filter to `need24h` query (line 10-16)**

**BEFORE (lines 10-16):**
```typescript
    const need24h = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price24h),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '24 hours'`)
        ))
        .limit(50);
```

**AFTER:**
```typescript
    const need24h = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price24h),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '24 hours'`)
        ))
        .limit(50);
```

**Sub-task 5C: Add `isActive = true` filter to `need7d` query (lines 31-37)**

**BEFORE (lines 31-37):**
```typescript
    const need7d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price7d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '7 days'`)
        ))
        .limit(50);
```

**AFTER:**
```typescript
    const need7d = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price7d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '7 days'`)
        ))
        .limit(50);
```

**Sub-task 5D: Add `isActive = true` filter to `need30d` query (lines 55-61)**

**BEFORE (lines 55-61):**
```typescript
    const need30d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price30d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '30 days'`)
        ))
        .limit(50);
```

**AFTER:**
```typescript
    const need30d = await db.select()
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            isNull(signalPerformance.price30d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '30 days'`)
        ))
        .limit(50);
```

**What changed:**
- Each of the 3 queries (need24h, need7d, need30d) now has `eq(signalPerformance.isActive, true)` as the FIRST condition in the `and()` chain
- This ensures the cron only computes P&L for active signals
- Closed signals already have `realizedPnl` set by `executeSignalDecision()` and should NOT be updated
- No other changes to the file — the P&L calculation logic, the for-loops, and the UPDATE statements remain identical

**Verification Checklist:**
- [x] `eq(signalPerformance.isActive, true)` added to need24h query (line ~12)
- [x] `eq(signalPerformance.isActive, true)` added to need7d query (line ~33)
- [x] `eq(signalPerformance.isActive, true)` added to need30d query (line ~57)
- [x] Each `isActive` filter is the FIRST condition in `and()` chain (before `isNull` and `lte`)
- [x] No other code changed — P&L calculation logic, for-loops, UPDATEs all untouched
- [x] No new imports needed (`eq` already imported at line 4)
- [x] `tsc --noEmit` clean
- [x] Zero `any` types

---

### T-06: Rewrite Scorecard Controller — 3-Section Response Architecture

**File (MODIFY):** `backend/src/controllers/market.controller.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-01 + T-02 + T-03 (signalPerformance model and signalManager must be ready)

**Target:** Completely rewrite `getScorecardHandler()` (lines 531-577) to return a 3-section response architecture: tactical signals (active), strategic stance (from `coinStrategicOutlook`), and closed signals (history with realized P&L).

**Sub-task 6A: Add import for `coinStrategicOutlook`**

**Current import at line 8:**
```typescript
    signalPerformance
```

**AFTER (add `coinStrategicOutlook`):**
```typescript
    signalPerformance, coinStrategicOutlook
```

**Sub-task 6B: Add import for `getPriceWithFallback` if not already present**

Checking line 13 — `getPriceWithFallback` is already imported:
```typescript
import { getPriceWithFallback } from '../services/priceService';
```
No change needed.

**Sub-task 6C: Replace entire `getScorecardHandler` function (lines 531-577)**

**BEFORE (lines 531-577):**
```typescript
export async function getScorecardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'scorecard:latest';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const signals = await db.select()
            .from(signalPerformance)
            .orderBy(desc(signalPerformance.entryAt))
            .limit(100);

        const withPnl7d = signals.filter(s => s.pnl7d !== null);
        const wins7d = withPnl7d.filter(s => s.isWin7d === true);
        const totalSignals = signals.length;
        const winRate7d = withPnl7d.length > 0
            ? Math.round((wins7d.length / withPnl7d.length) * 100) : null;
        const avgReturn7d = withPnl7d.length > 0
            ? withPnl7d.reduce((sum, s) => sum + (s.pnl7d ?? 0), 0) / withPnl7d.length : null;

        const coinMap = new Map<string, { signals: number; wins: number; totalPnl: number }>();
        for (const s of withPnl7d) {
            const existing = coinMap.get(s.coinSymbol) ?? { signals: 0, wins: 0, totalPnl: 0 };
            existing.signals++;
            if (s.isWin7d) existing.wins++;
            existing.totalPnl += s.pnl7d ?? 0;
            coinMap.set(s.coinSymbol, existing);
        }

        const bestCall = withPnl7d.length > 0
            ? withPnl7d.reduce((best, s) => (s.pnl7d ?? 0) > (best.pnl7d ?? -Infinity) ? s : best, withPnl7d[0])
            : null;

        const response = {
            overall: {
                totalSignals,
                winRate7d,
                avgReturn7d: avgReturn7d !== null ? parseFloat(avgReturn7d.toFixed(1)) : null,
                bestCall
            },
            recent: signals.slice(0, 20),
            perCoin: Object.fromEntries(coinMap),
        };

        await setCache(cacheKey, response, 300);
        res.json(response);
    } catch (err) { next(err); }
}
```

**AFTER (complete replacement):**
```typescript
export async function getScorecardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'scorecard:latest';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        // --- Section 1: Tactical Signals (active, one per coin) ---
        const activeSignals = await db.select()
            .from(signalPerformance)
            .where(eq(signalPerformance.isActive, true))
            .orderBy(desc(signalPerformance.entryAt))
            .limit(50);

        const tacticalSignals: Array<{
            id: number;
            coinSymbol: string;
            verdict: string;
            sentiment: string | null;
            entryPrice: number;
            entryAt: Date;
            unrealizedPnl: number | null;
            currentPrice: number | null;
        }> = [];

        for (const row of activeSignals) {
            const price = await getPriceWithFallback(row.coinSymbol);
            let unrealizedPnl: number | null = null;
            if (price && price.price > 0) {
                const rawPnl = ((price.price - row.entryPrice) / row.entryPrice) * 100;
                const isBearish = row.verdict === 'SELL' || row.verdict === 'STRONG_SELL';
                unrealizedPnl = isBearish ? -rawPnl : rawPnl;
            }
            tacticalSignals.push({
                id: row.id,
                coinSymbol: row.coinSymbol,
                verdict: row.verdict,
                sentiment: row.sentiment,
                entryPrice: row.entryPrice,
                entryAt: row.entryAt,
                unrealizedPnl,
                currentPrice: price?.price ?? null,
            });
        }

        // --- Section 2: Closed Signals (with realized P&L) ---
        const closedSignals = await db.select()
            .from(signalPerformance)
            .where(eq(signalPerformance.isActive, false))
            .orderBy(desc(signalPerformance.closedAt))
            .limit(30);

        const closedWithPnl = closedSignals.filter(s => s.realizedPnl !== null);
        const wins = closedWithPnl.filter(s => s.realizedPnl !== null && s.realizedPnl > 0);
        const totalClosed = closedWithPnl.length;
        const winRate = totalClosed > 0 ? Math.round((wins.length / totalClosed) * 100) : null;
        const avgRealizedPnl = totalClosed > 0
            ? closedWithPnl.reduce((sum, s) => sum + (s.realizedPnl ?? 0), 0) / totalClosed
            : null;
        const bestTrade = closedWithPnl.length > 0
            ? closedWithPnl.reduce((best, s) => ((s.realizedPnl ?? 0) > (best.realizedPnl ?? -Infinity) ? s : best), closedWithPnl[0])
            : null;

        // --- Section 3: Strategic Stance (from coin_strategic_outlook — Phase 15) ---
        const strategicStance = await db.select()
            .from(coinStrategicOutlook)
            .orderBy(desc(coinStrategicOutlook.updatedAt))
            .limit(10);

        const response = {
            tactical: tacticalSignals,
            strategic: strategicStance,
            closed: closedSignals.slice(0, 20),
            overall: {
                activePositions: tacticalSignals.length,
                totalClosed,
                wins: wins.length,
                winRate,
                avgRealizedPnl: avgRealizedPnl !== null ? parseFloat(avgRealizedPnl.toFixed(1)) : null,
                bestTrade,
            },
        };

        await setCache(cacheKey, response, 300);
        res.json(response);
    } catch (err) { next(err); }
}
```

**Key design decisions:**

1. **Response shape change (BREAKING for frontend):** The old response had `{ overall, recent, perCoin }`. The new response has `{ tactical, strategic, closed, overall }`. This is intentionally breaking — T-07 (frontend) must deploy simultaneously.

2. **Win rate is now based on closed signals, not 7d P&L:** Old logic counted wins from `isWin7d` (which requires 7 days to fill). New logic counts wins from `realizedPnl > 0` (available immediately when a signal is closed).

3. **Unrealized P&L computed at query time:** For each active signal, current price is fetched and unrealized P&L is calculated. This is NOT stored in DB (per nextstep.md risk note #3).

4. **`closedAt` ordering for closed signals:** Uses `desc(signalPerformance.closedAt)` — nulls last by default in PostgreSQL, which is correct (rows without closedAt are still active).

5. **`eq` is already imported** at line 11 from `drizzle-orm` — no new import needed.

6. **No `perCoin` breakdown:** Replaced by the per-coin guarantee from the signal manager (one active signal per coin). The old perCoin was based on 7d P&L and was often empty.

**Verification Checklist:**
- [x] `coinStrategicOutlook` added to the model import at line 8
- [x] `getScorecardHandler` completely rewritten (lines 531-577)
- [x] Section 1: Active signals queried with `eq(signalPerformance.isActive, true)`, enriched with unrealized P&L
- [x] Section 2: Closed signals queried with `eq(signalPerformance.isActive, false)`, ordered by `closedAt`
- [x] Section 3: Strategic stance queried from `coinStrategicOutlook`
- [x] Overall stats computed from closed signals (not 7d): winRate, avgRealizedPnl, bestTrade
- [x] `tacticalSignals` array is explicitly typed — no `any`
- [x] `tacticalSignals[].currentPrice` is `number | null` (not undefined)
- [x] `tacticalSignals[].unrealizedPnl` is `number | null` (not undefined)
- [x] Price fetch fail-safe: if `getPriceWithFallback` returns null, `unrealizedPnl` stays `null`
- [x] Cache key `scorecard:latest` unchanged (same as before)
- [x] Cache TTL 300 seconds unchanged
- [x] All other controller functions untouched (`getRadarSignals`, `getMasterArticle`, etc.)
- [x] `tsc --noEmit` clean
- [x] Zero `any` types

---

### T-07: Rewrite Scorecard Frontend — 4-Section Layout

**File (MODIFY):** `frontend/src/app/(standard)/scorecard/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** T-06 (new response shape must be deployed first)

**Target:** Complete rewrite of the scorecard page with 4 visual sections: Overall Stats Bar, Tactical Signals (active), Strategic Stance (long-term), and Closed Signals (history).

**Current file:** 227 lines, server component, single `ScorecardPage` function

**New TypeScript interfaces (replace lines 27-54):**

```typescript
interface TacticalSignal {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    entryAt: string;
    unrealizedPnl: number | null;
    currentPrice: number | null;
}

interface StrategicStance {
    id: number;
    coinSymbol: string;
    marketPhase: string | null;
    bullRunProbability: number | null;
    recommendedAction: string | null;
    updatedAt: string | null;
}

interface ClosedSignal {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    entryAt: string;
    exitPrice: number | null;
    realizedPnl: number | null;
    closedAt: string | null;
}

interface OverallStats {
    activePositions: number;
    totalClosed: number;
    wins: number;
    winRate: number | null;
    avgRealizedPnl: number | null;
    bestTrade: ClosedSignal | null;
}

interface ScorecardData {
    tactical: TacticalSignal[];
    strategic: StrategicStance[];
    closed: ClosedSignal[];
    overall: OverallStats;
}
```

**Keep existing helper functions (lines 56-78) — `pnlClass()`, `pnlFormat()`, `verdictBadge()` — unchanged.**

**Add new helper function for relative time:**
```typescript
function timeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatPrice(price: number | null): string {
    if (price === null) return '—';
    if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function wyckoffColor(phase: string | null): string {
    if (!phase) return 'text-[#555]';
    const green = new Set(['Accumulation', 'Markup']);
    const red = new Set(['Distribution', 'Markdown']);
    if (green.has(phase)) return 'text-emerald-400';
    if (red.has(phase)) return 'text-red-400';
    return 'text-[#555]';
}

function durationBetween(start: string, end: string | null): string {
    if (!end) return '—';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d`;
    return `${diffHours}h`;
}
```

**Complete page layout (replace lines 80-227):**

```
Empty state check:
  → if (!data || (data.overall.activePositions === 0 && data.overall.totalClosed === 0))
  → Show "No Signals Tracked Yet" (reuse existing empty state at lines 92-104)

Section 1: Overall Stats Bar (5 stat cards in a grid)
  → Active Positions | Closed Signals | Win Rate | Avg P&L | Best Trade
  → Grid: `grid-cols-2 md:grid-cols-5 gap-3`
  → Same card style: `bg-[#0A0A0A] border border-[#222] rounded-lg p-4`
  → Best Trade shows: coinSymbol + pnlFormat(bestTrade.realizedPnl)

Section 2: Tactical Signals (Active) — Table
  → Header: "Tactical Signals"
  → Subtitle: "Short-term active positions (1-3 days). One signal per coin."
  → Columns: Coin | Signal | Entry $ | Current $ | Unrealized | Since
  → Table style: same as existing (overflow-x-auto, border, dark theme)
  → Coin: `font-mono font-semibold`
  → Signal: verdict badge (reuse existing verdictBadge function)
  → Entry $: `formatPrice(row.entryPrice)`
  → Current $: `formatPrice(row.currentPrice)`
  → Unrealized: colored with pnlClass, formatted with pnlFormat
  → Since: `timeAgo(row.entryAt)`
  → Empty state: "No active signals currently."

Section 3: Strategic Stance (Long-term) — Table
  → Only render if data.strategic.length > 0
  → Header: "Strategic Stance"
  → Subtitle: "Long-term outlook (weeks/months). From AI structural analysis."
  → Columns: Coin | Wyckoff Phase | Bull Probability | Action
  → Wyckoff: colored with wyckoffColor function
  → Bull Prob: show as `${value}%` with a simple inline progress bar (div with width percentage)
  → Action: `recommendedAction` or "—"
  → Empty state: hidden (section only renders if strategic.length > 0)

Section 4: Closed Signals (History) — Table
  → Only render if data.closed.length > 0
  → Header: "Closed Signals"
  → Subtitle: "Historical signal performance with realized P&L."
  → Columns: Coin | Signal | Entry → Exit | P&L | Held | Result
  → Entry → Exit: `formatPrice(entryPrice) → ${exitPrice ? formatPrice(exitPrice) : '—'}`
  → P&L: colored with pnlClass, formatted with pnlFormat
  → Held: `durationBetween(entryAt, closedAt)`
  → Result: checkmark (✅) for wins, X (❌) for losses
  → Empty state: hidden (section only renders if closed.length > 0)

NFA Disclaimer (keep existing at lines 213-223)
```

**Design system rules:**
- Dark theme: `bg-black` page, `bg-[#0A0A0A]` cards, `border-[#222]` borders
- Text colors: `text-white` headings, `text-[#666]` labels, `text-[#888]` secondary
- Font: `font-mono` for numbers/symbols, default for text
- Tailwind only — no inline styles, no CSS modules
- Material icons: `material-symbols-outlined` class
- Responsive: `md:` breakpoints for grid adjustments

**Precedent files (for consistent styling):**
- `frontend/src/features/home/components/TopMovers.tsx` — dark card + table styling
- `frontend/src/features/home/components/MarketMoodGauge.tsx` — stat card styling
- Current scorecard page (lines 108-226) — existing dark theme tokens

**Verification Checklist:**
- [x] 4 new TypeScript interfaces defined: `TacticalSignal`, `StrategicStance`, `ClosedSignal`, `OverallStats`
- [x] `ScorecardData` interface matches new backend response shape exactly
- [x] Zero `any` types across all interfaces and functions
- [x] Server component (no `'use client'` — same as current)
- [x] `metadata` export unchanged (lines 8-25)
- [x] `revalidate = 360` unchanged (line 4)
- [x] `apiClient.get<ScorecardData>('/market/scorecard')` updated with new type
- [x] Empty state handles both `!data` and `activePositions === 0 && totalClosed === 0`
- [x] Section 1: 5 stat cards in responsive grid
- [x] Section 2: Tactical table with Coin, Signal, Entry, Current, Unrealized, Since columns
- [x] Section 3: Strategic table with Coin, Wyckoff, Bull Prob, Action columns (conditional render)
- [x] Section 4: Closed table with Coin, Signal, Entry→Exit, P&L, Held, Result columns (conditional render)
- [x] NFA disclaimer preserved at bottom
- [x] `timeAgo()` handles minutes, hours, days, months
- [x] `formatPrice()` handles null, high prices (2 decimals), low prices (6 decimals)
- [x] `wyckoffColor()` returns emerald for Accumulation/Markup, red for Distribution/Markdown
- [x] `durationBetween()` returns days or hours
- [x] Bull probability shown as `XX%` with visual progress bar
- [x] Dark theme consistent with existing pages
- [x] No new imports (all existing Tailwind classes and material icons)
- [x] `tsc --noEmit` clean (frontend)

---

### T-VERIFY: Final Verification (run after all tasks)

**Assigned To:** Senior Developer
**Status:** ✅ Done
**Depends On:** All T-01 through T-07

**Backend checks:**
1. ✅ `cd backend && npx tsc --noEmit` — zero errors
2. ✅ `rg 'any' backend/src/services/signalManager.service.ts` — zero matches (excluding comments)
3. ✅ `rg 'any' backend/src/crons/aiWorkflow.cron.ts` — zero matches
4. ✅ `rg 'any' backend/src/crons/signalPerformance.cron.ts` — zero matches
5. ✅ `rg 'any' backend/src/controllers/market.controller.ts` — zero matches
6. ✅ Verify `signalPerformance` model has `isActive`, `closedAt`, `exitPrice`, `realizedPnl`
7. ✅ Verify `radarSignals` is NEVER updated (only INSERT in executeSignalDecision and backfillRadarSignals)
8. ✅ Verify upgrade path does NOT touch `entryAt` or `entryPrice`
9. ✅ Verify `decideSignalAction` defaults to skip on price API failure

**Frontend checks:**
10. ✅ `cd frontend && npx tsc --noEmit` — zero errors
11. ✅ Verify `ScorecardData` interface matches new backend response shape
12. ✅ Verify all 4 sections render (or conditionally hide when empty)

**Integration checks:**
13. ✅ Verify `/market/scorecard` route still works (same path, new response shape)
14. ✅ Verify `getScorecardHandler` returns `{ tactical, strategic, closed, overall }`
15. ✅ Verify cache key `scorecard:latest` is cleared on deploy (manual Redis flush or let TTL expire)

**Status:** PLANNING COMPLETE — READY FOR EXECUTION (Senior Developer)

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
