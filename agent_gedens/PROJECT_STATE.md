# ONLYALPHA — PROJECT STATE

**Last Updated:** May 2, 2026
**Current Focus:** Phase 1 — Event-Price Foundation (BLOCKED — Phase 0.5 completed)

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

## Current Mission: Phase 1 — Event-Price Foundation

**Status:** BLOCKED — Requires Phase 0.5 to be live 1+ week for multi-horizon data
**Authorized By:** Tech Lead — May 2, 2026
**Key Objective:** Expand `coin_news_history` schema with event-price tracking, bridge live events, and implement multi-horizon outcome checker cron.

**Previous:** Phase 0.5 — AdSense-Safe Public Presentation (P0) — ✅ COMPLETED

## Completed Phases

### Phase 3 — Level Intelligence Engine
**Completed:** May 3, 2026
**Tasks:** Implementation and QA — All Done
**New Files:** `levelIntelligence.service.ts`, `levelIntelligenceCron.ts`, `migrate-level-intelligence.sql`, `verify-phase3-levels.js`
**Modified Files:** `market.model.ts`, `server.ts`, `prompt-factory.ts`, `aiWorkflow.cron.ts`
**Summary:**
- Added deterministic technical analysis engine for support/resistance levels
- 6-hour cron processes major coins across 4 timeframes (1h/4h/1d/1w)
- Levels stored with confidence scores, interaction tracking, and AI integration
- AdSense-safe prompt injection with anti-hallucination rules
- Migration creates level_intelligence and level_interactions tables with crypto-safe precision
- Verification script provides read-only stats and health checks
- Backward compatible, non-blocking, no impact on existing features

### Phase 4.5 — Activation & Backfill Readiness
**Completed:** May 3, 2026 — QA PASS
**Tasks:** 8/8 Tasks — All Done
**New Files:** `backend/scripts/backfill-phase45-scenarios.js`
**Modified Files:** `backend/src/crons/levelIntelligenceCron.ts`, `backend/src/services/levelIntelligence.service.ts`, `backend/src/crons/aiWorkflow.cron.ts`, `backend/src/config/env.ts`, `backend/scripts/verify-phase3-levels.js`, `backend/scripts/verify-phase4-scenarios.js`, `agent_gedens/THE_NEXUS_HUB.md`
**Summary:**
- Activated Phase 3 level intelligence cron with env-controlled safe defaults
- Enabled scenario creation in aiWorkflow behind SCENARIO_TRACKER_ENABLED flag
- Created safe backfill script for recent eligible scenarios (14 days, major coins only)
- Extended verification scripts with activation status checks
- Added comprehensive operational runbook with env controls and rollback procedures
- All systems default to disabled for safe production deployment
- TypeScript compilation clean, no any types introduced

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
