# ONLYALPHA — PROJECT STATE

**Last Updated:** April 25, 2026
**Current Focus:** Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)

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

## Current Mission: Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)

**Status:** DEPLOY 1 COMPLETE — T-01 through T-04 all QA Passed | Deploy 2 (T-05 through T-09) Pending
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** 5 modified files, 1 new SQL file, 1 new Drizzle table, 0 new npm packages
**Task Breakdown:** 9 tasks (T-01 through T-09) — Deploy 1: T-01→T-04 ✅ DONE | Deploy 2: T-05→T-09 PENDING

**Deploy 1 (COMPLETE — All QA Passed):**
- T-01: ✅ Replace dead RSS sources (`airdropRss.service.ts:21-31`)
- T-02: ✅ Move dedup to Redis (`airdropRssHunter.cron.ts`)
- T-03: Tune AI validation prompt (`prompt-factory.ts:166`)
- T-04: Frontend empty + error states (`AirdropsPageClient.tsx:265`, `page.tsx:29-37`)

**Deploy 2 (Backend Hardening):**
- T-05: Add `airdropPipelineRuns` table to `airdrop.model.ts`
- T-06: Create SQL migration `migrate-airdrop-pipeline-runs.sql`
- T-07: Add pipeline health logging to both cron files
- T-08: Frontend loading skeleton for grid
- T-09: Frontend pipeline status indicator (optional)

### Tech Lead Guardrails (MUST be followed)
1. **ZERO `any` types** across all new/modified code
2. All existing exports must remain backward-compatible
3. **DO NOT** install new packages
4. **DO NOT** change core AI model routing (DeepSeek for airdrop analysis)
5. **DO NOT** remove `onConflictDoNothing` on `airdropProjects.name`
6. **DO NOT** increase `MAX_AI_CALLS_PER_RUN` beyond 10
7. **DO NOT** add manual airdrop submission from frontend
8. Keep existing card design system — do NOT redesign cards
9. Empty state must be visually premium (dark theme)
10. Do NOT expose internal error details to user
11. Redis fallback: if `redis === null`, fall back to in-memory Set
12. Seed data must have `isActive = true`, valid `network`, reasonable `estValue`

## Completed Phases

### Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Status:** PLANNED — 9 tasks defined (T-01 through T-09)
**Scope:** RSS fix, Redis dedup, prompt tuning, frontend empty/error/skeleton states, pipeline health monitoring

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
