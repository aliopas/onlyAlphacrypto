# SYSTEM HEALTH — Dashboard

**Last Checked:** May 14, 2026 (Post T-TR3-PA Governance Update)
**Checked By:** QA & Security Hunter

---

## Status

- Context Health: ✅ GOOD
- Duplicate Docs: 0
- Outdated Features: ✅ RESOLVED (FEAT-ALGO-VERDICT-REWIRe added)
- Broken References: 0
- Pending QA Tasks: 0
- Dead Context Risk: LOW
- Source Files Over 500 Lines: ❌ 6 VIOLATIONS
- Source Files Over 300 Lines: ⚠️ 8 warnings
- Operational/Historical Separation: ✅ MAINTAINED

---

## Governance Checklist

| Check | Result |
|---|---|
| FEATURE_MAP up to date? | ✅ FEAT-ALGO-VERDICT-REWIRe added (May 14) |
| PROJECT_STATE ↔ TIMELINE consistent? | ✅ CONSISTENT |
| All tasks have context packs? | ✅ 19/19 packs present |
| Duplicate architecture decisions? | ✅ NONE (DEC-001 to DEC-027 unique) |
| No source file over 500 lines? | ❌ 6 VIOLATIONS (see below) |
| Operational/Historical separation? | ✅ MAINTAINED |
| No stale TODO/IN_PROGRESS? | ✅ ALL 19 tasks correctly TODO |
| AGENT_MEMORY under 300 lines? | ✅ 73 lines |

---

## agent_gedens/ File Sizes

| File | Lines | Status |
|---|---|---|
| WORKFLOW_ENGINE.md | 302 | ⚠️ Soft limit — monitor |
| STARTER_PROMPTS.md | 256 | ✅ OK |
| FEATURE_MAP.md | 180 | ✅ OK (but outdated) |
| DECISIONS_COMPRESSED.md | 173 | ✅ OK |
| THE_NEXUS_HUB.md | 184 | ✅ OK |
| PROJECT_STATE.md | 149 | ✅ OK |
| AGENT_LOGS.md | 118 | ✅ OK |
| CONTEXT_PRIORITY.md | 117 | ✅ OK |
| RECOVERY_PROTOCOL.md | 96 | ✅ OK |
| SOURCE_OF_TRUTH.md | 89 | ✅ OK |
| README.md | 88 | ✅ OK |
| TIMELINE.md | 83 | ✅ OK |
| TASK_CONTEXT_TEMPLATE.md | 80 | ✅ OK |
| MAINTENANCE_PROTOCOL.md | 79 | ✅ OK |
| AGENT_MEMORY.md | 73 | ✅ OK |
| SYSTEM_HEALTH.md | — | ✅ OK |
| AGENTS_PROTOCOL.md | 66 | ✅ OK |
| EXECUTION_LOGS.md | 16 | ✅ OK |

---

## Source Files — ❌ Hard Limit Violations (>500 lines)

| File | Lines | Severity |
|---|---|---|
| backend/src/crons/aiWorkflow.cron.ts | 1036 | ❌ CRITICAL — 2x limit |
| backend/src/services/openai.service.ts | 809 | ❌ HIGH |
| backend/src/services/technicalAnalysis.service.ts | 778 | ❌ HIGH |
| backend/src/controllers/market.controller.ts | 700 | ❌ HIGH |
| backend/src/services/ai/prompt-factory.ts | 658 | ❌ HIGH |
| backend/src/models/market.model.ts | 596 | ❌ MEDIUM |

## Source Files — ⚠️ Soft Limit Warnings (300–500 lines)

| File | Lines |
|---|---|
| frontend/src/app/admin/shadow/page.tsx | 495 |
| frontend/src/features/airdrop/components/AirdropsPageClient.tsx | 447 |
| frontend/src/app/(standard)/scorecard/page.tsx | 445 |
| backend/src/services/levelIntelligence.service.ts | 464 |
| backend/src/test-article-generation.ts | 460 |
| frontend/src/features/terminal/components/AlphaStream.tsx | 354 |
| backend/src/test-airdrop-pipeline.ts | 343 |
| backend/src/services/eventImpactPersistence.service.ts | 313 |

---

## Active Alerts

1. ❌ **CRITICAL: aiWorkflow.cron.ts at 1002 lines** — Must split before next phase. Suggested: extract signal generation logic into separate service.
2. ❌ **HIGH: 5 more files over 500 lines** — Schedule compression/split alongside next touch of each file.
3. ⚠️ **FEATURE_MAP.md partially outdated** — FEAT-ALGO-VERDICT-REWIRe added. FEAT-SEO-META still missing (add when first SEO task reaches DONE).
4. ⚠️ **WORKFLOW_ENGINE.md at 302 lines** — Soft limit. No action yet.

---

## Archive Status

| Archive | Contents | Size |
|---|---|---|
| archives/phases/nexus-hub-tranche1-2-complete-2026-05-13.md | Full historical NEXUS | ~3300 lines |
| archives/snapshots/SNAP-Q2-2026-01-pre-wave4.md | PROJECT_STATE pre-trim | ~200 lines |

---

## History

| Date | Alert | Resolved By |
|---|---|---|
| May 14, 2026 | T-TR3-PA phase closed — 4/4 tasks approved, governance files updated | QA Hunter |
| May 14, 2026 | Governance health check — 6 source files over 500 lines flagged | Governance Agent |
| May 14, 2026 | FEATURE_MAP.md missing 2 active mission features | Governance Agent (pending) |
| May 13, 2026 | THE_NEXUS_HUB.md at 3303 lines → trimmed to 48 | Wave 4 cleanup |
| May 13, 2026 | PROJECT_STATE.md trimmed (history → references) | Wave 4 cleanup |
| May 13, 2026 | System initialized (Wave 0) | System Architecture |
