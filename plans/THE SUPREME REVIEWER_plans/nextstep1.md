I need you to help me design an improvement plan, NOT write code.

Do not modify any files. Do not implement anything. Do not create migrations.
Your task is to inspect the current codebase and produce a clear technical 
improvement plan.

==============================
CONTEXT
==============================

This project is OnlyAlpha, an AI-native crypto intelligence platform. Currently 
we have:
- News ingestion from RSS / Telegram
- AI triage and analysis
- Living articles
- Radar signals
- Scorecard / signal performance tracking
- Historical news table
- Some temporal intelligence logic
- Strategic outlook
- Support/resistance fields in different places

The current system feels too shallow because it often behaves like:
"news came in → AI says bullish/bearish → signal"

I want to evolve it into a more data-grounded intelligence system:
"news came in → classify event → capture price at event → track price after 
event → compare with similar historical events → evaluate nearby support/
resistance strength → produce a policy-safe market scenario, not direct 
trade advice."

==============================
HARD CONSTRAINTS
==============================

- ZERO budget for new paid APIs beyond what's already configured
- System must keep running during all changes (no big-bang rewrites)
- Backward compatibility mandatory - existing data must remain accessible
- Living Articles feature must continue working throughout migration
- Public-facing URLs and SEO must not break
- AdSense compliance is critical - public language must be policy-safe

ASSUMPTIONS TO VERIFY DURING INVESTIGATION:
- DeepSeek Direct is significantly cheaper than OpenRouter (confirm pricing)
- Z.ai web_search is essentially free at our usage scale (confirm)
- Binance Klines API is free and sufficient for historical price data
- Current Redis setup is reliable enough to depend on

==============================
MAIN PRODUCT DIRECTION
==============================

We want to build three connected intelligence engines:

### 1. Event Impact Engine
Tracks the real historical price impact of news/events.

For each event/news item, we should eventually know:
- coinSymbol
- eventType
- eventSeverity
- eventScope: coin-specific / market-wide / sector-wide
- source
- publishedAt
- priceAtEvent
- BTC/ETH price at event if useful
- market mood / fear-greed at event if available
- price after key horizons:
  - speculation: 1h, 4h, 24h, 3d, 7d
  - swing: 7d, 14d, 30d, 90d, 180d
  - investment: 30d, 90d, 180d, 365d, 730d
- pnl/change at each horizon
- maxUpsideAfterEvent
- maxDrawdownAfterEvent
- timeToPeak
- timeToBottom
- outcome classification

Goal:
AI should not invent historical impact.
The system should build a trusted event-price dataset.

### 2. Level Intelligence Engine
Support/resistance should not be random AI text or static percentages.

We want statistics for each important level:
- coinSymbol
- levelPrice
- levelType: support / resistance
- timeframe: 1h / 4h / 1d / 1w
- touchCount
- bounceCount
- breakCount
- fakeoutCount
- avgBouncePercent
- avgBreakPercent
- volumeAtLevel if available
- lastTouchedAt
- confidenceScore
- whether it flipped from support to resistance or resistance to support

Goal:
When a new event happens, the system should know:
- Is price near strong support?
- Is price under strong resistance?
- Historically, what happens when this event type occurs near this type 
  of level?

### 3. Policy-Safe Scenario Engine
The public-facing language should be Google/AdSense friendly and not look 
like direct personalized financial advice.

Internally we may have signals, entry price, TP/SL, verdicts, etc.
But public UI/articles should preferably use language like:
- Market Scenario
- Reference Price
- Upside Target Zone
- Invalidation Zone
- Risk Zone
- Bullish/Bearish Bias
- Historical Pattern
- Key Level to Watch
- Scenario Tracking
- Not Financial Advice

Avoid public wording like:
- Buy now / Sell now
- Enter trade
- Guaranteed profit
- Take profit / Stop loss (in public UI)
- You should buy/sell

Goal:
Outputs should be framed as data-driven market intelligence and historical 
scenario analysis, not direct trading instructions.

==============================
WHAT I NEED YOU TO INVESTIGATE
==============================

## 1. Current Historical Data Foundation

Inspect:
- backend/src/models/market.model.ts
- coin_news_history, coin_memory, price_snapshots
- signal_performance, radar_signals
- market_insights, coin_strategic_outlook

Report:
- Which tables already store event/news data?
- Which tables already store price-at-event or price-after-event?
- Which horizons are already tracked?
- Is there already max drawdown / max upside / time-to-peak data anywhere?
- Which data is reliable enough to reuse?
- Which data model gaps exist for the Event Impact Engine?
- ROW COUNTS in each table if accessible (or how to check)
- Identify which tables have data vs empty/dormant
- Flag any orphan data

## 2. Current Temporal / Pattern Logic

Inspect:
- temporalIntelligence.service.ts
- historicalNews.cron.ts
- coin-memory.service.ts
- aiWorkflow.cron.ts
- prompt-factory.ts

Report:
- Does the system already compare new events to historical events?
- If yes, how exactly?
- Does it use real price outcomes or AI-written historical context?
- What event types are currently supported?
- Are macro events supported? (Fed, CPI, wars, elections, banking crisis)
- Are personality-driven events supported? (Elon/DOGE)
- Where does historical context enter the AI prompt?
- Is the historical context grounded in DB data or generic AI knowledge?

## 3. Current Event Classification

Inspect:
- triageEngine.cron.ts
- openai.service.ts
- prompt-factory.ts
- aiWorkflow.cron.ts

Report:
- What classification fields exist now?
- Is there enough structure to support the new Event Impact Engine?
- What event taxonomy improvements are needed?

Suggest a better event taxonomy including:
- macro rate / inflation events
- geopolitical events
- regulatory / SEC / ETF events
- exchange listing/delisting
- hacks/security events
- whale/on-chain events
- protocol upgrades/mainnet
- ecosystem/narrative events
- influencer/personality events

## 4. Current Price Capture Logic

Inspect:
- priceService.ts, binance.service.ts, binanceHistory.service.ts
- chart/candles APIs
- signalPerformance.cron.ts, historicalNews.cron.ts

Report:
- How does the system currently fetch current price?
- How does it fetch historical price?
- Can it fetch candles/klines for 1h, 4h, 1d?
- Investigate Binance Klines API:
  - What intervals are supported?
  - What's the historical depth?
  - What are the rate limits?
- Can we fetch BTC/ETH price for ANY arbitrary timestamp in the past?
- Is there a "price at timestamp X" service?
- Which sources are used? Binance, DexScreener, CoinCap, Birdeye, etc.
- What needs to be added or improved?

## 5. Current Support / Resistance Logic

Inspect:
- market_insights supportLevels / resistanceLevels
- coin_strategic_outlook support/resistance fields
- coin_master_articles technicalLevels
- prompt-factory.ts technical analysis prompts

Report:
- Where are support/resistance levels currently generated?
- Are they AI-generated or calculated from price data?
- What format are they stored in? (structured JSON or free text)
- Are level statistics tracked anywhere?
- Investigate if pivot point algorithms exist anywhere
- Check if there's any swing high/low detection logic
- Is there any code that detects "level touched" or "level broken" events?
- What gaps exist for the Level Intelligence Engine?

## 6. Current Scorecard / Signal System Compatibility

Inspect:
- signalManager.service.ts, signalPerformance.cron.ts
- market.controller.ts scorecard handler
- frontend scorecard page

Report:
- How can the current signal system map to:
  - speculation records
  - swing records
  - investment records
- Does the current schema support multiple horizons per coin/signal?
- Does it support ongoing monitoring actions (HOLD / ADD / REDUCE / EXIT)?
- Does it support storing reasoning/thesis behind a signal?
- What gaps exist?

## 7. Current AI Cost / Model Routing Constraints

Inspect:
- openai.service.ts, ai-gateway.ts, prompt-factory.ts
- zhipuWebSearch.service.ts, quality-auditor.ts, cache-manager.ts

Report:
- Which parts of this new intelligence system can be deterministic 
  (no AI needed)?
- Which parts can use DeepSeek Direct?
- Which parts can use Z.ai / GLM web_search?
- Which parts still need OpenRouter/gpt-nano?
- Where can we use caching/batching?
- How can we avoid sending full articles or huge JSON repeatedly?

Design principle:
Use AI for classification, summarization, and explanation.
Use database + price data for statistics, outcomes, levels, historical impact.

## 8. Free News / Data Source Opportunities

Inspect:
- rssNews.service.ts, telegram.service.ts
- cryptopanic.service.ts, tavily.service.ts
- zhipuWebSearch.service.ts

Report:
- Current free sources already used
- Current unused services that could be wired in
- Free RSS/source opportunities for:
  - crypto-specific news
  - macro events (Fed/CPI/economic calendar)
  - geopolitical events
  - official project announcements
  - exchange announcements
- Which sources are realistic without paid API usage?
- Which ones would require scraping?
- Risks of scraping and how to keep it lightweight

## 9. Google / AdSense Friendly Language Audit

Inspect:
- scorecard frontend labels
- radar labels
- article prompts
- meta title/description generation

Report:
- Where do we currently use direct trading language?
  (BUY, SELL, STRONG_BUY, Take Profit, Stop Loss, Entry, Signal, Trade)
- Which labels should be changed in public UI/articles?
- Which labels can remain internal?
- Suggest a terminology mapping:
  - Signal → ?
  - Entry → ?
  - Take Profit → ?
  - Stop Loss → ?
  - Buy/Sell → ?
  - Position → ?
  - Trade → ?
- Suggest policy-safe phrasing rules for future prompts

## 10. Operational Reality Check

Before recommending phases, verify:
- How many MAJOR articles get processed per day on average?
- How many radar signals get created per day?
- How many coins are actively tracked?
- Database size growth rate?
- Are there any cron jobs currently failing or slow?
- Are there any obviously slow database queries?
- Is Redis actually being used or always falling back?

This grounds the plan in real production load, not theoretical scale.

==============================
FINAL DELIVERABLE
==============================

Give me a phased improvement plan structured like this:

## Phase 0 — What already exists and should be reused
List reusable tables/services/logics with file references.

## Phase 1 — Minimum Data Foundation
Smallest change to start storing event-price impact reliably.

## Phase 2 — Event Impact Engine
How to classify events, store outcomes, compute historical stats, avoid 
AI hallucination.

## Phase 3 — Level Intelligence Engine
How to compute and store support/resistance statistics.

## Phase 4 — Multi-Horizon Scenario Tracker
How to support speculation / swing / investment records.

## Phase 5 — Smart Monitoring Cadence
Which things should run every 5min, 30min, hourly, daily, weekly.
Justify each cadence based on cost vs freshness.

## Phase 6 — AI Cost Reduction
Which model does what, what's deterministic, where to use Z.ai, 
DeepSeek Direct, caching, batching.

## Phase 7 — Public Language / Google-Safe Presentation
How to present intelligence publicly without direct financial-advice wording.

## Phase 8 — Migration Strategy
For each phase:
- Can it run parallel to existing system?
- Or does it need to replace existing logic?
- Rollback plan if something breaks?
- What data needs backfilling?
- Minimum testing required before going live?

## Top 10 Recommended Improvements
Ranked by:
- impact (1-10)
- difficulty (1-10)
- risk (1-10)
- expected value (calculated)

## Top 10 Questions / Unknowns
For each question:
- Why it matters (impact on the plan)
- Realistic options
- Your recommendation as the investigator
- Cost/risk of each option

==============================
RULES
==============================

- Be precise.
- Reference files and existing code paths.
- If something is missing, say clearly that it is missing.
- If something in the README is not true in code, flag it.
- Do not guess. If unclear, say UNCLEAR.
- Do not write code.
- Do not modify files.
- Do not create migrations.
- The plan should be actionable, not academic.