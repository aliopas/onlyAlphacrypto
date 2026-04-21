# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: Phase 12 — Airdrop UX Overhaul: From Functional to Premium

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 15 (T-01 through T-15, in Batches)
**Priority Order:** Batch 1 → Batch 2 → Batch 3 → Batch 4
**Executor:** Senior Developer
**Scope:** Frontend-heavy. 3 NEW components + 5 modified files + 1 backend endpoint fix. Zero new npm packages.

---

### 1. Planning Stage (Planner)

**Target:** Make the Airdrop UI reflect the powerful AI pipeline. Move from static placeholders and raw text dumps to a premium, gamified, and highly informative frontend experience.
**Key Constraints:** 
1. Zero new npm packages — use existing Tailwind CSS, Lucide icons, React primitives.
2. No backend schema changes — use existing tables.
3. No changes to crons or AI pipelines — only frontend + controller modifications.
4. Backward compatible API usage.

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** Work sequentially through Batches 1 to 4.

---

#### Batch 1: P0 — Immediate Impact (E-1 + E-2)

**T-01: Add `GET /api/airdrop/urgent` backend endpoint**
**File:** `backend/src/controllers/airdrop.controller.ts` & `backend/src/routes/airdrop.routes.ts`
**Status:** ✅ Done
**Scope:**
1. In `airdrop.controller.ts`, add `getUrgentAirdrops` method.
2. Query the `airdrop_projects` table (and user progress if applicable) to return the top 3 projects sorted by urgency composite score.
   - Urgency pseudo calculation: `(daysLeft <= 3 ? 100 : 0) + (isNew ? 30 : 0) + (progressPct < 50 && hasDeadline ? 20 : 0)`
   - Include progress data for the user if applicable.
3. In `airdrop.routes.ts` (or equivalent route file), add the GET route `/urgent` pointing to the new controller, ensuring appropriate auth middleware if needed (or make it public but returning personalized data if logged in).

**T-02: Add `getUrgentAirdrops()` to frontend API client**
**File:** `frontend/src/features/airdrop/api.ts` & types file
**Status:** ✅ Done
**Scope:**
1. Define the frontend types for the urgent endpoint response.
2. Add `export const getUrgentAirdrops = async () => ...` to fetch from `/api/airdrop/urgent`.

**T-03: Rewrite `AirdropWatchlist.tsx` as live Alpha Airdrop Radar**
**File:** `frontend/src/features/home/components/AirdropWatchlist.tsx`
**Status:** ✅ Done
**Scope:**
1. Fetch data using `getUrgentAirdrops()`.
2. Replace static "Coming Soon" with a micro-feed of top 3 urgent airdrops.
3. Display project name, pulsing red dot for critical urgency.
4. Display a countdown timer (DD:HH:MM) for deadlines.
5. Display mini progress bar.
6. Display "NEW" badge if created within 48h.
7. Risk verdict colors (SAFE=emerald, MEDIUM=yellow, HIGH=orange, SCAM=red).
8. Handle edge cases: Zero airdrops (show educational text), disconnected wallet (blur with "Connect wallet"), deadlines passed.

**T-04: Add smart card state logic to `AirdropsPageClient.tsx`**
**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Implement 4 visual states per card:
   - 🔴 **CRITICAL_DEADLINE**: TGE <= 3 days. Red pulsing border, countdown timer, red shadow.
   - 🟢 **ON_TRACK**: >50% tasks done, no deadline. Green border, mini checkmark.
   - 🔵 **NEWLY_DISCOVERED**: `createdAt` last 48h. Blue "NEW" badge, blue glow.
   - 🟡 **NEEDS_ATTENTION**: <30% tasks AND deadline <= 14 days. Amber stripe, "X tasks remaining", amber progress bar.
2. Prioritize states: CRITICAL > NEEDS_ATTENTION > NEWLY_DISCOVERED > ON_TRACK.
3. Network badge as colored chip.
4. Format Est. Value prominently (prefixed with $, suffix with +).
5. Relative time for snapshot if <= 7 days.

**T-05: Wire real progress data into card progress bars**
**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Ensure `progressPercentage` replaces the hardcoded `w-0` in all progress bars recursively.
2. Must dynamically display the state sourced from backend (`/projects/:id/progress`).

---

#### Batch 2: P1 — Core UX (E-3 + E-4)

**T-06: Redesign `TaskList.tsx` as vertical quest timeline**
**File:** `frontend/src/features/airdrop/components/TaskList.tsx`
**Status:** ✅ Done
**Scope:**
1. Implement vertical timeline UI with connected vertical lines.
2. Verified task: Show truncated TX hash with explorer link, "Verified by: Auto" + timestamp, animated green checkmark.
3. Pending/verifying task: Show watched contract address, "Checking on-chain..." + spinner. If fail: "Will retry in 30s".
4. Color-coded timeline lines: green (verified), blue (in-progress), gray (not started).
5. Handle disconnected wallets: "Connect wallet to auto-verify" tooltip.
6. All verified: Show "🎉 All tasks complete!" celebration.

**T-07: Add manual task self-attestation button + external link**
**File:** `frontend/src/features/airdrop/components/TaskList.tsx`
**Status:** ✅ Done
**Scope:**
1. For manual tasks (not auto-verifiable), show `[🔗 Open External Link]` if a URL is relevant.
2. Show `[✓ I've Done This]` which manually marks it verified and updates state properly in the DB/local context.
3. Ensure no Disabled "MANUAL" button is left in the UI.

**T-08: Create `AiReportStructured.tsx` component**
**File:** `frontend/src/features/airdrop/components/AiReportStructured.tsx` (NEW)
**Status:** ✅ Done
**Scope:**
1. Create a structured renderer mapping common AI headings to accordion sections (Risk, Legitimate, Value, Funding).
2. If text is unstructured, show as-is with "Limited intelligence" header.
3. Scannable format: display confidence bars and safe/risk verdicts.
4. Display `updatedAt` timestamp + "AI-analyzed" badge.
5. Provide empty state logic: "Limited intelligence available...".

**T-09: Integrate structured AI report into detail page**
**File:** `frontend/src/features/airdrop/components/AirdropDetailClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Replace the raw `whitespace-pre-wrap` dump of `project.aiReport` with the newly created `<AiReportStructured report={project.aiReport} timestamp={...} />`.
2. Minor layout adjustments to accommodate the new component beautifully.

---

#### Batch 3: P2 — Polish & Retention (E-5 + E-6)

**T-10: Fix `getStats` backend to calculate real `totalValue`**
**File:** `backend/src/controllers/airdrop.controller.ts`
**Status:** ✅ Done
**Scope:**
1. Update `getStats` calculation: parse `estValue` strings (extract numeric bounds, drop "TBD").
2. Compute `totalValue` dynamically based on project's estimated value lower bound * user's `progressPercentage`.
3. Sum across all active participated projects.
4. Ensure no `0` hardcode is left.

**T-11: Add portfolio value hero section to Hub**
**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Extract and fetch modified `getStats`.
2. Build prominent hero strip at the top:
   - Total unrealized value (formatted `$X,XXX+`).
   - Active projects count and completed count.
   - Handle empty state properly: "You could be earning $X..." or "$0 - Start farming...".
   - Value "TBD" pending handling.

**T-12: Add deadline banner + toast notification system**
**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Implement a dismissible banner for the most urgent deadline using an alert component.
2. Banner should mention project name, remaining time, and uncompleted tasks.
3. Save dismissal in `sessionStorage` so it hides for the session.

**T-13: Add live `DD:HH:MM:SS` countdown to detail page**
**File:** `frontend/src/features/airdrop/components/AirdropDetailClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Implement a `setInterval` ticking timer on the `snapshotDate` / `tgeDate`.
2. Ensure interval cleans up on unmount.
3. Output precise hours, minutes, seconds dynamically.

---

#### Batch 4: P3 — Gamification (E-7)

**T-14: Create `FarmingStreak.tsx` component**
**File:** `frontend/src/features/airdrop/components/FarmingStreak.tsx` (NEW)
**Status:** ✅ Done
**Scope:**
1. Build light UI for simple streaks: "🔥 X-day farming streak".
2. Add static view for achievements: "Early Bird", "Completionist", "Degen".
3. Empty state: "Start your first farm".

**T-15: Integrate streak + badges into Hub page**
**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Status:** ✅ Done
**Scope:**
1. Render `<FarmingStreak />` component appropriately in the page hierarchy (e.g., sidebar or sub-header).

---

### 3. QA & Security Stage (QA Hunter)

**Status:** 🟡 Ready — All 15 Execution Tasks Marked Done, Awaiting QA Audit

---

### 4. Deployment Stage (Release Manager)

**Status:** ⬜ Pending — Awaiting QA Pass
