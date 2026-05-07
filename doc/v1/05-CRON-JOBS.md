# 05 — Cron Jobs

**Total:** 17 active + 3 optional = 20 registered cron files  
**Registration:** `server.ts` — sequential start with 5-second stagger  
**Concurrency protection:** In-memory `isRunning` flag per cron. AiWorkflow additionally uses Redis mutex lock.

---

## Active Cron Jobs (17)

| # | Cron | Schedule | File | Purpose |
|---|---|---|---|---|
| 1 | **AiWorkflow** | `0 * * * *` (hourly) | `aiWorkflow.cron.ts` | Full pipeline: dedup → analysis → article → audit → memory → radar → outlook → cache invalidation |
| 2 | **AirdropHunter** | `0 */12 * * *` (every 12h) | `airdropHunter.cron.ts` | Airdrop routine sync |
| 3 | **AirdropRSSHunter** | `0 */6 * * *` (every 6h) | `airdropRssHunter.cron.ts` | RSS airdrop discovery → AI validation → GLM enrichment |
| 4 | **AirdropDiscovery** | `0 */6 * * *` (every 6h) | `airdropDiscovery.cron.ts` | DeFiLlama + GLM/Zhipu web search airdrop discovery |
| 5 | **DailyAlpha** | `0 6 * * *` (06:00 UTC) | `dailyAlpha.cron.ts` | Selects strongest coin as "Alpha of the Day" |
| 6 | **HistoricalNews** | `0 4 * * *` (04:00 UTC) | `historicalNews.cron.ts` | Backfills historical news + 7-day price outcomes |
| 7 | **MarketMood** | `0 7 * * *` (07:00 UTC) | `marketMood.cron.ts` | Blends external Fear & Greed with internal radar signals |
| 8 | **TerminalEngine** | `*/10 * * * *` (every 10min) | `terminalEngine.cron.ts` | Pulls 4 RSS feeds into buffer |
| 9 | **TriageEngine** | `0 */2 * * *` (every 2h) | `triageEngine.cron.ts` | AI classifies 50 news items in batches of 10 |
| 10 | **BufferCleanup** | `0 0 * * *` (midnight) | `bufferCleanup.cron.ts` | Deletes expired TTL entries from buffer |
| 11 | **ConvictionUpdate** | `0 */6 * * *` (every 6h) | `convictionUpdate.cron.ts` | Recalculates conviction scores + time decay |
| 12 | **TelegramMonitor** | `*/30 * * * *` (news), `0 */4 * * *` (airdrops) | `telegramMonitor.cron.ts` | Scrapes 7 Telegram channels with spam filtering |
| 13 | **SignalPerformance** | `0 */6 * * *` (every 6h) | `signalPerformance.cron.ts` | Tracks P&L at 24h/7d/30d |
| 14 | **TpslMonitor** | Every run | `tpslMonitor.cron.ts` | Monitors active signals for TP/SL hits |
| 15 | **EventOutcomeChecker** | Every run | `eventOutcomeChecker.cron.ts` | Checks event impact outcomes |
| 16 | **LevelIntelligence** | Every run | `levelIntelligenceCron.ts` | S/R level detection (behind LEVEL_INTELLIGENCE_ENABLED flag) |
| 17 | **ScenarioOutcomeChecker** | `0 */2 * * *` (every 2h) | `scenarioOutcomeChecker.cron.ts` | Checks scenarios for close conditions |

---

## Optional Cron Jobs (3, behind feature flags)

| # | Cron | Schedule | Flag | Purpose |
|---|---|---|---|---|
| 18 | **MonitoringCron** | TBD | `MONITORING_CRON_ENABLED` | System monitoring |
| 19 | **EventImpactSync** | `*/30 * * * *` (every 30min) | `EVENT_IMPACT_SYNC_ENABLED` | Syncs coin_news_history → event_impacts + event_impact_outcomes |
| 20 | **EventImpactOutcomeChecker** | `*/30 * * * *` (every 30min) | `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` | Checks pending outcomes, fetches Binance klines, calculates metrics |

---

## Bootstrap Scripts (run on server startup)

| Script | File | Purpose |
|---|---|---|
| Radar Cleanup | `scripts/clean-duplicate-radars.ts` | Deduplicates radar signals |
| Article Repair | `scripts/repair-incomplete-articles.ts` | Auto-repairs incomplete master articles (guarded by migration_flags) |
| Meta Tag Repair | `scripts/repair-meta-tags.ts` | Auto-repairs poor meta titles/descriptions (guarded by migration_flags, non-blocking) |

---

## Additional Maintenance Scripts (11 total)

| Script | Purpose |
|---|---|
| `fix-signal-data.ts` | Fix corrupted signal data |
| `backfill-radar-from-news.ts` | Backfill radar signals from news |
| `backfill-radar-now.ts` | Immediate radar backfill |
| `reset-signal-performance.ts` | Reset signal performance data |
| `backfill-signal-performance.ts` | Backfill P&L for existing signals |
| `purge-data.ts` | Data purging utility |
| `seed-historical-conviction.ts` | Seed conviction scores from historical data |
| `seed-master-articles.ts` | Seed initial master articles |

---

## Workflow Timeout & Locking

- **AiWorkflow** has a hard **10-minute timeout** — if exceeded, Redis lock is force-released to prevent deadlock
- **Redis mutex lock:** `SET NX EX 900` (15-minute expiry) for cross-instance safety
- All crons use in-memory `isRunning` boolean to prevent concurrent execution within a single process
