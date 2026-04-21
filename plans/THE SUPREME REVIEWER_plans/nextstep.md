## Bug Report: 404 Error on Dynamic AI Radar Coins — REVISED DIAGNOSIS

### Issue Description
Clicking on certain coin cards in the "LIVE AI RADAR" section (e.g., `$RAVE`, `$CHIP`, `$UTK`) redirects the user to a 404 Not Found page.

---

### Root Cause — Three Layers

#### Layer 1: The Explicit Whitelist Gate (PRIMARY CAUSE)
**File:** `frontend/src/app/terminal/[coin]/page.tsx:127-129`
```typescript
if (!COINS.includes(coinSymbol as typeof COINS[number])) {
    notFound();
}
```
The `COINS` array is a hard-coded list of only 30 coins defined in `frontend/src/lib/constants.ts:3-8`. Any radar coin not in this array **always** triggers `notFound()`. This is the direct cause of the 404.

#### Layer 2: The `generateStaticParams` Trap (AGGRAVATING CAUSE)
**File:** `frontend/src/app/terminal/[coin]/page.tsx:11-13`
```typescript
export function generateStaticParams() {
    return COINS.map((coin) => ({ coin: coin.toLowerCase() }));
}
```
There is **no `export const dynamicParams = true`** anywhere in this file. Next.js App Router defaults to `dynamicParams: false` in strict mode. This means:
- At **build time**, only the 30 `COINS` pages are pre-generated.
- At **request time**, any coin NOT in `generateStaticParams` may be rejected by Next.js **before even reaching the page component**.
- The explicit `notFound()` at line 128 is a **double-block** — even if Next.js allowed the dynamic route through, the whitelist kills it.

#### Layer 3: The `AlphaFocusCard` Link (SAME BUG VECTOR)
**File:** `frontend/src/features/home/components/AlphaFocusCard.tsx:127`
```typescript
<Link href={`/terminal/${data.coin}?alpha=true`}>
```
This link also routes arbitrary coin symbols from the API to `/terminal/[coin]`, hitting the same whitelist wall.

---

### What the Original Report Got WRONG

1. **"Dynamic Validation" suggestion is over-engineered.** The terminal page already works for ANY coin — `TerminalPageClient` at `frontend/src/features/terminal/components/TerminalPageClient.tsx:37` defaults to `'SOL'` if no coin-specific data exists:
   ```typescript
   const baseCoin = coin || activeItemCoinEarly || 'SOL';
   ```
   The page is already designed to work without a master article (graceful fallback). The whitelist is the **only** blocker. No backend validation needed.

2. **The report missed the `generateStaticParams` / `dynamicParams` interaction**, which is a critical part of the fix.

---

### APPROVED Fix — Guardrails for the Architect

**Scope:** 2 files only. No backend changes. No new dependencies.

#### File 1: `frontend/src/app/terminal/[coin]/page.tsx`
1. **Remove** the `COINS` import and the whitelist check at lines 127-129 entirely.
2. **Add** `export const dynamicParams = true;` — tells Next.js to allow dynamic routes not in `generateStaticParams`.
3. **Keep** `generateStaticParams` as-is — still benefits build-time ISR for the top 30 coins (SEO pre-rendering).
4. **No other changes.** `generateMetadata` already handles missing master articles gracefully (sets `robots: noindex`). `TerminalPageClient` already handles missing data.

#### File 2: `frontend/src/app/terminal/[coin]/alpha/page.tsx`
1. **Remove** the `COINS` import (unused after this change).
2. **Add** `export const dynamicParams = true;`
3. **Keep** the `masterArticle` null check at line 123 — this is intentional and correct (the alpha sub-page genuinely requires an article to exist). This is NOT the same bug.
4. **Keep** `generateStaticParams` as-is for the same ISR benefit.

### DO NOT:
- Remove or modify `generateStaticParams` — needed for ISR SEO.
- Change any routing, API, or component files.
- Add backend coin validation — unnecessary complexity.
- Touch `RadarGrid.tsx` or `AlphaFocusCard.tsx` — they're already correct.
