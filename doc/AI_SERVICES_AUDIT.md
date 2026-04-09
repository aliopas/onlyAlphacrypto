# OnlyAlpha -- Comprehensive AI Services Audit

> Generated: 2026-04-08

## 1. AI-Related Files (Complete List)

### Backend Core AI Services (8 files)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `backend/src/services/openai.service.ts` | **Main AI orchestrator** -- all AI function exports (market verdict, deep intelligence, triage, dual news, airdrop validation, deep analysis, article writing, chat stream) |
| 2 | `backend/src/services/ai/ai-gateway.ts` | **AI Gateway** -- wraps OpenAI SDK, handles `chat`, `chatRaw`, `chatStream` with retry, JSON parse correction, rate limit detection, thinking block stripping; also `createOpenRouterGateway()` and `createGLMGateway()` factory functions |
| 3 | `backend/src/services/ai/prompt-factory.ts` | **Prompt Factory** -- all system/user prompt construction for every AI function |
| 4 | `backend/src/services/ai/cache-manager.ts` | **In-memory AI CacheManager** -- SHA256-keyed Map cache with TTL (1h default), max size (1000), periodic cleanup (5min) |
| 5 | `backend/src/services/ai/deep-analysis-router.ts` | **Deep Analysis Router** -- fetches top news from buffer grouped by coin for batch AI processing |
| 6 | `backend/src/services/ai/quality-auditor.ts` | **Quality Auditor** -- cross-model audit (DeepSeek-R1 audits GPT-5-nano articles), checks accuracy, completeness, SEO, tone |
| 7 | `backend/src/services/ai/factual-grounding.ts` | **Factual Grounding** -- sanitizes hallucinated support/resistance levels by checking they are within +/-50% of current price |
| 8 | `backend/src/services/ai/data-augmenter.ts` | **Data Augmenter** -- gathers coin context (memory + DexScreener + Tavily) in parallel for enriched AI input |

### Backend Cron Jobs That Make AI Calls (4 files)

| # | File Path | Schedule | AI Function Called |
|---|-----------|----------|-------------------|
| 1 | `backend/src/crons/aiWorkflow.cron.ts` | **Hourly** (`0 * * * *`) | `callDeepSeekAnalysis()`, `callGptNanoWriter()`, `auditArticleQuality()` |
| 2 | `backend/src/crons/triageEngine.cron.ts` | **Every 2 hours** (`0 */2 * * *`) | `generateLightweightTriage()` |
| 3 | `backend/src/crons/airdropHunter.cron.ts` | **Daily 00:00 UTC** (discovery) + **Every 12h** (sync) | `validateAirdrop()` |
| 4 | `backend/src/crons/terminalEngine.cron.ts` | **Every 10 min** (`*/10 * * * *`) | No direct AI call -- gathers RSS news into buffer for triage |

### Backend Cron Jobs WITHOUT Direct AI Calls (3 files)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `backend/src/crons/dailyAlpha.cron.ts` | Selects daily alpha from DB (no AI, reads existing AI analysis) |
| 2 | `backend/src/crons/marketMood.cron.ts` | Computes market mood from external API + AI radar signals (no new AI call) |
| 3 | `backend/src/crons/bufferCleanup.cron.ts` | Deletes expired news buffer entries (no AI) |

### Backend Controllers Handling AI Requests (2 files)

| # | File Path | AI-Related Routes |
|---|-----------|-------------------|
| 1 | `backend/src/controllers/chat.controller.ts` | `POST /chat/stream` (SSE streaming AI chat), `POST /chat/stream/context` (context-aware AI chat) |
| 2 | `backend/src/controllers/market.controller.ts` | `POST /market/force-seed` (triggers `runAiWorkflow()`, `backfillRadarSignals()`, `runDiscovery()`/`runRoutineSync()`) |

### Backend Routes (4 route files)

| # | File Path | AI-Related Endpoints |
|---|-----------|---------------------|
| 1 | `backend/src/routes/chat.routes.ts` | `POST /api/chat/stream`, `POST /api/chat/stream/context` |
| 2 | `backend/src/routes/market.routes.ts` | `POST /api/market/force-seed` |
| 3 | `backend/src/routes/airdrop.routes.ts` | `POST /api/airdrop/verify/:taskId` (triggers on-chain verification, not AI) |
| 4 | `backend/src/routes/index.ts` | All route mounting |

### Caching & Rate Limiting (4 files)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `backend/src/services/ai/cache-manager.ts` | In-memory Map cache for AI responses (SHA256 keys, 1h TTL, 1000 max) |
| 2 | `backend/src/config/redis.ts` | Redis cache for API responses (`getCache`/`setCache`/`deleteCache`/`deleteCachePattern`) |
| 3 | `backend/src/middleware/rateLimit.middleware.ts` | IP-based and tiered (free/pro/institutional) rate limiting via Redis Lua script |
| 4 | `backend/src/middleware/guest-limit.middleware.ts` | Guest chat limit (3 messages/day per IP via Redis) |

### Circuit Breakers & Resilience (1 file)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `backend/src/services/circuitBreaker.service.ts` | Circuit breakers for `deepseekBreaker` and `gptNanoBreaker` (5 failures, 30min cooldown) |

### AI Model Configuration (1 file)

| # | File Path | AI Config |
|---|-----------|-----------|
| 1 | `backend/src/config/env.ts` | `OPENROUTER_API_KEY`, `SEO_MODEL` (default: `openai/gpt-5-nano`), `DEEPSEEK_MODEL` (default: `deepseek/deepseek-r1`) |

### Frontend Components That Call AI Features (8 files)

| # | File Path | AI Feature |
|---|-----------|-----------|
| 1 | `frontend/src/features/terminal/hooks/useTerminalChat.ts` | **Direct AI call** -- streams from `POST /chat/stream` via `fetch()` (SSE) |
| 2 | `frontend/src/features/terminal/components/TerminalChat.tsx` | UI wrapper for AI chat (uses `useTerminalChat`) |
| 3 | `frontend/src/features/terminal/components/TerminalPageClient.tsx` | Orchestrates wire/radar/chat -- triggers chat with `articleId`/`articleType` context |
| 4 | `frontend/src/features/terminal/components/AlphaStream.tsx` | Displays AI-generated articles/radar signals (consumes AI output, does not call AI directly) |
| 5 | `frontend/src/features/terminal/components/TerminalWire.tsx` | Displays AI-generated wire news and radar signals (consumer only) |
| 6 | `frontend/src/features/terminal/api.ts` | API client for terminal -- `getLatestWire()`, `getNewsById()`, `getAlphaStream()` |
| 7 | `frontend/src/features/home/api.ts` | API client for home -- `getMarketMood()`, `getAlphaFocus()`, `getRadarSignals()` (consumes AI output) |
| 8 | `frontend/src/features/shared/api/client.ts` | Shared Axios client with JWT auth interceptor (base for all AI frontend calls) |

### Supporting Services (Non-AI but feed AI pipeline)

| # | File Path | Role in AI Pipeline |
|---|-----------|-------------------|
| 1 | `backend/src/services/coinIntelligence.service.ts` | Fetches coin intel (ATH, 52w range, trend, wiki) used as AI input |
| 2 | `backend/src/services/temporalIntelligence.service.ts` | Builds historical patterns fed to DeepSeek analysis |
| 3 | `backend/src/services/tavily.service.ts` | Tavily search API used for context enrichment |
| 4 | `backend/src/services/coin-memory.service.ts` | Stores/retrieves past AI analysis for context window |
| 5 | `backend/src/services/dynamicThreshold.service.ts` | Dynamically adjusts triage threshold for AI workflow |
| 6 | `backend/src/services/rssNews.service.ts` | RSS news gathering for triage pipeline |

---

## 2. Every AI Endpoint/Route

| Method | Endpoint | AI Function | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/api/chat/stream` | `streamChatResponse()` (SSE, GPT-5-nano) | `chatLimiter` (5/min) + `guestLimit` (3/day) | Optional |
| `POST` | `/api/chat/stream/context` | `streamChatResponse()` in context mode | `chatLimiter` (5/min) | Required |
| `POST` | `/api/market/force-seed` | Triggers `runAiWorkflow()`, `runDiscovery()`, etc. | None | None |

---

## 3. Every AI Model Used

| Model | Environment Variable | Default | Used For |
|-------|---------------------|---------|----------|
| `deepseek/deepseek-r1` | `DEEPSEEK_MODEL` | `deepseek/deepseek-r1` | Deep analysis, market verdict, deep intelligence, airdrop validation, quality audit |
| `openai/gpt-5-nano` | `SEO_MODEL` | `openai/gpt-5-nano` | SEO formatting (dual news step 2), article writing, lightweight triage, chat streaming |

All models are accessed via **OpenRouter** (`https://openrouter.ai/api/v1`).

There are also factory functions for **GLM Gateway** (`https://open.bigmodel.cn/api/paas/v4`) in `ai-gateway.ts` (lines 185-196) but they are not currently used anywhere in the codebase.

---

## 4. Complete AI Call Inventory (11 Exported Functions)

All exported from `backend/src/services/openai.service.ts`:

| # | Function | Model | Cache | Retry | Called By |
|---|----------|-------|-------|-------|-----------|
| 1 | `generateMarketVerdict()` | DeepSeek-R1 | Yes | No (via gateway) | **Not called anywhere** |
| 2 | `generateDeepIntelligenceReport()` | DeepSeek-R1 (adaptive temp) | Yes | No | **Not called anywhere** |
| 3 | `generateLightweightTriage()` | GPT-5-nano | Yes | Fallback on error | `triageEngine.cron.ts` |
| 4 | `generateDualNewsOutput()` | DeepSeek-R1 + GPT-5-nano (2-step) | Yes | 3 attempts each | **Not called anywhere** |
| 5 | `validateAirdrop()` | DeepSeek-R1 | Yes | No | `airdropHunter.cron.ts` |
| 6 | `callDeepSeekAnalysis()` | DeepSeek-R1 | No | 3 attempts | `aiWorkflow.cron.ts` |
| 7 | `callGptNanoWriter()` | GPT-5-nano | No | 3 attempts + JSON schema validation | `aiWorkflow.cron.ts` |
| 8 | `streamChatResponse()` | GPT-5-nano (streaming) | No | No | `chat.controller.ts` |

Additionally:
- `gateway` (AIGateway instance) -- exported for use by `quality-auditor.ts`
- `prompts` (PromptFactory instance) -- exported but only used internally
- `auditArticleQuality()` in `quality-auditor.ts` calls `gateway.chat()` directly with `deepseek/deepseek-r1`

---

## 5. Caching Mechanisms Summary

| Layer | Technology | TTL | Scope | File |
|-------|-----------|-----|-------|------|
| **In-memory AI cache** | JavaScript `Map` with SHA256 keys | 1 hour (360,000ms) | AI response dedup | `backend/src/services/ai/cache-manager.ts` |
| **Redis API cache** | Redis `SETEX` | 30s-600s per endpoint | Market/radar/wire/mood endpoints | `backend/src/config/redis.ts` + controllers |
| **DB coin intel cache** | PostgreSQL `coin_intelligence_cache` table | 4 hours | Coin intelligence data | `backend/src/services/coinIntelligence.service.ts` |
| **News buffer TTL** | PostgreSQL `ttl_expires_at` column | Configured per row | Processed news cleanup | `backend/src/crons/bufferCleanup.cron.ts` |
| **Guest chat count** | Redis `INCR` | 24 hours | Guest chat limit | `backend/src/middleware/guest-limit.middleware.ts` |

### Redis Cache Keys Used

| Key Pattern | TTL | Set By | Cleared By |
|-------------|-----|--------|------------|
| `insight:{coin}` | 300s | `market.controller.ts` | `aiWorkflow.cron.ts` (pattern `insight:all`) |
| `alpha-focus:today` | 600s | `market.controller.ts` | `dailyAlpha.cron.ts` |
| `radar:latest:{limit}:{offset}` | 60s | `market.controller.ts` | `aiWorkflow.cron.ts` (pattern `radar:latest:*`) |
| `stats:asset-count` | 300s | `market.controller.ts` | -- |
| `wire:{coin}:{limit}:{tz}` | 120s | `market.controller.ts` | -- |
| `mood:today` | 600s | `market.controller.ts` | `marketMood.cron.ts` |
| `top-movers:10` | 30s | `market.controller.ts` | -- |
| `news:{symbol}` | -- | -- | `aiWorkflow.cron.ts` |
| `airdrop:projects` | 300s | `airdrop.controller.ts` | `airdropHunter.cron.ts` |
| `airdrop:deadlines` | -- | -- | `airdropHunter.cron.ts` |
| `airdrop:project:{id}` | 300s | `airdrop.controller.ts` | `airdropHunter.cron.ts` |
| `guest:chat:{ip}` | 86400s | `guest-limit.middleware.ts` | -- |
| `disclaimer:{userId}` | 31536000s (1 year) | `chat.controller.ts` | -- |
| `rl:{path}:{ip}` | 60s | `rateLimit.middleware.ts` | -- |

---

## 6. Rate Limiting Summary

| Limiter | Scope | Limit | Window | File |
|---------|-------|-------|--------|------|
| `apiLimiter` | All `/api/market/*` endpoints | 60 req | 60s | `rateLimit.middleware.ts` |
| `chatLimiter` | `/api/chat/stream` endpoints | 5 req | 60s | `rateLimit.middleware.ts` |
| `authLimiter` | Auth endpoints | 10 req | 900s | `rateLimit.middleware.ts` |
| `guestLimit` | `/api/chat/stream` (guests only) | 3 req total | 24h | `guest-limit.middleware.ts` |
| `tieredLimiter` | Available but **not applied** to any route | free:60, pro:500, inst:5000 | 1h | `rateLimit.middleware.ts` |
| Hourly publish cap | `aiWorkflow.cron.ts` internal | 5 articles/hour | 1h | `aiWorkflow.cron.ts` |

---

## 7. Cron Job Schedule Overview

| Cron | Schedule | Active | AI Calls |
|------|----------|--------|----------|
| `aiWorkflow` | Hourly (`0 * * * *`) | **Yes** | `callDeepSeekAnalysis`, `callGptNanoWriter`, `auditArticleQuality` |
| `triageEngine` | Every 2h (`0 */2 * * *`) | **Yes** | `generateLightweightTriage` |
| `terminalEngine` | Every 10min (`*/10 * * * *`) | **Yes** | None (RSS gathering only) |
| `dailyAlpha` | Daily 06:00 UTC (`0 6 * * *`) | **Yes** | None (DB read only) |
| `marketMood` | Daily 07:00 UTC (`0 7 * * *`) | **Yes** | None (external API + DB) |
| `bufferCleanup` | Daily midnight (`0 0 * * *`) | **Yes** | None (DB cleanup) |
| `airdropHunter` | Daily 00:00 UTC + every 12h | **No (DISABLED)** | `validateAirdrop` |

---

## 8. AI Pipeline Architecture Flow

```
[RSS Feeds] --(terminalEngine.cron, every 10min)--> [raw_news_buffer DB table]
                                                          |
                                                    (triageEngine.cron, every 2h)
                                                          |
                                              [generateLightweightTriage - GPT-5-nano]
                                                          |
                                              [Scored + tagged news in buffer]
                                                          |
                                              (aiWorkflow.cron, hourly)
                                                          |
                          +-------------------------------+-------------------------------+
                          |                               |                               |
                  [getCoinIntelligence]            [buildTemporalPattern]        [getPriceWithFallback]
                          |                               |                               |
                          +-------------------------------+-------------------------------+
                                                          |
                                          [callDeepSeekAnalysis - DeepSeek-R1]
                                                          |
                                          [validateFactualGrounding]
                                                          |
                                          [callGptNanoWriter - GPT-5-nano]
                                                          |
                                          [auditArticleQuality - DeepSeek-R1]
                                                          |
                          +-------------------------------+-------------------------------+
                          |                               |                               |
                    [coin_news table]              [radar_signals table]       [Redis invalidation]
                          |                               |
                    [Frontend Wire]               [Frontend Radar]

[User Chat] --(TerminalChat.tsx)--> [useTerminalChat.tsx] --(SSE)--> [POST /api/chat/stream]
                                                                       |
                                                              [streamChatResponse - GPT-5-nano]
                                                                       |
                                                              [context: DB news + memory + price]
```

---

## 9. Notable Observations & Findings

### Dead Code / Unused Exports

1. **`generateMarketVerdict()`** -- exported from `openai.service.ts` but **never called** anywhere in the codebase.
2. **`generateDeepIntelligenceReport()`** -- exported but **never called**. The cron uses `callDeepSeekAnalysis()` instead.
3. **`generateDualNewsOutput()`** -- exported but **never called**. The cron uses `callDeepSeekAnalysis()` + `callGptNanoWriter()` separately.
4. **`createGLMGateway()`** -- factory function in `ai-gateway.ts` exists but is **never imported or used**.
5. **`tieredLimiter`** -- exported from `rateLimit.middleware.ts` but **not applied** to any route.
6. **`prompts` instance** -- exported from `openai.service.ts` but only used internally.

### Disabled Features

1. **AirdropHunter cron** -- commented out in `server.ts` line 80 (`// TEMPORARILY DISABLED`).
2. **`ANALYSIS_MODEL` env var** -- `quality-auditor.ts:11` reads `process.env.ANALYSIS_MODEL` directly (bypasses Zod validation in `env.ts`), defaults to `deepseek/deepseek-r1`.

### Architecture Gaps

1. **Dual caching overlap**: AI responses are cached both in-memory (CacheManager with global 1h TTL) and at the API level (Redis). The in-memory cache has no per-entry TTL -- all entries share the same TTL.
2. **No frontend debounce**: No debouncing/throttling on the AI chat input. Protection relies solely on `streaming` state check and server-side `chatLimiter`.
3. **No per-entry TTL in CacheManager**: `cache-manager.ts` uses a single global TTL. The comment at line 279 acknowledges this: "the CacheManager doesn't support per-entry TTL".
4. **`chat.controller.ts:28` mode type mismatch**: The destructured type says `'general' | 'private'` but the actual mode values used are `'general' | 'context'`.
5. **Missing `AIRateLimitError` handling in `generateDualNewsOutput()`**: Unlike `callDeepSeekAnalysis()` in `aiWorkflow.cron.ts`, the retry loops in `generateDualNewsOutput()` catch generic errors but do not handle `AIRateLimitError` specifically -- they throw immediately on rate limit instead of skipping gracefully.
6. **`terminalApi.getAlphaStream()`** calls `/terminal/stream/{pair}` which does not exist in any backend route file.
