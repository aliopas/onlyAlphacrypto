# 08 — Frontend

**Framework:** Next.js 16 (App Router)  
**UI Library:** React 19  
**Styling:** Tailwind CSS 4  
**Animations:** Framer Motion 12.35+

---

## Route Groups

### (standard) Layout
- Includes: Sidebar, Footer, CookieBanner
- Used by: Dashboard, Scorecard, Airdrops, Archive, Settings, Legal pages

### (terminal) Layout
- Full-width, no Sidebar
- Used by: Terminal pages (coin-specific deep analysis)

---

## Pages & Components

### Dashboard (`/`) — `(standard)/page.tsx`
Home page with market overview widgets.

| Component | Feature | Data Source |
|---|---|---|
| `RadarGrid` | Alpha radar signal cards | `/api/market/radar` |
| `MarketMoodGauge` | Fear & Greed gauge visualization | `/api/market/mood` |
| `AlphaFocusCard` | Daily top pick | `/api/market/alpha-focus` |
| `TopMovers` | Top gaining/losing coins | `/api/market/movers` |
| `AirdropWatchlist` | Upcoming airdrop deadlines | `/api/airdrop/sidebar-deadlines` |
| `TickerBar` | Scrolling price ticker | Binance prices |

### Terminal (`/terminal/[coin]`) — `(terminal)/terminal/[coin]/page.tsx`
Deep coin analysis page. The core experience.

| Component | Feature | Data Source |
|---|---|---|
| `TerminalPageClient` | Main orchestrator | Multiple endpoints |
| `LivingArticle` | Evolving article per coin | `/api/market/master/:symbol` |
| `TimelineFeed` | Event timeline | `/api/market/timeline/:symbol` |
| `TerminalChart` | TradingView candlestick chart | `/api/chart/klines/:symbol` |
| `TerminalChat` | AI chat (SSE streaming) | `/api/chat/stream/context` |
| `AlphaStream` | Real-time intelligence feed | `/api/market/wire` |
| `TerminalWire` | Wire feed component | `/api/market/wire` |
| `DeepDiveSection` | Expandable analysis sections | Article data |
| `AlphaSnapshot` | Quick stats snapshot | Coin intelligence |
| `TerminalMobileNav` | Mobile navigation | — |

### Scorecard (`/scorecard`) — `(standard)/scorecard/page.tsx`
Signal P&L tracking with win rates.

- Summary stats: Active Scenarios, Completed Scenarios, Outcome Rate, Avg Outcome, Best Outcome
- Signal table with: Coin, Bias, Reference $, Risk Zone, Target Zone, Current $, Drift, Since
- Safe terminology: Bullish/Bearish instead of BUY/SELL, Target Zone/Risk Zone instead of TP/SL

### Airdrops (`/airdrops`) — `(standard)/airdrops/page.tsx`

| Component | Feature |
|---|---|
| `AirdropsPageClient` | Grid of airdrop cards with error/empty states |
| `AirdropDetailClient` | Single airdrop detail page |
| `TaskList` | Per-project task checklist |
| `AiReportStructured` | Structured AI risk report display |
| `FarmingStreak` | Farming streak indicator |

### Archive (`/archive`) — `(standard)/archive/page.tsx`

| Component | Feature |
|---|---|
| `ArchivePageClient` | Year/month-grouped article list |

### Settings (`/settings`) — `(standard)/settings/page.tsx`

| Component | Feature |
|---|---|
| `PricingCards` | Plan tiers (Free/Pro/Institutional) |
| `PreferencesPanel` | Notification toggles, preferred coins |
| `OgBadge` | Early adopter badge |
| `WalletManager` | Web3 wallet management |
| `ApiKeyManager` | API key CRUD |

### Legal Pages
All server components with static content, dark theme, AdSense-compliant.

| Route | Page |
|---|---|
| `/about` | Mission, what we do, team info |
| `/privacy` | Privacy policy (11 sections) |
| `/terms` | Terms of service (12 sections) |
| `/disclaimer` | NFA disclaimer with risk warnings |
| `/contact` | Contact form + help topics |

### Auth (`/auth`) — `(standard)/auth/page.tsx`
Login/Register page.

---

## Shared Components

| Component | Purpose |
|---|---|
| `Footer` | Site-wide footer with 5 links (Privacy, Terms, Disclaimer, About, Contact) + dynamic year |
| `Sidebar` | Navigation sidebar |
| `TickerBar` | Scrolling price ticker on dashboard |
| `CookieBanner` | GDPR/CCPA cookie consent (localStorage) |
| `ErrorBoundary` | React error boundary wrapper |
| `SectionHeader` | Reusable section header component |

---

## Frontend Types

Typed interfaces per feature in `features/*/types.ts`:
- `home/types.ts` — Dashboard widget types
- `terminal/types.ts` — Terminal page types
- `airdrop/types.ts` — Airdrop types
- `archive/types.ts` — Archive types
- `settings/types.ts` — Settings types

---

## Frontend Lib

| File | Purpose |
|---|---|
| `constants.ts` | `SITE_URL`, `COINS` array (30 coins), `GA_MEASUREMENT_ID` |
| `utils.ts` | Utility functions |
