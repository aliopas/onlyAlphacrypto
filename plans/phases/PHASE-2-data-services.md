# PHASE 2 — Data Services Layer

> **Depends on:** Phase 0 + Phase 1.
> **Goal:** Build all data-fetching services in isolation before wiring them together.
> **New files:** `priceService.ts`, `binanceHistory.service.ts`, `wikipedia.service.ts`
> **Modified:** `server.ts` (health endpoint)

---

## Task 2-A: Price Service (Binance → DexScreener Fallback)

**New file:** `backend/src/services/priceService.ts`

### Interface:

```typescript
export interface PriceResult {
    source: 'binance' | 'dexscreener';
    price: number;
    change24h: number | null;
    volume24h: number | null;
    high24h?: number | null;
    low24h?: number | null;
    liquidity?: number | null;
}
```

### Functions:

#### `getPriceWithFallback(symbol: string, tokenAddress?: string): Promise<PriceResult | null>`

**Logic:**
1. Try Binance: `GET https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`
   - `AbortSignal.timeout(5000)`
   - Parse: `lastPrice`, `priceChangePercent`, `volume`, `highPrice`, `lowPrice`
   - If `res.ok` and `lastPrice > 0` → return with `source: 'binance'`
2. If Binance fails, wait 300ms (`sleep(300)`)
3. Try DexScreener:
   - If `tokenAddress` provided: `GET https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`
   - Else: `GET https://api.dexscreener.com/latest/dex/search?q=${symbol}`
   - `AbortSignal.timeout(5000)`
   - Sort pairs by liquidity descending, pick the first one
   - Parse: `priceUsd`, `priceChange.h24`, `volume.h24`, `liquidity.usd`
4. If both fail → return `null`

#### `getBinancePriceAtDate(pair: string, date: Date): Promise<number | null>`

**Logic:**
1. `GET https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&startTime=${start}&endTime=${end}&limit=1`
2. `start = date.getTime()`, `end = start + 3_600_000` (+1 hour window)
3. `AbortSignal.timeout(5000)`
4. Return `data[0][4]` (close price) as number, or `null` on failure

### Rules:
- Use native `fetch()` only (no axios)
- `AbortSignal.timeout()` for all requests
- All errors caught silently with `console.warn()`
- ZERO `any` types — use explicit interfaces for Binance/DexScreener responses

---

### Prompt for Senior AI — Task 2-A:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/priceService.ts ===

Create a price service with Binance primary + DexScreener fallback. Requirements:

INTERFACES:
```typescript
interface BinanceTickerResponse {
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    highPrice: string;
    lowPrice: string;
}

interface DexScreenerPair {
    priceUsd?: string;
    priceChange?: { h24?: number };
    volume?: { h24?: number | null };
    liquidity?: { usd?: number | null };
}

interface DexScreenerResponse {
    pairs?: DexScreenerPair[];
}

export interface PriceResult {
    source: 'binance' | 'dexscreener';
    price: number;
    change24h: number | null;
    volume24h: number | null;
    high24h?: number | null;
    low24h?: number | null;
    liquidity?: number | null;
}
```

FUNCTION 1: getPriceWithFallback(symbol: string, tokenAddress?: string): Promise<PriceResult | null>

Step 1: Try Binance
- URL: https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}USDT
- Options: { signal: AbortSignal.timeout(5000) }
- On success (res.ok): parse as BinanceTickerResponse
  - Validate parseFloat(d.lastPrice) > 0
  - Return PriceResult with source: 'binance'
- On failure: fall through (no throw)

Step 2: sleep(300) then try DexScreener
- URL: tokenAddress ? `https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}` : `https://api.dexscreener.com/latest/dex/search?q=${symbol}`
- Options: { signal: AbortSignal.timeout(5000) }
- Parse as DexScreenerResponse
- Sort pairs by (liquidity?.usd ?? 0) descending, take first
- Validate pair.priceUsd exists and parseFloat > 0
- Return PriceResult with source: 'dexscreener'

Step 3: If both fail, return null

FUNCTION 2: getBinancePriceAtDate(pair: string, date: Date): Promise<number | null>
- URL: https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&startTime=${start}&endTime=${end}&limit=1
- start = date.getTime(), end = start + 3600000
- Return parseFloat(data[0][4]) or null

HELPERS:
- const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
- Export sleep if needed by other services

Rules: Use native fetch() only. ZERO `any` types. Use explicit response interfaces. All errors caught silently.
```

---

## Task 2-B: Binance Historical Intelligence

**New file:** `backend/src/services/binanceHistory.service.ts`

### Interface:

```typescript
export interface BinanceHistoryResult {
    source: 'binance';
    ath: number;
    athDate: string;
    week52High: number;
    week52Low: number;
    trend8w: 'uptrend' | 'downtrend' | 'sideways';
    priceChange30d: string;
}
```

### Function: `getBinanceHistory(symbol: string): Promise<BinanceHistoryResult | null>`

**Logic:**
1. `GET https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=200`
2. `AbortSignal.timeout(8000)`
3. Parse klines array: each element is `number[]` — index 0=open time, 2=high, 3=low, 4=close
4. Calculate: ATH, ATH date, 52-week high/low (last 52 entries), 8-week trend, 30d price change

### Helper Functions (private):

```typescript
function calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways'
// change > 5% → uptrend, change < -5% → downtrend, else sideways

function pctChange(from: number, to: number): string
// Returns formatted percentage string like "5.2" or "-3.1"
```

---

### Prompt for Senior AI — Task 2-B:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/binanceHistory.service.ts ===

INTERFACES:
```typescript
interface BinanceKline {
    0: number;  // open time
    1: string;  // open
    2: string;  // high
    3: string;  // low
    4: string;  // close
}

export interface BinanceHistoryResult {
    source: 'binance';
    ath: number;
    athDate: string;
    week52High: number;
    week52Low: number;
    trend8w: 'uptrend' | 'downtrend' | 'sideways';
    priceChange30d: string;
}
```

FUNCTION: getBinanceHistory(symbol: string): Promise<BinanceHistoryResult | null>

1. pair = symbol.toUpperCase() + 'USDT'
2. Fetch: https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=200
3. signal: AbortSignal.timeout(8000)
4. Parse as BinanceKline[] (number[][] from API, cast properly)
5. Extract: highs = data.map(k => parseFloat(k[2])), lows = data.map(k => parseFloat(k[3])), closes = data.map(k => parseFloat(k[4]))
6. athIdx = highs.indexOf(Math.max(...highs))
7. Return:
   - ath: Math.max(...highs)
   - athDate: new Date(data[athIdx][0]).toISOString().split('T')[0]
   - week52High: Math.max(...highs.slice(-52))
   - week52Low: Math.min(...lows.slice(-52))
   - trend8w: calcTrend(closes.slice(-8))
   - priceChange30d: pctChange(closes[closes.length - 5], closes[closes.length - 1])
8. If data.length < 5, return null (not enough history)

PRIVATE HELPERS:
- calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways'
  change = (last - first) / first * 100; >5 uptrend, <-5 downtrend, else sideways
- pctChange(from: number, to: number): string
  ((to - from) / from * 100).toFixed(1)

Rules: Use native fetch() only. ZERO `any` types. Cast kline array elements properly.
```

---

## Task 2-C: Wikipedia Background

**New file:** `backend/src/services/wikipedia.service.ts`

### Function: `getWikipediaBackground(coinName: string): Promise<string | null>`

**Logic:**
1. Try 3 URL variants in order:
   - `${coinName}_(blockchain)`
   - `${coinName}_(cryptocurrency)`
   - `${coinName}`
2. For each: `GET https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`
3. `AbortSignal.timeout(4000)`
4. If `res.ok`: parse JSON, get `data.extract`
5. Split by `. ` (period + space), take first 3 sentences, rejoin with `. `
6. Append `.` at the end
7. If all 3 fail → return `null`

---

### Prompt for Senior AI — Task 2-C:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/wikipedia.service.ts ===

INTERFACE:
```typescript
interface WikipediaSummaryResponse {
    extract?: string;
}
```

FUNCTION: getWikipediaBackground(coinName: string): Promise<string | null>

1. Define variants array: [`${coinName}_(blockchain)`, `${coinName}_(cryptocurrency)`, coinName]
2. Loop through variants with for...of
3. For each variant:
   - URL: https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}
   - Options: { signal: AbortSignal.timeout(4000) }
   - Parse as WikipediaSummaryResponse
   - If res.ok and data.extract exists:
     - Split by '. ' → take first 3 elements → join with '. ' → append '.'
     - Return the result
   - On error: continue to next variant
4. If all 3 fail: return null

Rules: Use native fetch() only. ZERO `any` types.
```

---

## Task 2-D: Health Check Endpoint

**File:** `backend/src/server.ts`

### Change:

Add a health check endpoint BEFORE `app.use('/api', routes)` (which is on line 40). Insert between lines 38 and 40:

```typescript
app.get('/api/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});
```

Note: `testConnection` is already imported on line 5 of `server.ts`.

---

### Prompt for Senior AI — Task 2-D:

```
You are the Senior Developer for OnlyAlpha. Make a small modification.

=== FILE: backend/src/server.ts ===

ADD a health check endpoint BEFORE the `app.use('/api', routes)` line (line 40).

Insert between the "API Routes" comment (line 38) and the routes line (line 40):

```typescript
app.get('/api/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});
```

Note: `testConnection` is already imported on line 5. Do NOT add any new imports.

Rules: Do not modify any other lines. Place the endpoint BEFORE routes so it's not caught by the 404 handler.
```

---

## Phase 2 Completion Checklist

- [ ] `priceService.ts` created with `getPriceWithFallback()` and `getBinancePriceAtDate()`
- [ ] `binanceHistory.service.ts` created with `getBinanceHistory()`, `calcTrend()`, `pctChange()`
- [ ] `wikipedia.service.ts` created with `getWikipediaBackground()`
- [ ] Health endpoint added to `server.ts` before routes
- [ ] All services use native `fetch()` with `AbortSignal.timeout()`
- [ ] Zero `any` types across all 3 new files
- [ ] Manual test: `curl localhost:5000/api/health` returns `{ status: 'ok', db: 'connected' }`
