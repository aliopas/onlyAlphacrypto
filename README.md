# OnlyAlpha — AI-Native Crypto Intelligence Platform

Actionable market intelligence synthesized by multi-agent AI. Real-time alpha discovery. Zero-noise terminal.

---

## Table of Contents

- [Project Vision](#project-vision)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)
- [Database & Migrations](#database--migrations)
- [Vector Search (pgvector)](#vector-search-pgvector)
- [Core Architecture](#core-architecture)
- [Cron Jobs](#cron-jobs)
- [Running the Application](#running-the-application)
- [Folder Structure](#folder-structure)
- [Development Notes](#development-notes)

---

## Project Vision

OnlyAlpha is a full-stack, AI-native crypto intelligence platform that transforms raw market noise into actionable trading intelligence. The system implements a **Sense-Think-Act** pipeline:

1. **Sense** — Ingests news from RSS, CryptoPanic, Reddit, DexScreener, and Binance.
2. **Think** — AI triage classifies events (MAJOR / MINOR / NOISE), generates deep analysis via DeepSeek-R1, and produces SEO-optimized articles via GPT-5-nano.
3. **Act** — Living Articles are continuously updated, conviction scores shift incrementally, and high-impact signals are promoted to the Alpha Radar.

### Key Capabilities

| Capability | Description |
|---|---|
| **Living Articles** | One persistent Master Article per coin, continuously updated with timeline events |
| **AI Triage Engine** | 3-path classification: NOISE (skip), MINOR (timeline only), MAJOR (full pipeline) |
| **Semantic Deduplication** | pgvector embeddings with cosine similarity >= 0.88, keyword fallback |
| **Incremental Conviction Score** | Algorithmic scoring (0-100) with 1% mean-reversion decay, no AI cost |
| **Context-Aware Pro Chat** | AI chat powered by Master Articles + Timeline + Coin Memory |
| **Dual AI Gateway** | OpenRouter (GPT-5-nano for writing) + DeepSeek Direct (analysis & reasoning) |

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | React framework with SSR/SSG |
| React 19 | UI library |
| Tailwind CSS 4 | Utility-first styling |
| Framer Motion | Animations |
| Lightweight Charts (TradingView) | Financial chart rendering |
| Lucide React | Icon library |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + TypeScript | Runtime |
| Express 5 | HTTP framework |
| Drizzle ORM | Type-safe database queries |
| PostgreSQL (Neon) | Primary database |
| pgvector | Vector similarity search |
| Redis (ioredis) | Caching, rate limiting, cron locks |
| node-cron | Scheduled task runner |
| Winston | Structured logging |
| Zod | Runtime type validation |

### AI & Data Layer

| Technology | Purpose |
|---|---|
| OpenRouter | GPT-5-nano (writing, chat, triage, embeddings) |
| DeepSeek Direct | Deep analysis & reasoning |
| OpenAI SDK | API client for both gateways |
| Moralis | On-chain wallet & token tracking |
| Binance API | Market data & pricing |
| DexScreener | DEX trending tokens & liquidity |
| Tavily | Emergency search fallback |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                │
│  Home / Terminal / Settings / Chat / Airdrop Watchlist      │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                    BACKEND (Express 5)                       │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────────┐ │
│  │ Routes   │→│ Controllers│→│ Services                  │ │
│  └──────────┘  └───────────┘  │  ├─ AI Gateway (dual)    │ │
│                               │  ├─ Cache Manager         │ │
│  ┌──────────────────────────┐ │  ├─ Prompt Factory        │ │
│  │ Cron Jobs (9 scheduled) │→│  ├─ Quality Auditor        │ │
│  └──────────────────────────┘ │  ├─ Factual Grounding     │ │
│                               │  └─ Embedding Service     │ │
│  ┌──────────────────────────┐ └──────────────────────────┘ │
│  │ Middleware               │  Auth │ Rate Limit │ Quotas  │
│  └──────────────────────────┘                              │
└──────┬────────────────┬────────────────┬───────────────────┘
       │                │                │
  ┌────▼────┐    ┌──────▼──────┐  ┌─────▼──────┐
  │  Postgres │    │   Redis     │  │  AI APIs   │
  │  (Neon)  │    │ (Cache/Lock)│  │ OpenRouter │
  │  pgvector│    │             │  │ DeepSeek   │
  └─────────┘    └─────────────┘  └────────────┘
```

---

## Prerequisites

- **Node.js** v20+ (LTS recommended)
- **npm** v10+
- **PostgreSQL** v14+ (or a [Neon.tech](https://neon.tech) account)
- **Redis** (optional for local dev, required for production rate limiting and caching)

---

## Environment Variables

Create `backend/.env` based on `backend/.env.example`. All variables are validated at startup via Zod.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, or local) |
| `JWT_SECRET` | Secret for signing auth tokens (min 32 chars) |
| `OPENROUTER_API_KEY` | OpenRouter API key for GPT-5-nano access |
| `MORALIS_API_KEY` | Moralis API key for on-chain data |

### Optional

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `5000` | Backend server port |
| `REDIS_URL` | — | Redis connection string (omit to disable caching) |
| `JWT_EXPIRES_IN` | `7d` | Token expiration |
| `SEO_MODEL` | `openai/gpt-5-nano` | Model for article writing and chat |
| `DEEPSEEK_MODEL` | `deepseek/deepseek-r1` | DeepSeek model via OpenRouter |
| `DEEPSEEK_API_KEY` | — | Direct DeepSeek API key (bypasses OpenRouter) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Direct DeepSeek endpoint |
| `DEEPSEEK_MODEL_DIRECT` | `deepseek-chat` | Direct DeepSeek model name |
| `GLM_API_KEY` | — | Zhipu AI (GLM) API key |
| `GLM_MODEL` | `glm-4-plus` | GLM model name |
| `BINANCE_API_KEY` | — | Binance authenticated requests |
| `BINANCE_SECRET` | — | Binance secret key |
| `TAVILY_API_KEY` | — | Tavily search API (emergency fallback) |
| `BIRDEYE_API_KEY` | — | Birdeye API for DEX chart candles |
| `COINCAP_API_KEY` | — | CoinCap API key |
| `EMBEDDING_PROVIDER` | `openrouter` | `openrouter` or `ollama` |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | Embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama instance |
| `NEXTJS_REVALIDATE_SECRET` | — | Secret for Next.js ISR revalidation |
| `NEXTJS_BASE_URL` | — | Next.js app URL for cache revalidation |

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/onlyalpha.git
cd onlyalpha
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run db:push
```

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local if needed (NEXT_PUBLIC_API_URL, etc.)
```

---

## Database & Migrations

OnlyAlpha uses [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL. Schema is defined in `backend/src/models/`.

### Run Migrations

```bash
cd backend

# Push schema directly (development)
npm run db:push

# Generate migration SQL files
npm run db:generate

# Run generated migrations
npm run db:migrate

# Open Drizzle Studio (visual DB browser)
npm run db:studio
```

### Database Tables

| Table | Purpose |
|---|---|
| `users` | User accounts with plan tiers (free/pro/institutional) |
| `user_wallets` | Tracked Web3 wallet addresses |
| `api_keys` | API key management |
| `sessions` | Auth session tokens |
| `user_preferences` | Notification & coin preferences |
| `market_insights` | AI-generated verdicts per coin |
| `coin_news` | Published AI-processed news articles |
| `raw_news_buffer` | Incoming news awaiting triage (with TTL) |
| `radar_signals` | High-impact signals for Alpha Radar |
| `daily_alpha_focus` | Daily top pick |
| `daily_market_mood` | Aggregated fear/greed score |
| `price_snapshots` | Price history for timelines |
| `coin_memory` | AI event memory per coin |
| `coin_intelligence_cache` | Cached intelligence data (ATH, 52w ranges) |
| `coin_news_history` | Historical news for backtesting |
| `coin_master_articles` | Living Articles (one per coin) |
| `coin_timeline_updates` | Timeline events per Living Article |

---

## Vector Search (pgvector)

The system uses pgvector for semantic deduplication of incoming news articles.

### Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This is typically done automatically if using Neon, or manually on self-hosted PostgreSQL:

```bash
psql -U postgres -d onlyalpha -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### How It Works

1. Incoming news headlines are converted to 1536-dimension embeddings via OpenRouter (`text-embedding-3-small`) or Ollama (`nomic-embed-text`).
2. Embeddings are compared against existing entries in `raw_news_buffer` using cosine similarity.
3. Articles with similarity >= 0.88 are flagged as duplicates and skipped before any AI processing.
4. Falls back to keyword-based dedup if the embedding service is unavailable.

---

## Core Architecture

### 1. The Gathering Engine (TerminalEngine)

**File:** `backend/src/crons/terminalEngine.cron.ts`
**Schedule:** Every 10 minutes

Fetches crypto news from multiple RSS sources, hashes each headline (SHA-256), and inserts unique entries into `raw_news_buffer` with a TTL.

### 2. The Triage Engine

**File:** `backend/src/crons/triageEngine.cron.ts`

Processes unbuffered news items (up to 50 per run) through a lightweight AI call (GPT-5-nano) to classify each item:
- **NOISE** — Irrelevant or duplicate, marked as processed and skipped
- **MINOR** — Timeline-worthy but not breaking
- **MAJOR** — Full AI pipeline triggered

### 3. The AI Workflow (The Brain)

**File:** `backend/src/crons/aiWorkflow.cron.ts`

The central intelligence pipeline with 3-path routing:

```
Raw News → Semantic Dedup → Triage Classification
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                  NOISE           MINOR           MAJOR
                  (skip)    (GPT-nano →       (Full Pipeline)
                           Timeline)     DeepSeek Analysis
                                         → GPT-nano Writing
                                         → Quality Audit
                                         → Factual Grounding
                                         → Coin Memory Save
                                         → Master Article Update
                                         → Conviction Delta
```

**Key features:**
- **Circuit Breakers** per model (DeepSeek, GPT-nano) to prevent runaway costs
- **Redis mutex lock** (`cron:aiworkflow:lock`, TTL 1h) prevents concurrent runs
- **Dynamic Threshold** adjusts sensitivity based on hourly news volume
- **3-attempt retry** for `generateDualNewsOutput`
- **Zero `any` types** — full type safety

### 4. Living Articles

Instead of publishing standalone articles, OnlyAlpha maintains **one Master Article per coin** (`coin_master_articles`). Each article has structured sections:

| Section | Content |
|---|---|
| `headline` | Dynamic headline reflecting latest thesis |
| `coreCatalyst` | Primary driver of the coin's current narrative |
| `marketContext` | Broader market conditions affecting the coin |
| `strategicImpact` | Forward-looking impact assessment |
| `historicalContext` | Relevant historical parallels |
| `technicalLevels` | Key support/resistance levels |
| `riskAssessment` | Identified risks and mitigations |
| `bottomLine` | Executive summary in one sentence |

Timeline updates (`coin_timeline_updates`) are appended as events occur, creating a living document that evolves with the market.

### 5. Incremental Conviction Score

**File:** `backend/src/services/conviction.service.ts`

A pure algorithmic scoring system (no AI cost):

- **Range:** 0 (maximum fear) to 100 (maximum conviction)
- **Event Delta:** Each timeline event shifts conviction based on severity (MAJOR: up to ±15, MINOR: up to ±5)
- **Time Decay:** 1% mean-reversion toward score 50 every 6 hours
- **Posture:** Derived from conviction score ranges (`BULLISH` > 65, `BEARISH` < 35, etc.)

### 6. AI Service Architecture

```
services/
├── ai/
│   ├── ai-gateway.ts        # Dual provider routing (OpenRouter + DeepSeek Direct)
│   ├── cache-manager.ts     # LRU cache for AI responses
│   ├── factual-grounding.ts # Verifies AI claims against retrieved data
│   ├── prompt-factory.ts    # Centralized prompt templates
│   └── quality-auditor.ts   # Post-generation quality scoring
├── openai.service.ts        # Main AI orchestration (analysis, writing, chat)
├── embedding.service.ts     # Text-to-vector generation + similarity search
├── similarity.service.ts    # Dedup coordinator (embedding + keyword fallback)
└── conviction.service.ts    # Algorithmic conviction scoring
```

---

## Cron Jobs

All crons start sequentially with a 5-second stagger on server boot. Registered in `backend/src/server.ts`.

| Cron | Schedule | Description |
|---|---|---|
| **AiWorkflow** | Every 10 min | Main AI pipeline: dedup → triage → analysis → article → memory |
| **TriageEngine** | Every 5 min | Classifies buffered news as NOISE / MINOR / MAJOR |
| **TerminalEngine** | Every 10 min | Gathers news from RSS sources into raw buffer |
| **ConvictionUpdate** | Every 6 hours | Recalculates conviction scores with incremental delta + time decay |
| **DailyAlpha** | Daily (08:00) | Selects the top STRONG_BUY coin for homepage spotlight |
| **MarketMood** | Every 30 min | Computes blended Fear & Greed score (external + internal) |
| **HistoricalNews** | Daily (03:00) | Backfills historical news and 7-day price outcomes |
| **BufferCleanup** | Hourly | Purges processed news past their TTL from the buffer |
| *AirdropHunter* | Disabled | Airdrop discovery engine (temporarily disabled) |

---

## Running the Application

### Development

```bash
# Terminal 1: Backend
cd backend
npm run dev          # Starts on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev          # Starts on http://localhost:3000
```

### Production

```bash
# Backend
cd backend
npm run build        # Compile TypeScript
npm start            # Runs dist/server.js

# Frontend
cd frontend
npm run build        # Next.js production build
npm start            # Runs on port 3000
```

### Database Studio

```bash
cd backend
npm run db:studio    # Opens Drizzle Studio at http://localhost:4983
```

### Health Check

```bash
curl http://localhost:5000/api/health
# → { "status": "ok", "db": "connected", "ts": "..." }
```

---

## Folder Structure

```
OnlyAlpha/
├── backend/
│   ├── src/
│   │   ├── config/           # Environment validation, DB/Redis connections
│   │   │   ├── db.ts
│   │   │   ├── env.ts        # Zod-validated env schema
│   │   │   └── redis.ts
│   │   ├── controllers/      # API endpoint handlers
│   │   │   ├── airdrop.controller.ts
│   │   │   ├── apiKey.controller.ts
│   │   │   ├── chart.controller.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── market.controller.ts
│   │   │   └── user.controller.ts
│   │   ├── crons/            # Scheduled tasks (9 active)
│   │   │   ├── aiWorkflow.cron.ts      # Main AI pipeline
│   │   │   ├── triageEngine.cron.ts    # News classification
│   │   │   ├── terminalEngine.cron.ts  # RSS news gathering
│   │   │   ├── convictionUpdate.cron.ts
│   │   │   ├── dailyAlpha.cron.ts
│   │   │   ├── marketMood.cron.ts
│   │   │   ├── historicalNews.cron.ts
│   │   │   ├── bufferCleanup.cron.ts
│   │   │   └── airdropHunter.cron.ts   # (disabled)
│   │   ├── middleware/        # Auth, rate limiting, quotas, error handling
│   │   ├── models/           # Drizzle ORM schema definitions
│   │   │   ├── index.ts
│   │   │   ├── market.model.ts    # 13 market tables
│   │   │   ├── user.model.ts      # 5 user tables
│   │   │   └── airdrop.model.ts
│   │   ├── routes/           # Express route definitions
│   │   ├── services/         # Business logic & integrations
│   │   │   ├── ai/           # AI infrastructure (gateway, cache, prompts, audit)
│   │   │   ├── binance.service.ts
│   │   │   ├── openai.service.ts    # AI orchestration
│   │   │   ├── embedding.service.ts # pgvector embeddings
│   │   │   ├── similarity.service.ts
│   │   │   ├── conviction.service.ts
│   │   │   └── ... (20+ service files)
│   │   ├── scripts/          # One-time seed/backfill scripts
│   │   └── utils/            # Logger and utilities
│   ├── drizzle/              # Generated SQL migrations
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── terminal/[coin]/alpha/  # Living Article view
│   │   │   └── ...
│   │   ├── features/         # Feature-encapsulated modules
│   │   │   ├── terminal/     # Terminal, Wire, Radar, Alpha components
│   │   │   ├── home/         # Homepage widgets
│   │   │   ├── chat/         # Pro Chat
│   │   │   ├── settings/     # User settings & billing
│   │   │   └── ...
│   │   ├── lib/              # Global utilities
│   │   └── components/       # Shared UI components
│   ├── public/
│   └── package.json
├── netlify.toml              # CI/CD configuration
└── agent_gedens/             # Multi-agent development logs
```

---

## Development Notes

### Type Safety

- **Zero `any` types** enforced across all code. Use `unknown`, generics, or specific interfaces.
- Environment variables are validated at startup with Zod — the server will not start if required variables are missing or invalid.

### AI Cost Optimization

- **Triage-first routing:** Only MAJOR events trigger the expensive DeepSeek analysis.
- **Semantic dedup:** Embedding comparison prevents re-processing identical news.
- **Keyword fallback:** If embedding service is down, keyword matching still prevents duplicates at zero cost.
- **Circuit breakers:** Per-model circuit breakers (`services/circuitBreaker.service.ts`) prevent runaway API costs.
- **Conviction scoring:** Pure algorithmic — no AI calls, runs every 6 hours.

### Chat Quotas

Redis-based chat quotas are enforced per plan tier:

| Tier | Messages / Day | Context Messages |
|---|---|---|
| Guest | 5 | — |
| Free | 15 | — |
| Pro | 999 | 30 |

If Redis is unavailable, requests fall through without blocking users.

### Code Conventions

- All code is TypeScript with strict mode
- Service layer is separated from controllers
- AI prompts are centralized in `services/ai/prompt-factory.ts`
- Cache management is handled by `services/ai/cache-manager.ts`
- All cron jobs use mutex locks to prevent concurrent execution

---

Built for the next generation of Web3 traders.
