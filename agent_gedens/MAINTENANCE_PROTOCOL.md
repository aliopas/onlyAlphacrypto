# MAINTENANCE PROTOCOL

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

---

## Responsibility Matrix

### After Every Task (QA Hunter)
- Update AGENT_LOGS.md (QA verdict)
- Update THE_NEXUS_HUB.md (task state → DONE or BLOCKED)

### After Every Phase (Governance Agent / QA Hunter)
- Update TIMELINE.md (phase completion entry)
- Update FEATURE_MAP.md (new feature entry)
- Distill AGENT_MEMORY.md (new patterns + lessons)
- Clean THE_NEXUS_HUB.md (remove completed tasks)
- Archive context packs → archives/completed_tasks/
- Update SYSTEM_HEALTH.md
- Verify file sizes under governance limits

### After Every Tranche (Tech Lead)
- Review PROJECT_STATE.md
- Update TIMELINE.md (strategic decisions)
- Create snapshot → archives/snapshots/SNAP-{PERIOD}-{NN}.md

### Quarterly (Governance Agent)
- Compress AGENT_MEMORY.md (distill to fresh 300-line max)
- Archive old AGENT_LOGS entries
- Review and clean deprecated docs in archives/deprecated/

---

## Archival Rules

### When to Archive
- Task status = DONE for > 7 days
- Phase fully complete and QA passed
- Context pack no longer needed for active work

### Archive Targets
| Source | Destination | Naming |
|---|---|---|
| contexts/CTX-*.md (completed) | archives/completed_tasks/ | Same filename |
| Phase documentation | archives/phases/ | phase-{name}-{date}.md |
| Superseded docs | archives/deprecated/ | {original-name}.md |
| Milestone freeze | archives/snapshots/ | SNAP-{PERIOD}-{NN}.md |

---

## File Size Enforcement

| Threshold | Action |
|---|---|
| 300 lines (soft) | Governance Agent logs warning in SYSTEM_HEALTH.md |
| 500 lines (hard) | Governance Agent MUST compress or archive before next phase |

### Compression Strategies
- AGENT_LOGS: Keep last 2 tranches, archive older entries
- TIMELINE: Keep current year, archive older
- FEATURE_MAP: Keep active features only, archive deprecated
- AGENT_MEMORY: Distill to fresh patterns (max 300 lines)
- PROJECT_STATE: Remove completed phase details, keep summary only

---

## Cleanup Checklist (Governance Agent runs after every phase)

```
[ ] No stale TODO/IN_PROGRESS items in THE_NEXUS_HUB
[ ] No orphaned context packs in contexts/
[ ] No files over 500 lines
[ ] No duplicate information across files
[ ] Archives properly organized
[ ] SYSTEM_HEALTH.md reflects reality
[ ] AGENT_MEMORY.md under 300 lines
[ ] Operational/Historical separation maintained
```
