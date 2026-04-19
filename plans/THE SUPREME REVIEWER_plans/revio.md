# OnlyAlpha Platform — Complete Technical Audit & Knowledge Base

> **Last Verified:** April 2026  
> **Auditor:** Lead Architect  
> **Status:** VERIFIED — All findings confirmed against source code

---

## Table of Contents
1. [SEO & Google Indexing Audit (Verified)](#1-seo--google-indexing-audit-verified)
2. [Backend Article Processing Issues](#2-backend-article-processing-issues)
3. [Known Bugs](#3-known-bugs)
4. [Architecture Reference](#4-architecture-reference)
5. [Action Plan & Priorities](#5-action-plan--priorities)

---

## 1. SEO & Google Indexing Audit (Verified)

### 1.1 Executive Summary

Googlebot has discovered OnlyAlpha and parsed the sitemap, but AI-generated articles are not appearing correctly in search results. Metadata appears stuck on default values for some indexed pages. This section documents the **verified** root causes after full source code analysis.

**Important Correction:** A previous audit claimed that `/terminal/[coin]/alpha` routes are invalid 404 pages. This is **FALSE**. The file `frontend/src/app/terminal/[coin]/alpha/page.tsx` exists and is fully functional. The sitemap is NOT contaminated with dead links.

---

### 1.2 Finding A: Google Indexing 404 Pages Instead of Articles (CONFIRMED)

**Symptom:**
- A Google search for `site:onlyalphacrypto.com` reveals indexed links like `onlyalphacrypto.com/BTC`
- These pages show the default metadata: *"OnlyAlpha — AI-Powered Crypto Intelligence"*
- AI-generated meta descriptions are missing

**Root Cause:**
The Next.js App Router terminal article route is at:
```
src/app/terminal/[coin]/page.tsx  →  maps to /terminal/BTC
```

The path `/BTC` does NOT exist in the routing tree. Google discovered these direct `/[coin]` paths (through external links, social sharing, or history) and crawled them. Since the pages don't exist:
1. Next.js serves a `404 Not Found` page
2. The 404 page inherits default metadata from `layout.tsx`
3. Google indexes a dead page with default tags, bypassing the actual AI article

**Evidence:**
- `next.config.ts` has NO `redirects()` function — zero redirects configured
- No `middleware.ts` exists in `frontend/src/` to handle routing
- No `not-found.tsx` custom 404 page exists
- No root-level dynamic route `[coin]` exists under `app/`

**Files Involved:**
- `frontend/next.config.ts` — missing `redirects()` function
- `frontend/src/app/layout.tsx` — default metadata source
- No `frontend/src/app/not-found.tsx` — no custom 404

---

### 1.3 Finding B: Sitemap Status — CLEAN (Previous Audit Was Wrong)

**Previous Claim:**
> "The sitemap generates `/terminal/[coin]/alpha` URLs which are invalid 404 pages, contaminating 50% of submitted URLs."

**VERIFIED REALITY:**
The route `frontend/src/app/terminal/[coin]/alpha/page.tsx` **EXISTS and is fully functional** with:
- Its own `generateMetadata()` with dynamic SEO tags
- Its own `generateStaticParams()` for all 30 coins
- Its own JSON-LD structured data
- Renders the `<LivingArticle>` component

**Full directory structure confirmed:**
```
frontend/src/app/terminal/
├── [coin]/
│   ├── alpha/
│   │   └── page.tsx    ← EXISTS, FULLY WORKING
│   └── page.tsx        ← EXISTS, FULLY WORKING
└── page.tsx
```

**Sitemap URL breakdown (`frontend/src/app/sitemap.ts`):**
- 3 static pages (home, /terminal, /airdrops)
- 30 coin terminal pages: `/terminal/{coin}` (priority 0.7, hourly)
- 30 alpha pages: `/terminal/{coin}/alpha` (priority 0.8, daily)
- + dynamic airdrop pages
- **Total: ~63+ URLs — ALL valid**

**Conclusion:** Do NOT remove `/alpha` URLs from the sitemap. They are legitimate, working pages.

---

### 1.4 Finding C: Dynamic Meta Tags — Code is Working (CONFIRMED)

**Status:** The `generateMetadata()` logic in `frontend/src/app/terminal/[coin]/page.tsx` is structurally sound.

**How it works:**
1. Reads the `coin` param from URL
2. Calls `terminalApi.getMasterArticle(symbol)` to fetch the article
3. Extracts `masterArticle.metaTitle`, `metaDescription`, `seoKeywords`
4. Uses `title: { absolute: title }` to prevent Next.js template suffix duplication
5. Sets OpenGraph, Twitter, canonical URL, and keywords

**Code excerpt (verified):**
```typescript
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    let title = `${symbol} Terminal — Live Analysis & Intelligence`;
    let description = `Real-time AI-powered analysis, news, and intelligence for ${symbol}...`;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) title = masterArticle.metaTitle;
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords) keywords = masterArticle.seoKeywords;
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for metadata:', e);
    }

    return {
        title: { absolute: title },
        description,
        keywords,
        openGraph: { title, description, url: `${SITE_URL}/terminal/${coin}`, type: 'website' },
        twitter: { card: 'summary_large_image', title, description },
        alternates: { canonical: `${SITE_URL}/terminal/${coin}` },
    };
}
```

**Why Google isn't showing it:** Google hasn't prioritized indexing the correct `/terminal/btc` URLs because it's stuck on the 404 errors from Finding A and potentially confused by the dead SearchAction schema (Finding D).

**ISR Configuration:**
- `revalidate = 60` (60-second revalidation)
- `generateStaticParams()` pre-renders all 30 coins at build time

---

### 1.5 Finding D: Dead SearchAction Schema (NEW — NOT IN PREVIOUS AUDIT)

**Symptom:** Google Search Console may show errors related to structured data.

**Root Cause:** `frontend/src/app/layout.tsx` contains this JSON-LD in `<head>`:
```json
{
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "OnlyAlpha",
    "url": "https://onlyalphacrypto.com",
    "potentialAction": {
        "@type": "SearchAction",
        "target": "https://onlyalphacrypto.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
    }
}
```

But **no `/search` route exists anywhere** in the application. This tells Google the site supports sitelinks search, but the URL returns 404. This is a **negative trust signal** for Google's quality algorithms.

**Evidence:** Full directory scan of `frontend/src/app/` confirms no `search/` directory or `search/page.tsx` exists.

**Fix:** Either remove the `SearchAction` schema entirely, or build a `/search` page.

---

### 1.6 Finding E: Static OG Image for All Pages (NEW)

**Root Cause:** `frontend/src/app/opengraph-image.tsx` generates a single static branding image:
- Dark background with "OAc" logo, "OnlyAlpha" title, and generic subtitle
- Size: 1200x630 (correct)
- Runtime: edge
- **No dynamic parameters** — every page shares the same image

**Impact:** When someone shares `onlyalphacrypto.com/terminal/btc` on Twitter/LinkedIn/Telegram, the preview image is just the generic OnlyAlpha logo — no coin name, no article headline. This significantly reduces click-through rates from social sharing.

**Note:** `frontend/public/opengraph-image.png` does NOT exist (not needed since the tsx file handles it dynamically).

**Fix:** Create per-coin dynamic OG images at `frontend/src/app/terminal/[coin]/opengraph-image.tsx` that render the coin symbol and article headline.

---

### 1.7 Finding F: robots.ts Configuration (VERIFIED — CLEAN)

**File:** `frontend/src/app/robots.ts`

**Configuration:**
```typescript
rules: [
    { userAgent: '*', allow: '/', disallow: ['/auth', '/settings', '/api'] },
    { userAgent: 'GPTBot', disallow: '/' },
    { userAgent: 'ChatGPT-User', disallow: '/' },
    { userAgent: 'CCBot', disallow: '/' },
],
sitemap: 'https://onlyalphacrypto.com/sitemap.xml',
```

**Status:** This is correct. No issues found.

---

### 1.8 Complete Metadata Chain — Full File Reference

**Root Layout (`frontend/src/app/layout.tsx`):**
- `metadataBase`: `https://onlyalphacrypto.com`
- Title template: `'%s | OnlyAlpha'` (child pages using `absolute` bypass this)
- Default title: `'OnlyAlpha — AI-Powered Crypto Intelligence'`
- Default description: `'Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders.'`
- Full robots config: index=true, follow=true
- Two JSON-LD schemas: Organization + WebSite (with dead SearchAction)
- Google Analytics: `G-VWQNMXJ2JK`

**Terminal Page (`frontend/src/app/terminal/[coin]/page.tsx`):**
- 142 lines, full `generateMetadata()` with API fetch
- `generateStaticParams()` for 30 coins
- JSON-LD Article schema with dynamic data
- Uses `title: { absolute: title }` to avoid template duplication
- ISR: `revalidate = 60`
- Renders: `<TerminalPageClient>` with news, radarSignals, radarId, isAlphaFocus

**Alpha Page (`frontend/src/app/terminal/[coin]/alpha/page.tsx`):**
- 120 lines, full `generateMetadata()` with API fetch
- Strips " | OnlyAlpha" from title and appends " — Alpha Report"
- JSON-LD Article schema
- OpenGraph type: `'article'` (vs 'website' on terminal)
- Renders: `<LivingArticle>` component

**Sitemap (`frontend/src/app/sitemap.ts`):**
- 73 lines
- COINS array: 30 coins (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, ATOM, NEAR, APT, ARB, OP, SUI, SEI, TIA, JUP, WIF, PEPE, FLOKI, INJ, FTM, RENDER, AAVE, MKR, SNX)
- Static pages: home (priority 1), /terminal (0.9), /airdrops (0.8)
- Coin pages: /terminal/{coin} (0.7), /terminal/{coin}/alpha (0.8)
- Dynamic airdrop pages from API

**Next.js Config (`frontend/next.config.ts`):**
- Security headers only (X-Content-Type-Options, X-Frame-Options, etc.)
- Image remote patterns: coingecko only
- **NO `redirects()` — this is a gap**

---

## 2. Backend Article Processing Issues

### 2.1 Issue: Article Re-Processing (Same Article Appearing Multiple Times)

**Root Cause:**
The AI Workflow runs every hour and queries `rawNewsBuffer` for items with `relevanceScore >= threshold` and `processed = true`. The problem:

1. **`processed = true` means "triaged" not "consumed"** — The Triage Engine sets `processed = true` after scoring, but the AI Workflow never marks items as "consumed" after successfully publishing.
2. **Buffer items persist for 24+ hours** — The `bufferCleanup` cron only runs daily at midnight and only deletes items where `ttlExpiresAt < NOW()`.
3. **Duplicate detection catches exact re-posts** but the same buffered item keeps being selected every hourly cycle because it remains in the buffer with a high relevance score.
4. **Embedding similarity = 1.000** means the duplicate detection IS working, but the workflow still wastes cycles querying, computing embeddings, and logging it every hour.

**Log Evidence:**
```
[AI Workflow] Processing: BTC (MAJOR) — "US Government Moves Bitcoin Tied to $9 Billion Bitfinex Hack..."
[Similarity] Semantic duplicate found: id=29, similarity=1.000
[AI Workflow] Skipping duplicate: BTC
```
The same 5 items appear 10+ times in logs.

**Fix:** After the AI Workflow successfully processes (publishes or skips as duplicate) a `rawNewsBuffer` item, mark it as consumed so it's not re-selected in the next cycle. Options:
- Add a `consumed` boolean column to `rawNewsBuffer`
- Add a `consumed_at` timestamp column
- Set `relevanceScore` below threshold after consumption
- **Recommended:** `consumed_at` timestamp + exclude from query

**File to modify:** `backend/src/crons/aiWorkflow.cron.ts`

---

### 2.2 Issue: metaDescription Validation Failures (>160 chars)

**Root Cause:**
The `Stage2ASchema` requires `metaDescription.max(160)`, but the AI model often generates descriptions exceeding 160 characters:
```
[Stage2A] Schema validation failed (attempt 1): Too big: expected string to have <=160 characters
```
After 3 retries:
```
[AI Workflow] Failed for BTC: AI response truncated (finish_reason=length) for model "openai/gpt-5-nano"
```

**Fix:** Add a **truncation safety net** — after parsing JSON but before Zod validation, truncate:
- `metaDescription` to 160 characters
- `metaTitle` to 60 characters

**File to modify:** `backend/src/services/openai.service.ts`

---

### 2.3 Issue: Poor/Generic Meta Tags on Existing Articles

**Root Cause:**
1. Many articles have poor/generic meta tags — The fallback builder generates `"BTC Analysis | OnlyAlpha"` as metaTitle (too short) and generic descriptions
2. Some articles have null meta tags — `callGptNanoMasterUpdate` doesn't always populate them
3. Google caching — Even if fixed now, Google may show old descriptions until re-crawled

**Fix:** Create a repair script that:
1. Scans all `coinMasterArticles` for missing/poor meta tags
2. Regenerates proper SEO meta tags using AI
3. Updates the database

**File to create:** `backend/src/scripts/repair-meta-tags.ts`

---

## 3. Known Bugs

### 3.1 LivingArticle Empty State — Template Literal Bug

**File:** `frontend/src/features/terminal/components/LivingArticle.tsx`, Line 56

**Bug:** Plain string instead of template literal:
```tsx
// BUG: renders literal "${symbol}" as text, not the actual symbol value
"No living article found for ${symbol}"
```

**Fix:**
```tsx
`No living article found for ${symbol}`
```

**Impact:** When no article exists for a coin, the user sees the literal text `${symbol}` instead of the coin name (e.g., "BTC").

---

### 3.2 No Custom 404 Page

**File:** Missing — `frontend/src/app/not-found.tsx` does not exist.

**Impact:** When Google or users hit an invalid URL, they see Next.js's default 404 page which inherits root layout metadata. Google may index these 404 pages with default metadata.

**Fix:** Create `frontend/src/app/not-found.tsx` with:
- Custom UI matching the platform design
- `<meta name="robots" content="noindex, nofollow">` to prevent Google from indexing error pages

---

## 4. Architecture Reference

### 4.1 Frontend Route Map (Verified)

```
frontend/src/app/
├── page.tsx                           → / (Home)
├── layout.tsx                         → Root Layout (metadata, GA, sidebar, ticker)
├── globals.css                        → Global styles
├── robots.ts                          → Robots.txt config
├── sitemap.ts                         → Dynamic sitemap generator
├── opengraph-image.tsx                → Static OG image (edge runtime)
├── icon.tsx                           → Dynamic favicon
├── apple-icon.tsx                     → Apple touch icon
├── apple-icon.svg                     → Apple icon SVG
├── favicon.ico/
│   └── route.ts                       → Favicon route handler
│
├── terminal/
│   ├── page.tsx                       → /terminal (Terminal hub)
│   └── [coin]/
│       ├── page.tsx                   → /terminal/{coin} (Coin terminal — MAIN ARTICLE)
│       └── alpha/
│           └── page.tsx               → /terminal/{coin}/alpha (Living article)
│
├── airdrops/
│   ├── page.tsx                       → /airdrops (Airdrop listing)
│   └── [id]/
│       └── page.tsx                   → /airdrops/{id} (Airdrop detail)
│
├── auth/
│   └── page.tsx                       → /auth (Authentication)
│
└── settings/
    └── page.tsx                       → /settings (User settings)
```

**Non-existent routes referenced in code:**
- `/search` — Referenced by SearchAction JSON-LD in layout.tsx, but NO route exists

---

### 4.2 SEO Data Flow

```
User visits /terminal/btc
        │
        ▼
Next.js matches route: terminal/[coin]/page.tsx
        │
        ▼
generateMetadata() fires:
  ├── terminalApi.getMasterArticle("BTC")
  ├── Backend returns { masterArticle: { metaTitle, metaDescription, seoKeywords, ... } }
  ├── If API fails → fallback to generic: "BTC Terminal — Live Analysis & Intelligence"
  └── Returns Metadata object with absolute title, OG, Twitter, canonical
        │
        ▼
Page component fires:
  ├── terminalApi.getLatestWire() → news
  ├── homeApi.getRadarSignals() → radar signals
  ├── terminalApi.getMasterArticle("BTC") → JSON-LD data
  └── Renders <TerminalPageClient> with all data
        │
        ▼
Googlebot receives:
  ├── <title>{metaTitle}</title>
  ├── <meta name="description" content="{metaDescription}">
  ├── <meta property="og:title" content="{metaTitle}">
  ├── <meta property="og:description" content="{metaDescription}">
  ├── <meta name="twitter:card" content="summary_large_image">
  ├── <link rel="canonical" href="https://onlyalphacrypto.com/terminal/btc">
  ├── <script type="application/ld+json">{Article schema}</script>
  └── Full HTML content of the article
```

---

### 4.3 Key Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| `frontend/src/app/layout.tsx` | Root metadata, GA, JSON-LD | ✅ Working |
| `frontend/src/app/robots.ts` | Robots.txt generation | ✅ Clean |
| `frontend/src/app/sitemap.ts` | Dynamic sitemap | ✅ Clean (all URLs valid) |
| `frontend/next.config.ts` | Next.js config | ⚠️ Missing redirects |
| `frontend/src/app/not-found.tsx` | Custom 404 | ❌ Missing |
| `frontend/src/app/opengraph-image.tsx` | OG image | ⚠️ Static only |

---

### 4.4 COINS Array (Shared Across Files)

```typescript
const COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
    'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
    'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
];
```
This array is duplicated in: `sitemap.ts`, `terminal/[coin]/page.tsx`, `terminal/[coin]/alpha/page.tsx`.

---

## 5. Action Plan & Priorities

### P0 — Critical (Blocking Google Indexing)

| # | Action | File | Details |
|---|--------|------|---------|
| 1 | Add 301 redirects | `frontend/next.config.ts` | Redirect `/[coin]` → `/terminal/[coin]` for all 30 coins. Use `redirects()` function. Permanent (301). |
| 2 | Create custom 404 | `frontend/src/app/not-found.tsx` | Custom UI + `<meta name="robots" content="noindex, nofollow">` |
| 3 | Fix SearchAction schema | `frontend/src/app/layout.tsx` | Remove `SearchAction` JSON-LD or build `/search` page |

### P1 — High (Backend Data Quality)

| # | Action | File | Details |
|---|--------|------|---------|
| 4 | Stop article re-processing | `backend/src/crons/aiWorkflow.cron.ts` | Add `consumed_at` tracking to rawNewsBuffer items |
| 5 | Truncate metaDescription | `backend/src/services/openai.service.ts` | Safety net: truncate to 160 chars before Zod validation |
| 6 | Repair existing meta tags | `backend/src/scripts/repair-meta-tags.ts` | New script to scan and regenerate poor/null meta tags |

### P2 — Medium (UX & Enhancement)

| # | Action | File | Details |
|---|--------|------|---------|
| 7 | Fix template literal bug | `frontend/src/features/terminal/components/LivingArticle.tsx` | Line 56: change `"${symbol}"` to `` `${symbol}` `` |
| 8 | Dynamic OG images per coin | `frontend/src/app/terminal/[coin]/opengraph-image.tsx` | New file: per-coin OG image with symbol + headline |

### P3 — Post-Deployment (Google Search Console)

| # | Action | Platform | Details |
|---|--------|----------|---------|
| 9 | Resubmit sitemap | Google Search Console | After deploying fixes, resubmit sitemap.xml |
| 10 | Request re-indexing | Google Search Console | Use URL Inspection Tool for `/terminal/btc` and other key routes |
| 11 | Monitor crawl stats | Google Search Console | Watch for 404 reduction and indexing improvement |

---

## 6. Implementation Snippets

### 6.1 next.config.ts — Adding Redirects

```typescript
// Add this to next.config.ts
async redirects() {
    const COINS = [
        'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
        'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
        'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
        'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
    ];

    return COINS.map((coin) => ({
        source: `/${coin.toLowerCase()}`,
        destination: `/terminal/${coin.toLowerCase()}`,
        permanent: true, // 301
    }));
},
```

### 6.2 not-found.tsx — Custom 404

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Page Not Found',
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <h1 className="text-4xl font-bold text-white">404</h1>
            <p className="text-gray-400">The page you&apos;re looking for doesn&apos;t exist.</p>
            <a href="/" className="text-emerald-500 hover:underline">Go Home</a>
        </div>
    );
}
```

### 6.3 layout.tsx — Remove SearchAction

```typescript
// REMOVE this entire JSON-LD block from layout.tsx <head>:
{
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OnlyAlpha',
    url: SITE_URL,
    potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
    },
}

// Keep ONLY the Organization JSON-LD.
```

---

## 7. Verification Checklist

After implementation, verify each fix:

- [ ] Visit `onlyalphacrypto.com/btc` → should 301 redirect to `/terminal/btc`
- [ ] Visit `onlyalphacrypto.com/nonexistent` → should show custom 404 with noindex
- [ ] View page source of `/terminal/btc` → should show dynamic `<title>` and `<meta description>`
- [ ] View page source → SearchAction JSON-LD should be removed
- [ ] Run `curl -s https://onlyalphacrypto.com/sitemap.xml | grep -c "alpha"` → should return 30
- [ ] All 63+ sitemap URLs should return HTTP 200
- [ ] Google Search Console → resubmit sitemap
- [ ] Google Search Console → URL Inspection for `/terminal/btc`
- [ ] Check LivingArticle empty state → should show coin symbol, not `${symbol}`

---

**END OF DOCUMENT**
