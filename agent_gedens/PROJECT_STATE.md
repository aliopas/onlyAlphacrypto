# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 23, 2026
**Current Focus:** Phase 14 — COMPLETED (QA Passed, Awaiting Deployment)

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

## 🔴 Current Mission: Phase 14 — Article Content Disappears After Update + Cache Invalidation Fix

**Status:** ✅ COMPLETED — QA Passed — Awaiting Deployment
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** 2 files modified. Zero new files. Zero new npm packages.
**Task Breakdown:** 2 tasks (T-01→T-02) in `agent_gedens/THE_NEXUS_HUB.md`
- Single Batch (P0): T-01 + T-02 — Validate stale radarId in TerminalPageClient + Add master cache invalidation
**Root Cause:** (1) `TerminalPageClient.tsx:24` blindly trusts `initialRadarId` from URL without validating it exists in `validSignals`. After article update creates a new radar signal with a new ID, old URL params point to orphaned IDs → `AlphaStream` renders standby. (2) `aiWorkflow.cron.ts:490` never invalidates `master:${symbol}` Redis cache key.

### ⚠️ Tech Lead Guardrails (MUST be followed)
1. **DO NOT** touch `DeepDiveSection.tsx`, `LivingArticle.tsx`, `AlphaStream.tsx`, or any routing files
2. **DO NOT** modify `getRadarSignals` DISTINCT ON logic — it's correct
3. **DO NOT** add `onConflictDoUpdate` to radar signals insert — out of scope
4. **DO NOT** change `market.model.ts` (no schema changes)
5. **DO NOT** install new packages
6. **DO NOT** modify any route, controller, or cron files EXCEPT `aiWorkflow.cron.ts` (single line addition)
7. Only modify `TerminalPageClient.tsx` (lines 23-25) and `aiWorkflow.cron.ts` (line 490)

## ✅ Completed Phases

### Phase 14 — Article Content Disappears After Update + Cache Invalidation Fix
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 23, 2026
**Tasks:** 2 (T-01 through T-02) — All Done, QA Passed, Awaiting Deployment

### Phase 13 — 404 Fix: Dynamic AI Radar Coins
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 23, 2026
**Tasks:** 4 (T-01 through T-04) — All Done, QA Passed, Awaiting Deployment

### Phase 12 — Airdrop UX Overhaul: From Functional to Premium
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 21, 2026
**Tasks:** 15 (T-01 through T-15) — All Done, Awaiting Final QA

### Phase 10 — Top Movers Widget: Full Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

### Phase 9 — Terminal Deep-Link & SEO Integrity Fix
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

### Phase 8 — Market Mood Gauge — Frontend Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 6 (T-01 through T-06) — All Passed QA
**Files Modified:** `MarketMoodGauge.tsx`, `page.tsx`, `api.ts`, `types.ts`

### SEO & Platform Quality Audit — Fix Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Completed:** April 19, 2026
**Tasks:** 8 (T-01 through T-08) — All Passed QA
