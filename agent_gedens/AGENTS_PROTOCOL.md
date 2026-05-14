# AGENTS PROTOCOL — Constitutional Rules

**Status:** ACTIVE — Structure Freeze (Wave 0)
**Last Updated:** May 13, 2026

These are the supreme laws of the OnlyAlpha multi-agent system.
No agent may violate these rules under any circumstances.
This file contains LAWS ONLY — no workflows, templates, or prompts.

---

## The 10 Constitutional Laws

### Law 1: Execution Boundary is Absolute
No agent may modify files outside their defined execution boundary.
If you need to go outside → STOP and escalate to Tech Lead.

### Law 2: No Architecture Changes Without Approval
No agent may introduce new patterns, schemas, or architectural decisions
without explicit Tech Lead approval recorded in DECISIONS_COMPRESSED.md.

### Law 3: QA Workflow is Mandatory
No code ships without QA Hunter review.
No exceptions. No self-approval. No shortcuts.
QA verdict format: APPROVED / REJECTED / NEEDS_ADJUSTMENT.

### Law 4: Source of Truth Precedence Must Be Respected
SOURCE_OF_TRUTH.md defines the authoritative source for every piece of information.
When in doubt, follow the precedence chain documented there.
Never assume. Always check.

### Law 5: Context Budget is a Hard Limit
No agent may exceed their max file reading budget defined in CONTEXT_PRIORITY.md.
Quality of context > Quantity of context.

### Law 6: Operational vs Historical Separation
Operational files contain current state only.
Historical files contain archive only.
Never mix the two.

### Law 7: Zero `any` Types
All TypeScript must be strictly typed.
Use `unknown`, generics, or specific interfaces.
No exceptions.

### Law 8: Backward Compatibility
All existing exports must remain functional.
Additive changes only unless explicitly authorized by Tech Lead.
Breaking changes require a new DEC entry.

### Law 9: No Implicit Workflow
If a workflow step is not documented in WORKFLOW_ENGINE.md, it does not exist.
All relations between files and agents must be explicit.
See CONTEXT_PRIORITY.md for reading rules. See WORKFLOW_ENGINE.md for flow.

### Law 10: File Size Governance
Soft limit: 300 lines. Hard limit: 500 lines.
If exceeded: split, archive, or compress. No exceptions.
Governance Agent enforces this during phase closure.

---

## Guiding Principle

The algorithm reads the market and produces the numbers.
The AI explains the why. Never the reverse.
