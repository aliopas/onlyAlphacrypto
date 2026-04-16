# OnlyAlpha - Issues, Fixes, and Developments Tracker

This document tracks all current issues, applied fixes, and planned developments for the OnlyAlpha project. It serves as a unified source of truth to prevent AI models from overriding previous logic or taking incorrect approaches.

## 🔴 Current Issues (Bugs & Architectural Problems)

### 1. Terminal / Article Details View
- **Living Article Concept (Duplication):** For each coin, there should be only *one* "Living Article" that gets updated with new events and developments. Currently, the system repeatedly creates new articles with redundant analysis.
- **Missing Analysis Sections Data:** In the detailed analysis view (accordion), only two sections (e.g., "CORE CATALYST" and "MARKET CONTEXT") actually have content. The rest of the sections (like "STRATEGIC IMPACT", "HISTORICAL PRECEDENT", etc.) appear empty.
- **UI Cleanup - Remove "Sources Analyzed":** In the left sidebar stream cards, the "Sources Analyzed" section has no value and needs to be completely removed.
- **Buggy "Read Deep Dive" Button:** The `READ DEEP DIVE` button hangs or acts buggy. Its correct behavior should simply be to scroll/focus the view directly to where the article's full analysis begins.
- **Erroneous `[HOOK]` Text in Timeline:** In the 'Timeline Updates' view of the article, the generated text sometimes starts with `[HOOK]`. This string is likely an AI prompt leak or template error and needs to be stripped out so it does not appear in the UI.

### 2. Home Page
- **Alpha Focus Price Fetching:** In the "Today's Alpha Focus" component, the real-time asset price and 24H change are failing to fetch or display correctly (currently showing `$0` and `+0.00% (24H)`). It must be wired up to dynamically fetch the correct live price for the highlighted coin.

### 3. Architecture & Data Flow Audit (Cleanps & Conflicts)
- **Dead Code (Reddit):** `reddit.service.ts` and `redditExtractor.ts` exist but are entirely unused in the cron flows. They can be safely deleted to reduce clutter.
- **Unused Dependencies (Neon):** The `@neondatabase/serverless` package exists in `package.json` but is bypassed (the system uses standard `pg` pool). It can be uninstalled if Neon serverless isn't strictly required.
- **Root Cause for Article Duplication:** The terminal stream (`market.controller.ts -> getLatestWire`) fetches from the `coinNews` table. However, `aiWorkflow.cron.ts` forces an insertion into `coinNews` on every MINOR and MAJOR update (e.g., lines 243, 457) for backward compatibility. This creates an endless loop of new identical article cards on the frontend instead of utilizing the intended single `coinMasterArticles` and its `coinTimelineUpdates`.

---

## 🟢 Applied Fixes (Completed Remediations)
*(Empty for now - to be filled as problems are solved)*

---

## 🔵 Planned Developments (Enhancements & New Features)
*(Empty for now - to be filled based on project roadmap and user instructions)*
