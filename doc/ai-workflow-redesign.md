# AI Workflow Redesign (A to Z)

## 1. Current Workflow (What happens right now)
- **Schedule:** `terminalEngine.cron.ts` runs strictly every 5 minutes.
- **Data Source:** Fetches news using a single CryptoCompare API endpoint.
- **Processing:** For every fetched news item (up to 5 per run), it immediately calls `generateDualNewsOutput` via the OpenAI service (`openrouter.ai`).
- **AI Model Used:** `GLM-5` (represented by `ANALYSIS_MODEL`), which is relatively expensive for high-frequency polling.
- **Output:** It enforces a very strict, short output:
  - `WireCard`: 15-word headline, 2-3 sentence summary.
  - `RadarCard`: 20-word signal text.
- **Issues Identified:** 
  1. **Too expensive:** Running GLM-5 every 5 minutes for multiple articles costs too much (~$0.15/day).
  2. **Insufficient Depth:** The summary is too short. It doesn't tell the user *why* a signal (Strong Buy / Strong Sell) is given based on compiled news.
  3. **High Noise:** It processes everything immediately instead of filtering for the most important 6-10 articles per day as requested.

---

## 2. Desired Workflow (The New Plan)

To achieve deep, reasoned analysis while minimizing API costs, the workflow must be split into two phases: **1) Frequent lightweight gathering**, and **2) Infrequent deep analysis.**

### Step A: Data Gathering (Every 15-30 minutes)
Instead of processing with AI immediately, the cron job simply fetches and stores raw news and social posts into a temporary "buffer" database table.
- **Sources needed:** News Platforms, Reddit, X (Twitter).
- **Missing Resource:** We need a robust, preferably free, aggregation API. *See "Missing APIs" below.*

### Step B: Filtering & Triage (Cost-efficient model - "Nano")
When the buffer reaches a certain size, we use the cheaper model (`GPT-5-nano` or equivalent) to quickly analyze the raw text and score it for relevance.
- **Action:** Only keep the top 6-10 most impactful articles/posts per day. Discard the fluff.

### Step C: Deep Analysis Synthesis (Once a day / On-Demand)
When we are ready to analyze a specific coin (e.g., BTC), we take the top 10 saved articles and feed them into the heavier analysis model (`GLM-5`).
- **Prompt Instructions:** We instruct the AI to generate a detailed report:
  - **Verdict:** (Strong Buy / Strong Sell / etc.)
  - **The "Why":** A numbered list of reasons explaining *exactly* why the market is moving this way, referencing the specific aggregated news.
  - **Historical Sequence:** A short timeline of the events leading up to this verdict.

---

## 3. What's Missing / Required Action Items

### A. Missing API for Sentiment & News
Right now, the app only has CryptoCompare for news (`https://min-api.cryptocompare.com/data/v2/news/`). It lacks varied social sentiment (Reddit/X).
- **Recommendation:** Integrate **LunarCrush** (Free tier provides excellent social sentiment and news aggregation specifically for crypto) or **CoinDataFlow**.
- **Alternative Free Tier:** **NewsData.io** or **NewsAPI.org** (filtering for crypto keywords).

### B. Logic Changes Required
1. **Cron Modification:** Change `terminalEngine.cron.ts` so it doesn't call `GLM-5` for every item every 5 minutes.
2. **Prompts Update:** Rewrite `generateDualNewsOutput` or create a new function `generateDeepAnalysis` in `openai.service.ts` that removes the "2-3 sentence" restriction and forces a detailed, multi-point reasoning breakdown based on batched news.
3. **Model Selection:** Programmatically use the cheaper model (`SEO_MODEL`) for initial triage and only use the expensive model (`ANALYSIS_MODEL`) for the final daily/on-demand synthesis.
