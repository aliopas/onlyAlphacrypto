# Terminal Wire Component

## Overview
The `TerminalWire` component sits on the left side of the Terminal interface and acts as a feed. It contains two tabs: "Latest Wire" (for general crypto news) and "AI Radar" (for AI trading signals).

## Logic & Data Flow
- **Props:** Receives `news`, `radarSignals`, `targetedCoin`, `activeTab`, and callback functions to update selection states (`onSelectNews`, `onSelectRadar`, `setActiveTab`).
- **Data Filtering & Sorting:**
  - Checks if a `targetedCoin` exists and filters both lists to match exactly that coin.
  - Sorts both lists in descending order (newest first) comparing JS Date values generated from `createdAt` or `publishedAt`.
- **Empty State:**
  - Checked via `displayList.length === 0`.
  - **Message:** `"No [news/radar signals] found for [coin/this selection]."`
- **Display formatting:**
  - Shows how long ago the event occurred (e.g., `5m ago`, `2h ago`) using a `Date.now()` baseline established in a `useEffect`.

## Potential Bugs & Improvements
- **Missing API Re-fetch:** Currently, the feed maps over data passed initially from the server. It does not seem to have a polling mechanism or WebSocket connection inside this component to fetch new elements as they arrive (like a real live terminal). **Improvement:** Implement periodic polling or WebSockets to append new incoming signals in real-time.
- **Time Calculation Bug Risk:** The component relies on `Date.now()` captured once on mount. If the user leaves the tab open for 5 hours, the relative times (`5m ago`) will not update and will remain static. **Improvement:** Create an interval that updates `now` every minute so the relative times progressively tick upward.
