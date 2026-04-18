# OnlyAlpha — Project State

**Last Updated:** April 18, 2026
**Current Focus:** Phase 5 Complete — Awaiting Deep Reviewer final audit & push

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
| Sub-Task | Status | Details |
|----------|--------|---------|
| 4.1 | ✅ DONE | Migrated `callGptNanoMinorUpdate` inline prompts to `PromptFactory.buildMinorUpdateMessages()`. |
| 4.2 | ✅ DONE | Added per-entry TTL to `CacheManager.set()`. Fallback cache in `generateLightweightTriage` uses 5-min TTL with separate key prefix. |
| 4.3 | ✅ DONE | Consolidated cleanup — TTL in periodic `cleanup()`, maxSize in `_cleanup()`. |

#### Track D — Frontend (3/3 ✅)
| Sub-Task | Status | Details |
|----------|--------|---------|
| 4.4 | ✅ DONE | All `<details>` accordions default to `open={true}` in `AlphaStream.tsx`. |
| 4.5 | ✅ DONE | No changes needed — native `<details>` handles state reliably. |
| 4.6 | ✅ DONE | Verified "Read Deep Dive" buttons use `scrollToDeepDive` only — no accordion toggle. |

---

## 🔴 Current Mission (Active Phase)
**Phase 5 — Favicon Fix + SEO Meta Tags Enhancement**

**Plan:** `plans/architect_plan_phase5.md` (APPROVED by Supreme Reviewer v2)
**Task Collection:** `plans/phase5_tasks/` (8 micro-tasks + 1 final verification)
**Status:** ✅ ALL TASKS COMPLETE (8/8) + TypeScript PASSED (zero errors)
**Deep Reviewer:** ⏳ Pending final audit & commit/push

**Zero backend changes. Zero new dependencies. 4 edits, 3 new files, 1 delete.**

#### Track E — Favicon Fix (5/5 tasks) ✅ COMPLETE
| Micro-Task | Status | Details |
|-----------|--------|---------|
| E.1 | ✅ DONE | Deleted `icon.svg` from `src/app/` |
| E.2 | ✅ DONE | Modified `icon.tsx` (144→32 size) + created `apple-icon.tsx` (180×180) |
| E.3 | ✅ DONE | Updated `layout.tsx` `icons` metadata (`/icon`, `/apple-icon`) + JSON-LD logo (`/icon.svg` → `/icon`) |
| E.4 | ✅ DONE | Updated `manifest.json` icon references (`/icon.svg` → `/icon`, `/apple-icon`) |
| E.5 | ✅ DONE | Created `src/app/favicon.ico/route.ts` (redirect `/favicon.ico` → `/icon`) |

#### Track F — SEO Meta Tags Enhancement (3/3 tasks)
| Micro-Task | Status | Details |
|-----------|--------|---------|
| F.1 | ✅ DONE | Add dynamic `generateMetadata` to alpha page (`[coin]/alpha/page.tsx`) |
| F.2 | ✅ DONE | Add JSON-LD structured data to coin terminal page (`[coin]/page.tsx`) |
| F.3 | ✅ DONE | Add JSON-LD structured data to alpha page (`[coin]/alpha/page.tsx`) |

#### Final Verification
| Micro-Task | Status | Details |
|-----------|--------|---------|
| FINAL | ✅ DONE | TypeScript check passed (`npx tsc --noEmit` — zero errors) |

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
