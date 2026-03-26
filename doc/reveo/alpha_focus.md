# Alpha Focus Component

## Overview
The `AlphaFocusCard` component is the primary feature on the Home page, taking up the most prominent space (top-left). It displays the highest conviction trade or analysis identified by the AI system for the current day.

## Logic & Data Flow
- **Data Source:** Fetched via `homeApi.getAlphaFocus()` on the server side (`page.tsx`) and passed down as the `data` prop (`AlphaFocus | null`).
- **Empty State:** If `data` is null or undefined, the component immediately returns an error/empty state:
  - **Message:** `"No Alpha Focus data available."`
  - **Reason:** This happens if the backend API fails to return the Alpha Focus item, or if the database currently has no active "Alpha Focus" selected.
- **Populated State:** When data is available, it displays:
  - **Header:** Coin symbol (e.g., `$BTC`), AI Verdict (e.g., `BULLISH`), and Confidence score (%).
  - **Price Info:** Current price and 24-hour price change percent (colored green for positive, red for negative).
  - **Visuals:** A "Spark chart" labeled "24H High-Density Execution Path".
  - **Summary:** An 'Executive Summary' text block explaining the rationale.
  - **Action:** A "EXPLORE FULL ON-CHAIN ANALYSIS" link routing to `/terminal/[coin]?alpha=true`.

## Potential Bugs & Improvements
- **Static Chart:** Currently, the sparkline chart is a hardcoded SVG (`<path d="..." />`). **Improvement:** Connect this to a real price-history API (like Binance or a custom endpoint) to render an accurate 24H SVG sparkline.
- **Summary Overflow:** The executive summary uses `line-clamp-5`. If the text is very long, it cuts off gracefully, but it might be useful to add a "Read More" expansion or rely entirely on the terminal link for full details.
- **Price Formatting:** It uses `.toLocaleString()` for price, which might drop important decimal places for micro-cap tokens (e.g., a token worth $0.0000045 might show as $0 or $0.00). **Improvement:** Implement dynamic precision based on the price magnitude.
