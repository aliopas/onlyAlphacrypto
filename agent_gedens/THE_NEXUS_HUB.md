# Phase 6B — Event Impact Persistence

**Status:** PLANNED — Ready for execution after Phase 6A QA PASS  
**Date:** May 4, 2026  
**Priority:** P1 (Persists Phase 6A analysis into dedicated parallel tables)  
**Scope:** 2 migrations, 2 Drizzle models, 1 persistence service, 1 backfill script, 2 env flags, 1 documentation update, 1 QA checklist  
**Reviewed by:** Strategic Planner — APPROVED FOR PLANNING  

## OBJECTIVE

Create a persistence layer for the Event Impact Engine. Store calculated event impact data in two dedicated parallel tables (`event_impacts` and `event_impact_outcomes`) that normalize and extend the data already computed by the existing `eventImpactAnalysis.service.ts`. Phase 6B does NOT modify any existing tables or public-facing features.

## PHASE 6B SCOPE LIMITATIONS

**Phase 6B is strictly additive persistence only:**

- ✅ Create new `event_impacts` table (parallel to coin_news_history)
- ✅ Create new `event_impact_outcomes` table (per-horizon outcomes)
- ✅ Create persistence service that reads from coin_news_history and writes to new tables
- ✅ Create backfill script with dry-run mode
- ✅ Add feature flags (default false)
- ✅ Write to new tables only

**Phase 6B explicitly does NOT include:**

- ❌ Modify coin_news_history schema
- ❌ Modify any existing table schema
- ❌ Modify Living Articles
- ❌ Modify scorecard
- ❌ Modify public UI / frontend
- ❌ Add external APIs
- ❌ Modify AI workflow prompts
- ❌ Add prediction/forecasting
- ❌ Enable flags in production
- ❌ Commit or push before QA PASS

## ARCHITECTURE OVERVIEW

```
coin_news_history (existing, read-only)
         │
         ▼
eventImpactPersistence.service.ts (new)
  ├── reads coin_news_history rows
  ├── normalizes into event_impacts row
  ├── generates 5 event_impact_outcomes rows per event
  │     (1h, 4h, 24h, 3d, 7d)
  └── writes ONLY to new tables
         │
         ▼
  ┌─────────────────┐    ┌──────────────────────────┐
  │  event_impacts   │───<│  event_impact_outcomes    │
  │  (1 row/event)   │    │  (5 rows/event)           │
  └─────────────────┘    └──────────────────────────┘
```

## DATA MAPPING

### coin_news_history → event_impacts

| Source Field | Target Field | Transform |
|---|---|---|
| id | source_id | Direct copy (nullable in target) |
| — | source_table | Hardcoded 'coin_news_history' |
| coinSymbol | coinSymbol | Direct copy |
| eventType | eventType | Direct copy |
| eventSeverity | eventSeverity | Direct copy (integer) |
| eventScope | eventScope | Direct copy |
| publishedAt | publishedAt | Direct copy |
| priceAtTime | priceAtEvent | Direct copy |
| — | priceSource | Default 'binance' |
| — | status | 'completed' if all 5 horizons have data, else 'pending' |

### coin_news_history → event_impact_outcomes (5 rows per event)

| Horizon | horizon_hours | change_source | price_source |
|---|---|---|---|
| '1h' | 1 | change1h | price1hAfter |
| '4h' | 4 | change4h | price4hAfter |
| '24h' | 24 | change24h | price24hAfter |
| '3d' | 72 | change3d | price3dAfter |
| '7d' | 168 | change7d | price7dAfter |

Per-outcome row fields:
- change_percent ← changeXh from coin_news_history
- price_at_horizon ← priceXhAfter from coin_news_history
- max_upside_percent ← maxUpsideAfterEvent (same value for all 5 horizons)
- max_drawdown_percent ← maxDrawdownAfterEvent (same value for all 5 horizons)
- time_to_peak_hours ← timeToPeakHours (same value for all 5 horizons)
- time_to_bottom_hours ← timeToBottomHours (same value for all 5 horizons)
- outcome_classification ← outcomeClassification (same value for all 5 horizons)
- due_at ← publishedAt + horizon_hours hours
- checked_at ← now() if data exists, null otherwise
- status ← 'completed' if change_percent is not null, else 'pending'

## REQUIRED TASKS

### T-6B.1 — Create event_impacts Migration

**Task ID:** T-6B.1  
**Phase:** Phase 6B — Create event_impacts migration  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create SQL migration for `event_impacts` table with all required columns, constraints, and indexes. This table is parallel to coin_news_history and does not modify it.

**Files to inspect:**
- `backend/src/models/market.model.ts` — existing table patterns and Drizzle conventions
- `backend/scripts/migrate-market-scenarios.sql` — reference migration pattern

**Files allowed to modify:**
- `backend/scripts/migrate-event-impacts.sql` (new file)

**Forbidden files:**
- `backend/src/models/market.model.ts` (T-6B.3 handles Drizzle model)
- Any existing migration files
- Any existing table schemas
- Any service/cron/controller files

**Constraints:**
- Additive only — no existing tables modified
- source_id is nullable (NOT NOT NULL) — preserves impact data if source deleted
- NO ON DELETE CASCADE — use ON DELETE SET NULL for source_id FK
- UNIQUE constraint on source_id (one impact record per source event)
- All timestamps use `DEFAULT NOW()`
- status defaults to 'pending'

**Step-by-step instructions:**

1. Create new file `backend/scripts/migrate-event-impacts.sql`
2. Add header comment with phase, date, description
3. Create `event_impacts` table:
```sql
CREATE TABLE IF NOT EXISTS event_impacts (
  id SERIAL PRIMARY KEY,
  source_table VARCHAR(50) NOT NULL DEFAULT 'coin_news_history',
  source_id INTEGER REFERENCES coin_news_history(id) ON DELETE SET NULL,
  coin_symbol VARCHAR(20) NOT NULL,
  event_type VARCHAR(50),
  event_severity INTEGER,
  event_scope VARCHAR(20),
  published_at TIMESTAMP NOT NULL,
  price_at_event REAL,
  price_source VARCHAR(20) NOT NULL DEFAULT 'binance',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```
4. Add UNIQUE constraint on source_id:
```sql
CREATE UNIQUE INDEX idx_event_impacts_source_id ON event_impacts (source_id) WHERE source_id IS NOT NULL;
```
5. Add required indexes:
```sql
CREATE INDEX idx_event_impacts_coin_symbol ON event_impacts (coin_symbol);
CREATE INDEX idx_event_impacts_event_type ON event_impacts (event_type);
CREATE INDEX idx_event_impacts_status ON event_impacts (status);
CREATE INDEX idx_event_impacts_published_at ON event_impacts (published_at);
```
6. Add rollback section at bottom (commented):
```sql
-- ROLLBACK:
-- DROP TABLE IF EXISTS event_impacts;
```

**Acceptance criteria:**
- Migration creates `event_impacts` table with all 13 columns
- UNIQUE partial index on source_id (WHERE source_id IS NOT NULL)
- 4 performance indexes (coin_symbol, event_type, status, published_at)
- source_id references coin_news_history(id) ON DELETE SET NULL
- No ON DELETE CASCADE anywhere
- status defaults to 'pending'
- created_at and updated_at default to NOW()
- Migration is idempotent (CREATE TABLE IF NOT EXISTS)
- Rollback is clean (single DROP TABLE)

**QA checklist:**
- [ ] SQL syntax valid for PostgreSQL
- [ ] All 13 columns present with correct types
- [ ] UNIQUE index on source_id (partial, NULL-aware)
- [ ] 4 performance indexes created
- [ ] FK uses ON DELETE SET NULL (not CASCADE)
- [ ] Defaults correct (source_table, price_source, status, timestamps)
- [ ] Idempotent (IF NOT EXISTS)
- [ ] Rollback section documented
- [ ] No existing tables referenced except FK

**Rollback notes:**
- `DROP TABLE IF EXISTS event_impacts;`
- No data in existing tables affected
- CASCADE on DROP handles index cleanup

**Dependencies:**
- None (table is standalone with optional FK)

---

### T-6B.2 — Create event_impact_outcomes Migration

**Task ID:** T-6B.2  
**Phase:** Phase 6B — Create event_impact_outcomes migration  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create SQL migration for `event_impact_outcomes` table that stores per-horizon outcome data for each event impact record. Each event_impacts row will have up to 5 outcome rows (1h, 4h, 24h, 3d, 7d).

**Files to inspect:**
- `backend/scripts/migrate-event-impacts.sql` (from T-6B.1 — must exist first)
- `backend/scripts/migrate-market-scenarios.sql` — reference for scenario_horizon_outcomes pattern

**Files allowed to modify:**
- `backend/scripts/migrate-event-impacts.sql` (append to T-6B.1 migration)

**Forbidden files:**
- `backend/src/models/market.model.ts` (T-6B.3 handles Drizzle model)
- Any service/cron/controller files
- Any existing table schemas

**Constraints:**
- Additive only — no existing tables modified
- UNIQUE on (event_impact_id, horizon) — one outcome per horizon per event
- FK on event_impact_id references event_impacts(id) ON DELETE CASCADE (if event deleted, outcomes go too — this is the SAME table pair, not cross-table)
- All nullable outcome fields for partial data
- status defaults to 'pending'
- error_message for logging failures

**Step-by-step instructions:**

1. Append to `backend/scripts/migrate-event-impacts.sql`
2. Create `event_impact_outcomes` table:
```sql
CREATE TABLE IF NOT EXISTS event_impact_outcomes (
  id SERIAL PRIMARY KEY,
  event_impact_id INTEGER NOT NULL REFERENCES event_impacts(id) ON DELETE CASCADE,
  horizon VARCHAR(10) NOT NULL,
  horizon_hours INTEGER NOT NULL,
  due_at TIMESTAMP NOT NULL,
  checked_at TIMESTAMP,
  price_at_horizon REAL,
  change_percent REAL,
  max_upside_percent REAL,
  max_drawdown_percent REAL,
  time_to_peak_hours INTEGER,
  time_to_bottom_hours INTEGER,
  outcome_classification VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```
3. Add UNIQUE constraint:
```sql
CREATE UNIQUE INDEX idx_event_impact_outcomes_unique ON event_impact_outcomes (event_impact_id, horizon);
```
4. Add required indexes:
```sql
CREATE INDEX idx_event_impact_outcomes_status ON event_impact_outcomes (status);
CREATE INDEX idx_event_impact_outcomes_due_at ON event_impact_outcomes (due_at);
CREATE INDEX idx_event_impact_outcomes_event_impact_id ON event_impact_outcomes (event_impact_id);
```
5. Update rollback section:
```sql
-- ROLLBACK:
-- DROP TABLE IF EXISTS event_impact_outcomes;
-- DROP TABLE IF EXISTS event_impacts;
```

**Acceptance criteria:**
- Migration creates `event_impact_outcomes` table with all 16 columns
- UNIQUE index on (event_impact_id, horizon)
- 3 performance indexes (status, due_at, event_impact_id)
- FK uses ON DELETE CASCADE (within same table pair — acceptable)
- All outcome fields nullable (partial data OK)
- status defaults to 'pending'
- Horizon values: '1h', '4h', '24h', '3d', '7d'
- Rollback drops outcomes first, then impacts (FK order)

**QA checklist:**
- [ ] SQL syntax valid for PostgreSQL
- [ ] All 16 columns present with correct types
- [ ] UNIQUE index on (event_impact_id, horizon)
- [ ] 3 performance indexes created
- [ ] FK to event_impacts(id) with CASCADE (same-pair only)
- [ ] All outcome fields nullable
- [ ] Defaults correct (status, timestamps)
- [ ] Rollback order correct (outcomes first, then impacts)
- [ ] Horizon varchar(10) sufficient for '1h','4h','24h','3d','7d'

**Rollback notes:**
- `DROP TABLE IF EXISTS event_impact_outcomes;`
- `DROP TABLE IF EXISTS event_impacts;`
- No data in existing tables affected

**Dependencies:**
- T-6B.1 (event_impacts table must be created first in same migration)

---

### T-6B.3 — Create Event Impact Persistence Service

**Task ID:** T-6B.3  
**Phase:** Phase 6B — Create eventImpactPersistence.service.ts  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create `backend/src/services/eventImpactPersistence.service.ts` that reads processed event data from `coin_news_history` and persists normalized records into the new `event_impacts` and `event_impact_outcomes` tables. This service is the core persistence bridge.

**Files to inspect:**
- `backend/src/services/eventImpactAnalysis.service.ts` — existing read-only analysis service (pattern reference)
- `backend/src/services/scenarioTracker.service.ts` — reference for write service patterns
- `backend/src/models/market.model.ts` — Drizzle table definitions (after T-6B Drizzle update)
- `backend/src/config/env.ts` — env flag pattern

**Files allowed to modify:**
- `backend/src/services/eventImpactPersistence.service.ts` (new file)

**Forbidden files:**
- `backend/src/services/eventImpactAnalysis.service.ts` (read-only, must not change)
- `backend/src/models/market.model.ts` (separate task)
- `backend/src/config/env.ts` (separate task)
- Any cron, controller, or route files
- Any frontend files

**Constraints:**
- Zero `any` types — use explicit TypeScript interfaces
- Read from coin_news_history (SELECT only)
- Write ONLY to event_impacts and event_impact_outcomes
- Idempotent — skip if source_id already exists in event_impacts
- Must check EVENT_IMPACT_PERSISTENCE_ENABLED flag before any write
- All writes wrapped in try/catch with proper error logging
- No external API calls
- No AI calls
- Service must be stateless

**Step-by-step instructions:**

1. Create new file `backend/src/services/eventImpactPersistence.service.ts`
2. Import Drizzle db, coinNewsHistory, eventImpacts, eventImpactOutcomes from models
3. Import env config for EVENT_IMPACT_PERSISTENCE_ENABLED
4. Define TypeScript interfaces:

```typescript
interface EventImpactRow {
  sourceTable: string;
  sourceId: number | null;
  coinSymbol: string;
  eventType: string | null;
  eventSeverity: number | null;
  eventScope: string | null;
  publishedAt: Date;
  priceAtEvent: number | null;
  priceSource: string;
  status: string;
}

interface EventImpactOutcomeRow {
  eventImpactId: number;
  horizon: string;
  horizonHours: number;
  dueAt: Date;
  checkedAt: Date | null;
  priceAtHorizon: number | null;
  changePercent: number | null;
  maxUpsidePercent: number | null;
  maxDrawdownPercent: number | null;
  timeToPeakHours: number | null;
  timeToBottomHours: number | null;
  outcomeClassification: string | null;
  status: string;
  errorMessage: string | null;
}
```

5. Implement `persistEventImpact(sourceRecord)` function:
   - Check EVENT_IMPACT_PERSISTENCE_ENABLED, return null if false
   - Check idempotency: query event_impacts WHERE source_id = sourceRecord.id, skip if exists
   - Determine status: 'completed' if all 5 change fields non-null, else 'pending'
   - INSERT into event_impacts with mapped fields
   - Return the new event_impact.id

6. Implement `persistEventImpactOutcomes(eventImpactId, sourceRecord)` function:
   - Define HORIZONS constant: `[{horizon:'1h',hours:1,change:'change1h',price:'price1hAfter'}, ...]`
   - For each horizon, calculate due_at = publishedAt + hours
   - Determine per-horizon status: 'completed' if change_percent non-null, else 'pending'
   - Set checked_at = new Date() if data exists, null otherwise
   - Map maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification (same values from source, applied to all 5 horizons)
   - INSERT all 5 rows into event_impact_outcomes using db.insert().values([...])
   - Return count of inserted outcomes

7. Implement `persistBatchFromCoinNewsHistory(limit, offset)` function:
   - Query coin_news_history with limit/offset (for batching)
   - Only select rows where eventSeverity IS NOT NULL (have been classified)
   - For each row, call persistEventImpact then persistEventImpactOutcomes
   - Track success/skip/error counts
   - Return batch summary: { processed, created, skipped, errors }

8. Implement `getEventImpactBySourceId(sourceId)` function:
   - Query event_impacts WHERE source_id = sourceId
   - Return the impact record or null

9. Implement `getOutcomesForEventImpact(eventImpactId)` function:
   - Query event_impact_outcomes WHERE event_impact_id = eventImpactId
   - Return array of outcome records

10. Export all functions

**Acceptance criteria:**
- Service compiles with zero `any` types
- All functions check EVENT_IMPACT_PERSISTENCE_ENABLED
- persistEventImpact is idempotent (skips existing source_ids)
- persistEventImpactOutcomes creates exactly 5 rows per event
- Batch function processes in configurable chunks
- Error handling: individual record failures don't stop batch
- TypeScript strict mode clean

**QA checklist:**
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] Zero `any` types (grep verification)
- [ ] EVENT_IMPACT_PERSISTENCE_ENABLED check in all write functions
- [ ] Idempotency verified (run twice, no duplicates)
- [ ] 5 outcome rows created per event impact
- [ ] Null handling for all optional fields
- [ ] Error logging on individual record failures
- [ ] No external API calls
- [ ] No modifications to coin_news_history
- [ ] Interfaces match migration column types

**Rollback notes:**
- Delete `backend/src/services/eventImpactPersistence.service.ts`
- No data cleanup needed (tables managed separately)

**Dependencies:**
- T-6B.1 + T-6B.2 (migrations must exist for Drizzle model)
- Drizzle model updates for event_impacts and event_impact_outcomes

---

### T-6B.4 — Create Backfill Script with Dry-Run

**Task ID:** T-6B.4  
**Phase:** Phase 6B — Create backfill script with dry-run mode  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create `backend/scripts/backfill-event-impacts.js` that processes existing `coin_news_history` records and populates the new `event_impacts` and `event_impact_outcomes` tables. Must have dry-run mode by default and be feature-flagged.

**Files to inspect:**
- `backend/scripts/backfill-phase45-scenarios.js` — reference backfill pattern (dry-run/execute, batching, logging)
- `backend/src/services/eventImpactPersistence.service.ts` (after T-6B.3)

**Files allowed to modify:**
- `backend/scripts/backfill-event-impacts.js` (new file)

**Forbidden files:**
- Any service, model, cron, controller, route files
- Any frontend files

**Constraints:**
- Dry-run mode is DEFAULT (safe to run without arguments)
- Requires `--execute` flag to actually write data
- Must check EVENT_IMPACT_BACKFILL_ENABLED env flag (default false)
- Must check EVENT_IMPACT_BACKFILL_DRY_RUN env flag (default true)
- Process in batches of 100 records
- Idempotent — skip already-processed records (check source_id in event_impacts)
- Handle individual record failures gracefully (continue batch)
- Log progress every 100 records
- Log summary at end: scanned, eligible, created, skipped, errors

**Step-by-step instructions:**

1. Create new file `backend/scripts/backfill-event-impacts.js`
2. Follow pattern from `backfill-phase45-scenarios.js`:
   - Require compiled dist files
   - Parse CLI args: `--dry-run` (default) or `--execute`
3. Check env flags:
   - If EVENT_IMPACT_BACKFILL_ENABLED is false: print message and exit
   - In `--execute` mode: if EVENT_IMPACT_BACKFILL_DRY_RUN is true, warn but allow override with `--force`
4. Query coin_news_history:
   - Select rows where eventSeverity IS NOT NULL (classified events)
   - Order by publishedAt ASC (oldest first for chronological consistency)
   - Process in batches of 100 using LIMIT/OFFSET
5. For each batch:
   - For each record, check if source_id already in event_impacts (idempotency)
   - If dry-run: log what would be created
   - If execute: call persistEventImpact + persistEventImpactOutcomes
   - Track counts: scanned, eligible, created, skipped (already exists), errors
6. Log progress after each batch
7. Print final summary

**Expected CLI behavior:**
```
# Safe dry-run (default)
node backfill-event-impacts.js
> [Backfill] DRY RUN mode (default)
> [Backfill] EVENT_IMPACT_BACKFILL_ENABLED=false — exiting safely

# With env flag enabled, still dry-run
EVENT_IMPACT_BACKFILL_ENABLED=true node backfill-event-impacts.js
> [Backfill] DRY RUN mode
> [Backfill] Scanned: 500, Eligible: 320, Would Create: 320, Skipped: 180

# Actual execution
EVENT_IMPACT_BACKFILL_ENABLED=true node backfill-event-impacts.js --execute
> [Backfill] EXECUTE mode
> [Backfill] Batch 1/5: 100 records processed...
> [Backfill] Summary: Scanned=500, Created=320, Skipped=180, Errors=0
```

**Acceptance criteria:**
- Script runs with `node scripts/backfill-event-impacts.js` (after `npm run build`)
- Dry-run is default — no writes without explicit `--execute`
- Checks EVENT_IMPACT_BACKFILL_ENABLED flag
- Idempotent — running twice produces same results
- Batches of 100 records
- Individual failures logged but don't stop batch
- Progress logging every batch
- Final summary with counts

**QA checklist:**
- [ ] Dry-run mode: no INSERT/UPDATE/DELETE operations
- [ ] Execute mode: writes to event_impacts and event_impact_outcomes only
- [ ] EVENT_IMPACT_BACKFILL_ENABLED=false: exits safely
- [ ] Idempotent: second run skips all existing records
- [ ] Batch size 100 respected
- [ ] Error handling: single failure doesn't stop batch
- [ ] Progress logging visible
- [ ] Final summary accurate
- [ ] No modifications to coin_news_history
- [ ] No modifications to any existing tables

**Rollback notes:**
- Delete `backend/scripts/backfill-event-impacts.js`
- Data in new tables can be preserved or dropped separately

**Dependencies:**
- T-6B.1 + T-6B.2 (migrations run)
- T-6B.3 (persistence service exists)
- T-6B.5 (feature flags in env.ts)

---

### T-6B.5 — Add Feature Flags

**Task ID:** T-6B.5  
**Phase:** Phase 6B — Add feature flags to env.ts  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Add two new feature flags to `backend/src/config/env.ts` for controlling event impact persistence and backfill operations. Both default to false for safe production deployment.

**Files to inspect:**
- `backend/src/config/env.ts` — existing env configuration with Zod schema

**Files allowed to modify:**
- `backend/src/config/env.ts`

**Forbidden files:**
- All other files

**Constraints:**
- Both flags default to false
- Missing env vars must NOT crash server
- Use existing Zod boolean pattern
- Flags must be accessible by services and scripts

**Step-by-step instructions:**

1. Locate the env schema in `backend/src/config/env.ts`
2. Add `EVENT_IMPACT_PERSISTENCE_ENABLED`:
   ```typescript
   EVENT_IMPACT_PERSISTENCE_ENABLED: z.boolean().default(false),
   ```
3. Add `EVENT_IMPACT_BACKFILL_ENABLED`:
   ```typescript
   EVENT_IMPACT_BACKFILL_ENABLED: z.boolean().default(false),
   ```
4. Add `EVENT_IMPACT_BACKFILL_DRY_RUN`:
   ```typescript
   EVENT_IMPACT_BACKFILL_DRY_RUN: z.boolean().default(true),
   ```
5. Place flags near existing `EVENT_IMPACT_ENGINE_ENABLED` flag (grouping by feature)
6. Verify no startup crashes with missing env vars

**Acceptance criteria:**
- 3 new flags added: EVENT_IMPACT_PERSISTENCE_ENABLED, EVENT_IMPACT_BACKFILL_ENABLED, EVENT_IMPACT_BACKFILL_DRY_RUN
- All default to safe values (false, false, true)
- Server starts normally with no env vars set
- `cd backend && npx tsc --noEmit` passes
- Flags accessible via env config export

**QA checklist:**
- [ ] Server starts without any new env vars
- [ ] EVENT_IMPACT_PERSISTENCE_ENABLED defaults to false
- [ ] EVENT_IMPACT_BACKFILL_ENABLED defaults to false
- [ ] EVENT_IMPACT_BACKFILL_DRY_RUN defaults to true
- [ ] Flags grouped near existing EVENT_IMPACT_ENGINE_ENABLED
- [ ] `tsc --noEmit` clean
- [ ] No changes to existing flags

**Rollback notes:**
- Remove the 3 new flag definitions
- Server starts normally without them

**Dependencies:**
- None (can be done in parallel with T-6B.1/T-6B.2)

---

### T-6B.6 — Documentation Update

**Task ID:** T-6B.6  
**Phase:** Phase 6B — Documentation update  
**Assigned Agent:** Prompt Engineer  
**Status:** COMPLETED — QA & Security PASS  

**Objective:**  
Update THE_NEXUS_HUB.md with Phase 6B scope, schema diagrams, operational controls, rollback procedures, and what Phase 6B does NOT change.

**Files modified:**
- THE_NEXUS_HUB.md

**Implementation requirements:**
- Document Phase 6B as persistence layer for Phase 6A with clear scope and limitations
- Include schema diagrams for event_impacts and event_impact_outcomes tables with column descriptions
- Document data mapping from coin_news_history to both new tables
- Document operational controls section with all 3 env flags and their defaults
- Document backfill dry-run vs execute behavior
- Include comprehensive rollback procedure
- Document what Phase 6B explicitly does NOT change (no existing table modifications, no UI changes, no Living Articles changes, no scorecard changes, no AI workflow changes)
- Reference Phase 6A as prerequisite

**Acceptance criteria:**
- Phase 6B scope and limitations clearly documented
- Both table schemas documented with all columns
- Operational controls documented with defaults (false, false, true)
- Backfill dry-run vs execute behavior clearly explained
- Rollback procedures documented (disable flags, data preserved, DROP TABLE only if necessary)
- What Phase 6B does NOT change explicitly listed
- Phase 6A reference included

**QA checklist:**
- [x] Documentation accurate and complete
- [x] Schema matches migration
- [x] Env flags documented with defaults
- [x] Rollback procedures documented
- [x] No conflicting information

**Rollback notes:**
- Documentation is informational only — removal not critical

**Dependencies:**
- T-6B.1 through T-6B.5 (for accurate documentation)

---

### T-6B.7 — QA Checklist Preparation

**Task ID:** T-6B.7  
**Phase:** Phase 6B — QA checklist preparation  
**Assigned Agent:** Prompt Engineer  
**Status:** COMPLETED — QA & Security PASS  

**Objective:**  
Prepare comprehensive QA checklist for Phase 6B implementation covering migrations, service, backfill, and env flags.

**Files modified:**
- THE_NEXUS_HUB.md

**Implementation requirements:**
- Create comprehensive QA checklist section for Phase 6B
- Cover all tasks T-6B.1 through T-6B.5 with specific verification steps
- Include safety checks for data integrity and migration safety
- Include verification steps for idempotency across all components
- Include rollback verification procedures
- Cover edge cases and error scenarios
- Define clear pass/fail criteria for each check

**QA checklist:**
- [x] Checklist covers T-6B.1 through T-6B.5
- [x] Migration checks included
- [x] Service checks included
- [x] Backfill checks included
- [x] Env flag checks included
- [x] Data integrity checks included
- [x] Rollback verification included

**Acceptance criteria:**
- Comprehensive QA checklist covering all Phase 6B tasks
- Clear pass/fail criteria for each check
- Includes edge cases and error scenarios
- Includes rollback verification

**Rollback notes:**
- Documentation is informational only — removal not critical

**Dependencies:**
- All T-6B tasks (for comprehensive checklist)

---

## WHAT DOES NOT CHANGE

1. **coin_news_history schema** — zero modifications  
2. **Any existing table schema** — zero modifications  
3. **Living Articles** — unchanged  
4. **Scorecard** — unchanged  
5. **Public UI / Frontend** — unchanged  
6. **AI workflow prompts** — unchanged  
7. **eventImpactAnalysis.service.ts** — read-only service untouched  
8. **External APIs** — no new integrations  
9. **Crons** — no new cron registrations  
10. **Routes/Controllers** — no new endpoints  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/scripts/migrate-event-impacts.sql` | 🔴 TODO | New — migration for both tables |
| `backend/src/models/market.model.ts` | 🔴 TODO | Add eventImpacts + eventImpactOutcomes Drizzle tables |
| `backend/src/services/eventImpactPersistence.service.ts` | 🔴 TODO | New — persistence bridge service |
| `backend/scripts/backfill-event-impacts.js` | 🔴 TODO | New — backfill with dry-run |
| `backend/src/config/env.ts` | 🔴 TODO | Add 3 feature flags |
| `agent_gedens/THE_NEXUS_HUB.md` | 🔴 TODO | Documentation + QA checklist |

**Total: 3 new files, 2 modified files, 1 documentation update**

---

## PRIORITY ORDER

```
1. T-6B.5 — Feature flags (independent, no deps)
2. T-6B.1 — event_impacts migration (blocks T-6B.3)
3. T-6B.2 — event_impact_outcomes migration (blocks T-6B.3)
4. Drizzle model updates (part of T-6B.3 or separate micro-task)
5. T-6B.3 — Persistence service (needs migrations + models + flags)
6. T-6B.4 — Backfill script (needs service + flags)
7. T-6B.6 — Documentation (needs all above)
8. T-6B.7 — QA checklist (needs all above)
```

**Parallelizable:**
- T-6B.5 (flags) + T-6B.1/T-6B.2 (migrations) can run in parallel

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Run migration | event_impacts + event_impact_outcomes tables created |
| 2 | TypeScript check | `npx tsc --noEmit` passes with zero errors |
| 3 | Drizzle model | Schema matches migration exactly |
| 4 | Feature flags | Server starts without new env vars |
| 5 | Persistence service | Creates 1 impact + 5 outcomes per source event |
| 6 | Idempotency | Second run skips existing records |
| 7 | Backfill dry-run | Zero writes, shows what would be created |
| 8 | Backfill execute | Correct data written to new tables |
| 9 | FK integrity | source_id SET NULL on source delete |
| 10 | No side effects | coin_news_history unchanged |

---

## RISK NOTES

1. **FK with SET NULL** — If coin_news_history rows are deleted, source_id becomes NULL but impact data preserved
2. **Batch size 100** — Conservative to avoid memory/timeout issues
3. **Dry-run default** — Backfill cannot accidentally write without explicit flag
4. **Feature flags false** — All persistence disabled by default
5. **No cascade on source_id** — Protects impact data from accidental source deletion
6. **Cascade within pair** — event_impact_outcomes cascade on event_impacts delete (same data pair)

---

## OPERATIONAL CONTROLS

### Environment Variables

**EVENT_IMPACT_PERSISTENCE_ENABLED** (default: false)
- Controls whether persistence service writes to new tables
- When false: all persist functions return null/0
- When true: writes enabled

**EVENT_IMPACT_BACKFILL_ENABLED** (default: false)
- Controls whether backfill script processes records
- When false: script exits immediately
- When true: script proceeds (still checks dry-run flag)

**EVENT_IMPACT_BACKFILL_DRY_RUN** (default: true)
- Controls backfill write behavior
- When true: backfill logs what it would do without writing
- When false: backfill actually writes data

### Safe Defaults

- All persistence disabled by default
- Backfill requires both BACKFILL_ENABLED=true and either --execute or BACKFILL_DRY_RUN=false
- Production starts safely with no impact persistence activity
- Operators must explicitly enable each feature

### Rollback Plan

1. **Disable persistence:**
   - EVENT_IMPACT_PERSISTENCE_ENABLED=false
   - EVENT_IMPACT_BACKFILL_ENABLED=false

2. **Leave tables in place:**
   - Data in event_impacts and event_impact_outcomes preserved
   - No harm in keeping populated tables

3. **Full cleanup (if absolutely necessary):**
   ```sql
   DROP TABLE IF EXISTS event_impact_outcomes;
   DROP TABLE IF EXISTS event_impacts;
   ```

4. **Code cleanup:**
   - Delete eventImpactPersistence.service.ts
   - Delete backfill-event-impacts.js
   - Delete migration file
   - Remove Drizzle model additions
   - Remove env flag definitions

5. **No changes to existing tables needed for rollback**

---

## SQL SCHEMA REFERENCE

### event_impacts

```
┌──────────────────┬───────────────┬──────────┬─────────┬─────────────────────────┐
│ Column           │ Type          │ Nullable │ Default │ Notes                   │
├──────────────────┼───────────────┼──────────┼─────────┼─────────────────────────┤
│ id               │ SERIAL        │ NO       │ auto    │ Primary key             │
│ source_table     │ VARCHAR(50)   │ NO       │ 'coin_… │ Source table name       │
│ source_id        │ INTEGER       │ YES      │ —       │ FK → cnh(id) SET NULL   │
│ coin_symbol      │ VARCHAR(20)   │ NO       │ —       │ e.g. 'BTC'              │
│ event_type       │ VARCHAR(50)   │ YES      │ —       │ e.g. 'regulation'       │
│ event_severity   │ INTEGER       │ YES      │ —       │ 1-5 scale               │
│ event_scope      │ VARCHAR(20)   │ YES      │ —       │ e.g. 'COIN', 'MARKET'   │
│ published_at     │ TIMESTAMP     │ NO       │ —       │ Event publication time  │
│ price_at_event   │ REAL          │ YES      │ —       │ Price when event hit    │
│ price_source     │ VARCHAR(20)   │ NO       │ 'binan… │ Price data source       │
│ status           │ VARCHAR(20)   │ NO       │ 'pendi… │ pending/completed       │
│ created_at       │ TIMESTAMP     │ NO       │ NOW()   │ Record creation time    │
│ updated_at       │ TIMESTAMP     │ NO       │ NOW()   │ Last update time        │
└──────────────────┴───────────────┴──────────┴─────────┴─────────────────────────┘

Indexes:
  UNIQUE  (source_id) WHERE source_id IS NOT NULL
  BTREE   (coin_symbol)
  BTREE   (event_type)
  BTREE   (status)
  BTREE   (published_at)
```

### event_impact_outcomes

```
┌───────────────────────────┼───────────────┼──────────┼─────────┼──────────────────────────────┐
│ Column                    │ Type          │ Nullable │ Default │ Notes                        │
├───────────────────────────┼───────────────┼──────────┼─────────┼──────────────────────────────┤
│ id                        │ SERIAL        │ NO       │ auto    │ Primary key                  │
│ event_impact_id           │ INTEGER       │ NO       │ —       │ FK → ei(id) CASCADE          │
│ horizon                   │ VARCHAR(10)   │ NO       │ —       │ '1h','4h','24h','3d','7d'    │
│ horizon_hours             │ INTEGER       │ NO       │ —       │ 1, 4, 24, 72, 168            │
│ due_at                    │ TIMESTAMP     │ NO       │ —       │ published_at + horizon_hours  │
│ checked_at                │ TIMESTAMP     │ YES      │ —       │ When outcome was checked      │
│ price_at_horizon          │ REAL          │ YES      │ —       │ Price at horizon time         │
│ change_percent            │ REAL          │ YES      │ —       │ % change from price_at_event  │
│ max_upside_percent        │ REAL          │ YES      │ —       │ Max upside within horizon     │
│ max_drawdown_percent      │ REAL          │ YES      │ —       │ Max drawdown within horizon   │
│ time_to_peak_hours        │ INTEGER       │ YES      │ —       │ Hours to reach peak           │
│ time_to_bottom_hours      │ INTEGER       │ YES      │ —       │ Hours to reach bottom         │
│ outcome_classification    │ VARCHAR(30)   │ YES      │ —       │ POSITIVE/NEGATIVE/NEUTRAL     │
│ status                    │ VARCHAR(20)   │ NO       │ 'pendi… │ pending/completed/failed      │
│ error_message             │ TEXT          │ YES      │ —       │ Error details if failed       │
│ created_at                │ TIMESTAMP     │ NO       │ NOW()   │ Record creation time          │
│ updated_at                │ TIMESTAMP     │ NO       │ NOW()   │ Last update time              │
└───────────────────────────┴───────────────┴──────────┴─────────┴──────────────────────────────┘

Indexes:
  UNIQUE  (event_impact_id, horizon)
  BTREE   (status)
  BTREE   (due_at)
  BTREE   (event_impact_id)
```

---

*Phase 6B authored: May 4, 2026*  
*Depends on: Phase 6A (read-only analysis engine — COMPLETED)*  
*Enables: Persistent event impact data for future analysis, UI, and AI integration*

---

---

# Phase 6A — Event Impact Analysis Engine

**Status:** COMPLETED — QA PASS  
**Date:** May 3, 2026  
**Priority:** P1 (Enables data-driven event impact insights)  
**Scope:** 3 new files, 1 env flag, 1 verification checklist  
**Reviewed by:** QA & Security Hunter — APPROVED  

## OBJECTIVE

Create a read-only event impact analysis service that calculates deterministic statistics from historical coin_news_history data, including per-horizon outcome rates, average max upside/drawdown, and outcome classification rates.

## REQUIRED TASKS

### T-6A.1: Verify coin_news_history Field Names

**Task ID:** T-6A.1  
**Phase:** Phase 6A — Verify coin_news_history field names  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Confirm all required fields for event impact analysis exist in market.model.ts with correct nullable types and camelCase mappings.

**Files inspected:**  
- `backend/src/models/market.model.ts:209-248` — coinNewsHistory table definition  

**Acceptance criteria:**  
- All Phase 1-2 outcome fields present: change1h through change7d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification  
- All fields nullable  
- Correct camelCase property mappings  

**Testing / verification:**  
- Drizzle schema matches database  
- TypeScript compilation clean  

**Dependencies:**  
None (verification only)  

---

### T-6A.2: Create Read-Only Event Impact Analysis Service

**Task ID:** T-6A.2  
**Phase:** Phase 6A — Create read-only event impact analysis service  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Implement backend/src/services/eventImpactAnalysis.service.ts with deterministic calculations for all required statistics.

**Files modified:**  
- `backend/src/services/eventImpactAnalysis.service.ts` (new)  

**Implementation requirements:**  
- Pure read-only SELECT queries from coin_news_history  
- Calculates per-horizon sample sizes, median returns, positive/bullish outcome rates, average max upside/drawdown  
- Filters by optional coinSymbol, eventType, eventSeverity  
- Returns structured statistics object  
- No external API calls, no AI, no caching  

**Acceptance criteria:**  
- Service exports getEventImpactAnalysis function  
- All calculations deterministic from database data  
- Handles edge cases (no matches, null values) gracefully  
- TypeScript strict, no any types  

**Testing / verification:**  
- `cd backend && npx tsc --noEmit` — passes  
- Manual query verification with known data  

**Dependencies:**  
- T-6A.1 (fields exist)  

---

### T-6A.3: Create Manual Read-Only Analysis Script

**Task ID:** T-6A.3  
**Phase:** Phase 6A — Create manual read-only analysis script  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Create backend/scripts/analyze-event-impact.js that checks EVENT_IMPACT_ENGINE_ENABLED and prints console summary.

**Files modified:**  
- `backend/scripts/analyze-event-impact.js` (new)  

**Implementation requirements:**  
- Checks EVENT_IMPACT_ENGINE_ENABLED flag  
- Exits safely if disabled (no writes, no analysis)  
- Calls getEventImpactAnalysis() with no filters  
- Pretty-prints all statistics to console  
- No database writes  

**Acceptance criteria:**  
- Script runs with `node scripts/analyze-event-impact.js` (ts-node for dev)  
- When disabled: exits with appropriate message  
- When enabled: prints comprehensive analysis  
- Handles errors gracefully  

**Testing / verification:**  
- Disabled flag: `npx ts-node scripts/analyze-event-impact.js` exits safely  
- No database writes confirmed  

**Dependencies:**  
- T-6A.2 (service exists)  

---

### T-6A.4: Add EVENT_IMPACT_ENGINE_ENABLED Flag

**Task ID:** T-6A.4  
**Phase:** Phase 6A — Add EVENT_IMPACT_ENGINE_ENABLED flag  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Confirm EVENT_IMPACT_ENGINE_ENABLED exists in backend/src/config/env.ts with default false.

**Files inspected:**  
- `backend/src/config/env.ts:84-85` — env schema definition  

**Acceptance criteria:**  
- Flag defined as boolean with default false  
- Zod validation includes the flag  
- Server starts normally with missing env var  

**Testing / verification:**  
- Server startup logs no env validation errors  
- Script exits safely when flag false  

**Dependencies:**  
None  

---

### T-6A.5: Policy-Safe Output Wording

**Task ID:** T-6A.5  
**Phase:** Phase 6A — Policy-safe output wording  
**Owner:** Prompt Engineer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Define preferred terms for policy-safe historical analysis framing.

**Preferred terms:**  
- Historical observed movement  
- Historical pattern  
- Reference price  
- Upside target zone  
- Invalidation zone  
- Risk zone  
- Bullish/bearish bias  
- Observed outcome  
- Historical summary  
- Data-driven market context  
- Not financial advice  

**Prohibited terms:**  
- Buy/sell  
- Take profit/stop loss  
- Expected/guaranteed profit  
- Trading advice  

**Guidelines:**  
- Emphasize historical analysis framing  
- Avoid predictive language  
- Focus on data-driven insights  

**Files modified:**  
- THE_NEXUS_HUB.md (added policy-safe terminology guidelines, Phase 6A scope limitations section)  

**Acceptance criteria:**  
- Terminology guidelines documented  
- Prohibited terms clearly listed  
- Guidelines emphasize historical framing  

---

### T-6A.6: Documentation Update

**Task ID:** T-6A.6  
**Phase:** Phase 6A — Documentation update  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Update THE_NEXUS_HUB.md with Phase 6A scope limitations and comprehensive QA checklist.

**Files modified:**  
- THE_NEXUS_HUB.md  

**Implementation requirements:**  
- Add "PHASE 6A SCOPE LIMITATIONS" section  
- Clarify read-only nature, excluded features, future Phase 6B reference  
- Comprehensive QA checklist covering all T-6A.1 through T-6A.7 tasks  
- Verification steps, safety checks, edge cases, pass/fail criteria  

**Acceptance criteria:**  
- Scope limitations clearly documented  
- QA checklist covers all tasks  
- Documentation accurate and complete  

---

### T-6A.7: QA Checklist Preparation

**Task ID:** T-6A.7  
**Phase:** Phase 6A — QA checklist preparation  
**Owner:** QA & Security Hunter  
**Status:** Done — QA & Security PASS  

**Objective:**  
Prepare comprehensive QA checklist for Phase 6A implementation.

**Checklist coverage:**  
- Schema verification  
- Service functionality  
- Script behavior  
- Env flag handling  
- TypeScript compilation  
- Read-only confirmation  
- Edge case handling  
- Error handling  
- Performance considerations  

**Acceptance criteria:**  
- All T-6A.1 through T-6A.7 tasks have verification steps  
- Safety checks for read-only operations  
- Edge cases identified and tested  
- Pass/fail criteria defined  

---

## WHAT DOES NOT CHANGE

1. **Existing coin_news_history rows** — remain unchanged  
2. **No new database writes** — Phase 6A is read-only analysis  
3. **No AI workflows** — no integration into prompts or analysis  
4. **No UI changes** — no frontend modifications  
5. **No external API calls** — all calculations from existing data  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/src/services/eventImpactAnalysis.service.ts` | ✅ Done | New — read-only analysis service |
| `backend/scripts/analyze-event-impact.js` | ✅ Done | New — manual analysis script |
| `backend/src/config/env.ts` | ✅ Done | EVENT_IMPACT_ENGINE_ENABLED flag confirmed |
| `backend/src/models/market.model.ts` | ✅ Verified | Fields confirmed present |
| `THE_NEXUS_HUB.md` | ✅ Done | Documentation and QA checklist added |

**Total: 2 new files, 1 modified file, 2 verified files**

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Schema verification | All required fields exist in coinNewsHistory |
| 2 | TypeScript check | `npx tsc --noEmit` passes with no errors |
| 3 | Service functionality | getEventImpactAnalysis returns correct statistics |
| 4 | Script disabled | Exits safely when EVENT_IMPACT_ENGINE_ENABLED=false |
| 5 | Script enabled | Prints comprehensive analysis when enabled |
| 6 | Read-only confirmation | No INSERT/UPDATE/DELETE operations |
| 7 | Edge cases | Handles no data, null values, errors gracefully |
| 8 | Performance | Query completes within reasonable time |

---

## RISK NOTES

1. **Flag default false** — Analysis disabled by default, must be explicitly enabled  
2. **Read-only operations** — No risk of data corruption  
3. **Error handling** — Service returns empty results on failures  
4. **No external dependencies** — All calculations from existing database  

---

## QA & SECURITY AUDIT RESULTS

**VERDICT:** APPROVED  
**CRITICAL REVIEW:** No bugs, security issues, or architectural flaws found. Code is production-ready.  
**CORRECTION SNIPPETS:** None required.  
**NEXT INSTRUCTIONS FOR JUNIOR:** No corrections needed — proceed to Phase 6B planning.  
**LOG UPDATE:** Agent logs updated with Phase 6A completion and PASS verdict.  
**STATE UPDATE:** Project state updated — Phase 6A marked completed, Phase 6B ready for planning.

---

*Phase 6A authored: May 3, 2026*  
*Enables: Data-driven historical event impact analysis*

---

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

# Phase 6A — Event Impact Analysis MVP

**Status:** PLANNED — Ready for immediate execution after Phase 1-5 completion
**Date:** May 3, 2026
**Priority:** P1 (Read-only MVP for event impact analysis)
**Scope:** 1 service, 1 script, 1 env flag, 1 policy-safe wording update, 1 documentation update, 1 QA prep
**Reviewed by:** Lead Architect — APPROVED FOR EXECUTION

## OBJECTIVE

Deliver a read-only MVP for event impact analysis that calculates basic historical statistics from existing coin_news_history data without any database writes, migrations, or UI changes. Phase 6A focuses on safe, deterministic calculations with policy-safe output wording.

## PHASE 6A SCOPE LIMITATIONS

**Phase 6A is strictly read-only and analytical only:**

- ✅ Read-only calculations using existing coin_news_history data
- ✅ Deterministic statistical analysis (averages, medians, rates)
- ✅ Console output for manual analysis
- ✅ Policy-safe terminology definitions
- ✅ Safe environment flag controls

**Phase 6A explicitly does NOT include:**
- ❌ Database migrations or schema changes
- ❌ Database writes or data persistence
- ❌ New tables or columns
- ❌ Public UI changes or displays
- ❌ Living Articles modifications
- ❌ Scorecard updates
- ❌ External API integrations
- ❌ Cron job automation
- ❌ AI workflow integration
- ❌ Public user-facing features

**Future Phase 6B (separate approval required):**
- Database persistence of analysis results
- UI integration for historical impact views
- Automated cron-based analysis updates
- Advanced statistical modeling
- AI-enhanced pattern recognition

## REQUIRED TASKS

### T-6A.1 — Verify coin_news_history Field Names

**Task ID:** T-6A.1
**Title:** Verify coin_news_history Field Names
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Document the exact field names and data types in coin_news_history table that contain the required data for impact analysis calculations.

**Files to inspect:**
- backend/src/models/market.model.ts — coinNewsHistory table definition
- SQL schema documentation if available

**Files allowed to modify:**
- Documentation files (e.g., agent_gedens/PROJECT_STATE.md or THE_NEXUS_HUB.md for findings)

**Forbidden files:**
- Any code files
- Migration files
- Schema files

**Constraints:**
- Read-only inspection only
- No code changes unless documenting findings in approved docs

**Step-by-step instructions:**
1. Review coinNewsHistory table definition in market.model.ts
2. Identify fields for: change1h, change4h, change24h, change3d, change7d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification
3. Document exact camelCase field names used in Drizzle model
4. Note any nullable fields or data type constraints

**Documented Field Mappings:**
From backend/src/models/market.model.ts (lines 209-248):

- change1h: real('change_1h').nullable() — 1-hour price change percentage
- change4h: real('change_4h').nullable() — 4-hour price change percentage
- change24h: real('change_24h').nullable() — 24-hour price change percentage
- change3d: real('change_3d').nullable() — 3-day price change percentage
- maxUpsideAfterEvent: real('max_upside_after_event').nullable() — Maximum upside percentage after event
- maxDrawdownAfterEvent: real('max_drawdown_after_event').nullable() — Maximum drawdown percentage after event
- timeToPeakHours: integer('time_to_peak_hours').nullable() — Hours to reach maximum upside
- timeToBottomHours: integer('time_to_bottom_hours').nullable() — Hours to reach maximum drawdown
- outcomeClassification: varchar('outcome_classification', { length: 30 }).nullable() — POSITIVE/NEGATIVE/NEUTRAL classification

All fields are nullable (no .notNull() constraint), allowing for partial data population.

**Acceptance criteria:**
- Documented field mapping from SQL to TypeScript
- Confirmed availability of required fields from Phase 1 schema

**QA checklist:**
- Fields exist and are populated in historical data
- Data types match calculation requirements

**Rollback notes:**
- No changes to revert

---

### T-6A.2 — Create Read-Only Event Impact Analysis Service

**Task ID:** T-6A.2
**Title:** Create Read-Only Event Impact Analysis Service
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Implement backend/src/services/eventImpactAnalysis.service.ts that performs read-only calculations of event impact statistics using existing coin_news_history data.

**Files to inspect:**
- backend/src/models/market.model.ts — coinNewsHistory schema
- Existing service patterns in backend/src/services/

**Files allowed to modify:**
- backend/src/services/eventImpactAnalysis.service.ts (new file)

**Forbidden files:**
- Migrations
- Models schema changes
- Crons
- Controllers
- Frontend files
- Living Articles files
- Scorecard files

**Constraints:**
- Zero any types — use explicit TypeScript types
- Read-only operations only (SELECT queries)
- No database writes
- Service must be stateless and deterministic

**Step-by-step instructions:**
1. Create new service file with proper imports
2. Define interfaces for input parameters and output statistics
3. Implement calculation functions for:
   - change percent per available horizon
   - sample size
   - average change
   - median change
   - positive/negative/neutral rate
   - average max upside
   - average max drawdown
   - average time to peak
   - average time to bottom
4. Use Drizzle queries to fetch historical data
5. Handle edge cases (no data, small samples) gracefully
6. Export main analysis function

**Acceptance criteria:**
- Service compiles without any types
- Calculations are deterministic and accurate
- No database modifications performed

**QA checklist:**
- Test with known historical data sets
- Verify calculation accuracy against manual checks
- Confirm no side effects on database

**Rollback notes:**
- Delete the service file
- No data cleanup needed

---

### T-6A.3 — Create Manual Read-Only Analysis Script

**Task ID:** T-6A.3
**Title:** Create Manual Read-Only Analysis Script
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create backend/scripts/analyze-event-impact.js that uses the eventImpactAnalysis service to perform read-only analysis and print console summary.

**Files to inspect:**
- Existing script patterns in backend/scripts/
- backend/src/services/eventImpactAnalysis.service.ts (after T-6A.2)

**Files allowed to modify:**
- backend/scripts/analyze-event-impact.js (new file)

**Forbidden files:**
- Any files not listed in allowed

**Constraints:**
- Must use the service from T-6A.2
- Only print console summary (no file writes, no DB writes)
- Check EVENT_IMPACT_ENGINE_ENABLED flag
- Exit safely if flag is false or missing

**Step-by-step instructions:**
1. Create Node.js script file
2. Import required dependencies and service
3. Check EVENT_IMPACT_ENGINE_ENABLED environment variable
4. If false or missing, print message and exit cleanly
5. If enabled, call service with sample parameters
6. Format and print analysis results to console
7. Handle errors gracefully without crashing

**Acceptance criteria:**
- Script runs successfully when flag is true
- Exits safely when flag is false or missing
- Console output shows readable analysis summary

**QA checklist:**
- Test with flag enabled/disabled
- Verify no database modifications
- Check error handling

**Rollback notes:**
- Delete the script file
- No data cleanup needed

---

### T-6A.4 — Add EVENT_IMPACT_ENGINE_ENABLED Flag

**Task ID:** T-6A.4
**Title:** Add EVENT_IMPACT_ENGINE_ENABLED Flag
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Add EVENT_IMPACT_ENGINE_ENABLED environment variable configuration with safe defaults.

**Files to inspect:**
- backend/src/config/env.ts — existing env configuration

**Files allowed to modify:**
- backend/src/config/env.ts

**Forbidden files:**
- Any files not listed

**Constraints:**
- Default value must be false
- Missing env var must not cause startup crashes
- Configuration must be accessible by scripts and services

**Step-by-step instructions:**
1. Locate existing env configuration pattern
2. Add EVENT_IMPACT_ENGINE_ENABLED with default false
3. Ensure safe handling when env var is undefined
4. Export the configuration value

**Acceptance criteria:**
- Server starts normally with missing env var
- Configuration defaults to false
- Can be overridden by setting env var to true

**QA checklist:**
- Test server startup with env var unset
- Test with env var set to false/true
- Verify no crashes or errors

**Rollback notes:**
- Remove the env configuration
- No data changes

---

### T-6A.5 — Policy-Safe Output Wording

**Task ID:** T-6A.5
**Title:** Policy-Safe Output Wording
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Define and document policy-safe terminology for historical impact analysis output.

**Files to inspect:**
- Existing policy-safe mappings in documentation

**Files allowed to modify:**
- Documentation files (THE_NEXUS_HUB.md or agent_gedens/)

**Forbidden files:**
- No code changes
- No public UI changes
- No prompt integration changes

**Constraints:**
- Only define terminology mappings
- No implementation of mappings
- Focus on historical analysis context

**Step-by-step instructions:**
1. Define safe terms for output:
   - historical observed movement
   - historical pattern
   - reference price
2. Avoid prohibited terms:
   - buy/sell
   - take profit
   - stop loss
   - expected profit
   - guaranteed
3. Document the terminology guidelines
4. Note that this is for future implementation reference

**Policy-Safe Terminology Guidelines:**

For historical impact analysis output, use the following terminology to ensure AdSense compliance and avoid financial advice implications:

**Preferred Safe Terms:**
- Historical observed movement (instead of "price movement" with predictive context)
- Historical pattern (instead of "trend" implying future continuation)
- Reference price (instead of "entry price")
- Upside target zone (instead of "take profit level")
- Invalidation zone (instead of "stop loss")
- Risk zone (instead of "stop loss area")
- Bullish/Bearish bias (instead of "buy/sell signal")
- Observed outcome (instead of "successful trade")
- Historical summary (instead of "performance report")
- Data-driven market context (instead of "trading opportunity")
- Not financial advice (disclaimer)

**Prohibited Terms to Avoid:**
- Buy now / Sell now
- Enter trade / Take position
- Take profit / Stop loss (in direct terms)
- Expected profit / Guaranteed returns
- This will go up/down
- Recommended action
- Investment opportunity
- Trading strategy advice

**Guidelines:**
- Always frame analysis as historical observations, not predictions
- Use "historical observed movement" for price changes after events
- Reference "market scenarios" instead of "trading signals"
- Include "Not financial advice" disclaimer in any public output
- Focus on data patterns and statistical observations

**Acceptance criteria:**
- Terminology guidelines documented
- Clear mapping from internal to public-safe language

**QA checklist:**
- Review terminology for AdSense compliance
- Confirm no financial advice implications

**Rollback notes:**
- Remove documentation
- No code changes

---

### T-6A.6 — Documentation Update

**Task ID:** T-6A.6
**Title:** Documentation Update
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Update project documentation to clarify Phase 6A scope and future phases.

**Files to inspect:**
- THE_NEXUS_HUB.md — current phase documentation

**Files allowed to modify:**
- THE_NEXUS_HUB.md

**Forbidden files:**
- No code files

**Constraints:**
- Document Phase 6A as read-only
- Explain limitations (no migrations, no writes, no UI changes)
- Reference future Phase 6B for persistence

**Step-by-step instructions:**
1. Add documentation section for Phase 6A
2. Clearly state read-only nature
3. List what's NOT included in Phase 6A
4. Reference future phases for advanced features

**Acceptance criteria:**
- Documentation accurately reflects Phase 6A scope
- Clear distinction from future phases

**QA checklist:**
- Review for accuracy and completeness
- Ensure no conflicting information

**Rollback notes:**
- Remove the documentation section

---

### T-6A.7 — QA Checklist Preparation

**Task ID:** T-6A.7
**Title:** QA Checklist Preparation
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Prepare comprehensive QA checklist for Phase 6A implementation.

**Files to inspect:**
- Existing QA patterns in previous phases

**Files allowed to modify:**
- Documentation files (THE_NEXUS_HUB.md)

**Forbidden files:**
- No code files

**Constraints:**
- Prepare checklist for QA & Security Hunter
- Cover all tasks T-6A.1 through T-6A.6
- Include testing scenarios and acceptance criteria

**Step-by-step instructions:**
1. Create QA checklist section
2. Include test cases for each task
3. Add verification steps for calculations
4. Include safety checks (no DB writes, flag behavior)
5. Prepare for handoff to QA team

**Comprehensive QA Checklist for Phase 6A:**

**Pre-Implementation Checks:**
- [ ] Review THE_NEXUS_HUB.md for Phase 6A scope limitations
- [ ] Confirm all assigned tasks (T-6A.1 through T-6A.7) are documented
- [ ] Verify no forbidden files are modified (no code, no migrations, no UI)

**T-6A.1 Verification (Field Names):**
- [ ] Inspect backend/src/models/market.model.ts coinNewsHistory table
- [ ] Verify all required fields exist: change1h, change4h, change24h, change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification
- [ ] Confirm fields are nullable (real('field').nullable())
- [ ] Check exact camelCase naming matches Drizzle conventions
- [ ] Document any data type mismatches

**T-6A.2 Verification (Service Implementation):**
- [ ] Review backend/src/services/eventImpactAnalysis.service.ts
- [ ] Verify zero 'any' types used
- [ ] Check explicit TypeScript interfaces for inputs/outputs
- [ ] Confirm all queries are SELECT-only (no INSERT/UPDATE/DELETE)
- [ ] Test compilation with `cd backend && npx tsc --noEmit`
- [ ] Verify deterministic calculations (same input = same output)
- [ ] Check edge case handling (no data, small samples)

**T-6A.3 Verification (Manual Script):**
- [ ] Review backend/scripts/analyze-event-impact.js
- [ ] Confirm EVENT_IMPACT_ENGINE_ENABLED flag check
- [ ] Verify safe exit when flag is false/missing
- [ ] Test script execution prints console summary only
- [ ] Confirm no file writes or DB modifications
- [ ] Check error handling without crashes

**T-6A.4 Verification (Environment Flag):**
- [ ] Review backend/src/config/env.ts
- [ ] Confirm EVENT_IMPACT_ENGINE_ENABLED defaults to false
- [ ] Test server startup with missing env var (no crashes)
- [ ] Test with env var set to true/false
- [ ] Verify configuration is accessible by scripts/services

**T-6A.5 Verification (Policy-Safe Wording):**
- [ ] Review terminology guidelines in THE_NEXUS_HUB.md
- [ ] Check all prohibited terms are listed and avoided
- [ ] Verify safe term mappings are comprehensive
- [ ] Confirm focus on historical analysis context
- [ ] Audit for AdSense compliance

**T-6A.6 Verification (Documentation):**
- [ ] Check Phase 6A scope limitations section exists
- [ ] Verify read-only nature clearly stated
- [ ] Confirm list of excluded features is complete
- [ ] Review future Phase 6B reference
- [ ] Ensure no conflicting information with existing docs

**T-6A.7 Verification (This Checklist):**
- [ ] Self-review checklist completeness
- [ ] Verify alignment with all task requirements
- [ ] Confirm coverage of all Phase 6A tasks
- [ ] Check clear pass/fail criteria for each item
- [ ] Prepare for handoff to QA & Security Hunter

**Integration Testing:**
- [ ] Run analysis script with flag enabled (if service implemented)
- [ ] Verify console output uses policy-safe terminology
- [ ] Check no database writes occur during analysis
- [ ] Test with various data scenarios (empty, partial, full)
- [ ] Monitor for any unintended side effects

**Safety Checks:**
- [ ] Confirm no migrations run
- [ ] Verify no new tables/columns added
- [ ] Check no UI changes made
- [ ] Ensure no external APIs added
- [ ] Confirm no crons enabled
- [ ] Test server stability with new flag

**Edge Cases:**
- [ ] Analysis with zero historical events
- [ ] Partial data (some horizons missing)
- [ ] Invalid or extreme price values
- [ ] Network/API failures (though read-only)
- [ ] Large datasets performance

**Acceptance criteria:**
- Comprehensive checklist covering all aspects
- Clear pass/fail criteria
- Includes edge cases and error scenarios

**QA checklist:**
- Self-review checklist completeness
- Verify alignment with task requirements

**Rollback notes:**
- Remove the QA checklist section

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Run field verification | Documented field names match schema |
| 2 | Service compilation | No TypeScript errors, zero any types |
| 3 | Sample calculations | Accurate statistics from historical data |
| 4 | Script execution with flag false | Exits safely without analysis |
| 5 | Script execution with flag true | Prints analysis summary |
| 6 | Server startup | No crashes with missing env var |
| 7 | QA checklist review | Complete coverage of Phase 6A |

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| backend/src/services/eventImpactAnalysis.service.ts | 🔴 TODO | New — read-only analysis service |
| backend/scripts/analyze-event-impact.js | 🔴 TODO | New — manual analysis script |
| backend/src/config/env.ts | 🔴 TODO | Add EVENT_IMPACT_ENGINE_ENABLED flag |
| THE_NEXUS_HUB.md | 🔴 TODO | Documentation updates |

**Total: 3 new files, 1 modified file**

---

## PRIORITY ORDER

```
1. T-6A.1 — Field verification (foundation)
2. T-6A.2 — Service implementation (core logic)
3. T-6A.4 — Env flag (enables safe control)
4. T-6A.3 — Manual script (depends on service + flag)
5. T-6A.5 — Policy wording (parallel)
6. T-6A.6 — Documentation (parallel)
7. T-6A.7 — QA prep (final)
```

---

## RISK NOTES

1. **Read-only constraint** — Must ensure no accidental DB writes in service
2. **Type safety** — Zero any types required, explicit interfaces needed
3. **Flag safety** — Missing env var must not crash, defaults to disabled
4. **Policy compliance** — Output wording must remain analysis-focused, not advice

---

*Phase 6A authored: May 3, 2026*
*Enables: Read-only event impact analysis MVP*

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