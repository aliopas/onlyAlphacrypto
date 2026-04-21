# 🪂 Phase 12 — Airdrop UX Overhaul: From Functional to Premium

**Status:** 🟡 PLANNING — Awaiting Tech Lead Approval
**Created:** April 21, 2026
**Source:** Product Visionary Audit — Full UX analysis of all 17 airdrop files
**Scope:** Frontend-heavy. 5 NEW/rewritten components + 3 modified components + 1 backend endpoint fix. Zero new npm packages.

---

## 📊 Problem Statement

The Airdrop feature has a working backend pipeline (RSS Hunter, AI validation, auto-verification) but the UI **doesn't reflect any of that intelligence**. Key issues:

| Area | Current State | Problem |
|------|--------------|---------|
| Home Widget | "Coming Soon" placeholder with lock icon | Dead widget on the most-visited page kills perceived value |
| Hub Grid Cards | Static cards, progress bar hardcoded to `w-0` | No visual priority, urgency, or differentiation |
| Detail Page AI Report | Raw `whitespace-pre-wrap` text dump | Doesn't communicate trust or intelligence |
| Task List | Flat checklist, "MANUAL" button does nothing | No guidance, no verification animation, no external links |
| Portfolio Value | `totalValue` hardcoded to `0` in controller | Zero dopamine trigger |
| Deadlines | Passive sidebar text | No active notifications, no real-time countdown |
| Gamification | None exists | No reason to return daily |

---

## 🎯 Enhancement Overview (7 Enhancements, Prioritized)

| Priority | Enhancement | Description |
|----------|-------------|-------------|
| **P0** | E-1: Home Widget — Alpha Airdrop Radar | Replace "Coming Soon" with live urgency feed |
| **P0** | E-2: Smart Card States | Cards with 4 visual states: Critical/OnTrack/New/NeedsAttention |
| **P1** | E-3: Task Journey Redesign | Vertical quest timeline with trust signals & manual task support |
| **P1** | E-4: AI Trust Signals | Structured, scannable AI report replacing raw text dump |
| **P2** | E-5: Portfolio Value Hero | Animated unrealized value counter at Hub top |
| **P2** | E-6: Deadline Notification Engine | Toast + banner + live countdown for critical deadlines |
| **P3** | E-7: Gamification Layer | Streaks, badges, leaderboard preview |

---

## 🏗️ Detailed Enhancement Specifications

---

### E-1: Home Widget — Alpha Airdrop Radar (P0)

**Files to modify:**
- `frontend/src/features/home/components/AirdropWatchlist.tsx` — Full rewrite
- `frontend/src/features/airdrop/api.ts` — Add `getUrgentAirdrops()` method
- `backend/src/controllers/airdrop.controller.ts` — Add `getUrgentAirdrops` endpoint

**Current behavior:** Renders a static "Coming Soon" lock icon. Zero data.

**New behavior:** A live micro-feed showing the 3 most urgent airdrop events with:
- Project name + urgency indicator (pulsing red dot for critical)
- Countdown in `DD:HH:MM` format for approaching deadlines
- Progress percentage with mini progress bar
- "NEW" badge for projects discovered within 48h
- Risk verdict color-coded (SAFE=emerald, MEDIUM=yellow, HIGH=orange, SCAM=red)

**UI Wireframe:**
```
┌─────────────────────────────────────────┐
│ 🪂 AIRDROP RADAR          🔴 2 URGENT  │
├─────────────────────────────────────────┤
│ ⚡ ZkSync Era    Snapshot in 2D 14H     │
│    ████████░░ 75% tasks done            │
│                                         │
│ 🆕 LayerZero    Just discovered         │
│    Est. $800+   Risk: SAFE              │
│                                         │
│ ⚠️ Berachain    TGE tomorrow            │
│    ██████░░░░  50% — 2 tasks pending    │
└─────────────────────────────────────────┘
```

**Edge cases:**
- Zero airdrops discovered → Educational empty state: "Our AI Hunter is scanning RSS feeds. Check back in 24h."
- User not logged in → Show urgency feed but blur + overlay: "Connect wallet to start farming"
- All deadlines passed → Switch status to "Awaiting TGE" instead of hiding the card

**Backend spec:**
```
GET /api/airdrop/urgent
Response: Array of top 3 projects sorted by urgency composite score:
  urgencyScore = (daysLeft <= 3 ? 100 : 0) + (isNew ? 30 : 0) + (progressPct < 50 && hasDeadline ? 20 : 0)
```

---

### E-2: Smart Card States (P0)

**Files to modify:**
- `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` — Card rendering logic

**Current behavior:** All cards identical. Progress bar is `w-0` hardcoded. No visual hierarchy.

**New behavior:** Each card has **4 distinct visual states** determined by urgency + progress:

| State | Trigger | Visual Treatment |
|-------|---------|-----------------|
| 🔴 **CRITICAL_DEADLINE** | Snapshot/TGE ≤ 3 days away | Red pulsing border animation (`animate-pulse`), countdown timer front-and-center, red glow shadow |
| 🟢 **ON_TRACK** | >50% tasks done, no deadline pressure | Green accent border, satisfying mini checkmark icon, green progress bar |
| 🔵 **NEWLY_DISCOVERED** | `createdAt` within last 48h | Blue "NEW" badge, subtle blue glow effect, blue-tinted border |
| 🟡 **NEEDS_ATTENTION** | <30% tasks done AND deadline ≤ 14 days | Amber/yellow warning stripe at top, "X tasks remaining" callout, amber progress bar |

**State priority (when multiple match):** CRITICAL > NEEDS_ATTENTION > NEWLY_DISCOVERED > ON_TRACK

**Additional card improvements:**
- Network badge redesigned as a colored chip (not just text)
- Est. Value displayed prominently with "$" prefix and "+" suffix for TBD ranges
- Snapshot date: if within 7 days, show relative time ("in 3 days") instead of absolute date
- Progress bar: must reflect real `progressPercentage` from `/projects/:id/progress` (currently hardcoded to `w-0`)

**Edge case:** Project is both "new" AND has critical deadline → CRITICAL state wins (urgency > novelty)

---

### E-3: Task Journey Redesign (P1)

**Files to modify:**
- `frontend/src/features/airdrop/components/TaskList.tsx` — Full rewrite
- `frontend/src/features/airdrop/components/AirdropDetailClient.tsx` — Minor layout adjustments

**Current behavior:** Flat rows with "Task #1", "Task #2". Manual tasks show disabled "MANUAL" button.

**New behavior:** Vertical quest timeline with visual connectors:

```
  ✅  Bridge 0.5 ETH to ZkSync           VERIFIED
  │     ↳ tx: 0x3f4a...b2c1 (auto)       2 hours ago
  │
  ⏳  Swap on DEX (min $50)              VERIFYING...
  │     ↳ Checking on-chain...           retry in 30s
  │
  ○  Join Discord + mint NFT             MANUAL TASK
  │     ↳ Click to open Discord
  │     [🔗 Open Discord]  [✓ I've Done This]
  │
  ○  Provide liquidity ≥ $100            NOT STARTED
```

**Key changes:**

1. **Auto-verifiable tasks (verified):**
   - Show matched TX hash (truncated with link to explorer)
   - Show "Verified by: Auto" with timestamp
   - Green checkmark with draw-in animation

2. **Auto-verifiable tasks (pending/verifying):**
   - Show the contract address being watched: "Watching: 0x3a4b...9f1e"
   - Show polling status: "Checking on-chain..." with spinner
   - If polling fails: "Will retry in 30s" instead of silent failure

3. **Manual tasks (not auto-verifiable):**
   - Show [🔗 Open External Link] button if the task has a related URL
   - Show [✓ I've Done This] self-attestation button that sets status to MANUAL_VERIFIED
   - No more disabled "MANUAL" button — that's demoralizing UX

4. **Visual connectors:**
   - Vertical line connecting tasks (timeline feel)
   - Color-coded: green for verified, blue for in-progress, gray for not started

**Edge cases:**
- User has no wallet connected → Disable auto-verification, show "Connect wallet to auto-verify" tooltip
- Task has no contract address and isn't auto-verifiable → Pure manual task, make it obvious
- All tasks verified → Show celebration state: "🎉 All tasks complete! You're eligible."
- Verification polling error → Show retry countdown, not silent failure

---

### E-4: AI Trust Signals (P1)

**Files to modify:**
- `frontend/src/features/airdrop/components/AirdropDetailClient.tsx` — AI Report section rewrite

**Current behavior:** Raw `whitespace-pre-wrap` text dump from `project.aiReport`.

**New behavior:** Structured, scannable AI intelligence report with sections:

```
╔══════════════════════════════════════════╗
║  🤖 AI INTELLIGENCE REPORT               ║
║  Analyzed: April 19, 2026 · Model: R1    ║
╠══════════════════════════════════════════╣
║                                          ║
║  RISK ASSESSMENT:  SAFE ✓                ║
║  ████████░░  82% confidence              ║
║                                          ║
║  WHY THIS IS LEGITIMATE:                 ║
║  • Backed by a16z + Dragonfly            ║
║  • 2.4M active addresses                 ║
║  • Mainnet live since Jan 2026           ║
║                                          ║
║  ESTIMATED VALUE: $800 - $2,400          ║
║  Based on: TVL, funding, comparable      ║
║                                          ║
║  ⚠️ RISKS TO WATCH:                      ║
║  • No explicit token confirmation        ║
║  • Snapshot date may shift               ║
╚══════════════════════════════════════════╝
```

**Implementation approach:**
- The AI report text is already structured by the AI prompt. We parse it by looking for markdown-style headers or key phrases.
- If the report contains sections matching keywords like "Risk", "Legitimate", "Value", "Funding" → split into accordion sections
- If the report is unstructured (short text) → display as-is with a "Limited intelligence" header
- Always show the `updatedAt` timestamp + "AI-analyzed" badge for trust

**Edge case:** AI report is very short or empty → Show: "Limited intelligence available — our AI is gathering more data. Check back soon."

---

### E-5: Portfolio Value Hero (P2)

**Files to modify:**
- `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` — Add hero section above grid
- `backend/src/controllers/airdrop.controller.ts` — Fix `getStats` to calculate real `totalValue`

**Current behavior:** `getStats` returns `totalValue: 0` hardcoded. Sidebar shows "$0".

**New behavior:** A prominent hero strip at the top of the Airdrop Hub:

```
╔══════════════════════════════════════════════════╗
║  YOUR FARMING PORTFOLIO                         ║
║                                                  ║
║  $4,850+   unrealized estimated value            ║
║  ▲ +$1,200 from new airdrops this week           ║
║                                                  ║
║  ████████████░░░░  8 active  |  3 completing     ║
╚══════════════════════════════════════════════════╝
```

**Backend fix for `getStats`:**
```typescript
// Calculate totalValue from estValue of projects where user has >0% progress
// estValue format in DB: "$800", "$1,200-$2,400", "TBD"
// Parse: extract numeric values, use lower bound for ranges, skip "TBD"
// Multiply by user's progressPercentage for that project
// Sum across all active projects
```

**Edge cases:**
- User has 0% progress on everything → Show potential: "You could be earning $X across N airdrops"
- All `estValue` are "TBD" → Show "Value pending AI assessment"
- Value calculation results in $0 → Show "$0 — Start farming to unlock estimated value"

---

### E-6: Deadline Notification Engine (P2)

**Files to modify:**
- `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` — Add banner + toast system
- `frontend/src/features/airdrop/components/AirdropDetailClient.tsx` — Add live countdown

**New behavior:**

1. **In-page banner** (top of Hub): A dismissible banner for the single most urgent deadline:
   ```
   ⚡ ZkSync Era snapshot in 2 days — you have 2 uncompleted tasks  [Go to Tasks]  [Dismiss]
   ```

2. **Live countdown on detail page**: Real-time `DD:HH:MM:SS` ticking countdown for snapshot/TGE dates using `setInterval` every second.

3. **Card-level countdown**: On the Hub grid, cards in CRITICAL state show `HH:MM:SS` ticking countdown.

**Edge cases:**
- Multiple projects hit critical zone → Show the one with highest `estValue`
- Deadline passes while user is on page → Animate to "SNAPSHOT PASSED" status, don't remove
- User dismisses banner → Store in sessionStorage, don't show again this session

---

### E-7: Gamification Layer (P3)

**Files to modify:**
- NEW: `frontend/src/features/airdrop/components/FarmingStreak.tsx`
- `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` — Integrate streak + badges

**New behavior (light gamification):**

1. **Streak counter**: "🔥 7-day farming streak" — consecutive days with ≥1 task action
2. **Achievement badges** (display-only, no complex backend):
   - "Early Bird" — Joined an airdrop within 24h of discovery
   - "Completionist" — 100% tasks on 3+ projects
   - "Degen" — Farming 5+ airdrops simultaneously
3. **Activity comparison**: "You're farming more actively than 72% of OnlyAlpha users"

**Edge case:** New user with 0 activity → Show "Start your first farm" CTA instead of empty badges

---

## 📁 File Change Summary

### New Files (3)
| File | Enhancement | Description |
|------|-------------|-------------|
| `frontend/src/features/airdrop/components/FarmingStreak.tsx` | E-7 | Streak + badges display component |
| `frontend/src/features/home/components/AirdropRadarWidget.tsx` | E-1 | New home page airdrop radar (or rewrite AirdropWatchlist.tsx) |
| `frontend/src/features/airdrop/components/AiReportStructured.tsx` | E-4 | Structured AI report parser + renderer |

### Modified Files (5)
| File | Enhancement | Changes |
|------|-------------|---------|
| `frontend/src/features/home/components/AirdropWatchlist.tsx` | E-1 | Full rewrite from placeholder to live radar |
| `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` | E-2, E-5, E-6, E-7 | Smart cards, portfolio hero, deadline banner, gamification |
| `frontend/src/features/airdrop/components/AirdropDetailClient.tsx` | E-4, E-6 | Structured AI report, live countdown |
| `frontend/src/features/airdrop/components/TaskList.tsx` | E-3 | Quest timeline redesign with manual task support |
| `backend/src/controllers/airdrop.controller.ts` | E-1, E-5 | Add urgent endpoint, fix totalValue calculation |

### Files NOT Modified (all untouched)
- Routes, crons, services, models, types, API client (unless adding new endpoint methods)

---

## 🧪 Micro-Task Breakdown (For Execution)

### Batch 1: P0 — Immediate Impact (E-1 + E-2)

| Task ID | Title | Files | Type |
|---------|-------|-------|------|
| T-01 | Add `GET /api/airdrop/urgent` backend endpoint | `airdrop.controller.ts`, `airdrop.routes.ts` | Backend |
| T-02 | Add `getUrgentAirdrops()` to frontend API client | `airdrop/api.ts`, `airdrop/types.ts` | Frontend |
| T-03 | Rewrite `AirdropWatchlist.tsx` as live Alpha Airdrop Radar | `AirdropWatchlist.tsx` | Frontend |
| T-04 | Add smart card state logic to `AirdropsPageClient.tsx` | `AirdropsPageClient.tsx` | Frontend |
| T-05 | Wire real progress data into card progress bars | `AirdropsPageClient.tsx` | Frontend |

### Batch 2: P1 — Core UX (E-3 + E-4)

| Task ID | Title | Files | Type |
|---------|-------|-------|------|
| T-06 | Redesign `TaskList.tsx` as vertical quest timeline | `TaskList.tsx` | Frontend |
| T-07 | Add manual task self-attestation button + external link | `TaskList.tsx` | Frontend |
| T-08 | Create `AiReportStructured.tsx` component | NEW: `AiReportStructured.tsx` | Frontend |
| T-09 | Integrate structured AI report into detail page | `AirdropDetailClient.tsx` | Frontend |

### Batch 3: P2 — Polish & Retention (E-5 + E-6)

| Task ID | Title | Files | Type |
|---------|-------|-------|------|
| T-10 | Fix `getStats` backend to calculate real `totalValue` | `airdrop.controller.ts` | Backend |
| T-11 | Add portfolio value hero section to Hub | `AirdropsPageClient.tsx` | Frontend |
| T-12 | Add deadline banner + toast notification system | `AirdropsPageClient.tsx` | Frontend |
| T-13 | Add live `DD:HH:MM:SS` countdown to detail page | `AirdropDetailClient.tsx` | Frontend |

### Batch 4: P3 — Gamification (E-7) — Optional

| Task ID | Title | Files | Type |
|---------|-------|-------|------|
| T-14 | Create `FarmingStreak.tsx` component | NEW: `FarmingStreak.tsx` | Frontend |
| T-15 | Integrate streak + badges into Hub page | `AirdropsPageClient.tsx` | Frontend |

---

## 🔒 Constraints

1. **Zero new npm packages** — All enhancements use existing Tailwind CSS, Lucide icons, and React primitives
2. **No backend schema changes** — All enhancements work with existing `airdrop_projects`, `airdrop_tasks`, `user_progress` tables
3. **No changes to crons or AI pipelines** — Only frontend + controller-layer changes
4. **Backward compatible** — All existing API endpoints and their response shapes remain unchanged
5. **Mobile-responsive** — All new components must work on mobile viewports
6. **Performance** — Home widget must not add >100ms to page load. Use existing ISR cache strategy.

---

## 🗺️ Core User Journey (After Enhancements)

```
User opens Home
  → Sees "Airdrop Radar" with 2 urgent deadlines (E-1)
  → Clicks ZkSync card → Lands on Airdrop Hub
  → Sees $4,850+ portfolio value hero (E-5) → Feels motivated
  → Sees ZkSync card pulsing red "SNAPSHOT IN 2D" (E-2)
  → Sees deadline banner at top: "2 tasks remaining" (E-6)
  → Clicks into detail
  → Sees structured AI report: "SAFE · 82% confidence" (E-4)
  → Sees quest timeline: 3/4 tasks done, 1 auto-verifiable pending (E-3)
  → Clicks [VERIFY] → Watches real-time on-chain check → ✅ Animation (E-3)
  → Returns to Hub → Progress bar animates to 100% (E-2)
  → 🔥 Badge: "Completionist earned!" (E-7)
```

---

> **Bottom Line:** The backend intelligence is already there. This phase is purely about making the frontend **feel** that intelligence. Every enhancement is designed to bridge the gap between "powerful AI pipeline" and "premium user experience."
