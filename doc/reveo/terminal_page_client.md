# Terminal Page Client (Controller)

## Overview
The `TerminalPageClient` component serves as the main state controller for the Terminal interface. It orchestrates the communication between the three main panes: the Left feed (`TerminalWire`), the Center analysis (`AlphaStream`), and the Right sidِِebar (`TerminalChat`).

## Logic & Data Flow
- **Props:** Receives `initialNews`, `coin`, `radarSignals`, `initialRadarId`, and `isAlphaFocus` from the server-side page wrappers (`page.tsx` or `[coin]/page.tsx`).
- **State Management:**
  - `activeTab`: Tracks whether the Wire or Radar tab is currently active. Defaults to 'RADAR' if `initialRadarId` or `isAlphaFocus` is provided, otherwise 'WIRE'.
  - `selectedNewsId`: Tracks the ID of the currently selected news article.
  - `selectedRadarId`: Tracks the ID of the currently selected radar signal. Defaults to `initialRadarId` or the latest radar signal for the targeted coin.
- **Computed Values:**
  - Retrieves the `activeArticle` or `activeRadar` based on the selected IDs.
  - Determines the `selectedCoin` based on the active item or falls back to 'SOL'.
- **Layout:**
  - Renders a flex layout passing the respective slices of state down to `TerminalWire`, `AlphaStream`, and `TerminalChat`.

## Potential Bugs & Improvements
- **Default Coin Fallback:** If no coin is specified or actively selected, the `selectedCoin` hard-defaults to `'SOL'`. **Improvement:** This fallback should ideally be dynamically fetched from the "Alpha Focus" or a global default settings endpoint.
- **Responsive Layout:** The layout uses `xl:flex-row` expecting a wide screen. On smaller screens, it stacks the panes vertically. **Improvement:** The right pane (`TerminalChat`) might be better placed in an off-canvas drawer on mobile to prevent massive vertical scrolling.
