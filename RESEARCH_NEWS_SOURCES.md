# 📑 OnlyAlpha — Crypto News Source Research Report
> **Objective:** Identify a sustainable, free, and real-time alternative to CryptoCompare/CryptoPanic/CoinDesk APIs.

---

## 1. NewsData.io (The Aggregator)

| Category | Details |
| :--- | :--- |
| **Daily Limit** | 200 Requests (Free Plan) |
| **Features** | Crypto-specific categories, multi-language support. |
| **Latency** | **🔴 12-Hour Delay** (Free plan articles are not real-time). |
| **Content** | Headline and short snippet only (no full body). |
| **Verdict** | **REJECTED.** A 12-hour delay is fatal for a "Deep Intelligence" terminal that needs to catch alpha as it happens. |

---

## 2. CoinGecko API (The Data Giant)

| Category | Details |
| :--- | :--- |
| **Daily Limit** | 10k requests/month (approx 330/day). |
| **News Access** | **🔴 PRO ONLY.** The `/news` endpoint was removed from the Public (Demo) API in late 2024. |
| **Features** | Excellent for prices and market caps, zero for headlines. |
| **Verdict** | **REJECTED.** Cannot be used for news gathering without a paid subscription. |

---

## 3. Direct RSS Scraper (The "Alpha" Path)

| Category | Details |
| :--- | :--- |
| **Daily Limit** | **🟢 UNLIMITED.** No API keys, no quotas. |
| **Latency** | **🟢 REAL-TIME.** RSS feeds update the second an editor hits "Publish." |
| **Sources** | CoinDesk, Cointelegraph, Decrypt, The Block, Bitcoin Magazine. |
| **Implementation** | Requires a simple XML parser (`rss-parser`) in the backend. |
| **Verdict** | **WINNER (Selected Path).** This is the most professional used by high-end news aggregators to ensure 100% uptime and zero cost. |

---

## 4. Hype & Trend Data (The Trigger Sources)

To fulfill the "Hype-driven" nature of OnlyAlpha, we need to know what people are talking about. Here are the **Free** 2026 sources:

### 📍 CoinGecko Trending (`/search/trending`)
- **Status:** **🟢 FREE** (Public API).
- **Function:** Returns the top 7 most searched coins in 24h.
- **Role:** The "Mainstream Hype" detector.

### 📍 DexScreener Boosts (`/token-boosts/latest/v1`)
- **Status:** **🟢 FREE** (Open API).
- **Function:** Returns tokens getting active community "boosts" or engagement.
- **Role:** The "Degen/Meme Hype" detector for new gems.

### 📍 Reddit (r/CryptoCurrency)
- **Status:** **🟢 FREE** (JSON logic exists in our code).
- **Function:** Fetches hot topics and sentiment from the world's largest crypto community.
- **Role:** The "Community Discourse" detector.

---

## 🛠️ The Recommendation: "Multi-Source RSS Harvester"

Instead of relying on one "middleman" API that can change its pricing at any time (as CryptoPanic just did), we will build a dedicated service that scrapes the top crypto publishers directly.

### 📍 Phase 1: The RSS Source List
We will target these specific URLs:
1. **CoinDesk:** `https://www.coindesk.com/arc/outboundfeeds/rss`
2. **Cointelegraph:** `https://cointelegraph.com/rss`
3. **Decrypt:** `https://decrypt.co/feed`
4. **The Block:** `https://www.theblock.co/rss.xml`

### 📍 Phase 2: Technical Strategy
* **Package:** Install `rss-parser` (lightweight and fast).
* **Service:** Create `rssNews.service.ts` to replace `cryptocompare.service.ts`.
* **Flow:** The `TerminalEngine` cron will loop through the RSS list every 10 minutes, parse the XML, and push items into our DB with the same deduplication logic we already have.

---

## 🚀 Execution Plan for Tech Lead:

1. **Step 1:** Run `npm install rss-parser` in the backend.
2. **Step 2:** Create the `rssNews.service.ts` using the URLs above.
3. **Step 3:** Update `terminalEngine.cron.ts` to call the RSS service instead of the failed CryptoCompare URL.
4. **Step 4:** Clear the `raw_news_buffer` and restart the engine to see the new real-time feed.

---
**Approved by:** AI Director of Engineering  
**Date:** 2026-04-02
