# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: Phase 10 — Top Movers Widget: Full Implementation

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 1 (Single-file rewrite, broken into 7 granular sub-tasks for the Senior Developer)
**Priority Order:** T-01 → T-07 (sequential, each builds on the previous)
**Executor:** Senior Developer
**Scope:** Frontend-only. Single file: `frontend/src/features/home/components/TopMovers.tsx`

---

### 1. Planning Stage (Planner)

**Target:** Replace the current placeholder `TopMovers.tsx` (shows "Coming Soon" lock icon) with a fully functional, live-updating Top Movers widget. The backend endpoint `GET /market/movers` already returns `TopMover[]` — the frontend API method `homeApi.getTopMovers()` in `frontend/src/features/home/api.ts:35` already calls it. This is purely a UI rewrite.

**Existing Infrastructure (DO NOT MODIFY):**
- **API Method:** `homeApi.getTopMovers()` → returns `Promise<TopMover[]>` (see `api.ts:35`)
- **Type:** `TopMover { symbol, priceChangePercent, lastPrice, volume, quoteVolume }` (see `types.ts:46`)
- **Polling Reference:** `TickerBar.tsx` uses `useEffect` + `setInterval(fetchMovers, 15000)` — use the EXACT same pattern but with 30000ms interval
- **Loading State Reference:** `MarketMoodGauge.tsx` uses `animate-ping` dot + "Syncing..." text for loading
- **Container Style Reference:** All widgets use `bg-[#0A0A0A] border border-[#333] p-6`

**Key UX Behaviors (from Blueprint):**
1. Display only first 5 movers (not 10) — sidebar space is limited
2. Poll every 30 seconds (not 15s like TickerBar)
3. NEW badge: coins not in previous fetch get a badge that fades after 60 seconds
4. Flat market detection: if all 5 movers have change < 3%, swap header to "Market Pulse (24h)" with subtitle "Low volatility regime"
5. Extreme move detection: if any mover has change >= 40%, show "⚡ EXTREME" badge and dim row to `opacity-80`
6. Error with cached data: show "⚠ LIVE DELAYED" in yellow, keep showing last known data
7. Error with no cached data: show "RECONNECTING..." with pulsing dot
8. Each row is clickable → links to `/terminal/[symbol_without_USDT]`
9. Volume bar proportional to max `quoteVolume` in the list
10. Price formatting: `$X,XXX.XX` if >= $1, `$0.XXXX` if < $1

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

> **IMPORTANT:** This is a SINGLE FILE rewrite. All sub-tasks below are cumulative sections of `frontend/src/features/home/components/TopMovers.tsx`. The Senior Developer must write the COMPLETE file implementing ALL sub-tasks together in one pass. The breakdown below is for mental organization — DO NOT submit partial files.

**File:** `frontend/src/features/home/components/TopMovers.tsx`

#### Sub-Task Breakdown:

| Task ID | Priority | Section | Task Description | Status |
|---|---|---|---|---|
| **T-01** | P0 | **Imports & Types** | Constants, MoverRow interface, all imports. | ✅ Done |
| **T-02** | P0 | **Helper Functions** | toMoverRow, formatPrice (with NaN guard), SkeletonRows, EmptyState, ReconnectingState. | ✅ Done |
| **T-03** | P0 | **State & Data Fetching** | useState, useRef, useCallback, useEffect with dual intervals (30s poll + 5s badge cleanup). | ✅ Done |
| **T-04** | P0 | **Header Section** | Flat market swap, live indicator, "⚠ Live Delayed" on error with cached data. | ✅ Done |
| **T-05** | P0 | **Body — Conditional Rendering** | Skeleton → Reconnecting → Empty → Data table. | ✅ Done |
| **T-06** | P0 | **Mover Table Rows** | Rank, symbol + NEW/Extreme badges, change + price, proportional volume bar. | ✅ Done |
| **T-07** | P1 | **Edge Cases & Polish** | USDT strip, key props, division-by-zero guard, no console.logs, named export. | ✅ Done |

---

### 3. QA & Security Stage (QA Hunter)

**Status:** ✅ QA PASSED — All 15 checklist items verified. Mandatory fix applied (NaN guard in `formatPrice`). TypeScript compilation clean. No new dependencies. Named export matches `page.tsx:5`.

---

### 4. Deployment Stage (Release Manager)

- **Commit Message:** `feat(home): rewrite TopMovers widget with live polling, NEW/Extreme badges, flat market detection`
- **Status:** Ready for commit
