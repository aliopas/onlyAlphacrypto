<p align="center">
  <strong>OnlyAlpha</strong><br>
  <em>AI-Native Crypto Intelligence Platform</em><br><br>
  Zero noise. Pure alpha.<br>
  Multi-agent AI system that transforms market chaos into actionable signals.
</p>

---

## Table of Contents

- [Philosophy](#philosophy)
- [System Architecture](#system-architecture)
- [Intelligence Pipeline](#intelligence-pipeline)
- [Tech Stack](#tech-stack)
- [AI Brain](#ai-brain)
- [Database Schema](#database-schema)
- [Cron Jobs](#cron-jobs)
- [API & Middleware](#api--middleware)
- [Living Articles](#living-articles)
- [Conviction Score Engine](#conviction-score-engine)
- [Semantic Deduplication](#semantic-deduplication)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Folder Structure](#folder-structure)
- [Cost Optimization](#cost-optimization)
- [Code Quality](#code-quality)

---

## Philosophy

OnlyAlpha is not a news aggregator. It is a **multi-agent intelligence system** built on three principles:

```
[SENSE]  →  Ingest every signal from every source simultaneously
[THINK]  →  AI triage, deep analysis, cross-validation, hallucination filtering
[ACT]    →  Living Articles + Conviction Scores + Alpha Radar
```

**The problem:**
- 99% of crypto news is noise with zero actionable value
- Traders waste hours reading repetitive articles about the same event
- No system tracks how a coin's narrative evolves across time

**The solution:**
- **Triage First** — every headline is AI-classified before any expensive processing
- **Living Articles** — one persistent document per coin that evolves with the market, not 50 disjointed articles
- **Incremental Conviction** — algorithmic score (0-100) with zero AI cost, decaying toward neutral over time

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16 App Router)              │
│                                                                  │
│  /                  /terminal/[coin]    /settings    /airdrops   │
│  Home (Dashboard)   Alpha Terminal      Billing       Hunter     │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │MarketMood│  │Living Article│  │ Pro Chat │  │ Airdrop    │  │
│  │AlphaFocus│  │ Wire Feed    │  │ Context  │  │ TaskTracker│  │
│  │RadarGrid │  │ TimelineFeed │  │ Streaming│  │ Wallet Mgr │  │
│  │TopMovers │  │ AlphaStream  │  │          │  │            │  │
│  └──────────┘  └──────────────┘  └──────────┘  └────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │  REST API (JSON) + SSE (Chat Stream)
┌────────────────────────▼─────────────────────────────────────────┐
│                    BACKEND (Express 5 + TypeScript)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE STACK                       │   │
│  │  Helmet → CORS → JSON (10KB) → Time → Auth → RateLimit  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────┐   ┌────────────┐   ┌─────────────────────────┐   │
│  │  Routes   │──▶│Controllers │──▶│       Services          │   │
│  └───────────┘   └────────────┘   │                          │   │
│                                   │  openai.service.ts       │   │
│  ┌──────────────────────────┐     │  ├─ generateDualNews()   │   │
│  │     CRON JOBS (8 active) │────▶│  ├─ generateTriage()     │   │
│  │                          │     │  ├─ streamChatResponse() │   │
│  │  AiWorkflow      hourly  │     │  └─ ...                  │   │
│  │  TerminalEngine  10min   │     │                          │   │
│  │  TriageEngine    2hrs    │     │  ai/ (infrastructure)    │   │
│  │  ConvictionUpd   6hrs    │     │  ├─ AIGateway            │   │
│  │  MarketMood      30min   │     │  ├─ CacheManager (LRU)   │   │
│  │  DailyAlpha      08:00   │     │  ├─ PromptFactory        │   │
│  │  HistoricalNews  03:00   │     │  ├─ QualityAuditor       │   │
│  │  BufferCleanup   hourly  │     │  └─ FactualGrounding     │   │
│  └──────────────────────────┘     └─────────────────────────┘   │
└──────────┬───────────────────┬──────────────────┬────────────────┘
           │                   │                  │
    ┌──────▼──────┐   ┌───────▼───────┐  ┌───────▼───────┐
    │ PostgreSQL  │   │    Redis      │  │ External APIs │
    │  (Neon)     │   │              │  │               │
    │  pgvector   │   │  Cache Layer │  │  OpenRouter   │
    │  17 tables  │   │  Mutex Locks │  │  DeepSeek Dir │
    │  Drizzle    │   │  Rate Limits │  │  Binance      │
    │  Schema     │   │  Cron State  │  │  DexScreener  │
    └─────────────┘   └──────────────┘  │  Moralis      │
                                       │  Tavily/CoinCap│
                                       │  Alternative.me│
                                       └───────────────┘
```

---

## Intelligence Pipeline

This is the core of the system — how raw news becomes actionable intelligence.

### Phase 1A — Gathering (TerminalEngine) `*/10 * * * *`

```
RSS Feeds ──┐
CryptoPanic ┤
Reddit      ├──▶ SHA-256 hash per headline ──▶ Dedup Check ──▶ raw_news_buffer (TTL: 48h)
DexScreener ┤                                          │
Tavily      ┘                                    Already exists? → SKIP
```

The gathering engine pulls from every available source, normalizes the output, and stores it in `raw_news_buffer` with a 48-hour TTL. Each headline gets a SHA-256 hash for exact dedup before any database write.

### Phase 1B — Triage (TriageEngine) `0 */2 * * *`

Takes up to **50 unclassified** items per run, processes them in **batches of 10** — one AI call per batch instead of 10 individual calls:

```json
{
  "relevanceScore": 0-100,
  "sentimentHint": "bullish | bearish | neutral",
  "symbolMentions": ["BTC", "ETH"],
  "eventType": "ETF | Hack | Listing | Partnership | ...",
  "eventSeverity": 1 | 2 | 3,
  "classification": "MAJOR | MINOR | NOISE"
}
```

**Classification rules** (enforced by prompt):
| Label | Triggers |
|---|---|
| **MAJOR** | ETF approval, security breach, SEC action, major exchange listing, mainnet launch, funding >$100M |
| **MINOR** | Price levels, whale movements, partnerships, minor updates |
| **NOISE** | Repetitive content, promotional articles, opinion pieces, meme coins without catalyst |

### Phase 2 — AI Workflow (AiWorkflow) `0 * * * *`

```
raw_news_buffer (processed=true, relevanceScore >= threshold)
        │
        ▼
  Hourly Cap Check (max 5 articles/hour)
        │
        ▼
  Dynamic Threshold Check (adjusts based on news volume)
        │
        ▼
  isDuplicateByEmbedding? ──YES──▶ SKIP
        │ NO
        ▼
    Classification?
    ┌──────┬──────┬──────┐
    ▼      ▼      ▼
  NOISE  MINOR  MAJOR
    │      │      │
   SKIP   GPT    DeepSeek Deep Analysis
          Nano    → Factual Grounding (price sanity check)
          Minor   → GPT-nano Writer (tone + SEO)
          Update  → Quality Audit (if impact >= 75)
                  → Save to coin_news
                  → Radar Signal (if STRONG_BUY/SELL)
                  → Update Living Article
                  → Save to coin_memory
                  → Store Embedding (pgvector)
                  → Invalidate Redis Cache
```

**Bootstrap logic:** If a MINOR event arrives for a coin that has no Master Article yet, the system auto-promotes it to MAJOR to create the first Living Article.

---

## Tech Stack

### Backend

| Technology | Version | Rationale |
|---|---|---|
| Node.js + TypeScript | v20+ / Strict Mode | Zero `any` types — catch errors at compile time |
| Express 5 | v5.x | Automatic async error propagation — no try/catch in every route |
| Drizzle ORM | Latest | Type-safe SQL, faster than Prisma, lower overhead |
| PostgreSQL (Neon) | v16+ | Serverless-friendly, native pgvector support |
| pgvector | 0.2+ | Cosine similarity search inside the database |
| Redis (ioredis) | v5 | Caching + Mutex locks + Rate limiting via Lua scripts |
| node-cron | v4 | Cron jobs in-process — no Celery, no external queues |
| Zod | v4 | Runtime validation for env vars and AI responses |
| Winston | v3 | Structured logging with levels (debug/info/warn/error) |
| bcryptjs | v3 | Password hashing |
| jsonwebtoken | v9 | JWT authentication |
| geoip-lite | v2 | IP geolocation for security |
| Luxon | v3 | Date/time handling |

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Server Components + ISR revalidation for Living Articles |
| React 19 | Concurrent features + Server Actions |
| Tailwind CSS 4 | Utility-first styling — zero CSS files |
| Framer Motion | Animations for Terminal and Radar |
| Lightweight Charts (TradingView) | Financial charts with candlestick support |
| Lucide React | Icon library |
| date-fns | Date formatting |

### AI & Data Layer

| Service | Role | Details |
|---|---|---|
| OpenRouter | Primary AI Gateway | Unified access to GPT-5-nano and DeepSeek |
| DeepSeek Direct | Analysis Engine | Used directly (bypasses OpenRouter) for cost efficiency |
| OpenAI SDK | HTTP Client | Compatible with both gateways |
| Moralis | On-chain Data | Wallet and token tracking on-chain |
| Binance API | Market Data | Real-time prices, 24h change, volume |
| DexScreener | DEX Data | Trending tokens, liquidity, DEX prices |
| Tavily | Emergency Fallback | Web search if other sources fail |
| CoinCap | Price Fallback | Alternative price data if Binance fails |
| Alternative.me | Fear & Greed | Public Fear & Greed Index (no API key needed) |
| Birdeye | DEX Charts | Candle data for DEX charting |

---

## AI Brain

### AIGateway — Dual Provider Routing

`services/ai/ai-gateway.ts`

The gateway wraps the OpenAI SDK with two independent provider instances:

```typescript
const gateway = new AIGateway({          // OpenRouter — writing + chat
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

const deepseekGateway = env.DEEPSEEK_API_KEY  // DeepSeek Direct — analysis
    ? new AIGateway({
        apiKey: env.DEEPSEEK_API_KEY,
        baseURL: env.DEEPSEEK_BASE_URL,  // https://api.deepseek.com/v1
      })
    : null; // Falls back to OpenRouter if no direct key
```

**Three invocation modes:**
| Method | Return | Use Case |
|---|---|---|
| `chat<T>()` | Parsed JSON with retry on parse failure | Analysis, triage (structured output) |
| `chatRaw()` | Raw string | Article text generation |
| `chatStream()` | AsyncIterable (SSE) | Real-time chat streaming |

**Built-in protections:**
- **JSON auto-retry** — If AI returns malformed JSON, it re-sends with a correction message
- **Rate limit detection** — Catches HTTP 429, throws `AIRateLimitError` with `retryAfterMs`
- **Thinking block stripping** — Automatically removes `<think...>` blocks from DeepSeek-R1 responses
- **Stream timeout** — If no chunk arrives within 30 seconds, the stream is terminated
- **90-second default timeout** — Prevents hanging requests

**Model routing:**

| Task | Gateway | Model |
|---|---|---|
| Triage | DeepSeek Direct → OpenRouter fallback | `deepseek-chat` → `gpt-5-nano` |
| Deep Analysis | DeepSeek Direct → OpenRouter fallback | `deepseek-chat` → `deepseek/deepseek-r1` |
| Article Writing | OpenRouter | `openai/gpt-5-nano` |
| Chat | OpenRouter | `openai/gpt-4.1-mini` |
| Quality Audit | DeepSeek Direct | `deepseek-chat` |
| Embeddings | OpenRouter or Ollama | `text-embedding-3-small` / `nomic-embed-text` |

### PromptFactory — Centralized Prompt Templates

`services/ai/prompt-factory.ts`

All prompts live in one file. This makes prompt engineering systematic and version-controlled:

- **`buildTriageMessages()`** — Batch classification of 10 news items in a single call (cheaper than 10 individual calls)
- **`buildDeepAnalysisMessages()`** — Feeds DeepSeek full context: current price, 24h change, ATH date, 52-week range, 8-week trend, 30-day change, Wikipedia background, historical event patterns. Output is strict JSON — no free text, no hallucination surface
- **`buildArticleWriterMessages()`** — GPT-nano operates as a writer, not an analyst. Strict rules: no new analysis, no verdict changes, no fabricated numbers. Tone: Bloomberg meets Reddit. Minimum one number per paragraph
- **`buildChatMessages()`** — Two modes: general crypto chat and context-aware (injects Master Article + Timeline + Coin Memory)

### CacheManager — LRU In-Memory Cache

`services/ai/cache-manager.ts`

```typescript
class CacheManager {
    private ttlMs = 3_600_000   // 1 hour default TTL
    private maxSize = 1000      // Max 1000 entries
    // Auto-cleanup every 5 minutes
    // Evicts oldest 20% when maxSize is reached
    // Keys are SHA-256 hashes
}
```

Primary use case: caching triage responses so the same news batch is never sent to AI twice.

### CircuitBreaker — Runaway Cost Prevention

`services/circuitBreaker.service.ts`

```typescript
class CircuitBreaker {
    private maxFailures = 5       // Opens after 5 consecutive failures
    private cooldownMs = 30 * 60_000  // 30 minute cooldown
}
```

Separate circuit breakers per service: `deepseekBreaker`, `gptNanoBreaker`, `binanceBreaker`, `dexscreenerBreaker`.

**Practical scenario:** If DeepSeek fails 5 times consecutively, the circuit opens and blocks all requests to it for 30 minutes — protecting against runaway API bills.

### FactualGrounding — Hallucination Filter

`services/ai/factual-grounding.ts`

Validates AI-generated support/resistance levels against actual current price:

```typescript
// If DeepSeek says Support = $1 and BTC = $90,000
// It gets filtered out because it's outside ±50% of current price
const lowerBound = currentPrice * 0.50;
const upperBound = currentPrice * 1.50;
// Only keeps logically plausible levels
```

### QualityAuditor — Cross-Model Review

`services/ai/quality-auditor.ts`

DeepSeek reviews articles written by GPT-nano. The analysis model audits the writing model:

```
Triggers ONLY if: analysisResult.impactScore >= 75 OR analysisResult.isBreaking
```

Checks:
- Verdict in article matches analysis verdict
- Numbers are accurate
- Article is 800+ words
- `metaTitle` < 60 characters
- `metaDescription` < 160 characters

Skipped for normal news to save cost.

---

## Database Schema

### Market Tables (`models/market.model.ts`) — 12 tables

| Table | Purpose | Key Columns |
|---|---|---|
| `coin_master_articles` | Living Article per coin | `headline`, `coreCatalyst`, `marketContext`, `strategicImpact`, `historicalContext`, `technicalLevels`, `riskAssessment`, `bottomLine`, `conviction_score` (0-100), `posture`, `majorUpdateCount`, `minorUpdateCount` |
| `coin_timeline_updates` | Events attached to Living Articles | `masterArticleId` (FK), `updateText`, `triggerType` (security/regulation/market/whale/news/technical), `severity` (MAJOR/MINOR), `sentiment`, `impactScore`, `convictionDelta` |
| `raw_news_buffer` | Raw news pre-processing staging area | `title`, `source`, `sourceHash` (SHA-256), `processed` (bool), `relevanceScore`, `classification`, `symbolMentions` (JSONB), `embedding` (vector 1536), `ttlExpiresAt` |
| `coin_news` | Final published articles | `headline`, `summary`, `hook`, `content`, `metaTitle`, `metaDescription`, `sentiment`, `impactScore`, `sourceURL` |
| `radar_signals` | Alpha Radar signals (STRONG_BUY/SELL only) | `symbol`, `signal`, `confidence`, `source` |
| `daily_alpha_focus` | Daily top pick | `symbol`, `thesis`, `convictionScore`, `entryZone` |
| `daily_market_mood` | Composite Fear & Greed | `externalScore` (Alternative.me), `internalScore` (calculated), `blendedScore` |
| `price_snapshots` | Price history for timelines | `symbol`, `price`, `timestamp` |
| `coin_memory` | AI event memory per coin | `symbol`, `eventType`, `description`, `occurredAt` |
| `coin_intelligence_cache` | Cached fundamentals (ATH, 52w, trend) | `symbol`, `ath`, `athDate`, `week52High`, `week52Low`, `wikiBackground`, `dexBoost` |
| `coin_news_history` | Historical news with price impact | 7-day price outcome tracking + rug-pull flag |
| `market_insights` | AI verdicts per coin | `verdict`, `confidence`, `rsi`, `volume`, `riskLevel`, `keyDrivers`, `redFlags` |

### User Tables (`models/user.model.ts`) — 5 tables

| Table | Purpose |
|---|---|
| `users` | Accounts with plan tiers: `free` / `pro` / `institutional`. Includes `isOgGenesis` flag for early adopters |
| `user_wallets` | Web3 wallet tracking with multi-chain support (`chains` text array) |
| `api_keys` | API key management with per-key rate limits |
| `sessions` | JWT session tokens with IP and user-agent tracking |
| `user_preferences` | Notification toggles (email, breaking news, airdrop deadlines, alpha focus) + preferred coins |

### Airdrop Tables (`models/airdrop.model.ts`)

Dedicated tables for airdrop tracking, task management, and verification status.

---

## Cron Jobs

All crons are registered in `server.ts` and start sequentially with a **5-second stagger** to prevent simultaneous boot:

```typescript
crons.forEach((cron, index) => {
    setTimeout(() => cron.fn(), index * 5000);
});
```

| Cron | Schedule | File | What It Does |
|---|---|---|---|
| **AiWorkflow** | `0 * * * *` (hourly) | `aiWorkflow.cron.ts` | Full pipeline: dedup → analysis → article → memory → radar → cache invalidation |
| **TriageEngine** | `0 */2 * * *` (every 2h) | `triageEngine.cron.ts` | Classifies 50 news items in batches of 10 |
| **TerminalEngine** | `*/10 * * * *` (every 10min) | `terminalEngine.cron.ts` | Pulls RSS/CryptoPanic/Reddit into buffer |
| **ConvictionUpdate** | `0 */6 * * *` (every 6h) | `convictionUpdate.cron.ts` | Recalculates conviction scores with incremental delta + time decay |
| **DailyAlpha** | `0 8 * * *` (08:00) | `dailyAlpha.cron.ts` | Selects the strongest coin as "Alpha of the Day" |
| **MarketMood** | `*/30 * * * *` (every 30min) | `marketMood.cron.ts` | Blends external Fear & Greed with internal signals |
| **HistoricalNews** | `0 3 * * *` (03:00) | `historicalNews.cron.ts` | Backfills historical news + 7-day price outcomes |
| **BufferCleanup** | `0 * * * *` (hourly) | `bufferCleanup.cron.ts` | Deletes expired TTL entries from buffer |
| *AirdropHunter* | Disabled | `airdropHunter.cron.ts` | Airdrop discovery (temporarily disabled) |

**Mutex Lock in AiWorkflow:**

```typescript
// Redis SET with NX (only if Not eXists) + EX 900 seconds
const lockAcquired = await redis.set('cron:aiworkflow:lock', '1', 'EX', 900, 'NX');
if (!lockAcquired) return; // Prevents concurrent runs even with multiple instances
```

---

## API & Middleware

### Middleware Stack (ordered in `server.ts`)

```
Request
   │
   ▼
Helmet          ← Security headers (XSS, clickjacking, CSP)
   │
   ▼
CORS            ← onlyalphacrypto.com (prod) / localhost:3000 (dev)
   │
   ▼
JSON Parser     ← Max 10KB body limit
   │
   ▼
Time Middleware ← Adds X-Response-Time header
   │
   ▼
Routes (/api/*)
   │
   ├── auth.middleware.ts       ← JWT verification
   │
   ├── rateLimit.middleware.ts  ← Redis Lua atomic rate limiting
   │   ├── apiLimiter           ← 60 req/min (all endpoints)
   │   ├── chatLimiter          ← 20 req/min (chat)
   │   └── authLimiter          ← 10 req/15min (login)
   │
   ├── chat-quota.middleware.ts ← Daily message quotas per plan
   │
   ├── guest-limit.middleware.ts← Guest restrictions
   │
   ├── apiKey.middleware.ts     ← API key authentication
   │
   └── errorHandler.ts          ← Centralized error responses
```

### Rate Limiting — Why Lua and Not Plain INCR?

```lua
-- Atomic INCR + EXPIRE (race-condition-proof)
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
```

Plain `INCR` + `EXPIRE` are two separate Redis operations — a race condition can cause the expiry to never be set. The Lua script runs them atomically.

### Tiered Rate Limits

| Plan | Requests / Hour |
|---|---|
| Free | 60 |
| Pro | 500 |
| Institutional | 5000 |

Graceful degradation: if Redis is down, development mode allows all requests through; production returns 503.

### Chat Quotas (Redis-based)

| Tier | Messages / Day | Context Messages |
|---|---|---|
| Guest | 5 | — |
| Free | 15 | — |
| Pro | 999 | 30 |

---

## Living Articles

Instead of publishing 50 articles about BTC in a month, OnlyAlpha maintains **one Master Article per coin** that evolves with the market.

### Lifecycle

```
New MAJOR event for BTC
        │
        ▼
  Master Article exists?
        │
   ┌────┴────┐
  NO        YES
   │          │
   ▼          ▼
Create      callGptNanoMasterUpdate()
new master   ← Analyzes current story state
article      ← Determines which sections need updating
             ← Writes only the changed sections
   │          │
   └────┬─────┘
        │
        ▼
  Insert into coin_timeline_updates (MAJOR)
        │
        ▼
  Update majorUpdateCount + lastMajorUpdate

─────────────────────────────────

New MINOR event for BTC
        │
        ▼
  callGptNanoMinorUpdate()
  ← Writes 1-2 paragraph update
        │
        ▼
  Insert into coin_timeline_updates (MINOR)
        │
        ▼
  Update minorUpdateCount + lastMinorUpdate
```

### Master Article Sections

| Section | Content |
|---|---|
| `headline` | Dynamic headline reflecting latest thesis |
| `coreCatalyst` | Primary driver of the coin's current narrative |
| `marketContext` | Broader market conditions affecting the coin |
| `strategicImpact` | Forward-looking impact assessment |
| `historicalContext` | Relevant historical parallels |
| `technicalLevels` | Key support/resistance levels |
| `riskAssessment` | Identified risks and warning signs |
| `bottomLine` | Executive summary in one sentence |

---

## Conviction Score Engine

Pure algorithmic system — **zero AI calls**.

### The Formula

```
Score starts at 50 (neutral)

For each timeline event:
    normalizedImpact = impactScore / 20
    severityMult     = MAJOR: 3.0 | MINOR: 1.0

    if bearish:
        delta = -normalizedImpact × severityMult × 1.4  (bearish penalty)
    if bullish:
        delta = +normalizedImpact × severityMult

    score = clamp(score + delta, 0, 100)

Every 6 hours (Time Decay):
    score = 50 + (score - 50) × 0.99
    // 80 → 79.7  (drifts toward 50 over time)
```

### Posture Mapping

| Score | Posture |
|---|---|
| 80–100 | `strong_accumulate` |
| 60–79 | `accumulate` |
| 40–59 | `neutral` |
| 20–39 | `distribute` |
| 0–19 | `strong_distribute` |

### Trend Calculation

Compares last 7 days of events vs. previous 7 days:

```
recentSum > previousSum + 2  → rising
recentSum < previousSum - 2  → falling
else                         → stable
```

### Constants (`conviction.service.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `TIME_DECAY_FACTOR` | `0.99` | 1% mean-reversion per cycle |
| `BEARISH_PENALTY` | `1.4` | Bearish events weighted 40% heavier |
| `IMPACT_NORMALIZER` | `20` | Scales impactScore (0-100) to meaningful deltas |

---

## Semantic Deduplication (pgvector)

### How It Works

```
New headline: "Bitcoin ETF Approved by SEC"
        │
        ▼
generateEmbedding(text)
→ [0.023, -0.156, 0.891, ...]  (1536 dimensions)
        │
        ▼
SQL with cosine similarity:
  SELECT id, 1 - (embedding <=> $1::vector) AS similarity
  FROM raw_news_buffer
  WHERE symbol_mentions @> $2::jsonb
    AND embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector
  LIMIT 1
        │
        ▼
  similarity >= 0.88?  ──YES──▶ DUPLICATE → SKIP
        │ NO
        ▼
  Process the news + store its embedding
```

### Threshold Logic

| Similarity | Action |
|---|---|
| 0.88+ | Same news, different wording → skip |
| 0.70–0.87 | Related but distinct → process |
| < 0.70 | Different topic entirely → process |

### Embedding Providers

| Provider | Config | Tradeoff |
|---|---|---|
| OpenRouter | `EMBEDDING_PROVIDER=openrouter` | Online, accurate, costs per call |
| Ollama | `EMBEDDING_PROVIDER=ollama` | Local, free, requires GPU |

**Fallback:** If the embedding service is down, keyword-based matching is used at zero cost.

---

## Environment Variables

All variables are validated at startup via Zod (`config/env.ts`). The server **refuses to start** if required variables are missing.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (note: `@` in passwords must be encoded as `%40`) |
| `JWT_SECRET` | Min 32 characters |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `MORALIS_API_KEY` | Moralis API key for on-chain data |

### Optional

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `5000` | Express server port |
| `REDIS_URL` | — | Redis connection (omit = caching disabled, rate limiting degraded) |
| `JWT_EXPIRES_IN` | `7d` | Token expiration |
| `CHAT_MODEL` | `openai/gpt-4.1-mini` | Chat model (separate from SEO for cost/speed) |
| `SEO_MODEL` | `openai/gpt-5-nano` | Article writing and triage model |
| `DEEPSEEK_MODEL` | `deepseek/deepseek-r1` | DeepSeek model via OpenRouter |
| `DEEPSEEK_API_KEY` | — | Direct DeepSeek API key (bypasses OpenRouter, cheaper) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Direct DeepSeek endpoint |
| `DEEPSEEK_MODEL_DIRECT` | `deepseek-chat` | Direct DeepSeek model name |
| `BINANCE_API_KEY` | — | Binance authenticated requests |
| `BINANCE_SECRET` | — | Binance secret key |
| `TAVILY_API_KEY` | — | Tavily search API (emergency fallback) |
| `BIRDEYE_API_KEY` | — | Birdeye API for DEX chart candles |
| `COINCAP_API_KEY` | — | CoinCap price fallback |
| `ALTERNATIVE_ME_URL` | `https://api.alternative.me/fng/` | Fear & Greed Index endpoint |
| `EMBEDDING_PROVIDER` | `openrouter` | `openrouter` or `ollama` |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama instance |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `NEXTJS_REVALIDATE_SECRET` | — | Secret for ISR cache revalidation |
| `NEXTJS_BASE_URL` | — | Next.js app URL for revalidation webhook |

---

## Installation

### Prerequisites

- Node.js v20+ (LTS recommended)
- npm v10+
- PostgreSQL v14+ (or a [Neon.tech](https://neon.tech) account — pgvector enabled automatically)
- Redis (optional for dev, required for production)

### Setup

```bash
# 1. Clone
git clone https://github.com/your-repo/onlyalpha.git
cd onlyalpha

# 2. Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run db:push          # Push schema (development)
# OR
npm run db:generate      # Generate SQL migration files
npm run db:migrate       # Apply migrations

# 3. pgvector (self-hosted PostgreSQL only — Neon does this automatically)
psql -U postgres -d onlyalpha -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Frontend
cd ../frontend
npm install
cp .env.example .env.local

# 5. Run
# Terminal 1:
cd backend && npm run dev     # http://localhost:5000
# Terminal 2:
cd frontend && npm run dev    # http://localhost:3000

# 6. Verify
curl http://localhost:5000/api/health
# → { "status": "ok", "db": "connected", "ts": "..." }

# 7. Visual DB browser
cd backend && npm run db:studio   # http://localhost:4983
```

### Production

```bash
# Backend
cd backend
npm run build        # Compile TypeScript → dist/
npm start            # Runs dist/server.js

# Frontend (deployed via Netlify)
cd frontend
npm run build        # Next.js production build
# See netlify.toml for deployment config
```

### Purge Data

```bash
cd backend
npm run db:purge     # Clears all data (use with caution)
```

---

## Folder Structure

```
OnlyAlpha/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts              ← Drizzle + pg Pool (max 20 conn) + pgvector registration
│   │   │   ├── env.ts             ← Zod-validated env schema (server won't start if invalid)
│   │   │   └── redis.ts           ← ioredis (lazy connect) + getCache/setCache/deleteCache
│   │   │
│   │   ├── crons/                 ← 9 scheduled tasks
│   │   │   ├── aiWorkflow.cron.ts       ← Central intelligence pipeline
│   │   │   ├── triageEngine.cron.ts     ← Phase 1B: news classification
│   │   │   ├── terminalEngine.cron.ts   ← Phase 1A: news gathering
│   │   │   ├── convictionUpdate.cron.ts ← Incremental conviction scoring
│   │   │   ├── marketMood.cron.ts       ← Composite Fear & Greed
│   │   │   ├── dailyAlpha.cron.ts       ← Daily spotlight selection
│   │   │   ├── historicalNews.cron.ts   ← Historical backfill
│   │   │   ├── bufferCleanup.cron.ts    ← TTL cleanup
│   │   │   └── airdropHunter.cron.ts    ← (disabled)
│   │   │
│   │   ├── services/              ← 25 service files
│   │   │   ├── ai/                ← AI infrastructure layer (5 files)
│   │   │   │   ├── ai-gateway.ts        ← Dual provider + streaming + timeout
│   │   │   │   ├── cache-manager.ts     ← LRU in-memory cache (1h TTL, 1000 max)
│   │   │   │   ├── prompt-factory.ts    ← All prompts centralized
│   │   │   │   ├── quality-auditor.ts   ← Cross-model review (DeepSeek audits GPT-nano)
│   │   │   │   └── factual-grounding.ts ← Hallucination filter (±50% price sanity)
│   │   │   │
│   │   │   ├── openai.service.ts        ← AI orchestration (triage/analysis/write/chat)
│   │   │   ├── embedding.service.ts     ← pgvector embeddings generation + storage
│   │   │   ├── similarity.service.ts    ← Dedup coordinator (embedding + keyword fallback)
│   │   │   ├── conviction.service.ts    ← Algorithmic scoring engine
│   │   │   ├── coinIntelligence.service.ts ← ATH, 52w range, trend, wiki background
│   │   │   ├── temporalIntelligence.service.ts ← Historical pattern matching
│   │   │   ├── dynamicThreshold.service.ts   ← Adaptive relevance threshold
│   │   │   ├── priceService.ts          ← Multi-source price fetching
│   │   │   ├── circuitBreaker.service.ts ← Per-service failure protection
│   │   │   ├── binance.service.ts       ← Market data
│   │   │   ├── binanceHistory.service.ts← Historical price data
│   │   │   ├── dexscreener.service.ts   ← DEX trending + liquidity
│   │   │   ├── cryptopanic.service.ts   ← News aggregation
│   │   │   ├── reddit.service.ts        ← Reddit sentiment
│   │   │   ├── rssNews.service.ts       ← RSS feed aggregator
│   │   │   ├── tavily.service.ts        ← Emergency web search
│   │   │   ├── moralis.service.ts       ← On-chain data
│   │   │   ├── wikipedia.service.ts     ← Background research
│   │   │   ├── coin-memory.service.ts   ← AI event memory
│   │   │   └── verification.service.ts  ← Data verification
│   │   │
│   │   ├── middleware/            ← 7 middleware files
│   │   │   ├── auth.middleware.ts       ← JWT verification
│   │   │   ├── rateLimit.middleware.ts  ← Redis Lua atomic rate limiting
│   │   │   ├── chat-quota.middleware.ts ← Daily message quotas (Redis)
│   │   │   ├── guest-limit.middleware.ts← Guest access restrictions
│   │   │   ├── apiKey.middleware.ts     ← API key authentication
│   │   │   ├── time.middleware.ts       ← X-Response-Time header
│   │   │   └── errorHandler.ts          ← Centralized error responses
│   │   │
│   │   ├── models/                ← Drizzle ORM schema definitions
│   │   │   ├── index.ts               ← Re-exports all tables
│   │   │   ├── market.model.ts        ← 12 market tables
│   │   │   ├── user.model.ts          ← 5 user tables
│   │   │   └── airdrop.model.ts       ← Airdrop tables
│   │   │
│   │   ├── controllers/           ← 7 API endpoint handlers
│   │   │   ├── health.controller.ts
│   │   │   ├── market.controller.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chart.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── apiKey.controller.ts
│   │   │   └── airdrop.controller.ts
│   │   │
│   │   ├── routes/                ← 6 Express router files
│   │   │   ├── index.ts
│   │   │   ├── market.routes.ts
│   │   │   ├── chat.routes.ts
│   │   │   ├── chart.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   └── airdrop.routes.ts
│   │   │
│   │   ├── scripts/               ← One-time seed/backfill scripts
│   │   ├── utils/                 ← Logger (Winston) + crypto helpers
│   │   └── server.ts              ← Entry point + bootstrap + graceful shutdown
│   │
│   ├── drizzle/                   ← Generated SQL migration files
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                   ← Next.js App Router (8 pages)
│   │   │   ├── page.tsx                       ← Home / Dashboard
│   │   │   ├── layout.tsx                     ← Root layout (Sidebar + TickerBar)
│   │   │   ├── auth/page.tsx                  ← Login / Register
│   │   │   ├── settings/page.tsx              ← Billing & Preferences
│   │   │   ├── terminal/page.tsx              ← Terminal landing
│   │   │   ├── terminal/[coin]/page.tsx       ← Coin terminal detail
│   │   │   ├── terminal/[coin]/alpha/page.tsx ← Living Article view
│   │   │   ├── airdrops/page.tsx              ← Airdrop listing
│   │   │   └── airdrops/[id]/page.tsx         ← Airdrop detail + tasks
│   │   │
│   │   ├── features/              ← Feature-scoped modules (37 files)
│   │   │   ├── shared/            ← TickerBar, Sidebar, SectionHeader, API client
│   │   │   ├── home/              ← RadarGrid, AlphaFocus, MarketMood, TopMovers, AirdropWatchlist
│   │   │   ├── terminal/          ← Chat, Wire, Chart, LivingArticle, Timeline, AlphaStream, AlphaSnapshot
│   │   │   ├── settings/          ← PricingCards, WalletManager, ApiKeyManager, PreferencesPanel, OgBadge
│   │   │   └── airdrop/           ← TaskList
│   │   │
│   │   └── lib/                   ← Global utilities (Tailwind merge)
│   │
│   └── package.json
│
├── netlify.toml                   ← Frontend CI/CD (Netlify + @netlify/plugin-nextjs)
├── plans/                         ← Execution plans & task tracking
└── doc/                           ← Feature specs, AI audit logs, terminal reports
```

---

## Cost Optimization

Three-tier strategy to minimize AI spend while maximizing intelligence quality:

### Tier 1 — Pre-AI Filtering (Zero AI Cost)

| Mechanism | Savings |
|---|---|
| SHA-256 Hash Dedup | Eliminates exact duplicates before any processing |
| TTL Cleanup (48h) | Auto-deletes stale news from buffer |
| Hourly Cap (5 max) | Hard limit on articles processed per hour |

### Tier 2 — Cheap AI (Low Cost)

| Mechanism | Savings |
|---|---|
| Batch Triage (10 per call) | 1 AI call instead of 10 |
| NOISE Classification | Stops processing immediately — no further cost |
| MINOR Path | GPT-nano only (cheapest model) |
| Circuit Breakers | Stops all requests to a failing provider for 30 min |

### Tier 3 — Full Pipeline (High Value Only)

| Mechanism | Savings |
|---|---|
| Semantic Dedup (pgvector) | Prevents re-processing similar news before DeepSeek |
| DeepSeek Direct | 60-80% cheaper than OpenRouter for the same model |
| Quality Audit | Only runs when `impactScore >= 75` |
| Conviction Score | Zero AI calls — pure algorithm |

---

## Code Quality

| Standard | Implementation |
|---|---|
| **Zero `any` types** | Enforced across all files. Use `unknown`, generics, or specific interfaces |
| **Strict TypeScript** | `strict: true` in tsconfig |
| **Zod validation** | Runtime validation for env vars and AI responses |
| **Centralized prompts** | Single `prompt-factory.ts` — no prompt strings scattered in business logic |
| **Centralized cache** | Single `cache-manager.ts` — LRU with auto-cleanup |
| **Graceful shutdown** | `SIGTERM`/`SIGINT` closes DB pool + Redis connection |
| **Structured logging** | Winston with levels — no random `console.log` |
| **No circular imports** | Each module is isolated with clear boundaries |
| **Separated concerns** | Routes → Controllers → Services (never skipped) |
| **Null-safe Redis** | All cache functions are no-ops when Redis is unavailable |

---

<p align="center">
  <em>Built for the next generation of Web3 traders — where signal beats noise.</em>
</p>
