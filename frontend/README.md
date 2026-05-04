# OnlyAlpha — Frontend

AI-Native Crypto Intelligence Platform — Next.js 16 client application.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js 16 (App Router) | v16.1+ | Server Components + ISR revalidation |
| React 19 | v19.2+ | Concurrent features + Server Actions |
| Tailwind CSS 4 | v4+ | Utility-first styling |
| Framer Motion | v12.35+ | Animations for Terminal and Radar |
| Lightweight Charts (TradingView) | v4.1+ | Financial charts with candlestick support |
| Lucide React | v0.577+ | Icon library |
| date-fns | v4.1+ | Date formatting |
| tailwind-merge | v3.5+ | Class name conflict resolution |

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — Alpha Radar, Market Mood, Top Movers, Airdrop Watchlist |
| `/terminal` | Terminal landing |
| `/terminal/[coin]` | Coin terminal — Chat, Chart, Wire Feed, Deep Dive |
| `/terminal/[coin]/alpha` | Living Article view |
| `/archive` | Article archive (paginated, year/month grouping) |
| `/scorecard` | Signal P&L scorecard — Win rates + per-signal breakdown |
| `/airdrops` | Airdrop listing with AI risk badges |
| `/airdrops/[id]` | Airdrop detail + task tracker |
| `/auth` | Login / Register |
| `/settings` | Billing, Wallets, API Keys, Preferences |
| `/about` | About OnlyAlpha |
| `/contact` | Contact information |
| `/privacy` | Privacy policy (GDPR/CCPA) |
| `/terms` | Terms of service |
| `/disclaimer` | Legal disclaimer (NFA) |

## Feature Architecture

All features follow a consistent structure under `src/features/`:

```
features/
├── shared/       ← Footer, CookieBanner, Sidebar, TickerBar, ErrorBoundary
├── home/         ← Dashboard widgets
├── terminal/     ← Terminal page components + hooks
├── settings/     ← User settings panels
├── airdrop/      ← Airdrop pages
└── archive/      ← Article archive
```

Each feature directory contains:
- `api.ts` — Type-safe API client functions
- `types.ts` — TypeScript interfaces
- `components/` — React components

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Build

```bash
npm run build
```

## Deployment

Deployed via **Netlify** — see root `netlify.toml` for configuration.
