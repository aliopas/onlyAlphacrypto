# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 19, 2026
**Current Focus:** SEO & Platform Quality Audit — Fix Implementation

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

## 🔴 Current Mission: SEO & Platform Quality Audit — Fix Implementation

**Plan Path:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Hub File:** `agent_gedens/THE_NEXUS_HUB.md`
**Total Tasks:** 8 micro-tasks
**Priority Breakdown:**
- P0 (Critical): 3 tasks — Google indexing blockers
- P1 (High): 2 tasks — Backend data quality
- P2 (Medium): 3 tasks — UX & enhancement

**Status:** 🟡 Planning Complete — Awaiting Execution

**Audit Findings Being Addressed:**
1. Google indexing 404 pages instead of articles (missing redirects)
2. No custom 404 page (Google indexes error pages with default metadata)
3. Dead SearchAction JSON-LD schema (references non-existent /search route)
4. Article re-processing loop in AI Workflow cron
5. Meta description validation failures (>160 chars)
6. Existing articles with poor/null meta tags
7. LivingArticle template literal bug (renders `${symbol}` as literal text)
8. Static OG image shared across all pages (no per-coin differentiation)

## ✅ Completed Phases
(None yet)
