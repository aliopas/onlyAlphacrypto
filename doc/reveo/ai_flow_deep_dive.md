# AI Flow Deep Dive — Full System Report

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Cron Job Schedule (When Does AI Run?)](#cron-job-schedule)
3. [Pipeline 1: AI Intelligence Workflow (Hourly)](#pipeline-1-ai-intelligence-workflow)
4. [Pipeline 2: Terminal Engine (Every 5 Minutes)](#pipeline-2-terminal-engine)
5. [Pipeline 3: Daily Alpha Selection (06:00 UTC)](#pipeline-3-daily-alpha-selection)
6. [Pipeline 4: Market Mood (07:00 UTC)](#pipeline-4-market-mood)
7. [Pipeline 5: Airdrop Hunter (Daily)](#pipeline-5-airdrop-hunter)
8. [Pipeline 6: AI Chat (On-Demand Streaming)](#pipeline-6-ai-chat)
9. [Cache Layer (Redis)](#cache-layer-redis)
10. [Frontend API Layer & Mock Mode](#frontend-api-layer)
11. [Database Schema Summary](#database-schema-summary)
12. [News Deduplication & Filtering Logic](#news-deduplication)
13. [AI Model Routing (Adaptive)](#ai-model-routing)
14. [Force Seed Endpoint](#force-seed-endpoint)
15. [Identified Bugs & Improvements](#identified-bugs--improvements)

---

## 1. System Architecture Overview

```
External APIs                    Backend (Express + Node-Cron)             Frontend (Next.js SSR + Client)
─────────────                    ─────────────────────────────             ──────────────────────────────
                                 ┌─────────────────────────┐
DexScreener API ──────────┐      │     server.ts (Bootstrap)│
Reddit API ───────────────┤      │  ┌───────────────────┐   │
CryptoPanic API ──────────┤──────▶  │   5 Cron Jobs      │   │
CryptoCompare API ────────┤      │  │   (node-cron)      │   │
Tavily API ───────────────┤      │  └───────┬───────────┘   │
Alternative.me API ───────┤      │          │               │
Binance API ──────────────┘      │          ▼               │              ┌───────────────────┐
                                 │  ┌───────────────────┐   │   REST API   │  homeApi / termApi │
OpenRouter (AI) ◀────────────────│  │ OpenAI Service     │   │◀────────────▶│  (axios client)   │
  • GLM-5 (Analysis)             │  │ (4 AI functions)   │   │              │                   │
  • DeepSeek-R1 (Complex)        │  └───────┬───────────┘   │              │  Mock fallback    │
  • GPT-5-nano (Chat)            │          │               │              └───────────────────┘
                                 │          ▼               │
                                 │  ┌───────────────────┐   │
                                 │  │  PostgreSQL (DB)   │   │
                                 │  │  6 tables          │   │
                                 │  └───────────────────┘   │
                                 │          ▲               │
                                 │  ┌───────────────────┐   │
                                 │  │  Redis (ioredis)   │   │
                                 │  │  Cache layer       │   │
                                 │  └───────────────────┘   │
                                 └─────────────────────────┘
```

---

## 2. Cron Job Schedule

All crons are registered in `server.ts` at bootstrap time:

| Cron Job | Schedule | File | Purpose |
|---|---|---|---|
| **AI Intelligence Workflow** | `0 * * * *` (top of every hour) | `aiWorkflow.cron.ts` | Deep analysis of trending tokens |
| **Terminal Engine** | `*/5 * * * *` (every 5 minutes) | `terminalEngine.cron.ts` | Fetch & analyze news for Wire/Radar |
| **Daily Alpha Selection** | `0 6 * * *` (06:00 UTC daily) | `dailyAlpha.cron.ts` | Pick today's Alpha Focus |
| **Market Mood** | `0 7 * * *` (07:00 UTC daily) | `marketMood.cron.ts` | Compute Fear & Greed score |
| **Airdrop Hunter Discovery** | `0 0 * * *` (midnight UTC) | `airdropHunter.cron.ts` | Discover new airdrops |
| **Airdrop Routine Sync** | `0 */12 * * *` (every 12 hours) | `airdropHunter.cron.ts` | Re-validate active airdrops |

> **Note:** The Terminal Engine does NOT have its own `start*Cron()` registered in `server.ts`. It is imported but must be checked whether it's actually started. *(See bugs section.)*

---

## 3. Pipeline 1: AI Intelligence Workflow (Hourly)

**File:** `aiWorkflow.cron.ts`  
**Frequency:** Every hour at minute 0  
**Concurrency Guard:** Boolean lock `isAiWorkflowRunning` prevents overlapping runs.

### Phase 1 — Hunter (Discovery)
1. Calls `getTopBoostedTokens()` from **DexScreener** → returns trending/boosted token symbols and addresses.
2. Calls `getHotCryptoTopics()` from **Reddit** → fetches hot crypto subreddit titles (currently not extracting symbols from them).
3. Collects results into a `memoryTopics[]` array.

### Phase 2 — Aggregator
For each topic (limited to **top 10**):
1. Calls `getTokenData(address)` from **DexScreener** → gets price, liquidity, volume stats.
2. Calls `searchCryptoPanic(symbol)` → gets related news headlines from CryptoPanic.
3. **Deduplication:** For each headline, generates a **SHA-256 hash** and checks the `coin_news` table:
   - If hash exists → adds to `existingContext` (already known news, NOT sent to AI again).
   - If hash is new → adds to `freshNews` (will be sent to AI).
4. Calls `searchTavily(symbol + "crypto scam team")` → **scam investigation search** via Tavily.
5. Writes a **Price Snapshot** to DB (`price_snapshots` table).

### Phase 3 — Brain (AI Analysis)
For each aggregated item:
1. Calls `generateDeepIntelligenceReport(symbol, data)` in **OpenAI Service**.
2. This function uses **Adaptive Model Routing** (see Section 13).
3. Returns a structured JSON: `{ riskVerdict, verdict, confidenceScore, executiveSummary, redFlags }`.

### Phase 4 — Publisher (Storage)
For each AI report:
1. **Inserts** into `market_insights` table (verdict, confidence, summary, risk, red flags, price).
2. **Inserts fresh news** into `coin_news` table with `sourceHash` and `aiProcessed=1`. Uses `onConflictDoNothing()` to skip duplicates.
3. **Conditionally inserts** a `radar_signal` if the verdict is `STRONG_BUY`, `STRONG_SELL`, or risk is `HIGH`/`SCAM`.
4. **Invalidates** Redis cache key `insight:all`.

### Data Saved to DB: ✅ Yes
- `market_insights` — AI verdicts
- `coin_news` — Fresh headlines
- `radar_signals` — Actionable alerts
- `price_snapshots` — Token prices

---

## 4. Pipeline 2: Terminal Engine (Every 5 Minutes)

**File:** `terminalEngine.cron.ts`  
**Frequency:** Every 5 minutes  
**Purpose:** Powers the Terminal page's "Latest Wire" and "AI Radar" feeds.

### Step-by-Step Flow:
1. **Fetch tracked airdrop project names** from DB (`airdrop_projects` where `isActive = true`).
2. **Fetch latest 5 news items** from **CryptoCompare** API (`https://min-api.cryptocompare.com/data/v2/news/?lang=EN`).
3. For each news item:
   - **Deduplication:** Generates SHA-256 hash of the title. Checks `coin_news.sourceHash`. Skips if exists.
   - **Context Fetch:** Reads the 3 most recent AI-processed summaries from DB to provide historical context.
   - **AI Analysis:** Calls `generateDualNewsOutput(rawTitle, trackedProjects, context)` → returns BOTH:
     - A **Wire Card**: `{ headline, summary, sentiment, impactScore, isBreaking, coinSymbol }`
     - A **Radar Card**: `{ signalText, sentiment, impactScore, coinSymbol }`
   - **Writes Wire Card** → `coin_news` table.
   - **Writes Radar Card** → `radar_signals` table (linked via `newsId` foreign key).
   - **Invalidates** Redis keys: `radar:latest` and `wire:all:20`.
   - **Breaking News Check:** If `isBreaking` is true AND the headline mentions a tracked airdrop project AND contains keywords like `snapshot`, `tge`, `claim`, `hack`, etc. → triggers `triggerAirdropWebhook()`.
   - **Rate Limit Protection:** Waits 500ms between processing each item to avoid OpenAI rate limits.

### Data Saved to DB: ✅ Yes
- `coin_news` — Wire cards
- `radar_signals` — Radar cards (linked to news)

---

## 5. Pipeline 3: Daily Alpha Selection (06:00 UTC)

**File:** `dailyAlpha.cron.ts`  
**Frequency:** Once daily at 06:00 UTC  
**Purpose:** Picks the "Today's Alpha Focus" coin displayed on the Home page.

### Selection Algorithm:
1. **Hard Filter:** Queries `market_insights` for entries with `verdict = 'STRONG_BUY'` created in the last 24 hours. Sorts by `confidenceScore DESC`.
2. **Fallback:** If no STRONG_BUY candidates exist, takes the highest-confidence insight from last 24h regardless of verdict.
3. **Composite Scoring:** Each candidate gets a weighted score:
   - `confidenceScore × 0.40`
   - `volumeSurge × 0.25`
   - `tvlChange × 0.20`
   - `socialMomentum × 0.15`
4. Sorts by composite score and picks the winner.
5. **Inserts** into `daily_alpha_focus` table with `validForDate` = today's date.
6. **Invalidates** Redis key `alpha-focus:today`.

### Data Saved to DB: ✅ Yes
- `daily_alpha_focus` — Daily winner

---

## 6. Pipeline 4: Market Mood (07:00 UTC)

**File:** `marketMood.cron.ts`  
**Frequency:** Once daily at 07:00 UTC  
**Purpose:** Computes the Fear & Greed gauge on the Home page.

### Scoring:
1. **External Score:** Fetches from Alternative.me Fear & Greed API (via `getFearAndGreed()` in `binance.service.ts`).
2. **Internal Score:** Queries `radar_signals` from last 24h. Counts bullish vs bearish signals:
   ```
   internalScore = 50 + ((bullish - bearish) / total) * 50
   ```
3. **Hybrid Final Score:** `(external × 0.60) + (internal × 0.40)`.
4. Maps score to label: `Extreme Fear (0-20) | Fear (21-40) | Neutral (41-60) | Greed (61-80) | Extreme Greed (81-100)`.
5. **Inserts** into `daily_market_mood` table.
6. **Invalidates** Redis key `mood:today`.

### Data Saved to DB: ✅ Yes
- `daily_market_mood` — Daily mood score

---

## 7. Pipeline 5: Airdrop Hunter (Daily)

**File:** `airdropHunter.cron.ts`

### Discovery Job (Midnight UTC):
1. Currently uses **hardcoded placeholder data** (LayerZero, ZkSync Era) — real scraping not implemented yet.
2. For each potential project, calls `validateAirdrop(projectData)` from OpenAI Service → returns `{ isLegitimate, riskVerdict, tasks[], estValue, aiReport }`.
3. If legitimate and NOT a scam → inserts into `airdrop_projects` and `airdrop_tasks` tables.
4. **Invalidates** Redis key `airdrop:projects`.

### Routine Sync (Every 12 Hours):
1. Queries all active projects from DB.
2. Re-validates each project via AI.
3. Updates the `updatedAt` timestamp.
4. **Invalidates** Redis keys `airdrop:projects` and `airdrop:deadlines`.

### Data Saved to DB: ✅ Yes
- `airdrop_projects` — Projects
- `airdrop_tasks` — Tasks per project

---

## 8. Pipeline 6: AI Chat (On-Demand Streaming)

**File:** `chat.controller.ts` + `openai.service.ts`  
**Trigger:** User clicks "Send" in `TerminalChat` component.

### Flow:
1. Frontend sends `POST /api/chat/stream` with `{ message, coin }`.
2. Backend `chatStream` controller:
   - Fetches the latest `market_insights` for the coin from DB.
   - Fetches the 3 most recent `coin_news` headlines for the coin from DB.
   - Fetches live price from **Binance** (falls back to DB price on error).
   - Calls `streamChatResponse()` in OpenAI Service using **GPT-5-nano** (the SEO/user-facing model).
3. Response streams back as **SSE (Server-Sent Events)** with `data: {...}\n\n` chunks.
4. Frontend `TerminalChat` parses chunks with `ReadableStream` + `TextDecoder` and renders them progressively.

### Data Saved to DB: ❌ No
Chat messages are **NOT** persisted. They only live in the `TerminalChat` component's local `useState`. Resetting the coin or refreshing loses the conversation.

---

## 9. Cache Layer (Redis)

**File:** `config/redis.ts`  
**Library:** `ioredis`  
**Connection:** Conditional on `REDIS_URL` env variable. If not set, cache functions silently return `null`/no-op.

### Cache Architecture:
The caching is entirely on the **backend**. The frontend has **zero caching** (no `localStorage`, no IndexedDB, no service workers).

| Cache Key | TTL | Used By | Invalidated By |
|---|---|---|---|
| `insight:{coin}` | 300s (5 min) | `getCoinInsight` controller | Manual only |
| `alpha-focus:today` | 600s (10 min) | `getAlphaFocus` controller | `dailyAlpha.cron` |
| `radar:latest` | 60s (1 min) | `getRadarSignals` controller | `terminalEngine.cron` |
| `wire:{coin/all}:{limit}` | 120s (2 min) | `getLatestWire` controller | `terminalEngine.cron` |
| `mood:today` | 600s (10 min) | `getMarketMood` controller | `marketMood.cron` |
| `insight:all` | N/A | N/A | `aiWorkflow.cron` |
| `airdrop:projects` | N/A | Airdrop controller | `airdropHunter.cron` |
| `airdrop:deadlines` | N/A | Airdrop controller | `airdropHunter.cron` |

### Pattern: Cache-First
Every controller endpoint follows this pattern:
```
1. Check Redis cache → if hit, return immediately.
2. Query PostgreSQL.
3. Write result to Redis with TTL.
4. Return result.
```

### Fallback Without Redis:
If `REDIS_URL` is not configured, `getCache()` always returns `null`, causing every request to hit the database directly. The app works, just slower.

---

## 10. Frontend API Layer & Mock Mode

**Files:** `home/api.ts`, `terminal/api.ts`  
**Library:** `axios` (via `apiClient`)

### Mock Mode:
- Controlled by env variable `NEXT_PUBLIC_API_MODE`.
- If `=== 'mock'` → returns hardcoded mock data from `shared/api/mockData.ts`.
- If anything else → calls the real backend API.

### Error Handling Pattern:
- On API failure, each function returns a safe fallback: `null` for single objects, `[]` for arrays.
- This ensures the UI always renders (shows empty states) and never crashes.

### SSR vs CSR:
- **Home page** (`page.tsx`): Fetches data **server-side** using `async function HomePage()`. All 5 API calls run in parallel via `Promise.all()`.
- **Terminal page** (`page.tsx`): Fetches wire news **server-side** and passes them to `TerminalPageClient`.
- **TickerBar** (`TickerBar.tsx`): Fetches `getTopMovers()` **client-side** via `useEffect`.
- **TerminalChat**: Fetches live price **client-side** from Binance directly (bypasses backend).

---

## 11. Database Schema Summary

| Table | Key Fields | Written By |
|---|---|---|
| `market_insights` | coinSymbol, verdict, confidenceScore, executiveSummary, riskLevel, redFlags, priceAtAnalysis | aiWorkflow cron |
| `coin_news` | coinSymbol, headline, summary, sentiment, impactScore, isBreaking, sourceHash (unique), aiProcessed | aiWorkflow + terminalEngine |
| `radar_signals` | coinSymbol, signalText, sentiment, impactScore, newsId (FK) | aiWorkflow + terminalEngine |
| `daily_alpha_focus` | insightId (FK), coinSymbol, verdict, confidenceScore, compositeScore, validForDate | dailyAlpha cron |
| `daily_market_mood` | externalScore, internalScore, finalScore, label, validForDate | marketMood cron |
| `price_snapshots` | coinSymbol, price, liquidity, volume24h | aiWorkflow cron |

---

## 12. News Deduplication & Filtering Logic

There are **two separate deduplication systems** operating independently:

### System A — AI Workflow (Hourly):
- **Source:** CryptoPanic API
- **Hash:** `crypto.createHash('sha256').update(headline).digest('hex')`
- **Check:** Queries `coin_news.sourceHash` for exact match.
- **Action:** If duplicate → adds to `existingContext` (sent to AI as background knowledge but NOT re-analyzed). If new → sent to AI for full analysis.

### System B — Terminal Engine (Every 5 Min):
- **Source:** CryptoCompare API
- **Hash:** `crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex')`
- **Check:** Queries `coin_news.sourceHash` for exact match.
- **Action:** If duplicate → **completely skipped** (no AI call, no DB write). If new → sent to AI for dual output.

### Key Difference:
System A normalizes nothing (raw headline hashed as-is). System B normalizes by `trim() + toLowerCase()` before hashing. This means the same headline could potentially be inserted twice if it comes from both systems with different casing.

### Frontend Filtering:
`TerminalWire` component filters by `targetedCoin`:
```js
const filteredNews = targetedCoin
    ? news.filter(n => n.coin?.toLowerCase() === targetedCoin.toLowerCase())
    : news;
```
This is a simple case-insensitive string match on `coinSymbol`. No fuzzy matching.

---

## 13. AI Model Routing (Adaptive)

**File:** `openai.service.ts`  
**Provider:** OpenRouter (OpenAI-compatible API that routes to multiple LLMs)

### Model Assignment:

| Function | Model Used | When |
|---|---|---|
| `generateMarketVerdict` | `env.ANALYSIS_MODEL` (GLM-5) | Always |
| `generateDeepIntelligenceReport` | **Adaptive** (see below) | Depends on data complexity |
| `generateDualNewsOutput` | `env.ANALYSIS_MODEL` (GLM-5) | Always (3x retry on failure) |
| `validateAirdrop` | `env.ANALYSIS_MODEL` (GLM-5) | Always |
| `streamChatResponse` | `env.SEO_MODEL` (GPT-5-nano) | Always (streaming) |

### Adaptive Routing for Deep Intelligence:
```
IF   news count > 3
  OR scam report > 100 chars
  OR price change 24h > ±10%
THEN → Use DeepSeek-R1 (Tier-1 Complex)
ELSE → Use GLM-5 (Tier-2 Routine)
```

### Temperature Settings:
- `0.2` — Airdrop validation (most deterministic)
- `0.3` — Market analysis, Deep intelligence
- `0.5` — News dual output
- `0.6` — Chat streaming

All analysis functions enforce `response_format: { type: 'json_object' }` for structured JSON output.

---

## 14. Force Seed Endpoint

**Endpoint:** `POST /api/market/force-seed?phase=all`  
**File:** `market.controller.ts`

This endpoint allows **manually triggering** the entire AI pipeline on demand instead of waiting for cron schedules. It runs:
1. `runAiWorkflow(phase)` — AI Intelligence Workflow
2. `selectDailyAlpha()` — Alpha Focus Selection
3. `computeMarketMood()` — Market Mood
4. `runDiscovery()` or `runRoutineSync()` — Airdrop Hunter (based on whether projects already exist)

Optionally accepts `?phase=1|2|3|4` to target a specific phase of the AI Workflow.

---

## 15. Identified Bugs & Improvements

### 🔴 Critical Bugs

1. **Terminal Engine Cron Not Started:** `server.ts` imports and starts 4 crons (`aiWorkflow`, `airdropHunter`, `dailyAlpha`, `marketMood`) but does NOT import or start `startTerminalEngineCron()`. This means the 5-minute news engine **never runs automatically** — the Terminal page only gets data from the hourly `aiWorkflow` or from `force-seed`.

2. **Hash Collision Risk:** The two deduplication systems (aiWorkflow vs terminalEngine) use different normalization (one trims+lowercases, the other doesn't). Identical news from different sources could slip through as "new".

3. **Mock priceChange24h:** In `getAlphaFocus` controller (line 65): `priceChange24h: 5.5` is a hardcoded mock value. The 24h price change is NEVER calculated from real data.

### 🟡 Medium Issues

4. **No Redis TTL on Some Keys:** `insight:all`, `airdrop:projects`, `airdrop:deadlines` are invalidated but their TTL on write is not visible in the airdrop controller — they might not be cached at all, or they have no expiry.

5. **Chat Body Mismatch:** Frontend sends `{ message, coin }` but backend expects `{ coinSlug, messages }`. The field names don't match. Chat streaming might silently fail or require an adapter.

6. **Reddit Data Unused:** The AI Workflow fetches Reddit topics in Phase 1 but the `forEach` loop body is empty — Reddit data is fetched but never processed or added to `memoryTopics`.

7. **Concurrency Lock is In-Memory Only:** The `isAiWorkflowRunning` boolean lock only works for a single server instance. If the app is deployed across multiple instances, multiple AI workflow runs could overlap.

### 🟢 Improvements

8. **No WebSocket / Real-Time Push:** All frontend data is fetched on page load (SSR) or on mount (CSR). There's no mechanism (WebSocket, SSE, polling) to push new signals to the frontend while the user is on the page.

9. **Chat Not Persisted:** Conversations are lost on refresh or coin switch. Consider storing in `sessionStorage` or a DB-backed chat history.

10. **Airdrop Scraping is Placeholder:** `scrapePotentialAirdrops()` returns hardcoded data. Real scraping from DeFi Llama, DeBank, or on-chain event listeners is needed.

11. **No Rate Limiter on Force-Seed:** The `force-seed` endpoint has no auth or rate limiting. Anyone who calls it could trigger expensive AI operations.
