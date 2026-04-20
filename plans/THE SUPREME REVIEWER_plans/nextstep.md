# 🪂 Phase 11 — Airdrop RSS Hunter: Real Data Pipeline

**Created:** April 20, 2026
**Status:** 🟡 PLANNING — Awaiting Architect Review
**Type:** Backend-Only (2 new files + 3 modified files)
**Zero new npm packages required** — `rss-parser` already installed

---

## 📌 Problem Statement

The Airdrop Hub has **no real data**. The cron (`startAirdropHunterCron`) is disabled in `server.ts:87`, and `scrapePotentialAirdrops()` returns 2 hardcoded projects (LayerZero, ZkSync). The entire "AI Airdrop Hunter" value proposition is invisible to users.

## 🎯 Goal

Build an RSS-based data sourcing pipeline that:
1. Fetches articles from crypto/airdrop RSS feeds every 6 hours
2. Pre-filters articles using keywords (zero AI cost)
3. Deduplicates against processed articles + existing DB projects
4. Passes relevant articles to our existing `validateAirdrop()` AI pipeline
5. Inserts validated projects + tasks into the database
6. Invalidates Redis caches so the frontend picks up new projects

---

## 🏗 Architecture

```
Every 6 hours (cron)
    │
    ▼
airdropRssHunter.cron.ts (NEW)
    │
    ├─ 1. fetchAirdropRSSFeeds()          ← airdropRss.service.ts (NEW)
    │      ├─ Fetch 4 RSS sources in parallel
    │      └─ Keyword pre-filter (airdrop, snapshot, tge, claim...)
    │         → Eliminates ~80% of articles (zero AI cost)
    │
    ├─ 2. deduplicateArticles()           ← SHA-256 hash (in-memory Set)
    │
    ├─ 3. getExistingProjectNames()       ← DB query (airdrop_projects)
    │
    ├─ 4. For each new article (max 5 per run):
    │      ├─ buildProjectContextFromArticle()  ← Truncate to ~800 tokens
    │      └─ validateAirdropFromArticle()      ← NEW function in openai.service.ts
    │            ├─ Uses NEW prompt (article-optimized)
    │            ├─ DeepSeek-R1 via AIGateway
    │            └─ Returns structured JSON (project, tasks, deadlines)
    │
    ├─ 5. Skip if: !isLegitimate || SCAM || already exists
    │
    ├─ 6. Insert into airdrop_projects + airdrop_tasks
    │
    └─ 7. deleteCache('airdrop:projects', 'airdrop:deadlines')
```

---

## 📂 Files to Create / Modify

### NEW Files (2)

| # | File | Lines (est.) | Purpose |
|---|------|-------------|---------|
| 1 | `backend/src/services/airdropRss.service.ts` | ~120 | RSS fetching, keyword filtering, dedup helpers, prompt builder |
| 2 | `backend/src/crons/airdropRssHunter.cron.ts` | ~150 | Cron job orchestrator: fetch → filter → dedup → AI validate → DB insert |

### Modified Files (3)

| # | File | Change | Lines Added |
|---|-------|--------|-------------|
| 3 | `backend/src/services/ai/prompt-factory.ts` | Add `buildAirdropFromArticleMessages()` method | ~35 |
| 4 | `backend/src/services/openai.service.ts` | Add `validateAirdropFromArticle()` function + `AirdropArticleValidationResult` type | ~25 |
| 5 | `backend/src/server.ts` | Register `startAirdropRSSCron` in cron startup | ~2 |

---

## 📡 RSS Sources

| Source | URL | Type |
|--------|-----|------|
| CoinMarketCap Airdrops | `https://coinmarketcap.com/airdrops/rss/` | Airdrop-specific |
| CryptoSlate | `https://cryptoslate.com/feed/?s=airdrop` | News with keyword |
| CoinGape | `https://coingape.com/feed/?s=airdrop` | News with keyword |
| CoinDesk (general) | `https://www.coindesk.com/arc/outboundfeeds/rss` | General crypto (keyword filtered) |

Shared sources (already fetched by `rssNews.service.ts` — can be intercepted later):
- Cointelegraph, Decrypt, The Block

---

## 🔑 Key Design Decisions

### 1. Separate Service from Existing `rssNews.service.ts`
The existing `rssNews.service.ts` feeds the Terminal/LATEST WIRE engine. The airdrop service has different sources, different filtering logic, and different output. Kept separate to avoid coupling and maintain the existing doc rule: "Do not modify any other service files." Actually, we're not modifying `rssNews.service.ts` — we're creating a parallel service.

### 2. Article-Optimized AI Prompt
The existing `buildAirdropValidationMessages()` prompt is designed for structured project data input. Raw RSS articles need a different prompt that:
- Instructs the AI to **extract** project info from unstructured article text
- Returns `projectName` and `network` (not present in current validation result)
- Returns `snapshotDate` and `tgeDate` as explicit fields
- Is more conservative: "Only flag confirmed or highly probable airdrops"

### 3. Cost Control
- `MAX_AI_CALLS_PER_RUN = 5` — hardcoded cap per cron run
- Cron runs every 6 hours = max 20 AI calls/day
- DeepSeek-R1 at ~800 tokens/call ≈ **$0.73/month total**

### 4. 3-Layer Dedup
1. **Keyword filter** — eliminates non-airdrop articles (zero cost)
2. **SHA-256 hash** — prevents re-processing the same article across runs
3. **DB project name check** — prevents duplicate project entries

---

## 🔀 Micro-Task Breakdown

### T-01: Create `airdropRss.service.ts` — Types & RSS Sources
**File:** `backend/src/services/airdropRss.service.ts`
**Scope:**
- Define `AirdropRSSArticle` interface
- Define `AIRDROP_RSS_SOURCES` array (4 sources)
- Define `AIRDROP_KEYWORDS` and `ANTI_KEYWORDS` arrays
- Implement `fetchAirdropRSSFeeds()` — fetch all sources in parallel, return raw articles
- Implement `filterAirdropRelevant()` — keyword pre-filter

### T-02: Create `airdropRss.service.ts` — Dedup & Context Builder
**File:** `backend/src/services/airdropRss.service.ts` (continue)
**Scope:**
- Implement `getExistingProjectNames()` — query DB, return `Set<string>`
- Implement `buildProjectContextFromArticle()` — truncate article to ~800 token prompt
- Ensure all functions are exported

### T-03: Add Article Prompt to `prompt-factory.ts`
**File:** `backend/src/services/ai/prompt-factory.ts`
**Scope:**
- Add `buildAirdropFromArticleMessages(articleContext: string)` method to PromptFactory class
- Prompt instructs AI to extract structured airdrop data from raw article text
- Returns JSON with: `isLegitimate`, `riskVerdict`, `projectName`, `network`, `tasks[]`, `estValue`, `snapshotDate`, `tgeDate`, `aiReport`
- Conservative rules: only flag confirmed/highly probable airdrops

### T-04: Add `validateAirdropFromArticle()` to `openai.service.ts`
**File:** `backend/src/services/openai.service.ts`
**Scope:**
- Define `AirdropArticleValidationResult` interface (extends existing `AirdropValidationResult` with `projectName`, `network`, `snapshotDate`, `tgeDate`)
- Implement `validateAirdropFromArticle(articleContext: string)` — same pattern as existing `validateAirdrop()` but uses the new article prompt
- Include CacheManager caching (reuse existing pattern)

### T-05: Create `airdropRssHunter.cron.ts` — Main Orchestrator
**File:** `backend/src/crons/airdropRssHunter.cron.ts`
**Scope:**
- Implement `runAirdropRSSDiscovery()` — the main cron function:
  1. Call `fetchAirdropRSSFeeds()`
  2. Dedup via in-memory SHA-256 hash set
  3. Check against existing DB project names
  4. Cap at `MAX_AI_CALLS_PER_RUN = 5`
  5. For each article: build context → call `validateAirdropFromArticle()` → insert into DB
  6. Invalidate Redis caches
- Implement `extractProjectName()` and `extractNetwork()` helpers
- Implement `startAirdropRSSCron()` — schedule every 6 hours with `node-cron`

### T-06: Register Cron in `server.ts`
**File:** `backend/src/server.ts`
**Scope:**
- Import `startAirdropRSSCron` from `airdropRssHunter.cron.ts`
- Add `{ name: 'AirdropRSSHunter', fn: startAirdropRSSCron }` to cron startup array
- Uncomment the existing `startAirdropHunterCron` entry (re-enable the 12h routine sync)

### T-07: Edge Cases & Safety
**Scope:**
- Ensure `processedHashes` Set doesn't grow unbounded (cap at 1000 entries, FIFO eviction)
- Handle RSS source failures gracefully (already in `fetchAirdropRSSFeeds` try/catch)
- Handle AI validation timeout/failure (skip article, log error, continue)
- Ensure no duplicate project insertion race condition (`onConflictDoNothing` or name check)
- Verify all Redis cache keys are invalidated (`airdrop:projects`, `airdrop:deadlines`, `airdrop:project:*`)
- Zero `any` types — strict TypeScript throughout

---

## 💰 Cost Estimate

| Metric | Value |
|--------|-------|
| Cron frequency | Every 6 hours (4x/day) |
| Articles per run (after filter) | ~5-15 |
| AI calls per run (capped) | 5 max |
| Total AI calls per day | 20 max |
| Tokens per call (input + output) | ~1,200 |
| Model | DeepSeek-R1 (via OpenRouter) |
| **Estimated monthly cost** | **~$0.73/month** |

---

## ✅ Acceptance Criteria

1. `startAirdropRSSCron` runs successfully when server starts
2. RSS feeds are fetched and keyword-filtered (non-airdrop articles rejected)
3. Duplicate articles are skipped (same title/link never processed twice)
4. Duplicate projects are skipped (same project name doesn't create duplicate entry)
5. AI validates articles and returns structured data (project name, tasks, deadlines)
6. Validated projects are inserted into `airdrop_projects` + `airdrop_tasks` tables
7. SCAM/illegitimate projects are rejected and logged
8. Redis caches are invalidated after each run
9. Frontend `/airdrops` page shows newly discovered projects
10. Max 5 AI calls per run — cost controlled
11. Zero `any` types — all interfaces defined
12. No modification to existing service files (except `openai.service.ts` and `prompt-factory.ts` which are explicitly being extended)

---

## 📐 Future Enhancements (Out of Scope for This Phase)

- **Shared RSS pipeline** — Intercept articles from `rssNews.service.ts` before they go to terminal engine
- **Event-driven trigger** — Connect LATEST WIRE keyword detection to `triggerEmergencyUpdate()`
- **Twitter/X monitoring** — Add social media as a data source
- **Manual seed data script** — Script to bulk-insert known airdrops for immediate population
- **Home Watchlist widget** — Replace placeholder `AirdropWatchlist.tsx` with real data
