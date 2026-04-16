# OnlyAlpha — Project State

**Last Updated:** April 16, 2026
**Current Focus:** Bug Fixes & Dead Code Cleanup — Phase 1 & Phase 2 COMPLETE. Awaiting Phase 3 plan from Architect.

---

## 🏗 Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL. Base architecture relies on crons and OpenRouter (GPT/DeepSeek) for data processing.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds.
4. **Important Note:** *Neon Serverless and Reddit API are NO longer used. Both `@neondatabase/serverless` dependency and all `reddit.service.ts` / `redditExtractor` files have been fully deleted (Phase 2, Micro-Tasks 3.1-3.3).*

---

## 🟢 Completed Phases

### Phase 1 — Backend Data Flow Remediation ✅
- `getLatestWire` reads from `coinTimelineUpdates` (Living Article architecture).
- Backward-compat `coinNews` inserts removed from `aiWorkflow.cron.ts`.
- `stripSectionTags()` added to `openai.service.ts` to prevent `[HOOK]` leak.
- Live price fallback via `getPriceWithFallback()` in `getAlphaFocus`.

### Phase 2 — Frontend UI Fixes & Dead Code Cleanup ✅
- "Sources Analyzed" removed from `TerminalWire.tsx`.
- Scroll-to-deep-dive fixed with `requestAnimationFrame` in `AlphaStream.tsx`.
- `stripPromptTags()` defense-in-depth added to `TimelineFeed.tsx`.
- All Reddit-related files deleted (`reddit.service.ts`, `redditExtractor.ts`, spec).
- `@neondatabase/serverless` dependency removed from `package.json`.

---

## 🔴 Current Mission (Active Phase)
Phases 1 & 2 are complete. Awaiting Phase 3 plan from THE ARCHITECT.

**No new features should be built until the Architect provides the next phase plan.**

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
