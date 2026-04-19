# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: SEO & Platform Quality Audit — Fix Implementation

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Total Tasks:** 8
**Priority Order:** P0 (Critical) → P1 (High) → P2 (Medium)

---

### 1. Planning Stage (Planner & Architect)

**Target:** Fix all SEO indexing issues, backend data quality bugs, and UX bugs identified in the Supreme Review audit.
**Architecture Notes:**
- P0 fixes are blocking Google indexing — must deploy first.
- P1 fixes address backend data quality — can deploy alongside P0.
- P2 fixes are UX enhancements — can deploy independently.
- No new packages, no new routes, no test files.
- Only files listed below may be modified.

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

#### P0 — Critical (Blocking Google Indexing)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-01** | P0 | `frontend/next.config.ts` | **Add 301 redirects for all 30 coins.** Add an `async redirects()` function to the `nextConfig` object that maps `/{coin}` → `/terminal/{coin}` for all 30 coins (lowercase). Use `permanent: true` (301). The COINS array must be defined inside the function. Do NOT alter existing `headers()` or `images` config. | ✅ Done |
| **T-02** | P0 | `frontend/src/app/not-found.tsx` (NEW) | **Create custom 404 page.** Create this new file with: (a) `export const metadata: Metadata` with `robots: { index: false, follow: false }` and `title: 'Page Not Found'`. (b) Default export function `NotFound()` returning a centered layout with "404" heading, descriptive text, and a link back to `/`. Use Tailwind classes matching the platform's dark theme (`text-white`, `text-gray-400`, `text-emerald-500`). | ✅ Done |
| **T-03** | P0 | `frontend/src/app/layout.tsx` | **Remove dead SearchAction JSON-LD schema.** In the `<head>` section, locate the second JSON-LD block (the one with `@type: "WebSite"` containing `SearchAction`). Remove this entire JSON-LD script block. Keep ONLY the Organization JSON-LD block. Do NOT touch anything else in layout.tsx — no metadata changes, no GA changes, no structural changes. | ✅ Done |

#### P1 — High (Backend Data Quality)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-04** | P1 | `backend/src/crons/aiWorkflow.cron.ts` | **Stop article re-processing loop.** In the AI Workflow cron, after an item from `rawNewsBuffer` is successfully processed (published or skipped as duplicate), mark it as consumed so it's not re-selected in the next hourly cycle. Implementation: Add a `consumed_at` timestamp update (e.g., `SET consumed_at = NOW()`) to the query/update logic after processing. Exclude items where `consumed_at IS NOT NULL` from the initial buffer query. If no `consumed_at` column exists in the DB schema, note this in the execution log — the Senior should check the Drizzle schema first and add the column if needed. | ✅ Done |
| **T-05** | P1 | `backend/src/services/openai.service.ts` | **Add metaDescription truncation safety net.** Before Zod validation runs on AI responses, add a truncation step: (a) `metaDescription` → truncate to 160 characters max. (b) `metaTitle` → truncate to 60 characters max. This should be a small utility function (e.g., `truncateMetaField(value: string, max: number): string`) applied right after JSON parsing and before schema validation. Do NOT alter existing retry logic or fallback logic. | ✅ Done |

#### P2 — Medium (UX & Enhancement)

| Task ID | Priority | File(s) | Task Description | Status |
|---|---|---|---|---|
| **T-06** | P2 | `frontend/src/features/terminal/components/LivingArticle.tsx` | **Fix template literal bug on line 56.** Change the plain string `"No living article found for ${symbol}"` to a template literal `` `No living article found for ${symbol}` ``. This is a single-character fix (wrap in backticks). Do NOT alter anything else in this file. | ✅ Done |
| **T-07** | P2 | `backend/src/scripts/repair-meta-tags.ts` (NEW) | **Create meta tag repair script.** Build a standalone TypeScript script that: (a) Queries all `coinMasterArticles` from the DB. (b) Identifies articles with `null`, empty, or poor meta tags (metaTitle < 20 chars, metaDescription < 50 chars or > 160 chars). (c) For each flagged article, uses `AIGateway` to regenerate proper SEO meta tags. (d) Updates the database with the new values. The script should be runnable via `npx tsx scripts/repair-meta-tags.ts` and log progress to console. Use existing infrastructure (AIGateway, PromptFactory, Drizzle). | ✅ Done |
| **T-08** | P2 | `frontend/src/app/terminal/[coin]/opengraph-image.tsx` (NEW) | **Create per-coin dynamic OG image.** Create a new file that exports `ImageResponse` from `next/og`. It should: (a) Accept the `coin` param from the dynamic route. (b) Fetch the master article via `terminalApi.getMasterArticle(symbol)`. (c) Render a 1200x630 image with the coin symbol (large) and article headline/title. (d) Use the platform's dark theme colors (dark background, emerald accents). (e) Use edge runtime. Fallback: if no article data, render coin symbol with generic "AI-Powered Analysis" subtitle. | ✅ Done |

---

### 3. QA & Security Stage (QA Hunter)

**Audit Date:** April 19, 2026
**Re-Audit Date:** April 19, 2026 (post-fix verification)
**Auditor:** QA & Security Hunter
**Overall Verdict:** ✅ **FULL PASS — All 8 tasks approved**

---

#### T-01 — P0: 301 Redirects (`next.config.ts`) — ✅ PASS
All 30 coins mapped, `permanent: true`, lowercase, COINS scoped inside function. `headers()` and `images` untouched.

#### T-02 — P0: Custom 404 Page (`not-found.tsx`) — ✅ PASS
`robots: { index: false, follow: false }` correctly set. Dark theme Tailwind classes applied. `<a>` upgraded to Next.js `<Link>` for client-side navigation.

#### T-03 — P0: Remove Dead SearchAction JSON-LD (`layout.tsx`) — ✅ PASS
Only Organization JSON-LD block remains. GA, metadata, fonts, structural layout — all untouched.

#### T-04 — P1: Article Re-Processing Loop (`aiWorkflow.cron.ts`) — ✅ PASS
`consumedAt` column confirmed in Drizzle schema. `markBufferItemConsumed()` called on ALL exit paths. `isNull(rawNewsBuffer.consumedAt)` filter applied to both buffer queries.

#### T-05 — P1: Meta Truncation Safety Net (`openai.service.ts`) — ✅ PASS
`truncateMetaField()` handles `unknown` input safely. Applied in 3 locations: `callGptNanoWriter`, `callWriterStage2A`, `callGptNanoMasterUpdate`. Placed AFTER JSON parse, BEFORE Zod validation.

#### T-06 — P2: Template Literal Bug (`LivingArticle.tsx`) — ✅ PASS (fixed)
**Fix verified at line 56:** `{`No living article found for ${symbol}`}` — correctly wrapped in JSX expression. `${symbol}` now interpolates properly.

#### T-07 — P2: Meta Tag Repair Script (`repair-meta-tags.ts`) — ✅ PASS
Idempotency guard with `repair_meta_tags_v3` flag. Hard truncation enforces limits. 3-second delay between API calls. Clean error handling.

#### T-08 — P2: Per-Coin OG Image (`opengraph-image.tsx`) — ✅ PASS (fixed)
**Fixes verified:** `params` typed as `Promise<{ coin: string }>` and awaited (line 10-11). `export const revalidate = 300` added (line 8). 5-minute ISR cache prevents crawler abuse.

---

### Summary

| Task | Verdict |
|---|---|
| T-01 | ✅ Pass |
| T-02 | ✅ Pass |
| T-03 | ✅ Pass |
| T-04 | ✅ Pass |
| T-05 | ✅ Pass |
| T-06 | ✅ Pass (fixed) |
| T-07 | ✅ Pass |
| T-08 | ✅ Pass (fixed) |

**Status:** ✅ **FULL PASS — Release Manager cleared to proceed.**

---

### 4. Deployment Stage (Release Manager)

- **Commit Message:** [To be determined after all tasks complete]
- **Status:** Pending
