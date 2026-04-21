# 🤖 ONLYALPHA — PROJECT STATE

**Last Updated:** April 21, 2026
**Current Focus:** Phase 12 — Airdrop UX Overhaul: From Functional to Premium

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

## 🔴 Current Mission: Phase 12 — Airdrop UX Overhaul: From Functional to Premium

**Status:** 🟡 APPROVED — Tech Lead Review Complete, Guardrails Issued, Ready for Architect
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Scope:** Frontend-heavy. 3 NEW components + 5 modified files + 1 backend endpoint fix. Zero new npm packages.
**Task Breakdown:** 15 tasks (T-01→T-15) in `agent_gedens/THE_NEXUS_HUB.md`
- Batch 1 (P0): T-01→T-05 — Urgent endpoint, frontend API, Radar widget, smart cards, progress bars
- Batch 2 (P1): T-06→T-09 — Task timeline, manual attestation, AI report, detail page integration
- Batch 3 (P2): T-10→T-13 — Stats fix, portfolio hero, deadline banner, live countdown
- Batch 4 (P3): T-14→T-15 — Gamification (streak + badges)

### ⚠️ Tech Lead Guardrails (MUST be followed)
1. `/urgent` endpoint: `optionalAuth` + 60s Redis cache + explicit return type
2. Progress in cards: EMBED `progressPercentage` in `/projects` list response via SQL join — zero extra API calls
3. Preserve existing 30s polling in TaskList rewrite (lines 24-41 of current TaskList.tsx)
4. AI report parser: defensive, no fragile regex, always fall through to unstructured display
5. `parseEstValue`: single utility function, handles all edge cases (single, range, TBD, null)
6. Toast/banner: React state + Tailwind only, no external libraries
7. Countdown timer: strict `useEffect` cleanup pattern (no memory leaks)
8. `userProgress` type: use `completed: boolean` + `verifiedBy: 'auto' | 'manual'` to match DB schema (NOT `status` enum)

## ✅ Completed Phases

### Phase 11 — Airdrop RSS Hunter: Real Data Pipeline
**Plan Path:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Completed:** April 21, 2026
**Tasks:** 7 (T-01 through T-07) — All Passed QA

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
