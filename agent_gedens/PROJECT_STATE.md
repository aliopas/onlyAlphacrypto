# ONLYALPHA — PROJECT STATE

**Last Updated:** May 1, 2026
**Current Focus:** Phase 23 — TP/SL Auto-Close & Signal Lifecycle (P0)

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

## Current Mission: Phase 23 — TP/SL Auto-Close & Signal Lifecycle (P0)

**Status:** PLANNED — Authorized May 1, 2026
**Key Objective:** Add Stop-Loss / Take-Profit auto-close mechanism to signal system. Currently signals stay active indefinitely until AI reverses direction — trades that hit +10% to +90% profit never close and P&L evaporates. Scorecard Win Rate is artificially destroyed.

**Root Cause:**
- Zero TP/SL mechanism in schema, services, or crons
- AI already outputs `supportLevels` and `resistanceLevels` (prompt-factory.ts:277-278) but they're completely unused
- No time-based auto-expiry for stale signals
- Only closure path is AI direction reversal (unpredictable timing)

**Architecture Changes:**
- 3 new columns: `stop_loss_price`, `take_profit_price`, `auto_closed_reason` on `signal_performance`
- New utility: `tpslCalculator.service.ts` — derives TP/SL from S/R levels or default %
- New cron: `tpslMonitor.cron.ts` — runs every 15 min, auto-closes on TP/SL hit + 30d expiry
- Signal creation flow enhanced: S/R levels → TP/SL calculator → stored in DB
- Scorecard API returns TP/SL data + close reason
- Frontend displays TP/SL columns and close reason badges

**Files Plan (9 tasks):**
| # | File | Action | Description |
|---|------|--------|-------------|
| T-01 | `backend/scripts/migrate-tpsl-columns.sql` | NEW | SQL migration + backfill |
| T-02 | `backend/src/models/market.model.ts` | MODIFY | 3 new Drizzle columns |
| T-03 | `backend/src/services/tpslCalculator.service.ts` | NEW | Pure TP/SL calculator from S/R |
| T-04 | `backend/src/services/signalManager.service.ts` | MODIFY | Store TP/SL on INSERT |
| T-05 | `backend/src/crons/aiWorkflow.cron.ts` | MODIFY | Pass S/R levels to signal manager |
| T-06 | `backend/src/crons/tpslMonitor.cron.ts` | NEW | TP/SL monitor + 30d expiry |
| T-07 | `backend/src/server.ts` | MODIFY | Register new cron |
| T-08 | `backend/src/controllers/market.controller.ts` | MODIFY | Return TP/SL in API |
| T-09 | `frontend/src/app/(standard)/scorecard/page.tsx` | MODIFY | Display TP/SL + close reason |

**Default TP/SL (fallback if no S/R from AI):**
- BUY/STRONG_BUY: TP = +15%, SL = -8%
- SELL/STRONG_SELL: TP = +15%, SL = -8% (inverse direction)

**Previous:** Phase 22 — Airdrop Pipeline Resurrection (P0 HOTFIX) — ✅ DEPLOYED

## Completed Phases

### Phase 22 — Airdrop Pipeline Resurrection (P0 HOTFIX)
**Completed:** April 29, 2026
**Deploy Commit:** `110313b`

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
