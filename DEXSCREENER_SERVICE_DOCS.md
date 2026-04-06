# 📊 DexScreener Price & Hype Architecture (OnlyAlpha)

This document explains the integration of the **DexScreener API**, which serves as our primary source for real-time price data and "Degen/Meme" hype signals. This is the **FREE** engine that allows OnlyAlpha to track new gems that haven't hit major exchanges like Binance yet.

---

## 1. Why DexScreener?
Unlike traditional aggregators (CoinDesk/CoinMarketCap), DexScreener is **100% open-access** for developers:
- **No API Key Required:** No risk of key invalidation or billing surprises.
- **Micro-Cap Coverage:** Supports every token on Solana, Base, Ethereum, etc., from the moment they launch.
- **High Rate Limits:** Up to 300 requests/minute for price data (more than enough for our 10m cron).

## 2. Technical Implementation
- **Base URL:** `https://api.dexscreener.com/latest/dex`
- **Authentication:** None (Public).

### Key Endpoints for OnlyAlpha:
1. **Price Lookups (`/tokens/{address}`):** Fetches the current price, liquidity, and volume for any specific token address.
2. **Search (`/search?q={query}`):** Finds pairs by pair address, token address, or symbol.
3. **Trends/Boosts (`/token-boosts/top/v1`):** Gets the coins that are currently receiving active community engagement ("Hype").

## 3. The "Hype Trigger" Logic
DexScreener doesn't just give us prices; it gives us **Volume/Liquidity ratios**.
- If a coin from our **RSS News** feed shows a massive spike in DexScreener **Volume (24h)**, the AI flags it as a "High-Intensity" opportunity.
- If a new token appears in the **Trending/Boosts** endpoint and matches common keywords from our **Reddit Service**, it triggers a "Deep Project Analysis."

## 4. Rate Limit Breakdown (2026 Policy)
- **Token Profiles / Boosts:** 60 requests per minute.
- **Price / Search:** 300 requests per minute.

## 5. Maintenance
The system uses the standard `axios` library for all calls. Since no API key is required, no `.env` updates are needed for this specific service.

---
**Status:** ✅ Architecture Verified  
**Cost:** $0.00/month (Enterprise Grade Data)  
**Best For:** New Gems, Memecoins, and DEX-exclusive projects.
