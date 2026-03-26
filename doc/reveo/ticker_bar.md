# Ticker Bar Component

## Overview
The `TickerBar` is a globally persistent component (part of the main layout) that displays a continuous scrolling marquee of top moving crypto assets at the very top of the screen.

## Logic & Data Flow
- **Data Source:** It is a client-side component that fetches data on mount (`useEffect`) via `homeApi.getTopMovers()`. The data is stored in a local `useState` called `movers`.
- **Scrolling Implementation:** 
  - To achieve a seamless infinite scroll, it renders two identical instances of the `<TickerItems />` component side by side inside a container with an `animate-marquee` CSS class.
- **Empty State:**
  - Checked via `!movers.length`.
  - **Message:** Shows `"LIVE"` alongside `"SCANNING MARKETS..."`.
  - **Reason:** This state is visible during the initial page load (before `useEffect` resolves) or if the API returns an empty array.
- **Populated State:**
  - Maps through the `movers` array.
  - Removes `"USDT"` from the symbol (e.g., `BTCUSDT` -> `BTC`).
  - Displays the formatted price (up to 4 decimal places if under $1, otherwise 2 decimal places).
  - Displays the 24h percentage change (colored green for positive, red for negative).

## Potential Bugs & Improvements
- **Missing Error Handling:** The `homeApi.getTopMovers().then(setMovers)` block has no `.catch()` handler. If the API request fails, the application doesn't crash, but the ticker remains stuck permanently on "SCANNING MARKETS...". **Improvement:** Implement an error state or a retry mechanism to show "RATE LIMITED" or "LIVE DATA PAUSED" if it hits an error.
- **Client-Side vs Server-Side Tradeoffs:** While other components on the Home page (like `TopMovers`) likely receive their data server-side via Server Components, `TickerBar` fetches the exact same data again from the client side. **Improvement:** Pass the initial `movers` data down as a prop or through a React Context provider from the layout to avoid duplicate API calls on page-load.
