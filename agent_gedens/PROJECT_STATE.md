# ONLYALPHA — PROJECT STATE

**Last Updated:** May 7, 2026 (v2.Trance 1 — micro-tasks PLANNED)
**Current Focus:** v2.Trance 1 — Execute v2.Phase 0 + v2.Phase 0.1 micro-tasks
**Active Plan Source:** plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md
**Next Step:** Senior Developer executes Group A tasks: T-V2-0A (coins.ts) + T-V2-0F (Phase 0 flags) + T-V2-01E (Phase 0.1 flags)

## Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds, Telegram. (Note: Neon Serverless & Reddit API are strictly DELETED).
4. **AI Routing:** Uses `AIGateway` (OpenRouter) & `PromptFactory`.
   - **Models:** DeepSeek-r1 (Deep Analysis), Gemini 2.5 Flash (Article Writing), GPT-5-nano (SEO/Minor).

## Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement.
2. **Modular Boundaries:** Cache logic -> `CacheManager`. AI calls -> `AIGateway`. Prompts -> `PromptFactory`.
3. **Backward Compatibility:** All existing backend exports must remain unchanged unless explicitly authorized by the Tech Lead.
4. **Zero BUY/SELL Terminology:** All verdicts use BULLISH/BEARISH internally. API-layer mapping to AdSense-safe public labels.

---

## Current Mission: Master Plan v2.1 — Algorithmic Signal Engine

**Status:** APPROVED by Tech Lead — Ready for Planner micro-task breakdown
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md`
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

### Tranche 1 — Foundation + Validation (Weeks 0-2)
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 0 | Coin Filter + Market Filter | 🟡 PLANNED — 6 tasks written | None |
| v2.Phase 0.1 | OHLCV Data Infrastructure | 🟡 PLANNED — 5 tasks written | None (but blocks everything after) |
| v2.Phase 0.1 Backfill | Historical candle backfill script | ⬜ NOT STARTED | v2.Phase 0.1 |
| v2.Phase 1 | Technical Analysis Engine | ⬜ NOT STARTED | v2.Phase 0.1 + 90 days data |
| v2.Phase 1.5 | Backtesting Framework (NEW) | ⬜ NOT STARTED | v2.Phase 1 |

**Tranche 1 Exit Gate:**
- [ ] 90 days of candle data stored for all 11 coins x 3 timeframes (4H/Daily/Weekly)
- [ ] Backtesting pass criteria ALL met (win rate >40%, quality >=60 on 20%+ days, directional diversity, trend accuracy >55%, S/R hit rate >50%)

### Tranche 2 — Shadow Mode + Classification (Weeks 3-5) [BLOCKED by Tranche 1 Gate]
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 0.5 | Shadow Mode + Admin Dashboard | ⬜ BLOCKED | v2.Phase 1.5 PASSED |
| v2.Phase 3 | Signal Classification System | ⬜ BLOCKED | v2.Phase 1 |
| v2.Phase 2 | Market Regime Detection | ⬜ BLOCKED | v2.Phase 1 |
| v2.Phase 4 | TP/SL Engine Overhaul | ⬜ BLOCKED | v2.Phase 1 + v2.Phase 1.6 (ATR) |
| v2.Phase 6 | AI Role Refinement | ⬜ BLOCKED | v2.Phase 1 + v2.Phase 2 |

**Tranche 2 Exit Gate:**
- [ ] Shadow mode running minimum 2 weeks
- [ ] 20+ resolved shadow signals
- [ ] Algorithm disagreement win rate > 60%

### Tranche 3 — Full Integration (Weeks 6+) [BLOCKED by Tranche 2 Gate]
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 5 | Signal Lifecycle System | ⬜ BLOCKED | v2.Phase 3 + v2.Phase 4 |
| v2.Phase 7.1 | Daily Trend Context | ⬜ BLOCKED | v2.Phase 1 |
| v2.Phase 7.2 | Weekly Bias Layer | ⬜ BLOCKED | v2.Phase 7.1 |
| v2.Phase 7.3 | 4H Entry Timing | ⬜ BLOCKED | v2.Phase 7.2 |
| v2.Phase 7.4 | Multi-TF Classification | ⬜ BLOCKED | v2.Phase 7.3 |
| v2.Phase 8 | Scorecard Redesign | ⬜ BLOCKED | v2.Phase 5 + v2.Phase 6 |

### Independent Track
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 9 | Airdrop System Redesign | ⬜ NOT STARTED | v2.Phase 0 only |

### Key New Infrastructure (v2.1)
| Component | File | Purpose |
|---|---|---|
| Coin Constants | `backend/src/config/coins.ts` | Single source of truth for 11 tracked coins |
| OHLCV Candles Table | `ohlcv_candles` in `market.model.ts` | Raw candle storage (11 coins x 3 TFs) |
| OHLCV Indicators Table | `ohlcv_indicators` in `market.model.ts` | Pre-computed EMA/ATR/volume_avg |
| OHLCV Snapshot Service | `backend/src/services/ohlcvSnapshot.service.ts` | Fetch, store, compute indicators |
| OHLCV Snapshot Cron | `backend/src/crons/ohlcvSnapshot.cron.ts` | Every 4H refresh |
| Historical Backfill | `backend/scripts/backfill-ohlcv.ts` | One-time 90-day backfill |
| Technical Analysis | `backend/src/services/technicalAnalysis.service.ts` | EMA, S/R, Structure, Patterns, Volume, ATR, Quality Score |
| Backtesting Script | `backend/scripts/backtest-technical.ts` | Historical validation before shadow mode |
| Admin Auth Middleware | `backend/src/middleware/adminAuth.middleware.ts` | Redis session + bcrypt auth |
| Admin Routes | `backend/src/routes/admin.routes.ts` | Shadow mode dashboard API |
| Shadow Checker Cron | `backend/src/crons/shadowChecker.cron.ts` | Every 15min, fills 72h/7d results |
| Market Filter Cron | `backend/src/crons/marketFilter.cron.ts` | Every 6H, coin health check |

---

## Phase Overview (Legacy Phases — All Pre-v2)

| Phase | Description | Status | Commit |
|---|---|---|---|
| Phase 1 | Event-Price Foundation | ✅ COMPLETE / QA PASSED | f206e39, 886bea9 |
| Phase 2 | Full Event Impact Engine | ✅ COMPLETE / QA PASSED WITH NOTES | 4ae0af4 |
| Phase 3 | Multi-Horizon Scenario Tracker | ⚠️ PARTIAL / NEEDS RECONCILIATION | 58ecebd (partial) |
| Phase 4 | OHLCV Price Snapshots | ⬜ NOT COMPLETE / PARTIAL FOUNDATION | — |
| Phase 5 | Level Intelligence Engine | ⚠️ PARTIAL FOUNDATION EXISTS | adac61e (partial) |
| Phase 6 | AI Cost Reduction | ⚠️ PARTIAL FOUNDATION EXISTS | — |
| Phase 7 | Public Language / Google-Safe | ✅ COMPLETE / QA PASSED | 3933f44→f1e6535 |
| Phase 8 | Migration Strategy | ✅ COMPLETE / QA PASSED | f5d0ec3 |

### Phase Notes
- **Phase 2:** Runtime stats injection disabled by feature flag (`EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` default `false`). Classification confidence function exists but not fully wired into workflow (documented TODO). No blockers from QA.
- **Phase 3:** `scenarioTracker.service.ts` and related schema exist from commit 58ecebd. Not confirmed complete under current roadmap. Needs reconciliation.
- **Phase 5:** `levelIntelligence.service.ts` exists from commit adac61e. Not fully integrated into public scenario/article generation.
- **Phase 6:** `ai-gateway.ts`, `cache-manager.ts`, routing/cache exists. Full cost reduction plan not complete. v2.Phase 6 (AI Role Refinement) supersedes this.

## Completed Phases

### Phase 7 — Public Language / Google-Safe Presentation
**Status:** COMPLETE — QA PASSED
**Commits:** 3933f44, 251f5f5, 1c31da9, 1b1d406, 32478f6, 06bd913, f1e6535
**Tasks:** 9 (T-7A-01, T-7B-01 through T-7B-05-02, T-7B-06) — All Done
**Modified Files:** `openai.service.ts`, `chat.controller.ts`, `layout.tsx`, `opengraph-image.tsx`, `feed.xml/route.ts`, `about/page.tsx`, `RadarGrid.tsx`, `TerminalWire.tsx`, `AlphaStream.tsx`, `PreferencesPanel.tsx`, `OgBadge.tsx`, `auth/page.tsx`, `disclaimer/page.tsx`, `terms/page.tsx`, `privacy/page.tsx`, `contact/page.tsx`, `market.controller.ts`, `scorecard/page.tsx`
**Summary:**
- T-7A-01: Comprehensive audit of 175 source files, 78 findings (14 HIGH, 38 MEDIUM, 26 LOW)
- T-7B-01: Backend article/chat template wording cleanup (Signal Detected → Market Scenario Identified, stop-loss strategies → risk management, AI SIGNAL → AI SCENARIO)
- T-7B-02: Frontend public label cleanup (signals → scenarios in RadarGrid, TerminalWire, AlphaStream, PreferencesPanel, OgBadge, about, auth)
- T-7B-03: Legal/disclaimer terminology cleanup (signals → scenarios, Win rates → Historical outcome rates)
- T-7B-04: SEO/meta/OG language cleanup (AI trading → AI market analysis, serious traders → crypto market participants, trading signals → scenario analysis)
- T-7B-05: API presentation field mapping review — safe alias strategy documented
- T-7B-05-01: Backend safe alias implementation (9 field aliases added alongside existing fields for backward compat)
- T-7B-05-02: Frontend safe alias adoption (scorecard prefers safe aliases with fallbacks)
- T-7B-06: Full QA verification — all sweeps clean, tsc passes, zero HIGH-risk language remains

### Phase 2 — Full Event Impact Engine
**Status:** COMPLETE — Code committed, QA PASSED WITH NOTES
**Commit:** 4ae0af4
**Tasks:** 8 (T-2.1 through T-2.8) — All Done
**QA Result:** 68/68 PASS — APPROVE WITH NOTES
**New Files:** `historicalEventComparison.service.ts`, `migrate-event-impacts-v2.sql`
**Modified Files:** `market.controller.ts`, `market.routes.ts`, `prompt-factory.ts`, `aiWorkflow.cron.ts`, `openai.service.ts`, `market.model.ts`, `eventImpactPersistence.service.ts`, `env.ts`
**Summary:**
- Historical event comparison service (queries event_impacts + outcomes for similar past events, returns statistical summaries)
- Event impact stats API endpoint (GET /api/market/event-impact-stats, authMiddleware protected)
- Extended event taxonomy (8 new types: Fed_Rate, CPI, Geopolitical, Influencer_Statement, Executive_Change, Large_Transfer, Token_Unlock, Exchange_Netflow)
- AI workflow stats injection (behind EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED=false flag)
- Classification confidence field (optional on TriageResult, stored in event_impacts)
- Feature flag added to env.ts (default false)
**Known Notes:**
- Confidence persistence function exists but full workflow wiring is TODO and accepted for Phase 2.
- Minor duplicate `eventScope` computation in aiWorkflow.cron.ts (lines 241, 703) — different scopes, harmless.
- Do not enable flag until DB coverage/performance check.

### Phase 1 — Minimum Data Foundation (Activation)
**Status:** COMPLETE — QA PASSED
**Commits:** f206e39 (initial), 886bea9 (QA re-review fixes)
**Tasks:** 7 (T-1.1 through T-1.7) — All Done
**New Files:** `backend/src/crons/eventImpactSync.cron.ts`, `backend/src/crons/eventImpactOutcomeChecker.cron.ts`
**Modified Files:** `backend/src/config/env.ts` (+2 flags), `backend/src/server.ts` (+2 conditional registrations)
**Summary:**
- eventImpactSync.cron: every 30 min, reads unsynced coin_news_history via LEFT JOIN, creates event_impacts + event_impact_outcomes
- eventImpactOutcomeChecker.cron: every 30 min, checks due pending outcomes, fetches Binance klines, calculates metrics, updates records
- 2 new env flags (both default false): EVENT_IMPACT_SYNC_ENABLED, EVENT_IMPACT_OUTCOME_CHECKER_ENABLED
- Conditional server.ts registration (same pattern as MONITORING_CRON_ENABLED)
- Production runbook with step-by-step activation procedure
- Zero modifications to existing crons, services, models, or frontend

### Phase 6B — Event Impact Persistence
**Status:** COMPLETED — Pushed
**Tasks:** 7 (T-6B.1 through T-6B.7) — All Done
**Planned Files:** `backend/scripts/migrate-event-impacts.sql`, `backend/src/services/eventImpactPersistence.service.ts`, `backend/scripts/backfill-event-impacts.js`
**Modified Files:** `backend/src/models/market.model.ts`, `backend/src/config/env.ts`, `agent_gedens/THE_NEXUS_HUB.md`
**Summary:**
- Creates event_impacts table (1 row per source event, normalized from coin_news_history)
- Creates event_impact_outcomes table (5 rows per event, one per horizon: 1h/4h/24h/3d/7d)
- Persistence service bridges coin_news_history → new tables (read-only source, write-only target)
- Backfill script with dry-run mode (default) and feature flags (all default disabled)
- 3 new env flags: EVENT_IMPACT_PERSISTENCE_ENABLED, EVENT_IMPACT_BACKFILL_ENABLED, EVENT_IMPACT_BACKFILL_DRY_RUN
- Zero modifications to existing tables, UI, AI workflows, or crons

### Phase 6A — Event Impact Analysis Engine
**Completed:** May 3, 2026 — QA PASS
**Tasks:** 7 (T-6A.1 through T-6A.7) — All Done
**New Files:** `backend/src/services/eventImpactAnalysis.service.ts`, `backend/scripts/analyze-event-impact.js`
**Modified Files:** `backend/src/config/env.ts`, `agent_gedens/THE_NEXUS_HUB.md`
**Summary:**
- Created read-only event impact analysis service with deterministic statistics from coin_news_history
- Calculates per-horizon sample sizes, median returns, positive/bullish outcome rates, average max upside/drawdown
- Manual analysis script with env flag control (EVENT_IMPACT_ENGINE_ENABLED, default false)
- Policy-safe terminology guidelines defined for historical analysis framing
- Comprehensive QA checklist and documentation updates
- No database writes, no external APIs, no AI integrations — pure data analysis

### Phase 0.5 — AdSense-Safe Public Presentation (P0)
**Completed:** May 2, 2026
**Tasks:** 6 (T-EMERGENCY-1, T-0.5-A through T-0.5-E) — All Done
**Modified Files:** `disclaimer/page.tsx`, `terms/page.tsx`, `AlphaStream.tsx`, `prompt-factory.ts`
**Summary:**
- T-EMERGENCY-1: Verified all 7 missing crons registered in server.ts (system running at full 14/14 capacity)
- T-0.5-A: Scorecard already compliant (meta tags, labels, verdict/closereason mappings)
- T-0.5-B: Legal pages language fixed (BUY/SELL → Bullish/Bearish, Signal Scorecard → Market Scenario)
- T-0.5-C: AlphaStream terminology cleaned (Decoding Signal → Loading Intelligence, Signal Intelligence → Market Intelligence)
- T-0.5-D: Prompt-factory safe harbor verified + vocabulary reinforcement added (Upside Target Zone, Risk Zone, Reference Price, Market Scenario, Historical Outcome)
- T-0.5-E: Signal Performance Cron error handling already in place (outer try/catch confirmed)

### Phase 23 — TP/SL Auto-Close & Signal Lifecycle (P0)
**Completed:** May 2, 2026 (code was deployed earlier, state file updated now)
**Tasks:** 9 (T-01 through T-09) — All Done, Code Deployed
**New Files:** `tpslCalculator.service.ts`, `tpslMonitor.cron.ts`, `migrate-tpsl-columns.sql`
**Modified Files:** `market.model.ts`, `signalManager.service.ts`, `aiWorkflow.cron.ts`, `server.ts`, `market.controller.ts`, `scorecard/page.tsx`

### Phase 22 — Airdrop Pipeline Resurrection (P0 HOTFIX)
**Completed:** April 29, 2026
**Deploy Commit:** `110313b`

### Phase 21 — Multi-Timeframe Signal System & Scorecard Overhaul (P0)
**Completed:** May 2, 2026 (code was deployed earlier, state file updated now)
**Tasks:** 7 (T-01 through T-07) — All Done, Code Deployed
**New Files:** `signalManager.service.ts`, `migrate-signal-active.sql`
**Modified Files:** `aiWorkflow.cron.ts`, `market.model.ts`

### Phase 20 — AI Pipeline Quality Fix (P0)
**Started:** April 27, 2026
**Tasks:** 8 (T-01 through T-08) — Pending Execution

### Phase 19 — AdSense Legal Pages + Footer (P0)
**Completed:** April 26, 2026
**Tasks:** 12 (T-01 through T-12) — All Done, QA Passed
**New Files:** `Footer.tsx`, `CookieBanner.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `about/page.tsx`, `contact/page.tsx`, `disclaimer/page.tsx`
**Modified Files:** `layout.tsx`, `sitemap.ts`, `terminal/[coin]/page.tsx`, `scorecard/page.tsx`

### Phase 18 — Signal P&L Tracker / Scorecard (P2)
**Completed:** April 25, 2026
**Tasks:** 8 (T-01 through T-08) — All Done, QA Passed
**New Files:** `migrate-signal-performance.sql`, `signalPerformance.cron.ts`, `scorecard/page.tsx`
**Modified Files:** `market.model.ts`, `aiWorkflow.cron.ts`, `market.controller.ts`, `market.routes.ts`, `Sidebar.tsx`

### Phase 17 — Telegram Pipeline Feed + Z.ai Airdrop Enrichment (P2)
**Completed:** April 25, 2026
**Tasks:** 7 (T-01 through T-07) — All Done, QA Passed
**New Files:** `telegram.service.ts`, `telegramMonitor.cron.ts`, `zhipuWebSearch.service.ts`

### Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)
**Completed:** April 25, 2026
**Tasks:** 9 (T-01 through T-09) — Deploy 1 Complete, Deploy 2 Pending

### Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)
**Completed:** April 24, 2026
**Tasks:** 5 (T-01 through T-05) — All Done, QA Passed

### Phase 14 — Article Content Disappears After Update + Cache Invalidation Fix
**Completed:** April 23, 2026
**Tasks:** 2 (T-01 through T-02) — All Done, QA Passed

### Phase 13 — 404 Fix: Dynamic AI Radar Coins
**Completed:** April 23, 2026
**Tasks:** 4 (T-01 through T-04) — All Done, QA Passed

### Phase 12 — Airdrop UX Overhaul: From Functional to Premium
**Completed:** April 21, 2026
**Tasks:** 15 (T-01 through T-15) — All Done, Awaiting Final QA

### Phase 10 — Top Movers Widget: Full Implementation
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

### Phase 9 — Terminal Deep-Link & SEO Integrity Fix
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

### Phase 8 — Migration Strategy
**Status:** COMPLETE — Docs committed, QA PASSED
**Commit:** f5d0ec3
**Tasks:** 1 (T-8-01) — Migration strategy document created
**Summary:**
- Comprehensive migration discipline established
- Approval gates, rollback strategies, validation checklists documented
- Zero migrations created or run
- Production safety prioritized

### SEO & Platform Quality Audit — Fix Implementation
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA

### SEO & Platform Quality Audit — Fix Implementation
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA
