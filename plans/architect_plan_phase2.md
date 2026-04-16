# OnlyAlpha — Phase 2: Frontend UI Fixes & Dead Code Cleanup

**Author:** THE ARCHITECT (GLM-5.1)
**Date:** April 16, 2026
**Status:** PENDING EXECUTION
**Depends On:** Phase 1 (COMPLETE ✅)
**Scope:** 6 Micro-Tasks — Frontend UI fixes + Dead Code cleanup

---

## 0. Phase 1 Recap

Phase 1 successfully fixed the backend data flow:
- `getLatestWire` now reads from `coinTimelineUpdates` ✅
- `coinNews` backward-compat inserts removed ✅
- `stripSectionTags` applied to minor updates ✅
- Alpha Focus price fallback to live APIs ✅

Phase 2 fixes the remaining frontend UI issues and cleans up dead code.

---

## Micro-Task 2.1 — Remove "Sources Analyzed" from `TerminalWire.tsx`

**File:** `frontend/src/features/terminal/components/TerminalWire.tsx`

**What to remove:**
1. **Lines ~82-89** — The `itemNews` computation block inside the radar `.map()`:
   ```
   const RADAR_NEWS_TIME_WINDOW_MS = 4 * 60 * 60 * 1000;
   const radarTime = new Date(item.createdAt).getTime();
   const itemNews = news.filter(n => { ... }).slice(0, 2);
   ```
   Delete all 3 constants and the entire filter logic.

2. **Lines ~107-133** — The entire "Sources Analyzed" JSX section:
   ```tsx
   {itemNews.length > 0 && (
       <div className="mt-4 pt-3 border-t border-[#222]">
           <div className="text-[9px] ...">Sources Analyzed ...</div>
           <div className="space-y-1.5">
               {itemNews.map(n => { ... })}
           </div>
       </div>
   )}
   ```
   Delete the entire conditional block.

**Constraints:**
- Do NOT remove the `news` prop or the `onSelectNews` handler — they may be needed elsewhere.
- Do NOT modify the radar card structure above or below the removed section.
- Do NOT touch the "Load More" buttons.

---

## Micro-Task 2.2 — Fix "Read Deep Dive" Button in `AlphaStream.tsx`

**File:** `frontend/src/features/terminal/components/AlphaStream.tsx`

**Current problem:** The button uses `setTimeout(..., 100)` which is fragile when the lazy-loaded `DeepDiveSection` takes longer to mount.

**Required changes:**

1. Add a `scrollToDeepDive` helper function inside the component (before the return statement):
   ```typescript
   const scrollToDeepDive = () => {
       let attempts = 0;
       const maxAttempts = 50;
       const tryScroll = () => {
           const target = document.getElementById('deep-dive-section');
           if (target) {
               target.scrollIntoView({ behavior: 'smooth', block: 'start' });
           } else if (attempts < maxAttempts) {
               attempts++;
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

2. Replace the first button `onClick` handler (the "Read Deep Dive" button in the header area, around line 197):
   ```typescript
   // BEFORE:
   onClick={() => {
       if (!showDeepDive) {
           setShowDeepDive(true);
           setTimeout(() => {
               scrollContainerRef.current?.scrollTo({
                   top: scrollContainerRef.current.scrollHeight,
                   behavior: 'smooth',
               });
           }, 100);
       } else {
           document.getElementById('deep-dive-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
       }
   }}
   // AFTER:
   onClick={scrollToDeepDive}
   ```

3. Replace the second button `onClick` handler (the footer "Deep Dive" link, around line 313):
   ```typescript
   // BEFORE:
   onClick={() => {
       if (!showDeepDive) {
           setShowDeepDive(true);
           setTimeout(() => {
               scrollContainerRef.current?.scrollTo({
                   top: scrollContainerRef.current.scrollHeight,
                   behavior: 'smooth',
               });
           }, 100);
       } else {
           document.getElementById('deep-dive-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
       }
   }}
   // AFTER:
   onClick={scrollToDeepDive}
   ```

**Constraints:**
- Do NOT change any button styling or text.
- Do NOT modify the `DeepDiveSection` component.
- The `scrollContainerRef` can remain declared (no harm) but is no longer used by these handlers.

---

## Micro-Task 2.3 — Strip `[HOOK]` from Timeline Display (Defense-in-Depth)

**File:** `frontend/src/features/terminal/components/TimelineFeed.tsx`

**Required changes:**

1. Add a sanitizer function at the top of the file (after the imports, before the interface):
   ```typescript
   function stripPromptTags(text: string): string {
       return text.replace(/\[(?:HOOK|WHAT HAPPENED|WHY IT MATTERS|HISTORY REPEATS\??|PRICE PICTURE|RISK CHECK|BOTTOM LINE)\]\s*/gi, '').trim();
   }
   ```

2. Apply it in the render (the update text paragraph, around line 87):
   ```typescript
   // BEFORE:
   <p className="text-[#CCC] line-clamp-3">{update.updateText}</p>
   // AFTER:
   <p className="text-[#CCC] line-clamp-3">{stripPromptTags(update.updateText)}</p>
   ```

**Constraints:**
- This is a defense-in-depth measure — the primary fix was Micro-Task 1.3 (backend).
- Do NOT modify any other part of `TimelineFeed.tsx`.

---

## Micro-Task 3.1 — Delete `reddit.service.ts`

**File to delete:** `backend/src/services/reddit.service.ts`

**Pre-deletion verification (run these checks first):**
1. Search entire codebase for imports of `reddit.service` — confirm zero results.
2. If confirmed, delete the file.

**If any import found:** DO NOT DELETE. Flag for Architect review.

---

## Micro-Task 3.2 — Search and delete any other Reddit-related files

**Action:**
1. Run `glob('**/*reddit*')` across the entire project.
2. For each file found:
   - If it's in `backend/src/services/` or `backend/src/crons/` — check for imports. If zero imports, delete.
   - If it's a config or doc file — leave it.
3. Report all found files to the Architect.

---

## Micro-Task 3.3 — Remove `@neondatabase/serverless` Dependency

**Pre-removal verification:**
1. Search entire codebase for `@neondatabase/serverless` — confirm zero imports.
2. Check `package.json` for the dependency entry.

**If confirmed safe:**
```bash
cd backend
npm uninstall @neondatabase/serverless
```

**After removal:**
- Run `npm install` to verify lockfile integrity.
- Run TypeScript check to confirm no broken imports.

**If any import found:** DO NOT UNINSTALL. Flag for Architect review.

---

## Execution Order

```
2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3
```

All micro-tasks are independent but should be executed in this order for clean commit history.

---

## Files Modified Summary

| File | Micro-Task | Type |
|------|-----------|------|
| `frontend/src/features/terminal/components/TerminalWire.tsx` | 2.1 | Frontend |
| `frontend/src/features/terminal/components/AlphaStream.tsx` | 2.2 | Frontend |
| `frontend/src/features/terminal/components/TimelineFeed.tsx` | 2.3 | Frontend |
| `backend/src/services/reddit.service.ts` | 3.1 | Delete |
| `backend/package.json` | 3.3 | Config |

---

## What This Plan Does NOT Touch

- No backend controllers or crons (fixed in Phase 1)
- No routes or API endpoints
- No database schema changes
- No new npm packages added
- No test files
- No environment variables
