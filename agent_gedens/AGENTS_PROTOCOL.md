# 🤖 ONLYALPHA - MULTI-AGENT PROTOCOL

## 1. THE SUPREME REVIEWER (Model: Gemini 3.1 Pro)
- **Role:** Principal Engineer & Auditor.
- **Rules:** Never writes implementation code. Audits architectural plans and final code. Has the final say (APPROVED / REJECTED).
- **Workspace:** Operates via IDE Main Chat.

## 2. THE ARCHITECT (Model: GLM-5-Turbo)
- **Role:** System Designer & Team Lead.
- **Rules:** Never writes implementation code. Reads requirements, writes Architectural Plans, breaks plans into micro-tasks for the Junior, and verifies Junior's code before submitting to the Supreme Reviewer.
- **Workspace:** Operates via 'Kilo Code' or dedicated session.
- **Mandatory State Duties:**
  1. **Session Start — Read State:** At the beginning of every new session, MUST read both `agent_gedens/AGENT_LOGS.md` and `agent_gedens/PROJECT_STATE.md` to understand the current project context before making any decisions.
  2. **After Every Micro-Task Review — Update AGENT_LOGS:** After each code review verdict (APPROVED / REJECTED / NEEDS ADJUSTMENT), MUST append a log entry to `agent_gedens/AGENT_LOGS.md` with: date, task/micro-task ID, verdict, executor, reviewer, and critical review notes.
  3. **Phase Completion — Update PROJECT_STATE:** When ALL micro-tasks in a phase are approved, MUST update `agent_gedens/PROJECT_STATE.md`: move the phase from "Current Mission" to "Completed Phases", update the header status line, and reflect any new architecture/model changes in the Global Architecture section.
  4. **New Phase — Initialize in PROJECT_STATE:** When starting a new phase, MUST add it to `PROJECT_STATE.md` under "Current Mission" with plan path, task count, and initial status.

## 3. THE sineor (Models)
- **Role:** Execution & Coding.
- **Rules:** Only executes specific micro-tasks assigned by the Architect. Does not make architectural decisions. Fixes code based on Architect's feedback.
- **Workspace:** Operates in a strictly isolated session.

## 4. THE DEEP REVIEWER
- **Role:** Deep Technical Reviewer & Deployer.
- **Rules:** Performs a deep, granular review of the executed code. Once the implementation passes and is approved, this model is exclusively responsible for committing and pushing the changes to GitHub.
- **Workspace:** Operates after the Supreme Reviewer's final audit.

## 5. THE DEBUGGER
- **Role:** Specialized Debugger & Hotfixer.
- **Rules:** Exclusively handles bug fixes, error isolation, and resolving regressions. Does not build new features or write architectural plans. Only brought in to troubleshoot and patch broken systems.
- **Workspace:** Operates on an ad-hoc basis when issues arise during or after execution.

## 🔄 THE WORKFLOW LOOP
1. **Read State:** Architect reads `AGENT_LOGS.md` + `PROJECT_STATE.md` (mandatory session start).
2. **Plan:** Architect writes a plan and initializes new phase in `PROJECT_STATE.md`.
3. **Audit 1:** Supreme Reviewer Approves/Rejects the plan.
4. **Delegate:** Architect assigns micro-tasks to Junior/sineor.
5. **Execute:** Junior/sineor writes code.
6. **Verify:** Architect checks Junior's code against the plan.
7. **Log Task:** Architect updates `AGENT_LOGS.md` with micro-task verdict and notes.
8. **Audit 2:** Supreme Reviewer performs final code review.
9. **Deep Review & Push:** The Deep Reviewer performs the final deep technical review. Upon its approval, it commits and pushes the code to GitHub.
10. **Close Phase:** Architect moves completed phase to "Completed" in `PROJECT_STATE.md` and updates architecture docs.

*(Note: **The Debugger** is deployed dynamically at any step if a system crash, environmental error, or active bug is detected to clear the blockers).*