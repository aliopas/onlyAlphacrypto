# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 20, 2026
**Current Focus:** Phase 10 — Top Movers Widget: Full Implementation

## 🏗 Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds. (Note: Neon Serverless & Reddit API are strictly DELETED).
4. **AI Routing:** Uses `AIGateway` (OpenRouter) & `PromptFactory`. 
   - **Models:** DeepSeek-r1 (Deep Analysis), Gemini 2.5 Flash (Article Writing), GPT-5-nano (SEO/Minor).

## 🔒 Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement.
2. **Modular Boundaries:** Cache logic → `CacheManager`. AI calls → `AIGateway`. Prompts → `PromptFactory`.
3. **Backward Compatibility:** All existing backend exports must remain unchanged unless explicitly authorized by the Tech Lead.

## 🔴 Current Mission: Phase 10 — Top Movers Widget: Full Implementation

**Status:** 🟡 IN PROGRESS — Micro-Tasks Defined in THE_NEXUS_HUB.md, Ready for Execution
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** Frontend-only. Single file rewrite of `TopMovers.tsx` — replace "Coming Soon" placeholder with live-updating Top Movers widget
**Backend Status:** Already complete — `GET /market/movers` endpoint is live and cached 30s
**Task Breakdown:** 7 sub-tasks (T-01→T-07) in `agent_gedens/THE_NEXUS_HUB.md`
- T-01: Imports & Types (constants, MoverRow interface)
- T-02: Helper Functions (toMoverRow, formatPrice, SkeletonRows, EmptyState, ReconnectingState)
- T-03: State & Data Fetching (useState, useEffect, polling, NEW badge tracking)
- T-04: Header Section (flat market detection, live/error indicators)
- T-05: Body — Conditional Rendering (loading/error/empty states)
- T-06: Mover Table Rows (rank, symbol, badges, change, price, volume bar)
- T-07: Edge Cases & Polish (safety checks, no stale closures, export signature)

## ✅ Completed Phases

### Phase 9 — Terminal Deep-Link & SEO Integrity Fix
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

### Market Mood Gauge — Frontend Implementation (Phase 8)
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 6 (T-01 through T-06) — All Passed QA
**Files Modified:** `MarketMoodGauge.tsx`, `page.tsx`, `api.ts`, `types.ts`

### SEO & Platform Quality Audit — Fix Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA
