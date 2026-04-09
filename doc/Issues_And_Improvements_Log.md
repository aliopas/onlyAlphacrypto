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

## 🟠 [MEDIUM] AI Model Provider Lock-in
**Status:** Architecture Limitation
**Locations:** 
- `backend/src/services/openai.service.ts`
- `backend/src/config/env.ts`

### Root Causes:
1. **Single Gateway Bottleneck:** The current architecture uses a single `AIGateway` instance (Line 106 in `openai.service.ts`) hardcoded to OpenRouter's baseURL. This makes it impossible to use DeepSeek direct while keeping other models (like GPT-5-nano) on OpenRouter unless they are separated into two different gateway instances.
2. **Missing Environment Variables:** The `env.ts` schema only expects `OPENROUTER_API_KEY`. Migrating to DeepSeek direct requires adding `DEEPSEEK_API_KEY` and updating the `baseURL` for that specific model branch.
3. **Model String Dependencies:** The `DEEPSEEK_MODEL` currently defaults to `deepseek/deepseek-r1` (OpenRouter naming convention). Direct API would require using DeepSeek's own model names (e.g., `deepseek-reasoner` or `deepseek-chat`).

## 🔴 [HIGH] Scanning Assets Counter Discrepancy (shows 0)
**Status:** Confirmed - Data Source Mismatch
**Locations:** 
- `backend/src/controllers/market.controller.ts` (Line 135)
- `frontend/src/features/home/components/RadarGrid.tsx`

### Root Causes:
1. **Source Table Mismatch:** The "Scanning X Assets" label in the `RadarGrid` component fetches its value from the `/market/asset-count` endpoint. However, this endpoint (Lines 135-137 in the controller) performs a `COUNT(DISTINCT coinSymbol)` on the `market_insights` table. Since the Radar signals come from a different table (`radar_signals`), the counter remains 0 if no AI Insights have been generated yet, even if many signals are live.
2. **Aggressive Caching:** The asset count is cached for 300 seconds (5 minutes). If the initial scan results in 0, the UI will stubbornly show 0 for a long duration even after the background crons start populating the database.
3. **Misleading Metric:** The "Scanning Assets" metric should ideally reflect the total range of tokens being monitored by the `raw_news_buffer` or `radar_signals`, not just those that reached the final "Insight" stage.

## 🔵 [NEW] Institutional Branding & UI Refactor Plan
**Status:** Planned - Awaiting Implementation
**Concept:** Shift from "Generic AI" to "Proprietary Alpha Engine" (Institutional/Quant Standard).

### 1. Terminology Mapping (Global Search & Replace)
| Current Term | New Institutional Term | Locations |
| :--- | :--- | :--- |
| AI Radar / AI Radar Stream | **Alpha Detection Stream** | `TerminalWire.tsx`, `TerminalPageClient.tsx` |
| AI Radar Detection Event | **Verified Alpha Catalyst** | `AlphaStream.tsx`, `TerminalWire.tsx` |
| DeepSeek Analysis | **Neural Consensus Verdict** | `AlphaStream.tsx`, Component Logic |
| HOOK | **Core Catalyst** | `AlphaStream.tsx` (Label), `aiWorkflow.cron.ts` |
| WHAT HAPPENED | **Market Context** | Content Body Structure |
| WHY IT MATTERS | **Strategic Impact** | Content Body Structure |
| General AI | **Macro Intelligence** | `TerminalChat.tsx`, `useTerminalChat.ts` |
| Context AI | **Asset Context** | `TerminalChat.tsx`, `useTerminalChat.ts` |
| NETWORK SECURE | **Data Integrity: Verified** | `AlphaStream.tsx` (Footer) |
| Starting Terminal... | **Alpha Engine Synchronized** | `useTerminalChat.ts` (Initial Msg) |

### 2. Layout Restructure: Neural Consensus Verdict (`AlphaStream.tsx`)
**Structure:** Top-Down Value Flow
1. **Header:** Title + Meta (Date/Coin) + Sentiment Badge.
2. **Executive Summary:** High-visibility block immediately under title. Tinted background (Green/Red/Amber) based on sentiment.
3. **Intelligence Synthesis:**
   - `Core Catalyst`: The "Hook" styled as a lead paragraph.
   - `Market Context`: Standard content body.
   - `Strategic Impact`: Highlighted points or conclusion.
4. **Data Streams (Sources):** Relocated to the absolute bottom in a collapsed or low-priority styled list.

---

## ⚪ [LOW] Contextual Mismatches
1. **Radar Sources Limitation:** The "Sources Analyzed" list only searches the latest 20 articles. If a Radar signal is old, its sources won't show up.
