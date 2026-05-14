# CONTEXT PRIORITY — Reading Order Per Agent

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

This file tells every agent EXACTLY what to read and what NOT to read.
Violating these rules causes context dilution and weak model confusion.

---

## Strategic Planner

### MUST Read (Priority 1):
- plans/phases/* (active plan)
- PROJECT_STATE.md

### SHOULD Read (Priority 2):
- FEATURE_MAP.md
- AGENT_MEMORY.md
- DECISIONS_COMPRESSED.md

### Max Files: 5

### DO NOT:
- Read AGENT_LOGS.md
- Read TIMELINE.md
- Read code files
- Read contexts/ (you create them, you don't read them back)

---

## Senior Developer

### MUST Read (Priority 1):
- contexts/CTX-{TASK-ID}.md (your task context pack)

### SHOULD Read (Priority 2):
- FEATURE_MAP.md (if task involves existing features)
- AGENT_MEMORY.md (anti-patterns to avoid)

### MAY Read (Priority 3):
- PROJECT_STATE.md (only if context gap detected)

### Max Files: 4

### DO NOT (Hard Denials):
- **plans/** — NOT your layer. All info you need is in the context pack.
- **TIMELINE.md** — Historical. Zero relevance to execution.
- **AGENT_LOGS.md** — QA territory. Reading it biases your implementation.
- **WORKFLOW_ENGINE.md** — Operational meta. Not for execution agents.
- **DECISIONS_COMPRESSED.md** — Tech Lead territory.
- **SOURCE_OF_TRUTH.md** — Meta file. Not needed for coding.
- **SYSTEM_HEALTH.md** — Governance file. Not relevant to you.

---

## QA Hunter

### MUST Read (Priority 1):
- contexts/CTX-{TASK-ID}.md (inherited from Senior Dev)
- Code files under review

### SHOULD Read (Priority 2):
- AGENT_MEMORY.md (known anti-patterns)
- FEATURE_MAP.md (feature ownership)

### MAY Read (Priority 3):
- PROJECT_STATE.md (for phase completion checks)
- AGENTS_PROTOCOL.md (for constitutional rules)

### Max Files: 6

### DO NOT (Hard Denials):
- **plans/** — During QA, focus on code review only. Plans add noise.
- **TIMELINE.md** — Historical. Not relevant to code review.
- **WORKFLOW_ENGINE.md** — You know the workflow. Don't re-read it during QA.

---

## Governance Agent (QA Hunter Extension)

### MUST Read:
- WORKFLOW_ENGINE.md (protocols to enforce)
- SOURCE_OF_TRUTH.md (truth matrix to check against)

### SHOULD Read:
- All operational files (for health check)

### Max Files: No limit (runs infrequently, full scan)

### DO NOT:
- Read plans/ (not evaluating strategy, evaluating system health)

---

## Tech Lead

### MUST Read:
- plans/ (all subdirectories)

### SHOULD Read:
- AGENT_LOGS.md (recent QA verdicts)
- PROJECT_STATE.md
- DECISIONS_COMPRESSED.md

### Max Files: No limit (review role, needs full context)

---

## Universal Rules

1. **Never read a file outside your priority list** unless explicitly asked by the user
2. **If unsure what to read** → read THIS file (CONTEXT_PRIORITY.md) first
3. **Priority 1 files** are non-negotiable — always read them before starting
4. **Priority 3 files** are optional — read ONLY if you detect a context gap
5. **Context budget is a HARD limit** — do not exceed your max files
6. **If a file is in your DO NOT list** — there is a reason. Don't rationalize reading it.
