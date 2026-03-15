# OnlyAlpha 🚀

OnlyAlpha is an AI-powered Web3 intelligence platform designed for discovery, synthesis, and actionable market signals. It combines real-time on-chain data with LLM reasoning to provide high-conviction "Alpha" for the crypto ecosystem.

---

## 🏗️ Architecture

### Backend (Node.js / Express / TypeScript / Drizzle)
- **Core Engine**: Express.js with TypeScript.
- **Database**: PostgreSQL (via Drizzle ORM).
- **AI Integrations**: OpenAI (GPT-4o, o1), DeepSeek-R1, and GLM-4/5 for synthesis.
- **Web3 Integrations**: Moralis, DexScreener, Binance, and Tavily for real-time search.
- **Workflow**: Automated crons for AI data processing, market mood calculation, and airdrop tracking.

### Frontend (Next.js 15+ / Tailwind CSS 4.0)
- **Framework**: Next.js (App Router).
- **Styling**: Tailwind CSS 4.0 with Framer Motion for smooth animations.
- **State Management**: React Hooks and Context.
- **Features**: Live AI Radar, Market Mood Gauge, Alpha Focus cards, Airdrop Tracker, and a dedicated analysis Terminal.

---

## 🚀 Key Features

1.  **AI-Powered Web3 Synthesis**: Automatically discovers trending tokens and processes them via LLMs to generate buy/sell verdicts.
2.  **Global Market Sentiment**: A "Market Mood" score calculated by blending Fear & Greed indices with internal AI-processed news.
3.  **Real-Time Alpha Radar**: A live stream of high-impact AI signals promoting only the most relevant market movements.
4.  **Smart Airdrop Tracker**: Discovery and verification of active airdrops with task-level tracking.
5.  **Terminal Interface**: A unified command center for token analysis, combining real-time news with AI-driven chat insights.
6.  **Cost Optimization**: Implements data deduplication (SHA-256 hashing) and adaptive model routing to minimize AI token costs.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- API Keys: OpenAI, Moralis, DexScreener (optional), Binance, and Tavily.

### Backend Setup
1.  Navigate to the backend directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Configure your environment: `cp .env.example .env` (Update with your keys)
4.  Run development server: `npm run dev`

### Frontend Setup
1.  Navigate to the frontend directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Run development server: `npm run dev`
4.  Visit `http://localhost:3000`

---

## 📂 Project Structure
- `/backend`: Core API, crons, models, and services.
- `/frontend`: Next.js application, UI components, and feature-based logic.
- `/doc`: Project documentation, specification, and AI workflow redesign plans.
- `/the desine`: Original HTML designs and layouts.

---

## 📝 License
Proprietary. All rights reserved.
