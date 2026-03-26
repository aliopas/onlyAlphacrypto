# Airdrop Watchlist Component

## Overview
The `AirdropWatchlist` component tracks upcoming or active crypto token airdrops, displaying them with risk assessments and estimated Token Generation Event (TGE) dates.

## Logic & Data Flow
- **Data Source:** Fetched via `airdropApi.getProjects()` and passed as `projects` (`AirdropProject[]`).
- **Data Handling:**
  - Displays a maximum of 5 airdrops using `projects.slice(0, 5)`.
- **Empty State:**
  - Checked via `displayProjects.length === 0`.
  - **Message:** `"No active airdrops tracking"`
- **Populated State:**
  - Evaluates `riskVerdict` (defaults to 'SAFE' if null) and maps it to a UI color schema:
    - SAFE: Green
    - MEDIUM_RISK: Yellow
    - HIGH_RISK: Orange
    - SCAM: Red
  - Displays TGE Date if available (`tgeAt`), otherwise falls back to displaying the `network` name.
- **Footer Status:** Displays a dynamic count of total tracked projects: `"Monitoring {projects.length} on-chain projects."`

## Potential Bugs & Improvements
- **Crash Risk on Undefined:** If `projects` is passed as `undefined` or `null` due to API failure, `projects.slice(0, 5)` and `projects.length` will crash the component. **Improvement:** Add fallback `const safeProjects = projects || [];`.
- **Date Formatting Consistency:** Uses `.toLocaleDateString()`, which varies by the user's local timezone and browser settings. This might lead to hydration mismatches between server and client in Next.js, or inconsistent UI for different users. **Improvement:** Use a strict formatter (like `date-fns` or strict UTC rendering) if this proves to be an issue.
