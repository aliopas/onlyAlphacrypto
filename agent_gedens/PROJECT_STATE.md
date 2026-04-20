# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 20, 2026
**Current Focus:** Phase 11 — Airdrop RSS Hunter: Real Data Pipeline

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

## 🔴 Current Mission: Phase 11 — Airdrop RSS Hunter: Real Data Pipeline

**Status:** 🟡 PLANNING — Micro-Tasks Defined in THE_NEXUS_HUB.md, Ready for Execution
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** Backend-only. 2 NEW files + 3 modified files. Zero new npm packages.
**Task Breakdown:** 7 tasks (T-01→T-07) in `agent_gedens/THE_NEXUS_HUB.md`
- T-01: Create `airdropRss.service.ts` — Types, RSS Sources, Fetch & Keyword Filter
- T-02: Add dedup helpers & context builder to `airdropRss.service.ts`
- T-03: Add `buildAirdropFromArticleMessages()` to `prompt-factory.ts`
- T-04: Add `validateAirdropFromArticle()` + `AirdropArticleValidationResult` to `openai.service.ts`
- T-05: Create `airdropRssHunter.cron.ts` — Main Orchestrator (fetch → filter → dedup → AI → DB)
- T-06: Register `startAirdropRSSCron` in `server.ts` + re-enable disabled AirdropHunter cron
- T-07: Edge cases, safety verification, TypeScript compilation check

## ✅ Completed Phases

### Phase 10 — Top Movers Widget: Full Implementation
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 20, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

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
