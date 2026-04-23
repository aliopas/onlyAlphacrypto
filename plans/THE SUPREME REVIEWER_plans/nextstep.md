# Phase 14 — Article Content Disappears After Update + SEO Integrity Fix

**Status:** PLANNED — Ready for Architect Breakdown
**Date:** April 23, 2026
**Priority:** P0 (Critical User-Facing Bug)
**Scope:** 2 files modified. Zero new files. Zero new npm packages.

---

## Bug Report: Article Content Fails to Load via Link ONLY After Being Updated

### Normal Behavior (First Publish)
When a new article is initially written and its metadata is created, the link works perfectly. If a user clicks the link, both the article content and the chart load correctly.

### Buggy Behavior (After Update)
When that exact same article gets updated, the link behavior breaks. If a user clicks the link after the update, the page ONLY displays the coin's chart. The actual article content disappears and does not show up at all.

---

## ROOT CAUSE ANALYSIS (Tech Lead Verified)

### Primary Bug: Stale `radarId` URL Parameter After Article Update

**Kill Chain (line-by-line trace):**

1. Article published for BTC → radar signal **id=42** created in `radar_signals` table
2. `RadarGrid` on home page links to `/terminal/BTC?radarId=42`
3. User clicks → `validSignals` includes id=42 → `activeRadar` found → `AlphaStream` renders radar text + `DeepDiveSection`
4. Article updated by AI cron → new radar signal **id=43** created for BTC (new row, new auto-increment ID)
5. User refreshes page or revisits via same URL `/terminal/BTC?radarId=42`
6. Server ISR cache refreshes → `getRadarSignals` controller uses `DISTINCT ON (coin_symbol) ORDER BY coin_symbol, created_at DESC` → returns only id=43 (latest per coin), NOT id=42
7. `TerminalPageClient.tsx:24` sets `selectedRadarId = 42` blindly (no validation)
8. `activeRadar = signals.find(r => r.id === 42)` → **`undefined`**
9. `AlphaStream` receives `newsId=null, radarSignal=undefined` → renders **standby view** (no content)
10. Chart still works because `selectedCoin = coin` (from URL param `BTC`) → `TerminalChat` renders `TerminalChart`

**Why this happens:**

| Component | File | Line(s) | Issue |
|-----------|------|---------|-------|
| `radar_signals` table | `backend/src/models/market.model.ts` | 85-93 | NO unique constraint on `coinSymbol`. `id` is auto-increment. `onConflictDoNothing()` is a no-op — every MAJOR update with actionable verdict creates a NEW row with a NEW ID |
| `getRadarSignals` controller | `backend/src/controllers/market.controller.ts` | 134-140 | `DISTINCT ON (coin_symbol) ORDER BY coin_symbol, created_at DESC` — returns only the LATEST signal per coin. Old signals silently excluded from API response |
| `TerminalPageClient` | `frontend/src/features/terminal/components/TerminalPageClient.tsx` | 24 | `initialRadarId` is used **blindly** without validating it exists in `validSignals`. No fallback to latest radar for the same coin |
| `AlphaStream` | `frontend/src/features/terminal/components/AlphaStream.tsx` | 114 | When `!newsId && !radarSignal` → shows "Alpha Stream Standby" — no article content at all |

### Secondary Bug: Missing Redis Cache Invalidation for Master Article

**File:** `backend/src/crons/aiWorkflow.cron.ts` — Line 490

The cron deletes `news:${symbol}` and `insight:all` but **NEVER** invalidates `master:${symbol}` (the `getMasterArticle` cache key at `market.controller.ts:361`).

| Cache Key | TTL | Invalidated by Cron? | Impact |
|-----------|-----|---------------------|--------|
| `master:${symbol}` | 60s | NO | Stale master article data served for up to 60s after update |
| `wire:${coin}:...` | 120s | NO (wrong key `news:${symbol}`) | Stale wire feed for up to 120s |
| `radar:latest:...` | 60s | NO | Stale radar signals for up to 60s |
| `timeline:${symbol}:...` | 30s | NO | Stale timeline for up to 30s |
| `master:coins:list` | 300s | NO | Stale coin list for up to 5 minutes |
| `archive:all` | 3600s | NO | Stale archive for up to 1 hour |

Note: The `master:${symbol}` cache self-expires after 60s, so it's not permanent. But the `master:coins:list` (300s) and `archive:all` (3600s) caches are never invalidated after article creation/updates — these are secondary concerns.

---

## FIX PLAN

### Fix 1 (P0): Validate Stale radarId in TerminalPageClient

**File:** `frontend/src/features/terminal/components/TerminalPageClient.tsx`
**Lines:** 23-25

**BEFORE (broken):**
```typescript
const latestRadarForCoin = validSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase())?.id;
const defaultRadarId = initialRadarId ?? (isAlphaFocus ? latestRadarForCoin : null);
const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;
```

**AFTER (fixed):**
```typescript
const latestRadarForCoin = validSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase());
const safeInitialRadarId = initialRadarId != null && validSignals.some(r => r.id === initialRadarId) ? initialRadarId : null;
const defaultRadarId = isAlphaFocus
    ? (safeInitialRadarId ?? latestRadarForCoin?.id ?? null)
    : safeInitialRadarId;
const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;
```

**Fallback priority:**
1. `initialRadarId` — if it actually exists in `validSignals` (not stale)
2. Latest radar signal for the same coin — if `isAlphaFocus`
3. First available signal — universal fallback
4. `null` — no signals at all (standby view)

### Fix 2 (P0): Add Missing Redis Cache Invalidation

**File:** `backend/src/crons/aiWorkflow.cron.ts`
**Line:** 490

**BEFORE (broken):**
```typescript
await deleteCache(`news:${symbol}`);
await deleteCache('insight:all');
```

**AFTER (fixed):**
```typescript
await deleteCache(`master:${symbol}`);
await deleteCache(`news:${symbol}`);
await deleteCache('insight:all');
```

---

## SEO METADATA BEHAVIOR ON ARTICLE UPDATE (Verified OK — No Fix Needed)

### Findings

| Scenario | SEO Fields Updated? | Assessment |
|----------|-------------------|------------|
| MAJOR update (new article) | Yes — `metaTitle`, `metaDescription`, `seoKeywords` generated via `callWriterStage2A` | Correct |
| MAJOR update (existing article) | Yes — `callGptNanoMasterUpdate` (`openai.service.ts:654`) regenerates all SEO fields | Correct |
| MINOR update | No — only `minorUpdateCount`, `lastMinorUpdate`, `updatedAt` bumped | Correct by design |
| `generateMetadata` reads from API | Yes — `masterArticle.metaTitle`, `.metaDescription`, `.seoKeywords` | Correct |
| ISR revalidation | 60s timer (`revalidate = 60`) | Acceptable for Google |
| On-demand revalidation | NOT implemented — zero `revalidatePath`/`revalidateTag` calls in codebase | Nice-to-have, not critical |

### Silent Failure in `callGptNanoMasterUpdate` (Low Risk)

`openai.service.ts:692` — if JSON parse fails, function returns `{}`. The DB update at `aiWorkflow.cron.ts:416` spreads `{}` into the SET clause, so only counters and timestamps are incremented. Article content/SEO remains unchanged (stale but not broken).

**Recommendation (future phase):** If `callGptNanoMasterUpdate` returns `{}`, skip the DB update entirely (don't increment counters). This prevents false "last major update" timestamps when no actual content change occurred.

---

## NAVIGATION LINK INTEGRITY (Verified — Fix 1 Covers This)

### All External Links to Terminal Page

| Source Component | Link Pattern | After Fix 1 |
|-----------------|-------------|-------------|
| `AlphaFocusCard` | `/terminal/${data.coin}?alpha=true` | Always works — no radarId in URL, falls back to latest radar for coin |
| `RadarGrid` | `/terminal/${s.coin}?radarId=${s.id}` | Fixed — stale radarId validated and replaced with latest |
| `ArchivePageClient` | `/terminal/${article.coinSymbol.toLowerCase()}/alpha` | Separate route (`/alpha` page), unaffected by this bug |
| Browser bookmarks/history | `/terminal/BTC?radarId=42` (old ID) | Fixed — stale ID detected, falls back to latest radar for BTC |

### Why `/terminal/[coin]/alpha` Route Is Unaffected

The `/alpha` route renders `LivingArticle` independently. It fetches `getMasterArticle(symbol)` client-side — no dependency on `radarSignals` array or `radarId` URL param. This route has no chart component, so it doesn't match the user's reported bug pattern (chart + missing content).

---

## COMPLETE RENDERING FLOW (Reference)

```
URL: /terminal/BTC?radarId=42
         │
         ▼
[coin]/page.tsx (Server — ISR cached 60s)
  ├── getLatestWire() → initialNews
  ├── getRadarSignals() → radarSignals (DISTINCT ON → latest per coin)
  ├── reads isAlphaFocus, initialRadarId from URL
  └── passes to TerminalPageClient
         │
         ▼
TerminalPageClient (Client)
  ├── validates initialRadarId in validSignals ← FIX 1 HERE
  ├── computes selectedRadarId
  ├── passes to AlphaStream
  └── passes selectedCoin to TerminalChat → TerminalChart (always works)
         │
         ▼
AlphaStream (Client — Center Panel)
  ├── if radarSignal → shows radar text + "Read Deep Dive" button
  ├── if newsId → fetches getNewsById(id) → shows article sections
  ├── if neither → STANDBY VIEW (bug manifests here)
  └── DeepDiveSection (lazy-loaded) ← fetches getMasterArticle(symbol) fresh
         │
         ▼
DeepDiveSection (Client — Full 7-Section Report)
  ├── getMasterArticle(symbol) ← Redis cache key: master:${symbol} ← FIX 2 HERE
  ├── getTimeline(symbol)
  └── renders coreCatalyst, marketContext, strategicImpact, etc.
```

---

## TECH LEAD GUARDRAILS (MUST be followed)

1. **DO NOT** touch `DeepDiveSection.tsx`, `LivingArticle.tsx`, `AlphaStream.tsx`, or any routing files
2. **DO NOT** modify `getRadarSignals` DISTINCT ON logic — it's correct
3. **DO NOT** add `onConflictDoUpdate` to radar signals insert — out of scope
4. **DO NOT** change `market.model.ts` (no schema changes)
5. **DO NOT** install new packages
6. **DO NOT** modify any route, controller, or cron files EXCEPT `aiWorkflow.cron.ts` (single line addition)
7. Only modify `TerminalPageClient.tsx` (lines 23-25) and `aiWorkflow.cron.ts` (line 490)

## TEST PLAN

1. Publish a new article for BTC → verify radar signal created with ID=X
2. Click RadarGrid link for BTC → verify `/terminal/BTC?radarId=X` loads article content + chart
3. Trigger MAJOR update for BTC → verify new radar signal created with ID=Y (Y > X)
4. Click the OLD link `/terminal/BTC?radarId=X` → verify article content STILL loads (falls back to ID=Y)
5. Refresh the page with old URL → verify content still loads
6. Verify chart still renders correctly throughout
7. Verify `/terminal/BTC?alpha=true` (AlphaFocusCard link) works before and after update
8. Verify `/terminal/BTC/alpha` (Archive link) works before and after update
