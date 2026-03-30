OnlyAlpha AI Workflow Redesign — Master Execution Plan
🎯 Executive Summary
Transitioning OnlyAlpha from a "fast-news aggregator" into a "deep-analysis platform with accumulative AI memory." The system will autonomously hunt for hype coins, intelligently filter noise using lightweight models, and perform deep analysis using heavy models enriched with historical context and real-time on-chain data. It also introduces a context-aware, dual-mode chat system for users.

🔑 Available Data Sources & APIs (Architecture Context)
Reddit (Free/Scraper): Primary source for social hype and community sentiment (r/CryptoCurrency, r/SatoshiStreetBets, r/altcoin, r/defi).

CryptoCompare API: Primary source for official market news.

CoinCap API: Real-time price tracking and volume metrics.

Moralis API: On-chain data extraction (Liquidity, Whale movements, Smart Contract security/Red Flags).

Tavily API: Deep web search for scam verification, cross-referencing news, and pulling external context for hyped coins.

(Note: X/Twitter and LunarCrush are explicitly excluded from this build).

🏗️ Phase 1: Data Infrastructure & Pipeline Optimization
Goal: Stop immediate processing of all news. Separate data gathering from AI processing to drastically reduce API costs.

Sub-Phase 1A: The Gathering Engine (Run every 10 mins)
Action: Modify the current terminalEngine cron job. It must no longer trigger the AI directly.

Workflow:

Fetch raw news from CryptoCompare.

Scrape trending posts and mentions from targeted Reddit communities.

Extract mentioned coin symbols (using regex/basic parsing).

Save all gathered data into a new database table called raw_news_buffer with a status of unprocessed.

Handle deduplication strictly at this level using source hashes.

Sub-Phase 1B: Intelligent Triage Engine (Run every 2 hours OR when buffer hits 20+ items)
Action: Create a new cron job (triageEngine).

Workflow:

Pull all unprocessed items from the raw_news_buffer.

Send the batch to a lightweight, cheap AI model (GPT-nano).

The AI assigns a relevance_score (0-100) based on crypto-market impact and hype potential.

Keep only the top 10-15 highest-scoring items. Mark the rest as low_relevance (to be auto-deleted later via TTL).

Sub-Phase 1C: Routing to Deep Analysis
Action: Route the top 10-15 filtered items to the heavy AI model (DeepSeek R1) for actual article generation and analysis (Proceed to Phase 2).

🧠 Phase 2: High-Quality Articles & Accumulative Memory
Goal: Articles must be deep, context-aware, and built on the coin's historical timeline, not just isolated news snippets.

Sub-Phase 2A: The "Coin Memory" System
Action: Implement a new database structure called coin_memory.

Workflow: Every time a coin is deeply analyzed, a snapshot of the event (Price spike, news burst, sentiment shift) and the AI's verdict is saved here.

Usage: Before generating a new article about a coin, the AI must fetch the last 5 records from coin_memory to understand the historical context.

Sub-Phase 2B: Deep Article Generation (Data Augmentation)
Action: Update the OpenAI service to generate comprehensive 800+ word articles.

Data Injection Process: Before prompting DeepSeek, gather:

The raw news/Reddit post.

Historical context from coin_memory.

Real-time price/volume from CoinCap.

On-chain metrics & contract security checks from Moralis.

Deep context or scam-checks via Tavily search.

Sub-Phase 2C: Article Structure & SEO Finishing
Action: Enforce a strict output structure for the article:

Hook: Single attention-grabbing sentence.

Executive Brief: 3-4 sentence summary.

Deep Analysis: The "Why" behind the movement + Historical comparison.

Red Flags: Based on Moralis data and Tavily searches.

Trader Implications: Actionable insights.

SEO Layer: Once generated, pass the final text through GPT-nano to generate SEO-optimized metaTitle, metaDescription, and keywords.
💬 Phase 3: Terminal-Exclusive Dual-Mode Chat System
Goal: An interactive AI assistant strictly confined to the /terminal page, utilizing the existing "GENERAL AI" and "CONTEXT AI" tab UI.

Sub-Phase 3A: GENERAL AI Mode (Terminal Default)
Behavior: Active when the user is on the "GENERAL AI" tab in the Terminal.

Workflow:

User asks broad market questions or inquires about specific coins without selecting an event.

System searches the internal DB (coin_news, coin_memory) for relevant data.

AI responds as a strict Crypto/DeFi expert. Must decline non-crypto questions.

Sub-Phase 3B: CONTEXT AI Mode (Event-Triggered)
Behavior: Active when the user switches to the "CONTEXT AI" tab. It requires the user to select a specific event/signal from the Terminal's left panel (AI Radar Stream) or center panel (Alpha Stream).

Workflow: * Once an event is selected, the AI is fed the coin_memory, live chart data (like the $82.50 SOL shown in UI), and the deep analysis of that specific event.

The chat becomes highly specialized, answering deep questions strictly about the selected event.

Restriction: This mode uses heavy context limits and must be restricted to Logged-in Users Only.

Sub-Phase 3C: Guest Limitation System
Behavior: Unregistered users (Guests) get a maximum of 3 free prompts (as shown in the UI: GUEST: 0/3) in GENERAL AI mode only.

Workflow: On the 4th attempt, disable the chat input and trigger a UI prompt requiring the user to login or connect their wallet.

Sub-Phase 3D: UI/UX Chat Enhancements
Behavior: Dynamic input placeholders based on the active tab and selection.

General Tab: "Ask OnlyAlpha about the market..."

Context Tab (No selection): "Select an event from the stream first..."

Context Tab (With selection): "Ask about [Coin Symbol] analysis..."

Sub-Phase 3E: Terms & Conditions / Disclaimer
Behavior: Mandatory consent checkpoint.

Workflow: The first time a user interacts with the Terminal chat, display a one-time disclaimer: "AI responses are for informational purposes only. DYOR." User must accept to proceed.
