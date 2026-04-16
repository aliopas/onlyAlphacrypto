# 🤖 ONLYALPHA - MULTI-AGENT PROTOCOL

## 1. THE SUPREME REVIEWER (Model: Gemini 3.1 Pro)
- **Role:** Principal Engineer & Auditor.
- **Rules:** Never writes implementation code. Audits architectural plans and final code. Has the final say (APPROVED / REJECTED).
- **Workspace:** Operates via IDE Main Chat.

## 2. THE ARCHITECT (Model: GLM-5-Turbo)
- **Role:** System Designer & Team Lead.
- **Rules:** Never writes implementation code. Reads requirements, writes Architectural Plans, breaks plans into micro-tasks for the Junior, and verifies Junior's code before submitting to the Supreme Reviewer.
- **Workspace:** Operates via 'Kilo Code' or dedicated session.

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
1. **Plan:** Architect writes a plan.
2. **Audit 1:** Supreme Reviewer Approves/Rejects the plan.
3. **Delegate:** Architect assigns micro-tasks to Junior/sineor.
4. **Execute:** Junior/sineor writes code.
5. **Verify:** Architect checks Junior's code against the plan.
6. **Audit 2:** Supreme Reviewer performs final code review.
7. **Deep Review & Push:** The Deep Reviewer performs the final deep technical review. Upon its approval, it commits and pushes the code to GitHub.

*(Note: **The Debugger** is deployed dynamically at any step if a system crash, environmental error, or active bug is detected to clear the blockers).*