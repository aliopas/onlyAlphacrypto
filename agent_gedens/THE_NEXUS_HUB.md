# 🔄 THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## 📋 Active Phase: Phase 11 — Airdrop RSS Hunter: Real Data Pipeline

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 7 (T-01 through T-07, sequential)
**Priority Order:** T-01 → T-07 (each builds on the previous)
**Executor:** Senior Developer
**Scope:** Backend-only. 2 NEW files + 3 modified files. Zero new npm packages.

---

### 1. Planning Stage (Planner)

**Target:** Build an RSS-based data sourcing pipeline that fetches crypto/airdrop RSS feeds every 6 hours, pre-filters articles by keywords (zero AI cost), deduplicates against processed articles + existing DB projects, passes relevant articles to the existing `validateAirdrop()` AI pipeline, and inserts validated projects + tasks into the database.

**Why:** The Airdrop Hub has NO real data. The cron (`startAirdropHunterCron`) is disabled in `server.ts:87`, and `scrapePotentialAirdrops()` returns 2 hardcoded projects (LayerZero, ZkSync). The entire "AI Airdrop Hunter" value proposition is invisible to users.

**Existing Infrastructure (DO NOT MODIFY unless listed below):**
- **RSS Parser:** `rss-parser` package already installed. Pattern reference: `rssNews.service.ts` (uses `new Parser()`, `parser.parseURL()`, `feed.items.slice()`)
- **AI Validation:** `validateAirdrop()` in `openai.service.ts:302` — takes raw string, returns `AirdropValidationResult`
- **Prompt System:** `PromptFactory.buildAirdropValidationMessages()` in `prompt-factory.ts:108`
- **AI Gateway:** `gateway` (OpenRouter) in `openai.service.ts:154` — `gateway.chat<T>()` pattern
- **Cache:** `CacheManager` in `openai.service.ts:151` — `cache.generateKey()`, `cache.get()`, `cache.set()`
- **DB Models:** `airdropProjects` + `airdropTasks` in `models/airdrop.model.ts` — `db.insert().values().returning()`
- **Redis Cache:** `deleteCache()` + `deleteCachePattern()` from `config/redis.ts`
- **Cron Registration:** Array of `{ name, fn }` in `server.ts:85-95`, started with staggered delay

**Files to Create (2):**

| # | File | Est. Lines | Purpose |
|---|------|-----------|---------|
| 1 | `backend/src/services/airdropRss.service.ts` | ~120 | RSS fetching, keyword filtering, dedup helpers, context builder |
| 2 | `backend/src/crons/airdropRssHunter.cron.ts` | ~150 | Cron orchestrator: fetch → filter → dedup → AI validate → DB insert |

**Files to Modify (3):**

| # | File | Change | Est. Lines Added |
|---|-------|--------|-----------------|
| 3 | `backend/src/services/ai/prompt-factory.ts` | Add `buildAirdropFromArticleMessages()` method | ~35 |
| 4 | `backend/src/services/openai.service.ts` | Add `validateAirdropFromArticle()` + `AirdropArticleValidationResult` type | ~25 |
| 5 | `backend/src/server.ts` | Register `startAirdropRSSCron` in cron startup | ~2 |

**RSS Sources (4):**

| Source | URL |
|--------|-----|
| CoinMarketCap Airdrops | `https://coinmarketcap.com/airdrops/rss/` |
| CryptoSlate | `https://cryptoslate.com/feed/?s=airdrop` |
| CoinGape | `https://coingape.com/feed/?s=airdrop` |
| CoinDesk | `https://www.coindesk.com/arc/outboundfeeds/rss` |

**Cost Control:**
- `MAX_AI_CALLS_PER_RUN = 5` — hardcoded cap per cron run
- Cron runs every 6 hours = max 20 AI calls/day
- DeepSeek-R1 at ~800 tokens/call ≈ **$0.73/month total**

**Status:** ✅ Ready for Execution

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** T-01 and T-02 go into the same NEW file. T-03 and T-04 modify existing files. T-05 is a NEW file. T-06 modifies server.ts. T-07 is verification.

---

#### T-01: Create `airdropRss.service.ts` — Types & RSS Fetch + Filter

**Priority:** P0 | **File:** `backend/src/services/airdropRss.service.ts` (NEW) | **Status:** ⬜ Pending

**Scope:**
1. Import `Parser` from `rss-parser` and `createHash` from `crypto`
2. Define `AirdropRSSArticle` interface:
   ```typescript
   interface AirdropRSSArticle {
       title: string;
       link: string;
       pubDate: string;
       contentSnippet: string;
       source: string;
       content: string;
       hash: string;
   }
   ```
3. Define `RSSSource` interface: `{ name: string; url: string }`
4. Define `AIRDROP_RSS_SOURCES` constant array (4 sources from table above)
5. Define `AIRDROP_KEYWORDS` array: `['airdrop', 'airdrops', 'snapshot', 'tge', 'token generation', 'claim', 'retrodrop', 'retroactive', 'testnet reward', 'incentivized testnet', 'free token', 'token claim', 'eligibility', 'eligible', 'distribution', 'token distribution', 'zk drop', 'zero-knowledge drop', 'mainnet launch']`
6. Define `ANTI_KEYWORDS` array: `['scam alert', 'phishing', 'fake airdrop', 'avoid', 'honeypot', 'rug pull', 'malicious']`
7. Implement `fetchAirdropRSSFeeds(): Promise<AirdropRSSArticle[]>`:
   - Fetch all 4 RSS sources in parallel using `Promise.all` (same pattern as `rssNews.service.ts:20-44`)
   - Each source: `parser.parseURL(source.url)`, slice to 15 items
   - For each item: extract `title`, `link`, `content` (try `item['content:encoded']` || `item.content` || `item.contentSnippet`), `contentSnippet`, `pubDate`
   - Compute `hash` using `generateArticleHash(title, link)`
   - Apply `filterAirdropRelevant()` to each item's combined text (title + snippet + content)
   - Wrap each source fetch in try/catch — log error, continue to next source
   - Dedup across sources using Map keyed by hash
   - Sort by pubDate descending
8. Implement `filterAirdropRelevant(text: string): boolean`:
   - Lowercase the text
   - If any ANTI_KEYWORD found → return false
   - If any AIRDROP_KEYWORD found → return true
   - Otherwise → return false

---

#### T-02: Add Dedup & Context Builder to `airdropRss.service.ts`

**Priority:** P0 | **File:** `backend/src/services/airdropRss.service.ts` (continue) | **Status:** ⬜ Pending

**Scope:**
1. Import `db` from `'../config/db'` and `airdropProjects` from `'../models/index'`
2. Implement `generateArticleHash(title: string, link: string): string`:
   - `createHash('sha256').update(`${title}||${link}`).digest('hex')`
3. Implement `getExistingProjectNames(): Promise<Set<string>>`:
   - `db.select({ name: airdropProjects.name }).from(airdropProjects)`
   - Return `new Set(projects.map(p => p.name.toLowerCase()))`
4. Implement `buildProjectContextFromArticle(article: AirdropRSSArticle): string`:
   - Truncate `content` to 3200 chars (≈800 tokens) with `...[truncated]` suffix
   - Format as:
     ```
     ARTICLE TITLE: {title}
     SOURCE: {source}
     PUBLISHED: {pubDate}
     LINK: {link}
     
     --- ARTICLE CONTENT ---
     {truncatedContent}
     ```
5. All functions must be exported

---

#### T-03: Add `buildAirdropFromArticleMessages()` to `prompt-factory.ts`

**Priority:** P0 | **File:** `backend/src/services/ai/prompt-factory.ts` (MODIFY) | **Status:** ⬜ Pending

**Scope:**
1. Add a new method `buildAirdropFromArticleMessages(articleContext: string): ChatCompletionMessageParam[]` to the `PromptFactory` class
2. Place it IMMEDIATELY AFTER `buildAirdropValidationMessages()` (after line 136)
3. System prompt must instruct the AI to:
   - EXTRACT structured airdrop data from raw article text (different from the existing structured-data prompt)
   - Return JSON with: `isLegitimate`, `riskVerdict`, `projectName`, `network`, `tasks[]` (same shape as existing), `estValue`, `snapshotDate` (ISO 8601 or null), `tgeDate` (ISO 8601 or null), `aiReport`
   - Be CONSERVATIVE: "Only flag confirmed or highly probable airdrops"
   - If article mentions "airdrop" only in passing (e.g., price prediction article) → `isLegitimate = false`
   - `projectName`: extract the protocol name from article
   - `network`: primary blockchain (e.g., 'Ethereum', 'Solana', 'zkSync Era')
   - `snapshotDate` / `tgeDate`: if mentioned, return ISO 8601; otherwise null
   - `tasks`: actions users need to qualify. If article doesn't specify, infer reasonable ones
   - `isAutoVerifiable = true` ONLY for specific on-chain actions with verifiable contracts
4. User message: the raw `articleContext` string (same pattern as existing `buildAirdropValidationMessages`)

---

#### T-04: Add `validateAirdropFromArticle()` to `openai.service.ts`

**Priority:** P0 | **File:** `backend/src/services/openai.service.ts` (MODIFY) | **Status:** ⬜ Pending

**Scope:**
1. Add `AirdropArticleValidationResult` interface after the existing `AirdropValidationResult` interface (after line 25):
   ```typescript
   export interface AirdropArticleValidationResult {
       isLegitimate: boolean;
       riskVerdict: 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM';
       projectName: string;
       network: string;
       tasks: Array<{
           description: string;
           contractAddress?: string;
           minAmount?: number;
           tokenSymbol?: string;
           chain?: string;
           isAutoVerifiable: boolean;
       }>;
       estValue: string;
       snapshotDate: string | null;
       tgeDate: string | null;
       aiReport: string;
   }
   ```
2. Add `validateAirdropFromArticle(articleContext: string): Promise<AirdropArticleValidationResult>` function AFTER the existing `validateAirdrop()` function (after line 323):
   - Same pattern as `validateAirdrop()`: cache check → build messages → `gateway.chat<T>()` → cache set → return
   - Uses `prompts.buildAirdropFromArticleMessages(articleContext)` (the new method from T-03)
   - Uses `gateway.chat<AirdropArticleValidationResult>` with `env.DEEPSEEK_MODEL`, temperature 0.2, `responseFormat: { type: 'json_object' }`
   - Cache key prefix: `'airdropArticleValidation'`

---

#### T-05: Create `airdropRssHunter.cron.ts` — Main Orchestrator

**Priority:** P0 | **File:** `backend/src/crons/airdropRssHunter.cron.ts` (NEW) | **Status:** ⬜ Pending

**Scope:**
1. Imports:
   - `cron` from `node-cron`
   - `db` from `'../config/db'`
   - `airdropProjects, airdropTasks` from `'../models/index'`
   - `validateAirdropFromArticle` from `'../services/openai.service'`
   - `{ fetchAirdropRSSFeeds, generateArticleHash, getExistingProjectNames, buildProjectContextFromArticle, type AirdropRSSArticle }` from `'../services/airdropRss.service'`
   - `{ deleteCache, deleteCachePattern }` from `'../config/redis'`

2. Define `MAX_AI_CALLS_PER_RUN = 5`
3. Define `PROCESSED_HASHES_MAX = 1000`

4. Implement `runAirdropRSSDiscovery(): Promise<void>` — the main cron function:
   - Step 1: Call `fetchAirdropRSSFeeds()` → get filtered articles
   - Step 2: Dedup via in-memory `Set<string>` of processed hashes. Module-level `processedHashes` set.
     - Skip articles whose hash is in `processedHashes`
     - After dedup, cap at `MAX_AI_CALLS_PER_RUN` articles
   - Step 3: Get `existingProjectNames` from DB via `getExistingProjectNames()`
   - Step 4: For each article:
     a. `buildProjectContextFromArticle(article)` → context string
     b. `validateAirdropFromArticle(context)` → validation result
     c. Skip if `!isLegitimate || riskVerdict === 'SCAM'`
     d. Skip if `projectName.toLowerCase()` is in `existingProjectNames` set
     e. Parse `snapshotDate` and `tgeDate` from strings to `Date | null` (handle invalid dates gracefully)
     f. Insert into `airdropProjects` with: `name`, `network`, `estValue`, `aiReport`, `riskVerdict`, `snapshotAt`, `tgeAt`, `isActive: true`
     g. Insert each task into `airdropTasks` with: `projectId`, `description`, `contractAddress`, `minAmount`, `tokenSymbol`, `chain`, `isAutoVerifiable`, `orderIndex`
     h. Add project name to `existingProjectNames` set (prevent duplicates within same run)
     i. Add article hash to `processedHashes`
   - Step 5: Evict oldest hashes if `processedHashes.size > PROCESSED_HASHES_MAX` (FIFO — convert to array, slice, reconstruct Set)
   - Step 6: Invalidate Redis caches: `deleteCache('airdrop:projects')`, `deleteCache('airdrop:deadlines')`, `deleteCachePattern('airdrop:project:*')`
   - Wrap each article processing in try/catch — log error, continue to next article
   - Log all key events: start, articles found, articles after filter, AI calls made, projects inserted, rejections

5. Implement `startAirdropRSSCron(): void`:
   - Schedule `runAirdropRSSDiscovery` every 6 hours: `cron.schedule('0 */6 * * *', runAirdropRSSDiscovery)`
   - Log: `[AirdropRSS] Cron scheduled — Discovery: every 6 hours`

---

#### T-06: Register Cron in `server.ts`

**Priority:** P0 | **File:** `backend/src/server.ts` (MODIFY) | **Status:** ⬜ Pending

**Scope:**
1. Add import at top (after line 11): `import { startAirdropRSSCron } from './crons/airdropRssHunter.cron';`
2. In the `crons` array (line 85-95), add: `{ name: 'AirdropRSSHunter', fn: startAirdropRSSCron }`
   - Place it after the commented-out `AirdropHunter` line (line 87), before `DailyAlpha`
3. Uncomment the existing disabled `AirdropHunter` cron (line 87): remove the `//` prefix to re-enable `startAirdropHunterCron`

---

#### T-07: Edge Cases & Safety Verification

**Priority:** P1 | **Scope:** All files | **Status:** ⬜ Pending

**Verification Checklist:**
- [ ] `processedHashes` Set is capped at 1000 entries (FIFO eviction in T-05)
- [ ] RSS source failures are caught gracefully (try/catch per source in `fetchAirdropRSSFeeds`)
- [ ] AI validation timeout/failure is caught (try/catch per article in `runAirdropRSSDiscovery`)
- [ ] No duplicate project insertion race condition (DB name check before insert)
- [ ] All Redis cache keys invalidated: `airdrop:projects`, `airdrop:deadlines`, `airdrop:project:*`
- [ ] Zero `any` types — all interfaces defined
- [ ] No modification to existing service files (except `openai.service.ts` and `prompt-factory.ts` which are explicitly extended)
- [ ] `AirdropArticleValidationResult` is exported from `openai.service.ts`
- [ ] `validateAirdropFromArticle` is exported from `openai.service.ts`
- [ ] All existing exports remain backward-compatible
- [ ] TypeScript compilation passes with no errors

---

### 3. QA & Security Stage (QA Hunter)

**Status:** ⬜ Pending — Awaiting Execution Completion

---

### 4. Deployment Stage (Release Manager)

**Status:** ⬜ Pending — Awaiting QA Pass
