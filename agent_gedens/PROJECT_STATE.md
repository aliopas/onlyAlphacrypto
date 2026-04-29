# ONLYALPHA — PROJECT STATE

**Last Updated:** April 29, 2026
**Current Focus:** Phase 21 — Multi-Timeframe Signal System & Scorecard Overhaul (P0)

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

## Current Mission: Phase 21 — Multi-Timeframe Signal System & Scorecard Overhaul (P0)

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` — Phase 21 section (lines 1955-2724)
**Tasks:** 7 (T-01 through T-07) + T-VERIFY — Granular Micro-Tasks Ready
**Scope:** 1 new file (`signalManager.service.ts`), 6 modified files, 1 SQL migration
**Status:** PLANNED — Ready for Senior Developer Execution
**Key Objective:** Fix production scorecard showing duplicate/conflicting signals, empty P&L, zero dedup. Transform from blind signal INSERT to smart multi-timeframe signal management.

**Previous:** Phase 20 — AI Pipeline Quality Fix (P0) — ✅ COMPLETE

## Completed Phases

### Phase 21 — Multi-Timeframe Signal System & Scorecard Overhaul (P0)
**Started:** April 29, 2026
**Tasks:** 7 (T-01 through T-07) — Pending Execution

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
