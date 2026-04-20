# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 20, 2026
**Current Focus:** Phase 9 — Terminal Deep-Link & SEO Integrity Fix

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

## 🔴 Current Mission: Phase 9 — Terminal Deep-Link & SEO Integrity Fix

**Status:** 🟡 IN PROGRESS — Micro-Tasks Defined in THE_NEXUS_HUB.md, Ready for Execution
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** 3 bugs — Deep-link article loading failure, Ghost page indexing, SEO indexing errors
**Root Causes Identified:**
1. All API calls in `api.ts` silently catch errors → `null` fallbacks → page renders empty without `notFound()`
2. `generateStaticParams()` generates pages for ALL 30 coins regardless of DB article existence
3. No `notFound()` guard in any terminal page when master article is `null`
4. `sitemap.ts` blindly lists all 30 coin terminal + alpha URLs without checking article existence
**Task Breakdown:** 7 micro-tasks (T-01→T-07) in `agent_gedens/THE_NEXUS_HUB.md`
- Phase A (Backend): T-01 (controller) + T-02 (route) — new `GET /market/master/coins` endpoint
- Phase B (Frontend API): T-03 — new `getMasterArticleCoins()` method
- Phase C (Frontend Pages): T-04 (alpha notFound) + T-05 (terminal robots meta) + T-06 (OG verify)
- Phase D (Sitemap): T-07 — filter sitemap to only coins with articles

## ✅ Completed Phases

### Market Mood Gauge — Frontend Implementation (Phase 8)
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 6 (T-01 through T-06) — All Passed QA
**Files Modified:** `MarketMoodGauge.tsx`, `page.tsx`, `api.ts`, `types.ts`

### SEO & Platform Quality Audit — Fix Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA
