# PHASE 1 — DB Schema & Migrations

> **Depends on:** Phase 0 complete.
> **Goal:** Create all new tables before any service tries to use them.
> **Files affected:** `backend/src/models/market.model.ts`, `backend/src/models/index.ts`

---

## Task 1-A: Add `coin_intelligence_cache` Table

**File:** `backend/src/models/market.model.ts`
**Location:** After `coinMemory` table (after line 125)

```typescript
export const coinIntelligenceCache = pgTable('coin_intelligence_cache', {
    coinSymbol:     varchar('coin_symbol', { length: 20 }).primaryKey(),
    ath:            real('ath'),
    athDate:        varchar('ath_date', { length: 20 }),
    trend8w:        varchar('trend_8w', { length: 20 }),
    week52High:     real('week_52_high'),
    week52Low:      real('week_52_low'),
    priceChange30d: real('price_change_30d'),
    wikiBackground: text('wiki_background'),
    dexBoostActive: boolean('dex_boost_active').default(false).notNull(),
    dataSource:     varchar('data_source', { length: 20 }),
    cachedAt:       timestamp('cached_at').defaultNow().notNull(),
});
```

---

## Task 1-B: Add `coin_news_history` Table

**File:** `backend/src/models/market.model.ts`
**Location:** After `coinIntelligenceCache`

```typescript
export const coinNewsHistory = pgTable('coin_news_history', {
    id:            serial('id').primaryKey(),
    coinSymbol:    varchar('coin_symbol', { length: 20 }).notNull(),
    title:         text('title').notNull(),
    source:        varchar('source', { length: 100 }),
    publishedAt:   timestamp('published_at').notNull(),
    sentiment:     varchar('sentiment', { length: 10 }),
    eventType:     varchar('event_type', { length: 50 }),
    eventSeverity: integer('event_severity').default(1),
    priceAtTime:   real('price_at_time'),
    price7dAfter:  real('price_7d_after'),
    priceChange7d: real('price_change_7d'),
    isRugPull:     boolean('is_rug_pull').default(false).notNull(),
    fetchedAt:     timestamp('fetched_at').defaultNow().notNull(),
});
```

---

## Task 1-C: Export New Tables

**File:** `backend/src/models/index.ts`

The file already has `export * from './market.model';` which re-exports everything. No change needed here — the new tables will be exported automatically.

**Verify** this is the case. If the file uses named exports instead, add:
```typescript
export { coinIntelligenceCache, coinNewsHistory } from './market.model';
```

---

## Task 1-D: Run Migration

```bash
cd backend && npx drizzle-kit push
```

**Verify** tables were created:
```bash
cd backend && npx drizzle-kit studio
```
Then check that `coin_intelligence_cache` and `coin_news_history` appear in the schema browser.

---

### Prompt for Senior AI — Task 1:

```
You are the Senior Developer for OnlyAlpha. Execute this micro-task with precision.

=== FILE: backend/src/models/market.model.ts ===

At the END of the file (after the coinMemory table, after line 125), ADD these two new table definitions:

```typescript
export const coinIntelligenceCache = pgTable('coin_intelligence_cache', {
    coinSymbol:     varchar('coin_symbol', { length: 20 }).primaryKey(),
    ath:            real('ath'),
    athDate:        varchar('ath_date', { length: 20 }),
    trend8w:        varchar('trend_8w', { length: 20 }),
    week52High:     real('week_52_high'),
    week52Low:      real('week_52_low'),
    priceChange30d: real('price_change_30d'),
    wikiBackground: text('wiki_background'),
    dexBoostActive: boolean('dex_boost_active').default(false).notNull(),
    dataSource:     varchar('data_source', { length: 20 }),
    cachedAt:       timestamp('cached_at').defaultNow().notNull(),
});

export const coinNewsHistory = pgTable('coin_news_history', {
    id:            serial('id').primaryKey(),
    coinSymbol:    varchar('coin_symbol', { length: 20 }).notNull(),
    title:         text('title').notNull(),
    source:        varchar('source', { length: 100 }),
    publishedAt:   timestamp('published_at').notNull(),
    sentiment:     varchar('sentiment', { length: 10 }),
    eventType:     varchar('event_type', { length: 50 }),
    eventSeverity: integer('event_severity').default(1),
    priceAtTime:   real('price_at_time'),
    price7dAfter:  real('price_7d_after'),
    priceChange7d: real('price_change_7d'),
    isRugPull:     boolean('is_rug_pull').default(false).notNull(),
    fetchedAt:     timestamp('fetched_at').defaultNow().notNull(),
});
```

IMPORTANT:
- All Drizzle column types (pgTable, serial, varchar, text, timestamp, integer, real, boolean) are already imported at the top of the file.
- Do NOT add any new imports.
- Do NOT modify any existing tables.
- The models/index.ts already uses `export * from './market.model'` so no changes needed there.

Rules: ZERO `any` types. Do not modify any other files.
```

---

## Phase 1 Completion Checklist

- [ ] `coinIntelligenceCache` table added to `market.model.ts`
- [ ] `coinNewsHistory` table added to `market.model.ts`
- [ ] Both exported via `models/index.ts` (auto-exported via `export *`)
- [ ] `npx drizzle-kit push` succeeded — tables exist in database
- [ ] Drizzle Studio shows both tables with correct columns
