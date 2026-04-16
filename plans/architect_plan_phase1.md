# OnlyAlpha — Architectural Remediation Plan (Phase 1)

**Author:** THE ARCHITECT (GLM-5.1)
**Date:** April 16, 2026
**Status:** PENDING SUPREME REVIEW
**Scope:** Bug Fixes, Data Flow Remediation, Dead Code Cleanup
**Reference:** `plans/issues_actions.md`

---

## 0. Executive Summary

The project has 7 documented issues. After a full codebase audit, I identified that **6 of 7 issues share a common root cause**: the `coinNews` legacy table is being used as both a write target (by `aiWorkflow.cron.ts`) and a read source (by `market.controller.ts:getLatestWire`), bypassing the intended "Living Article" architecture (`coinMasterArticles` + `coinTimelineUpdates`).

This plan is divided into **3 phases** with **10 micro-tasks**, ordered by dependency and criticality.

---

## 1. Architecture Context — The "Living Article" Model

### Intended Design (Correct)
```
coinMasterArticles (1 per coin)
  └── coinTimelineUpdates (N events per master article)
```
- Each coin has **one** `coinMasterArticles` row that gets updated in-place.
- Each MAJOR or MINOR event creates a `coinTimelineUpdates` row linked to that master.
- The frontend terminal feed should display a **deduplicated chronology** from these two tables.

### Current Broken Flow
```
aiWorkflow.cron.ts
  ├── MAJOR path → writes to coinMasterArticles ✓
  │               → writes to coinTimelineUpdates ✓
  │               → ALSO writes to coinNews ✗ (backward compat, causes duplicates)
  │
  └── MINOR path → writes to coinTimelineUpdates ✓
                  → ALSO writes to coinNews ✗ (backward compat, causes duplicates)

market.controller.ts:getLatestWire()
  └── reads from coinNews ✗ → produces duplicate article cards in terminal
```

---

## 2. Root Cause Analysis Per Issue

### Issue 1: Terminal / Article Duplication (CRITICAL)
| Field | Detail |
|-------|--------|
| **Root Cause** | `aiWorkflow.cron.ts` lines 241-252 (MINOR) and 442-457 (MAJOR) insert into `coinNews` for "backward compatibility". `getLatestWire` reads from `coinNews`, producing duplicate cards per coin. |
| **Files** | `backend/src/crons/aiWorkflow.cron.ts`, `backend/src/controllers/market.controller.ts` |
| **Impact** | Every AI workflow cycle creates redundant terminal entries instead of updating a single living article. |

### Issue 2: Missing Analysis Sections
| Field | Detail |
|-------|--------|
| **Root Cause** | `AlphaStream.tsx` uses `parseArticleSections()` which parses `[TAG]` markers from `coinNews.summary` — a flat text field. Meanwhile, `LivingArticle.tsx` and `DeepDiveSection.tsx` correctly read structured columns (`coreCatalyst`, `marketContext`, etc.) from `coinMasterArticles`. The `coinNews` path is inherently incomplete. |
| **Files** | `frontend/src/features/terminal/components/AlphaStream.tsx` |
| **Impact** | Users see only 2 of 7 sections when viewing articles through the `coinNews`-backed path. |

### Issue 3: "Sources Analyzed" UI Clutter
| Field | Detail |
|-------|--------|
| **Root Cause** | Intentional UI element that provides no value. Shows news headlines within radar signal cards. |
| **Files** | `frontend/src/features/terminal/components/TerminalWire.tsx:107-133` |
| **Impact** | Visual noise, no functional value. |

### Issue 4: "Read Deep Dive" Button Bug
| Field | Detail |
|-------|--------|
| **Root Cause** | `AlphaStream.tsx:196-215` uses `setTimeout(..., 100)` to wait for lazy-loaded `DeepDiveSection`. The delay is insufficient on slow connections, causing the scroll to miss the target. |
| **Files** | `frontend/src/features/terminal/components/AlphaStream.tsx` |
| **Impact** | Button appears to hang or do nothing. |

### Issue 5: `[HOOK]` Text Leak in Timeline
| Field | Detail |
|-------|--------|
| **Root Cause** | `callGptNanoMinorUpdate` (`openai.service.ts:581-600`) returns raw AI output without sanitizing prompt structure tags (`[HOOK]`, `[WHAT HAPPENED]`, etc.). The AI sometimes echoes these tags. The unsanitized text is stored directly into `coinTimelineUpdates.updateText`. |
| **Files** | `backend/src/services/openai.service.ts`, `frontend/src/features/terminal/components/TimelineFeed.tsx` |
| **Impact** | Users see literal `[HOOK]` text at the start of timeline updates. |

### Issue 6: Alpha Focus Price = $0
| Field | Detail |
|-------|--------|
| **Root Cause** | `market.controller.ts:66-94` (`getAlphaFocus`) reads from `priceSnapshots` DB table only. If no snapshot exists (or it's stale), price falls back to `$0` and change to `+0.00%`. The `priceService.ts:getPriceWithFallback()` function fetches live prices from Binance/DexScreener but is never called as a fallback. |
| **Files** | `backend/src/controllers/market.controller.ts` |
| **Impact** | Home page shows $0 price for the Alpha Focus coin. |

### Issue 7: Dead Code (Reddit + Neon)
| Field | Detail |
|-------|--------|
| **Root Cause** | `reddit.service.ts` is imported nowhere in the cron pipeline. `@neondatabase/serverless` is in `package.json` but the system uses standard `pg` pool. |
| **Files** | `backend/src/services/reddit.service.ts`, `package.json` |
| **Impact** | Code clutter, unnecessary dependency. |

---

## 3. Micro-Task Execution Plan

### Phase 1: Backend Data Flow Fix (CRITICAL — Must be first)

#### Micro-Task 1.1 — Refactor `getLatestWire` to use Living Article architecture
**File:** `backend/src/controllers/market.controller.ts` (function `getLatestWire`, lines 166-201)

**Current behavior:**
```typescript
let query = db.select().from(coinNews).$dynamic();
// ... reads from coinNews table
```

**Required changes:**
- Replace `coinNews` query with a query over `coinMasterArticles` + `coinTimelineUpdates`
- The response should be a **unified chronological feed** of:
  - Master article snapshots (1 per coin, latest version)
  - Timeline updates (MAJOR + MINOR events)
- Each item must have a `type` discriminator: `'master'` or `'update'`
- Keep the response shape backward-compatible with the existing `CoinNews` frontend type (provide `headline`, `summary`, `coinSymbol`, `publishedAt`, `formattedTime`, `sentiment`, `impactScore`)
- For `type === 'master'` items: map `coinMasterArticles.headline` → `headline`, `coinMasterArticles.coreCatalyst` → first section of `summary`
- For `type === 'update'` items: map `coinTimelineUpdates.updateText` → `summary`, `coinTimelineUpdates.sourceTitle` → `headline`
- Maintain existing cache key pattern (`wire:${coin || 'all'}:${limit}:${offset}`)
- Use `UNION ALL` or two separate queries merged in code (Senior's choice based on Drizzle ORM ergonomics)

**Constraints:**
- Do NOT modify routes, controller signatures, or the `/market/wire` endpoint path
- Do NOT break the existing `CoinNews` TypeScript type on the frontend

---

#### Micro-Task 1.2 — Remove `coinNews` backward-compat inserts from `aiWorkflow.cron.ts`
**File:** `backend/src/crons/aiWorkflow.cron.ts`

**Lines to remove:**
1. **MINOR path (lines 241-252):** Remove the entire `// Write to coinNews for backward compatibility` block:
   ```typescript
   // DELETE THIS BLOCK (lines 241-252):
   const sourceHash = crypto.createHash('sha256').update(item.title).digest('hex');
   await db.insert(coinNews).values({
       coinSymbol: symbol,
       headline: `Update: ${item.title.slice(0, 50)}...`,
       summary: updateText,
       sentiment: item.sentimentHint || null,
       impactScore: item.relevanceScore || null,
       sourceHash,
       aiProcessed: 1,
   }).onConflictDoNothing();
   ```

2. **MAJOR path (lines 442-457):** Remove the entire `// 4f. Save to coinNews` block:
   ```typescript
   // DELETE THIS BLOCK (lines 442-457):
   const sourceHash = crypto.createHash('sha256').update(article.headline).digest('hex');
   const insertedNews = await db.insert(coinNews).values({
       coinSymbol: symbol,
       headline: article.headline,
       summary: article.fullArticle,
       hook: article.hook,
       metaTitle: article.metaTitle,
       metaDescription: article.metaDescription,
       seoKeywords: article.seoKeywords,
       sentiment: analysisResult.sentiment,
       impactScore: analysisResult.impactScore,
       isBreaking: analysisResult.isBreaking ? 1 : 0,
       sourceHash,
       aiProcessed: 1,
   }).onConflictDoNothing().returning({ id: coinNews.id });
   ```

**After removal, fix the dependent code:**
- Line 461 (`const newsId = insertedNews.length > 0 ? insertedNews[0].id : null;`): Set `newsId` to `null` since `coinNews` insert is gone
- Lines 464-473 (radar signal insert): Keep the radar signal insert but set `newsId: null` instead of `newsId`
- The `coinNews` import can be removed from line 18 if no other references exist

**Constraints:**
- Do NOT touch the `coinMasterArticles` writes (lines 364-425)
- Do NOT touch the `coinTimelineUpdates` writes (lines 388-399, 412-424)
- Keep all retry logic, circuit breakers, embedding storage, and memory saves intact

---

#### Micro-Task 1.3 — Add `[HOOK]` tag sanitizer to `callGptNanoMinorUpdate`
**File:** `backend/src/services/openai.service.ts`

**Required changes:**
1. Add a utility function after the existing `extractSection` function (around line 699):
   ```typescript
   const SECTION_TAG_PATTERN = /\[(?:HOOK|WHAT HAPPENED|WHY IT MATTERS|HISTORY REPEATS\??|PRICE PICTURE|RISK CHECK|BOTTOM LINE)\]\s*/gi;

   function stripSectionTags(text: string): string {
       return text.replace(SECTION_TAG_PATTERN, '').trim();
   }
   ```

2. Apply it in `callGptNanoMinorUpdate` (line 599):
   ```typescript
   // BEFORE:
   return raw.trim();
   // AFTER:
   return stripSectionTags(raw);
   ```

**Constraints:**
- Do NOT modify the prompt content or model parameters
- Do NOT touch any other function in the file

---

#### Micro-Task 1.4 — Fix Alpha Focus live price fallback
**File:** `backend/src/controllers/market.controller.ts` (function `getAlphaFocus`, lines 37-108)

**Current behavior (lines 66-94):**
- Reads `priceSnapshots` table for latest price and 24h change
- If no snapshot exists, price stays `$0`

**Required changes:**
1. Import `getPriceWithFallback` from `priceService.ts` (add to top imports)
2. After the `priceSnapshots` query block (after line 94), add a fallback:
   ```typescript
   // If priceSnapshots gave us nothing, fetch live
   let finalPrice = latestPrice ? latestPrice.price : 0;
   let finalPriceChange = priceChange24h;

   if (finalPrice === 0 && focus.coinSymbol) {
       try {
           const livePrice = await getPriceWithFallback(focus.coinSymbol);
           if (livePrice) {
               finalPrice = livePrice.price;
               finalPriceChange = livePrice.change24h ?? 0;
           }
       } catch (e) {
           console.warn('[AlphaFocus] Live price fallback failed:', e);
       }
   }
   ```
3. Update the `mappedFocus` object to use `finalPrice` and `finalPriceChange` instead of the snapshot-derived values

**Constraints:**
- Do NOT remove the `priceSnapshots` query (it's still useful when populated)
- Do NOT modify the Redis caching logic
- The `getPriceWithFallback` call should only happen when snapshots fail (to avoid unnecessary API calls)

---

### Phase 2: Frontend UI Fixes

#### Micro-Task 2.1 — Remove "Sources Analyzed" from `TerminalWire.tsx`
**File:** `frontend/src/features/terminal/components/TerminalWire.tsx`

**Lines to remove:**
1. Lines 82-89: The `itemNews` computation inside the radar map
   ```typescript
   // DELETE: the RADAR_NEWS_TIME_WINDOW_MS, radarTime, itemNews block
   ```
2. Lines 107-133: The entire `{itemNews.length > 0 && (...)}` JSX block containing the "Sources Analyzed" section

**Constraints:**
- Do NOT modify the radar card structure above or below the removed section
- Do NOT touch the `onSelectNews` or `onSelectRadar` handlers

---

#### Micro-Task 2.2 — Fix "Read Deep Dive" button in `AlphaStream.tsx`
**File:** `frontend/src/features/terminal/components/AlphaStream.tsx`

**Current behavior (lines 197-213):**
- Uses `setTimeout(..., 100)` to wait for lazy-loaded DeepDiveSection
- Second occurrence at lines 313-328 with same pattern

**Required changes:**
Replace the `setTimeout` approach with a `MutationObserver` or `requestAnimationFrame`-based scroll:
```typescript
const scrollToDeepDive = () => {
    const tryScroll = () => {
        const target = document.getElementById('deep-dive-section');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            requestAnimationFrame(tryScroll);
        }
    };

    if (!showDeepDive) {
        setShowDeepDive(true);
        requestAnimationFrame(tryScroll);
    } else {
        tryScroll();
    }
};
```
Apply this `scrollToDeepDive` function to both button `onClick` handlers (lines 197 and 313).

**Constraints:**
- Do NOT change the button styling or text
- Do NOT modify the `DeepDiveSection` component
- Add a max retry limit (e.g., 50 frames ≈ ~800ms) to prevent infinite loops

---

#### Micro-Task 2.3 — Strip `[HOOK]` text from Timeline display (defense-in-depth)
**File:** `frontend/src/features/terminal/components/TimelineFeed.tsx`

**Required changes:**
1. Add a sanitizer utility at the top of the file:
   ```typescript
   function stripPromptTags(text: string): string {
       return text.replace(/\[(?:HOOK|WHAT HAPPENED|WHY IT MATTERS|HISTORY REPEATS\??|PRICE PICTURE|RISK CHECK|BOTTOM LINE)\]\s*/gi, '').trim();
   }
   ```
2. Apply it in the render (line 87):
   ```typescript
   // BEFORE:
   <p className="text-[#CCC] line-clamp-3">{update.updateText}</p>
   // AFTER:
   <p className="text-[#CCC] line-clamp-3">{stripPromptTags(update.updateText)}</p>
   ```

**Constraints:**
- This is a defense-in-depth measure. The primary fix is in Micro-Task 1.3 (backend).
- Do NOT modify any other part of the component.

---

### Phase 3: Dead Code Cleanup

#### Micro-Task 3.1 — Delete `reddit.service.ts`
**File to delete:** `backend/src/services/reddit.service.ts`

**Pre-deletion verification:**
- Search codebase for any import of `reddit.service` — confirmed: not imported in any cron, controller, or route
- Delete the file

#### Micro-Task 3.2 — Search and delete `redditExtractor.ts` if it exists
**Action:** `glob('**/*reddit*')` — if found, verify no imports, then delete

#### Micro-Task 3.3 — Remove `@neondatabase/serverless` from `package.json`
**Pre-removal verification:**
- Search codebase for any import of `@neondatabase/serverless` — if zero results, run `npm uninstall @neondatabase/serverless`
- If imports exist, DO NOT proceed (flag for review)

**Constraints:**
- Run `npm install` after removal to verify lockfile integrity
- Do NOT modify any other dependency

---

## 4. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Removing `coinNews` writes breaks `getWireById` endpoint | `getWireById` (`market.controller.ts:203-214`) still reads from `coinNews` — this is fine for fetching **legacy** articles by ID. New articles won't be in `coinNews`, but old ones remain accessible. |
| Frontend `CoinNews` type breaks | Micro-Task 1.1 ensures the `getLatestWire` response shape remains compatible with `CoinNews` type. No frontend type changes needed. |
| `radarSignals.newsId` becomes null | Radar signals already handle `newsId: null` (the column is nullable). Frontend `RadarSignal` type doesn't reference `newsId`. |
| Removing Neon package breaks build | Micro-Task 3.3 verifies zero imports before removal. |

---

## 5. Files Modified Summary

| File | Micro-Tasks | Type |
|------|-------------|------|
| `backend/src/controllers/market.controller.ts` | 1.1, 1.4 | Backend |
| `backend/src/crons/aiWorkflow.cron.ts` | 1.2 | Backend |
| `backend/src/services/openai.service.ts` | 1.3 | Backend |
| `frontend/src/features/terminal/components/TerminalWire.tsx` | 2.1 | Frontend |
| `frontend/src/features/terminal/components/AlphaStream.tsx` | 2.2 | Frontend |
| `frontend/src/features/terminal/components/TimelineFeed.tsx` | 2.3 | Frontend |
| `backend/src/services/reddit.service.ts` | 3.1 | Delete |
| `package.json` | 3.3 | Config |

---

## 6. What This Plan Does NOT Touch

- No routes or controller signatures
- No cron schedules
- No new npm packages
- No database schema migrations
- No test files
- No environment variables
- No `openai.service.ts` prompt content (only adds a sanitizer utility)
- No circuit breaker or retry logic

---

## 7. Expected Outcome

After all micro-tasks are executed:
1. ✅ Terminal feed shows **one living article per coin** with timeline updates (no duplicates)
2. ✅ All 7 analysis sections display correctly in the detail view
3. ✅ "Sources Analyzed" removed from sidebar cards
4. ✅ "Read Deep Dive" button scrolls reliably
5. ✅ No `[HOOK]` text leak in timeline updates
6. ✅ Alpha Focus shows live price data from Binance/DexScreener
7. ✅ Dead code removed (Reddit service, Neon dependency)

---

**AWAITING SUPREME REVIEWER APPROVAL BEFORE DELEGATION TO SENIOR DEVELOPER.**
