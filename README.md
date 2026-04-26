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
- [Strategic Intelligence Layer](#strategic-intelligence-layer)
- [Signal Performance Tracking](#signal-performance-tracking)
- [Semantic Deduplication (pgvector)](#semantic-deduplication-pgvector)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Folder Structure](#folder-structure)
- [Cost Optimization](#cost-optimization)
- [Code Quality](#code-quality)
- [Changelog](#changelog)

---

## Philosophy

OnlyAlpha is not a news aggregator. It is a **multi-agent intelligence system** built on three principles:

```
[SENSE]  →  Ingest every signal from every source simultaneously
[THINK]  →  AI triage, deep analysis, cross-validation, hallucination filtering
[ACT]    →  Living Articles + Conviction Scores + Alpha Radar + Strategic Outlook
```

**The problem:**
- 99% of crypto news is noise with zero actionable value
- Traders waste hours reading repetitive articles about the same event
- No system tracks how a coin's narrative evolves across time

**The solution:**
- **Triage First** — every headline is AI-classified before any expensive processing
- **Living Articles** — one persistent document per coin that evolves with the market, not 50 disjointed articles
- **Incremental Conviction** — algorithmic score (0-100) with zero AI cost, decaying toward neutral over time
- **Strategic Outlook** — forward-looking intelligence with short/long-term price targets, invalidation levels, and recommended actions
- **Signal P&L** — every radar signal is tracked at 24h/7d/30d with win rates to measure real alpha

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16 App Router)                │
│                                                                      │
│  /                  /terminal/[coin]    /settings    /airdrops       │
│  Home (Dashboard)   Alpha Terminal      Billing       Hunter         │
│                                                                      │
│  /archive           /scorecard          (Dynamic AI coins)           │
│  Article Archive    Signal P&L          /terminal/[coin]             │
│                                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐      │
│  │MarketMood│  │Living Article│  │ Pro Chat │  │ Airdrop    │      │
│  │AlphaFocus│  │ Wire Feed    │  │ Context  │  │ TaskTracker│      │
│  │RadarGrid │  │ TimelineFeed │  │ Streaming│  │ Wallet Mgr │      │
│  │TopMovers │  │ AlphaStream  │  │          │  │            │      │
│  └──────────┘  └──────────────┘  └──────────┘  └────────────┘      │
└────────────────────────┬─────────────────────────────────────────────┘
                         │  REST API (JSON) + SSE (Chat Stream)
┌────────────────────────▼─────────────────────────────────────────────┐
│                      BACKEND (Express 5 + TypeScript)                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    MIDDLEWARE STACK                         │     │
│  │  Helmet → CORS → JSON (10KB) → URL-Encoded → Time         │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌───────────┐   ┌────────────┐   ┌─────────────────────────┐     │
│  │  Routes   │──▶│Controllers │──▶│       Services          │     │
│  └───────────┘   └────────────┘   │                          │     │
│                                   │  openai.service.ts       │     │
│  ┌──────────────────────────┐     │  ├─ generateLightweight  │     │
│  │     CRON JOBS (12 active)│────▶│  │    Triage()           │     │
│  │  AiWorkflow       hourly │     │  ├─ PromptFactory        │     │
│  │  TerminalEngine  */10min │     │  ├─ QualityAuditor       │     │
│  │  TelegramMonitor */30min │     │  ├─ FactualGrounding     │     │
│  │  SignalPerformance */6h  │     │  ├─ StrategicOutlook     │     │
│  │  AirdropRSS       */6h   │     │  └─ AgentWorkflow        │     │
│  │  AirdropHunter    */12h  │     └─────────────────────────┘     │
│  └──────────────────────────┘                                      │
│  Bootstrap Scripts:                                                 │
│  ├─ Radar Cleanup (dedup)                                           │
│  ├─ Article Repair (incomplete)                                     │
│  └─ Meta Tag Repair (poor/generic meta titles + descriptions)       │
└──────────┬───────────────────┬──────────────────┬────────────────────┘
           │                   │                  │
    ┌──────▼──────┐   ┌───────▼───────┐  ┌───────▼───────┐
    │ PostgreSQL  │   │    Redis      │  │ External APIs │
    │ (Native pg) │   │              │  │               │
    │  pgvector   │   │  Cache Layer │  │  OpenRouter   │
    │  25 tables  │   │  Mutex Locks │  │  DeepSeek Dir │
    │  Drizzle    │   │  Rate Limits │  │  GLM/Zhipu AI │
    │  Schema     │   │  Cron State  │  │  Telegram     │
    └─────────────┘   └──────────────┘  │  Binance      │
                                        │  DexScreener  │
                                        │  Moralis      │
                                        │  Tavily/CoinCap│
                                        │  Alternative.me│
                                        └───────────────┘
```

---

## Intelligence Pipeline

This is the core of the system — how raw news becomes actionable intelligence.

### Phase 1A — Gathering (TerminalEngine) `*/10 * * * *`

```
┌─────────────────────────────────────────────────────┐
│                  RSS FEEDS (Primary)                │
│  CoinDesk ────────────────────────────────────┐     │
│  Cointelegraph ───────────────────────────────┤     │
│  Decrypt ─────────────────────────────────────┤     │
│  The Block ───────────────────────────────────┤     │
└──────────────────────────────────────────────┤     │
                                                ▼     │
  SHA-256 hash per headline ──▶ Dedup Check ──▶ raw_news_buffer (TTL: 48h)
                                          │
                                    Already exists? → SKIP
```

The gathering engine fetches from **4 direct RSS feeds** (CoinDesk, Cointelegraph, Decrypt, The Block) using `rss-parser`. Each headline gets a SHA-256 hash for exact dedup against both `coin_news` and `raw_news_buffer` before any database write.

### Phase 1A+ — Telegram Monitoring (TelegramMonitor) `*/30 * * * *` (news), `0 */4 * * *` (airdrops)

```
┌─────────────────────────────────────────────────────┐
│              TELEGRAM CHANNELS (Secondary)           │
│  News: whale_alert_io, OKXAnnouncements,            │
│        WuBlockchainReal, CryptoQuantOfficial         │
│  Airdrops: AirdropAlpha, earndrop, AirdropAlert      │
└─────────────────────────────────────────────────────┘
                          │
                    Spam Filter (8 patterns)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      News → raw_news_buffer    Airdrops → airdrop_projects
```

Uses **Telegram MTProto** (gram.js) for direct channel scraping — no API rate limits, no bot accounts. Built-in spam filter blocks pump signals, guaranteed profit scams, and join-group spam. Requires `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION_STRING`.

### Phase 1A+ — Airdrop RSS Discovery (AirdropRSSHunter) `0 */6 * * *`

```
5 verified RSS sources (The Block, Decrypt, CoinDesk, CoinTelegraph, BeInCrypto)
         │
    Airdrop keyword filter (airdrop, snapshot, tge, claim, retrodrop, ...)
         │
    SHA-256 dedup (Redis SET + 7-day TTL, fallback to in-memory Set)
         │
    AI Validation (max 5 calls/run) → airdrop_projects table
         │
    GLM/Zhipu web search enrichment (for short AI responses)
```

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
   SKIP   DeepSeek  DeepSeek Deep Analysis
          Direct    Direct → Factual Grounding (±50% price sanity)
          or        → Writer Gateway (Gemini 2.5 Flash)
          OpenRouter → Quality Audit (if impact >= 75)
          Minor     → Save to coin_news
          Update    → Radar Signal (if actionable verdict)
                    → Update Living Article
                    → Strategic Outlook (if MAJOR + impact >= 70)
                    → Save to coin_memory
                    → Store Embedding (pgvector)
                    → Invalidate Redis Cache
```

**Key routing change:** Both MINOR updates and MAJOR article writing now route through **DeepSeek Direct** when `DEEPSEEK_API_KEY` is set, falling back to OpenRouter only when unavailable. This extends cost savings to the entire pipeline, not just the analysis phase.

**Bootstrap logic:** If a MINOR event arrives for a coin that has no Master Article yet, the system auto-promotes it to MAJOR to create the first Living Article.

**Fallback schema validation & UI:** If AI writer attempts fail strict schema constraints, the system dynamically relaxes validation (e.g., length-only degradation) to salvage partial articles rather than cluttering the UI with placeholders. If all fallback attempts fail, it safely degrades to a raw template-based rendering from the analysis JSON — no article is ever lost.

> **Note:** Service files for CryptoPanic, Reddit, DexScreener, and Tavily exist in `services/` but are **not wired** into the TerminalEngine cron. They are available as extension points for future ingestion expansion.

---

## Tech Stack

### Backend

| Technology | Version | Rationale |
|---|---|---|
| Node.js + TypeScript | v20+ / Strict Mode | Zero `any` types — catch errors at compile time |
| Express 5 | v5.2+ | Automatic async error propagation — no try/catch in every route |
| Drizzle ORM | v0.45+ | Type-safe SQL, faster than Prisma, lower overhead |
| PostgreSQL | v16+ | Native `pg` pool + native pgvector (Dropped Neon serverless for lower latency) |
| pgvector | 0.2+ | Cosine similarity search inside the database |
| Redis (ioredis) | v5.10+ | Caching + Mutex locks + Rate limiting via Lua scripts |
| node-cron | v4.2+ | Cron jobs in-process — no Celery, no external queues |
| Zod | v4.3+ | Runtime validation for env vars and AI responses |
| Winston | v3.19+ | Structured logging with levels (debug/info/warn/error) |
| bcryptjs | v3.0+ | Password hashing |
| jsonwebtoken | v9+ | JWT authentication |
| geoip-lite | v2+ | IP geolocation for security |
| Luxon | v3.7+ | Date/time handling |
| rss-parser | v3.13+ | Direct RSS feed parsing (zero-cost news ingestion) |
| request-ip | v3.3+ | Client IP extraction for rate limiting and security |
| axios | v1.13+ | HTTP client for external API calls |
| @langchain/langgraph | v1.2+ | Agent workflow orchestration (LangGraph StateGraph) for planner/coder/QA loops |
| telegram (gram.js) | v2.26+ | Telegram MTProto client for direct channel scraping |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js 16 (App Router) | v16.1+ | Server Components + ISR revalidation for Living Articles |
| React 19 | v19.2+ | Concurrent features + Server Actions |
| Tailwind CSS 4 | v4+ | Utility-first styling — zero CSS files |
| Framer Motion | v12.35+ | Animations for Terminal and Radar |
| Lightweight Charts (TradingView) | v4.1+ | Financial charts with candlestick support |
| Lucide React | v0.577+ | Icon library |
| date-fns | v4.1+ | Date formatting |
| tailwind-merge | v3.5+ | Class name conflict resolution |

### AI & Data Layer

| Service | Role | Details |
|---|---|---|
| OpenRouter | Primary AI Gateway | Unified access to GPT-5-nano, GPT-4.1-mini, and DeepSeek (fallback) |
| DeepSeek Direct | Primary Analysis Engine | Used directly for analysis, triage, and article writing when key is set |
| GLM / Zhipu AI | Web Search + Agent Workflow | Planner + QA models for agent workflow; web_search tool for airdrop enrichment |
| OpenAI SDK | HTTP Client (v6.25+) | Compatible with all gateways (OpenRouter, DeepSeek, GLM) |
| Telegram MTProto | Channel Monitoring | Direct channel scraping for news + airdrop signals (gram.js) |
| Moralis | On-chain Data | Wallet and token tracking on-chain |
| Binance API | Market Data | Real-time prices, 24h change, volume, Fear & Greed |
| DexScreener | DEX Data | Trending tokens, liquidity, DEX prices |
| Tavily | Emergency Fallback | Web search if other sources fail |
| CoinCap | Price Fallback | Alternative price data if Binance fails |
| Alternative.me | Fear & Greed | Public Fear & Greed Index (no API key needed) |
| Birdeye | DEX Charts | Candle data for DEX charting |

---

## AI Brain

### AIGateway — Multi-Provider Routing

`services/ai/ai-gateway.ts`

The gateway wraps the OpenAI SDK with independent provider instances. Five factory functions are available:

```typescript
// OpenRouter — chat streaming + fallback for all tasks
const gateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// DeepSeek Direct — primary for analysis and triage
const deepseekGateway = env.DEEPSEEK_API_KEY
    ? new AIGateway({
        apiKey: env.DEEPSEEK_API_KEY,
        baseURL: env.DEEPSEEK_BASE_URL,  // https://api.deepseek.com/v1
      })
    : null; // Falls back to OpenRouter if no direct key

// Writer Gateway — dedicated to long-form article writing
const writerGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// GLM/Zhipu — agent workflow (planner + coder + QA)
const glmGateway = createGLMGateway({
    apiKey: env.GLM_API_KEY,
    baseURL: env.GLM_BASE_URL,  // https://open.bigmodel.cn/api/paas/v4
});

// Explicit OpenRouter factory (used by agent workflow coder node)
const openRouterCoder = createOpenRouterGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});
```

**Three invocation modes:**
| Method | Return | Use Case |
|---|---|---|
| `chat<T>()` | Parsed JSON with auto-retry on parse failure | Analysis, triage (structured output) |
| `chatRaw()` | Raw string | Article text generation |
| `chatStream()` | AsyncIterable (SSE) | Real-time chat streaming |

**Built-in protections:**
- **JSON auto-retry** — If AI returns malformed JSON, it re-sends with a correction message
- **Rate limit detection** — Catches HTTP 429, throws `AIRateLimitError` with `retryAfterMs` (capped at 60s)
- **Thinking block stripping** — Automatically removes `</think...>` blocks from DeepSeek-R1 responses
- **Response truncation handling** — `AITruncationError` thrown when responses exceed `LONG_RESPONSE_MAX_TOKENS` (8192)
- **Stream timeout** — If no chunk arrives within 30 seconds, the stream is terminated
- **90-second default timeout** — Prevents hanging requests

**Model routing (current production):**

| Task | Gateway | Model |
|---|---|---|
| Triage | DeepSeek Direct → OpenRouter fallback | `deepseek-chat` → `gpt-5-nano` |
| Deep Analysis | DeepSeek Direct → OpenRouter fallback | `deepseek-chat` → `deepseek/deepseek-r1` |
| Article Writing | Writer Gateway (OpenRouter) | `gemini-2.5-flash` (`WRITER_MODEL`) |
| Minor Updates | OpenRouter | `gpt-5-nano` |
| Chat | OpenRouter | `gpt-4.1-mini` |
| Quality Audit | DeepSeek Direct | `deepseek-chat` |
| Embeddings | OpenRouter or Ollama | `text-embedding-3-small` / `nomic-embed-text` |
| Agent Planner | GLM/Zhipu | `glm-4-plus` (`GLM_PLANNER_MODEL`) |
| Agent QA | GLM/Zhipu | `glm-4-plus` (`GLM_QA_MODEL`) |
| Agent Coder | OpenRouter | `meta-llama/llama-3-8b-instruct:free` (`OPENROUTER_CODER_MODEL`) |

> **Isolated Backend Architecture:** All AI calls are handled exclusively via backend endpoints. The frontend never calls any AI service directly — no API keys, no SDKs, no client-side AI logic.

### AgentWorkflow — LangGraph-Based Code Generation

`services/ai/agent-workflow.ts`

An iterative planner → coder → QA agent loop built on `@langchain/langgraph`:

```
Feature Request
      │
      ▼
  ┌─ Planner (GLM/Zhipu) ─────────────────────────┐
  │  Analyzes feature request → generates plan     │
  └────────────────────┬───────────────────────────┘
                       ▼
  ┌─ Coder (OpenRouter) ──────────────────────────┐
  │  Receives plan + feature request → writes code │
  └────────────────────┬───────────────────────────┘
                       ▼
  ┌─ QA (GLM/Zhipu) ──────────────────────────────┐
  │  Reviews generated code against plan           │
  │  PASSED → return output                        │
  │  FAILED → feedback → back to Coder (max 3x)    │
  └────────────────────┬───────────────────────────┘
                       ▼
  Final Output: { plan, generatedCode, qaResult, iterationsUsed }
```

- Max 3 iterations per node, 6-second retry delay between attempts
- Self-correcting: QA feedback is fed back to the Coder node automatically
- Used for automated feature implementation tasks

### PromptFactory — Centralized Prompt Templates

`services/ai/prompt-factory.ts`

All prompts live in one file. This makes prompt engineering systematic and version-controlled:

- **`buildTriageMessages()`** — Batch classification of 10 news items in a single call (cheaper than 10 individual calls)
- **`buildDeepAnalysisMessages()`** — Feeds DeepSeek full context: current price, 24h change, ATH date, 52-week range, 8-week trend, 30-day change, Wikipedia background, historical event patterns. Output is strict JSON — no free text, no hallucination surface
- **`buildArticleWriterMessages()`** — Writer operates with strict rules: no new analysis, no verdict changes, no fabricated numbers. Tone adapts per event type (urgent/exciting/cautious/optimistic/solemn/analytical/professional)
- **`buildAirdropValidationMessages()`** — Validates airdrop projects for legitimacy and risk assessment
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

Primary use case: caching triage responses so the same news batch is never sent to AI twice. Fallback triage results are also cached to prevent repeated failures on the same batch.

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
const lowerBound = currentPrice * (1 - thresholdPercent / 100);  // default: 50%
const upperBound = currentPrice * (1 + thresholdPercent / 100);
// Only keeps logically plausible levels
```

### QualityAuditor — Cross-Model Review

`services/ai/quality-auditor.ts`

DeepSeek reviews articles written by the article writer. The analysis model audits the writing model:

```
Triggers ONLY if: analysisResult.impactScore >= 75 OR analysisResult.isBreaking
```

Checks:
- Verdict in article matches analysis verdict
- Numbers are accurate
- Article is 800+ words
- `metaTitle` ≤ 60 characters
- `metaDescription` ≤ 160 characters
- Exactly 5 SEO keywords
- Professional tone (no financial advice)

Skipped for normal news to save cost. If audit service is unavailable, article is auto-passed with a warning.

---

## Database Schema

### Market Tables (`models/market.model.ts`) — 16 tables

| Table | Purpose | Key Columns |
|---|---|---|
| `coin_master_articles` | Living Article per coin | `headline`, `coreCatalyst`, `marketContext`, `strategicImpact`, `historicalContext`, `technicalLevels`, `riskAssessment`, `bottomLine`, `convictionScore` (0-100), `posture`, `majorUpdateCount`, `minorUpdateCount`, `hook`, `metaTitle`, `metaDescription`, `seoKeywords`, `verdict`, `confidenceScore`, `riskTags`, `triggerType` |
| `coin_timeline_updates` | Events attached to Living Articles | `masterArticleId` (FK), `updateText`, `triggerType` (security/regulation/market/whale/news/technical), `severity` (MAJOR/MINOR), `sourceTitle`, `sourceHash`, `sentiment`, `impactScore`, `convictionDelta` |
| `raw_news_buffer` | Raw news pre-processing staging area | `title`, `source`, `sourceHash` (SHA-256, unique), `processed` (bool), `relevanceScore`, `classification`, `symbolMentions` (JSONB), `embedding` (vector 1536), `ttlExpiresAt`, `processingAttempts` |
| `coin_news` | Final published articles | `headline`, `summary`, `hook`, `metaTitle`, `metaDescription`, `seoKeywords`, `sentiment`, `impactScore`, `isBreaking`, `sourceHash` (unique), `aiProcessed` |
| `radar_signals` | Alpha Radar signals (actionable verdicts) | `coinSymbol`, `signalText`, `sentiment`, `impactScore`, `newsId` (FK to coin_news) |
| `daily_alpha_focus` | Daily top pick | `insightId` (FK to market_insights), `coinSymbol`, `coinName`, `coinSlug`, `verdict`, `confidenceScore`, `executiveSummary`, `compositeScore`, `validForDate` |
| `daily_market_mood` | Composite Fear & Greed | `externalScore` (Alternative.me), `internalScore` (calculated from radar signals), `finalScore` (60% external + 40% internal), `label`, `validForDate` |
| `price_snapshots` | Price history for timelines | `coinSymbol`, `price`, `liquidity`, `volume24h`, `timestamp` |
| `coin_memory` | AI event memory per coin | `coinSymbol`, `eventType`, `eventSummary`, `priceAtEvent`, `verdict`, `confidenceScore`, `riskVerdict`, `keyDrivers` (JSON), `redFlags` (JSON), `sourceNewsHashes` (JSON) |
| `coin_intelligence_cache` | Cached fundamentals (ATH, 52w, trend) | `coinSymbol` (PK), `ath`, `athDate`, `week52High`, `week52Low`, `trend8w`, `priceChange30d`, `wikiBackground`, `dexBoostActive`, `dataSource`, `cachedAt` |
| `coin_news_history` | Historical news with price impact | `coinSymbol`, `title`, `source`, `publishedAt`, `sentiment`, `eventType`, `eventSeverity`, `priceAtTime`, `price7dAfter`, `priceChange7d`, `isRugPull` |
| `market_insights` | AI verdicts per coin | `coinSymbol`, `coinName`, `coinSlug`, `verdict`, `confidenceScore`, `executiveSummary`, `supportLevels` (JSON), `resistanceLevels` (JSON), `rsiValue`, `volumeSurge`, `tvlChange`, `socialMomentum`, `priceAtAnalysis`, `riskLevel`, `redFlags` (JSON), `keyDrivers` (JSON), `marketContext` |
| `migration_flags` | One-time task execution tracker | `flagName` (unique), `executedAt` |
| `signal_performance` | P&L tracking for radar signals | `signalId`, `coinSymbol`, `verdict`, `sentiment`, `entryPrice`, `entryAt`, `price24h/7d/30d`, `pnl24h/7d/30d`, `isWin7d/30d` |
| `coin_strategic_outlook` | Forward-looking intelligence per coin | `shortTermDirection/target/invalidation/catalysts/confidence`, `longTermPhase/bullProbability/support/resistance/bottomIn/topIn/evidence`, `recommendedAction/rationale/riskManagement` (22 columns) |
| `smart_event_responses` | Action plans for major events | `coinSymbol`, `eventType`, `eventTitle`, `immediateImpact`, `historicalParallels`, `recommendedAction`, `watchLevels`, `timeHorizon`, `isActive` |

### User Tables (`models/user.model.ts`) — 5 tables

| Table | Purpose |
|---|---|
| `users` | Accounts with plan tiers: `free` / `pro` / `institutional`. Includes `isOgGenesis` flag for early adopters |
| `user_wallets` | Web3 wallet tracking with multi-chain support (`chains` text array) |
| `api_keys` | API key management with per-key rate limits and last-used tracking |
| `sessions` | JWT session tokens with IP and user-agent tracking |
| `user_preferences` | Notification toggles (email, breaking news, airdrop deadlines, alpha focus) + preferred coins |

### Airdrop Tables (`models/airdrop.model.ts`) — 4 tables

| Table | Purpose |
|---|---|
| `airdrop_projects` | Airdrop project registry — name, network, logo, estimated value, AI risk report (`riskVerdict`: LOW/MEDIUM/HIGH/SCAM), funding round, social links, snapshot/TGE dates |
| `airdrop_tasks` | Per-project task list — description, contract address, min amount, chain, auto-verification flag |
| `user_progress` | Per-user task completion — tracks wallet, completion status, verification method (auto/manual), tx hash |
| `airdrop_pipeline_runs` | Pipeline health monitoring — `runType`, `articlesFound/Processed`, `projectsInserted/Rejected`, `errors`, `durationMs`, `notes` |

---

## Cron Jobs

All crons are registered in `server.ts` and start sequentially with a **5-second stagger** to prevent simultaneous boot:

```typescript
const crons = [
    { name: 'AiWorkflow', fn: startAiWorkflowCron },
    { name: 'AirdropHunter', fn: startAirdropHunterCron },
    { name: 'AirdropRSSHunter', fn: startAirdropRSSCron },
    { name: 'DailyAlpha', fn: startDailyAlphaCron },
    { name: 'HistoricalNews', fn: startHistoricalNewsCron },
    { name: 'MarketMood', fn: startMarketMoodCron },
    { name: 'TerminalEngine', fn: startTerminalEngineCron },
    { name: 'TriageEngine', fn: startTriageEngineCron },
    { name: 'BufferCleanup', fn: startBufferCleanupCron },
    { name: 'ConvictionUpdate', fn: startConvictionUpdateCron },
    { name: 'TelegramMonitor', fn: startTelegramMonitorCron },
    { name: 'SignalPerformance', fn: startSignalPerformanceCron },
];

crons.forEach((cron, index) => {
    setTimeout(() => cron.fn(), index * 5000);
});
```

| Cron | Schedule | File | What It Does |
|---|---|---|---|
| **AiWorkflow** | `0 * * * *` (hourly) | `aiWorkflow.cron.ts` | Full pipeline: dedup → analysis → article → quality audit → memory → radar → strategic outlook → cache invalidation |
| **TriageEngine** | `0 */2 * * *` (every 2h) | `triageEngine.cron.ts` | Classifies 50 news items in batches of 10 |
| **TerminalEngine** | `*/10 * * * *` (every 10min) | `terminalEngine.cron.ts` | Pulls 4 RSS feeds into buffer |
| **TelegramMonitor** | `*/30 * * * *` (news), `0 */4 * * *` (airdrops) | `telegramMonitor.cron.ts` | Scrapes 7 Telegram channels (4 news + 3 airdrop) with spam filtering |
| **ConvictionUpdate** | `0 */6 * * *` (every 6h) | `convictionUpdate.cron.ts` | Recalculates conviction scores with incremental delta + time decay |
| **SignalPerformance** | `0 */6 * * *` (every 6h) | `signalPerformance.cron.ts` | Tracks P&L of radar signals at 24h/7d/30d intervals, calculates win rates |
| **AirdropRSSHunter** | `0 */6 * * *` (every 6h) | `airdropRssHunter.cron.ts` | RSS-based airdrop discovery with Redis dedup + AI validation + GLM enrichment |
| **AirdropHunter** | `0 */12 * * *` (every 12h) | `airdropHunter.cron.ts` | Airdrop routine sync |
| **DailyAlpha** | `0 6 * * *` (06:00 UTC) | `dailyAlpha.cron.ts` | Selects the strongest coin as "Alpha of the Day" (composite scoring) |
| **MarketMood** | `0 7 * * *` (07:00 UTC) | `marketMood.cron.ts` | Blends external Fear & Greed with internal radar signals |
| **HistoricalNews** | `0 4 * * *` (04:00 UTC) | `historicalNews.cron.ts` | Backfills historical news + 7-day price outcomes |
| **BufferCleanup** | `0 0 * * *` (midnight) | `bufferCleanup.cron.ts` | Deletes expired TTL entries from buffer |

**Concurrency protection:** All crons use an in-memory `isRunning` flag to prevent concurrent execution. AiWorkflow additionally uses a **Redis mutex lock** (`SET NX EX 900`) for cross-instance safety.

**Workflow timeout:** AiWorkflow has a hard 10-minute timeout — if it exceeds this, the lock is force-released to prevent deadlock.

**Bootstrap scripts** (run once on server startup):
- `runRadarCleanup()` — Deduplicates radar signals
- `runArticleRepair()` — Auto-repairs incomplete master articles (guarded by `migration_flags` table)
- `runMetaTagRepair()` — Auto-repairs poor/generic meta titles and descriptions on master articles (non-blocking, guarded by `migration_flags` table)

---

## API & Middleware

### Middleware Stack (ordered in `server.ts`)

```
Request
   │
   ▼
Helmet          ← Security headers (XSS, clickjacking, CSP, CORP, COOP)
   │
   ▼
CORS            ← onlyalphacrypto.com + www.onlyalphacrypto.com (prod) / localhost:3000 (dev)
   │
   ▼
JSON Parser     ← Max 10KB body limit
   │
   ▼
URL-Encoded     ← Extended: true
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

### API Endpoints

**Market:**
| Method | Route | Description |
|---|---|---|
| GET | `/api/market/health` | Health check |
| GET | `/api/market/radar` | Alpha radar signals |
| GET | `/api/market/mood` | Market mood gauge |
| GET | `/api/market/alpha-focus` | Daily alpha focus |
| GET | `/api/market/insights/:symbol` | Coin intelligence data |
| GET | `/api/market/master/:symbol` | Living article (master article) |
| GET | `/api/market/timeline/:symbol` | Coin timeline events |
| GET | `/api/market/conviction/:symbol` | Conviction score + posture |
| GET | `/api/market/archive` | Published article archive (paginated, year/month grouping) |
| GET | `/api/market/outlook/:symbol` | Strategic intelligence outlook (short/long-term targets) |
| GET | `/api/market/scorecard` | Signal performance scorecard (P&L, win rates) |

**Chat:** `POST /api/chat/stream` (SSE), `POST /api/chat/context-stream` (context-aware SSE)

**Chart:** `GET /api/chart/:symbol/candles`

**User:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/user/me`, `PUT /api/user/preferences`, `POST /api/user/wallets`

**API Keys:** `POST /api/api-keys`, `GET /api/api-keys`, `DELETE /api/api-keys/:id`

**Airdrops:** `GET /api/airdrops`, `GET /api/airdrops/:id`, `GET /api/airdrops/:id/tasks`, `POST /api/airdrops/:id/tasks/:taskId/progress`

---

## Living Articles

Instead of publishing 50 articles about BTC in a month, OnlyAlpha maintains **one Master Article per coin** that evolves with the market.

**Deep Dive UI:** The core analysis section is permanently visible directly in the article view. Navigation buttons function as smooth scroll-to anchors down the page, providing a seamless "Deep Dive" experience without hiding vital content behind toggles.

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
             ← Filters output to allowed section keys only
   │          │
   └────┬─────┘
        │
        ▼
  Insert into coin_timeline_updates (MAJOR)
        │
        ▼
  Update majorUpdateCount + lastMajorUpdate

────────────────────────────────

New MINOR event for BTC
        │
        ▼
  Master article exists?
        │
   NO → SKIP (no orphan MINOR updates)
   YES
        │
        ▼
  callGptNanoMinorUpdate()
  ← Writes 1-2 paragraph update
        │
        ▼
  Insert into coin_timeline_updates (MINOR)
  Insert into coin_news (backward compat)
  Store embedding
        │
        ▼
  Update minorUpdateCount + lastMinorUpdate
```

### Master Article Sections

| Section | Content |
|---|---|
| `headline` | Dynamic headline reflecting latest thesis |
| `hook` | One-liner hook for the article |
| `coreCatalyst` | Primary driver of the coin's current narrative |
| `marketContext` | Broader market conditions affecting the coin |
| `strategicImpact` | Forward-looking impact assessment |
| `historicalContext` | Relevant historical parallels |
| `technicalLevels` | Key support/resistance levels |
| `riskAssessment` | Identified risks and warning signs |
| `bottomLine` | Executive summary in one sentence |

### Article Validation

All articles are validated against a **Zod schema** before publishing:
- `headline` ≤ 120 characters
- `hook` ≥ 20 characters
- `fullArticle` ≥ 2500 characters
- `metaTitle` ≤ 60 characters
- `metaDescription` ≤ 160 characters
- `seoKeywords` must be 3-7 strings

All 7 section tags (`[HOOK]`, `[WHAT HAPPENED]`, `[WHY IT MATTERS]`, `[HISTORY REPEATS?]`, `[PRICE PICTURE]`, `[RISK CHECK]`, `[BOTTOM LINE]`) must be present in the article body.

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

    if convictionDelta is set:
        delta += convictionDelta

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
| `TREND_THRESHOLD` | `2` | Minimum delta between recent/previous sums for trend detection |

---

## Strategic Intelligence Layer

`services/strategicOutlook.service.ts` + `coin_strategic_outlook` + `smart_event_responses` tables

Forward-looking intelligence that goes beyond event analysis — provides actionable price targets and risk management.

### Trigger Conditions

Strategic outlook updates are generated automatically during AiWorkflow when:
- Classification is `MAJOR`
- `impactScore >= 70`
- Event is structural (Regulatory, ETF, Hack, Listing, Delisting) OR price moved >10% in 24h OR event severity >= 3

### Data Structure (22 columns)

**Short-Term (1-30 days):**
| Field | Description |
|---|---|
| `shortTermDirection` | bullish / bearish / neutral |
| `shortTermTarget` | Price target |
| `shortTermInvalidation` | Level that invalidates the thesis |
| `shortTermCatalysts` | Key events to watch |
| `shortTermConfidence` | 0-100 confidence score |

**Long-Term (1-6 months):**
| Field | Description |
|---|---|
| `longTermPhase` | accumulation / breakout / distribution / bottom |
| `longTermBullProbability` | 0-100% bull case probability |
| `longTermSupport` | Key support zone |
| `longTermResistance` | Key resistance zone |
| `longTermBottomIn` | Estimated bottom price |
| `longTermTopIn` | Estimated top target |
| `longTermEvidence` | JSON array of supporting evidence |

**Action Plan:**
| Field | Description |
|---|---|
| `recommendedAction` | Specific action (accumulate/wait/reduce/avoid) |
| `rationale` | Reasoning behind the recommendation |
| `riskManagement` | Risk mitigation strategy |

### Smart Event Responses

When major events trigger a strategic outlook update, a `smart_event_responses` record is also created with:
- Immediate impact assessment
- Historical parallels
- Recommended action
- Watch levels
- Time horizon
- Active flag (can be deactivated when event resolves)

**API:** `GET /api/market/outlook/:symbol` — rate-limited, cached in Redis with `outlook:${symbol}` key.

---

## Signal Performance Tracking

`services/` + `signal_performance` table + `signalPerformance.cron.ts`

Every radar signal is tracked for real P&L to measure actual alpha generation.

### How It Works

```
Radar signal generated (BUY/SELL/STRONG_BUY/STRONG_SELL)
        │
        ▼
Record entry: { signalId, coinSymbol, verdict, entryPrice, entryAt }
        │
        ▼
SignalPerformance Cron (every 6h):
  ├─ After 24h:  fetch current price → calculate pnl24h
  ├─ After 7d:   fetch current price → calculate pnl7d + isWin7d
  └─ After 30d:  fetch current price → calculate pnl30d + isWin30d
```

**P&L logic:**
- Bullish signals (BUY/STRONG_BUY): P&L = price change percentage
- Bearish signals (SELL/STRONG_SELL): P&L = negative of price change percentage (profit when price drops)
- Win = P&L > 0 for directional signals

**Frontend:** `/scorecard` page displays aggregate win rates, average P&L, and per-signal breakdown.

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

| Variable | Validation | Description |
|---|---|---|
| `DATABASE_URL` | `min(1)` | PostgreSQL connection string (note: `@` in passwords must be encoded as `%40`) |
| `JWT_SECRET` | `min(32)` | Min 32 characters |
| `OPENROUTER_API_KEY` | `min(10)` | OpenRouter API key |
| `MORALIS_API_KEY` | `min(1)` | Moralis API key for on-chain data |
| `GLM_API_KEY` | `min(1)` | GLM/Zhipu AI API key (used for agent workflow + web search) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `5000` | Express server port |
| `REDIS_URL` | — | Redis connection (omit = caching disabled, rate limiting degraded) |
| `JWT_EXPIRES_IN` | `7d` | Token expiration |
| `CHAT_MODEL` | `openai/gpt-4.1-mini` | Chat model (separate from SEO for cost/speed) |
| `SEO_MODEL` | `openai/gpt-5-nano` | Short-form text model (OpenRouter fallback for tasks) |
| `WRITER_MODEL` | `google/gemini-2.5-flash` | Primary writer model for robust generation |
| `DEEPSEEK_MODEL` | `deepseek/deepseek-r1` | DeepSeek model via OpenRouter (analysis fallback) |
| `DEEPSEEK_API_KEY` | — | Direct DeepSeek API key (bypasses OpenRouter — cheaper) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Direct DeepSeek endpoint |
| `DEEPSEEK_MODEL_DIRECT` | `deepseek-chat` | Direct DeepSeek model name (primary for triage + analysis + writing) |
| `BINANCE_API_KEY` | — | Binance authenticated requests |
| `BINANCE_SECRET` | — | Binance secret key |
| `TAVILY_API_KEY` | `min(1)` (optional) | Tavily search API (emergency fallback) |
| `BIRDEYE_API_KEY` | — | Birdeye API for DEX chart candles |
| `COINCAP_API_KEY` | — | CoinCap price fallback |
| `ALTERNATIVE_ME_URL` | `https://api.alternative.me/fng/` | Fear & Greed Index endpoint |
| `EMBEDDING_PROVIDER` | `openrouter` | `openrouter` or `ollama` |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama instance |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `NEXTJS_REVALIDATE_SECRET` | — | Secret for ISR cache revalidation |
| `NEXTJS_BASE_URL` | — | Next.js app URL for revalidation webhook |
| `TELEGRAM_API_ID` | `''` | Telegram MTProto API ID (required for Telegram monitoring) |
| `TELEGRAM_API_HASH` | `''` | Telegram MTProto API hash (required for Telegram monitoring) |
| `TELEGRAM_SESSION_STRING` | `''` | Telegram session string (required for Telegram monitoring) |
| `GLM_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | GLM API endpoint |
| `GLM_PLANNER_MODEL` | `glm-4-plus` | Planner agent model for LangGraph workflow |
| `GLM_QA_MODEL` | `glm-4-plus` | QA agent model for LangGraph workflow |
| `OPENROUTER_CODER_MODEL` | `meta-llama/llama-3-8b-instruct:free` | Coder model for LangGraph agent workflow |

---

## Installation

### Prerequisites

- Node.js v20+ (LTS recommended)
- npm v10+
- PostgreSQL v14+ with pgvector extension
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

# 3. pgvector (self-hosted PostgreSQL only)
psql -U postgres -d onlyalpha -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Run manual SQL migrations for new tables
psql -U postgres -d onlyalpha -f scripts/migrate-signal-performance.sql
psql -U postgres -d onlyalpha -f scripts/migrate-strategic-outlook.sql
psql -U postgres -d onlyalpha -f scripts/migrate-airdrop-pipeline-runs.sql

# 5. Frontend
cd ../frontend
npm install
cp .env.example .env.local

# 6. Run
# Terminal 1:
cd backend && npm run dev     # http://localhost:5000
# Terminal 2:
cd frontend && npm run dev    # http://localhost:3000

# 7. Verify
curl http://localhost:5000/api/health
# → { "status": "ok", "db": "connected", "ts": "..." }

# 8. Visual DB browser
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
│   │   │   ├── db.ts              ← Drizzle + pg Pool + pgvector registration
│   │   │   ├── env.ts             ← Zod-validated env schema (server won't start if invalid)
│   │   │   └── redis.ts           ← ioredis (lazy connect) + getCache/setCache/deleteCache
│   │   │
│   │   ├── crons/                 ← 12 scheduled task files (all active)
│   │   │   ├── aiWorkflow.cron.ts       ← Central intelligence pipeline (hourly)
│   │   │   ├── triageEngine.cron.ts     ← Phase 1B: news classification (every 2h)
│   │   │   ├── terminalEngine.cron.ts   ← Phase 1A: RSS gathering (every 10min)
│   │   │   ├── telegramMonitor.cron.ts  ← Telegram channel scraping (*/30min news, */4h airdrops)
│   │   │   ├── convictionUpdate.cron.ts ← Incremental conviction scoring (every 6h)
│   │   │   ├── signalPerformance.cron.ts← Signal P&L tracking (every 6h)
│   │   │   ├── airdropRssHunter.cron.ts ← RSS-based airdrop discovery (every 6h)
│   │   │   ├── airdropHunter.cron.ts    ← Airdrop routine sync (every 12h)
│   │   │   ├── marketMood.cron.ts       ← Composite Fear & Greed (07:00 UTC)
│   │   │   ├── dailyAlpha.cron.ts       ← Daily spotlight selection (06:00 UTC)
│   │   │   ├── historicalNews.cron.ts   ← Historical backfill (04:00 UTC)
│   │   │   └── bufferCleanup.cron.ts    ← TTL cleanup (midnight)
│   │   │
│   │   ├── services/              ← 29 service files (23 top-level + 6 in ai/)
│   │   │   ├── ai/                ← AI infrastructure layer (6 files)
│   │   │   │   ├── ai-gateway.ts        ← Multi-provider routing + streaming + timeout
│   │   │   │   ├── agent-workflow.ts    ← LangGraph planner/coder/QA agent loop
│   │   │   │   ├── cache-manager.ts     ← LRU in-memory cache (1h TTL, 1000 max)
│   │   │   │   ├── prompt-factory.ts    ← All prompts centralized
│   │   │   │   ├── quality-auditor.ts   ← Cross-model review (DeepSeek audits writer)
│   │   │   │   └── factual-grounding.ts ← Hallucination filter (±50% price sanity)
│   │   │   │
│   │   │   ├── openai.service.ts        ← AI orchestration (triage/analysis/write/chat)
│   │   │   ├── embedding.service.ts     ← pgvector embeddings generation + storage
│   │   │   ├── similarity.service.ts    ← Dedup coordinator (embedding + keyword fallback)
│   │   │   ├── conviction.service.ts    ← Algorithmic scoring engine
│   │   │   ├── strategicOutlook.service.ts ← Forward-looking intelligence (outlook + events)
│   │   │   ├── coinIntelligence.service.ts ← ATH, 52w range, trend, wiki background
│   │   │   ├── temporalIntelligence.service.ts ← Historical pattern matching
│   │   │   ├── dynamicThreshold.service.ts   ← Adaptive relevance threshold
│   │   │   ├── priceService.ts          ← Multi-source price fetching
│   │   │   ├── circuitBreaker.service.ts ← Per-service failure protection
│   │   │   ├── binance.service.ts       ← Market data + Fear & Greed
│   │   │   ├── binanceHistory.service.ts← Historical price data
│   │   │   ├── dexscreener.service.ts   ← DEX trending + liquidity
│   │   │   ├── cryptopanic.service.ts   ← News aggregation (available, not wired)
│   │   │   ├── rssNews.service.ts       ← RSS feed aggregator (4 sources, primary)
│   │   │   ├── tavily.service.ts        ← Emergency web search (available, not wired)
│   │   │   ├── moralis.service.ts       ← On-chain data
│   │   │   ├── wikipedia.service.ts     ← Background research
│   │   │   ├── coin-memory.service.ts   ← AI event memory
│   │   │   ├── verification.service.ts  ← Data verification
│   │   │   ├── telegram.service.ts      ← Telegram MTProto channel scraper (news + airdrops)
│   │   │   ├── airdropRss.service.ts    ← RSS-based airdrop discovery (5 verified sources)
│   │   │   └── zhipuWebSearch.service.ts← GLM/Zhipu web search + airdrop context enrichment
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
│   │   ├── models/                ← Drizzle ORM schema definitions (25 tables total)
│   │   │   ├── index.ts               ← Re-exports all tables
│   │   │   ├── market.model.ts        ← 16 market tables
│   │   │   ├── user.model.ts          ← 5 user tables
│   │   │   └── airdrop.model.ts       ← 4 airdrop tables
│   │   │
│   │   ├── controllers/           ← 7 API endpoint handlers
│   │   │   ├── health.controller.ts
│   │   │   ├── market.controller.ts    ← + archive, outlook, scorecard handlers
│   │   │   ├── chat.controller.ts
│   │   │   ├── chart.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── apiKey.controller.ts
│   │   │   └── airdrop.controller.ts
│   │   │
│   │   ├── routes/                ← 6 Express router files
│   │   │   ├── index.ts
│   │   │   ├── market.routes.ts        ← + archive, outlook, scorecard endpoints
│   │   │   ├── chat.routes.ts
│   │   │   ├── chart.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   └── airdrop.routes.ts
│   │   │
│   │   ├── scripts/               ← Maintenance scripts
│   │   │   ├── clean-duplicate-radars.ts   ← Deduplicate radar signals
│   │   │   ├── repair-incomplete-articles.ts ← Auto-repair broken master articles
│   │   │   ├── repair-meta-tags.ts         ← Auto-repair poor/generic meta titles
│   │   │   ├── seed-historical-conviction.ts ← Historical conviction backfill
│   │   │   ├── seed-master-articles.ts      ← Master article seeding
│   │   │   ├── purge-data.ts                ← Clear all data
│   │   │   ├── migrate-signal-performance.sql  ← signal_performance table migration
│   │   │   ├── migrate-strategic-outlook.sql    ← strategic outlook tables migration
│   │   │   └── migrate-airdrop-pipeline-runs.sql ← airdrop_pipeline_runs table migration
│   │   │
│   │   ├── utils/                 ← Utility modules (2 files)
│   │   │   ├── logger.ts           ← Winston structured logging
│   │   │   └── crypto.ts           ← Crypto helpers
│   │   │
│   │   └── server.ts              ← Entry point + bootstrap + graceful shutdown
│   │
│   ├── drizzle/                   ← Generated SQL migration files
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                   ← Next.js App Router (10 page routes + 1 loading)
│   │   │   ├── page.tsx                       ← Home / Dashboard
│   │   │   ├── layout.tsx                     ← Root layout (Sidebar + TickerBar)
│   │   │   ├── auth/page.tsx                  ← Login / Register
│   │   │   ├── settings/page.tsx              ← Billing & Preferences
│   │   │   ├── terminal/page.tsx              ← Terminal landing
│   │   │   ├── terminal/[coin]/page.tsx       ← Coin terminal detail
│   │   │   ├── terminal/[coin]/alpha/page.tsx ← Living Article view
│   │   │   ├── airdrops/page.tsx              ← Airdrop listing
│   │   │   ├── airdrops/[id]/page.tsx         ← Airdrop detail + tasks
│   │   │   ├── archive/page.tsx               ← Article archive (year/month grouping)
│   │   │   ├── archive/loading.tsx            ← Archive loading skeleton
│   │   │   └── scorecard/page.tsx             ← Signal P&L scorecard
│   │   │
│   │   ├── features/              ← Feature-scoped modules (45 files)
│   │   │   ├── shared/            ← TickerBar, Sidebar, SectionHeader, API client, ErrorBoundary
│   │   │   ├── home/              ← RadarGrid, AlphaFocus, MarketMood, TopMovers,
│   │   │   │                       AirdropWatchlist + api.ts + types.ts
│   │   │   ├── terminal/          ← Chat, Wire, Chart, LivingArticle, Timeline, AlphaStream,
│   │   │   │                       AlphaSnapshot, DeepDiveSection, DeepDiveSkeleton,
│   │   │   │                       TerminalPageClient, MobileNav + hooks + api.ts + types.ts
│   │   │   ├── settings/          ← PricingCards, WalletManager, ApiKeyManager,
│   │   │   │                       PreferencesPanel, OgBadge + api.ts + types.ts + index.ts
│   │   │   ├── airdrop/           ← TaskList, AirdropsPageClient, AirdropDetailClient,
│   │   │   │                       AiReportStructured, FarmingStreak + api.ts + types.ts
│   │   │   └── archive/           ← ArchivePageClient + api.ts + types.ts
│   │   │
│   │   └── lib/                   ← Global utilities
│   │       ├── utils.ts             ← Tailwind merge
│   │       └── constants.ts         ← Site URL + shared constants
│   │
│   └── package.json
│
├── agent_gedens/                  ← Project state, agent logs, execution protocol
├── netlify.toml                   ← Frontend CI/CD (Netlify + @netlify/plugin-nextjs)
├── plans/                         ← Execution plans & task tracking
└── doc/                           ← Feature specs, AI audit logs, terminal reports
```

---

## Cost Optimization

Four-tier strategy to minimize AI spend while maximizing intelligence quality:

### Tier 1 — Pre-AI Filtering (Zero AI Cost)

| Mechanism | Savings |
|---|---|
| Direct RSS Ingestion | No API keys needed for news gathering — 4 RSS feeds, zero cost per fetch |
| Telegram Channel Scraping | Direct MTProto access — no API rate limits, no per-call cost |
| SHA-256 Hash Dedup | Eliminates exact duplicates before any processing (checks both buffer and published news) |
| Redis-backed Airdrop Dedup | 7-day TTL hash dedup via Redis SET (falls back to in-memory on Redis failure) |
| Spam Filtering | Blocks pump signals and scam patterns before they enter the pipeline |
| TTL Cleanup (48h) | Auto-deletes stale news from buffer (daily at midnight) |
| Hourly Cap (5 max) | Hard limit on articles processed per hour |
| Dynamic Threshold | Adjusts relevance threshold based on news volume |

### Tier 2 — Cheap AI (Low Cost)

| Mechanism | Savings |
|---|---|
| Batch Triage (10 per call) | 1 AI call instead of 10 |
| NOISE Classification | Stops processing immediately — no further cost |
| MINOR Path | Lightweight update (no full analysis) |
| Circuit Breakers | Stops all requests to a failing provider for 30 min |
| Triage Cache | Same batch never sent to AI twice (LRU + SHA-256 key) |
| Fallback Triage Cache | Prevents repeated failures on same batch |
| Airdrop AI Cap | Max 5 AI calls per airdrop discovery run |

### Tier 3 — Full Pipeline (High Value Only)

| Mechanism | Savings |
|---|---|
| DeepSeek Direct (full pipeline) | 60-80% cheaper — used for triage, analysis, AND article writing |
| Semantic Dedup (pgvector) | Prevents re-processing similar news before DeepSeek |
| Quality Audit | Only runs when `impactScore >= 75` or `isBreaking` |
| Strategic Outlook | Only triggers on MAJOR events with impact >= 70 + structural criteria |
| Conviction Score | Zero AI calls — pure algorithm |
| Fallback Article Generation | Template-based fallback if all 3 AI attempts fail — no article lost |
| Free Agent Coder | OpenRouter free-tier model (`llama-3-8b-instruct`) for agent workflow coder node |

---

## Code Quality

| Standard | Implementation |
|---|---|
| **Zero `any` types** | Enforced across all files. Use `unknown`, generics, or specific interfaces |
| **Strict TypeScript** | `strict: true` in tsconfig |
| **Zod validation** | Runtime validation for env vars and AI response schemas |
| **Centralized prompts** | Single `prompt-factory.ts` — no prompt strings scattered in business logic |
| **Centralized cache** | Single `cache-manager.ts` — LRU with auto-cleanup |
| **Graceful shutdown** | `SIGTERM`/`SIGINT` closes DB pool + Redis connection |
| **Structured logging** | Winston with levels — no random `console.log` |
| **No circular imports** | Each module is isolated with clear boundaries |
| **Separated concerns** | Routes → Controllers → Services (never skipped) |
| **Null-safe Redis** | All cache functions are no-ops when Redis is unavailable; in-memory Set fallbacks |
| **Section tag validation** | All articles validated for 7 required section tags before publishing |
| **Schema-validated articles** | Zod schema enforces headline/article/meta length constraints |
| **Meta tag quality** | Bootstrap `repair-meta-tags.ts` auto-repairs poor/generic meta titles and descriptions |
| **Backward compatibility** | All existing exports remain unchanged — nothing importing breaks on update |
| **Migration-guarded scripts** | Bootstrap scripts use `migration_flags` table to run exactly once |
| **Feature-scoped frontend** | Each feature directory has its own `api.ts` + `types.ts` for type-safe API calls |
| **Premium empty states** | Dark theme, no internal error details exposed, retry actions |

---

## Changelog

### Phase 16 — Airdrop Pipeline Fix & UX Empty States (Apr 25, 2026)
- Replaced dead CoinMarketCap RSS with 5 verified sources (The Block, Decrypt, CoinDesk, CoinTelegraph, BeInCrypto)
- Migrated airdrop dedup from in-memory Set to Redis SET with 7-day TTL (in-memory fallback)
- Tuned AI validation prompt for better airdrop classification
- Added premium empty/error states for airdrop listing page

### Phase 15 — Strategic Intelligence Layer (Apr 24, 2026)
- New `coin_strategic_outlook` table (22 columns) for forward-looking price targets and action plans
- New `smart_event_responses` table for major event action plans
- New `strategicOutlook.service.ts` with 5 exported functions
- Auto-generates outlook during AiWorkflow on MAJOR events (impact >= 70 + structural criteria)
- New public API endpoint `GET /api/market/outlook/:symbol`

### Phase 14 — Article Content Fix + Cache Invalidation (Apr 23, 2026)
- Fixed stale radar ID causing content disappearance on terminal page
- Added `master:${symbol}` Redis cache invalidation in AiWorkflow

### Phase 13 — Dynamic AI Radar Coins (Apr 23, 2026)
- Terminal pages now dynamically serve all coins with radar signals (removed static COINS list)
- Added `dynamicParams` for dynamic route generation

### Phase 12 — Airdrop UX Overhaul (Apr 21, 2026)
- Premium airdrop cards with AI risk badges, progress tracking, and wallet integration
- 15 tasks covering full redesign from functional to premium UI

### Phase 11 — Airdrop RSS Hunter Pipeline (Apr 21, 2026)
- New `airdropRss.service.ts` — RSS-based airdrop discovery
- New `airdropRssHunter.cron.ts` — automated pipeline with AI validation

### Phase 10 — Top Movers Widget (Apr 20, 2026)
- Full implementation of TopMovers component with real-time data

### Phase 9 — Terminal Deep-Link & SEO (Apr 20, 2026)
- Dynamic coin terminal pages with SEO meta tags
- Backend endpoint for coin list + sitemap filtering

### Phase 8 — Market Mood Gauge (Apr 20, 2026)
- Frontend MarketMoodGauge with composite Fear & Greed display

### SEO & Platform Quality Audit (Apr 19, 2026)
- 8 quality fixes covering meta tags, SEO, and platform polish

---

<p align="center">
  <em>Built for the next generation of Web3 traders — where signal beats noise.</em>
</p>
