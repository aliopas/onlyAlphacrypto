# Phase 1 — Event-Price Foundation

**Status:** PLANNED — Ready for immediate execution  
**Date:** May 2, 2026  
**Priority:** P0 (Foundation for all temporal intelligence)  
**Scope:** 1 SQL migration, 1 model update, 2 new files, 2 modified files  
**Reviewed by:** Lead Architect — APPROVED FOR EXECUTION  

## OBJECTIVE

Establish the data foundation for all event-price relationship analysis. The current `coin_news_history` table stores events but lacks outcome tracking. Phase 1 adds live event capture, outcome measurement at multiple horizons, and price range analysis.

## REQUIRED TASKS

### T-1A-01: Expand coin_news_history Schema Migration

**Task ID:** T-1A-01
**Phase:** Phase 1A — Expand coin_news_history schema
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add 18 new nullable columns to `coin_news_history` for multi-horizon outcome tracking and price analysis. Maintain backward compatibility by keeping all columns nullable.

**Migration path:** backend/scripts/migrate-coin-news-history-phase1.sql

**Detailed steps:**
1. ALTER TABLE coin_news_history ADD COLUMN source_hash varchar(64) nullable
2. ALTER TABLE coin_news_history ADD COLUMN event_scope varchar(20) nullable
3. ALTER TABLE coin_news_history ADD COLUMN btc_price_at_event real nullable
4. ALTER TABLE coin_news_history ADD COLUMN eth_price_at_event real nullable
5. ALTER TABLE coin_news_history ADD COLUMN fear_greed_at_event integer nullable
6. ALTER TABLE coin_news_history ADD COLUMN price_1h_after real nullable
7. ALTER TABLE coin_news_history ADD COLUMN price_4h_after real nullable
8. ALTER TABLE coin_news_history ADD COLUMN price_24h_after real nullable
9. ALTER TABLE coin_news_history ADD COLUMN price_3d_after real nullable
10. ALTER TABLE coin_news_history ADD COLUMN change_1h real nullable
11. ALTER TABLE coin_news_history ADD COLUMN change_4h real nullable
12. ALTER TABLE coin_news_history ADD COLUMN change_24h real nullable
13. ALTER TABLE coin_news_history ADD COLUMN change_3d real nullable
14. ALTER TABLE coin_news_history ADD COLUMN max_upside_after_event real nullable
15. ALTER TABLE coin_news_history ADD COLUMN max_drawdown_after_event real nullable
16. ALTER TABLE coin_news_history ADD COLUMN time_to_peak_hours integer nullable
17. ALTER TABLE coin_news_history ADD COLUMN time_to_bottom_hours integer nullable
18. ALTER TABLE coin_news_history ADD COLUMN outcome_classification varchar(30) nullable
19. CREATE UNIQUE INDEX idx_cnh_sourcehash ON coin_news_history (source_hash) WHERE source_hash IS NOT NULL;

**Acceptance criteria:**
- All 18 columns added as nullable
- No existing data loss
- Index created for exact-content dedup
- Migration rollback-safe

**Testing / verification:**
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'coin_news_history'
AND column_name IN (
  'source_hash',
  'event_scope',
  'btc_price_at_event',
  'eth_price_at_event',
  'fear_greed_at_event',
  'price_1h_after',
  'price_4h_after',
  'price_24h_after',
  'price_3d_after',
  'change_1h',
  'change_4h',
  'change_24h',
  'change_3d',
  'max_upside_after_event',
  'max_drawdown_after_event',
  'time_to_peak_hours',
  'time_to_bottom_hours',
  'outcome_classification'
);

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'coin_news_history'
AND indexname = 'idx_cnh_sourcehash';

**Rollback notes:**
- DROP INDEX IF EXISTS idx_cnh_sourcehash;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS outcome_classification;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_bottom_hours;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_peak_hours;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_drawdown_after_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_upside_after_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_3d;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_24h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_4h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_1h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_3d_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_24h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_4h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_1h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS fear_greed_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS eth_price_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS btc_price_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS event_scope;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS source_hash;
- No data loss risk

**Dependencies:**
None (independent schema change)  

---

### T-1A-02: Update Drizzle Model for coin_news_history

**Task ID:** T-1A-02
**Phase:** Phase 1A — Expand coin_news_history schema
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Update `backend/src/models/market.model.ts` to match the 18 new columns added in migration.

**Files to inspect:**
- `backend/src/models/market.model.ts:276-295` — current coin_news_history table definition

**Files likely to modify:**
- `backend/src/models/market.model.ts`

**Detailed steps:**
1. Add the 18 new columns to the `coinNewsHistory` table definition in `market.model.ts` using camelCase properties mapped to snake_case SQL names:
   - sourceHash: varchar('source_hash', { length: 64 }).nullable()
   - eventScope: varchar('event_scope', { length: 20 }).nullable()
   - btcPriceAtEvent: real('btc_price_at_event').nullable()
   - ethPriceAtEvent: real('eth_price_at_event').nullable()
   - fearGreedAtEvent: integer('fear_greed_at_event').nullable()
   - price1hAfter: real('price_1h_after').nullable()
   - price4hAfter: real('price_4h_after').nullable()
   - price24hAfter: real('price_24h_after').nullable()
   - price3dAfter: real('price_3d_after').nullable()
   - change1h: real('change_1h').nullable()
   - change4h: real('change_4h').nullable()
   - change24h: real('change_24h').nullable()
   - change3d: real('change_3d').nullable()
   - maxUpsideAfterEvent: real('max_upside_after_event').nullable()
   - maxDrawdownAfterEvent: real('max_drawdown_after_event').nullable()
   - timeToPeakHours: integer('time_to_peak_hours').nullable()
   - timeToBottomHours: integer('time_to_bottom_hours').nullable()
   - outcomeClassification: varchar('outcome_classification', { length: 30 }).nullable()
2. Match exact column names and types from migration
3. Ensure all are nullable (.nullable())
4. Verify column order matches migration

**Acceptance criteria:**
- `tsc --noEmit` clean in backend
- Drizzle schema matches database schema exactly
- No any types introduced

**Testing / verification:**
- `cd backend && npx drizzle-kit generate` — should succeed with no errors
- `cd backend && npx tsc --noEmit` — zero errors

**Rollback notes:**
- Remove the 18 new column definitions
- Regenerate Drizzle types

**Dependencies:**
- T-1A-01 (migration must run first)  

---

### T-1B-01: Live MAJOR Event Bridge in AI Workflow

**Task ID:** T-1B-01
**Phase:** Phase 1B — Live MAJOR event bridge from aiWorkflow.cron.ts to coin_news_history
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add live capture of MAJOR events into `coin_news_history` immediately after they trigger AI analysis, including BTC/ETH/FearGreed context.

**Files to inspect:**
- `backend/src/crons/aiWorkflow.cron.ts:500-550` — current MAJOR event processing block
- `backend/src/services/binance.service.ts:76-98` — getPriceWithFallback signature

**Files likely to modify:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Detailed steps:**
1. After `saveMemory()` call (around line 527), add event INSERT into `coin_news_history`
2. Fetch BTC/ETH prices once per workflow run (cache in memory)
3. Fetch FearGreed index once per workflow run
4. Populate: coinSymbol, title, source, publishedAt, sentiment, eventType, eventSeverity, priceAtTime, sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent
5. Set sourceHash for dedup (exact-content only)
6. Handle duplicate key errors gracefully (skip if sourceHash exists)

**Acceptance criteria:**
- MAJOR events inserted immediately after memory save
- BTC/ETH prices cached per run
- Dedup via sourceHash (not semantic)
- No blocking errors on duplicate inserts

**Testing / verification:**
- Trigger MAJOR event, check `coin_news_history` row inserted
- Verify priceAtTime populated correctly
- Verify sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent populated

**Rollback notes:**
- Remove the INSERT block
- No data cleanup needed (rows can remain)

**Dependencies:**
- T-1A-01 + T-1A-02 (schema ready)  

---

### T-1C-01: Create eventOutcomeChecker.cron.ts

**Task ID:** T-1C-01
**Phase:** Phase 1C — eventOutcomeChecker.cron.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
New cron job that checks event outcomes at 30-minute intervals, filling price1hAfter/change1h to price3dAfter/change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification using price data.

**Files to inspect:**
- `backend/src/services/binance.service.ts` — for price fetching
- `backend/src/services/coin-memory.service.ts` — for outcome classification logic

**Files likely to modify:**
- `backend/src/crons/eventOutcomeChecker.cron.ts` (NEW FILE)

**Detailed steps:**
1. Create new file with Redis lock
2. Query `coin_news_history` where price1hAfter IS NULL and publishedAt > 1 hour ago (limit 50)
3. For each event, fetch price data using `getCoinKlinesRange()` (new function from T-1D-01)
4. Calculate price1hAfter/change1h to price3dAfter/change3d based on price at horizons
5. Calculate maxUpsideAfterEvent/maxDrawdownAfterEvent using 1h OHLCV candles only (never use 1D candles)
6. Calculate timeToPeakHours (hours to max upside), timeToBottomHours (hours to max drawdown)
7. Classify outcomeClassification (POSITIVE/NEGATIVE/NEUTRAL) based on price movement direction
8. Update existing 7d fields if missing
9. Process all horizons (1h/4h/24h/3d/7d) in batches

**Acceptance criteria:**
- Redis lock prevents duplicate runs
- maxUpsideAfterEvent/maxDrawdownAfterEvent use 1h candles only
- Outcome classification matches event sentiment direction
- Handles missing price data gracefully

**Testing / verification:**
- Check cron logs for successful updates
- Verify outcome fields populated after 1h
- SQL: `SELECT price1hAfter, maxUpsideAfterEvent FROM coin_news_history WHERE price1hAfter IS NOT NULL LIMIT 5`

**Rollback notes:**
- Delete the cron file
- Remove from server.ts registration
- No data rollback (calculated fields optional)

**Dependencies:**
- T-1A-01 + T-1A-02 + T-1D-01 (schema + getCoinKlinesRange)

---

### T-1C-02: Register eventOutcomeChecker Cron in server.ts

**Task ID:** T-1C-02  
**Phase:** Phase 1C — eventOutcomeChecker.cron.ts  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Register the new eventOutcomeChecker cron in the server startup sequence.

**Files to inspect:**  
- `backend/src/server.ts:50-70` — current cron registrations  

**Files likely to modify:**  
- `backend/src/server.ts`  

**Detailed steps:**  
1. Import `startEventOutcomeCheckerCron` from the new cron file  
2. Add to the cron startup sequence with 30-minute schedule  
3. Follow existing pattern (staggered 5s delays)  

**Acceptance criteria:**  
- Cron registered and starts on server boot  
- No import errors  
- Logs show cron scheduled  

**Testing / verification:**  
- Server logs: "eventOutcomeChecker cron scheduled"  
- No startup errors  

**Rollback notes:**  
- Remove the import and registration call  
- Server starts normally without it  

**Dependencies:**  
- T-1C-01 (cron file exists)  

---

### T-1D-01: getCoinKlinesRange() in binance.service.ts

**Task ID:** T-1D-01  
**Phase:** Phase 1D — getCoinKlinesRange() in binance.service.ts  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Add a new function to fetch historical klines for date ranges, with pagination cap at 1500 candles.

**Files to inspect:**  
- `backend/src/services/binance.service.ts:100-120` — existing getCoinKlines function  

**Files likely to modify:**  
- `backend/src/services/binance.service.ts`  

**Detailed steps:**  
1. Add `getCoinKlinesRange(symbol: string, interval: string, startTime: number, endTime: number)`  
2. Paginate requests (Binance limit 1000 per call) up to 1500 total  
3. Return array of OHLCV objects with timestamps  
4. Handle rate limits and errors gracefully  

**Acceptance criteria:**  
- Returns historical klines for date range  
- Pagination handles >1000 candles  
- Compatible with existing getCoinKlines format  

**Testing / verification:**  
- Call for BTC 1h candles over 2 days  
- Verify correct number of candles returned  
- Handle invalid date ranges  

**Rollback notes:**  
- Remove the new function  
- No impact on existing code  

**Dependencies:**  
None (independent utility function)  

---

### T-1E-01: Phase 1 Verification and Rollback Checklist

**Task ID:** T-1E-01  
**Phase:** Phase 1 — Verification  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Comprehensive verification that Phase 1 foundation is working correctly, with rollback procedures.

**Detailed steps:**  
1. SQL schema verification  
2. Cron registration check  
3. Live event insertion test  
4. Outcome calculation verification  
5. Price data accuracy checks  

**Acceptance criteria:**  
- All SQL checks pass  
- Live MAJOR events populate coin_news_history  
- Outcome fields fill correctly after horizons  
- maxUpside/maxDrawdown calculated from 1h candles only  

**Testing / verification:**
- SQL: Check all 18 columns exist on coin_news_history
- SQL: Verify partial sourceHash index exists
- Trigger MAJOR event, verify row inserted
- Wait 1h+, verify price1hAfter populated
- Verify maxUpsideAfterEvent/maxDrawdownAfterEvent use 1h OHLCV only  

**Rollback notes:**
- Migration: Drop 18 columns + index  
- Cron: Remove eventOutcomeChecker registration + delete file  
- Workflow: Remove INSERT block from aiWorkflow.cron.ts  
- Data: No permanent data loss (calculated fields optional)  

**Dependencies:**  
- All T-1A through T-1D tasks  

---

## WHAT DOES NOT CHANGE

1. **Existing coin_news_history rows** — remain unchanged  
2. **Semantic dedup** — remains embedding-based in other tables  
3. **AI workflow for non-MAJOR events** — unchanged  
4. **Existing crons** — continue running normally  
5. **No new npm packages**  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/scripts/migrate-coin-news-history-phase1.sql` | 🔴 TODO | New — schema expansion migration |
| `backend/src/models/market.model.ts` | 🔴 TODO | Add 19 new columns to coinNewsHistory |
| `backend/src/crons/aiWorkflow.cron.ts` | 🔴 TODO | Add live MAJOR event INSERT after saveMemory |
| `backend/src/crons/eventOutcomeChecker.cron.ts` | 🔴 TODO | New — 30min outcome checking cron |
| `backend/src/server.ts` | 🔴 TODO | Register eventOutcomeChecker cron |
| `backend/src/services/binance.service.ts` | 🔴 TODO | Add getCoinKlinesRange() function |

**Total: 1 new SQL, 1 new cron file, 4 modified files**

---

## PRIORITY ORDER

```
1. T-1A-01 — Migration (blocks everything)
2. T-1A-02 — Model update (matches migration)
3. T-1D-01 — Utility function (independent)
4. T-1B-01 — Workflow bridge (needs schema)
5. T-1C-01 — New cron (needs schema + utility)
6. T-1C-02 — Cron registration (needs cron file)
7. T-1E-01 — Verification (final)
```

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|---|-----------------|
| 1 | Run migration | All 18 columns added, index created |
| 2 | Server starts | eventOutcomeChecker cron registered, no errors |
| 3 | MAJOR event triggers | Row inserted in coin_news_history with priceAtTime, sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent |
| 4 | Wait 1 hour | price1hAfter field populated with outcome classification |
| 5 | Check maxUpsideAfterEvent calculation | Uses 1h OHLCV high - priceAtTime |
| 6 | Check maxDrawdownAfterEvent calculation | Uses priceAtTime - 1h OHLCV low |
| 7 | Duplicate MAJOR event | Skipped due to sourceHash dedup |

---

## RISK NOTES

1. **Migration size** — 19 columns is significant; test on staging first  
2. **Rate limits** — getCoinKlinesRange pagination may hit Binance limits  
3. **Data accuracy** — Ensure priceAtTime is captured at event time, not delayed  
4. **Backward compatibility** — All new columns nullable, no breaking changes  

---

## Planning Correction Log

**Date:** May 2, 2026  
**Issue:** Blocking inconsistency in T-1A-01 schema plan — listed 27 columns but claimed 19, using old v2 plan instead of final v3.  
**Correction:** Replaced with final v3 18-column schema as specified by Lead Architect. Removed outcome1h/outcome4h/outcome24h/outcome3d/outcome7d, maxUpside1h/maxDrawdown1h etc., high1h/low1h etc., price1h/price4h/price24h/price3d, majorCoinsImpact, eventHorizon. Added sourceHash (dedup), eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent, price1hAfter to price3dAfter, change1h to change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification.  
**Impact:** Downstream tasks T-1A-02, T-1B-01, T-1C-01 corrected accordingly. No application code modified.

---

*Phase 1 authored: May 2, 2026*  
*Foundation for: All temporal intelligence, event-outcome correlation, price impact analysis*

---

---

# Phase 2 — Expand Temporal Intelligence

**Status:** PLANNED — Partially executable after Phase 1 schema
**Date:** May 3, 2026
**Priority:** P1 (Enables data-rich temporal patterns)
**Scope:** 1 SQL migration, 1 model update, 1 cron extension, 1 new service, 2 workflow updates, 1 verification checklist
**Reviewed by:** Lead Architect + Tech Lead/Supreme Reviewer — APPROVED FOR EXECUTION

## OBJECTIVE

Enable OnlyAlpha to compare live classified events against historical similar events from coin_news_history, calculate deterministic outcome statistics, and inject DB-grounded context into AI workflows for policy-safe market scenarios.

## REQUIRED TASKS

### T-2A-01: 7d Schema Migration and Rollback

**Task ID:** T-2A-01
**Phase:** Phase 2A — 7d schema migration and rollback
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Add 7d support to coin_news_history schema with price_7d_after and change_7d nullable columns, plus safe rollback procedures.

**Files allowed:**
- `backend/scripts/migrate-coin-news-history-phase2.sql` (new migration file)

**Implementation requirements:**
1. ALTER TABLE coin_news_history ADD COLUMN price_7d_after real nullable
2. ALTER TABLE coin_news_history ADD COLUMN change_7d real nullable
3. Ensure migration is rollback-safe (DROP COLUMN statements in reverse order)

**Explicit exclusions:**
- Do not modify any existing columns or indexes
- Do not alter outcome_classification (kept based on 3d)
- No data backfill in migration (handled by eventOutcomeChecker)

**Acceptance criteria:**
- Migration adds exactly 2 new nullable columns
- No existing data loss
- Rollback drops the 2 columns cleanly

**QA notes:**
- Test migration on staging DB first
- Verify column types match Drizzle model expectations
- Confirm rollback leaves schema identical to pre-migration state

**Dependencies:**
- Phase 1 schema (T-1A-01 + T-1A-02)

---

### T-2B-01: Drizzle Model Update

**Task ID:** T-2B-01
**Phase:** Phase 2B — Drizzle model update
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Update backend/src/models/market.model.ts to include price7dAfter and change7d fields in coinNewsHistory table definition.

**Files allowed:**
- `backend/src/models/market.model.ts`

**Implementation requirements:**
1. Add price7dAfter: real('price_7d_after').nullable()
2. Add change7d: real('change_7d').nullable()
3. Map camelCase properties to snake_case SQL columns
4. Ensure column order matches migration

**Explicit exclusions:**
- Do not modify any other columns in coinNewsHistory table
- No changes to other table definitions
- No type changes to existing fields

**Acceptance criteria:**
- `tsc --noEmit` passes in backend
- Drizzle schema matches database schema after migration
- No any types introduced

**QA notes:**
- Run `cd backend && npx drizzle-kit generate` to verify schema generation
- Check that existing code compiles without changes

**Dependencies:**
- T-2A-01 (migration must run first)

---

### T-2C-01: eventOutcomeChecker 7d Extension

**Task ID:** T-2C-01
**Phase:** Phase 2C — eventOutcomeChecker 7d extension
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Extend eventOutcomeChecker.cron.ts to fill 7d fields after publishedAt + 7d, maintaining existing 3d logic unchanged.

**Files allowed:**
- `backend/src/crons/eventOutcomeChecker.cron.ts`

**Implementation requirements:**
1. Add 7d horizon calculation logic after 3d calculations
2. Fill price_7d_after and change_7d based on price at publishedAt + 7 days
3. Keep all existing retry logic (3 attempts) for generateDualNewsOutput
4. Keep all existing fallback logic for generateLightweightTriage
5. Keep existing adaptive model routing logic (temperature adjustment)

**Explicit exclusions:**
- Do not modify outcome_classification (remains 3d-based)
- No changes to 1h/4h/24h/3d field population logic
- No new AI calls or service integrations

**Acceptance criteria:**
- 7d fields populated after 7 days from publishedAt
- Existing 3d outcome logic unchanged
- Cron continues to run at 30-minute intervals

**QA notes:**
- Verify 7d fields remain null until 7 days pass
- Test with events >7 days old to confirm population
- Ensure no regression in existing 3d calculations

**Dependencies:**
- T-2A-01 + T-2B-01 (schema ready)
- T-1C-01 (existing eventOutcomeChecker exists)

---

### T-2D-01: historicalEventStats.service.ts Creation

**Task ID:** T-2D-01
**Phase:** Phase 2D — historicalEventStats.service.ts creation
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Create backend/src/services/historicalEventStats.service.ts that deterministically queries coin_news_history and calculates statistics per matching hierarchy.

**Files allowed:**
- `backend/src/services/historicalEventStats.service.ts` (new file)

**Implementation requirements:**
1. Implement matching hierarchy: A. exact (coinSymbol + eventType + eventScope + sentiment), B. relaxed level 1 (coinSymbol + eventType + eventScope), C. relaxed level 2 (eventType + eventScope + sentiment), D. relaxed level 3 (eventType + eventScope), E. market-wide fallback (eventType only)
2. Calculate per-horizon sample sizes, median returns, positive/bullish outcome rates, average max upside/drawdown
3. Assign confidence: 0 (none), 1-2 (very_low), 3-5 (low), 6-15 (medium), 16+ (high); adjust downward for relaxed match level/incomplete data/mixed outcomes
4. Use query strategy: rows eligible if at least one relevant change field non-null, per-horizon stats skip nulls independently, order by publishedAt DESC, limit 100 rows
5. Return: matchLevelUsed, sampleSize, horizonSampleSizes, horizonsAvailable, medianReturn per horizon, positive/bullish outcome rate per horizon, averageMaxUpside, averageMaxDrawdown, confidenceLevel, limitations
6. Never call AI, never invent data

**Explicit exclusions:**
- No AI integrations or calls
- No caching or state management (pure query/service)
- No external API calls
- No prompt or workflow logic

**Acceptance criteria:**
- Service exports function that takes event parameters and returns statistics object
- All calculations deterministic from database data
- Handles edge cases (no matches, small samples) gracefully

**QA notes:**
- Test with known historical data to verify calculations
- Verify confidence levels adjust correctly for match levels
- Ensure limitations field populated when data insufficient

**Dependencies:**
- T-2A-01 + T-2B-01 + T-2C-01 (7d data available)

---

### T-2E-01: AI Workflow Integration

**Task ID:** T-2E-01
**Phase:** Phase 2E — AI workflow integration
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Integrate historicalEventStats.service.ts into aiWorkflow.cron.ts to call stats service after event classification and inject returned stats into AI prompts.

**Files allowed:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Implementation requirements:**
1. Import historicalEventStats service
2. Call stats service after event classification (before AI analysis)
3. Inject returned stats into prompt context
4. AI must use provided stats only, never invent numbers
5. If no stats, omit historical comparison section
6. If low confidence, state "limited historical sample available"

**Explicit exclusions:**
- No changes to event classification logic
- No modifications to existing AI model routing
- No changes to prompt structure beyond stats injection

**Acceptance criteria:**
- Stats service called for each classified event
- AI prompts include historical stats when available
- No AI hallucinations or invented statistics

**QA notes:**
- Verify stats appear in AI prompts for events with historical matches
- Test behavior when no historical data exists
- Ensure AI responses reference provided stats accurately

**Dependencies:**
- T-2D-01 (stats service exists)
- T-1B-01 (existing AI workflow)

---

### T-2F-01: Prompt/Policy-Safe Stats Injection

**Task ID:** T-2F-01
**Phase:** Phase 2F — prompt/policy-safe stats injection
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Update AI prompts to use policy-safe language mapping for historical stats presentation, maintaining AdSense-safe output.

**Files allowed:**
- `backend/src/services/ai/prompt-factory.ts`

**Implementation requirements:**
1. Map internal stats to public language: Signal -> Market Scenario, Entry -> Reference Price, TP -> Target Zone, SL -> Risk Zone / Invalidation Zone, P&L -> Historical Outcome, Win Rate -> Outcome Rate, Buy/Sell -> Bullish/Bearish Bias
2. Format stats injection as policy-safe analysis context
3. Public language must remain AdSense-safe

**Explicit exclusions:**
- No changes to internal data structures or calculations
- No modifications to stats service output
- Backend/internal verdict values remain raw

**Acceptance criteria:**
- AI outputs use policy-safe terminology
- Historical stats presented as analysis context, not predictions
- No financial advice framing

**QA notes:**
- Audit AI outputs for policy-safe language
- Verify mapping table applied consistently
- Test with various stat confidence levels

**Dependencies:**
- T-2E-01 (stats injection exists)
- Existing prompt-factory structure

---

### T-2G-01: Phase 2 Verification Checklist

**Task ID:** T-2G-01
**Phase:** Phase 2G — Phase 2 verification checklist
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Create comprehensive verification checklist/script for Phase 2 stats behavior and AI integration.

**Files allowed:**
- `backend/scripts/verify-phase2-stats.js` (new verification script)

**Implementation requirements:**
1. SQL checks for 7d column existence and population
2. Test historicalEventStats service with sample events
3. Verify AI workflow integration and prompt injection
4. Validate policy-safe language mapping
5. Check confidence level calculations

**Explicit exclusions:**
- No modifications to application code
- Pure verification/testing script
- No deployment or runtime changes

**Acceptance criteria:**
- Script runs without errors on staging environment
- All checks pass for Phase 2 functionality
- Provides clear pass/fail results

**QA notes:**
- Run script after Phase 2 deployment
- Use for regression testing in future updates
- Include sample data for consistent testing

**Dependencies:**
- All T-2A through T-2F tasks

---

### T-2H-01: Optional Index Migration

**Task ID:** T-2H-01
**Phase:** Phase 2H — optional index migration
**Owner:** Senior Developer
**Status:** Planned

**Objective:**
Determine if separate index migration needed for 7d query performance, and implement if required.

**Files allowed:**
- `backend/scripts/migrate-coin-news-history-phase2-index.sql` (new if needed)

**Implementation requirements:**
1. Analyze query patterns in historicalEventStats.service.ts
2. Determine if additional indexes needed beyond Phase 1 index
3. Create migration script if performance optimization required

**Explicit exclusions:**
- Only create if determined necessary after analysis
- No forced index creation without justification
- Maintain backward compatibility

**Acceptance criteria:**
- If created: index improves query performance for 7d stats
- If skipped: documented reasoning for no additional indexes
- No negative impact on existing queries

**QA notes:**
- Performance test queries before/after index creation
- Monitor database performance post-deployment
- Rollback plan includes index removal

**Dependencies:**
- T-2D-01 (to analyze query patterns)

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|---|-----------------|
| 1 | Migration runs | price_7d_after and change_7d columns added |
| 2 | Drizzle generate | Schema updates without errors |
| 3 | eventOutcomeChecker | Populates 7d fields after 7 days |
| 4 | historicalEventStats service | Returns accurate statistics for sample events |
| 5 | AI workflow | Calls stats service and injects into prompts |
| 6 | AI output | Uses policy-safe language for historical stats |
| 7 | Verification script | All Phase 2 checks pass |

---

*Phase 2 authored: May 2, 2026*  
*Depends on: Phase 1 data accumulation for meaningful statistics*

---

---

# Phase 3 — Multi-Horizon Scenario Tracker

**Status:** PLANNED — After Phase 1 stable  
**Date:** May 2, 2026  
**Priority:** P1 (Enables investment vs speculation tracking)  
**Scope:** 4 model updates, 3 cron updates, 1 scorecard update  

## OBJECTIVE

Separate short-term signals (speculation/swing) from long-term convictions (investment). Add horizon-based expiry and tracking.

## REQUIRED TASKS

### T-3A-01: Add horizon Column to signal_performance

**Task ID:** T-3A-01  
**Phase:** Phase 3A — Horizon column on signal_performance  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Add nullable horizon column to distinguish speculation (7d), swing (90d), investment (ongoing).

**Files to inspect:**  
- `backend/src/models/market.model.ts:180-200` — signalPerformance table  

**Files likely to modify:**  
- `backend/src/models/market.model.ts`  
- Migration script  

**Detailed steps:**  
1. Add `horizon` column (VARCHAR, nullable)  
2. Migration with backfill logic  

**Acceptance criteria:**  
- Schema updated without breaking existing rows  

**Testing / verification:**  
- New signals get horizon assigned  

**Rollback notes:**  
- Drop horizon column  

**Dependencies:**  
None  

---

### T-3B-01: AI Horizon Classification in Deep Analysis

**Task ID:** T-3B-01  
**Phase:** Phase 3B — AI horizon classification  
**Owner:** Prompt Engineer  
**Status:** Planned  

**Objective:**  
Update deep analysis JSON schema to include horizon classification.

**Files to inspect:**  
- `backend/src/services/ai/prompt-factory.ts:100-150` — deep analysis prompt  

**Files likely to modify:**  
- `backend/src/services/ai/prompt-factory.ts`  

**Detailed steps:**  
1. Add horizon field to JSON schema  
2. Update system prompt for horizon reasoning  

**Acceptance criteria:**  
- AI classifies signals by timeframe appropriately  

**Testing / verification:**  
- Analysis output includes horizon field  

**Rollback notes:**  
- Remove horizon from schema  

**Dependencies:**  
None  

---

### T-3C-01: Horizon-Aware Signal Creation

**Task ID:** T-3C-01  
**Phase:** Phase 3C — Horizon-aware signal creation  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Route investment signals to coin_strategic_outlook, speculation to signal_performance.

**Files to inspect:**  
- `backend/src/crons/aiWorkflow.cron.ts:520-540` — signal creation logic  

**Files likely to modify:**  
- `backend/src/crons/aiWorkflow.cron.ts`  

**Detailed steps:**  
1. Check horizon from analysis result  
2. Investment horizon → INSERT coin_strategic_outlook  
3. Speculation/swing → existing signal_performance logic  

**Acceptance criteria:**  
- Signals routed correctly by horizon  

**Testing / verification:**  
- Investment signals appear in strategic_outlook  

**Rollback notes:**  
- Revert routing logic  

**Dependencies:**  
- T-3A-01 + T-3B-01  

---

### T-3D-01: Horizon-Based Auto-Expiry

**Task ID:** T-3D-01  
**Phase:** Phase 3D — Horizon-based expiry in tpslMonitor  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Auto-close signals based on horizon: speculation (7d), swing (90d).

**Files to inspect:**  
- `backend/src/crons/tpslMonitor.cron.ts` — current TP/SL logic  

**Files likely to modify:**  
- `backend/src/crons/tpslMonitor.cron.ts`  

**Detailed steps:**  
1. Add horizon-based expiry checks  
2. Close expired signals with reason  

**Acceptance criteria:**  
- Signals expire at appropriate horizons  

**Testing / verification:**  
- Old signals auto-closed  

**Rollback notes:**  
- Remove expiry logic  

**Dependencies:**  
- T-3A-01  

---

### T-3E-01: Investment Thesis Tracking

**Task ID:** T-3E-01  
**Phase:** Phase 3E — Investment thesis on coin_strategic_outlook  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Add thesis tracking columns to coin_strategic_outlook.

**Files to inspect:**  
- `backend/src/models/market.model.ts:230-250` — coinStrategicOutlook table  

**Files likely to modify:**  
- `backend/src/models/market.model.ts`  

**Detailed steps:**  
1. Add thesis tracking columns  
2. Update migration  

**Acceptance criteria:**  
- Investment theses tracked with outcomes  

**Testing / verification:**  
- Thesis entries have outcome fields  

**Rollback notes:**  
- Drop thesis columns  

**Dependencies:**  
None  

---

### T-3F-01: 90d P&L Tracking for Swing Signals

**Task ID:** T-3F-01  
**Phase:** Phase 3F — 90d P&L tracking  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Extend signalPerformance cron to track 90d P&L for swing signals.

**Files to inspect:**  
- `backend/src/crons/signalPerformance.cron.ts:80-100` — current 30d logic  

**Files likely to modify:**  
- `backend/src/crons/signalPerformance.cron.ts`  

**Detailed steps:**  
1. Add 90d P&L calculation block  
2. Only for swing horizon signals  

**Acceptance criteria:**  
- Swing signals get 90d tracking  

**Testing / verification:**  
- 90d fields populated for swing signals  

**Rollback notes:**  
- Remove 90d calculation  

**Dependencies:**  
- T-3A-01  

---

### T-3G-01: Scorecard 3-Section Layout

**Task ID:** T-3G-01  
**Phase:** Phase 3G — Scorecard 3-section display  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Update scorecard to show Active Market Scenarios, Long-Term Convictions, Completed Scenarios.

**Files to inspect:**  
- `frontend/src/app/(standard)/scorecard/page.tsx` — current layout  

**Files likely to modify:**  
- `frontend/src/app/(standard)/scorecard/page.tsx`  

**Detailed steps:**  
1. Restructure into 3 sections  
2. Pull from both signal_performance and coin_strategic_outlook  

**Acceptance criteria:**  
- Scorecard shows separated sections  

**Testing / verification:**  
- All sections render correctly  

**Rollback notes:**  
- Revert to single table layout  

**Dependencies:**  
- T-3A-01 + T-3C-01 + T-3E-01  

---

*Phase 3 authored: May 2, 2026*  
*Enables: Clear separation of short-term trading vs long-term investing*

---

---

# Phase 4 — Multi-Horizon Scenario Tracker

**Status:** DONE — QA PASS  
**Date:** May 3, 2026  
**Priority:** P1 (Enables investment vs speculation tracking)  
**Scope:** 1 SQL migration, 3 new files, 2 modified files  

## OBJECTIVE

Track market scenarios across multiple horizons (speculation, swing, investment) with bias-aware outcome classification, dedup prevention, and automated invalidation logic.

## REQUIRED TASKS

### T-4A-01: Market Scenarios Migration

**Task ID:** T-4A-01
**Phase:** Phase 4A — market_scenarios tables
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Create market_scenarios, scenario_horizon_outcomes, scenario_status_history tables with enums for multi-horizon tracking.

**Migration path:** backend/scripts/migrate-market-scenarios.sql

**Acceptance criteria:**
- All tables and enums created
- Numeric precision correct (numeric(24,12) for prices, numeric(10,4) for percents)
- Indexes on dedupeKey, status, dueAt, etc.
- Additive only (no existing tables modified)

**Testing / verification:**
- Tables exist with correct schemas
- Enums include all required values (scenario_status: pending/active/completed/expired/invalidated)

### T-4B-01: Scenario Tracker Service

**Task ID:** T-4B-01
**Phase:** Phase 4B — scenarioTracker.service.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Implement scenario creation with dedup, horizon outcomes generation, and status updates.

**Files modified:**
- backend/src/services/scenarioTracker.service.ts (new)

**Acceptance criteria:**
- createScenario generates dedupeKey correctly and prevents duplicates
- createHorizonOutcomesForScenario creates 11 outcomes (3 spec + 3 swing + 5 invest) with dueAt from referencePriceAt + duration
- updateScenarioStatus inserts history row

### T-4C-01: Outcome Checker Cron

**Task ID:** T-4C-01
**Phase:** Phase 4C — scenarioOutcomeChecker.cron.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Hourly cron to capture outcomes using historical candles from referencePriceAt to dueAt.

**Files modified:**
- backend/src/crons/scenarioOutcomeChecker.cron.ts (new)
- backend/src/server.ts (cron registration)

**Acceptance criteria:**
- Fetches candles from referencePriceAt to dueAt
- Bias-aware classification (bullish favors positive change, bearish favors negative)
- Invalidation logic checks risk zones and invalidationPrice
- changePercent = ((priceAtHorizon - priceAtStart) / priceAtStart) * 100

### T-4D-01: Drizzle Model Updates

**Task ID:** T-4D-01
**Phase:** Phase 4D — market.model.ts updates
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add market_scenarios, scenario_horizon_outcomes, scenario_status_history tables to Drizzle schema.

**Files modified:**
- backend/src/models/market.model.ts

**Acceptance criteria:**
- All enums defined (source_type, scenario_type, bias_type, etc.)
- Numeric precision matches migration
- Indexes match migration

### T-4E-01: Verification Script

**Task ID:** T-4E-01
**Phase:** Phase 4E — verify-phase4-scenarios.js
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Read-only script to verify scenario data integrity.

**Files modified:**
- backend/scripts/verify-phase4-scenarios.js (new)

**Acceptance criteria:**
- Checks total scenarios, by status/type/bias
- Verifies duplicate dedupeKeys
- Validates reference prices
- Handles no-data gracefully

---

## DEFERRED ITEMS

- **aiWorkflow scenario integration:** Deferred per Phase 4 plan (env flag SCENARIO_TRACKER_ENABLED exists for future enable)
- **Phase 3 levelIntelligenceCron.ts:** Known gap/stub - level intelligence does not run automatically (confirmed in QA)

---

*Phase 4 completed: May 3, 2026*
*Enables: Multi-horizon scenario tracking with automated outcomes and invalidation*

---

---

# Phase 4.5 — Activation & Backfill Readiness

**Status:** DONE — QA PASS
**Date:** May 3, 2026
**Priority:** P0 (Activates Phase 3/4 infrastructure)
**Scope:** 4 modified files, 1 new script

## OBJECTIVE

Turn Phase 3/4 passive infrastructure into safely activated production systems with controlled backfill.

## REQUIRED TASKS

### T-4.5A-01: Level Intelligence Cron Activation

**Status:** Done

**Implementation:**
- Replaced stub with real cron calling levelIntelligence.service.ts
- Processes MAJOR_COINS = ['BTC', 'ETH', 'SOL', 'ADA', 'LINK', 'DOT', 'AVAX', 'MATIC']
- Supports timeframes: 1h, 4h, 1d, 1w
- Configurable via LEVEL_INTELLIGENCE_MAX_COINS (default 8), LEVEL_INTELLIGENCE_TIMEFRAMES
- Per coin/timeframe try/catch isolation
- Rate-limited with 100ms delays between requests
- Logs: start, enabled/disabled, coin count, timeframes, success/failure summary

### T-4.5A-02: Scenario Creation Integration

**Status:** Done

**Implementation:**
- Added scenario creation to aiWorkflow.cron.ts after coinNewsHistory insert
- Controlled by SCENARIO_TRACKER_ENABLED (default false)
- Eligibility: eventSeverity >=3 (MAJOR), price available, sentiment in ['bullish','bearish']
- Creates speculation scenarios with dedupeKey prevention
- Maps: event->sourceType, sourceHash->sourceId, symbol->coinSymbol, sentiment->bias
- Failure wrapped in try/catch, does not break articles/radar/scorecard

### T-4.5A-03: Safe Backfill Script

**Status:** Done

**Files:** backend/scripts/backfill-phase45-scenarios.js

**Implementation:**
- Dry-run default mode, requires --execute for writes
- Scope: Last 14 days, MAJOR_COINS, major/high-severity events only
- Conservative mapping: sentiment->bias, title->thesis, eventType->eventType
- Logs: scanned, eligible, skipped, created, duplicates
- Respects dedupeKey, creates speculation scenarios

### T-4.5A-04: Verification Updates

**Status:** Done

**Implementation:**
- Extended verify-phase3-levels.js: checks levels/interactions updated in last 24h, activation status
- Extended verify-phase4-scenarios.js: checks scenarios created in last 24h, activation status
- Added invalid price/confidence checks

## OPERATIONAL CONTROLS

### Environment Variables

**LEVEL_INTELLIGENCE_ENABLED** (default: false)
- Controls level intelligence cron execution
- When false: cron logs and exits safely
- When true: processes levels and interactions

**LEVEL_INTELLIGENCE_MAX_COINS** (default: 8)
- Limits coins processed per run
- Prevents excessive API load
- Major coins: BTC, ETH, SOL, ADA, LINK, DOT, AVAX, MATIC

**LEVEL_INTELLIGENCE_TIMEFRAMES** (default: '1h,4h,1d,1w')
- Configurable timeframes as comma-separated string
- Supported: 1h, 4h, 1d, 1w

**SCENARIO_TRACKER_ENABLED** (default: false)
- Controls automatic scenario creation in aiWorkflow
- When false: scenario creation skipped safely
- When true: creates scenarios for eligible MAJOR events

### Safe Defaults

- All activation flags default to false
- Production starts safely disabled
- Operators must explicitly enable
- No broad backfill by default

### Rollback Plan

1. **Disable env flags:**
   - LEVEL_INTELLIGENCE_ENABLED=false
   - SCENARIO_TRACKER_ENABLED=false

2. **Stop crons:**
   - Comment out levelIntelligenceCron registration in server.ts
   - aiWorkflow continues running normally

3. **Leave tables unused:**
   - level_intelligence/interactions remain populated
   - market_scenarios remain populated
   - No data deletion needed

4. **Verify deactivation:**
   - Run verification scripts
   - Confirm no new updates in 24h

### Run Commands

**Enable Level Intelligence:**
```bash
# Set env vars
LEVEL_INTELLIGENCE_ENABLED=true
LEVEL_INTELLIGENCE_MAX_COINS=8
LEVEL_INTELLIGENCE_TIMEFRAMES=1h,4h,1d,1w

# Restart server to pick up env changes
# Cron runs automatically every 6 hours
```

**Enable Scenario Creation:**
```bash
# Set env var
SCENARIO_TRACKER_ENABLED=true

# Restart server
# Scenarios created automatically for new MAJOR events
```

**Run Verification:**
```bash
# Level intelligence health
node backend/scripts/verify-phase3-levels.js

# Scenario tracker health
node backend/scripts/verify-phase4-scenarios.js
```

**Safe Backfill:**
```bash
# Preview what would be created
node backend/scripts/backfill-phase45-scenarios.js

# Execute backfill (requires explicit flag)
node backend/scripts/backfill-phase45-scenarios.js --execute
```

### Known Limitations

- Level intelligence processes only major coins (no all-Binance scanning)
- Scenario creation limited to speculation type initially
- Backfill limited to last 14 days only
- No AI-generated outcomes (uses real price data only)
- No target/risk zone invention (conservative mapping)

### Monitoring

**Level Intelligence:**
- Check cron logs for "LevelIntelligenceCron" entries
- Verify levels updated in last 24h via verification script
- Monitor interaction creation rates

**Scenario Creation:**
- Check aiWorkflow logs for "Created scenario" entries
- Verify scenarios created in last 24h via verification script
- Monitor dedupeKey duplicates (should be 0)

**Performance:**
- Level cron should complete within minutes
- Scenario creation should not slow aiWorkflow
- No impact on existing Living Articles/Radar/Scorecard

---

*Phase 4.5 authored: May 3, 2026*
*Enables: Safe activation of intelligence infrastructure*

---

---

# Phase 5 — Smart Monitoring Cadence & Production Observation

**Status:** DONE — QA PASS
**Date:** May 3, 2026
**Priority:** P0 (Safe monitoring for intelligence systems)
**Scope:** 1 health script, 1 matrix deliverable, 1 runbook, 1 optional cron

## OBJECTIVE

Create production-safe monitoring layer for intelligence infrastructure activated in Phase 4.5. Focus on read-only health checks and cadence analysis - no public changes, no forced activation, no heavy services.

## REQUIRED TASKS

### T-5.1: Cron/Cadence Audit

**Status:** Done

**Implementation:**
- Audited all 17 registered crons in server.ts
- 15 crons have no env flag (cannot be disabled without code edit)
- 2 crons have env flags (LevelIntelligence, ScenarioOutcomeChecker - disabled by default)
- Core chain: TerminalEngine → TriageEngine → AiWorkflow (highest risk if any fails)
- All other crons are isolated
- External API dependencies: OpenRouter (AI), Binance (price/data), Telegram, RSS feeds, Alternative.me, DeFiLlama, Zhipu

### T-5.2: Production Health Check Script

**Status:** Done

**Files:** backend/scripts/verify-intelligence-health.js

**Implementation:**
- Read-only health verification for Phase 2/3/4/4.5
- Checks env flag status, duplicate dedupeKeys, due pending outcomes, failed outcomes, stale active scenarios, invalid confidence/price values
- Reports row counts for all intelligence tables
- Handles no-data state gracefully
- No INSERT/UPDATE/DELETE operations

### T-5.3: Smart Cadence Matrix

**Status:** Done

**Implementation:**
Matrix based on T-5.1 audit findings:

| System | Current Cadence | Proposed Cadence | Env Flag | External API Risk | DB Growth Risk | Recommendation |
|--------|-----------------|------------------|----------|-------------------|----------------|-----------------|
| AiWorkflow | Hourly (0 * * * *) | Keep hourly | None | High (OpenRouter/Binance) | High (articles/radar) | Keep hourly, monitor AI rate limits |
| LevelIntelligence | 6h (0 */6 * * *) | Keep 6h | LEVEL_INTELLIGENCE_ENABLED | Medium (Binance) | Medium | Keep 6h |
| ScenarioOutcomeChecker | Hourly (0 * * * *) | Keep hourly | SCENARIO_TRACKER_ENABLED | Medium (Binance) | Low | Keep hourly |
| SignalPerformance | 6h (0 */6 * * * ) | Keep 6h | None | Low (Binance) | Low | Keep 6h |
| EventOutcomeChecker | 30min (*/30 * * * *) | Keep 30min | None | Medium (Binance) | Low | Keep 30min, note: high-frequency monitoring |
| TpslMonitor | 15min (*/15 * * * *) | Keep 15min | None | Low (Binance) | Low | Keep 15min, note: high-frequency monitoring |
| HistoricalNews | Daily (0 4 * * *) | Keep daily | None | None | Low | Keep daily |
| TelegramMonitor | 30min news + 4h airdrops | Keep schedules | TELEGRAM_SESSION_STRING | Low (Telegram) | Medium (buffer) | Keep schedules |
| AirdropDiscovery | 6h (0 */6 * * *) | Keep 6h | None | Medium (Zhipu/DeFiLlama) | Medium | Keep 6h |
| AirdropRSSHunter | 6h (0 */6 * * *) | Keep 6h | None | Medium (OpenRouter) | Medium | Keep 6h |
| AirdropHunter | 12h (0 */12 * * *) | Keep 12h | None | Medium (OpenRouter) | Medium | Keep 12h |
| BufferCleanup | Daily (0 0 * * *) | Keep daily | None | None | Low | Keep daily |
| DailyAlpha | 8h (0 */8 * * *) | Keep 8h | None | None | Low | Keep 8h |
| TerminalEngine | 10min (*/10 * * * *) | Keep 10min | None | Low (RSS) | High (buffer) | Keep 10min, note: core gathering |
| TriageEngine | 2h (0 */2 * * *) | Keep 2h | None | Medium (OpenRouter) | Low | Keep 2h |
| ConvictionUpdate | 6h (0 */6 * * *) | Keep 6h | None | None | Low | Keep 6h |
| MarketMood | Daily (0 7 * * *) | Keep daily | None | Low (Alternative.me) | Low | Keep daily |

**Key Findings:**
- AiWorkflow is highest risk (core AI processing, no env flag)
- EventOutcomeChecker and TpslMonitor are high-frequency monitors (30min and 15min)
- TerminalEngine is core gathering engine (10min, feeds triage)
- 15 crons cannot be disabled via env flags (limitation for rollback)
- All cadences are conservative and match current production schedules

### T-5.4: Production Observation Runbook

**Status:** Done

**Implementation:**
Comprehensive runbook added to THE_NEXUS_HUB.md with:

**Day 0 Checks (Pre-Activation):**
- Run `node backend/scripts/verify-intelligence-health.js`
- Confirm LEVEL_INTELLIGENCE_ENABLED=false, SCENARIO_TRACKER_ENABLED=false
- Verify no intelligence activity in logs for 24h
- Check table row counts as baseline

**Canary Activation Steps (Gradual Enablement):**
1. Enable LEVEL_INTELLIGENCE_ENABLED=true first
2. Observe for 24h: check level updates in verify script, monitor cron logs
3. If stable, enable SCENARIO_TRACKER_ENABLED=true
4. Observe for 24h: check scenario creation in verify script

**Daily Checks for 3-7 Days Post-Activation:**
- Run verify-intelligence-health.js daily
- Check cron logs for AiWorkflow errors
- Monitor Binance API error rate (should be <1%)
- Check DB row growth (levels/scenarios should increase steadily)
- Verify duplicate dedupeKeys = 0
- Check due pending outcomes < 100
- Check failed outcomes = 0

**Rollback Procedures:**
- Set LEVEL_INTELLIGENCE_ENABLED=false, SCENARIO_TRACKER_ENABLED=false
- Restart server to pick up env changes
- For non-flagged crons: edit server.ts to comment out registrations
- Verify deactivation: run verify script, confirm no new updates in 24h

**Healthy/Warning Thresholds:**
- Scenarios created per day: healthy 1-20, warning >50 (too aggressive)
- Levels detected per coin: healthy 5-50, warning >100 (too noisy)
- Interactions per day: healthy 10-200, warning >500 (performance impact)
- Pending due outcomes: healthy 0-10, warning >50 (processing backlog)
- Failed outcomes: healthy 0, warning >0 (investigate immediately)
- Binance errors: healthy <1%, warning >5% (API issues)

**Safe Monitoring Commands:**
- Health check: `node backend/scripts/verify-intelligence-health.js`
- Cron logs: Check server logs for "Cron started/failed" entries
- DB growth: Compare row counts daily
- API health: Monitor Binance response times

### T-5.5: Optional Monitoring Cron

**Status:** Implemented

**Files:** backend/src/crons/monitoringCron.ts, backend/src/server.ts

**Implementation:**
- MONITORING_CRON_ENABLED=false by default
- Read-only operations only (SELECT queries)
- No external notifications
- No heavy queries (lightweight row counts only)
- Registered in server.ts with conditional check
- Lightweight health summary logging
- Schedule: every 6 hours (0 */6 * * *)

## OPERATIONAL CONTROLS

### Environment Variables

**MONITORING_CRON_ENABLED** (default: false)
- Controls monitoring cron execution
- When false: cron not registered
- When true: runs lightweight health logging

### Safe Defaults

- All monitoring disabled by default
- No forced activation
- Read-only operations only
- No external alerting

### Rollback Plan

1. **Disable monitoring:**
   - MONITORING_CRON_ENABLED=false
   - Restart server

2. **Remove cron:**
   - Comment out monitoringCron registration in server.ts
   - Delete monitoringCron.ts file

3. **No data cleanup needed**

### Run Commands

**Enable Monitoring:**
```bash
# Set env var
MONITORING_CRON_ENABLED=true

# Restart server
# Cron runs automatically every 6 hours
```

**Run Health Check:**
```bash
node backend/scripts/verify-intelligence-health.js
```

## MONITORING

**Health Check Script:**
- Run daily during activation period
- Check for data integrity issues
- Monitor system health metrics

**Cron Monitoring:**
- Check server logs for cron execution
- Monitor error rates and processing times
- Alert on failed cron runs

**Performance:**
- Health script completes in <10 seconds
- Monitoring cron adds negligible load
- No impact on existing AI workflows

---

*Phase 5 completed: May 3, 2026*
*Enables: Safe production monitoring for intelligence systems*

---

---

# Phase 5 — Level Intelligence Engine

**Status:** DEFERRED — No implementation until gating conditions pass  
**Date:** May 2, 2026  

## GATING CONDITIONS

**Must pass ALL before implementation:**

1. **Phase 1 Complete:** coin_news_history has outcome data for >1000 events  
2. **Phase 4 Complete:** price_snapshots has OHLCV data for >30 days  
3. **SQL Query:** `SELECT COUNT(*) FROM coin_news_history WHERE outcome7d IS NOT NULL` > 1000  
4. **SQL Query:** `SELECT COUNT(*) FROM price_snapshots WHERE interval = '1h'` > 10000  

## PREREQUISITES

- Historical price data available  
- Sufficient event-outcome correlations  
- Level detection algorithms defined  

## FUTURE DETERMINISTIC ALGORITHMS

### Pivot Detection
- Identify swing highs/lows using zigzag algorithm  
- Filter by volume and price movement significance  

### Swing High/Low Clustering
- Group nearby swing points  
- Calculate support/resistance strength  

### Level Clustering
- Merge overlapping levels  
- Weight by touch frequency and volume  

### Touch/Bounce/Break/Fakeout Detection
- Track price interaction with levels  
- Classify reaction types  

### Support/Resistance Flip Detection
- Monitor level breaches  
- Update level classifications  

## IMPLEMENTATION STATUS

**No implementation tasks created yet.**  
**Phase remains in planning until gates pass.**  
**Estimated gate pass date: 2-3 weeks after Phase 1 deployment.**

---

---

# Phase 5b — Smart Monitoring Cadence

**Status:** PLANNED  
**Date:** May 2, 2026  

## CADENCE PLAN

### Every 5 Minutes
**Jobs:** Real-time price monitoring, urgent alerts  
**Why:** Critical price movements, flash crashes  
**Cost/Freshness Tradeoff:** High cost, maximum freshness  
**Redis Lock:** Required (prevent overlap)  
**API Load:** High (multiple exchanges)  

### Every 15 Minutes
**Jobs:** News triage, sentiment analysis  
**Why:** News velocity requires frequent checking  
**Cost/Freshness Tradeoff:** Medium cost, good freshness  
**Redis Lock:** Required  
**API Load:** Medium  

### Every 30 Minutes
**Jobs:** Event outcome checking, signal updates  
**Why:** Balance between timeliness and resource usage  
**Cost/Freshness Tradeoff:** Low cost, acceptable freshness  
**Redis Lock:** Required  
**API Load:** Low  

### Hourly
**Jobs:** Price snapshots, technical analysis updates  
**Why:** Hourly candles are standard timeframe  
**Cost/Freshness Tradeoff:** Low cost, sufficient freshness  
**Redis Lock:** Required  
**API Load:** Low  

### Daily
**Jobs:** Deep analytics, strategic updates  
**Why:** Daily summaries, trend analysis  
**Cost/Freshness Tradeoff:** Very low cost, periodic freshness  
**Redis Lock:** Not critical (can run sequentially)  
**API Load:** Very low  

### Weekly
**Jobs:** Maintenance, cleanup, long-term analytics  
**Why:** Weekly cycles for cleanup and reporting  
**Cost/Freshness Tradeoff:** Minimal cost, maintenance-focused  
**Redis Lock:** Not required  
**API Load:** Minimal  

---

---

# Phase 6 — AI Cost Reduction

**Status:** PLANNED  
**Date:** May 2, 2026  

## DETERMINISTIC PARTS NEEDING NO AI

- Price movement calculations (arithmetic only)  
- Volume analysis (statistical formulas)  
- Time-based expiry (date math)  
- Simple classification rules (if-then logic)  

## DEEPSEEK DIRECT USAGE

- Primary analysis (already using deepseek-reasoner)  
- Cost-effective reasoning for complex decisions  

## Z.AI / GLM WEB_SEARCH USAGE

- Fallback for web search when Tavily fails  
- Cost comparison vs other providers  

## OPENROUTER USAGE REMAINING NECESSARY

- Specialty models (code, math, specific domains)  
- When DeepSeek doesn't fit requirements  

## CACHING OPPORTUNITIES

- Temporal pattern results (cache per event type + coin)  
- Level calculation results (cache per timeframe)  
- Workflow context (cache conversation state)  

## BATCHING OPPORTUNITIES

- Multiple similar analyses in single request  
- Bulk outcome classifications  

## AVOIDING HUGE JSON RE-SENDS

- Reference IDs instead of full objects  
- Delta updates for changing data  

---

---

# Phase 7 — Public Language / Google-Safe Presentation

**Status:** PLANNED  
**Date:** May 2, 2026  

## PHASE 0.5 COMPLETED WORK

- Scorecard terminology sanitized  
- Disclaimer language strengthened  
- Internal verdict values remain raw  

## REMAINING AUDIT TASKS

### Radar Terminology
- Replace "signals" with "insights" in public UI  
- Change "BUY/SELL" to "Bullish/Bearish Outlook"  

### Article Prompt Terminology
- Update AI prompts to use policy-safe language  
- Avoid financial advice framing  

### Meta Title/Description Rules
- Remove price predictions from SEO text  
- Focus on analysis and information  

### Internal vs Public Wording Mapping
| Internal | Public |
|----------|--------|
| BUY | Bullish |
| SELL | Bearish |
| Signal | Insight |
| Prediction | Analysis |

## RULE

**Backend/internal verdict values can remain raw.**  
**Public UI must be mapped to policy-safe labels.**

---

---

# Phase 8 — Migration Strategy

**Status:** PLANNED  
**Date:** May 2, 2026  

## PER-PHASE MIGRATION

### Phase 1
- **Parallel:** Yes (adds columns, doesn't change logic)  
- **Replace Old:** No (extends existing tables)  
- **Rollback:** Drop columns + index  
- **Backfill:** None (new data only)  
- **Testing:** 1 week smoke test  
- **Risks:** Large migration, monitor DB performance  
- **Safety:** Nullable columns, no breaking changes  

### Phase 2
- **Parallel:** Yes (expands interfaces, backward compatible)  
- **Replace Old:** Partial (enhanced temporal logic)  
- **Rollback:** Revert interface changes  
- **Backfill:** None  
- **Testing:** Unit tests for new calculations  
- **Risks:** AI prompt changes may affect analysis quality  
- **Safety:** Gradual rollout with monitoring  

### Phase 3
- **Parallel:** Yes (adds horizon routing)  
- **Replace Old:** No (extends signal system)  
- **Rollback:** Remove horizon logic  
- **Backfill:** Classify existing signals  
- **Testing:** Signal routing verification  
- **Risks:** UI changes require frontend deploy  
- **Safety:** Backward compatible schema changes  

### Phase 4
- **Parallel:** Yes (new snapshots don't affect existing)  
- **Replace Old:** No (price_snapshots is new feature)  
- **Rollback:** Drop OHLCV columns  
- **Backfill:** None  
- **Testing:** Cron execution monitoring  
- **Risks:** Binance rate limits  
- **Safety:** Independent feature  

### Phase 5
- **Parallel:** Yes (deterministic algorithms)  
- **Replace Old:** No (new analysis layer)  
- **Rollback:** Remove level detection  
- **Backfill:** None  
- **Testing:** Algorithm accuracy validation  
- **Risks:** False signals from level detection  
- **Safety:** Gating conditions prevent premature deployment  

---

---

# Top 10 Recommended Improvements

| Rank | Improvement | Phase | Impact | Difficulty | Risk | Expected Value | Why | Owner |
|------|-------------|-------|--------|------------|------|----------------|-----|-------|
| 1 | Multi-horizon temporal patterns | 2 | 9 | 6 | 3 | High | Enables data-rich analysis context | Prompt Engineer |
| 2 | Level intelligence engine | 5 | 10 | 8 | 5 | Very High | Automated support/resistance detection | Senior Developer |
| 3 | Investment vs speculation separation | 3 | 8 | 5 | 4 | High | Clear strategy differentiation | Senior Developer |
| 4 | OHLCV price snapshots | 4 | 7 | 4 | 2 | Medium | Technical analysis foundation | Senior Developer |
| 5 | AI cost optimization | 6 | 6 | 7 | 3 | Medium | Reduces operational costs | Prompt Engineer |
| 6 | Smart monitoring cadence | 5b | 5 | 3 | 1 | Low | Optimizes resource usage | Senior Developer |
| 7 | Event-price outcome foundation | 1 | 9 | 6 | 4 | High | Core data for all temporal intelligence | Senior Developer |
| 8 | Public language audit | 7 | 4 | 2 | 1 | Low | AdSense compliance | Prompt Engineer |
| 9 | Migration strategy documentation | 8 | 3 | 1 | 1 | Very Low | Operational safety | Senior Developer |
| 10 | Deferred phase gating | 5 | 2 | 1 | 1 | Very Low | Prevents premature implementation | Lead Architect |

---

---

# Top 10 Questions / Unknowns

| Rank | Question | Why Matters | Options | Recommendation | Cost/Risk | Product Owner Input |
|------|----------|-------------|---------|----------------|-----------|-------------------|
| 1 | Should Phase 5 algorithms be AI-assisted or purely deterministic? | Affects accuracy vs cost | Pure deterministic, Hybrid AI+deter, Full AI | Pure deterministic first | Low cost/low risk | Yes |
| 2 | Which coins for Phase 4 snapshots? | Coverage vs API limits | Top 50 market cap, Top 100, Custom watchlist | Top 50 market cap | Medium cost | Yes |
| 3 | How to handle conflicting signals in Phase 3? | User experience impact | Suppress conflicts, Show all with warnings, Merge into single | Show all with warnings | Low risk | Yes |
| 4 | Phase 2 fallback matching quality impact? | Analysis accuracy | Test on sample data, Monitor A/B, Rollback if quality drops | Test extensively first | Medium risk | No |
| 5 | Should Phase 1 outcomes be user-visible? | Transparency vs complexity | Hide internally, Show as analysis context, Full public disclosure | Show as analysis context | Low risk | Yes |
| 6 | Migration rollback procedures sufficient? | Operational safety | Add more rollback tests, Trust current plan, Add automated rollback | Trust current plan | Low risk | No |
| 7 | Phase 6 caching strategy effectiveness? | Cost reduction potential | Measure cache hit rates, Adjust TTLs, Abandon if <50% hit | Measure first | Low cost | No |
| 8 | Public language mapping completeness? | AdSense approval risk | Audit all UI text, Sample check, Full compliance review | Full compliance review | High cost | Yes |
| 9 | Phase 5b cadence optimization impact? | Resource savings | Monitor current usage, Implement gradually, Full optimization | Implement gradually | Low risk | No |
| 10 | Should Phase 3 investment theses have TP/SL? | Strategy completeness | No (ongoing), Yes (with wide targets), Optional | Optional | Medium complexity | Yes |