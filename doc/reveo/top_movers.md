# Top Movers Component

## Overview
The `TopMovers` component displays a table of the top performing (or worst performing) crypto assets over the last 24 hours.

## Logic & Data Flow
- **Data Source:** Fetched via `homeApi.getTopMovers()` and passed as `movers` prop (`TopMover[]`).
- **Data Handling:**
  - limits the list to a maximum of 5 items using `movers.slice(0, 5)`.
- **Empty State:**
  - Checked via `displayMovers.length === 0`.
  - **Message:** `"Awaiting API Data..."` displayed in a table cell spanning 3 columns.
- **Formatting:**
  - Strips `"USDT"` from the symbol (e.g., `BTCUSDT` -> `BTC`).
  - Converts strings to floats for `price` and `change`.
  - **Price Formatting Rule:** If `price < 1`, formats to 4 decimal places (`toFixed(4)`). Otherwise, formats to 2 decimal places (`toFixed(2)`).
  - Text color is green for positive change, red for negative.

## Potential Bugs & Improvements
- **Runtime Error Risk:** The component assumes `movers` is an array. If the API errors out and `movers` is `null` or `undefined`, the line `movers.slice(0, 5)` will throw a runtime error and crash the app. **Improvement:** Change it to `(movers || []).slice(0, 5)`.
- **Direction Handling:** It doesn't distinguish between Top Gainers and Top Losers natively unless the API specifically pre-sorts them. Usually, "Top Movers" shows the highest absolute volatility or pure gainers. It might be useful to add a toggle between "Gainers" and "Losers".
