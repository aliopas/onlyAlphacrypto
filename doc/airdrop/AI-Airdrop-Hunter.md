# 🤖 Feature 2: AI Airdrop Hunter

## 📌 1. Overview
The **AI Airdrop Hunter** is an intelligent engine responsible for populating and maintaining the **Active Farm Grid** and **Upcoming Deadlines** sections on the Airdrop Tracker Hub. Airdrops are fundamentally different from live token prices; they develop over months (from Testnet phases to Mainnet launches). Running continuous 5-minute AI checks for airdrops would result in severe API token waste. Therefore, this feature utilizes a highly optimized **Hybrid Cron Strategy**.

## 🛡️ 2. AI Validation & Processing (Anti-Scam Logic)
When potential airdrop data is collected (from Twitter, Discord, etc.), it is sent to the OpenAI API with a strict validation prompt ("Is this a legitimate airdrop opportunity or a scam/phishing attempt?"). If validated as legitimate, the AI automatically extracts core data points:
1. **Task Checklist:** Generates actionable, step-by-step tasks required to qualify (e.g., *Bridge 0.5 ETH*, *Mint NFT*).
2. **Estimated Value (Est. Value):** Calculates a potential dollar value based on the project's funding rounds and tokenomics.
3. **Critical Deadlines:** Extracts key dates such as Snapshot, TGE (Token Generation Event), or Claim deadlines to feed the UI's countdown timers.

## ⏱️ 3. The Hybrid Timing Architecture (Cron Strategy)

### A. New Airdrop Discovery (Daily Deep Scan) 🆕
* **Frequency:** Once every 24 hours (e.g., Midnight UTC).
* **Logic:** The server performs a comprehensive web-scrape across major airdrop aggregation sites and Crypto Twitter arrays to hunt for entirely brand-new projects. 
* **Reasoning:** Legitimate crypto projects do not launch and distribute an airdrop on the same day. A 24-hour discovery cycle is perfectly adequate and highly cost-effective.

### B. Updating Active Airdrops & Deadlines ⏳
For projects already listed in the user's "Active Farm Grid", continuous monitoring is required. This is handled via a dual-mechanism approach:

1. **Routine Sync (Every 12 Hours):**
   * The AI performs a lightweight check on the official social media accounts of the tracked projects to see if new tasks have been added or if distribution dates have shifted.

2. **Event-Driven Trigger (Emergency Update):** 🔥
   * *The "Smart" System Integration:* This logic is tightly coupled with the **LATEST WIRE** news engine (which runs every 5 minutes).
   * *Mechanism:* If the news scraper detects highly sensitive keywords (e.g., `Snapshot`, `Claim`, `TGE`, `Airdrop confirmed`) associated with a project in our tracking Grid (like "ZkSync"), it bypasses the 12-hour wait. It instantly triggers a webhook forcing the AI to analyze the breaking news and update the project's Deadlines and Checklist immediately.

## 🏆 4. Why This Architecture is Superior
* **Massive Cost Efficiency:** The AI model is not burning API tokens analyzing stale or irrelevant data repeatedly. It operates on a fixed schedule for new discoveries and purely "on-demand" for active updates.
* **Real-Time Feel (Zero Latency Experience):** Despite the cost-saving measures, if a sudden "Snapshot tomorrow" announcement drops, the Event-Driven Trigger ensures the UI countdown timers will reflect the urgency within 5 minutes for all users.
* **Database Optimization:** Write operations are strictly limited to when actual state changes occur, significantly reducing unnecessary database load and maximizing performance.
