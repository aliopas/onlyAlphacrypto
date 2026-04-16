# OnlyAlpha — Project State

**Last Updated:** April 2026
**Current Focus:** Bug Fixes, UI/UX Corrections, and Data Flow Architecture Remediation.

---

## 🏗 Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL. Base architecture relies on crons and OpenRouter (GPT/DeepSeek) for data processing.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds.
4. **Important Note:** *Neon Serverless and Reddit API are NO longer used. The `@neondatabase/serverless` and `reddit.service.ts` are considered dead code/unused.*

---

## 🔴 Current Mission (Active Phase)
The project is currently under a strict bug-fixing and refactoring phase. Past AI agents successfully built the foundations (Phases 0-6), but left several architectural flaws and UI bugs that must be fixed. 

**No new features should be built until the active issues are resolved.**

### The "Living Article" Conflict
- **Expected Behavior:** There should only be ONE "Master Article" per coin (`coin_master_articles`), which gets updated via `coinTimelineUpdates`. 
- **Current Bug:** The backend cron `aiWorkflow.cron.ts` is still pushing complete new articles into the legacy `coin_news` table for every minor/major update. The frontend (`getLatestWire` in `market.controller.ts`) is blindly fetching from `coin_news`, leading to a highly repetitive terminal feed filled with duplicate analysis instead of updating a single article.

---

## 📋 Task List (Single Source of Truth)
All active bugs, required UI cleanups, and architectural fixes are strictly recorded in:
`plans/issues_actions.md`

**Agents MUST read `plans/issues_actions.md` before starting any implementation.**

---

## 🔒 Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement across all code.
2. **Do Not Overwrite Intentional Logic:** Understand how `termialEngine` (rss scraping) and `aiWorkflow` (AI processing) hand off data via `rawNewsBuffer` before making changes.
3. **Audit First:** Always check existing code references before adding new dependencies or files.
