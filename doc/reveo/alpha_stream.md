# Alpha Stream Component

## Overview
The `AlphaStream` component is the central, primary reading pane of the Terminal. It displays the deep analysis or full text of a selected signal or news article.

## Logic & Data Flow
- **Props:** Accepts an optional `newsId` or an optional `radarSignal`.
- **Data Fetching:**
  - Uses a `useEffect` to react to changes to its props.
  - If a `radarSignal` is passed, it uses it instantly (no fetching).
  - If a `newsId` is passed, it sets `loading` to `true` and fetches the full article using `terminalApi.getNewsById(newsId)`.
- **Standby (Empty) State:**
  - Triggered if both `newsId` and `radarSignal` are falsy.
  - **Message:** `"Alpha Stream Standby. Select an event from the timeline to initiate deep analysis."`
- **Loading State:**
  - Triggered while `terminalApi.getNewsById` is fulfilling.
  - **Message:** `"Decoding Signal..."` with a loading spinner.
- **Populated State:**
  - Unifies data fields: Extracts coin, sentiment, date, headline, and body from either the radar signal or the article payload.
  - Formats sentiment colors identically to `RadarGrid` (bullish = green, bearish = red, etc.).
  - Renders a stylized "hacker/cyber" reading environment.

## Potential Bugs & Improvements
- **Missing Loading State Catch:** If the API fails `terminalApi.getNewsById(newsId)`, it logs an error to the console but doesn't set an explicit error state in the UI. The user just sees an empty "No AI summary available..." message or it freezes if `setArticle` isn't handled correctly. **Improvement:** Add an explicit error state rendering `"Connection Error Check API"`.
- **Memory Leak/Race Condition:** If a user clicks three different news items very quickly, three API requests will fire in succession. If they resolve out of order, the `AlphaStream` might display the wrong article. **Improvement:** Implement an `AbortController` or a token in the `useEffect` to ignore the fetch result if the `newsId` has changed while it was loading.
