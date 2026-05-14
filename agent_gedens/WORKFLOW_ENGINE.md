# WORKFLOW ENGINE — OnlyAlpha Multi-Agent Orchestration

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026
**Owner:** System Architecture
**Source of Truth:** THIS FILE is the authoritative reference for all agent workflows

---

## Freeze Rules (Constitutional — Immutable)

### Rule 1: Canonical Naming Convention

| Entity | Format | Example |
|---|---|---|
| Tasks | `T-TR{X}-P{Y}-{NNN}` | T-TR2-P4-017 |
| Decisions | `DEC-{NNN}` | DEC-014 |
| Features | `FEAT-{NAME}` | FEAT-MARKET-REGIME |
| Context Packs | `CTX-{TASK-ID}` | CTX-T-TR2-P4-017 |
| Snapshots | `SNAP-{PERIOD}-{NN}` | SNAP-Q2-2026-01 |
| Phases | `TR{X}-P{Y}` | TR2-P4 |

### Rule 2: File Size Governance

| Limit | Lines | Action |
|---|---|---|
| Soft | 300 | Warning — consider compressing |
| Hard | 500 | MUST split, archive, or compress |

Applies to: AGENT_LOGS, TIMELINE, FEATURE_MAP, PROJECT_STATE, AGENT_MEMORY

### Rule 3: Context Expiration

| File | Lifecycle |
|---|---|
| Task Context Packs | Expire after task closure → archive |
| PROJECT_STATE | Always live |
| TIMELINE | Permanent archive |
| AGENT_MEMORY | Compress quarterly |
| THE_NEXUS_HUB | Clean after every phase closure |
| SYSTEM_HEALTH | Always live |

### Rule 4: Operational vs Historical Separation

- **Operational files:** current state, fast-changing (THE_NEXUS_HUB, PROJECT_STATE, SYSTEM_HEALTH)
- **Historical files:** archive only, read-only (TIMELINE, AGENT_LOGS, archives/*)
- **NEVER** mix the two:
  - PROJECT_STATE must NOT contain history
  - THE_NEXUS_HUB must NOT contain completed task discussions
  - TIMELINE must NOT contain current operational data

### Rule 5: No Implicit Workflow

- Every relation between files MUST be written explicitly in this document
- Every agent's reads/writes MUST be documented below
- **If it's not written here, it does not exist**

---

## Task Lifecycle

```
TODO → IN_PROGRESS → QA → DONE → ARCHIVED
         ↑              ↓
         BLOCKED ←──────┘ (needs fix)
```

| State | Meaning | Who Sets It | Next State |
|---|---|---|---|
| TODO | Task created, awaiting pickup | Strategic Planner | IN_PROGRESS |
| IN_PROGRESS | Being implemented | Senior Dev | QA |
| BLOCKED | Needs external fix/info | Senior Dev or QA | IN_PROGRESS |
| QA | Code delivered, awaiting review | Senior Dev | DONE or BLOCKED |
| DONE | QA passed, complete | QA Hunter | ARCHIVED (after phase closure) |
| ARCHIVED | Moved to archive | Governance Agent | Terminal |

### THE_NEXUS_HUB.md Format (Queue Only)

```markdown
## [Phase Name]
### T-TR2-P4-017 — [Task Title]
- **Status:** TODO / IN_PROGRESS / BLOCKED / QA / DONE
- **Assignee:** Senior Dev / QA Hunter
- **Context Pack:** contexts/CTX-T-TR2-P4-017.md
- **Depends On:** T-TR2-P3-001 (if any)
```

No long descriptions. No architecture reasoning. No code snippets.
All detail goes into the Context Pack.

---

## Agent Orchestration (Explicit Reads/Writes)

### Strategic Planner

**Reads:**
- `plans/phases/*` — source plans
- `plans/decisions/*` — architecture decisions
- `plans/roadmap/*` — roadmap context
- `FEATURE_MAP.md` — existing features
- `PROJECT_STATE.md` — current state
- `AGENT_MEMORY.md` — distilled patterns

**Writes:**
- `THE_NEXUS_HUB.md` — creates tasks (TODO state)
- `contexts/CTX-{TASK-ID}.md` — task context packs

**Hands off to:** Senior Developer

**Context Budget:** Max 5 files

**NEVER reads:**
- AGENT_LOGS.md (historical)
- TIMELINE.md (historical)
- Code files (not their layer)

---

### Senior Developer

**Reads:**
1. `contexts/CTX-{TASK-ID}.md` — task context pack (Priority 1)
2. `FEATURE_MAP.md` — feature context (Priority 2)
3. `AGENT_MEMORY.md` — anti-patterns (Priority 3)

**Writes:**
- Code files (per execution boundary in context pack)
- `EXECUTION_LOGS.md` — execution notes

**Hands off to:** QA Hunter

**Context Budget:** Max 4 files

**NEVER reads:**
- `plans/` (not their layer)
- `TIMELINE.md` (historical)
- `AGENT_LOGS.md` (QA territory)
- `WORKFLOW_ENGINE.md` (operational meta)
- `DECISIONS_COMPRESSED.md` (Tech Lead territory)

---

### QA Hunter

**Reads:**
1. `contexts/CTX-{TASK-ID}.md` — inherited context (Priority 1)
2. Code files under review (Priority 1)
3. `AGENT_MEMORY.md` — known anti-patterns (Priority 2)
4. `FEATURE_MAP.md` — feature ownership (Priority 2)
5. `PROJECT_STATE.md` — current state (Priority 3)
6. `AGENTS_PROTOCOL.md` — constitutional rules (Priority 3)

**Writes:**
- `AGENT_LOGS.md` — QA verdict
- `THE_NEXUS_HUB.md` — task state update
- `PROJECT_STATE.md` — state update (on phase completion)
- `AGENT_MEMORY.md` — new patterns/warnings (if discovered)

**Hands off to:** Governance Agent (on phase completion)

**Context Budget:** Max 6 files

**NEVER reads:**
- `plans/` during QA (focus on code review)

---

### Governance Agent (QA Hunter Role Extension)

**Trigger:** After phase closure (all tasks DONE)

**Reads:**
- `WORKFLOW_ENGINE.md` — this file (for protocols)
- `SOURCE_OF_TRUTH.md` — for consistency checks
- All operational files — for health check

**Writes:**
- `SYSTEM_HEALTH.md` — system health dashboard
- `TIMELINE.md` — phase completion entry
- `FEATURE_MAP.md` — new feature entry
- `AGENT_MEMORY.md` — distilled lessons
- `archives/completed_tasks/` — archived context packs
- `archives/phases/` — archived phase documentation

**Governance Checks:**
- FEATURE_MAP outdated?
- PROJECT_STATE inconsistent with TIMELINE?
- TASK missing context pack?
- Duplicate architecture decision detected?
- File size exceeded governance limits?
- Operational/Historical separation violated?

---

### Tech Lead

**Reads:**
- `plans/` — all strategic documents
- `AGENT_LOGS.md` — QA verdicts
- `PROJECT_STATE.md` — current state
- `DECISIONS_COMPRESSED.md` — decision history

**Writes:**
- `plans/supreme_reviews/` — review verdicts
- `plans/decisions/` — new decisions
- `DECISIONS_COMPRESSED.md` — compressed decisions

**Hands off to:** Strategic Planner

**Context Budget:** No limit (review role)

---

## Context Inheritance

```
Strategic Planner creates TASK_CONTEXT_PACK
    ↓
Senior Dev inherits SAME context pack
    + appends execution notes
    ↓
QA Hunter inherits SAME context pack
    + appends QA verdict
    ↓
Context pack archived with full history
```

Each agent ADDS to the context pack. Never starts from scratch.

---

## Execution Boundary

Every TASK_CONTEXT_PACK MUST contain:

```markdown
## EXECUTION BOUNDARY

### Allowed:
- src/services/[specific-service]/*
- src/models/[specific-model].ts

### Forbidden:
- Everything not explicitly listed above
- auth/*
- payments/*
- routes/* (unless specified)
- crons/* (unless specified)
```

If agent needs to modify outside boundary → **STOP** and escalate to Tech Lead.

---

## Phase Closure Protocol

When ALL tasks in a phase reach DONE:

| Step | Action | Responsible |
|---|---|---|
| 1 | Verify all QA passed | QA Hunter |
| 2 | Update FEATURE_MAP.md | Governance Agent |
| 3 | Update PROJECT_STATE.md | QA Hunter |
| 4 | Update TIMELINE.md | Governance Agent |
| 5 | Distill AGENT_MEMORY.md | Governance Agent |
| 6 | Clean THE_NEXUS_HUB.md | Governance Agent |
| 7 | Archive context packs → archives/completed_tasks/ | Governance Agent |
| 8 | Update SYSTEM_HEALTH.md | Governance Agent |
| 9 | Check file sizes vs governance limits | Governance Agent |
| 10 | Create snapshot if milestone → archives/snapshots/ | Governance Agent |

---

## Tranche Closure Protocol

When ALL phases in a tranche are complete:

| Step | Action | Responsible |
|---|---|---|
| 1 | All phase closures done | Governance Agent |
| 2 | Review PROJECT_STATE.md | Tech Lead |
| 3 | Update TIMELINE.md (strategic decisions) | Tech Lead |
| 4 | Create snapshot → archives/snapshots/ | Governance Agent |
| 5 | Compress AGENT_MEMORY if > 300 lines | Governance Agent |

---

## Governance Checklist (Run After Every Phase)

```
[ ] All task states accurate in THE_NEXUS_HUB
[ ] No stale TODO/IN_PROGRESS items
[ ] CONTEXT_PRIORITY rules respected by all agents
[ ] No file exceeded 500 lines
[ ] No duplicate truth (SOURCE_OF_TRUTH check)
[ ] AGENT_MEMORY under 300 lines
[ ] Operational/Historical separation maintained
[ ] All context packs archived
[ ] SYSTEM_HEALTH.md reflects reality
[ ] No orphaned context packs in contexts/
```
