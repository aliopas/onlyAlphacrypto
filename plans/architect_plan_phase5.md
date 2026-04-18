# Phase 5 — Favicon Fix + SEO Meta Tags Enhancement

**Architect:** THE ARCHITECT (GLM-5-Turbo)
**Date:** April 18, 2026
**Status:** REVISED — PENDING SUPREME REVIEWER RE-APPROVAL
**Review Input:** `plans/THE SUPREME REVIEWER_plans/revio.md` (v2)
**Revision Note:** Track E rewritten to comply with Next.js App Router reserved filename conventions (per Supreme Reviewer audit findings #1, #2, #3). Track F unchanged (approved).

---

## Scope

Two tracks addressing three bugs identified by the Supreme Reviewer:
- **Track E (Favicon):** Resolve favicon not showing in browser tab
- **Track F (SEO):** Fix generic meta descriptions + add per-coin dynamic SEO + JSON-LD structured data

**Out of Scope (deferred):**
- Dynamic OG images per coin (`opengraph-image.tsx` in `[coin]` folder) — separate phase
- AI prompt improvements for SEO uniqueness — requires backend prompt changes, separate phase

---

## Track E — Favicon Fix (4 micro-tasks)

### E.1: Delete `icon.svg` from `/src/app/`

**File:** `frontend/src/app/icon.svg`
**Action:** DELETE this file.
**Rationale:** `icon.tsx` (dynamic route handler) takes priority over `icon.svg`. Having both creates ambiguity. The SVG is also referenced in `manifest.json` and `layout.tsx` JSON-LD — both references will be updated in E.3/E.4.

### E.2: Modify `icon.tsx` (32×32) + create `apple-icon.tsx` (180×180)

**Files:**
- `frontend/src/app/icon.tsx` (MODIFY — keep filename exactly as-is)
- `frontend/src/app/apple-icon.tsx` (NEW)

**Next.js App Router Convention (CRITICAL):** Next.js uses **exact reserved filenames** inside `app/` for automatic icon generation. The valid filenames are `icon.tsx` and `apple-icon.tsx` — NOT `icon.png.tsx` or `apple-icon.png.tsx`. The `contentType = 'image/png'` export inside the file is sufficient for Next.js to set correct response headers. Next.js exposes these at `/icon` and `/apple-icon` respectively.

**`frontend/src/app/icon.tsx`** (modify existing — change size from 144 to 32):
```typescript
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          borderRadius: 6,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 16, lineHeight: 1, marginBottom: 1 }}>OA</span>
          <span style={{ fontSize: 8, color: '#00e5ff', lineHeight: 1, marginLeft: 0.5, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**`frontend/src/app/apple-icon.tsx`** (NEW — 180×180 Apple Touch Icon):
```typescript
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          borderRadius: 40,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 72, lineHeight: 1, marginBottom: 6 }}>OA</span>
          <span style={{ fontSize: 36, color: '#00e5ff', lineHeight: 1, marginLeft: 2, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### E.3: Update `layout.tsx` — `icons` metadata + JSON-LD logo

**File:** `frontend/src/app/layout.tsx`
**Action:** Two changes:

**Change 1 — `icons` metadata field (lines 45-47):**
Change from:
```typescript
icons: {
    apple: '/apple-icon.svg',
},
```
To:
```typescript
icons: {
    icon: [
        { url: '/icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon',
},
```

**Change 2 — JSON-LD Organization logo (line 98):**
Change from:
```typescript
logo: `${SITE_URL}/icon.svg`,
```
To:
```typescript
logo: `${SITE_URL}/icon`,
```

### E.4: Update `manifest.json` icon references

**File:** `frontend/public/manifest.json`
**Action:** Update the `icons` array to reference the correct Next.js endpoints (`/icon` and `/apple-icon`, NOT `/icon.png` or `/apple-icon.png`).

Change from:
```json
{
  "src": "/icon.svg",
  "sizes": "any",
  "type": "image/svg+xml",
  "purpose": "any maskable"
}
```
To:
```json
{
  "src": "/icon",
  "sizes": "32x32",
  "type": "image/png",
  "purpose": "any"
},
{
  "src": "/apple-icon",
  "sizes": "180x180",
  "type": "image/png",
  "purpose": "any maskable"
}
```

### E.5: Add `/favicon.ico` redirect route handler

**File:** `frontend/src/app/favicon.ico/route.ts` (NEW)
**Action:** Create a proper Next.js App Router route handler that intercepts `/favicon.ico` requests and redirects to `/icon`.

**Next.js App Router Convention (CRITICAL):** API route handlers MUST use the `route.ts` filename inside a directory matching the route segment. A file named `favicon.ico.tsx` in the root `app/` directory is NOT a valid route handler — `.tsx` files are React components only.

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/icon', request.url);
  return NextResponse.redirect(url);
}
```

---

## Track F — SEO Meta Tags Enhancement (4 micro-tasks)

### F.1: Add dynamic `generateMetadata` to `[coin]/alpha/page.tsx`

**File:** `frontend/src/app/terminal/[coin]/alpha/page.tsx`
**Action:** Replace the static `generateMetadata` with a dynamic version that fetches from `terminalApi.getMasterArticle()`.

Current state (line 21-43): Returns hardcoded static title/description — no API fetch, no dynamic SEO.

**Implementation:** Import `terminalApi` and mirror the pattern from `[coin]/page.tsx`:
```typescript
import { terminalApi } from '@/features/terminal/api';

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    let title = `${symbol} Alpha Intelligence Report`;
    let description = `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`;
    let keywords: string[] | undefined = undefined;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) {
                title = masterArticle.metaTitle.replace(/\|\s*OnlyAlpha$/i, '') + ' — Alpha Report';
            }
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords && Array.isArray(masterArticle.seoKeywords)) {
                keywords = masterArticle.seoKeywords;
            }
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for alpha metadata:', e);
    }

    return {
        title: { absolute: title },
        description,
        keywords,
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${coin}/alpha`,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${coin}/alpha`,
        },
    };
}
```

### F.2: Add per-article JSON-LD structured data to `[coin]/page.tsx`

**File:** `frontend/src/app/terminal/[coin]/page.tsx`
**Action:** After the page fetches data, inject a JSON-LD `<script>` tag with `Article` schema.

Add a helper function in the file:
```typescript
function buildArticleJsonLd(symbol: string, masterArticle: MasterArticle | null): Record<string, unknown> {
    if (!masterArticle) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${symbol} Terminal — OnlyAlpha`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: masterArticle.metaTitle || `${symbol} Terminal — Live Analysis`,
        description: masterArticle.metaDescription || `AI-powered analysis for ${symbol}`,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        datePublished: masterArticle.createdAt,
        dateModified: masterArticle.updatedAt,
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
    };
}
```

Then in the page component, call `getMasterArticle` and inject the JSON-LD:
```typescript
import { MasterArticle } from '@/features/terminal/types';

export default async function CoinTerminalPage({ params, searchParams }: { ... }) {
    // ... existing fetches ...

    let masterArticle: MasterArticle | null = null;
    try {
        const resp = await terminalApi.getMasterArticle(coinSymbol);
        masterArticle = resp.masterArticle;
    } catch { /* silently fail, JSON-LD fallback handles it */ }

    const jsonLd = buildArticleJsonLd(coinSymbol, masterArticle);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <TerminalPageClient ... />
        </>
    );
}
```

**Note on duplicate API calls:** Both `generateMetadata` and the page component call `getMasterArticle` during SSG. Since `axios` (not native `fetch`) is used, Next.js cannot deduplicate. This results in 2 API calls per coin (60 total at build time). This is an acceptable trade-off — the SEO benefit of JSON-LD outweighs the minimal build overhead.

### F.3: Add per-article JSON-LD to `[coin]/alpha/page.tsx`

**File:** `frontend/src/app/terminal/[coin]/alpha/page.tsx`
**Action:** Same pattern as F.2 — add `buildArticleJsonLd()` helper and inject JSON-LD `<script>` in the page component.

For the alpha page, the `Article` schema should use the same `masterArticle` data (fetched in `generateMetadata`). In the page component, fetch it again for JSON-LD injection (same double-call trade-off accepted).

### F.4: (MERGED into E.3)

The `layout.tsx` JSON-LD logo fix (`/icon.svg` → `/icon`) is now handled as part of E.3 (Change 2). No separate task needed.

---

## Micro-Task Execution Order

| Order | Task ID | Track | Description | Files Modified |
|-------|---------|-------|-------------|----------------|
| 1 | E.1 | E | Delete `icon.svg` | `src/app/icon.svg` (DELETE) |
| 2 | E.2 | E | Modify `icon.tsx` (32×32) + create `apple-icon.tsx` (180×180) | `src/app/icon.tsx` (MODIFY), `src/app/apple-icon.tsx` (NEW) |
| 3 | E.3 | E | Update `layout.tsx` `icons` metadata + JSON-LD logo | `src/app/layout.tsx` |
| 4 | E.4 | E | Update `manifest.json` icon references | `public/manifest.json` |
| 5 | E.5 | E | Create `/favicon.ico` redirect route handler | `src/app/favicon.ico/route.ts` (NEW) |
| 6 | F.1 | F | Add dynamic `generateMetadata` to alpha page | `src/app/terminal/[coin]/alpha/page.tsx` |
| 7 | F.2 | F | Add JSON-LD to coin terminal page | `src/app/terminal/[coin]/page.tsx` |
| 8 | F.3 | F | Add JSON-LD to alpha page | `src/app/terminal/[coin]/alpha/page.tsx` |

---

## Architectural Rules for the Senior Developer

1. **Zero `any` types.** Use `Record<string, unknown>` for JSON-LD return type, `MasterArticle` from `@/features/terminal/types` for article types.
2. **Do NOT install new packages.**
3. **Do NOT modify routes, controllers, or cron files.**
4. **Do NOT modify `sitemap.ts` or `robots.ts`** — they are correct.
5. **Do NOT add dynamic OG images per coin** — that is a separate phase.
6. **Do NOT modify AI prompts** — that is a separate phase.
7. **Do NOT rename `icon.tsx` to `icon.png.tsx`** — Next.js requires the exact filename `icon.tsx`.
8. **Do NOT create `favicon.ico.tsx`** — use `favicon.ico/route.ts` instead (proper route handler convention).
9. **All icon URL references must use `/icon` and `/apple-icon`** (no `.png` extension — Next.js handles content type via the `contentType` export).
10. **All JSON-LD must be valid schema.org** — use `Article` type for coin pages, `WebPage` as fallback.
11. **Keep `generateMetadata` in `[coin]/page.tsx` unchanged** — it already works correctly.
12. **The `revalidate = 60` export must remain on both page files.**
13. **Run `npx tsc --noEmit` in `frontend/` after all changes** to verify zero TypeScript errors.

---

## Files Touched (Summary)

| File | Action |
|------|--------|
| `frontend/src/app/icon.svg` | DELETE |
| `frontend/src/app/icon.tsx` | MODIFY (144→32 size) |
| `frontend/src/app/apple-icon.tsx` | NEW |
| `frontend/src/app/favicon.ico/route.ts` | NEW |
| `frontend/src/app/layout.tsx` | EDIT (icons metadata + JSON-LD logo) |
| `frontend/public/manifest.json` | EDIT (icon references) |
| `frontend/src/app/terminal/[coin]/alpha/page.tsx` | EDIT (dynamic generateMetadata + JSON-LD) |
| `frontend/src/app/terminal/[coin]/page.tsx` | EDIT (JSON-LD injection) |

**Total: 4 edits, 3 new files, 1 delete. Zero new dependencies. Zero backend changes.**

---

## Supreme Reviewer Audit Response (v1 findings)

| Finding | Status | Resolution |
|---------|--------|------------|
| #1: Invalid `icon.png.tsx` / `apple-icon.png.tsx` filenames | FIXED | Using `icon.tsx` and `apple-icon.tsx` (exact Next.js reserved names) |
| #2: Invalid `favicon.ico.tsx` route handler | FIXED | Using `favicon.ico/route.ts` with proper `NextResponse.redirect()` |
| #3: Incorrect `/icon.png` and `/apple-icon.png` references | FIXED | All references use `/icon` and `/apple-icon` |
