# 🗞️ RSS Intelligence Architecture (OnlyAlpha)

This document outlines the design and implementation of the **RSS News Harvester**, which serves as the primary data gathering engine for the OnlyAlpha platform. This replaces failed third-party APIs (CryptoCompare/CoinDesk) with a more sustainable, real-time, and zero-cost solution.

---

## 1. Design Philosophy
Instead of relying on a "Middleman" API (Aggregator), OnlyAlpha now connects directly to the primary sources of truth (The Publishers). This ensures:
- **Zero Latency:** Get news the second it is published.
- **Independence:** No dependence on third-party pricing changes or API key invalidation.
- **Infinite Scalability:** Add as many sources as needed without increasing costs.

## 2. Technical Stack
- **Library:** `rss-parser` (Universal XML-to-JSON transformer).
- **Service:** `rssNews.service.ts` (Handles multiple concurrent fetches).
- **Orchestration:** `terminalEngine.cron.ts` (Triggers every 10 minutes).

## 3. Configured Sources (The "Alpha" List)
The current implementation polls the following high-authority feeds:

| Source | RSS URL | Type |
| :--- | :--- | :--- |
| **CoinDesk** | `https://www.coindesk.com/.../rss` | Legacy News & Markets |
| **Cointelegraph**| `https://cointelegraph.com/rss` | Global Breaking News |
| **Decrypt** | `https://decrypt.co/feed` | Web3 & Tech Analysis |
| **The Block** | `https://www.theblock.co/rss.xml` | Institutional Research |

## 4. The Processing Pipeline (No-Code Modification)
1. **Fetch:** The system hits the RSS URLs in parallel.
2. **Normalize:** Different RSS formats are standardized into a unified `RSSNewsItem` interface.
3. **Deduplicate:** title-based hashing ensures we don't analyze the same news twice across different sources.
4. **Buffer:** Raw data is pushed to `raw_news_buffer` for AI Triage.

## 5. Maintenance
To add a new source, simply append a new object to the `RSS_SOURCES` array in `rssNews.service.ts`. No other logic changes are required.

---
**Status:** ✅ Implementation Ready  
**Cost:** $0.00/month  
**Reliability:** 100% (Direct Source)
