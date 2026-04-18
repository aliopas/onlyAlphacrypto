# OnlyAlpha — Project State

**Last Updated:** April 18, 2026
**Current Focus:** Phase 6 Complete — Awaiting Commit/Push

---

## 🏗 Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL. Base architecture relies on crons and OpenRouter (GPT/DeepSeek) for data processing.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds.
4. **Important Note:** *Neon Serverless and Reddit API are NO longer used. Both `@neondatabase/serverless` dependency and all `reddit.service.ts` / `redditExtractor` files have been fully deleted (Phase 2, Micro-Tasks 3.1-3.3).*

### Current Model Roles
```
DeepSeek (deepseek-r1)     → Deep Analysis (verdict, sentiment, levels)    [UNCHANGED]
Gemini 2.5 Flash           → Article Writing (Stage 2A/2B + legacy writer) [NEW — Phase 3]
GPT-5-nano                 → SEO only (meta tags, hooks) + Minor Updates   [DEMOTED]
```

### Modular AI Architecture (Phase 3)
```
backend/src/services/ai/
  ├── ai-gateway.ts          ← AIGateway class (OpenAI-compatible HTTP client)
  ├── cache-manager.ts       ← CacheManager (SHA-256 keyed, TTL-based, max-size eviction)
  ├── prompt-factory.ts      ← ALL prompts (analysis, writer 2A/2B, master update, chat, triage, airdrop)
  ├── quality-auditor.ts     ← Cross-model audit (log-only)
  └── factual-grounding.ts   ← Price level validation
```

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

### Phase 3 — Writer Model Migration + Historical Depth ✅

**Plan:** `plans/architect_plan_phase3.md`
**Git:** `b895b5d` pushed to `main`

#### Track A — Writer Model Fix (complete ✅)
| Micro-Task | Status | Details |
|-----------|--------|---------|
| 3.1 | ✅ DONE | Added `WRITER_MODEL` to `env.ts` (default: `google/gemini-2.5-flash`). Added module-level `writerGateway` to `openai.service.ts`. |
| 3.2 | ✅ DONE | Deleted shadow declarations of `writerGateway`/`writerModel` from `callGptNanoWriter`, `callWriterStage2A`, `callWriterStage2B`. All now use module-level `writerGateway` + `env.WRITER_MODEL`. |
| 3.3 | ✅ DONE | Relaxed Stage2A schema (200→100 min chars), Stage2B schema (200→100, 150→80). Added null-section directive to `callGptNanoMasterUpdate`. Removed placeholder fallback from `mergeArticleStages` (now returns `null`). Moved master-update prompts to `PromptFactory.buildMasterUpdateMessages`. Fixed `any` type in `MasterUpdateInput.analysisResult` → `unknown`. |
| 3.4 | ✅ DONE | Updated `repair-incomplete-articles.ts` — improved `isSectionIncomplete` with placeholder pattern detection. |

#### Track B — Historical Analysis Depth (complete ✅)
| Micro-Task | Status | Details |
|-----------|--------|---------|
| 3.5.A | ✅ DONE | Fixed historical news fetch to iterate over event types instead of hardcoded `'Other'` in `temporalIntelligence.service.ts`. |
| 3.5.B | ✅ DONE | Added eventType filtering to `buildTemporalPattern` SQL query with fuzzy fallback. Extended window to 365 days. |
| 3.5.C | ✅ DONE | Injected `_historicalCases` + `_historicalStats` into `analysisJson` in `aiWorkflow.cron.ts`. Updated `HISTORY REPEATS?` prompt in `prompt-factory.ts`. |
| 3.5.D | ✅ DONE | Expanded `temporalContext` instruction in DeepSeek analysis prompt to include statistical summaries. |

### Phase 4 — Cache Enhancement + Accordion Fix ✅

**Git:** Pending push to `main`

#### Track C — Backend (3/3 ✅)
- 4.1: Migrated `callGptNanoMinorUpdate` inline prompts to `PromptFactory.buildMinorUpdateMessages()`.
- 4.2: Added per-entry TTL to `CacheManager.set()`. Fallback cache uses 5-min TTL with separate key prefix.
- 4.3: Consolidated cleanup — TTL in periodic `cleanup()`, maxSize in `_cleanup()`.

#### Track D — Frontend (3/3 ✅)
- 4.4: All `<details>` accordions default to `open={true}` in `AlphaStream.tsx`.
- 4.5: No changes needed — native `<details>` handles state reliably.
- 4.6: Verified "Read Deep Dive" buttons use `scrollToDeepDive` only.

### Phase 5 — Favicon Fix + SEO Meta Tags Enhancement ✅

**Plan:** `plans/architect_plan_phase5.md` (APPROVED by Supreme Reviewer v2)
**Tasks:** `plans/phase5_tasks/` (8 micro-tasks + 1 final verification)
**TypeScript Check:** PASSED (`npx tsc --noEmit` — zero errors)
**Git:** Pending commit/push by Deep Reviewer

#### Track E — Favicon Fix (5/5 ✅)
- E.1–E.5: All favicon files created/fixed, `layout.tsx` and `manifest.json` updated.

#### Track F — SEO Meta Tags Enhancement (3/3 ✅)
- F.1–F.3: Dynamic `generateMetadata` + JSON-LD structured data on terminal and alpha pages.

### Phase 6 — Bug Fixes (Re-Processing, Meta Truncation, SEO Repair) ✅

**Plan:** `plans/architect_plan_phase6.md` (v2)
**TypeScript Check:** PASSED (zero errors — both backend & frontend)
**Git:** Pending commit/push by Deep Reviewer

#### Track G — Stop Re-Processing Consumed Items (2/2 ✅)
- 6.1: Added `eq(consumed, false)` to both DB queries in `aiWorkflow.cron.ts`.
- 6.2: Added `markBufferItemConsumed()` helper + inserted at all 6 exit points.

#### Track H — Truncate Meta Tags Before Validation (4/4 ✅)
- 6.4: Added `truncateMetaField()` helper (returns `unknown`, preserves Zod type validation).
- 6.5: Type-guard + truncate before `ArticleSchema.safeParse` in `callGptNanoWriter`.
- 6.6: Type-guard + truncate before `Stage2ASchema.safeParse` in `callWriterStage2A`.
- 6.8: Truncate in `callGptNanoMasterUpdate` filtered result.

#### Track I — Repair Existing Meta Tags (1/1 ✅)
- 6.9: Created `backend/src/scripts/repair-meta-tags.ts` — migration flag, concurrency limit, generic pattern detection.

---

## 🔴 Current Mission
**No active phase. Awaiting commit/push of Phases 4-6, then new instructions.**

---

## 📋 Task List (Single Source of Truth)
All active bugs, required UI cleanups, and architectural fixes are strictly recorded in:
`plans/issues_actions.md`

**Agents MUST read `plans/issues_actions.md` before starting any work.**

---

## 🔒 Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement across all code.
2. **Do Not Overwrite Intentional Logic:** Understand how `termialEngine` (rss scraping) and `aiWorkflow` (AI processing) hand off data via `rawNewsBuffer` before making changes.
3. **Audit First:** Always check existing code references before adding new dependencies or files.
4. **Backward Compatibility:** All existing exports and function signatures in `openai.service.ts` must remain unchanged. Consumers: `aiWorkflow.cron.ts`, `triageEngine.cron.ts`, `airdropHunter.cron.ts`, `chat.controller.ts`, `quality-auditor.ts`, `repair-incomplete-articles.ts`, `seed-master-articles.ts`, `test-article-generation.ts`.
5. **Modular Boundaries:** Cache logic → `CacheManager`. AI calls → `AIGateway`. Prompts → `PromptFactory`. Do not revert to inline implementations.
