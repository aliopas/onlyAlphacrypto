# 📰 Feature 2: LATEST WIRE (AI-Curated News Feed)

## 📌 1. Overview
The `LATEST WIRE` is a vertical news feed displayed on the left side of the Terminal page. Its purpose is to provide traders with crucial updates, real-time news, and community sentiment specific to the selected coin, all while strictly filtering out noise and shilling.

## 🎨 2. Frontend & UI/UX
* **Location:** Left column, independent scroll.
* **Wire Card Design:**
  * `Timestamp`: Actual posting time (e.g., 15m ago).
  * `Category Tag`: A colored badge indicating the news type (e.g., [MACRO], [DEFI], [$SOL]).
  * `Headline`: A concise, direct headline not exceeding two lines.
* **Performance:** The feed updates seamlessly without requiring a page refresh (via Polling or SSE).

## ⚙️ 3. Backend Architecture & Data Flow
The system acts as an "Automated Curator" through a scheduled cron job running every 5 minutes. It processes data through a 4-stage pipeline:

### Stage 1: Smart Fetching
Data is gathered from three tiers of sources:
* **Tier 1 (Authority):** Official coin accounts and major news platforms (via APIs like CryptoPanic).
* **Tier 2 (Analysts):** Data whales and prominent on-chain analysts.
* **Tier 3 (Community):** Trusted interactions from Reddit or similar community platforms.

### Stage 2: Programmatic Filtering
To protect AI resources from unnecessary consumption, news first passes through programmatic filters (Regex/Logic):
* **Spam Filter:** Excludes posts containing spam keywords (e.g., "Airdrop link", "1000x gem") or excessive emojis (🚀).
* **Relevance Filter:** Ensures the selected coin is the primary subject of the news, not just a passing mention.

### Stage 3: AI Processing
News items that pass the programmatic filter are sent to the OpenAI API for the following tasks:
* **Deduplication:** Merging repetitive news from multiple sources into a single comprehensive update.
* **Impact Scoring:** Evaluating the potential price impact of the news to prioritize its display order.
* **Summarization:** Rewriting long or clickbait headlines into precise, professional, and concise titles.

### Stage 4: Tagging & Storage
* The AI assigns an appropriate `Tag` to the final news item.
* The processed news item is saved to the database (e.g., PostgreSQL with Drizzle ORM).

## 🗄️ 4. Database Schema
Example schema for the table powering this feature (using Drizzle ORM):

```typescript
export const coinNews = pgTable('coin_news', {
  id: serial('id').primaryKey(),
  coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(), // e.g., 'SOL'
  headline: text('headline').notNull(), // AI Generated Headline
  sourceTag: varchar('source_tag', { length: 30 }).notNull(), // e.g., 'MACRO', 'DEFI'
  impactScore: integer('impact_score').default(0), // Priority sorting
  postedAt: timestamp('posted_at').notNull(), // Original post time
  createdAt: timestamp('created_at').defaultNow().notNull(), // Time added to DB
});
```
