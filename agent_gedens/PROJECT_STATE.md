# ONLYALPHA — PROJECT STATE

**Last Updated:** April 24, 2026
**Current Focus:** Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)

## Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds. (Note: Neon Serverless & Reddit API are strictly DELETED).
4. **AI Routing:** Uses `AIGateway` (OpenRouter) & `PromptFactory`. 
   - **Models:** DeepSeek-r1 (Deep Analysis), Gemini 2.5 Flash (Article Writing), GPT-5-nano (SEO/Minor).

## Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement.
2. **Modular Boundaries:** Cache logic -> `CacheManager`. AI calls -> `AIGateway`. Prompts -> `PromptFactory`.
3. **Backward Compatibility:** All existing backend exports must remain unchanged unless explicitly authorized by the Tech Lead.

## Current Mission: Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)

**Status:** QA PASSED — Awaiting Deployment
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** 1 new SQL file, 1 new service file, 3 modified files, 0 new npm packages
**Task Breakdown:** 5 tasks (T-01 through T-05) — All Done, QA Passed

**New Files Created:**
- `backend/scripts/migrate-strategic-outlook.sql` — SQL migration fallback (22 columns, 2 tables, 3 indexes)
- `backend/src/services/strategicOutlook.service.ts` — 5 exported functions (shouldUpdateOutlook, saveStrategicOutlook, buildSmartEventResponse, getStrategicOutlook, getActiveEventResponses)

**Files Modified:**
- `backend/src/crons/aiWorkflow.cron.ts` — Import (line 19), outlook logic (lines 311-346), cache invalidation (line 531)
- `backend/src/controllers/market.controller.ts` — Import (line 9), handler (lines 506-528)
- `backend/src/routes/market.routes.ts` — Route registration (line 18)

### Tech Lead Guardrails (MUST be followed)
1. **ZERO `any` types** across all new code
2. All existing exports must remain backward-compatible
3. **DO NOT** install new packages
4. **DO NOT** modify any other service files, controllers, routes, or crons
5. **DO NOT** change `prompt-factory.ts` or `openai.service.ts`
6. **DO NOT** change `market.model.ts`
7. Follow existing patterns: use `getCache`/`setCache`/`deleteCache` from redis config
8. `strategicOutlook` is optional — handle `undefined` gracefully
9. No frontend changes in this phase

## Completed Phases

### Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 24, 2026
**Tasks:** 5 (T-01 through T-05) — All Done, QA Passed, Awaiting Deployment
**New Files:** `migrate-strategic-outlook.sql`, `strategicOutlook.service.ts`
**Modified Files:** `aiWorkflow.cron.ts`, `market.controller.ts`, `market.routes.ts`
**Architecture Changes:** Strategic outlook DB tables (coin_strategic_outlook, smart_event_responses), new service layer, cron integration for auto-generation on MAJOR events, new public API endpoint `GET /api/outlook/:symbol`

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
