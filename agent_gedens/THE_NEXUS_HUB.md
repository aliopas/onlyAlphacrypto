# THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## Active Phase: Phase 19 — AdSense Legal Pages + Footer (P0)

**Priority:** P0 — Hard blocker for Google AdSense approval
**Total Tasks:** 9 (T-01 through T-09), single deploy
**Execution Order:** T-01 (Footer) → T-02 (Layout) → T-03→T-07 (Pages, parallel OK) → T-08 (Sitemap) → T-09 (Verify)
**Executor:** Senior Developer
**Scope:** 5 new pages, 1 new component, 3 modified files, 0 backend changes, 0 new npm packages
**Prerequisites:** None — frontend-only, no backend dependency

---

### 1. Planning Stage (Planner)

**Target:** Create 5 mandatory legal pages and a site-wide footer to meet Google AdSense requirements for a crypto/financial platform. All 5 URLs currently return 404. The site has no footer component. Both are hard blockers for AdSense.

**What Needs Doing:**
- T-01: Create `<Footer />` shared component with legal links + copyright
- T-02: Integrate Footer into `layout.tsx` inside `<main>`
- T-03: Create `/privacy` page — Privacy Policy
- T-04: Create `/terms` page — Terms of Service
- T-05: Create `/about` page — About Us
- T-06: Create `/contact` page — Contact Us
- T-07: Create `/disclaimer` page — Financial Disclaimer
- T-08: Add all 5 legal pages to `sitemap.ts`
- T-09: Verify SEO metadata + robots.txt allows legal pages
- T-10: Create Cookie Consent Banner (GDPR/CCPA) component — `CookieBanner.tsx`
- T-11: Integrate CookieBanner + conditional AdSense Script into `layout.tsx`
- T-12: Add prominent NFA Warning to Terminal article page + enhance Scorecard disclaimer

**Key Constraints (Tech Lead Guardrails):**
1. **ZERO `any` types** across all new/modified code
2. **ZERO backend changes** — frontend-only static pages
3. **ZERO new npm packages**
4. All pages are **Server Components** (no `'use client'`)
5. All pages MUST export `metadata` with title + description
6. Design MUST match OnlyAlpha dark theme: `bg-black`, `bg-[#0A0A0A]`, `border-[#222]`, `text-white`, `text-[#888]`, `text-[#555]`
7. Footer goes INSIDE `<main>` below `<ErrorBoundary>` — NOT outside it
8. Legal page content MUST be real, substantive text — NO placeholder text
9. Footer: copyright + links to all 5 legal pages
10. DO NOT modify Sidebar or any existing page
11. Contact page: real contact method (email: contact@onlyalphacrypto.com)
12. Disclaimer: cover AI content, NFA, risk, no liability
13. Privacy: data collection, cookies, GA, third-party APIs, user rights
14. Terms: usage, IP, limitations, governing law
15. About: mission, platform description, team

**Verified References:**
- Layout: `frontend/src/app/layout.tsx:74-122` — Footer goes inside `<main>` at line ~117, AFTER `<ErrorBoundary>`
- Sitemap: `frontend/src/app/sitemap.ts:7-32` — `STATIC_PAGES` array, add 5 entries
- Robots: `frontend/src/app/robots.ts` — already allows `/` glob, no change needed
- Constants: `frontend/src/lib/constants.ts:1` — `SITE_URL = 'https://onlyalphacrypto.com'`
- Design system: `bg-black`, `bg-[#0A0A0A]`, `bg-[#111]`, `border-[#222]`, `--color-primary`

**Status:** PLANNING COMPLETE — READY FOR EXECUTION

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** T-01 → T-02 → T-03 | T-04 | T-05 | T-06 | T-07 (parallel OK) → T-08 → T-09

---

#### T-01: Create Footer Component
**File (CREATE):** `frontend/src/features/shared/components/Footer.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** A minimal, dark-themed footer with copyright and links to all 5 legal pages. Server component (no `'use client'`).

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│  © 2026 OnlyAlpha. All rights reserved.             │
│  Privacy · Terms · Disclaimer · About · Contact    │
└─────────────────────────────────────────────────────┘
```

**Design spec:**
- Container: `w-full border-t border-[#222] bg-black py-6 mt-auto`
- Inner wrapper: `max-w-4xl mx-auto px-4 text-center`
- Copyright: `text-[#555] text-xs font-mono`
- Links: `text-[#555] hover:text-[var(--color-primary)] text-xs font-mono transition-colors`
- Separator between links: `text-[#333]` (dot `·`)
- Use Next.js `<Link>` component for internal links
- Link order: Privacy · Terms · Disclaimer · About · Contact

**Links:**
- `/privacy` — "Privacy Policy"
- `/terms` — "Terms of Service"
- `/disclaimer` — "Disclaimer"
- `/about` — "About"
- `/contact` — "Contact"

**Verification Checklist:**
- Server component (no `'use client'`)
- 5 links using Next.js `<Link>`
- Copyright with current year (`© ${new Date().getFullYear()} OnlyAlpha`)
- Matches dark theme tokens
- Zero `any` types
- Responsive (text stacks on mobile if needed)

---

#### T-02: Integrate Footer into Layout
**File (MODIFY):** `frontend/src/app/layout.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** Import and render `<Footer />` inside `<main>`, below the `<ErrorBoundary>` block.

**Sub-task 2A: Add import (after line 7)**

**BEFORE (line 7):**
```typescript
import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
```

**AFTER:**
```typescript
import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
import { Footer } from '@/features/shared/components/Footer';
```

**Sub-task 2B: Add Footer inside `<main>` (after line 117, after ErrorBoundary closing div)**

**BEFORE (lines 115-118):**
```typescript
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
```

**AFTER:**
```typescript
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
          <Footer />
```

**IMPORTANT:** `<Footer />` goes AFTER the scrollable content div but INSIDE `<main>`. The Footer should be visible at the bottom of the viewport, not inside the scrollable area. If the Footer needs to be inside the scroll area for this layout to work, place it as the LAST element inside the `<div className="flex-1 overflow-y-auto">` wrapper.

**Verification Checklist:**
- `Footer` imported from shared components
- Footer renders on ALL pages
- Layout structure preserved (sidebar + main + ticker bar)
- No `'use client'` added to layout (it's already a server component)
- `tsc --noEmit` clean
- Zero `any` types

---

#### T-03: Create Privacy Policy Page
**File (CREATE):** `frontend/src/app/privacy/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** A comprehensive Privacy Policy page for a crypto AI analytics platform that uses Google Analytics, third-party APIs (Binance, Moralis), and collects no user accounts (yet).

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'OnlyAlpha Privacy Policy — how we collect, use, and protect your data.',
};
```

**Content sections (MUST cover all):**

1. **Introduction** — Who we are (OnlyAlpha), what this policy covers, last updated date (April 2026)
2. **Information We Collect**
   - Automatically collected: browser type, device info, IP address, pages visited, time spent
   - Analytics data: via Google Analytics (GA4) — anonymized where possible
   - We do NOT currently collect: names, emails, or personal identifiers (no user accounts yet)
3. **How We Use Information** — Site analytics, improve service, AI model optimization
4. **Cookies & Tracking**
   - Google Analytics cookies (_ga, _ga_*), purpose, retention (2 years)
   - No advertising cookies currently
   - How to disable cookies (browser settings)
5. **Third-Party Services**
   - Google Analytics — data processing per Google's privacy policy
   - Binance API — public market data
   - Moralis — blockchain data
   - OpenRouter / AI providers — no personal data sent
6. **AI-Generated Content** — Content is AI-generated, no personal data used in generation
7. **Data Security** — SSL/HTTPS, no storage of personal data, industry-standard practices
8. **Your Rights** — Right to access, correct, delete data (even though we collect minimal data). Contact email for requests.
9. **Children's Privacy** — Not intended for under 18, no knowingly collected data from minors
10. **Changes to This Policy** — We may update, last updated date at top
11. **Contact** — contact@onlyalphacrypto.com

**Design spec:**
- Page wrapper: `max-w-3xl mx-auto py-8`
- Section headings: `text-lg font-semibold text-white mb-3 mt-8`
- Body text: `text-sm text-[#888] leading-relaxed`
- Lists: `list-disc list-inside text-sm text-[#888] space-y-1`
- Page title (H1): `text-2xl font-bold text-white mb-2`
- Subtitle: `text-sm text-[#555] mb-8`
- Back link at top: `<Link href="/" className="text-[#555] hover:text-[var(--color-primary)] text-sm font-mono">← Back to Home</Link>`

**Verification Checklist:**
- Server component
- `metadata` export with title + description
- All 11 sections present with real text
- `text-[#888]` for body, `text-white` for headings
- Zero `any` types
- Responsive

---

#### T-04: Create Terms of Service Page
**File (CREATE):** `frontend/src/app/terms/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** Comprehensive Terms of Service for a crypto AI intelligence platform.

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'OnlyAlpha Terms of Service — rules and guidelines for using our platform.',
};
```

**Content sections (MUST cover all):**

1. **Acceptance of Terms** — By using OnlyAlpha, you agree to these terms. If you disagree, do not use the platform.
2. **Description of Service** — OnlyAlpha is an AI-powered crypto intelligence platform providing market analysis, signal detection, airdrop tracking, and on-chain insights. All content is AI-generated.
3. **Not Financial Advice** — CRITICAL SECTION. Content is for informational purposes only. Not investment advice. Not a registered financial advisor. Not a broker-dealer. Always DYOR. Consult a licensed professional.
4. **User Conduct** — No scraping, no reverse engineering, no redistribution of content, no using the platform for illegal activities.
5. **Intellectual Property** — All content, design, and code belong to OnlyAlpha. No license to reproduce or distribute.
6. **AI-Generated Content Disclaimer** — Signals, analysis, and articles are generated by AI models. May contain errors, inaccuracies, or outdated information. No guarantee of accuracy.
7. **Limitation of Liability** — OnlyAlpha is NOT liable for: financial losses, trading decisions, inaccurate signals, downtime, data loss. Use at your own risk.
8. **Third-Party Links** — We may link to external sites. Not responsible for their content or practices.
9. **Availability** — Service provided "as is". No guarantee of uptime. May modify or discontinue at any time.
10. **Changes to Terms** — We may update these terms. Continued use = acceptance of changes.
11. **Governing Law** — These terms are governed by applicable laws. (Leave jurisdiction generic if unknown — do NOT fabricate a specific jurisdiction.)
12. **Contact** — contact@onlyalphacrypto.com for questions about these terms.

**Design spec:** Same as T-03 (Privacy page design tokens).

**Verification Checklist:**
- Server component
- `metadata` export
- All 12 sections with real text
- "Not Financial Advice" section is prominent (could use `border-l-2 border-[var(--color-primary)] pl-4` callout)
- Zero `any` types

---

#### T-05: Create About Us Page
**File (CREATE):** `frontend/src/app/about/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** An About page that explains what OnlyAlpha is, its mission, and what the platform does. This is what Google AdSense reviewers read to understand who runs the site.

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'About OnlyAlpha',
  description: 'Learn about OnlyAlpha — AI-powered crypto intelligence for traders and investors.',
};
```

**Content sections:**

1. **Hero / Mission Statement** — "OnlyAlpha is an AI-powered cryptocurrency intelligence platform built for traders and investors who demand real-time, data-driven market insights."
2. **What We Do** — Bullet points:
   - Real-time AI market analysis across 30+ cryptocurrencies
   - Automated signal detection with confidence scoring
   - On-chain intelligence and whale activity monitoring
   - Airdrop discovery and tracking
   - Deep-dive research articles generated by multi-model AI systems
3. **How It Works** — Brief explanation: AI models analyze market data, news feeds, on-chain metrics, and social signals to produce actionable intelligence. No human bias in signal generation.
4. **Our Technology** — Mention: multi-model AI routing (DeepSeek, Gemini, GPT), real-time data from major exchanges, blockchain data integration.
5. **Transparency** — Every signal is tracked and scorecarded. Past performance visible to all users. No hidden calls.
6. **Disclaimer** — "OnlyAlpha is not a registered financial advisor. All content is AI-generated and for informational purposes only."
7. **Contact** — contact@onlyalphacrypto.com

**Design spec:**
- Same dark theme tokens as T-03
- Consider a card-based layout for "What We Do" section: `bg-[#0A0A0A] border border-[#222] rounded-lg p-4`
- Use `text-[var(--color-primary)]` for key highlights

**Verification Checklist:**
- Server component
- `metadata` export
- All 7 sections with real text
- Clear, professional tone
- Zero `any` types

---

#### T-06: Create Contact Us Page
**File (CREATE):** `frontend/src/app/contact/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** A Contact page with a real contact method. Google AdSense requires a way for users to reach the site owner.

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the OnlyAlpha team — questions, feedback, and partnership inquiries.',
};
```

**Content sections:**

1. **Heading** — "Get in Touch"
2. **Contact Email** — `contact@onlyalphacrypto.com` displayed prominently (mailto link)
3. **What We Can Help With** — Bulleted list:
   - General questions about the platform
   - Bug reports or technical issues
   - Partnership and API inquiries
   - Privacy and data requests
   - Content corrections
4. **Response Time** — "We aim to respond within 48 hours."
5. **Note** — "OnlyAlpha is an AI-powered platform. For questions about specific signals or market analysis, please note that all content is generated by AI and reviewed by our team."

**Design spec:**
- Same dark theme
- Email displayed in a styled card: `bg-[#0A0A0A] border border-[#222] rounded-lg p-6`
- Email text: `text-[var(--color-primary)] font-mono text-lg`
- Optional: a simple visual element (icon or divider)

**Verification Checklist:**
- Server component
- `metadata` export
- Real email address visible (mailto link)
- Professional tone
- Zero `any` types

---

#### T-07: Create Financial Disclaimer Page
**File (CREATE):** `frontend/src/app/disclaimer/page.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** A comprehensive financial disclaimer page. This is the MOST IMPORTANT legal page for AdSense on a crypto site. It must be thorough and cover all AI-generated content, signals, and financial disclaimers.

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: 'Financial Disclaimer',
  description: 'OnlyAlpha Financial Disclaimer — important risk disclosures about AI-generated crypto intelligence.',
};
```

**Content sections (MUST cover ALL — this is the critical page):**

1. **General Disclaimer** — OnlyAlpha provides AI-generated market intelligence. All content is for informational and educational purposes only.
2. **Not Financial Advice** — CRITICAL (style prominently). Content does NOT constitute: investment advice, financial advice, trading advice, solicitation to buy/sell/hold. OnlyAlpha is NOT a registered investment advisor, broker-dealer, or financial planner.
3. **AI-Generated Content** — All signals, analysis, verdicts (BUY/SELL), confidence scores, and articles are generated by artificial intelligence models. These are NOT human recommendations. AI models can and do produce errors, hallucinations, and inaccurate predictions.
4. **High-Risk Nature of Cryptocurrency** — Crypto markets are extremely volatile. You can lose your entire investment. Past performance does NOT guarantee future results. Prices can swing 50%+ in hours.
5. **No Guarantee of Profits** — OnlyAlpha makes NO guarantee of profits, returns, or accuracy. Signals are directional opinions based on data patterns, NOT predictions.
6. **Do Your Own Research (DYOR)** — Users MUST conduct independent research before making any investment. Do NOT rely solely on OnlyAlpha signals.
7. **Signal Scorecard Disclaimer** — Past signal performance is historical data only. It does not predict future performance. Win rates and returns are NOT indicative of future results.
8. **Third-Party Data** — Market data sourced from third-party APIs (Binance, etc.). OnlyAlpha is NOT responsible for data accuracy, delays, or errors from third-party sources.
9. **No Fiduciary Duty** — OnlyAlpha owes no fiduciary duty to any user. No client relationship is formed by using the platform.
10. **Limitation of Liability** — OnlyAlpha, its team, and its AI systems are NOT liable for any financial losses, damages, or decisions made based on platform content.
11. **Jurisdiction-Specific Warnings** — Cryptocurrency regulations vary by country. Users are responsible for understanding and complying with their local laws.
12. **Contact** — Questions about this disclaimer: contact@onlyalphacrypto.com

**Design spec:**
- Same dark theme
- "Not Financial Advice" section: use a prominent callout box `bg-[#0A0A0A] border-l-4 border-[var(--color-primary)] p-4 rounded-r-lg`
- "High-Risk" section: use `border-l-4 border-red-500` callout
- Body text `text-sm text-[#888]`, headings `text-lg text-white`

**Verification Checklist:**
- Server component
- `metadata` export
- All 12 sections with thorough, real text
- "Not Financial Advice" and "High-Risk" sections visually prominent
- Zero `any` types

---

#### T-08: Add Legal Pages to Sitemap
**File (MODIFY):** `frontend/src/app/sitemap.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** Add 5 legal page entries to the `STATIC_PAGES` array so Google can discover them.

**Add AFTER the existing archive entry (line 31):**

```typescript
    {
        url: `${SITE_URL}/privacy`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
    {
        url: `${SITE_URL}/terms`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
    {
        url: `${SITE_URL}/disclaimer`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
    },
    {
        url: `${SITE_URL}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
    },
    {
        url: `${SITE_URL}/contact`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
```

**Verification Checklist:**
- 5 new entries in `STATIC_PAGES` array
- `changeFrequency: 'monthly'` (legal pages rarely change)
- Priority 0.3-0.4 (lower than content pages, correct for legal pages)
- `SITE_URL` constant used (not hardcoded)
- Existing entries untouched

---

#### T-10: Create Cookie Consent Banner (GDPR/CCPA)
**File (CREATE):** `frontend/src/features/shared/components/CookieBanner.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed

**Target:** A GDPR/CCPA-compliant cookie consent banner. This is the ONLY client component in the entire phase — required for `localStorage` state + click handlers. Google AdSense requires disclosure of third-party cookie usage.

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ℹ️  We use cookies for analytics (Google Analytics). Third-party  │
│     vendors, including Google, may use cookies to serve ads based   │
│     on your prior visits.                                           │
│                                                                     │
│     [Accept All Cookies]    [Decline Non-Essential]                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- On mount: `localStorage.getItem('cookie-consent')`
- If value exists (`'accepted'` | `'declied'`): do NOT render banner
- If no value: render banner (fixed bottom of viewport)
- "Accept All": `localStorage.setItem('cookie-consent', 'accepted')` → hide banner with slide-down animation
- "Decline Non-Essential": `localStorage.setItem('cookie-consent', 'declined')` → hide banner with slide-down animation
- Use `useState` + `useEffect` (standard React hooks, no external libs)
- Animate entrance: slide up from bottom via CSS transition (`transform: translateY(100%)` → `translateY(0)`)

**Design spec:**
- Container: `fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-[#222] p-4 transition-transform duration-300`
- Inner: `max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-4`
- Text: `text-xs text-[#888] leading-relaxed`
- Info icon: `<span className="material-symbols-outlined text-base text-[#555]">info</span>`
- Accept button: `px-4 py-2 bg-[var(--color-primary)] text-black text-xs font-semibold rounded hover:opacity-90 transition-opacity`
- Decline button: `px-4 py-2 bg-transparent border border-[#333] text-[#888] text-xs rounded hover:border-[#555] transition-colors`
- Responsive: stacks vertically on mobile (`flex-col`), horizontal on desktop (`sm:flex-row`)

**Content text:**
> "We use cookies for analytics (Google Analytics) to improve your experience. Third-party vendors, including Google, may use cookies to serve ads based on your prior visits or to display personalized content. By clicking 'Accept', you consent to our use of cookies. Learn more in our [Privacy Policy](/privacy)."

The "Privacy Policy" text should be a `<Link href="/privacy">` component styled as `text-[var(--color-primary)] hover:underline`.

**Verification Checklist:**
- `'use client'` directive at top of file
- Uses `localStorage` (native, no library)
- Only renders if no consent value stored
- Both buttons hide the banner and store preference
- Content mentions Google/third-party cookies
- Link to `/privacy` page works
- Dark theme tokens match existing design system
- Zero `any` types
- Responsive layout
- Smooth CSS transition on show/hide

---

#### T-11: Integrate CookieBanner + AdSense Script into Layout
**File (MODIFY):** `frontend/src/app/layout.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA Passed
**Depends On:** T-02 (Footer added to layout), T-10 (CookieBanner created)

**Target:** Add CookieBanner component and a conditional Google AdSense script tag to the root layout. The AdSense script is a placeholder — it only loads when the `NEXT_PUBLIC_ADSENSE_ID` environment variable is set.

**Sub-task 11A: Add CookieBanner import (after T-02's Footer import)**

Add after the `Footer` import line (which T-02 will have added):
```typescript
import { CookieBanner } from '@/features/shared/components/CookieBanner';
```

**Sub-task 11B: Render CookieBanner at the end of `<body>`**

Add as the LAST child inside `<body>`, after `<Footer />`:
```tsx
<CookieBanner />
```

Since CookieBanner uses `position: fixed`, it overlays on top of everything regardless of DOM position. Placing it last is semantically clean and ensures it renders above all content.

**Sub-task 11C: Add conditional AdSense script in `<head>`**

Add after the existing Google Analytics `<Script>` blocks (after line 86 in the current file):
```tsx
{process.env.NEXT_PUBLIC_ADSENSE_ID && (
  <Script
    async
    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
    crossOrigin="anonymous"
    strategy="afterInteractive"
  />
)}
```

**Important notes:**
- `process.env.NEXT_PUBLIC_ADSENSE_ID` must start with `NEXT_PUBLIC_` to be available in client-side rendering. If not set, the AdSense script simply does not load — zero impact on the site.
- `Script` component is already imported from `next/script` (line 2 of layout.tsx) — no new import needed.
- The `crossOrigin="anonymous"` attribute is required by Google AdSense.

**Verification Checklist:**
- `CookieBanner` imported from shared components
- CookieBanner renders as last child in `<body>`
- AdSense script conditional on `NEXT_PUBLIC_ADSENSE_ID` env var
- Layout structure preserved (sidebar + main + ticker bar)
- `tsc --noEmit` clean
- Zero `any` types
- Footer still renders correctly (T-02 output preserved)
- Existing GA scripts untouched

---

#### T-12: Add NFA Warning to Terminal Article Page + Enhance Scorecard Disclaimer
**Files (MODIFY):** `frontend/src/app/terminal/[coin]/page.tsx`, `frontend/src/app/scorecard/page.tsx`
**Assigned To:** Senior Developer
**Status:** ⬜ Pending

**Target:** Ensure the "Not Financial Advice" disclaimer is explicitly visible on the two pages where users interact with AI-generated financial signals and analysis. Currently:
- `terminal/[coin]/page.tsx` — ZERO disclaimer text (critical gap)
- `scorecard/page.tsx` — has minimal `text-xs text-[#555]` text at bottom (not prominent enough per nextstep.md)

Both should use the prominent callout box style that already exists in `AlphaStream.tsx:334-344`.

**Sub-task 12A: Terminal Article Page — Add NFA Disclaimer Callout**

**File:** `frontend/src/app/terminal/[coin]/page.tsx`

Add a prominent NFA disclaimer section at the BOTTOM of the article content, before any closing container divs. The developer must read the current file structure to identify the correct insertion point (typically after the main article content section, before the final closing `</div>`).

**Design (matches existing `AlphaStream.tsx:334-344` pattern):**
```tsx
<div className="mt-8 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg">
  <div className="flex items-start gap-3">
    <span className="material-symbols-outlined text-[#444] text-base mt-0.5">shield</span>
    <div>
      <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#555] mb-2">Disclaimer</h4>
      <p className="text-[11px] text-[#555] leading-relaxed">
        All content on this page is <span className="text-[#888]">AI-generated</span> and for{' '}
        <span className="text-[#888]">informational purposes only</span>. It does{' '}
        <span className="text-[#888]">not</span> constitute financial advice, investment recommendations,
        or solicitation to buy or sell any asset. OnlyAlpha is{' '}
        <span className="text-[#888]">not</span> a registered financial advisor. Always{' '}
        <span className="text-[#888]">do your own research (DYOR)</span> and consult a licensed
        professional before making investment decisions.{' '}
        <span className="text-[#888]">NFA — Not Financial Advice.</span>
      </p>
    </div>
  </div>
</div>
```

**Sub-task 12B: Scorecard Page — Enhance NFA Warning**

**File:** `frontend/src/app/scorecard/page.tsx`

Replace the current small NFA text block (lines 213-217 in the current file):

**CURRENT (small, buried):**
```tsx
<div className="mt-12 pt-6 border-t border-[#222] text-center">
  <p className="text-xs text-[#555] max-w-lg mx-auto leading-relaxed">
    Past performance does not guarantee future results. Not financial advice...
  </p>
</div>
```

**REPLACE WITH (prominent callout):**
```tsx
<div className="mt-12 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg">
  <div className="flex items-start gap-3">
    <span className="material-symbols-outlined text-[#444] text-base mt-0.5">shield</span>
    <div>
      <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#555] mb-2">Disclaimer</h4>
      <p className="text-[11px] text-[#555] leading-relaxed">
        Past performance does <span className="text-[#888]">not</span> guarantee future results.
        All signals are <span className="text-[#888]">AI-generated</span> and should not be the
        sole basis for investment decisions. OnlyAlpha is{' '}
        <span className="text-[#888]">not</span> a registered financial advisor. Always{' '}
        <span className="text-[#888]">do your own research (DYOR)</span>.{' '}
        <span className="text-[#888]">NFA — Not Financial Advice.</span>
      </p>
    </div>
  </div>
</div>
```

**Verification Checklist:**
- Terminal article page (`/terminal/btc`) shows NFA disclaimer callout at bottom
- Scorecard page (`/scorecard`) NFA is now a prominent callout box (not small text)
- Both use identical callout style (consistent with `AlphaStream.tsx` pattern)
- Shield icon renders correctly (`material-symbols-outlined` already loaded globally)
- Zero `any` types
- `tsc --noEmit` clean
- Responsive on mobile viewports

**⚠️ GUARDRAIL FLAG FOR TECH LEAD:** This task modifies 2 existing pages (`terminal/[coin]/page.tsx` and `scorecard/page.tsx`). Guardrail #10 states "DO NOT modify Sidebar or any existing page." However, nextstep.md Section 4 explicitly requires: *"Ensure the 'Not Financial Advice' label is explicitly visible on the /scorecard and individual article pages, not just buried in text."* This is a direct Architect requirement for AdSense compliance. **REQUESTING TECH LEAD APPROVAL** to proceed with these 2 modifications.

---

#### T-09: Verify SEO + Final Integration Check
**Assigned To:** Senior Developer
**Status:** ⬜ Pending

**Target:** Verify everything works together before QA.

**Verification Checklist (Developer self-check):**
1. Run `tsc --noEmit` in `frontend/` — zero errors
2. Zero `any` types in all new files
3. All 5 pages return 200 when accessed:
   - `/privacy`
   - `/terms`
   - `/about`
   - `/contact`
   - `/disclaimer`
4. Footer renders on ALL pages (Home, Terminal, Airdrops, Scorecard, all legal pages)
5. Footer links all navigate to correct pages
6. Each legal page has correct `<title>` in browser tab
7. `sitemap.ts` includes all 5 legal pages
8. `robots.ts` allows crawling of legal pages (already does — `/` glob)
9. All pages use OnlyAlpha dark theme consistently
10. All pages are responsive (check mobile viewport)
11. All content is real English text — NO placeholder/lorem ipsum
12. Copyright year is dynamic (`new Date().getFullYear()`)
13. CookieBanner renders for new users (clear `localStorage` to test)
14. CookieBanner hides after clicking "Accept All" or "Decline Non-Essential"
15. CookieBanner content mentions Google/third-party cookies + links to `/privacy`
16. AdSense script loads ONLY when `NEXT_PUBLIC_ADSENSE_ID` env var is set
17. Terminal article page (`/terminal/btc`) shows NFA disclaimer callout (shield icon + styled box)
18. Scorecard page (`/scorecard`) NFA disclaimer is a prominent callout box (NOT the old small text)

---

### 3. QA & Security Stage (QA Hunter)

> **Status:** Waiting for execution to complete.

---

### 4. Deployment Stage (Release Manager)

> **Status:** Ready for Deployment

---

## Completed Phases (Archived)

### Phase 18 — Signal P&L Tracker / Scorecard (P2)
**Tasks:** 8 (T-01 through T-08) — All Done, QA Passed

### Phase 17 — Telegram Pipeline Feed + Z.ai Airdrop Enrichment (P2)
**Tasks:** 7 (T-01 through T-07) — All Done, QA Passed

### Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)
**Tasks:** 9 (T-01 through T-09) — Deploy 1 Complete

### Phase 15 — Strategic Intelligence Layer
**Tasks:** 5 (T-01 through T-05) — All Done, QA Passed

### Phase                                                                                                                                                                                                                    