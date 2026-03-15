# 🗺️ OnlyAlpha — Master Project Plan & Architecture Overview

## 📌 1. What is OnlyAlpha?
**OnlyAlpha** is a professional-grade, AI-powered crypto intelligence platform designed for serious traders and airdrop farmers. It consolidates real-time market analysis, on-chain wallet tracking, and automated airdrop management into a single, dark-mode, terminal-style interface.

> **Core Value Proposition:** Replace the noise of Crypto Twitter, Discord groups, and manual spreadsheets with a single platform that thinks, filters, and acts on the user's behalf.

---

## 🏛️ 2. Platform Pages & Documentation Index

| Page | Design File | Master Doc | Sub-Feature Docs |
|------|------------|-----------|-----------------|
| **Home Dashboard** | `the desine/home.html` | [doc/home/home.md](./home/home.md) | [Alpha Focus](./home/TODAY'S-ALPHA-FOCUS.md) · [Live Radar](./home/LIVE-AI-RADAR.md) · [Market Widgets](./home/Global-Market-Widgets.md) |
| **Terminal** | `the desine/tremanal.html` | [doc/termnal/termanal.md](./termnal/termanal.md) | [LATEST WIRE](./termnal/the-posts.md) · [AI Chatbot](./termnal/chat-bot.md) |
| **Airdrop Tracker** | `the desine/airdrop.html` | [doc/airdrop/airdrop.md](./airdrop/airdrop.md) | [Wallet Engine](./airdrop/Web3-Wallet-Engine.md) · [AI Hunter](./airdrop/AI-Airdrop-Hunter.md) · [Verification](./airdrop/Smart%20Interactive-UI%26Verification.md) |
| **Settings & Profile** | `the desine/profil.html` | [doc/portflio/porfil.md](./portflio/porfil.md) | *(single master doc)* |

---

## ⚙️ 3. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) | SSR + ISR + Server Components for SEO and speed |
| **UI Styling** | Tailwind CSS | Single unified `tailwind.config.ts` across all pages |
| **ORM** | Drizzle ORM | Type-safe queries, PostgreSQL-native |
| **Database** | PostgreSQL | Relational data for users, news, airdrops |
| **Cache Layer** | Next.js Data Cache + Redis | Page-level ISR cache + API rate limiting |
| **AI Engine** | OpenAI API (GPT-4o-mini) | Cost-efficient, fast for summarization + scoring |
| **Real-time** | WebSockets + Server-Sent Events (SSE) | Live prices (WS) + pushed news cards (SSE) |
| **Blockchain APIs** | Moralis + DeBank | Cross-chain transaction history + DeFi parsing |
| **External Market** | Binance API + Alternative.me | Live prices, Fear & Greed index |
| **Auth** | NextAuth.js (JWT + Sessions) | Passwordless Web3 option + standard email |
| **Fonts** | Inter (display) + JetBrains Mono (data) | Terminal aesthetic, professional readability |

---

## 🧠 4. The Three Core AI Engines

All intelligence in OnlyAlpha flows from three background AI engines. These engines run on scheduled Cron Jobs and write their outputs to the database. Pages are "dumb consumers" — they only read.

### Engine 1: Terminal Intelligence Engine
> Lives inside the Terminal page pipeline

- **What it does:** Analyzes individual coins, generates AI verdicts (STRONG BUY / SELL / NEUTRAL), writes the `Executive Summary`, and powers the `LATEST WIRE` news feed.
- **Output tables:** `market_insights`, `coin_news`, `radar_signals`
- **Consumers:** Terminal page (primary) + Home Dashboard (Alpha Focus + Live Radar)

### Engine 2: AI Airdrop Hunter
> Lives inside the Airdrop Tracker pipeline

- **What it does:** Discovers new airdrop projects, validates them for legitimacy, extracts task checklists, estimates values, and tracks deadlines.
- **Output tables:** `airdrop_projects`, `airdrop_tasks`
- **Consumers:** Airdrop Tracker page (primary) + Home Dashboard (Airdrop Watchlist)

### Engine 3: Auto-Verification Engine
> Bridges the Airdrop Tracker with the Web3 Wallet Engine

- **What it does:** Cross-references user wallet transactions (from Moralis) against airdrop task conditions (from `airdrop_tasks`) to automatically tick ✅ completed tasks.
- **Output tables:** `user_progress`
- **Consumers:** Airdrop Tracker (Progress Bar + ✅ UI)

---

## 🔗 5. Cross-Feature Integration Map

This is the "nervous system" of the platform — how each page talks to the others:

```
SETTINGS PAGE
    └── User adds wallet address
            ├──► Airdrop Auto-Verification: starts tracking this wallet
            └──► Web3 Wallet Engine: fetches TX history → populates Airdrop stats

TERMINAL ENGINE (Cron: every 5 min)
    └── LATEST WIRE detects breaking news
            ├──► Writes wire_card → Terminal: LATEST WIRE feed
            ├──► Writes radar_card → Home: Live AI Radar
            └──► Detects "Snapshot/TGE" keywords for tracked project
                    └──► Fires Webhook → Airdrop: force-updates Deadlines

AIRDROP HUNTER (Cron: daily + 12h + event-driven)
    └── Discovers & validates new airdrop project
            ├──► Writes to airdrop_projects → Airdrop: Farm Grid
            └──► Reflects instantly → Home: Airdrop Watchlist

HOME PAGE (Read-only consumer — ZERO AI compute on load)
    ├── Reads daily_alpha_focus → Alpha Focus Hero
    ├── Reads radar_signals → Live AI Radar  
    ├── Reads daily_market_mood → Market Mood Gauge
    ├── Reads airdrop_projects → Airdrop Watchlist
    └── Streams Binance WS directly → Top Movers + Live Prices
```

---

## 🗄️ 6. Full Database Schema Index

| Table | Owner Page | Purpose |
|---|---|---|
| `users` | Settings | Core user identity + OG badge |
| `user_wallets` | Settings | Tracked wallet addresses (max 10) |
| `api_keys` | Settings | Developer API key management |
| `sessions` | Settings | Active session tracking for security |
| `user_preferences` | Settings | Alert/notification toggle flags |
| `market_insights` | Terminal | AI verdicts + confidence scores per coin |
| `coin_news` | Terminal (LATEST WIRE) | AI-processed news headlines |
| `radar_signals` | Terminal → Home | Short 1-line AI signals for Home Radar |
| `daily_alpha_focus` | Home | Today's top-ranked AI pick |
| `daily_market_mood` | Home | Blended Fear & Greed score |
| `airdrop_projects` | Airdrop | AI-validated airdrop opportunity listings |
| `airdrop_tasks` | Airdrop | Task checklists per project |
| `user_progress` | Airdrop | Auto-verified task completion per wallet |

---

## ⏱️ 7. Cron Job Schedule

| Job | Frequency | Engine | Output |
|---|---|---|---|
| **Daily Alpha Selection** | 06:00 UTC daily | Terminal Intelligence | `daily_alpha_focus` |
| **Fear & Greed Blend** | 07:00 UTC daily | Sentiment Aggregator | `daily_market_mood` |
| **New Airdrop Discovery** | 00:00 UTC daily | AI Airdrop Hunter | `airdrop_projects` |
| **Active Airdrop Sync** | Every 12 hours | AI Airdrop Hunter | `airdrop_tasks`, deadlines |
| **LATEST WIRE + Radar** | Every 5 minutes | Terminal Intelligence | `coin_news`, `radar_signals` |
| **Breaking News Trigger** | Event-driven | LATEST WIRE → Airdrop | Airdrop deadline updates |
| **Wallet TX Sync** | On wallet add + every 6h | Web3 Wallet Engine | `user_progress` |

---

## 🚀 8. Development Roadmap (Suggested Phases)

### Phase 1 — Foundation (MVP)
- [ ] Next.js project setup with single unified `tailwind.config.ts`
- [ ] Auth system (NextAuth.js)
- [ ] Database setup (PostgreSQL + Drizzle ORM migrations)
- [ ] Settings page: wallet management + session tracking
- [ ] Terminal page: static layout + Binance WebSocket price feed

### Phase 2 — AI Intelligence
- [ ] LATEST WIRE pipeline (scraping + OpenAI dual-output prompt)
- [ ] Terminal AI Chat (streaming with Vercel AI SDK)
- [ ] Home page: Alpha Focus + Live Radar (consumers of Phase 2 data)

### Phase 3 — Web3 & Airdrop
- [ ] Moralis/DeBank wallet transaction fetching
- [ ] AI Airdrop Hunter cron job
- [ ] Auto-Verification engine (task ↔ TX matching)
- [ ] Airdrop Tracker page: full interactive UI + Slide-over Drawer

### Phase 4 — Scale & Monetize
- [ ] Developer API Gateway with Redis rate limiting
- [ ] Tiered user plans (Free / Pro / Institutional)
- [ ] OG Genesis badge system
- [ ] Performance audit + Redis caching layer
