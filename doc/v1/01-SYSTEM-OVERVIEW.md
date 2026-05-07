# 01 — System Overview

## What Is OnlyAlpha?

OnlyAlpha is a multi-agent AI crypto intelligence platform. It is NOT a news aggregator. It ingests raw market data from multiple sources, runs AI-powered triage and analysis, and produces **Living Articles** (evolving documents per coin), **Radar Signals** (actionable market scenarios), and **Conviction Scores** (algorithmic confidence ratings).

## Core Principle

```
The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.
```

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend Runtime | Node.js | 20+ |
| Backend Framework | Express | 5 |
| Language | TypeScript (Strict, zero `any`) | 5.x |
| ORM | Drizzle ORM | 0.45+ |
| Database | PostgreSQL | 16+ |
| Vector Search | pgvector | 0.2+ |
| Cache / Locks | Redis (ioredis) | 5.10+ (optional) |
| Frontend | Next.js (App Router) | 16 |
| UI Framework | React | 19 |
| Styling | Tailwind CSS | 4 |
| Animations | Framer Motion | 12.35+ |
| Charts | TradingView Lightweight Charts | 4.1+ |

## AI Providers

| Provider | Role | Models |
|---|---|---|
| OpenRouter | Primary gateway (chat, SEO, writing) | GPT-5-nano, GPT-4.1-mini, Gemini 2.5 Flash |
| DeepSeek Direct | Analysis engine (when key is set) | deepseek-reasoner |
| GLM / Zhipu AI | Web search + airdrop enrichment | glm-4.5-air (web_search tool) |

## Data Sources

| Source | Data Type |
|---|---|
| Binance | Prices, 24h stats, klines, volume |
| Moralis | On-chain wallet/token data |
| RSS Feeds (4) | CoinDesk, CoinTelegraph, Decrypt, The Block |
| Telegram (7 channels) | News + airdrop signals via MTProto |
| Alternative.me | Fear & Greed Index |
| DeFiLlama | Airdrop protocol discovery |
| DexScreener | DEX trending tokens |
| Birdeye | DEX candle data |

## Tracked Coins (30 in Frontend Constants)

```
BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI,
ATOM, NEAR, APT, ARB, OP, SUI, SEI, TIA, JUP, WIF, PEPE, FLOKI,
INJ, FTM, RENDER, AAVE, MKR, SNX
```

Note: The v2 plan (nextstep2.md) will reduce this to 11 tracked coins.

## The Pipeline at a Glance

```
RSS Feeds + Telegram Channels
        │
        ▼
   raw_news_buffer (TTL 48h)
        │
        ▼
   TriageEngine (AI classifies 50 items / 2h)
        │
   ┌────┼────┐
   ▼    ▼    ▼
 NOISE MINOR MAJOR
   │    │    │
 SKIP  AiWorkflow (hourly)
       │    │
       │    ├─ DeepSeek Deep Analysis
       │    ├─ Article Writer (Gemini 2.5 Flash)
       │    ├─ Quality Audit (if impact >= 75)
       │    ├─ Radar Signal (if actionable)
       │    ├─ Strategic Outlook (if MAJOR + impact >= 70)
       │    ├─ Coin Memory Update
       │    └─ Embedding Storage (pgvector)
       │
       └─ Minor Update (GPT-5-nano 1-2 paragraph update)
```

## Key Concepts

### Living Articles
One persistent article per coin that evolves with the market. Instead of 50 separate articles about BTC, there is one **Master Article** that gets updated with MAJOR and MINOR events.

### Conviction Score
Algorithmic score 0-100 with **zero AI cost**. Starts at 50 (neutral), adjusted by event impact/severity, with bearish events weighted 40% heavier. Time decay pushes toward 50 at 1% per 6h cycle.

### Radar Signals
When an event produces an actionable verdict (Bullish/Bearish), a radar signal is created. Each signal gets tracked for P&L at 24h/7d/30d intervals.

### Signal Lifecycle (v1)
Binary: `Active` → `Completed` (TP hit, SL hit, or expired). The signal manager prevents duplicate signals per coin.

### Safe Public Language
All user-facing text uses AdSense-safe terminology: "Market Scenario" instead of "Signal", "Target Zone" instead of "Take Profit", "Risk Zone" instead of "Stop Loss".
