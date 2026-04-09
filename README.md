# 🌌 OnlyAlpha: AI-Powered Web3 Intelligence Synthesis

🚀 **Actionable market insights. Real-time Alpha discovery. Zero-noise intelligence.**

OnlyAlpha is a sophisticated Web3 intelligence engine designed to cut through the noise of the crypto market. By combining real-time on-chain data with deep off-chain sentiment analysis and Large Language Model (LLM) reasoning, it identifies "Alpha" opportunities before they hit the mainstream.

![OnlyAlpha Terminal](terminal-production.png)

---

## 📖 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Installation & Local Setup](#installation--local-setup)
6. [Running the Application](#running-the-application)
7. [Folder Structure](#folder-structure)
8. [Core Features & API Details](#core-features--api-details)
9. [Known Issues & Future Improvements](#known-issues--future-improvements)

---

## 🏛 Project Overview
OnlyAlpha solves the problem of **information overload** in Web3. Traders often struggle to monitor dozens of social feeds, news sites, and DEX charts simultaneously. 

The platform implements a **"Sense-Think-Act"** workflow:
- **Discovery:** Scans DEXs for trending tokens and RSS/Reddit for emerging narratives.
- **Aggregation:** Collects granular metadata, liquidity stats, and multi-source sentiment.
- **Synthesis (The Brain):** An ensemble of AI models processes the data to generate a market verdict (`STRONG_BUY` through `STRONG_SELL`) with transparency on the reasoning.
- **Alerting:** High-impact signals are promoted to the "Alpha Radar" for immediate user attention.

---

## 💻 Architecture & Tech Stack

### Frontend
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
- **UI Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Data Visualization:** [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) (TradingView)
- **Icons:** [Lucide React](https://lucide.dev/)

### Backend
- **Runtime:** Node.js with TypeScript
- **Framework:** [Express 5](https://expressjs.com/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Database:** PostgreSQL (Optimized for [Neon](https://neon.tech/))
- **Caching & Rate Limiting:** Redis ([ioredis](https://github.com/luin/ioredis))
- **Scheduling:** [Node-cron](https://www.npmjs.com/package/node-cron)

### Intelligence Layer (AI & Data)
- **LLM Orchestration:** [OpenRouter](https://openrouter.ai/) (DeepSeek-R1, GPT-4o, GLM-4) & Direct GLM integration.
- **Market Data:** Binance API, DexScreener, Moralis (Web3/On-chain).
- **Social/News:** Reddit API, RSS Feeds, CryptoPanic, Tavily (Search).

---

## 🛠 Prerequisites
Ensure you have the following installed:
- **Node.js:** `v20.x` or higher (LTS recommended)
- **npm:** `v10.x` or higher
- **PostgreSQL:** `v14+` or a Neon.tech account
- **Redis Server:** (Optional for local dev, required for production rate limiting)

---

## 🔑 Environment Variables
Create a `.env` file in the `backend/` directory based on `.env.example`.

| Variable | Purpose | Source |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Neon, Supabase, or Local PG |
| `JWT_SECRET` | Secret key for signing Auth tokens | Random 64-character string |
| `OPENROUTER_API_KEY` | Access to DeepSeek, GPT-4, etc. | [OpenRouter.ai](https://openrouter.ai/) |
| `GLM_API_KEY` | Direct access to Zhipu AI models | [BigModel.cn](https://open.bigmodel.cn/) |
| `MORALIS_API_KEY` | On-chain wallet and token tracking | [Moralis.io](https://moralis.io/) |
| `REDIS_URL` | Redis connection for caching | Local or Upstash |
| `BINANCE_API_KEY` | Optional for authenticated market data | Binance Dashboard |
| `TAVILY_API_KEY` | AI search for deep intelligence | [Tavily.com](https://tavily.com/) |

---

## 🚀 Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/onlyalpha.git
cd onlyalpha
```

### 2. Backend Setup
```bash
# Navigate to backend
cd backend
# Install dependencies
npm install
# Copy environment template
cp .env.example .env
# Sync database schema with Drizzle
npm run db:push
```

### 3. Frontend Setup
```bash
# Navigate to frontend
cd ../frontend
# Install dependencies
npm install
# Setup local environment
cp .env.example .env.local
```

---

## 🏃 Running the Application

### Development Mode
Start both servers to begin development:
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Database Management
```bash
# Open Drizzle Studio to view your PostgreSQL data in a browser
cd backend
npm run db:studio
```

### Production Build
```bash
# Backend Build & Start
cd backend
npm run build
npm start

# Frontend Build & Start
cd frontend
npm run build
npm start
```

---

## 📁 Folder Structure

```text
OnlyAlpha/
├── backend/
│   ├── src/
│   │   ├── config/       # Env variables and database connectors
│   │   ├── controllers/  # Logic handlers for API endpoints
│   │   ├── crons/        # Scheduled tasks (AI Workflows, Market Mood)
│   │   ├── middleware/   # Request interception (Auth, Validation)
│   │   ├── models/       # Drizzle database schema definitions
│   │   ├── routes/       # API route mappings
│   │   ├── services/     # Third-party integrations (Moralis, AI, DEX)
│   │   └── utils/        # Generic utility functions (Hashing, Formatting)
│   └── drizzle/          # Generated SQL migration files
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js 16 Pages, Layouts, and API routes
│   │   ├── features/     # Feature-encapsulated components and hooks
│   │   ├── lib/          # Global utility functions and API clients
│   │   └── components/   # Atomic and molecular reusable UI
│   └── public/           # Static images, logos, and icons
└── netlify.toml          # CI/CD instructions for Netlify deployment
```

---

## 🧠 Core Features & API Details

### 1. AI Intelligence Pipeline (The "Brain")
Orchestrated in `backend/src/crons/aiWorkflow.cron.ts`, this system runs continuously:
- **Discovery:** Scrapes DexScreener's top boosted tokens and RSS feeds.
- **Smart Hashing:** Every headline is hashed (SHA-256) to ensure we don't pay AI tokens to analyze the same news twice.
- **Adaptive Model Routing:** Complex data is sent to high-reasoning models (DeepSeek-R1), while routine stats use cost-efficient models (GLM-5).

### 2. Alpha Radar (High-Impact Signals)
A refined stream of indicators. A signal is promoted to the Radar only if it meets strict quality or risk thresholds (e.g., Whale movement detected or Scam vulnerability).
- **Endpoint:** `GET /api/market/alpha-focus`

### 3. Global Market "Mood"
A proprietary calculation that blends the quantitative Fear & Greed index with qualitative AI sentiment analysis of the last 24 hours.
- **Endpoint:** `GET /api/market/mood`

### 4. DEX & On-Chain Integration
Direct integration with Moralis and DexScreener to pull live liquidity, volume, and holder metrics, providing a factual baseline for AI reasoning.

---

## 🚧 Known Issues & Future Improvements

### ⚠️ Known Issues
- **Signal Redundancy:** Some signals may appear twice in the Radar due to technical overlap between the main workflow and the backfill process.
- **Selection Visuals:** Clicking a news item in the terminal may highlight related duplicates if they share the same source ID.
- **Wire Pagination:** The Wire feed currently shows the 20 most recent items; "Load More" functionality is in development.

### 🌟 Roadmap
- [ ] **Twitter/X Integration:** Live sentiment tracking of major Web3 influencers.
- [ ] **Deep Wallet Tracking:** Real-time alerts when "Smart Money" addresses buy a new token.
- [ ] **Automated Backtesting:** Validating AI verdicts against subsequent price action.
- [ ] **Native Mobile App:** Push notifications for "Strong Buy" signals on iOS/Android.

---
🚀 **Built for the next generation of Web3 Traders.**
