# PHASE 3 — Coin Intelligence Layer

> **Depends on:** Phase 1 (DB tables exist) + Phase 2 (data services built).
> **Goal:** Give DeepSeek "who is this coin" context before analysis.
> **New file:** `backend/src/services/coinIntelligence.service.ts`

---

## Task 3-A: Coin Intelligence Service

**New file:** `backend/src/services/coinIntelligence.service.ts`

### Interface:

```typescript
export interface CoinIntelligence {
    coinSymbol: string;
    ath: number | null;
    athDate: string | null;
    trend8w: 'uptrend' | 'downtrend' | 'sideways' | null;
    week52High: number | null;
    week52Low: number | null;
    priceChange30d: string | null;
    wikiBackground: string | null;
    dexBoostActive: boolean;
    dataSource: 'binance' | 'dexscreener' | 'unknown';
}
```

### Function: `getCoinIntelligence(symbol: string, tokenAddress?: string): Promise<CoinIntelligence>`

### Logic:

#### Step 1: Check DB cache (4-hour TTL) using Drizzle ORM
```typescript
import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { eq, gt, sql, and } from 'drizzle-orm';

const cached = await db.select()
    .from(coinIntelligenceCache)
    .where(and(
        eq(coinIntelligenceCache.coinSymbol, symbol),
        gt(coinIntelligenceCache.cachedAt, sql`NOW() - INTERVAL '4 hours'`)
    ))
    .limit(1);

if (cached.length > 0) {
    return {
        coinSymbol: cached[0].coinSymbol,
        ath: cached[0].ath,
        athDate: cached[0].athDate,
        trend8w: cached[0].trend8w as CoinIntelligence['trend8w'],
        week52High: cached[0].week52High,
        week52Low: cached[0].week52Low,
        priceChange30d: cached[0].priceChange30d,
        wikiBackground: cached[0].wikiBackground,
        dexBoostActive: cached[0].dexBoostActive,
        dataSource: (cached[0].dataSource as CoinIntelligence['dataSource']) ?? 'unknown',
    };
}
```

#### Step 2: Fetch fresh data in parallel using Promise.allSettled
```typescript
import { getPriceWithFallback, PriceResult } from './priceService';
import { getBinanceHistory, BinanceHistoryResult } from './binanceHistory.service';
import { getWikipediaBackground } from './wikipedia.service';

const [historyResult, wikiResult, priceResult] = await Promise.allSettled([
    getBinanceHistory(symbol),
    getWikipediaBackground(symbol),
    getPriceWithFallback(symbol, tokenAddress),
]);

const historyData: BinanceHistoryResult | null = historyResult.status === 'fulfilled' ? historyResult.value : null;
const wikiData: string | null = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
const priceData: PriceResult | null = priceResult.status === 'fulfilled' ? priceResult.value : null;
```

#### Step 3: Build the intelligence object
```typescript
const intel: CoinIntelligence = {
    coinSymbol: symbol,
    ath: historyData?.ath ?? null,
    athDate: historyData?.athDate ?? null,
    trend8w: historyData?.trend8w ?? null,
    week52High: historyData?.week52High ?? null,
    week52Low: historyData?.week52Low ?? null,
    priceChange30d: historyData?.priceChange30d ?? null,
    wikiBackground: wikiData ?? null,
    dexBoostActive: priceData?.source === 'dexscreener',
    dataSource: historyData ? 'binance' : priceData ? 'dexscreener' : 'unknown',
};
```

#### Step 4: Upsert to DB using Drizzle ORM
```typescript
await db.insert(coinIntelligenceCache)
    .values({
        coinSymbol: intel.coinSymbol,
        ath: intel.ath,
        athDate: intel.athDate,
        trend8w: intel.trend8w,
        week52High: intel.week52High,
        week52Low: intel.week52Low,
        priceChange30d: intel.priceChange30d ? parseFloat(intel.priceChange30d) : null,
        wikiBackground: intel.wikiBackground,
        dexBoostActive: intel.dexBoostActive,
        dataSource: intel.dataSource,
    })
    .onConflictDoUpdate({
        target: coinIntelligenceCache.coinSymbol,
        set: {
            ath: intel.ath,
            athDate: intel.athDate,
            trend8w: intel.trend8w,
            week52High: intel.week52High,
            week52Low: intel.week52Low,
            priceChange30d: intel.priceChange30d ? parseFloat(intel.priceChange30d) : null,
            wikiBackground: intel.wikiBackground,
            dexBoostActive: intel.dexBoostActive,
            dataSource: intel.dataSource,
            cachedAt: sql`NOW()`,
        },
    });
```

### Important Notes:
- `priceChange30d` is stored as `string` in `BinanceHistoryResult` but `real` in the DB column — parse with `parseFloat()` before insert
- `trend8w` is stored as `varchar` in DB, so no conversion needed
- Use `and()` from drizzle-orm for the cache TTL check
- The `cachedAt` timestamp is auto-set by `.defaultNow()` on insert, but must be manually set with `sql\`NOW()\`` on conflict update

---

### Prompt for Senior AI — Task 3-A:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/coinIntelligence.service.ts ===

IMPORTS:
```typescript
import { db } from '../config/db';
import { coinIntelligenceCache } from '../models/market.model';
import { eq, gt, sql, and } from 'drizzle-orm';
import { getPriceWithFallback, type PriceResult } from './priceService';
import { getBinanceHistory, type BinanceHistoryResult } from './binanceHistory.service';
import { getWikipediaBackground } from './wikipedia.service';
```

EXPORTED INTERFACE:
```typescript
export interface CoinIntelligence {
    coinSymbol: string;
    ath: number | null;
    athDate: string | null;
    trend8w: 'uptrend' | 'downtrend' | 'sideways' | null;
    week52High: number | null;
    week52Low: number | null;
    priceChange30d: string | null;
    wikiBackground: string | null;
    dexBoostActive: boolean;
    dataSource: 'binance' | 'dexscreener' | 'unknown';
}
```

EXPORTED FUNCTION: getCoinIntelligence(symbol: string, tokenAddress?: string): Promise<CoinIntelligence>

STEP 1 - Cache check (4-hour TTL):
- db.select().from(coinIntelligenceCache).where(and(eq(coinIntelligenceCache.coinSymbol, symbol), gt(coinIntelligenceCache.cachedAt, sql`NOW() - INTERVAL '4 hours'`))).limit(1)
- If cached.length > 0, return mapped CoinIntelligence object (cast trend8w and dataSource properly)

STEP 2 - Parallel fetch:
- Promise.allSettled([getBinanceHistory(symbol), getWikipediaBackground(symbol), getPriceWithFallback(symbol, tokenAddress)])
- Extract fulfilled values with null fallback

STEP 3 - Build object:
```typescript
const intel: CoinIntelligence = {
    coinSymbol: symbol,
    ath: historyData?.ath ?? null,
    athDate: historyData?.athDate ?? null,
    trend8w: historyData?.trend8w ?? null,
    week52High: historyData?.week52High ?? null,
    week52Low: historyData?.week52Low ?? null,
    priceChange30d: historyData?.priceChange30d ?? null,
    wikiBackground: wikiData ?? null,
    dexBoostActive: priceData?.source === 'dexscreener',
    dataSource: historyData ? 'binance' : priceData ? 'dexscreener' : 'unknown',
};
```

STEP 4 - Upsert with Drizzle:
- db.insert(coinIntelligenceCache).values({...}).onConflictDoUpdate({ target: coinIntelligenceCache.coinSymbol, set: { ...all fields..., cachedAt: sql\`NOW()\` } })
- IMPORTANT: priceChange30d is a string from BinanceHistoryResult but `real` in DB → use parseFloat() before insert

STEP 5 - Return intel

Rules: ZERO `any` types. Use Drizzle ORM only (no raw SQL queries). All error handling at the Promise.allSettled level — no try/catch needed inside.
```

---

## Phase 3 Completion Checklist

- [ ] `coinIntelligence.service.ts` created with exported `CoinIntelligence` interface and `getCoinIntelligence()` function
- [ ] Cache check uses Drizzle ORM with 4-hour TTL filter
- [ ] Parallel fetch uses `Promise.allSettled` (never crashes on individual failures)
- [ ] DB upsert uses `onConflictDoUpdate` with `cachedAt: sql\`NOW()\``
- [ ] `priceChange30d` parsed with `parseFloat()` before DB insert
- [ ] Zero `any` types
- [ ] Manual test: calling `getCoinIntelligence('SOL')` returns cached data on second call
