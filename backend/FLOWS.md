# OnlyAlpha — Flow Architecture & Audit

This document is the single source of truth for the 5 independent flows that make up the
OnlyAlpha backend. Each flow owns a set of crons, services, and database tables, and can be
enabled/disabled as a unit via a master env flag (`FLOW_<NAME>_ENABLED`).

## Quick Reference

| Flow | Master Flag | Crons | Status |
|------|-------------|-------|--------|
| 📰 News Intelligence | `FLOW_NEWS_ENABLED` | 7 | ✅ Hardened |
| 📊 Signal & Trading | `FLOW_SIGNALS_ENABLED` | 9 | ✅ Hardened |
| 📈 Market Data | `FLOW_MARKET_ENABLED` | 7 | ✅ Hardened |
| 💼 Scorecard Portfolio | `FLOW_PORTFOLIO_ENABLED` | 3 | 🟡 Partial |
| 🪂 Airdrop Discovery | `FLOW_AIRDROP_ENABLED` | 3 | 🟡 Partial |

## How Isolation Works

1. **`config/flows.ts`** — declares each flow + its master flag. Single source of truth.
2. **`crons/registry.ts`** — declarative cron→flow mapping. `startCrons()` consults flow flags
   + sub-flags to decide what starts.
3. **`server.ts`** — calls `startCrons([...])` once with all crons grouped by flow.
4. **`utils/cronGuard.ts`** — provides in-process (`guardCron`) and cross-instance
   (`guardedCronRun` with Redis mutex) concurrency protection.

To disable a flow entirely: `FLOW_SIGNALS_ENABLED=false`. To toggle a sub-feature within a
flow: use its specific flag (e.g. `SIGNAL_LIFECYCLE_ENABLED=false`).

---

## 📰 Flow 1: News Intelligence

**Master flag:** `FLOW_NEWS_ENABLED`
**Purpose:** RSS + Telegram gathering → AI triage → DeepSeek analysis → articles/radar/memory

### Crons

| Cron | Schedule | Concurrency | Notes |
|------|----------|-------------|-------|
| TerminalEngine | `*/10 * * * *` | Redis mutex (5min) | RSS gathering → raw_news_buffer |
| TelegramMonitor | `*/30 * * * *` / `0 */4 * * *` | Redis mutex (news) / in-process (airdrop) | Telegram scraping |
| TriageEngine | `0 */2 * * *` | Redis mutex (10min) | AI classification in batches of 10 |
| AiWorkflow | `0 * * * *` | Redis mutex (15min) + AbortController | Central pipeline (also requires signals flow) |
| HistoricalNews | `0 4 * * *` | in-process | Backfills price outcomes |
| BufferCleanup | `0 0 * * *` | in-process | TTL cleanup (fixed: was no-op) |
| ConvictionUpdate | `0 */6 * * *` | in-process | Conviction score recalculation |

### Key Services
- `services/openai.service.ts` — AI orchestration (triage/analysis/write/chat)
- `services/ai/ai-gateway.ts` — multi-provider routing + streaming
- `services/ai/prompt-factory.ts` — centralized prompts
- `services/ai/quality-auditor.ts` — cross-model review
- `services/ai/factual-grounding.ts` — hallucination filter
- `services/similarity.service.ts`, `embedding.service.ts` — semantic dedup

### Tables Owned
`raw_news_buffer`, `coin_news`, `coin_master_articles`, `coin_timeline_updates`,
`coin_memory`, `coin_news_history`

### Fixed Issues (Phase 1)
- ✅ `bufferCleanup` was a no-op (`consumed` column never set) — buffer grew unbounded. Fixed.
- ✅ Telegram buffer rows had no `ttlExpiresAt` — never cleaned. Fixed.
- ✅ `aiWorkflow` watchdog reset flag but didn't abort async work → double processing. Fixed with AbortController.
- ✅ No Redis mutex on terminalEngine/triageEngine → multi-instance double-processing. Fixed.

### Remaining Issues (deferred — lower priority)
- 🟡 `similarity.service.ts` keyword fallback reads `coinNews` which the modern pipeline rarely writes.
- 🟡 `quality-auditor.ts` auto-passes on any error (quality gate silently disabled on outage).
- 🟡 `cache-manager.ts` setInterval never destroyed (timer leak on hot-reload).

---

## 📊 Flow 2: Signal & Trading

**Master flag:** `FLOW_SIGNALS_ENABLED`
**Purpose:** Signal generation, lifecycle management, TP/SL monitoring, P&L tracking,
scenario/event outcome tracking, shadow A/B testing.

### Crons

| Cron | Schedule | Concurrency | Notes |
|------|----------|-------------|-------|
| SignalPerformance | `0 */6 * * *` | in-process | 24h/7d/30d P&L backfill |
| TpslMonitor | `*/15 * * * *` | in-process | TP/SL hit detection + 30d expiry |
| SignalLifecycle | `*/15` (V1) / `*/2` (V2) | in-process | Multi-TP/breakeven/trailing SL |
| ShadowChecker | `*/15 * * * *` | in-process | A/B algorithm vs AI win-rate |
| ScenarioOutcomeChecker | `0 * * * *` | in-process | Scenario horizon outcomes |
| EventOutcomeChecker | `*/30 * * * *` | in-process | News event price outcomes |
| EventImpactSync | `*/30 * * * *` | in-process | Sync to event_impacts |
| EventImpactOutcomeChecker | `*/30 * * * *` | in-process | Resolve event impact outcomes |
| LevelIntelligence | `0 */6 * * *` | none | Support/resistance level detection |

### Key Services
- `services/signalManager.service.ts` — create/upgrade/close_and_replace decisions
- `services/signalLifecycle.service.ts` — V2 lifecycle (PARTIAL_TP, breakeven, trailing SL)
- `services/signalClassification.service.ts` — outcome classification
- `services/tpslCalculator.service.ts` (V1), `tpslCalculatorV2.service.ts` (V2),
  `scorecardTpslCalculator.service.ts` (portfolio) — 3 TP/SL engines
- `services/scenarioTracker.service.ts` — scenario creation/tracking
- `services/technicalAnalysis.service.ts` — TA engine

### Tables Owned
`signal_performance`, `radar_signals`, `market_scenarios`, `scenario_horizon_outcomes`,
`event_impacts`, `event_impact_outcomes`, `shadow_signals`, `level_intelligence`

### Fixed Issues (Phase 1)
- ✅ Signals stuck in `NEW` state forever — V2 lifecycle was dead code. Fixed: created as `ACTIVE`.
- ✅ Double-close race in `autoCloseSignal` (no row lock). Fixed: atomic `WHERE isActive=true` guard.
- ✅ `close_and_replace` left `signalState` untouched. Fixed: now sets `CLOSED` + `REVERSED` reason.
- ✅ `signalClassification` checked never-written enum values (`'invalidation'`, `'stop_loss'`). Fixed: uses real `CloseReason` values.
- ✅ `eventOutcomeChecker` `maxUpside`/`maxDrawdown` initialized to 0 (hid real drawdowns). Fixed: `-Infinity`/`Infinity`.
- ✅ `signalPerformance` per-row errors aborted entire batch. Fixed: per-row try/catch.

### Remaining Issues (deferred — medium priority)
- 🟡 **3 duplicate TP/SL calculators** — V1, V2, scorecard have divergent logic. Phase 3.2 consolidation.
- 🟡 `appendLifecycleAction` read-modify-write on JSONB array — concurrent appends can lose entries (V2 only).
- 🟡 `mtfContext.buildMtfContext` issues 5 sequential awaits — latency hot path in V2.
- 🟡 `scenarioTracker.createScenario` dedupe check not transactional — TOCTOU on dedupeKey.

---

## 📈 Flow 3: Market Data

**Master flag:** `FLOW_MARKET_ENABLED`
**Purpose:** Price/OHLCV/regime/levels/trend foundation that feeds signal decisions.

### Crons

| Cron | Schedule | Concurrency | Notes |
|------|----------|-------------|-------|
| DailyAlpha | `0 */8 * * *` | in-process | Picks alpha-focus coin of the day |
| MarketMood | `0 7 * * *` | in-process | Fear & Greed composite |
| MarketFilter | `0 */6 * * *` | in-process | Tradeability flags |
| RegimeUpdate | `0 */4 * * *` | in-process | Market regime detection |
| DailyTrend | `0 */6 * * *` | in-process | EMA trend labels |
| OhlcvSnapshot | `*/4h`/`*/1h`/`*/15m` | none | OHLCV + indicators |
| Monitoring | `0 */6 * * *` | in-process | Row-count health summary |

### Key Services
- `services/binance.service.ts` — resilient Binance client (cache, rate limit, retries)
- `services/priceService.ts` — price authority (Binance → DexScreener fallback)
- `services/binanceHistory.service.ts` — ATH/52w/trend (uses raw fetch — Phase 1.12)
- `services/marketRegime.service.ts` — regime detection
- `services/levelIntelligence.service.ts` — S/R pivots + clustering
- `services/dailyTrend.service.ts` — EMA trend

### Tables Owned
`price_snapshots`, `coin_intelligence_cache`, `daily_alpha_focus`, `daily_market_mood`,
`ohlcv_candles`, `ohlcv_indicators`, `level_intelligence`

### Fixed Issues (Phase 1)
- ✅ `marketMood` persisted bogus "Extreme Fear" (value=0) on Fear&Greed API failure. Fixed: `getFearAndGreed` returns null; cron skips the row.

### Remaining Issues (deferred — Phase 1.12)
- 🟡 **3 raw-fetch Binance paths** bypass the resilient client:
  - `binanceHistory.service.ts:56` — raw `fetch`, no retry/cache/rate-limit
  - `portfolioSnapshot.service.ts:12` — raw `/ticker/price`
  - `portfolioMonitor.service.ts:26` — raw `/ticker/price`
  - All compete for Binance rate limits independently.
- 🟡 `binanceBreaker`/`dexscreenerBreaker` defined in `circuitBreaker.service.ts` but never imported.
- 🟡 `priceService.priceCache` (15s) doesn't share with `binance.service.ts` `SimpleCache`.
- 🟡 `marketFilter` marks ALL coins not-tradeable on transient Binance blip (6h outage window).
- 🟡 `levelIntelligence` race in level-ID resolution (float-price Map key collisions).

---

## 💼 Flow 4: Scorecard Portfolio

**Master flag:** `FLOW_PORTFOLIO_ENABLED`
**Purpose:** Telegram-scraped educational portfolio simulation with TP/SL monitoring.

### Crons

| Cron | Schedule | Concurrency | Notes |
|------|----------|-------------|-------|
| TelegramPortfolioScraper | `0 0 * * *` + startup | in-process | Daily scrape + Vision AI extraction |
| PortfolioSnapshot | `0 0 * * *` | in-process | Daily value/PnL/drawdown snapshot |
| PortfolioMonitor | `0 * * * *` | in-process | Hourly TP/SL evaluation |

### Key Services
- `services/telegramPortfolioScraper.service.ts` — Telegram + OpenRouter Vision
- `services/portfolioSnapshot.service.ts` — daily snapshot (raw Binance fetch)
- `services/portfolioMonitor.service.ts` — hourly TP/SL monitor (raw Binance fetch)
- `services/scorecardPipeline.service.ts` — validation + profile + TP/SL
- `services/scorecardTpslCalculator.service.ts` — independent TP/SL engine

### Tables Owned
`portfolio_coins`, `portfolio_transactions`, `portfolio_snapshots`

### Remaining Issues (deferred — lower priority, educational feature)
- 🟡 `portfolioMonitor` TP/SL accounting inconsistent: partial TPs don't reduce position, full close assumes full position.
- 🟡 `portfolioSnapshot`/`portfolioMonitor` use raw Binance fetch (no retry/cache) — Phase 1.12.
- 🟡 `portfolioSnapshot` persists zero-value snapshot on Binance outage, blocks re-run for the day.
- 🟡 `telegramPortfolioScraper` startup run fires on every restart/redeploy (no "ran today" check).
- 🟡 Shares Telegram session with news + airdrop flows — concurrent connection risk.

---

## 🪂 Flow 5: Airdrop Discovery

**Master flag:** `FLOW_AIRDROP_ENABLED`
**Purpose:** RSS/DeFiLlama/Z.ai discovery → AI validation → project registry.

### Crons

| Cron | Schedule | Concurrency | Notes |
|------|----------|-------------|-------|
| AirdropHunter | `0 */12 * * *` | none | Re-validates all active projects (2 LLM calls each) |
| AirdropRSSHunter | `0 */6 * * *` | none | RSS-based discovery (5 sources) |
| AirdropDiscovery | `0 */6 * * *` | none | DeFiLlama + Z.ai discovery |

### Key Services
- `services/airdropRss.service.ts` — RSS fetching + keyword filter
- `services/airdropQuality.service.ts` — quality scorer
- `services/zhipuWebSearch.service.ts` — GLM web search enrichment
- `services/defillama.service.ts` — DeFi protocol discovery
- `services/telegram.service.ts` — Telegram airdrop scraping (partially dead — see below)

### Tables Owned
`airdrop_projects`, `airdrop_tasks`, `user_progress`, `airdrop_pipeline_runs`

### Remaining Issues (deferred — lower priority)
- 🟡 `airdropHunter` unbounded LLM cost — iterates ALL active projects, 2 LLM calls each, no cap.
- 🟡 `airdropRssHunter` + `airdropDiscovery` both run `0 */6 * * *` — concurrent, double load.
- 🟡 `airdropRssHunter` local/Redis hash set inconsistency (reprocesses on Redis flaps).
- 🟡 `zhipuWebSearch` hardcoded "2025" in enrichment query (stale year).
- 🟡 `telegram.service.fetchAirdropsFromTelegram` is dead code (not imported by any cron).
- 🟡 `airdropQuality.ECOSYSTEM_COINS` map defined but never used.

---

## Cross-Flow Dependencies

```
NEWS ──────► (produces radar_signals + master articles)
  │
  └── AiWorkflow also requires SIGNALS flow enabled (it generates signals)
  │
MARKET ────► (produces price/regime/levels)
  │
  └── Feeds into SIGNALS flow (signal decisions need market data)
  │
SIGNALS ◄─── (consumes news + market data to generate/track signals)
  │
PORTFOLIO ──► (independent — educational simulation, own TP/SL engine)
  │
AIRDROP ───► (independent — only shares Telegram session with news)
```

**Note:** The MARKET and NEWS flows are upstream of SIGNALS. Disabling MARKET or NEWS will
degrade signal quality but won't crash — the signal flow degrades gracefully when price/regime
data is stale.

---

## Concurrency Protection Summary

| Protection | Mechanism | Used By |
|------------|-----------|---------|
| In-process guard | `guardCron(name, fn)` | All crons (prevents overlap within one process) |
| Cross-instance mutex | `guardedCronRun(name, ttl, fn)` | terminalEngine, triageEngine, telegramMonitor, aiWorkflow |
| Atomic DB guard | `WHERE isActive=true` on UPDATE | autoCloseSignal, close_and_replace |
| Cooperative abort | `AbortController` + loop check | aiWorkflow (10-min watchdog) |

## Migration Notes

If you have existing `signal_performance` rows stuck in `signalState='NEW'`, they should be
migrated to `'ACTIVE'` to participate in the V2 lifecycle:

```sql
UPDATE signal_performance
SET signal_state = 'ACTIVE'
WHERE is_active = true AND signal_state = 'NEW';
```

If you have a large `raw_news_buffer` table from the bufferCleanup no-op bug, you can reclaim
space:

```sql
DELETE FROM raw_news_buffer
WHERE processed = true AND ttl_expires_at < NOW() - INTERVAL '7 days';
```
