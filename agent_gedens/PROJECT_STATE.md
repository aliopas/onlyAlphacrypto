# ONLYALPHA — PROJECT STATE

**Last Updated:** May 4, 2026
**Current Focus:** Phase 1 — Minimum Data Foundation (IN PROGRESS — docs complete, code pending)

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

## Current Mission: Phase 1 — Minimum Data Foundation

**Status:** IN PROGRESS — Code tasks (T-1.2, T-1.3, T-1.4) pending; Docs tasks (T-1.1, T-1.5, T-1.6, T-1.7) COMPLETED
**Authorized By:** Strategic Planner — May 4, 2026
**Key Objective:** Activate the Event Impact Engine in production. Wire sync cron (reads coin_news_history → creates event_impacts), wire outcome checker cron (fills event_impact_outcomes with real Binance price data), enable feature flags in controlled rollout.
**Plan Path:** `agent_gedens/THE_NEXUS_HUB.md` — Phase 1 section
**Task Count:** 7 (T-1.1 through T-1.7)
**Scope:** 2 new crons, 2 new env flags, 1 server.ts registration update, 1 migration plan, 1 runbook, 1 QA checklist
**Architecture Decision:** Option D (separate sync cron) — does NOT modify any existing crons or services
**Prerequisites:** Phase 6A (✅ complete) + Phase 6B (✅ complete) — both pushed

**Previous:** Phase 6B — Event Impact Persistence — ✅ COMPLETED

## Completed Phases

### Phase 1 — Minimum Data Foundation (Activation)
**Status:** IN PROGRESS — Code tasks (T-1.2, T-1.3, T-1.4) pending; Docs tasks (T-1.1, T-1.5, T-1.6, T-1.7) ✅ COMPLETED
**Tasks:** 7 (T-1.1 through T-1.7) — 4 Docs Complete, 3 Code Pending
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

### Phase 8 — Market Mood Gauge — Frontend Implementation
**Completed:** April 20, 2026
**Tasks:** 6 (T-01 through T-06) — All Passed QA

### SEO & Platform Quality Audit — Fix Implementation
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA
