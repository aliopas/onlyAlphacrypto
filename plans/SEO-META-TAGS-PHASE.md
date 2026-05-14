# OnlyAlpha — SEO & Meta Tags Remediation Phase

**Tech Lead Approval Document**
**Date:** May 13, 2026
**Status:** APPROVED
**Scope:** Frontend Only — 0 backend changes, 0 new dependencies
**Source:** Full platform SEO audit revealed critical gaps in meta tags, structured data, and OG images

---

## Context

Platform SEO audit revealed that while the Terminal coin pages (`/terminal/[coin]`, `/terminal/[coin]/alpha`) have near-complete SEO coverage, the majority of public-facing pages — including the **home page**, **airdrops**, **scorecard**, and **static pages** — have significant meta tag gaps. This directly impacts:

- Google rich results eligibility (missing JSON-LD on airdrops, scorecard)
- Social media link previews (missing `og:image` on 10+ pages)
- CTR from search results (home page has no page-specific title/description)
- Crawl efficiency (404 airdrop pages not marked `noindex`)
- Maintainability (`SITE_URL` hardcoded in 3 files instead of importing from constants)

---

## Guiding Principle

Every public page must have: unique title, unique description, canonical URL, OG tags (title, description, image, url, type), Twitter card tags, and appropriate JSON-LD structured data. No exceptions.

---

## Priority Tiers

### TIER 1 — Critical (Pages with highest traffic / SEO impact)

| ID | Task | Page(s) | Current State | Target State |
|---|---|---|---|---|
| SEO-1 | Home page metadata | `/` | Zero metadata export | Full metadata: title, description, og:*, twitter:*, canonical, JSON-LD `WebSite` + `SearchAction` |
| SEO-2 | Airdrop listing metadata | `/airdrops` | Has title/desc but missing og:image, keywords, JSON-LD | Add og:image, JSON-LD `ItemList`, keywords |
| SEO-3 | Airdrop detail structured data | `/airdrops/[id]` | Has basic meta, no JSON-LD, no og:image | Add JSON-LD `Product` or `Event`, dynamic og:image using project logo |
| SEO-4 | Airdrop 404 noindex | `/airdrops/[id]` | Returns generic title, no robots directive | Add `robots: { index: false, follow: false }` when project not found |
| SEO-5 | Scorecard structured data | `/scorecard` | Has basic meta, no JSON-LD, no og:image | Add JSON-LD `Dataset` or `WebPage`, og:image |
| SEO-6 | Terminal index metadata | `/terminal` | Zero metadata export | Full metadata: title, description, og:*, twitter:*, canonical |

### TIER 2 — Important (Static pages, missing OG/canonical)

| ID | Task | Page(s) | Current State | Target State |
|---|---|---|---|---|
| SEO-7 | About page OG + canonical + JSON-LD | `/about` | Title/desc only | Add og:*, twitter:*, canonical, JSON-LD `AboutPage` |
| SEO-8 | Static pages OG + canonical | `/terms`, `/privacy`, `/disclaimer`, `/contact` | Title/desc only | Add og:*, twitter:*, canonical |

### TIER 3 — Platform-wide infrastructure

| ID | Task | Scope | Current State | Target State |
|---|---|---|---|---|
| SEO-9 | Hardcoded SITE_URL cleanup | `airdrops/page.tsx`, `airdrops/[id]/page.tsx`, `scorecard/page.tsx` | 3 files hardcode `'https://onlyalphacrypto.com'` | Import from `@/lib/constants` |
| SEO-10 | `twitter:site` + `twitter:creator` | Root layout | Missing entirely | Add to root metadata |
| SEO-11 | Scorecard in sitemap | `sitemap.ts` | Missing | Add entry with priority 0.7, daily |
| SEO-12 | Alpha page OG image | `/terminal/[coin]/alpha` | Has JSON-LD but no dedicated OG image | Add `opengraph-image.tsx` or reuse coin OG image |
| SEO-13 | Home page in sitemap enhancement | `sitemap.ts` | Present but generic | Ensure priority 1.0 is accurate and changeFrequency is correct |

---

## Detailed Specifications

---

### SEO-1: Home Page Metadata (`/`)

**File:** `frontend/src/app/(standard)/page.tsx`

**Add `metadata` export:**
```typescript
export const metadata: Metadata = {
  title: 'OnlyAlpha — AI-Powered Crypto Intelligence | Real-Time Market Analysis',
  description: 'Track 11 top cryptocurrencies with AI-powered analysis, airdrop farming, on-chain intelligence, and real-time market signals. Free crypto intelligence platform.',
  keywords: ['crypto intelligence', 'AI crypto analysis', 'airdrop tracker', 'market signals', 'crypto analysis', 'OnlyAlpha'],
  openGraph: {
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking, and on-chain intelligence for crypto market participants.',
    url: SITE_URL,
    siteName: 'OnlyAlpha',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'OnlyAlpha — AI-Powered Crypto Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking, and on-chain intelligence for crypto market participants.',
    images: [`${SITE_URL}/opengraph-image.png`],
  },
  alternates: { canonical: SITE_URL },
};
```

**Add JSON-LD `WebSite` with `SearchAction`:**
```typescript
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'OnlyAlpha',
  url: SITE_URL,
  description: 'AI-Powered Crypto Intelligence Platform',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/terminal?coin={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'OnlyAlpha',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
  },
};
```

---

### SEO-2: Airdrop Listing (`/airdrops`)

**File:** `frontend/src/app/(standard)/airdrops/page.tsx`

**Add to existing metadata:**
- `keywords`: `['crypto airdrops', 'free airdrops', 'airdrop tracker', 'airdrop farm', 'OnlyAlpha airdrops']`
- `openGraph.images`: `[{ url: '${SITE_URL}/opengraph-image.png', width: 1200, height: 630 }]`

**Add JSON-LD `ItemList`:**
```typescript
const airdropListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Active Crypto Airdrops',
  description: 'Discover and track active crypto airdrops on OnlyAlpha',
  numberOfItems: dynamicCount,  // pass from component
  itemListElement: [],  // populated from API data if available client-side
};
```

**Note:** If the list is loaded client-side, the JSON-LD may need to be a static `CollectionPage` instead of dynamic `ItemList`. Strategic Planner decides.

---

### SEO-3: Airdrop Detail Structured Data (`/airdrops/[id]`)

**File:** `frontend/src/app/(standard)/airdrops/[id]/page.tsx`

**Add JSON-LD `Product` (or `Event`):**
```typescript
const airdropJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: project.name,
  description: project.description,
  image: project.logoUrl || project.imageUrl,
  brand: { '@type': 'Brand', name: project.name },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    description: `Free airdrop on ${project.network || 'multiple networks'}`,
  },
};
```

**Add OG image:** Use `project.logoUrl` or `project.imageUrl` as `og:image` if available. Fallback to root OG image.

---

### SEO-4: Airdrop 404 Noindex

**File:** `frontend/src/app/(standard)/airdrops/[id]/page.tsx`

**In `generateMetadata`, when project is null/not found:**
```typescript
if (!project) {
  return {
    title: 'Airdrop Not Found',
    robots: { index: false, follow: false },  // ADD THIS
  };
}
```

---

### SEO-5: Scorecard Structured Data (`/scorecard`)

**File:** `frontend/src/app/(standard)/scorecard/page.tsx`

**Add JSON-LD `WebPage`:**
```typescript
const scorecardJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Market Intelligence Scorecard',
  description: 'Real-time market intelligence scorecard tracking crypto market health, sentiment, and regime.',
  url: `${SITE_URL}/scorecard`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Scorecard', item: `${SITE_URL}/scorecard` },
    ],
  },
  publisher: {
    '@type': 'Organization',
    name: 'OnlyAlpha',
    url: SITE_URL,
  },
};
```

**Add `og:image`** and `keywords` to existing metadata.

---

### SEO-6: Terminal Index Metadata (`/terminal`)

**File:** `frontend/src/app/(terminal)/terminal/page.tsx`

**Add `metadata` export:**
```typescript
export const metadata: Metadata = {
  title: 'Terminal — Live Crypto Analysis Dashboard',
  description: 'Real-time AI-powered analysis dashboard for BTC, ETH, SOL, and 8 more cryptocurrencies. Live signals, market regime detection, and deep intelligence reports.',
  keywords: ['crypto terminal', 'live crypto analysis', 'crypto dashboard', 'BTC analysis', 'ETH analysis', 'OnlyAlpha terminal'],
  openGraph: {
    title: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha',
    description: 'Real-time AI-powered analysis dashboard for 11 top cryptocurrencies.',
    url: `${SITE_URL}/terminal`,
    siteName: 'OnlyAlpha',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha',
    description: 'Real-time AI-powered analysis dashboard for 11 top cryptocurrencies.',
    images: [`${SITE_URL}/opengraph-image.png`],
  },
  alternates: { canonical: `${SITE_URL}/terminal` },
};
```

---

### SEO-7: About Page (`/about`)

**File:** `frontend/src/app/(standard)/about/page.tsx`

**Expand existing metadata** to include: `openGraph.*`, `twitter.*`, `alternates.canonical`, JSON-LD `AboutPage`.

---

### SEO-8: Static Pages (`/terms`, `/privacy`, `/disclaimer`, `/contact`)

**Files:** Each respective `page.tsx`

**Expand existing metadata** to include: `openGraph.*`, `twitter.*`, `alternates.canonical`.

These pages are low SEO value but missing OG tags means broken social previews when shared.

---

### SEO-9: Hardcoded SITE_URL Cleanup

**Files:**
- `frontend/src/app/(standard)/airdrops/page.tsx` — remove local `const SITE_URL`, add `import { SITE_URL } from '@/lib/constants'`
- `frontend/src/app/(standard)/airdrops/[id]/page.tsx` — same
- `frontend/src/app/(standard)/scorecard/page.tsx` — same

---

### SEO-10: Platform-wide Twitter Attribution

**File:** `frontend/src/app/layout.tsx`

**Add to root metadata:**
```typescript
twitter: {
  ...existing,
  site: '@OnlyAlphaCrypto',   // or whatever the handle is
  creator: '@OnlyAlphaCrypto',
},
```

**Action Required:** Confirm actual Twitter/X handle before implementation.

---

### SEO-11: Scorecard in Sitemap

**File:** `frontend/src/app/sitemap.ts`

**Add entry:**
```typescript
{
  url: `${SITE_URL}/scorecard`,
  lastModified: new Date(),
  changeFrequency: 'daily',
  priority: 0.7,
},
```

---

### SEO-12: Alpha Page OG Image

**Option A (Preferred):** Create `frontend/src/app/(terminal)/terminal/[coin]/alpha/opengraph-image.tsx` — dynamic image with "Alpha Report" badge on coin OG image.

**Option B (Quick):** In alpha page `generateMetadata`, set `openGraph.images` to the parent coin's OG image path: `/terminal/${coin}/opengraph-image.png`.

---

### SEO-13: Home Page Sitemap Enhancement

Verify `/` entry in `sitemap.ts` has `priority: 1.0` and `changeFrequency: 'daily'`. Already present — just verify.

---

## Execution Order

```
SEO-9 (SITE_URL cleanup) → SEO-4 (404 noindex) → SEO-10 (twitter:site)
→ SEO-1 (home page) → SEO-6 (terminal index) → SEO-2 (airdrops listing)
→ SEO-3 (airdrop detail JSON-LD) → SEO-5 (scorecard) → SEO-7 (about)
→ SEO-8 (static pages) → SEO-11 (sitemap) → SEO-12 (alpha OG)
→ SEO-13 (sitemap verify)
```

**Rationale:**
- SEO-9 first: single-line import fix, unblocks consistent URL usage across all other tasks
- SEO-4 second: one-line fix, prevents index pollution
- SEO-10 third: root layout change, propagates to all pages
- SEO-1, SEO-6: highest traffic pages
- SEO-2, SEO-3: airdrops are a key acquisition channel
- SEO-5, SEO-7, SEO-8: remaining pages
- SEO-11, SEO-12, SEO-13: infrastructure polish

---

## Phase Exit Gate

- [ ] All 13 tasks deployed
- [ ] Zero TypeScript errors in all modified files
- [ ] Every public page has unique title + description (no duplicates)
- [ ] Every public page has canonical URL
- [ ] Every public page has og:title, og:description, og:image, og:url, og:type
- [ ] Every public page has twitter:card, twitter:title, twitter:description
- [ ] Home page has `WebSite` + `SearchAction` JSON-LD
- [ ] Airdrop detail has `Product` JSON-LD
- [ ] Airdrop 404 returns `noindex, nofollow`
- [ ] Scorecard has JSON-LD + is in sitemap
- [ ] `SITE_URL` imported from constants in all files (zero hardcoded URLs)
- [ ] `twitter:site` set in root layout
- [ ] Lighthouse SEO score >= 95 on home, airdrops listing, and terminal index

---

## Tech Lead Guardrails

- Frontend-only changes — zero backend modifications
- Zero new npm packages
- Zero new files except optional `opengraph-image.tsx` for alpha page (SEO-12)
- All changes are additive — no existing metadata removed or replaced
- `SITE_URL` must come from `@/lib/constants` — zero hardcoded domain strings
- JSON-LD must use `https://schema.org` context
- All OG images must specify width (1200) and height (630)
- Confirm Twitter/X handle with team before implementing SEO-10
- Static pages (`/terms`, `/privacy`, `/disclaimer`) do NOT need JSON-LD
- `/auth`, `/settings`, `/admin` are excluded (blocked by robots.txt)

---

## Files Modified (Summary)

| File | Tasks | Risk |
|---|---|---|
| `(standard)/page.tsx` | SEO-1 | LOW — adding metadata export |
| `(standard)/airdrops/page.tsx` | SEO-2, SEO-9 | LOW — extending metadata |
| `(standard)/airdrops/[id]/page.tsx` | SEO-3, SEO-4, SEO-9 | LOW — extending + 404 fix |
| `(standard)/scorecard/page.tsx` | SEO-5, SEO-9 | LOW — extending metadata |
| `(standard)/about/page.tsx` | SEO-7 | LOW — extending metadata |
| `(standard)/terms/page.tsx` | SEO-8 | LOW — extending metadata |
| `(standard)/privacy/page.tsx` | SEO-8 | LOW — extending metadata |
| `(standard)/disclaimer/page.tsx` | SEO-8 | LOW — extending metadata |
| `(standard)/contact/page.tsx` | SEO-8 | LOW — extending metadata |
| `(terminal)/terminal/page.tsx` | SEO-6 | LOW — adding metadata export |
| `(terminal)/terminal/[coin]/alpha/page.tsx` | SEO-12 | LOW — adding og:image ref |
| `app/layout.tsx` | SEO-10 | LOW — adding twitter fields |
| `app/sitemap.ts` | SEO-11 | LOW — adding entry |

**New Files (optional):**

| File | Task | Notes |
|---|---|---|
| `terminal/[coin]/alpha/opengraph-image.tsx` | SEO-12 | Only if Option A chosen |

---

## Decisions Issued

- DEC-027: SEO & Meta Tags Remediation Phase — 13 tasks across 13+ files
