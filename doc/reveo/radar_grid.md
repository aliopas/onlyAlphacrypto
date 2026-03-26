# Live AI Radar (Radar Grid) Component

## Overview
The `RadarGrid` component displays a grid of recent AI trading signals, sentiment shifts, or alerts. It sits directly beneath the Alpha Focus component on the Home page.

## Logic & Data Flow
- **Data Source:** Fetched via `homeApi.getRadarSignals()` in `page.tsx` and passed down as `signals` (`RadarSignal[]`).
- **Header:** Displays a static text "Scanning 2,482 Assets".
- **Empty State:** Checks `signals.length === 0`.
  - **Message:** `"No signals yet. Engine processing…"`
  - **Reason:** Occurs if the API returns an empty array, meaning the AI hasn't generated any new signals recently, or the database is empty.
- **Populated State:** Iterates through the `signals` array to render signal cards.
  - **Colors & Styling:** Maps the `sentiment` field ('bullish', 'bearish', 'neutral', 'volatile') to specific Text, Background, Border, and Dot colors. If the sentiment is unrecognized, it defaults to 'neutral'.
  - **Card Content:** Shows the coin symbol, sentiment label, signal description (truncated to 3 lines), and timestamp.
  - **Action:** Clicking a card routes the user to `/terminal/[coin]?radarId=[id]`.

## Potential Bugs & Improvements
- **Hardcoded Asset Count:** The text "Scanning 2,482 Assets" is hardcoded in the UI. **Improvement:** Fetch the actual number of supported or monitored assets from the backend to make this dynamic.
- **Unbounded Grid:** `signals.map(...)` renders all items in the array. If the API returns 100 signals, the grid will be extremely long, breaking the layout. **Improvement:** Apply a `.slice(0, 6)` or pagination/max-height overflow to limit the number of visible signals on the Home page.
- **Missing Optional Chaining Risk:** If `signals` is somehow `undefined` (e.g., API failure returning undefined instead of `[]`), `signals.length` and `signals.map` will throw a runtime error crashing the page. **Improvement:** Add fallback `const safeSignals = signals || [];`.
