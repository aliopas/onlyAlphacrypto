# RECOVERY PROTOCOL — Disaster Recovery

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

---

## When to Use

- Conflicting states detected between files
- Agent produced corrupted output
- Context rot discovered
- System health check failed
- Agent went outside execution boundary

---

## Recovery Levels

### Level 1: Auto-Recoverable (Governance Agent fixes)

| Issue | Recovery Action |
|---|---|
| Stale task states | Reconcile with AGENT_LOGS.md latest verdict |
| Minor inconsistency | Fix via WORKFLOW_ENGINE.md rules |
| File slightly over size limit | Archive oldest section |
| Missing context pack | Check archives/completed_tasks/ |

### Level 2: Manual Intervention (Tech Lead required)

| Issue | Recovery Action |
|---|---|
| PROJECT_STATE vs TIMELINE conflict | Tech Lead reconciles using SOURCE_OF_TRUTH precedence |
| Broken execution boundary | Tech Lead redefines boundary in context pack |
| Corrupted AGENT_MEMORY | QA Hunter re-distills from AGENT_LOGS.md |
| Agent workflow violation | Tech Lead reviews and corrects |

### Level 3: Full Reset

| Issue | Recovery Action |
|---|---|
| Multiple systemic failures | Rollback to latest snapshot in archives/snapshots/ |
| Catastrophic context rot | Rebuild from plans/ (Strategic Layer is untouched) |

---

## Precedence Rules (For Conflict Resolution)

| Priority | Source | Why |
|---|---|---|
| 1 | plans/ | Strategic > Operational |
| 2 | WORKFLOW_ENGINE.md | Orchestrator > any operational file |
| 3 | SOURCE_OF_TRUTH.md | Truth matrix > assumption |
| 4 | DECISIONS_COMPRESSED.md | Decisions > patterns |
| 5 | PROJECT_STATE.md | Current > historical |
| 6 | AGENT_MEMORY.md | Patterns > nothing |

---

## Specific Recovery Scenarios

### If conflicting task states:
1. Check SOURCE_OF_TRUTH.md for authoritative source
2. Cross-reference AGENT_LOGS.md for latest QA verdict
3. Reconcile THE_NEXUS_HUB.md
4. Update SYSTEM_HEALTH.md

### If context pack missing:
1. Check archives/completed_tasks/ (may have been archived)
2. Reconstruct from THE_NEXUS_HUB.md task entry
3. If impossible → escalate to Strategic Planner to recreate

### If agent went outside execution boundary:
1. STOP — do not continue
2. Log in AGENT_LOGS.md
3. Escalate to Tech Lead
4. Revert code changes
5. Redefine execution boundary in context pack

### If file exceeds governance limits:
1. Archive oldest section to archives/
2. Compress remaining content
3. Verify under 500 lines
4. Update SYSTEM_HEALTH.md

### If AGENT_MEMORY becomes stale:
1. QA Hunter re-reads AGENT_LOGS.md
2. Extracts patterns from last quarter
3. Rewrites AGENT_MEMORY.md (max 300 lines)
4. Old version archived to archives/deprecated/

### If duplicate truth detected:
1. Check SOURCE_OF_TRUTH.md for authoritative source
2. Delete or archive the non-authoritative copy
3. Verify all references point to correct source
4. Log in SYSTEM_HEALTH.md
