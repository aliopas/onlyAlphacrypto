# SOURCE OF TRUTH MATRIX

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

Every piece of information in this system has ONE authoritative source.
If you find the same information in two places, one of them is stale.

---

## Truth Matrix

| Information | Single Source | Location | Updated By |
|---|---|---|---|
| Architecture Decisions | plans/architecture/ + DECISIONS_COMPRESSED.md | Strategic Layer | Tech Lead |
| Master Plans | plans/phases/ | Strategic Layer | Tech Lead |
| Roadmap | plans/roadmap/ | Strategic Layer | Tech Lead |
| Supreme Reviews | plans/supreme_reviews/ | Strategic Layer | Tech Lead |
| Decision Log | DECISIONS_COMPRESSED.md | Operational Layer | Tech Lead |
| Current Project State | PROJECT_STATE.md | Operational Layer | QA Hunter |
| Active Tasks | THE_NEXUS_HUB.md | Operational Layer | Strategic Planner |
| Task Context | contexts/CTX-*.md | Operational Layer | Strategic Planner |
| Historical QA | AGENT_LOGS.md | Operational Layer | QA Hunter |
| Execution History | EXECUTION_LOGS.md | Operational Layer | Senior Dev |
| Feature Ownership | FEATURE_MAP.md | Operational Layer | Governance Agent |
| Workflow Lifecycle | WORKFLOW_ENGINE.md | Operational Layer | System Architecture |
| Agent Constitutional Rules | AGENTS_PROTOCOL.md | Operational Layer | Tech Lead |
| Distilled Knowledge | AGENT_MEMORY.md | Operational Layer | QA Hunter |
| System Health | SYSTEM_HEALTH.md | Operational Layer | Governance Agent |
| Project Timeline | TIMELINE.md | Operational Layer | Governance Agent |
| Agent Prompts | prompts/agents/*.md | Operational Layer | Tech Lead |
| Shared Coding Rules | prompts/base/*.md | Operational Layer | Tech Lead |
| Recovery Procedures | RECOVERY_PROTOCOL.md | Operational Layer | — |
| Maintenance Schedule | MAINTENANCE_PROTOCOL.md | Operational Layer | Governance Agent |

---

## Precedence Rules (Conflict Resolution)

If conflicting information is found between files:

| Priority | Source | Why |
|---|---|---|
| 1 | plans/ | Strategic > Operational |
| 2 | WORKFLOW_ENGINE.md | Orchestrator > any other operational file |
| 3 | SOURCE_OF_TRUTH.md | Truth matrix > implicit assumption |
| 4 | DECISIONS_COMPRESSED.md | Decisions > patterns |
| 5 | PROJECT_STATE.md | Current > historical |
| 6 | AGENT_MEMORY.md | Patterns > no context |

---

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Example | Why It's Wrong |
|---|---|---|
| Duplicate truth | Same feature listed in PROJECT_STATE + FEATURE_MAP | Which one is correct? |
| Stale reference | PROJECT_STATE says Phase 3 TODO but NEXUS says DONE | Contradiction |
| Cross-layer reading | Senior Dev reading plans/ directly | Context overload |
| History in operational | THE_NEXUS_HUB containing completed task discussions | Noise |
| Missing source | Agent making assumption without checking truth matrix | Hallucination |

---

## Layer Boundaries

### Strategic Layer (plans/)
- **Who reads:** Tech Lead, Strategic Planner
- **Who writes:** Tech Lead
- **Who NEVER reads:** Senior Dev, QA Hunter (during normal operations)

### Operational Layer (agent_gedens/)
- **Who reads:** All agents (per CONTEXT_PRIORITY.md)
- **Who writes:** Per WORKFLOW_ENGINE.md agent table

### Execution Layer (src/)
- **Who reads:** Senior Dev, QA Hunter
- **Who writes:** Senior Dev only
- **Who NEVER reads:** Strategic Planner, Tech Lead (during normal operations)

---

## Conflict Resolution Flow

1. Check SOURCE_OF_TRUTH.md for authoritative source
2. Follow Precedence Rules above
3. If still unclear → escalate to Tech Lead
4. After resolution → update all stale copies
5. Log in SYSTEM_HEALTH.md if systemic issue
