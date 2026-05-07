# 02 — Architecture

## High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16 App Router)                │
│                                                                      │
│  Route Groups:                                                       │
│  (standard)/  — Home, Scorecard, Airdrops, Archive, Settings,       │
│                 About, Privacy, Terms, Disclaimer, Contact, Auth    │
│  (terminal)/  — Terminal/[coin], Terminal/[coin]/alpha              │
│                                                                      │
│  Features:                                                           │
│  home/       RadarGrid, MarketMoodGauge, AlphaFocusCard,            │
│              TopMovers, AirdropWatchlist                             │
│  terminal/   TerminalPageClient, LivingArticle, TimelineFeed,       │
│              AlphaStream, TerminalWire, TerminalChat,                │
│              DeepDiveSection, TerminalChart                          │
│  airdrop/    AirdropsPageClient, AirdropDetailClient,               │
│              TaskList, AiReportStructured, FarmingStreak             │
│  shared/     Footer, Sidebar, TickerBar, CookieBanner,              │
│              ErrorBoundary, SectionHeader                            │
│  settings/   PricingCards, PreferencesPanel, OgBadge,               │
│              WalletManager, ApiKeyManager                            │
│  archive/    ArchivePageClient                                       │
└────────────────────────┬─────────────────────────────────────────────┘
                         │  REST API (JSON) + SSE (Chat Stream)
┌────────────────────────▼─────────────────────────────────────────────┐
│                      BACKEND (Express 5 + TypeScript)                │
│                                                                      │
│  Middleware:                                                         │
│  Helmet → CORS → JSON (10KB) → URL-Encoded → Time → Routes         │
│                                                                      │
│  Routes:                                                             │
│  /api/market/*    — Market data, articles, signals, scorecard        │
│  /api/chat/*      — Chat streaming (SSE)                             │
│  /api/user/*      — Auth, preferences, wallets, API keys            │
│  /api/airdrop/*   — Airdrop projects, tasks, progress               │
│  /api/chart/*     — Candle data for charts                           │
│  /api/health      — System health check                              │
│                                                                      │
│  Services (38 files):                                                │
│  AI Core:     ai-gateway, prompt-factory, cache-manager,            │
│               quality-auditor, factual-grounding, agent-workflow     │
│  Pipeline:    openai.service (12 exported functions)                 │
│  Analysis:    conviction, strategicOutlook, signalManager,           │
│               tpslCalculator, levelIntelligence, scenarioTracker,    │
│               eventImpact*, historicalEventComparison                │
│  Data:        binance, priceService, coinIntelligence,              │
│               coin-memory, embedding, similarity, dynamicThreshold   │
│  Ingestion:   rssNews, telegram, airdropRss, defillama,             │
│               zhipuWebSearch, cryptopanic, tavily, dexscreener       │
│  Utility:     circuitBreaker, verification, moralis,                │
│               binanceHistory, wikipedia, temporalIntelligence        │
│                                                                      │
│  Cron Jobs: 17 active + 3 optional (20 total)                       │
│  Scripts:    11 bootstrap/maintenance scripts                        │
└──────────┬───────────────────┬──────────────────┬────────────────────┘
           │                   │                  │
    ┌──────▼──────┐   ┌───────▼───────┐  ┌───────▼───────┐
    │ PostgreSQL  │   │    Redis      │  │ External APIs │
    │ 32 tables   │   │  (Optional)   │  │ OpenRouter     │
    │ pgvector    │   │  Cache        │  │ DeepSeek       │
    │ Drizzle ORM │   │  Mutex Locks  │  │ GLM/Zhipu      │
    │             │   │  Rate Limits  │  │ Binance        │
    └─────────────┘   └──────────────┘  │ Moralis        │
                                         │ Telegram       │
                                         │ Alternative.me │
                                         │ DeFiLlama      │
                                         │ DexScreener    │
                                         │ Birdeye        │
                                         │ Tavily/CoinCap │
                                         └───────────────┘
```

## Directory Structure

```
OnlyAlpha/
├── backend/
│   ├── src/
│   │   ├── config/          # env.ts, db.ts, redis.ts
│   │   ├── controllers/     # market, chat, user, airdrop, health, apiKey, chart
│   │   ├── crons/           # 20 cron job files
│   │   ├── middleware/      # auth, rateLimit, chat-quota, apiKey, guest-limit, time, errorHandler
│   │   ├── models/          # market.model.ts, user.model.ts, airdrop.model.ts, index.ts
│   │   ├── routes/          # market, chat, user, airdrop, chart, index
│   │   ├── scripts/         # 11 bootstrap/maintenance scripts
│   │   ├── services/        # 37 service files (core business logic)
│   │   │   └── ai/          # ai-gateway, prompt-factory, cache-manager, quality-auditor, factual-grounding, agent-workflow
│   │   ├── utils/           # logger.ts, crypto.ts
│   │   └── server.ts        # Express app bootstrap + cron registration
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── (standard)/  # Standard layout pages
│   │   │   └── (terminal)/  # Terminal layout pages
│   │   ├── features/        # Feature-based components
│   │   │   ├── home/        # Dashboard components
│   │   │   ├── terminal/    # Terminal page components
│   │   │   ├── airdrop/     # Airdrop page components
│   │   │   ├── settings/    # Settings components
│   │   │   ├── archive/     # Archive page components
│   │   │   └── shared/      # Cross-cutting components
│   │   └── lib/             # constants.ts, utils.ts
│   └── package.json
├── agent_gedens/            # Agent coordination files
│   ├── PROJECT_STATE.md
│   ├── AGENT_LOGS.md
│   ├── AGENTS_PROTOCOL.md
│   └── THE_NEXUS_HUB.md
├── plans/                   # Master plan files
│   └── THE SUPREME REVIEWER_plans/
│       ├── nextstep.md      # Archived
│       ├── nextstep1.md     # Archived
│       └── nextstep2.md     # ACTIVE — Master Implementation Plan v2.0
└── doc/
    └── v1/                  # This documentation
```

## Frontend Route Groups

### (standard) — Standard Layout
Used for all pages except Terminal. Includes Sidebar, Footer, CookieBanner.

| Route | Page | Key Components |
|---|---|---|
| `/` | Dashboard | RadarGrid, MarketMoodGauge, AlphaFocusCard, TopMovers, AirdropWatchlist |
| `/scorecard` | Signal Performance | Signal P&L table, win rates |
| `/airdrops` | Airdrop Hunter | AirdropsPageClient, grid of airdrop cards |
| `/airdrops/[id]` | Airdrop Detail | AirdropDetailClient, TaskList, AiReportStructured |
| `/archive` | Article Archive | ArchivePageClient, year/month grouping |
| `/settings` | User Settings | PricingCards, PreferencesPanel, WalletManager, ApiKeyManager, OgBadge |
| `/about` | About | Static page |
| `/auth` | Authentication | Login/Register |
| `/privacy` | Privacy Policy | Static legal page |
| `/terms` | Terms of Service | Static legal page |
| `/disclaimer` | Disclaimer | Static legal page with NFA warnings |
| `/contact` | Contact | Static page |

### (terminal) — Terminal Layout
Full-width layout optimized for deep coin analysis. No Sidebar.

| Route | Page | Key Components |
|---|---|---|
| `/terminal` | Terminal Landing | Redirects to default coin |
| `/terminal/[coin]` | Alpha Terminal | TerminalPageClient, LivingArticle, TimelineFeed, TerminalChart, TerminalChat, AlphaStream, DeepDiveSection |
| `/terminal/[coin]/alpha` | Alpha Page | Alternative terminal view |
