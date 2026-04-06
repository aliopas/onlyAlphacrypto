# PHASE 4 — Temporal Intelligence Layer

> **Depends on:** Phase 1 (DB tables) + Phase 2 (price services).
> **Goal:** Build historical event patterns so DeepSeek can reference past outcomes.
> **New file:** `backend/src/services/temporalIntelligence.service.ts`

---

## Task 4-A: Google News RSS Fetcher (Rate Limited)

### Function: `fetchHistoricalNewsForCoins(coins: string[]): Promise<void>`

**Logic:**
1. Loop through each coin symbol
2. Add 2-3 second random delay between coins (avoids IP ban from Google)
3. Call `fetchCoinHistoricalNews(symbol)` for each
4. Log progress per coin

### Internal Function: `fetchCoinHistoricalNews(symbol: string, eventType: string): Promise<void>`

**Logic:**
1. Build Google News RSS URL: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`
2. Parse using the existing `Parser` from `rss-parser` (same as `rssNews.service.ts`)
3. Take up to 30 items
4. Add 500ms micro-pause every 10 items
5. For each item: get price at publication time via `getBinancePriceAtDate()`
6. Insert into `coinNewsHistory` using Drizzle ORM with `onConflictDoNothing()`
7. If Google blocks us → `console.warn()` and skip (do NOT crash)

### Helper: `classifyEventType(symbol: string): string`

Simple classifier that returns common event types for a given symbol. Default: `'Other'`.

---

## Task 4-B: Temporal Pattern Builder

### Interface:

```typescript
interface TemporalOutcome {
    date: string;
    headline: string;
    outcome: string;
}

export interface TemporalPattern {
    eventType: string;
    severity: number;
    sampleSize: number;
    rugPullRate: string;
    bullishRate: string;
    avgOutcome7d: string;
    historicalCases: TemporalOutcome[];
}
```

### Function: `buildTemporalPattern(symbol: string, eventType: string, severity: number): Promise<TemporalPattern | null>`

**Logic:**
1. Query `coinNewsHistory` using Drizzle ORM:
   - Filter: `coinSymbol = symbol`, `eventType = eventType`, `eventSeverity = severity`, `price7dAfter IS NOT NULL`, `publishedAt > NOW() - 180 days`
   - Order by `publishedAt DESC`, limit 5
2. If no rows → return `null`
3. Calculate:
   - `historicalCases`: map rows to `{ date, headline, outcome }` format
   - Rug pull outcomes: `"RUG PULL — token went to zero"`
   - Normal outcomes: `"+X.X% in 7 days"` or `"-X.X% in 7 days"`
   - `rugPullRate`: percentage of rug pulls in sample
   - `bullishRate`: percentage of positive 7d outcomes (excluding rug pulls)
   - `avgOutcome7d`: average 7d price change (excluding rug pulls)
4. Return `TemporalPattern` object

### Drizzle ORM Query Pattern:
```typescript
import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { eq, and, gte, isNotNull, desc } from 'drizzle-orm';

const rows = await db.select()
    .from(coinNewsHistory)
    .where(and(
        eq(coinNewsHistory.coinSymbol, symbol),
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventSeverity, severity),
        isNotNull(coinNewsHistory.price7dAfter),
        gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '180 days'`)
    ))
    .orderBy(desc(coinNewsHistory.publishedAt))
    .limit(5);
```

---

## Task 4-C: Daily Backfill Job (Rug Pull Detection)

### Function: `backfillPriceOutcomes(): Promise<void>`

**Logic:**
1. Query `coinNewsHistory` for rows where `price7dAfter IS NULL` AND `publishedAt < NOW() - 7 days` AND `priceAtTime IS NOT NULL`, limit 100
2. For each row:
   a. Calculate target date = `publishedAt + 7 days`
   b. Try `getBinancePriceAtDate(symbol + 'USDT', target)` → if null, try `getPriceWithFallback(symbol)`
   c. If both fail OR price is 0 → mark as rug pull (`isRugPull = true`, `price7dAfter = 0`)
   d. Calculate `priceChange7d` = `((price7d - priceAtTime) / priceAtTime * 100)` or `-100` for rug pulls
   e. Update the row: set `price7dAfter`, `priceChange7d`, `isRugPull`; if rug pull, set `sentiment = 'SCAM'`
3. Add 200ms sleep between each update (gentle on DB)

### Drizzle ORM Update Pattern:
```typescript
await db.update(coinNewsHistory)
    .set({
        price7dAfter: price7d,
        priceChange7d: change,
        isRugPull: isRugPull,
        sentiment: isRugPull ? 'SCAM' : undefined, // only override if rug pull
    })
    .where(eq(coinNewsHistory.id, row.id));
```

---

### Prompt for Senior AI — Task 4:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/temporalIntelligence.service.ts ===

IMPORTS:
```typescript
import Parser from 'rss-parser';
import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { eq, and, gte, isNotNull, desc, sql, lte } from 'drizzle-orm';
import { getBinancePriceAtDate } from './priceService';
import { getPriceWithFallback } from './priceService';
```

HELPER:
```typescript
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const parser = new Parser();
```

=== FUNCTION 1: fetchHistoricalNewsForCoins(coins: string[]): Promise<void> ===

Loop through coins:
1. Random delay: 2000 + Math.random() * 1000 ms
2. Call fetchCoinHistoricalNews(symbol, 'Other')
3. console.log progress

=== FUNCTION 2 (internal): fetchCoinHistoricalNews(symbol: string, eventType: string): Promise<void> ===

1. Build URL: `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' crypto ' + eventType)}&hl=en&gl=US&ceid=US:en`
2. Parse with parser.parseURL(url)
3. Take Math.min(items.length, 30)
4. For each item (with 500ms pause every 10):
   - Parse pubDate, get price at time via getBinancePriceAtDate(symbol + 'USDT', publishedAt)
   - Insert to coinNewsHistory via Drizzle:
     ```typescript
     await db.insert(coinNewsHistory).values({
         coinSymbol: symbol,
         title: item.title || '',
         source: sourceName,
         publishedAt: new Date(item.pubDate || ''),
         eventType: eventType,
         priceAtTime: priceAtTime,
     }).onConflictDoNothing();
     ```
   - onConflictDoNothing() uses the UNIQUE(coin_symbol, title, published_at) constraint
5. On catch: console.warn and continue (Google may block us — that's OK)

=== FUNCTION 3: buildTemporalPattern(symbol, eventType, severity): Promise<TemporalPattern | null> ===

INTERFACE:
```typescript
export interface TemporalPattern {
    eventType: string;
    severity: number;
    sampleSize: number;
    rugPullRate: string;
    bullishRate: string;
    avgOutcome7d: string;
    historicalCases: Array<{ date: string; headline: string; outcome: string }>;
}
```

QUERY:
```typescript
const rows = await db.select()
    .from(coinNewsHistory)
    .where(and(
        eq(coinNewsHistory.coinSymbol, symbol),
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventSeverity, severity),
        isNotNull(coinNewsHistory.price7dAfter),
        gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '180 days'`)
    ))
    .orderBy(desc(coinNewsHistory.publishedAt))
    .limit(5);
```

If rows.length === 0 → return null

CALCULATIONS:
- historicalCases = rows.map(r => ({ date: r.publishedAt.toISOString().split('T')[0], headline: r.title, outcome: r.isRugPull ? 'RUG PULL — token went to zero' : `${r.priceChange7d > 0 ? '+' : ''}${Number(r.priceChange7d).toFixed(1)}% in 7 days` }))
- live = rows.filter(r => !r.isRugPull)
- rugCount = rows.filter(r => r.isRugPull).length
- rugPullRate = `${Math.round(rugCount / rows.length * 100)}%`
- bullishRate = live.length ? `${Math.round(live.filter(r => Number(r.priceChange7d) > 0).length / live.length * 100)}%` : 'N/A'
- avgChange = live.length ? live.reduce((s, r) => s + (Number(r.priceChange7d) || 0), 0) / live.length : null
- avgOutcome7d = avgChange !== null ? `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%` : 'N/A'

Return TemporalPattern object.

=== FUNCTION 4: backfillPriceOutcomes(): Promise<void> ===

QUERY:
```typescript
const rows = await db.select({
    id: coinNewsHistory.id,
    coinSymbol: coinNewsHistory.coinSymbol,
    publishedAt: coinNewsHistory.publishedAt,
    priceAtTime: coinNewsHistory.priceAtTime,
}).from(coinNewsHistory)
    .where(and(
        isNotNull(coinNewsHistory.priceAtTime),
        lte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '7 days'`)
    ))
    .limit(100);
```

For each row where price7dAfter is null (filter in JS):
1. target = new Date(row.publishedAt); target.setDate(target.getDate() + 7)
2. price7d = await getBinancePriceAtDate(row.coinSymbol + 'USDT', target)
3. If !price7d: try getPriceWithFallback(row.coinSymbol)
   - If still null or price === 0: isRugPull = true, price7d = 0
   - Else: price7d = dex.price
4. change = isRugPull ? -100 : ((price7d - row.priceAtTime) / row.priceAtTime * 100)
5. Update DB:
   ```typescript
   await db.update(coinNewsHistory)
       .set({
           price7dAfter: price7d,
           priceChange7d: change,
           isRugPull: isRugPull,
           sentiment: isRugPull ? 'SCAM' : sql`coin_news_history.sentiment`, // keep existing unless rug pull
       })
       .where(eq(coinNewsHistory.id, row.id));
   ```
   IMPORTANT: Only set sentiment to 'SCAM' if isRugPull is true. For non-rug-pull rows, do NOT change sentiment.
   Use a conditional: if (isRugPull) { set sentiment: 'SCAM' } else { omit sentiment from set }
6. sleep(200) between iterations

Rules: ZERO `any` types. Use Drizzle ORM only. All errors caught and logged, never crash the pipeline.
```

---

## Phase 4 Completion Checklist

- [ ] `temporalIntelligence.service.ts` created with all 4 functions
- [ ] `fetchHistoricalNewsForCoins` has 2-3s random delay between coins
- [ ] `fetchCoinHistoricalNews` has 500ms micro-pause every 10 items
- [ ] `buildTemporalPattern` filters by severity and 180-day window
- [ ] `backfillPriceOutcomes` detects rug pulls and sets `sentiment = 'SCAM'`
- [ ] All DB operations use Drizzle ORM (no raw SQL)
- [ ] Zero `any` types
- [ ] Google News blocks handled gracefully (console.warn, continue)
