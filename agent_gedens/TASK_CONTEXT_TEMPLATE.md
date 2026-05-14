# Task Context Pack Template

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

## For Strategic Planner

Fill this template for EVERY task you create.
Save as `contexts/CTX-{TASK-ID}.md`.
All detail goes HERE — not in THE_NEXUS_HUB.md.

---

# Context Pack: {TASK-ID}

## Task Reference
- **Task ID:** T-TR{X}-P{Y}-{NNN}
- **Phase:** {phase name}
- **Tranche:** TR{X}
- **Depends On:** {TASK-ID or "None"}
- **Blocks:** {TASK-ID or "None"}

## Objective
{2-3 sentences: what to build and why. Be specific.}

## Building On Top Of
- **Previous Phase:** {name} → built {what} → files: {list}
- **What's needed now:** {specific gap this task fills}

## Available Imports
```
import { db } from '../config/db';
import { X } from '../models/market.model';
// ... ONLY imports the task actually needs
```

## Execution Boundary

### Allowed:
- src/services/{specific}/*
- src/models/{specific}.ts

### Forbidden:
- Everything not explicitly listed above
- auth/*
- routes/* (unless specified)
- crons/* (unless specified)

## Rules
1. {specific constraint from plan}
2. {specific constraint from plan}
3. Zero `any` types
4. No new npm packages
5. Backward compatible
6. All DB queries via Drizzle ORM
7. Migration guarded by migration_flags (if new migration)

## Example Input → Output
```
Input:  {concrete example}
Output: {expected result}
```

## Verification Checklist
- [ ] {specific check 1}
- [ ] {specific check 2}
- [ ] Zero `any` types
- [ ] Within execution boundary
- [ ] tsc --noEmit clean
- [ ] Backward compatible

---

## Execution Notes (Senior Dev fills this)
_Leave empty. Senior Dev appends notes here during implementation._

---

## QA Verdict (QA Hunter fills this)
_Leave empty. QA Hunter appends verdict here during review._
