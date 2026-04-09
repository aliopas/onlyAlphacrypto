# OnlyAlpha System Audit & Improvements Log

## 🔴 [HIGH] AI Chat System Failures
**Status:** Confirmed - Not Linked & Non-Functional
**Locations:** 
- `frontend/src/features/terminal/hooks/useTerminalChat.ts`
- `backend/src/controllers/chat.controller.ts`

### Root Causes:
1. **Mode/Type Mismatch:** The Frontend sends `mode: 'context'`, but the Backend controller (Line 36) expects `resolvedMode === 'private'`. This prevents the "Context AI" logic from ever running, defaulting everyone to "General Mode".
2. **Stream Parsing Bug:** The Frontend (Lines 110-114) appends the raw JSON string chunks to the message buffer instead of parsing them. This results in the user seeing raw JSON objects like `{"content":"Hello"}` in the chat bubbles instead of plain text.
3. **URL Routing Mismatch:** The Backend expects a URL containing `/context` to force private mode, but the Frontend always hits the base `/chat/stream` endpoint.
4. **General Mode Isolation:** The "General AI" branch in the controller completely ignores `articleId`, making it unable to answer even simple questions about the currently viewed article unless in Context mode.

---

## 🟡 [MEDIUM] Terminal Page - Article Selection & Duplication
**Status:** Confirmed - Visual & Logic Bugs
**Locations:** 
- `frontend/src/features/terminal/components/TerminalWire.tsx`
- `frontend/src/features/terminal/components/TerminalPageClient.tsx`
- `backend/src/crons/aiWorkflow.cron.ts`

### Root Causes:
1. **Non-Unique Selection Logic:** The `isSelected` highlight relies solely on `id`. If multiple items in the list have the same ID (due to pagination or data bugs), they all light up as "Active".
2. **Pagination Duplicates:** The "Show More" logic in `TerminalPageClient` blindly appends data without deduplicating via ID.
3. **Cron Job Redundancy:** The `backfillRadarSignals` cron can create a second Radar entry for a news article that was already processed by the main workflow, leading to identical-looking items in the UI.
4. **Wire Feed Stagnation:** The `WIRE` tab lacks pagination support (No "Load More"), limiting users to only the latest 20 updates.

---

## ⚪ [LOW] Contextual Mismatches
1. **Radar Sources Limitation:** The "Sources Analyzed" list only searches the latest 20 articles. If a Radar signal is old, its sources won't show up.
