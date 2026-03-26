# Market Mood Gauge Component

## Overview
The `MarketMoodGauge` component visualizes the current overall sentiment of the crypto market on a scale of 0 to 100, mapping from Extreme Fear to Extreme Greed.

## Logic & Data Flow
- **Data Source:** Fetched via `homeApi.getMarketMood()` and passed as the `mood` prop (`MarketMood | null`).
- **Data Handling:** 
  - Extracts `score` (defaults to `50` if null) and `label` (defaults to `'Neutral'` if null).
  - No explicit "Error" text is shown if data fails. Instead, it gracefully defaults to a neutral state (50 / Neutral).
- **Gauge Physics:**
  - The rotation of the gauge is calculated using a mathematical mapping: `-45 + (score / 100) * 135`.
  - A score of `0` results in `-45deg` (pointing far left).
  - A score of `100` results in `+90deg` (pointing far right).
- **Color Coding:**
  - `score >= 60`: Emerald (Green / Greed)
  - `score <= 40`: Red (Fear)
  - Between 41 and 59: Yellow (Neutral)

## Potential Bugs & Improvements
- **Missing Data Warning:** Currently, if the API fails, it quietly defaults to 50/Neutral. **Improvement:** It might be better to show an explicit "Data Unavailable" or "Syncing..." state so the user doesn't assume the market is perfectly neutral when the API is actually down.
- **Gauge Rotation Range Logic:** The math spans from `-45` to `+90`, which is a total arc of `135` degrees. Standard semi-circle gauges usually span `180` degrees (e.g., `-90` to `+90`). If the underlying CSS (`gauge-fill`) is built for a 135-degree sweep, this is correct; but if it expects 180 degrees, the needle might look slightly misaligned at 0 or 100.
