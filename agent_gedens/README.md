# Agent Gedens — OnlyAlpha Operational Hub

The operational center for the OnlyAlpha multi-agent system.

---

## Architecture

```
plans/          ← Strategic Layer (thinking, vision, roadmaps)
agent_gedens/   ← Operational Layer (execution, tracking, coordination)
src/            ← Execution Layer (the actual code)
```

## Quick Start for Any Agent

1. Read THIS file (README.md) — understand the structure
2. Read CONTEXT_PRIORITY.md — know YOUR reading order
3. Follow WORKFLOW_ENGINE.md — for all workflows and protocols
4. Check SOURCE_OF_TRUTH.md — if unsure where information lives

## Core Files (Start Here)

| File | Purpose | Why It Matters |
|---|---|---|
| WORKFLOW_ENGINE.md | Task lifecycle, agent orchestration, freeze rules | THE runtime of the system |
| SOURCE_OF_TRUTH.md | Who owns what information | Prevents duplicate/conflicting truth |
| CONTEXT_PRIORITY.md | Reading order per agent + hard denials | Prevents context dilution |

## Operational Files

| File | Purpose | Updated By | Lifecycle |
|---|---|---|---|
| PROJECT_STATE.md | Current project state | QA Hunter | Always live |
| THE_NEXUS_HUB.md | Active task queue | Strategic Planner | Cleaned per phase |
| AGENT_LOGS.md | QA review history | QA Hunter | Historical |
| EXECUTION_LOGS.md | Execution session logs | Senior Dev | Historical |
| AGENT_MEMORY.md | Distilled patterns + warnings | QA Hunter | Compressed quarterly |
| DECISIONS_COMPRESSED.md | Architecture decisions | Tech Lead | Appended only |
| FEATURE_MAP.md | Feature ownership + deps | Governance Agent | Updated per phase |
| TIMELINE.md | Project journey archive | Governance Agent | Permanent archive |
| SYSTEM_HEALTH.md | System health dashboard | Governance Agent | Always live |
| RECOVERY_PROTOCOL.md | Disaster recovery | — | Reference only |
| MAINTENANCE_PROTOCOL.md | Who updates what when | — | Reference only |
| AGENTS_PROTOCOL.md | 10 constitutional laws | Tech Lead | Rarely changes |

## Templates

| File | Purpose |
|---|---|
| TASK_CONTEXT_TEMPLATE.md | Template for creating task context packs |
| contexts/ | Individual task context packs (CTX-*.md) |

## Agent Prompts

| Location | Purpose |
|---|---|
| prompts/base/ | Shared rules (coding, architecture, communication) |
| prompts/agents/strategic_planner.md | Strategic Planner system prompt |
| prompts/agents/senior_dev.md | Senior Developer system prompt |
| prompts/agents/qa_hunter.md | QA Hunter system prompt |
| prompts/agents/governance_agent.md | Governance Agent system prompt |
| prompts/agents/tech_lead.md | Tech Lead system prompt |

## Archives

| Directory | Contents |
|---|---|
| archives/phases/ | Completed phase documentation |
| archives/completed_tasks/ | Archived task context packs |
| archives/deprecated/ | Superseded documents |
| archives/snapshots/ | System milestone snapshots |

## Naming Convention

| Entity | Format | Example |
|---|---|---|
| Tasks | T-TR{X}-P{Y}-{NNN} | T-TR2-P4-017 |
| Decisions | DEC-{NNN} | DEC-014 |
| Features | FEAT-{NAME} | FEAT-MARKET-REGIME |
| Context Packs | CTX-{TASK-ID} | CTX-T-TR2-P4-017 |
| Snapshots | SNAP-{PERIOD}-{NN} | SNAP-Q2-2026-01 |

## File Size Governance

- Soft limit: 300 lines
- Hard limit: 500 lines
- If exceeded: split, archive, or compress
