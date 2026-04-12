# OnlyAlpha — Project State

**Last Updated:** 2026-04-12
**Updated By:** Architect Agent (GLM-5-Turbo)
**Protocol Version:** 1.0

---

## Global Status

| Metric | Value |
|---|---|
| **Current Phase** | Phase 5 — Frontend Refactor & Branding |
| **Build Status** | `tsc --noEmit` passing |
| **Known Bugs** | 0 critical, 1 low-priority |
| **Blocking Issues** | None |

---

## Phase Completion Summary

| Phase | Name | Status | Tasks |
|---|---|---|---|
| Phase 0 | Critical Hotfixes | **COMPLETE** | Tasks 1-6 |
| Phase 1 | AI Cost Optimization | **COMPLETE** | Tasks 7-10 |
| Phase 2 | Living Article System | **COMPLETE** | Tasks 11, 11b, 11c, 12, 13, 14 |
| Phase 3 | Temporal Intelligence | **COMPLETE** | Task 15 |
| Phase 4 | Chat System Rebuild | **COMPLETE** | Task 16 |
| Phase 5 | Frontend Refactor & Branding | **NOT STARTED** | Tasks 17-19 |
| Phase 6 | Text Embeddings (Optional) | **NOT STARTED** | Task 20 |

---

## Recently Completed Tasks

### Task 16: Chat System Rebuild — Context AI + Quotas — COMPLETED (2026-04-12)
- **Files Modified:**
  - `backend/src/controllers/chat.controller.ts` — Context AI prompt now fed by Master Article + Timeline + Memory
  - `backend/src/middleware/chat-quota.middleware.ts` — Redis-based chat quotas (guest: 5, free: 15, pro: 999+30 context)
  - `backend/src/routes/chat.routes.ts` — Quota middleware wired
- **Architecture:** Zero `any` types — proper `PlanTier` union type narrowing for quota lookup
- **Notes:** Redis fallback — if Redis unavailable, requests fall through (don't block users)

### Task 15: Local Similarity Check + Fix Temporal Pattern — COMPLETED (2026-04-12)
- **Files Created:**
  - `backend/src/services/similarity.service.ts` — `isDuplicateByKeywords()` for keyword-based dedup
- **Files Modified:**
  - `backend/src/crons/aiWorkflow.cron.ts` — Pre-AI dedup check integrated (skip before any AI calls)
  - `backend/src/services/temporalIntelligence.service.ts` — `buildTemporalPattern` fuzzy matching fix
- **Architecture:** No AI cost for dedup — pure keyword matching
- **Notes:** Zero `any` types

### Task 14: Conviction Score Service + Cron — COMPLETED (2026-04-10)
- **Files Created:**
  - `backend/src/services/conviction.service.ts` — Core algorithm: `computeEventDelta`, `applyTimeDecay`, `calculateIncrementalConviction`, `calculateAbsoluteConviction`, `calculateTrend`
  - `backend/src/crons/convictionUpdate.cron.ts` — 6-hour cron with Redis `lastCronRun` tracking, incremental delta architecture
  - `backend/src/scripts/seed-historical-conviction.ts` — One-time backfill script (idempotent)
- **Files Modified:**
  - `backend/src/server.ts` — Cron registered as `ConvictionUpdate`
- **Architecture:** Incremental Delta + Time Decay (1% mean-reversion per run toward score 50)
- **Notes:** `calculateTrend` is private (not exported). All zero `any` types. No AI calls — pure algorithmic.

### Task 11b: Living Article API Endpoints — COMPLETED
- **Files Modified:**
  - `backend/src/controllers/market.controller.ts` — Added `getMasterArticle` (L197), `getTimeline` (L236)
  - `backend/src/routes/market.routes.ts` — Added `/master/:symbol` (L17), `/timeline/:symbol` (L18)
- **Cache:** 60s for master article, 30s for timeline
- **Auth:** `optionalAuth` (public read)

### Task 11c: Seed Master Articles Script — COMPLETED
- **File Created:** `backend/src/scripts/seed-master-articles.ts` (116 lines)
- **Behavior:** Migrates top articles from `coin_news` to `coin_master_articles`, seeds `coinTimelineUpdates` from top 3 per coin. Idempotent.

### Bug Fix: `saveMemory` riskVerdict/redFlags Swap — COMPLETED
- **File:** `backend/src/crons/aiWorkflow.cron.ts`
- **Fix:** Added `deriveRiskLevel()` helper (L61). `saveMemory` now uses `deriveRiskLevel(impactScore, verdict)` instead of raw text.
- **Minor Note:** `deriveRiskLevel` return type includes `'SCAM'` but the function body never returns it (unreachable code path). Low priority.

### Bug Fix: Wire Offset Pagination — COMPLETED
- **File:** `backend/src/controllers/market.controller.ts`
- **Fix:** Added `offsetParam` parsing, included offset in `cacheKey`, added `.offset(offset)` to Drizzle query.

### Task 13: aiWorkflow 3-Path Routing — COMPLETED
- **File:** `backend/src/crons/aiWorkflow.cron.ts`
- **Behavior:** NOISE → skip, MINOR → single GPT-nano call (timeline update only), MAJOR → full pipeline (DeepSeek + GPT-nano + audit + memory)
- **Extras:** Redis-based mutex lock (`cron:aiworkflow:lock`, TTL 1h), `TRIGGER_TYPE_MAP` derivation, `extractSection` helper

### Tasks 1-12: All COMPLETE
- Phase 0 hotfixes (chat context mode, SSE parsing, buffer cleanup, asset count, force-seed auth, dead code)
- Phase 1 cost optimization (dual DeepSeek gateway, triage routing, daily historical cron, conditional audit, coinMemory feed)
- Phase 2 schema + triage classification + Living Article DB

---

## Upcoming Milestones

### Task 17: Frontend Article Sections + Institutional Branding (Phase 5)
- **Priority:** MEDIUM
- **Dependencies:** Task 11b (complete), Task 16 (complete)
- **Scope:**
  - Parse article sections into accordion UI
  - Rename all branding terms (institutional rename)
- **Blockers:** None

### Task 18: Living Article UI + Alpha Snapshot Widget (Phase 5)
- **Priority:** MEDIUM
- **Dependencies:** Task 11b (complete), Task 16 (complete)
- **Scope:**
  - Living Article view (Alpha Snapshot header + Master Article accordion + Timeline feed)
  - Alpha Snapshot widget (conviction bar, posture badge, risk tags)
- **Blockers:** None

### Task 19: Fix Terminal Selection + Pagination + Sources (Phase 5)
- **Priority:** MEDIUM
- **Dependencies:** Task 11b (complete), Task 16 (complete)
- **Scope:**
  - Fix non-unique selection highlighting
  - Deduplicate "Show More" results by ID
  - Wire tab pagination with offset support
  - Fix radar sources to use time-proximity matching
- **Blockers:** None

### Task 20: Text Embeddings (Phase 6 — Optional)
- **Dependencies:** Task 15 (complete)
- **Scope:** pgvector, semantic dedup (cosine similarity >= 0.88)

---

## Known Technical Debt

| Item | Priority | Description |
|---|---|---|
| `deriveRiskLevel` SCAM path | LOW | Return type includes `'SCAM'` but function never returns it. Dead code in type union. |
| `callGptNanoMasterUpdate` validation | LOW | No `ALLOWED_SECTIONS` filter on AI response. Drizzle is safe (ignores unknown keys) but production-risky. |
| Historical cron batching | LOW | `fetchHistoricalNewsForCoins` fetches all coins at once. Could timeout at 100+ coins. Needs batching (max 20/batch, 2s delay). |
| `calculateTrend` export | LOW | Private function but may be needed externally. |

---

## Key Architecture Decisions (Locked)

1. **Dual Gateway:** OpenRouter (GPT-5-nano for writing/chat) + DeepSeek Direct (analysis/triage/audit)
2. **Living Articles:** `coinMasterArticles` (one per coin) + `coinTimelineUpdates` (event stream)
3. **Conviction Score:** Incremental delta + 1% time decay toward 50 (no AI, pure algorithmic)
4. **Triage:** `classification` (MAJOR/MINOR/NOISE) from AI, `triggerType` derived from `eventType` via code mapping
5. **Zero `any` Types:** Enforced across all new code
