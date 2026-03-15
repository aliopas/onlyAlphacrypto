# OnlyAlpha Specification

This document defines the core behaviors and technical requirements for the OnlyAlpha platform. It serves as the source of truth for auditing the implementation.

## 1. AI-Powered Web3 Intelligence Synthesis

### Behavior
The system must automatically discover trending Web3 assets, aggregate real-time on-chain data and off-chain sentiment, and synthesize this information using a Large Language Model (LLM) to produce actionable market insights and risk verdicts.

**Detailed Workflow:**
1.  **Discovery:** Identify top boosted tokens and trending topics.
2.  **Aggregation:** Fetch live price, liquidity, and volume from DEXs, and news/sentiment from social sources.
3.  **Synthesis:** Pass aggregated data to an LLM to generate a `STRONG_BUY`, `BUY`, `NEUTRAL`, `SELL`, or `STRONG_SELL` verdict with a confidence score and risk assessment.
4.  **Persistence:** Store the generated insights and trigger real-time signals for high-impact events.

### Evidence
- **Orchestration Logic:** The hourly workflow that coordinates discovery, aggregation, and synthesis is implemented in `backend/src/crons/aiWorkflow.cron.ts`.
- **Web3 Data Retrieval:** Integration with DexScreener for real-time token stats is located in `backend/src/services/dexscreener.service.ts`.
- **LLM Integration:** The prompt engineering and interaction with the AI models (DeepSeek-R1/GLM-5) are defined in `backend/src/services/openai.service.ts`.
- **Data Schema:** The storage structure for these synthesized insights is defined in `backend/src/models/market.model.ts` under the `market_insights` table.
- **API Delivery:** The synthesized data is served to the frontend via the `/api/market/insights` and `/api/market/alpha-focus` endpoints in `backend/src/controllers/market.controller.ts`.

---

## 2. Global Market Sentiment (Market Mood)

### Behavior
The system must calculate a daily "Market Mood" score (0-100) by blending external Fear & Greed indices with internal AI-processed sentiment derived from real-time radar signals.

### Evidence
- **Calculation Logic:** `backend/src/crons/marketMood.cron.ts`
- **External Data:** `backend/src/services/binance.service.ts` (Fear & Greed fetcher)
- **Persistence:** `backend/src/models/market.model.ts` (table: `daily_market_mood`)

---

## 3. Real-Time Alpha Radar

### Behavior
The system must maintain a live stream of high-impact AI signals. A signal is only promoted to the Radar if it meets specific thresholds for impact or indicates a significant risk (e.g., Scam detection or Strong Buy verdict).

### Evidence
- **Signal Generation:** `backend/src/crons/aiWorkflow.cron.ts` (Phase 4: Publisher)
---

## 4. Smart Data Deduplication (Cost Optimization)

### Behavior
The system must prevent redundant AI processing by implementing a hashing mechanism for all incoming news and social data. 
1.  **Hashing:** Every headline or news item must be hashed (SHA-256) upon retrieval.
2.  **Pre-Analysis Check:** Before the "Brain" phase (LLM request), the system must query the `coin_news` table for existing hashes from the last 24 hours.
3.  **Data Filtering:** If a headline has already been processed, the system must skip re-sending it to the LLM and instead reuse existing sentiment/impact data where applicable, or only send "delta" news (new information) to the Brain.

### Evidence
- **Hashing Logic:** `backend/src/crons/aiWorkflow.cron.ts`
- **Database Index:** `backend/src/models/market.model.ts` (column: `source_hash`)
- **Deduplication Check:** `backend/src/crons/aiWorkflow.cron.ts` (Phase 2 & 3 transition)

---

## 5. Adaptive Model Routing (Intelligence Efficiency)

### Behavior
The system must dynamically route data to different AI models based on the complexity and priority of the asset to minimize token costs without sacrificing accuracy.
1.  **Tier-1 Reasoning (Complex):** Use high-reasoning models (e.g., DeepSeek-R1, GLM-4) for assets with high volatility (>10% 24h), high social volume, or conflicting news signals.
2.  **Tier-2 Fast (Routine):** Use lightweight, cost-effective models (e.g., GPT-4o-mini, GLM-5-nano) for routine price updates, assets with < 3 news items, or low-volatility tracking.

### Evidence
- **Routing Logic:** `backend/src/services/openai.service.ts`
- **Model Selection Logic:** `backend/src/crons/aiWorkflow.cron.ts` (Phase 3: Brain)
