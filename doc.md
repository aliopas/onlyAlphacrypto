# OnlyAlpha - Project State & Architecture

This document provides a comprehensive overview of the current state of the OnlyAlpha project as of March 15, 2026.

## 🚀 Overview
OnlyAlpha is an AI-powered Web3 intelligence platform designed to provide real-time market insights, airdrop tracking, and a terminal for deep-dive token analysis. It leverages multiple data sources and LLMs to provide "Alpha" to users.

---

## 🏗️ Architecture

### Backend (Node.js / Express / TypeScript)
- **Framework**: Express with TypeScript.
- **ORM**: Drizzle ORM (PostgreSQL via Neon).
- **Cache/Rate Limiting**: ioredis.
- **Security**: JWT authentication, bcryptjs, helmet, and API key management.
- **External Integrations**:
    - **OpenAI**: Core AI engine for analysis, sentiment, and radar signals.
    - **Binance / DexScreener**: Price and volume data.
    - **Moralis**: Web3 data (wallets, tokens, transactions).
    - **CryptoPanic / Reddit**: Sentiment and news aggregation.
    - **Tavily**: AI-powered web search for real-time data.

### Frontend (Next.js 15+ / TypeScript)
- **Framework**: Next.js (App Router).
- **Styling**: Tailwind CSS 4.0 (with @tailwindcss/postcss).
- **Animation**: Framer Motion.
- **Icons**: Lucide React.
- **Data Fetching**: Axios-based `apiClient` with support for both live and mock data (via `NEXT_PUBLIC_API_MODE`).

---

## 📂 Project Structure

### Backend (`/backend`)
- `src/server.ts`: Entry point.
- `src/config/`: Database, Redis, and Environment configurations.
- `src/controllers/`: Business logic for Airdrops, API Keys, Chat, Market, and Users.
- `src/crons/`: Automated background tasks:
    - `airdropHunter`: Scrapes/updates airdrop data.
    - `aiWorkflow`: Processes raw data into AI insights.
    - `terminalEngine`: Populates the real-time market wire.
    - `dailyAlpha`: Picks the "Alpha of the Day".
    - `marketMood`: Calculates global sentiment.
- `src/models/`: Drizzle schema definitions (PostgreSQL).
- `src/services/`: Wrappers for external APIs.

### Frontend (`/frontend`)
- `src/app/`: Next.js pages and layouts.
- `src/features/`: Domain-driven component organization:
    - `airdrop/`: Task tracking and verification UI.
    - `home/`: Market mood gauge, alpha focus cards, and radar grid.
    - `settings/`: API key and wallet management.
    - `terminal/`: Real-time analysis stream and AI chat.
    - `shared/`: Common API clients, types, and UI components.

---

## 📊 Database Schema (Drizzle)
- **Users**: Authentication, plans, and preferences.
- **Wallets**: Linked Web3 addresses for tracking and verification.
- **Market Insights**: AI-generated verdicts (STRONG_BUY, etc.), confidence scores, and executive summaries.
- **Coin News / Radar**: Aggregated headlines and real-time AI signals.
- **Airdrops**: Project details, task lists, and user progress tracking.

---

## ✅ Current Progress & Features

### Working Features:
1.  **AI Radar**: Live-updating stream of AI-processed signals (sentiment + impact).
2.  **Market Mood**: Aggregated sentiment gauge (Fear & Greed index + Internal AI analysis).
3.  **Alpha Focus**: Daily deep-dive on a specific coin with executive summaries and levels.
4.  **Airdrop Tracker**: List of active airdrops with task-level verification (Auto/Manual).
5.  **Terminal**: A unified view for token analysis with an AI stream and news feed.
6.  **API Integration**: Core services for Binance, Moralis, and OpenAI are fully implemented.
7.  **Authentication**: JWT-based auth flow with session management and API key support.

### Next Steps / Roadmap:
- [ ] Complete the Web3 Wallet Engine for automated on-chain verification.
- [ ] Implement institutional-grade API key permissions.
- [ ] Enhance the Terminal Chat with real-time Tavily search integration.
- [ ] Refine the AI Workflow cron for better sentiment accuracy.

---

## 🛠️ How to Run

### Backend
1.  `cd backend`
2.  `npm install`
3.  Configure `.env` (DATABASE_URL, OPENAI_API_KEY, etc.)
4.  `npm run dev`

### Frontend
1.  `cd frontend`
2.  `npm install`
3.  `npm run dev`
4.  Set `NEXT_PUBLIC_API_MODE=live` in `.env` to connect to the backend.

---

*This document is auto-generated to reflect the current state of the OnlyAlpha codebase.*
