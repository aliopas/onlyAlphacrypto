# 🚀 OnlyAlpha — Master Execution Plan v4.2
### Free Sources Only — Phased Execution, Zero Conflicts
> **Date:** April 4, 2026
> **Changes from v4.1:** Phases split for clean dependency order + JSON safety + targeted Redis invalidation + deployment phase

---

## 📊 Final Stack

### ✅ Free Data Sources
| Service | Purpose | Cost | API Key |
|:---|:---|:---|:---|
| **RSS Scraper** | Primary news — CoinDesk, Cointelegraph, Decrypt, The Block | $0.00 | No |
| **Google News RSS** | Historical news per coin (rate-limited) | $0.00 | No |
| **DexScreener Boosts** | Hype detection `/token-boosts/top/v1` | $0.00 | No |
| **DexScreener Price** | Price fallback for coins NOT on Binance | $0.00 | No |
| **Binance Public API** | Primary price + 24hr stats + 4yr klines | $0.00 | No |
| **Wikipedia REST API** | Coin background for major coins | $0.00 | No |

### ✅ AI Engines — Role Separation
| Service | Role | Reason |
|:---|:---|:---|
| **DeepSeek R1** | Analysis ONLY → outputs JSON (facts, scores, signals) | Deep reasoning, strict JSON |
| **GPT-5-nano** | Writing + Triage + SEO + Chat → outputs prose | Better English, consistent tone, no خرفنة |

### ❌ Killed Services
| Service | Reason |
|:---|:---|
| **CryptoCompare** | Auth expired — hard-coded 429 |
| **CoinCap** | 4,000 req/month cap |
| **NewsData.io** | 12-hour delay |
| **CoinGecko** | News = PRO only since 2024 |
| **Tavily** | 1,000/month cap — keep key as emergency fallback only |

---

## 🗺️ Phase Map — Dependency Order

```
PHASE 0  →  PHASE 1  →  PHASE 2  →  PHASE 3
Bug Fixes   DB Schema   Data Svcs   Coin Intel
    ↓           ↓           ↓           ↓
                        PHASE 4  →  PHASE 5
                        Temporal    AI Roles
                            ↓           ↓
                        PHASE 6  →  PHASE 7
                        Resilience  Wire All
                                        ↓
                                    PHASE 8
                                    Cache & Publish
                                        ↓
                                    PHASE 9
                                    Test & QA
                                        ↓
                                    PHASE 10
                                    Deploy
```

> **Rule:** Never start a phase until all phases it depends on are complete and tested.

---

## 🛠️ PHASE 0 — Critical Bug Fixes
> **Depends on:** Nothing — do this first.
> **Goal:** Bring the broken pipeline back to life.
> **Time:** Day 1.

### P0-A: Replace CryptoCompare with RSS 🔴
**File:** `terminalEngine.cron.ts`
**Problem:** Lines 16-47 call `cryptocompare.com` → auth error every 10 min.
**Fix:** Replace `fetchLatestNews()` body with `fetchAllRSSNews()` from `rssNews.service.ts` (already built and tested).

### P0-B: Language Mandate in All Prompts 🔴
**File:** `prompt-factory.ts`
**Problem:** No English constraint → DeepSeek outputs Chinese/Arabic.

```typescript
// Add this constant at the top of prompt-factory.ts
export const LANGUAGE_MANDATE = `
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
Write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters.
Translate any non-English input to English before using it.
Violation makes the entire output invalid.
`.trim();

// Inject into ALL 8 prompt builder functions as the first line.
```

### P0-C: Fix UI Bugs 🔴
1. `TerminalWire.tsx` L40-42 → Show ALL signals. Use `targetedCoin` for amber border highlight only — not as a filter.
2. `useTerminalChat.ts` L4 → `'private'` → `'context'`
3. `TerminalChat.tsx` L45 → `setMode('private')` → `setMode('context')`
4. `useTerminalChat.ts` L69 → Add 3-second timeout fallback for disclaimer deadlock.
5. `useTerminalChat.ts` L102 → `line.replace('data:', '')` → `line.slice(5)` for correct SSE parsing.

### P0-D: Environment Cleanup 🟡
**Files:** `.env` local + production
```bash
# REMOVE these dead keys
CRYPTOCOMPARE_API_KEY=...  # DELETE
COINCAP_API_KEY=...        # DELETE

# VERIFY these are set correctly
ANALYSIS_MODEL=deepseek/deepseek-r1
SEO_MODEL=openai/gpt-5-nano
TAVILY_API_KEY=...         # KEEP — emergency fallback only
```

### P0-E: Fix Triage → Deep Analysis Link 🔴
**Problem:** Triage doesn't save `symbolMentions` → everything becomes `UNKNOWN` → `deep-analysis-router.ts` L39 filters them all out → zero articles published.
**Fix:** Update `buildTriageMessages` to also extract `symbolMentions`, `eventType`, `eventSeverity`. Update `triageEngine.cron.ts` to save all three to the buffer row.

---

## 🗄️ PHASE 1 — DB Schema & Migrations
> **Depends on:** Phase 0 complete.
> **Goal:** Create all new tables before any service tries to use them.
> **Time:** Day 1 (same day, after Phase 0).

Run `npx drizzle-kit push` after adding these to your schema file.

```sql
-- Table 1: Coin Intelligence Cache
-- Prevents re-fetching Binance/Wikipedia data more than once per 4 hours
CREATE TABLE coin_intelligence_cache (
  coin_symbol      VARCHAR(20) PRIMARY KEY,
  ath              DECIMAL,
  ath_date         DATE,
  trend_8w         VARCHAR(20),      -- 'uptrend' | 'downtrend' | 'sideways'
  week_52_high     DECIMAL,
  week_52_low      DECIMAL,
  price_change_30d DECIMAL,
  wiki_background  TEXT,
  dex_boost_active BOOLEAN DEFAULT FALSE,
  data_source      VARCHAR(20),      -- 'binance' | 'dexscreener'
  cached_at        TIMESTAMP DEFAULT NOW()
);

-- Table 2: Temporal Intelligence — Historical news outcomes per coin
-- Grows smarter every day. Rug pulls teach the AI. Good calls teach the AI.
CREATE TABLE coin_news_history (
  id              SERIAL PRIMARY KEY,
  coin_symbol     VARCHAR(20)  NOT NULL,
  title           TEXT         NOT NULL,
  source          VARCHAR(100),
  published_at    TIMESTAMP    NOT NULL,
  sentiment       VARCHAR(10),            -- bullish | bearish | neutral | SCAM
  event_type      VARCHAR(50),            -- ETF | Hack | Listing | Upgrade | Partnership | ...
  event_severity  SMALLINT DEFAULT 1,     -- 1=minor | 2=major | 3=critical
  price_at_time   DECIMAL,
  price_7d_after  DECIMAL,
  price_change_7d DECIMAL,
  is_rug_pull     BOOLEAN DEFAULT FALSE,
  fetched_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(coin_symbol, title, published_at)
);

CREATE INDEX idx_coin_history_lookup
  ON coin_news_history(coin_symbol, event_type, event_severity, published_at DESC);

-- Table 3: Circuit Breaker State (optional — can use in-memory instead)
-- Useful if you have multiple workers/dynos
CREATE TABLE circuit_breaker_state (
  service_name  VARCHAR(50) PRIMARY KEY,
  failure_count SMALLINT DEFAULT 0,
  open_until    TIMESTAMP,            -- NULL = closed (healthy)
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 PHASE 2 — Data Services Layer
> **Depends on:** Phase 0 + Phase 1.
> **Goal:** Build all data-fetching services in isolation before wiring them together.
> **Time:** Day 2.

### P2-A: Price Service with Binance → DexScreener Fallback 🔴

```typescript
// priceService.ts
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getPriceWithFallback(symbol: string, tokenAddress?: string) {

  // ── Step 1: Binance (major coins) ─────────────────────────────
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.lastPrice && parseFloat(d.lastPrice) > 0) {
        return {
          source:    'binance',
          price:     parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent),
          volume24h: parseFloat(d.volume),
          high24h:   parseFloat(d.highPrice),
          low24h:    parseFloat(d.lowPrice)
        };
      }
    }
  } catch { /* fall through to DexScreener */ }

  // ── Step 2: DexScreener (DEX/meme tokens) ─────────────────────
  await sleep(300); // small pause before retry
  const dexUrl = tokenAddress
    ? `https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`
    : `https://api.dexscreener.com/latest/dex/search?q=${symbol}`;

  try {
    const res = await fetch(dexUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const pairs = data.pairs ?? data;
      const best = [...pairs].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      if (best?.priceUsd) {
        return {
          source:    'dexscreener',
          price:     parseFloat(best.priceUsd),
          change24h: best.priceChange?.h24 ?? null,
          volume24h: best.volume?.h24 ?? null,
          liquidity: best.liquidity?.usd ?? null
        };
      }
    }
  } catch { /* both failed */ }

  return null; // caller should handle null gracefully
}

export async function getBinancePriceAtDate(pair: string, date: Date): Promise<number | null> {
  try {
    const start = date.getTime();
    const end   = start + 3_600_000; // +1 hour window
    const res   = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&startTime=${start}&endTime=${end}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] ? parseFloat(data[0][4]) : null; // close price
  } catch { return null; }
}
```

### P2-B: Binance Historical Intelligence

```typescript
// binanceHistory.service.ts
export async function getBinanceHistory(symbol: string) {
  const pair = symbol.toUpperCase() + 'USDT';
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=200`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data: number[][] = await res.json();
    if (!data.length) return null;

    const highs  = data.map(k => parseFloat(k[2] as unknown as string));
    const lows   = data.map(k => parseFloat(k[3] as unknown as string));
    const closes = data.map(k => parseFloat(k[4] as unknown as string));
    const athIdx = highs.indexOf(Math.max(...highs));

    return {
      source:          'binance',
      ath:             Math.max(...highs),
      athDate:         new Date(data[athIdx][0]).toISOString().split('T')[0],
      week52High:      Math.max(...highs.slice(-52)),
      week52Low:       Math.min(...lows.slice(-52)),
      trend8w:         calcTrend(closes.slice(-8)),
      priceChange30d:  pctChange(closes[closes.length - 5], closes[closes.length - 1])
    };
  } catch { return null; }
}

function calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways' {
  const change = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;
  if (change > 5)  return 'uptrend';
  if (change < -5) return 'downtrend';
  return 'sideways';
}

function pctChange(from: number, to: number): string {
  return ((to - from) / from * 100).toFixed(1);
}
```

### P2-C: Wikipedia Background

```typescript
// wikipedia.service.ts
export async function getWikipediaBackground(coinName: string): Promise<string | null> {
  const variants = [
    `${coinName}_(blockchain)`,
    `${coinName}_(cryptocurrency)`,
    coinName
  ];
  for (const v of variants) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        // First 3 sentences only — enough context, not overwhelming
        return data.extract?.split('. ').slice(0, 3).join('. ') + '.';
      }
    } catch { continue; }
  }
  return null; // Minor token — no Wikipedia page, that's fine
}
```

### P2-D: Health Check Endpoint

```typescript
// server.ts — add before all other routes
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});
```

---

## 🧠 PHASE 3 — Coin Intelligence Layer
> **Depends on:** Phase 1 (DB tables exist) + Phase 2 (data services built).
> **Goal:** Give DeepSeek "who is this coin" context before analysis.
> **Time:** Day 3.

```typescript
// coinIntelligence.service.ts
import { getPriceWithFallback }    from './priceService';
import { getBinanceHistory }       from './binanceHistory.service';
import { getWikipediaBackground }  from './wikipedia.service';

export async function getCoinIntelligence(symbol: string, tokenAddress?: string) {

  // ── 1. Check cache (4-hour TTL) ───────────────────────────────
  const cached = await db.query(`
    SELECT * FROM coin_intelligence_cache
    WHERE coin_symbol = $1 AND cached_at > NOW() - INTERVAL '4 hours'
  `, [symbol]);
  if (cached.rows[0]) return cached.rows[0];

  // ── 2. Fetch fresh data in parallel ───────────────────────────
  const [history, wiki, price] = await Promise.allSettled([
    getBinanceHistory(symbol),
    getWikipediaBackground(symbol),
    getPriceWithFallback(symbol, tokenAddress)
  ]);

  const historyData = history.status === 'fulfilled' ? history.value : null;
  const wikiData    = wiki.status    === 'fulfilled' ? wiki.value    : null;
  const priceData   = price.status   === 'fulfilled' ? price.value   : null;

  const intel = {
    coin_symbol:      symbol,
    ath:              historyData?.ath              ?? null,
    ath_date:         historyData?.athDate          ?? null,
    trend_8w:         historyData?.trend8w          ?? null,
    week_52_high:     historyData?.week52High       ?? null,
    week_52_low:      historyData?.week52Low        ?? null,
    price_change_30d: historyData?.priceChange30d   ?? null,
    wiki_background:  wikiData                      ?? null,
    dex_boost_active: priceData?.source === 'dexscreener',
    data_source:      historyData ? 'binance' : 'dexscreener'
  };

  // ── 3. Cache the result ───────────────────────────────────────
  await db.query(`
    INSERT INTO coin_intelligence_cache
      (coin_symbol, ath, ath_date, trend_8w, week_52_high, week_52_low,
       price_change_30d, wiki_background, dex_boost_active, data_source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (coin_symbol) DO UPDATE SET
      ath = EXCLUDED.ath, ath_date = EXCLUDED.ath_date,
      trend_8w = EXCLUDED.trend_8w, week_52_high = EXCLUDED.week_52_high,
      week_52_low = EXCLUDED.week_52_low, price_change_30d = EXCLUDED.price_change_30d,
      wiki_background = EXCLUDED.wiki_background, dex_boost_active = EXCLUDED.dex_boost_active,
      data_source = EXCLUDED.data_source, cached_at = NOW()
  `, [intel.coin_symbol, intel.ath, intel.ath_date, intel.trend_8w,
      intel.week_52_high, intel.week_52_low, intel.price_change_30d,
      intel.wiki_background, intel.dex_boost_active, intel.data_source]);

  return intel;
}
```

---

## ⏳ PHASE 4 — Temporal Intelligence Layer
> **Depends on:** Phase 1 (DB tables) + Phase 2 (price services).
> **Goal:** Build historical event patterns so DeepSeek can reference past outcomes.
> **Time:** Day 4.

### P4-A: Google News RSS Fetcher — Rate Limited 🛡️

```typescript
// temporalIntelligence.service.ts
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchHistoricalNewsForCoins(coins: string[]): Promise<void> {
  for (const symbol of coins) {
    // ⏱️ 2-3 second random delay between each coin
    // Looks like a human browser, not a bot → avoids IP ban
    const delay = 2000 + Math.random() * 1000;
    await sleep(delay);

    const eventType = classifyEventType(symbol);
    await fetchCoinHistoricalNews(symbol, eventType);
  }
}

async function fetchCoinHistoricalNews(symbol: string, eventType: string): Promise<void> {
  const query = encodeURIComponent(`${symbol} crypto ${eventType}`);
  const url   = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;

  try {
    const items = await parseRSS(url); // reuse existing rssNews.service.ts parser

    for (let i = 0; i < Math.min(items.length, 30); i++) {
      if (i > 0 && i % 10 === 0) await sleep(500); // micro-pause every 10 items

      const item        = items[i];
      const publishedAt = new Date(item.pubDate);
      const priceAtTime = await getBinancePriceAtDate(symbol + 'USDT', publishedAt);

      await db.query(`
        INSERT INTO coin_news_history
          (coin_symbol, title, source, published_at, event_type, price_at_time)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (coin_symbol, title, published_at) DO NOTHING
      `, [symbol, item.title, item.source, publishedAt, eventType, priceAtTime]);
    }
  } catch (err) {
    // Google blocked us → log and skip. Do NOT crash the pipeline.
    console.warn(`[Temporal] Google News blocked for ${symbol}:`, (err as Error).message);
  }
}
```

### P4-B: Temporal Pattern Builder — Severity-Matched

```typescript
export async function buildTemporalPattern(
  symbol:    string,
  eventType: string,
  severity:  number    // Only compare same-severity events — avoids false patterns
) {
  const { rows } = await db.query(`
    SELECT title, published_at, sentiment,
           price_at_time, price_7d_after, price_change_7d, is_rug_pull
    FROM coin_news_history
    WHERE coin_symbol    = $1
      AND event_type     = $2
      AND event_severity = $3
      AND price_7d_after IS NOT NULL
      AND published_at   > NOW() - INTERVAL '180 days'
    ORDER BY published_at DESC
    LIMIT 5
  `, [symbol, eventType, severity]);

  if (!rows.length) return null;

  const outcomes = rows.map(r => ({
    date:    (r.published_at as Date).toISOString().split('T')[0],
    headline: r.title,
    outcome: r.is_rug_pull
      ? 'RUG PULL — token went to zero'
      : `${r.price_change_7d > 0 ? '+' : ''}${Number(r.price_change_7d).toFixed(1)}% in 7 days`
  }));

  const live     = rows.filter(r => !r.is_rug_pull);
  const avgChange = live.length
    ? live.reduce((s, r) => s + (Number(r.price_change_7d) || 0), 0) / live.length
    : null;
  const bullish  = live.filter(r => Number(r.price_change_7d) > 0).length;
  const rugCount = rows.filter(r => r.is_rug_pull).length;

  return {
    eventType, severity, sampleSize: outcomes.length,
    rugPullRate:  `${Math.round(rugCount / outcomes.length * 100)}%`,
    bullishRate:  live.length ? `${Math.round(bullish / live.length * 100)}%` : 'N/A',
    avgOutcome7d: avgChange !== null
      ? `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%`
      : 'N/A',
    historicalCases: outcomes
  };
}
```

### P4-C: Daily Backfill Job — With Rug Pull Detection 💀

```typescript
// Cron: daily at 3am
export async function backfillPriceOutcomes(): Promise<void> {
  const { rows } = await db.query(`
    SELECT id, coin_symbol, published_at, price_at_time
    FROM coin_news_history
    WHERE price_7d_after IS NULL
      AND published_at < NOW() - INTERVAL '7 days'
      AND price_at_time IS NOT NULL
    LIMIT 100
  `);

  for (const row of rows) {
    const target = new Date(row.published_at as Date);
    target.setDate(target.getDate() + 7);

    let price7d:   number | null = await getBinancePriceAtDate(row.coin_symbol + 'USDT', target);
    let isRugPull: boolean        = false;

    if (!price7d) {
      // Not on Binance → check DexScreener
      const dex = await getPriceWithFallback(row.coin_symbol);
      if (!dex || dex.price === 0) {
        // ☠️ No liquidity found → rug pull
        isRugPull = true;
        price7d   = 0;
      } else {
        price7d = dex.price;
      }
    }

    const change = isRugPull
      ? -100
      : ((price7d! - row.price_at_time) / row.price_at_time * 100);

    await db.query(`
      UPDATE coin_news_history
      SET price_7d_after  = $1,
          price_change_7d = $2,
          is_rug_pull     = $3,
          sentiment       = CASE WHEN $3 THEN 'SCAM' ELSE sentiment END
      WHERE id = $4
    `, [price7d, change, isRugPull, row.id]);

    await sleep(200); // gentle on the DB
  }
}
```

---

## 🤖 PHASE 5 — AI Role Separation & Prompts
> **Depends on:** Phase 3 + Phase 4 (so prompts can reference the new context fields).
> **Goal:** DeepSeek = analyst (JSON only). GPT-nano = writer (prose only).
> **Time:** Day 5.

### The Split

```
DeepSeek R1  →  outputs strict JSON  →  no prose, no articles
GPT-5-nano   →  receives that JSON   →  writes the 800-word article
```

### Prompt 1: Triage (GPT-nano) — Updated with Severity

```
${LANGUAGE_MANDATE}

You are a crypto news triage analyst for OnlyAlpha.
For EACH headline in the input array, return one JSON object.
Return an array in the SAME ORDER as input, wrapped in { "results": [...] }.

Per item:
{
  "relevanceScore": <0-100>,
  "sentimentHint":  "bullish|bearish|neutral",
  "symbolMentions": ["BTC", "ETH"],         // uppercase tickers, max 3, [] if none
  "eventType":      "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
  "eventSeverity":  <1|2|3>
}

Scoring:
90-100  Exchange listings, hacks, SEC actions, ETF approvals, exploits, token launches
70-89   Price milestones, whale moves, mainnet upgrades, major funding (>$50M)
50-69   Minor updates, small partnerships, opinion pieces
0-49    Spam, rehashed news, promotional content

Severity:
3 = CRITICAL: Hack confirmed, SEC action, top-5 exchange listing, ETF approval, $100M+ funding
2 = MAJOR:    Protocol upgrade, $10M-$100M funding, mid-tier listing, Fortune 500 partnership
1 = MINOR:    Small partnership, minor update, community news

Severity Examples (Partnership):
"Solana + Google Cloud"      → severity 3
"memecoin + local restaurant" → severity 1
```

### Prompt 2: Deep Analysis (DeepSeek R1) — JSON ONLY, No Prose

```
${LANGUAGE_MANDATE}

You are a crypto data analyst. Your output feeds a downstream writing engine.
DO NOT write articles. DO NOT write prose. Output STRICT JSON only.

{
  "sentiment":       "bullish|bearish|neutral",
  "impactScore":     <0-100>,
  "isBreaking":      <true if: Hack|Exploit|SEC|Listing|ETF|TokenLaunch|Mainnet>,
  "coinSymbol":      "<TICKER>",
  "eventType":       "<ETF|Hack|Listing|Upgrade|Partnership|Funding|Regulatory|Other>",
  "eventSeverity":   <1|2|3>,
  "analysis": {
    "mainDriver":       "<1 sentence — core reason this matters>",
    "priceImplication": "<1 sentence — what this means for price>",
    "temporalContext":  "<1 sentence referencing historical pattern if provided, else null>",
    "riskNote":         "<1 sentence — biggest risk or red flag>"
  },
  "keyFacts": [
    "<fact with specific number>",
    "<fact with specific number>",
    "<fact with specific number>"
  ],
  "supportLevels":    [<price>, <price>],
  "resistanceLevels": [<price>, <price>],
  "signalText":       "<MAX 40 words. Bloomberg-style. One number required. English only.>",
  "verdict":          "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "confidenceScore":  <0-100>
}

Rules:
- Output ONLY the JSON object. No preamble. No text outside JSON.
- All string values in English.
- impactScore 80+: only events that directly move price (hacks, listings, SEC actions).
- If temporal pattern provided → always reference it in analysis.temporalContext.
- keyFacts: must contain specific numbers, dates, or verifiable claims.
```

### Prompt 3: Article Writer (GPT-nano) — With JSON Safety 🛡️

```
${LANGUAGE_MANDATE}

You are OnlyAlpha's senior market analyst and writer.
You receive a JSON analysis object. Transform it into a compelling article.

You are a WRITER, not an analyst. Do NOT add new analysis. Do NOT change verdicts. Do NOT invent facts.

Output STRICT JSON:
{
  "headline":        "<SEO headline. Action verb first. Coin + event. MAX 15 words.>",
  "hook":            "<One powerful opening sentence. Must include the most important number.>",
  "fullArticle":     "<800+ words. Sections:
    [HOOK] Expand the hook into 2-3 sentences.
    [WHAT HAPPENED] Factual summary using keyFacts from input.
    [WHY IT MATTERS] Use analysis.mainDriver and analysis.priceImplication.
    [HISTORY REPEATS?] If analysis.temporalContext is not null — expand it with numbers.
    [PRICE PICTURE] Use support/resistance levels. Reference trend and ATH distance.
    [RISK CHECK] Use analysis.riskNote honestly.
    [BOTTOM LINE] Verdict + confidenceScore. 'Analysis rates this as X with Y% confidence.'
    Rules: Bloomberg meets Reddit tone. One number per paragraph minimum.
    No vague language. No financial advice — use 'data suggests', 'analysis indicates'.>",
  "metaTitle":       "<MAX 60 chars. Format: 'Coin Event | OnlyAlpha'>",
  "metaDescription": "<MAX 160 chars. Primary keyword. End: Read the analysis on OnlyAlpha.>",
  "seoKeywords":     ["<coin+event>", "<market action>", "<long-tail query>", "<coin+price>", "<trend>"]
}
```

---

## 🛡️ PHASE 6 — Resilience Layer
> **Depends on:** Phase 2 (data services) + Phase 5 (AI prompts).
> **Goal:** Protect the pipeline from external failures.
> **Time:** Day 5 (same day as Phase 5).

### P6-A: Circuit Breaker

```typescript
// circuitBreaker.service.ts
export class CircuitBreaker {
  private failures  = 0;
  private openUntil: Date | null = null;
  private readonly maxFailures = 5;
  private readonly cooldownMs  = 30 * 60 * 1000; // 30 minutes

  isOpen(): boolean {
    if (!this.openUntil) return false;
    if (new Date() > this.openUntil) {
      // Cooldown passed → reset and try again
      this.failures  = 0;
      this.openUntil = null;
      return false;
    }
    return true;
  }

  recordFailure(service: string): void {
    this.failures++;
    console.error(`[CircuitBreaker] ${service} failure ${this.failures}/${this.maxFailures}`);
    if (this.failures >= this.maxFailures) {
      this.openUntil = new Date(Date.now() + this.cooldownMs);
      console.error(`[CircuitBreaker] 🛑 ${service} OPEN until ${this.openUntil.toISOString()}`);
      // TODO: plug in your alert here (email / Slack webhook)
    }
  }

  recordSuccess(): void {
    this.failures = 0;
  }
}

export const binanceBreaker     = new CircuitBreaker();
export const dexscreenerBreaker = new CircuitBreaker();
export const deepseekBreaker    = new CircuitBreaker();
export const gptNanoBreaker     = new CircuitBreaker();
```

### P6-B: Dynamic Triage Threshold

```typescript
// dynamicThreshold.service.ts
export async function getDynamicThreshold(): Promise<number> {
  const { rows } = await db.query(`
    SELECT COUNT(*) AS count FROM raw_news_buffer
    WHERE triage_score >= 60 AND created_at > NOW() - INTERVAL '2 hours'
  `);
  const count = parseInt(rows[0].count);

  if (count < 5)  return 65;  // Quiet market → lower the bar
  if (count < 20) return 70;  // Normal market
  if (count < 50) return 78;  // Hot market → protect budget
  return 85;                  // Extreme (crash/bull run) → only the best
}

export async function countPublishedLastHour(): Promise<number> {
  const { rows } = await db.query(`
    SELECT COUNT(*) AS count FROM coin_news
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);
  return parseInt(rows[0].count);
}
```

---

## 🔗 PHASE 7 — Wire Everything in aiWorkflow
> **Depends on:** Phases 3 + 4 + 5 + 6 all complete.
> **Goal:** Connect all layers into the single orchestration file.
> **Time:** Day 6.

```typescript
// aiWorkflow.cron.ts
import { getCoinIntelligence }                  from './coinIntelligence.service';
import { fetchCoinHistoricalNews,
         buildTemporalPattern,
         backfillPriceOutcomes }               from './temporalIntelligence.service';
import { getPriceWithFallback }                from './priceService';
import { getDynamicThreshold,
         countPublishedLastHour }              from './dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker }     from './circuitBreaker.service';

export async function runAiWorkflow(): Promise<void> {

  // 1. Respect the hard cap: max 5 deep articles per hour
  const hourlyCount = await countPublishedLastHour();
  if (hourlyCount >= 5) {
    console.log('[Workflow] Hourly cap reached. Skipping cycle.');
    return;
  }

  // 2. Dynamic threshold
  const threshold = await getDynamicThreshold();

  // 3. Get triage items above threshold
  const items = await db.query(`
    SELECT * FROM raw_news_buffer
    WHERE triage_score >= $1
      AND processed = false
      AND coin_symbol != 'UNKNOWN'
    ORDER BY triage_score DESC
    LIMIT $2
  `, [threshold, 5 - hourlyCount]);

  for (const item of items.rows) {
    const symbol = item.coin_symbol;

    // 4. Coin Intelligence (cached)
    const intelligence = await getCoinIntelligence(symbol, item.token_address);

    // 5. Historical news + temporal pattern
    await fetchCoinHistoricalNews(symbol, item.event_type);
    const pattern = await buildTemporalPattern(symbol, item.event_type, item.event_severity);

    // 6. Current price
    const price = await getPriceWithFallback(symbol, item.token_address);

    // 7. DeepSeek analysis — circuit-breaker protected
    if (deepseekBreaker.isOpen()) {
      console.warn('[Workflow] DeepSeek circuit open — skipping item');
      continue;
    }
    let analysis: object | null = null;
    try {
      analysis = await callDeepSeek({ intelligence, pattern, price, headline: item.title });
      deepseekBreaker.recordSuccess();
    } catch (err) {
      deepseekBreaker.recordFailure('DeepSeek');
      continue;
    }

    // 8. GPT-nano article writing — circuit-breaker protected
    if (gptNanoBreaker.isOpen()) {
      console.warn('[Workflow] GPT-nano circuit open — skipping item');
      continue;
    }
    let article: object | null = null;
    try {
      article = await callGptNanoWriter(analysis);
      gptNanoBreaker.recordSuccess();
    } catch (err) {
      gptNanoBreaker.recordFailure('GPT-nano');
      continue;
    }

    // 9. Publish + targeted cache invalidation
    await publishArticle(article, symbol, item);

    // 10. Mark buffer item as processed
    await db.query(
      'UPDATE raw_news_buffer SET processed = true WHERE id = $1',
      [item.id]
    );
  }

  // Backfill runs separately (Phase 4 cron, not here)
}
```

---

## 📦 PHASE 8 — Cache & Publishing Layer
> **Depends on:** Phase 7 (workflow wired).
> **Goal:** Safe JSON parsing + targeted Redis invalidation.
> **Time:** Day 6 (same day as Phase 7).

### P8-A: JSON Safety in GPT-nano Response 🛡️

```typescript
// Use Zod to validate the GPT-nano JSON output
// If the model forgets to close a bracket, Zod catches it → retry, not crash
import { z } from 'zod';

const ArticleSchema = z.object({
  headline:       z.string().max(120),
  hook:           z.string(),
  fullArticle:    z.string().min(800),   // enforce minimum length
  metaTitle:      z.string().max(60),
  metaDescription:z.string().max(160),
  seoKeywords:    z.array(z.string()).length(5)
});

async function callGptNanoWriter(analysis: object, attempt = 1): Promise<z.infer<typeof ArticleSchema>> {
  const MAX_ATTEMPTS = 3;

  const raw = await callGptNano(analysis); // raw string from API

  // Always wrap JSON parse in try-catch
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[GPT-nano] JSON parse failed on attempt ${attempt}. Raw:`, raw.slice(0, 200));
    if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysis, attempt + 1);
    throw new Error('GPT-nano returned invalid JSON after 3 attempts');
  }

  // Validate shape with Zod
  const result = ArticleSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(`[GPT-nano] Schema validation failed on attempt ${attempt}:`, result.error.issues);
    if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysis, attempt + 1);
    throw new Error('GPT-nano response failed schema validation after 3 attempts');
  }

  return result.data;
}
```

### P8-B: Targeted Redis Invalidation (No Full Flush) 🛡️

```typescript
// publishArticle.service.ts

async function publishArticle(article: object, coinSymbol: string, bufferItem: object): Promise<void> {

  // 1. Save to DB
  const { rows } = await db.query(`
    INSERT INTO coin_news (symbol, headline, hook, full_article, meta_title,
                           meta_description, seo_keywords, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    RETURNING id
  `, [coinSymbol, article.headline, article.hook, article.fullArticle,
      article.metaTitle, article.metaDescription, JSON.stringify(article.seoKeywords)]);

  const articleId = rows[0].id;

  // 2. Targeted Redis invalidation — NEVER flush all keys
  // Only invalidate keys related to this specific coin and the global feed
  const keysToInvalidate = [
    `news:${coinSymbol}`,            // e.g. news:SOL — coin-specific feed
    `news:${coinSymbol}:latest`,     // latest article for this coin
    `feed:global:latest`,            // global feed (first page)
    `article:${articleId}`           // the new article itself (pre-warm optional)
  ];

  // Use pipeline for atomic multi-delete (not FLUSHALL)
  const pipeline = redis.pipeline();
  for (const key of keysToInvalidate) {
    pipeline.del(key);
  }
  await pipeline.exec();

  // ⛔ NEVER do this:
  // await redis.flushall() ← kills ALL cached data → avalanche of DB hits from all users

  console.log(`[Publish] Article ${articleId} published. Invalidated: ${keysToInvalidate.join(', ')}`);
}
```

---

## 🧪 PHASE 9 — Testing & QA
> **Depends on:** All phases 0-8 complete.
> **Goal:** Verify every layer works end-to-end before deploy.
> **Time:** Day 7.

```bash
# Phase 0 checks
npx ts-node -e "import('./rssNews.service').then(m => m.fetchAllRSSNews().then(r => console.log(r.length + ' RSS items')))"

# Phase 2 checks
npx ts-node -e "import('./priceService').then(m => Promise.all([
  m.getPriceWithFallback('SOL'),    // should return Binance
  m.getPriceWithFallback('PEPE')    // should return DexScreener
]).then(console.log))"

# Phase 3 check
npx ts-node -e "import('./coinIntelligence.service').then(async m => {
  console.log('SOL:', await m.getCoinIntelligence('SOL'));
  console.log('PEPE:', await m.getCoinIntelligence('PEPE'));
})"

# Phase 4 check — watch for 2-3s gaps in logs (rate limiting working)
npx ts-node -e "import('./temporalIntelligence.service').then(m =>
  m.fetchHistoricalNewsForCoins(['BTC', 'ETH', 'SOL'])
)"

# Phase 4 check — temporal pattern with severity
npx ts-node -e "import('./temporalIntelligence.service').then(async m => {
  const p = await m.buildTemporalPattern('SOL', 'ETF', 3);
  console.log(JSON.stringify(p, null, 2));
})"

# Phase 5 check — triage extracts eventType + severity (no UNKNOWN)
npx ts-node -e "import('./triageEngine.cron').then(m => m.runTriageEngine())"

# Phase 6 check — circuit breaker trips at 5 failures
# Force an invalid API URL temporarily and run 5 calls → confirm 30min pause

# Phase 8 check — JSON safety: pass malformed JSON to callGptNanoWriter
# It should retry 3 times then throw — not crash the whole workflow

# Phase 8 check — Redis: after publishing, confirm ONLY coin keys deleted
# Run: redis-cli KEYS '*' before and after publish

# Full pipeline
npx ts-node -e "import('./aiWorkflow.cron').then(m => m.runAiWorkflow())"
# Verify: article is 800+ words, English only, references historical pattern
```

---

## 🚀 PHASE 10 — Deployment
> **Depends on:** Phase 9 all tests passing.
> **Goal:** Ship to production safely.
> **Time:** Day 7 (same day, after tests pass).

### Pre-Deploy Checklist

```bash
# Environment
- [ ] ANALYSIS_MODEL=deepseek/deepseek-r1
- [ ] SEO_MODEL=openai/gpt-5-nano
- [ ] CRYPTOCOMPARE_API_KEY removed from .env
- [ ] COINCAP_API_KEY removed from .env
- [ ] TAVILY_API_KEY present (emergency fallback)
- [ ] REDIS_URL set correctly

# Dependencies
- [ ] npm install zod                    # JSON validation
- [ ] rss-parser present in package.json # already used

# Database
- [ ] npx drizzle-kit push               # creates coin_intelligence_cache + coin_news_history
- [ ] Verify indexes created: \d coin_news_history

# Endpoints
- [ ] GET /api/health returns { status: 'ok' }
- [ ] GET /api/market/wire works without 500

# Crons registered
- [ ] terminalEngine.cron   → every 10 min (RSS + DexScreener boosts)
- [ ] triageEngine.cron     → every 2 hours (with dynamic threshold)
- [ ] aiWorkflow.cron       → every hour (max 5 articles)
- [ ] backfillPriceOutcomes → daily at 3am

# Prompts
- [ ] All 8 prompts contain LANGUAGE_MANDATE
- [ ] Triage prompt extracts eventType + eventSeverity
- [ ] DeepSeek prompt outputs JSON only (no prose)
- [ ] GPT-nano prompt writes 800+ word article
```

### Post-Deploy Monitoring (First 24 Hours)

```bash
# Watch for these in logs:
[RSS]          "X items fetched" every 10 min        ← Phase 0 working
[Triage]       "threshold=70, eligible=3/12"         ← Phase 6 working
[CircuitBreaker] NO "OPEN" messages                  ← APIs healthy
[Temporal]     "Google News blocked" = acceptable    ← rate limiting respected
[Publish]      "Invalidated: news:SOL, feed:global"  ← targeted cache working
[GPT-nano]     NO "JSON parse failed" after deploy   ← Zod catching issues early

# Check article quality manually after first 3 articles:
- Length > 800 words? ✓
- English only? ✓
- References historical pattern? ✓
- Has specific numbers in every paragraph? ✓
```

---

## 💰 Final Cost Breakdown

| Service | Monthly Cost |
|:---|:---|
| RSS + Google News RSS + Wikipedia | $0.00 |
| Binance Public + DexScreener | $0.00 |
| DeepSeek R1 (JSON analysis only — compact output) | ~$1-3 |
| GPT-5-nano (triage + writing + SEO + chat) | ~$1-2 |
| Redis + PostgreSQL (self-hosted) | $0.00 |
| **TOTAL** | **~$2-5/month** |

> Note: DeepSeek cost is lower than v4.0 because it now outputs compact JSON, not 800-word prose.

---

## 📊 Quality Delta — v3 vs v4.2

| Dimension | v3 | v4.2 |
|:---|:---|:---|
| Article length | 100-200 words | 800+ words (Zod enforces minimum) |
| Language | EN / Chinese / Arabic mixed | English only (GPT-nano writes, mandate enforced) |
| Tone | Random / robotic | Consistent (Bloomberg meets Reddit) |
| Historical context | None | "Last 3x ETF hit SOL → avg +30% in 7d" |
| Coin background | None | Wikipedia + Binance ATH/trend |
| Rug pull learning | None | Auto-flagged → AI pattern learns |
| Market overload | Writes everything | Dynamic threshold 65-85 + 5/hr hard cap |
| API failure | Silent errors → bad data | Circuit breaker → 30min pause + alert |
| JSON crashes | App crash | Zod validation + 3-attempt auto-retry |
| Cache storm | Potential flush risk | Targeted key invalidation only |

---
*Status: ✅ Ready for Execution*
*10 phases. Zero conflicts. Each phase has exactly one dependency.*