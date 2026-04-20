# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: Phase 9 — Terminal Deep-Link & SEO Integrity Fix

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 7
**Priority Order:** T-01 → T-07 (T-01 & T-02 are backend prerequisite, then T-03→T-07 are frontend)

---

### 1. Planning Stage (Planner)

**Target:** Fix 3 critical bugs: (1) Deep-link article loading failure, (2) Ghost page indexing, (3) SEO indexing errors. The root causes are: API calls silently catch errors returning `null` fallbacks without triggering `notFound()`, `generateStaticParams()` creates pages for all 30 COINS regardless of DB article existence, and `sitemap.ts` blindly lists all coin URLs without verifying article existence.

**Architecture Notes:**
- **Bug 1 (Deep-Link):** `frontend/src/app/terminal/[coin]/page.tsx` and `frontend/src/app/terminal/[coin]/alpha/page.tsx` both fetch `getMasterArticle()` but silently swallow errors (lines 127-130 in `[coin]/page.tsx`, lines 112-115 in `alpha/page.tsx`). No `notFound()` guard exists anywhere. The `terminal/[coin]/page.tsx` page renders `TerminalPageClient` even when `masterArticle` is null — the terminal page SHOULD still render (it has chart + wire), but the `alpha/page.tsx` page should absolutely `notFound()` if no master article exists, because its entire purpose IS the article.
- **Bug 2 (Ghost Pages):** `frontend/src/app/sitemap.ts` → `buildCoinPages()` (line 33) iterates ALL 30 COINS and generates both `/terminal/{coin}` and `/terminal/{coin}/alpha` URLs unconditionally. Need a backend endpoint to query which coins actually have master articles, and filter sitemap entries accordingly.
- **Bug 3 (SEO Errors):** `generateStaticParams()` in both `page.tsx` files (lines 10-12) returns all 30 COINS. Next.js pre-renders 60 pages (30 terminal + 30 alpha), most with empty/no content. The `meta robots` tag should be `noindex, nofollow` for pages without articles to prevent thin content indexing.
- **Backend Need:** A new lightweight endpoint `GET /market/master/coins` that returns an array of coin symbols that have master articles. This is needed by both `sitemap.ts` and `generateStaticParams()` to filter.

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

#### Phase A — Backend Prerequisite (T-01, T-02)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-01** | P0 | `backend/src/controllers/market.controller.ts` | **Add `getMasterArticleCoins` controller.** Create a new exported async function `getMasterArticleCoins(req, res, next)` that queries `SELECT DISTINCT coin_symbol FROM coin_master_articles WHERE coin_symbol IS NOT NULL`, caches the result for 300s under key `master:coins:list`, and returns `{ coins: string[] }` (uppercase symbols). Follow the exact same caching pattern as `getAssetCount` (line 168). Do NOT modify any existing function. | ✅ Done |
| **T-02** | P0 | `backend/src/routes/market.routes.ts` | **Register the new route.** Add `router.get('/master/coins', apiLimiter, getMasterArticleCoins);` ABOVE the existing `router.get('/master/:symbol', ...)` line (line 18) so the static `/coins` path matches before the dynamic `/:symbol` path. Import `getMasterArticleCoins` in the destructured import on line 2. | ✅ Done |

#### Phase B — Frontend API Layer (T-03)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-03** | P0 | `frontend/src/features/terminal/api.ts` | **Add `getMasterArticleCoins` API method.** Add a new method to `terminalApi` object: `getMasterArticleCoins: async (): Promise<string[]>` that calls `apiClient.get<{ coins: string[] }>('/market/master/coins')` and returns `data.coins`. On error, return `[]` (empty array — safe fallback means "we don't know which coins have articles" → sitemap will skip all coin pages to avoid ghost pages). Do NOT modify any existing method. | ✅ Done |

#### Phase C — Frontend Pages Fix (T-04, T-05, T-06)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-04** | P0 | `frontend/src/app/terminal/[coin]/alpha/page.tsx` | **Add `notFound()` guard for missing articles.** (1) Add `import { notFound } from 'next/navigation';` at top. (2) In the page component (line 103), after `masterArticle` is resolved (line 114), add: `if (!masterArticle) { notFound(); }` — this MUST be before the `jsonLd` build. (3) In `generateMetadata()` (line 59): if the catch block fires OR if `masterArticle` is null after the try, set `robots: { index: false, follow: false }` in the returned Metadata object to prevent indexing empty alpha pages. | ✅ Done |
| **T-05** | P1 | `frontend/src/app/terminal/[coin]/page.tsx` | **Add conditional `robots` meta for article-less terminal pages + guard invalid coins.** (1) In `generateMetadata()` (line 60): after the try/catch fetching `masterArticle`, if `masterArticle` is null, add `robots: { index: false, follow: false }` to the returned Metadata. This prevents ghost terminal pages from being indexed while still allowing the page to render (user sees chart + wire). (2) In the page component (line 106): add a guard at the top after resolving `params` — if `coin` is not in the COINS array (validate against the const), call `notFound()`. This prevents random slug pages like `/terminal/xyz` from generating. (3) Update `generateStaticParams()` to remain as-is (all COINS) since terminal pages with charts are valid even without articles — the `robots` meta handles the indexing concern. | ✅ Done |
| **T-06** | P1 | `frontend/src/app/terminal/[coin]/opengraph-image.tsx` | **Handle null masterArticle gracefully for OG images.** The current code already handles null (falls back to default headline). No changes needed to this file, but verify the edge runtime doesn't break when backend returns null. If the API call fails, the catch already handles it. **VERIFICATION ONLY — no code changes expected unless a bug is found.** | ✅ Done |

#### Phase D — Sitemap Fix (T-07)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|---|
| **T-07** | P0 | `frontend/src/app/sitemap.ts` | **Filter coin pages in sitemap to only include coins with master articles.** (1) Import `terminalApi` from `@/features/terminal/api`. (2) Convert `buildCoinPages()` from a synchronous function to `async function buildArticleCoinPages(): Promise<MetadataRoute.Sitemap>`. (3) Inside it, call `const coinsWithArticles = await terminalApi.getMasterArticleCoins();` — if the array is empty (API failed), return an empty array (skip all coin pages rather than generate ghost pages). (4) Filter: only generate sitemap entries for coins in `coinsWithArticles`. Map each coin to both `/terminal/{coin}` and `/terminal/{coin}/alpha` as before. (5) In the default `sitemap()` export (line 66), change `const coinPages = buildCoinPages();` to `const coinPages = await buildArticleCoinPages();`. (6) Remove the now-unused `buildCoinPages` function. | ✅ Done |

---

### 3. QA & Security Stage (QA Hunter)

**Status:** ✅ Execution Complete — All 7 tasks landed, awaiting QA audit

**QA Checklist for Reviewer:**
1. Verify `GET /market/master/coins` returns correct coin list from DB
2. Verify `/terminal/pepe/alpha` (no article) returns 404 with `notFound()`
3. Verify `/terminal/sol/alpha` (has article) renders correctly
4. Verify `/terminal/xyz` (invalid coin) returns 404
5. Verify `/sitemap.xml` only contains coins that have master articles
6. Verify `robots` meta is `noindex, nofollow` on article-less terminal pages
7. Verify direct deep-link navigation to `/terminal/sol` loads with chart + wire (even without article)
8. Verify existing functionality is NOT broken: wire, radar, chat all work on terminal pages

---

### 4. Deployment Stage (Release Manager)

- **Commit Message:** [To be determined after QA pass]
- **Status:** Pending
