# ONLYALPHA — PROJECT STATE

**Last Updated:** May 4, 2026
**Current Focus:** Phase 6B — Event Impact Persistence (PLANNED — awaiting execution)

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

## Current Mission: Phase 6B — Event Impact Persistence

**Status:** PLANNED — Ready for execution after Phase 6A QA PASS
**Authorized By:** Strategic Planner — May 4, 2026
**Key Objective:** Create persistence layer for Event Impact Engine. Store calculated event impact data in two dedicated parallel tables (event_impacts, event_impact_outcomes). Do not modify existing tables.
**Plan Path:** `agent_gedens/THE_NEXUS_HUB.md` — Phase 6B section
**Task Count:** 7 (T-6B.1 through T-6B.7)
**Scope:** 2 migrations, 1 Drizzle model update, 1 persistence service, 1 backfill script, 3 env flags, 1 doc update, 1 QA checklist

**Previous:** Phase 6A — Event Impact Analysis Engine — ✅ COMPLETED (QA PASS)

## Completed Phases

### Phase 6B — Event Impact Persistence
**Status:** PLANNED — Ready for execution
**Tasks:** 7 (T-6B.1 through T-6B.7) — All Pending
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
