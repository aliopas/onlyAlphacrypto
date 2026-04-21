# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 21, 2026
**Current Focus:** Phase 13 — 404 Fix: Dynamic AI Radar Coins

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

## 🔴 Current Mission: Phase 13 — 404 Fix: Dynamic AI Radar Coins

**Status:** 🟡 PLANNED — Ready for Senior Developer Execution
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** 2 files modified. Zero new files. Zero backend changes. Zero new npm packages.
**Task Breakdown:** 4 tasks (T-01→T-04) in `agent_gedens/THE_NEXUS_HUB.md`
- Single Batch (P0): T-01→T-04 — Remove whitelist gate, add `dynamicParams`, clean unused imports
**Root Cause:** Hardcoded 30-coin `COINS` whitelist in terminal page + missing `dynamicParams` export = 404 for any radar coin not in the array.

### ⚠️ Tech Lead Guardrails (MUST be followed)
1. **DO NOT** touch `generateStaticParams` in either file — needed for ISR SEO
2. **DO NOT** remove `masterArticle` null check in `alpha/page.tsx:123` — intentional
3. **DO NOT** modify `RadarGrid.tsx`, `AlphaFocusCard.tsx`, or any routing files
4. **T-03 CORRECTION:** `COINS` import in `alpha/page.tsx` is still used by `generateStaticParams` — do NOT remove it. Only add `dynamicParams`.

## ✅ Completed Phases

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
