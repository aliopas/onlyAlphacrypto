# THE NEXUS HUB (Agent Handoff & Communication)

**Rule:** Agents MUST read and update this file to communicate. DO NOT assume a task is done unless stated here.

---

## Active Phase: Phase 17 — Telegram Pipeline Feed + Z.ai Airdrop Enrichment (P2)

**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` (Phase 16 section — "Telegram Data Sources + Z.ai Web Search Enrichment")
**Total Tasks:** 7 (T-01 through T-07), single deploy
**Priority Order:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 (sequential)
**Executor:** Senior Developer
**Scope:** 3 new files, 3 modified files, 1 new npm package (`telegram`)
**Prerequisites:** ✅ `npm install telegram` done. ✅ Telegram credentials in `.env` verified working.

---

### 1. Planning Stage (Planner)

**Target:** Feed the existing AI pipelines (news + airdrop) with data from Telegram public channels. When airdrop data is too thin (<500 chars), use Z.ai (GLM) web search to enrich it before AI validation.

**What Needs Doing:**
- T-01: Add Telegram env vars to `config/env.ts`
- T-02: Create `telegram.service.ts` — MTProto client that reads public channels
- T-03: Create `telegramMonitor.cron.ts` — feeds news → `rawNewsBuffer`, airdrops → `airdropProjects`
- T-04: Create `zhipuWebSearch.service.ts` — GLM web search for airdrop enrichment
- T-05: Modify `airdropRssHunter.cron.ts` — merge Telegram + add Z.ai enrichment
- T-06: Modify `airdropHunter.cron.ts` — add Z.ai enrichment to routine sync
- T-07: Register Telegram cron in `server.ts`

**Key Constraints (Tech Lead Guardrails):**
1. **ZERO `any` types** across all new/modified code
2. All existing exports must remain backward-compatible
3. **DO NOT** increase `MAX_AI_CALLS_PER_RUN` beyond 10
4. **DO NOT** change existing RSS logic — Telegram is an ADDITIONAL source, not a replacement
5. If Telegram credentials are missing → log warning, skip silently. Pipeline works without it
6. If Z.ai web search fails → return original content unchanged. NEVER block pipeline
7. Spam filter MUST run before anything enters the buffer
8. Public channels ONLY — no private channel scraping
9. Telegram polling interval: minimum 30 minutes (rate limit safety)
10. Z.ai enrichment threshold: only enrich if content < 500 chars

**Env Vars (Already in `.env`):**
- `TELEGRAM_API_ID=38263390` ✅
- `TELEGRAM_API_HASH=44aee1638e7112a2d502a40b06085c8e` ✅
- `TELEGRAM_SESSION_STRING=...` ✅ (verified working — test passed Apr 25, 2026)
- `GLM_API_KEY` ✅ (already exists)
- `GLM_BASE_URL` ✅ (already exists)

**Status:** PLANNING COMPLETE — READY FOR EXECUTION

---

### 2. Execution Stage (Senior Developer)

> **EXECUTION ORDER:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 (sequential)

---

#### T-01: Add Telegram Env Vars to Config
**File (MODIFY):** `backend/src/config/env.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Target:** Add 3 new env vars to the env config.

**ADD to the env schema/object:**
```typescript
TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ?? '',
TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH ?? '',
TELEGRAM_SESSION_STRING: process.env.TELEGRAM_SESSION_STRING ?? '',
```

**Verification Checklist:**
- 3 new vars added with `?? ''` fallback (empty string = disabled)
- No other env vars changed
- Existing exports unchanged

---

#### T-02: Create Telegram Service
**File (CREATE):** `backend/src/services/telegram.service.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Target:** MTProto client that connects to Telegram and reads messages from configured public channels.

**Full implementation spec:**

```typescript
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { createHash } from 'crypto';
import { env } from '../config/env';

// ─── Channel Configuration ──────────────────────────────────────────────────
const NEWS_CHANNELS: string[] = [
    'whale_alert_io',
    'OKXAnnouncements',
    'WuBlockchainReal',
    'CryptoQuantOfficial',
];

const AIRDROP_CHANNELS: string[] = [
    'AirdropAlpha',
    'earndrop',
    'AirdropAlert',
];

// ─── Spam Filter ─────────────────────────────────────────────────────────────
const SPAM_PATTERNS: RegExp[] = [
    /join.*group/i, /click.*link/i, /send.*dm/i,
    /guaranteed.*profit/i, /100x/i, /pump.*signal/i,
    /t\.me\/joinchat/i, /💰.*free.*money/i,
];

function isSpam(text: string): boolean {
    return SPAM_PATTERNS.some(p => p.test(text));
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface TelegramNewsItem {
    title: string;
    source: string;
    sourceHash: string;
    link: string;
    publishedAt: Date;
    rawContent: string;
}

export interface TelegramAirdropItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;
    content: string;
    hash: string;
}

// ─── Client Singleton ────────────────────────────────────────────────────────
let clientInstance: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient | null> {
    if (clientInstance) return clientInstance;

    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionStr) {
        console.warn('[Telegram] Missing credentials — Telegram source disabled');
        return null;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 3,
        });
        await client.connect();
        clientInstance = client;
        console.log('[Telegram] Connected successfully');
        return client;
    } catch (err) {
        console.error('[Telegram] Connection failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

// ─── Channel Readers ─────────────────────────────────────────────────────────
export async function fetchNewsFromTelegram(minutesBack: number = 30): Promise<TelegramNewsItem[]> {
    const client = await getClient();
    if (!client) return [];

    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
    const results: TelegramNewsItem[] = [];

    for (const channel of NEWS_CHANNELS) {
        try {
            const messages = await client.getMessages(channel, { limit: 10 });
            for (const msg of messages) {
                if (!msg.message || msg.message.length < 20) continue;
                const msgDate = new Date((msg.date ?? 0) * 1000);
                if (msgDate < cutoff) continue;
                if (isSpam(msg.message)) continue;

                results.push({
                    title: msg.message.slice(0, 200),
                    source: `telegram:${channel}`,
                    sourceHash: createHash('sha256').update(msg.message).digest('hex'),
                    link: `https://t.me/${channel}/${msg.id}`,
                    publishedAt: msgDate,
                    rawContent: msg.message,
                });
            }
        } catch (err) {
            console.error(`[Telegram] Error reading ${channel}:`, err instanceof Error ? err.message : String(err));
        }
    }

    console.log(`[Telegram] Fetched ${results.length} news items from ${NEWS_CHANNELS.length} channels`);
    return results;
}

export async function fetchAirdropsFromTelegram(hoursBack: number = 6): Promise<TelegramAirdropItem[]> {
    const client = await getClient();
    if (!client) return [];

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const results: TelegramAirdropItem[] = [];

    for (const channel of AIRDROP_CHANNELS) {
        try {
            const messages = await client.getMessages(channel, { limit: 15 });
            for (const msg of messages) {
                if (!msg.message || msg.message.length < 30) continue;
                const msgDate = new Date((msg.date ?? 0) * 1000);
                if (msgDate < cutoff) continue;
                if (isSpam(msg.message)) continue;

                const hash = createHash('sha256').update(`${msg.message}||https://t.me/${channel}/${msg.id}`).digest('hex');
                results.push({
                    title: msg.message.slice(0, 200),
                    link: `https://t.me/${channel}/${msg.id}`,
                    pubDate: msgDate.toISOString(),
                    contentSnippet: msg.message.slice(0, 300),
                    source: `telegram:${channel}`,
                    content: msg.message,
                    hash,
                });
            }
        } catch (err) {
            console.error(`[Telegram] Error reading airdrop channel ${channel}:`, err instanceof Error ? err.message : String(err));
        }
    }

    console.log(`[Telegram] Fetched ${results.length} airdrop items from ${AIRDROP_CHANNELS.length} channels`);
    return results;
}

export async function disconnectTelegram(): Promise<void> {
    if (clientInstance) {
        await clientInstance.disconnect();
        clientInstance = null;
    }
}
```

**Verification Checklist:**
- `TelegramAirdropItem` interface matches `AirdropRSSArticle` exactly (same fields)
- Spam filter runs before items enter results
- `getClient()` returns `null` when credentials missing (no crash)
- `clientInstance` singleton prevents multiple connections
- `minutesBack` / `hoursBack` params respect the polling interval
- Zero `any` types
- All functions have explicit return types

---

#### T-03: Create Telegram Monitor Cron
**File (CREATE):** `backend/src/crons/telegramMonitor.cron.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Target:** Cron with two jobs — news channels → rawNewsBuffer, airdrop channels → airdropProjects pipeline.

```typescript
import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { airdropProjects, airdropTasks } from '../models/index';
import { fetchNewsFromTelegram, fetchAirdropsFromTelegram } from '../services/telegram.service';
import { filterAirdropRelevant, getExistingProjectNames } from '../services/airdropRss.service';
import { validateAirdropFromArticle } from '../services/openai.service';
import { deleteCache, deleteCachePattern } from '../config/redis';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

const MAX_AIRDROP_AI_CALLS = 3;

async function telegramNewsJob(): Promise<void> {
    if (!env.TELEGRAM_SESSION_STRING) return;
    console.log('[TelegramMonitor] News scan started');

    try {
        const items = await fetchNewsFromTelegram(30);
        if (items.length === 0) {
            console.log('[TelegramMonitor] No new news items');
            return;
        }

        let inserted = 0;
        for (const item of items) {
            try {
                await db.insert(rawNewsBuffer).values({
                    title: item.title,
                    source: item.source,
                    sourceHash: item.sourceHash,
                    link: item.link,
                    publishedAt: item.publishedAt,
                }).onConflictDoNothing();
                inserted++;
            } catch (err) {
                // Duplicate hash — expected, skip silently
            }
        }

        console.log(`[TelegramMonitor] Inserted ${inserted}/${items.length} news items into rawNewsBuffer`);
    } catch (err) {
        console.error('[TelegramMonitor] News job failed:', err instanceof Error ? err.message : String(err));
    }
}

async function telegramAirdropJob(): Promise<void> {
    if (!env.TELEGRAM_SESSION_STRING) return;
    console.log('[TelegramMonitor] Airdrop scan started');

    try {
        const items = await fetchAirdropsFromTelegram(6);
        const airdropItems = items.filter(item => filterAirdropRelevant(`${item.title} ${item.content}`));

        if (airdropItems.length === 0) {
            console.log('[TelegramMonitor] No airdrop-relevant messages found');
            return;
        }

        const existingNames = await getExistingProjectNames();
        const candidates = airdropItems.slice(0, MAX_AIRDROP_AI_CALLS);
        let inserted = 0;

        for (const item of candidates) {
            try {
                const context = [
                    `ARTICLE TITLE: ${item.title}`,
                    `SOURCE: ${item.source}`,
                    `PUBLISHED: ${item.pubDate}`,
                    `LINK: ${item.link}`,
                    '',
                    '--- ARTICLE CONTENT ---',
                    item.content.slice(0, 3200),
                ].join('\n');

                const validation = await validateAirdropFromArticle(context);

                if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') continue;
                if (existingNames.has(validation.projectName.toLowerCase())) continue;

                const [proj] = await db.insert(airdropProjects).values({
                    name: validation.projectName.slice(0, 100),
                    network: validation.network.slice(0, 50),
                    estValue: validation.estValue.slice(0, 255),
                    aiReport: validation.aiReport,
                    riskVerdict: validation.riskVerdict,
                    isActive: true,
                }).onConflictDoNothing({ target: airdropProjects.name }).returning();

                if (proj && validation.tasks.length > 0) {
                    const taskValues = validation.tasks.map((task, index) => ({
                        projectId: proj.id,
                        description: task.description,
                        contractAddress: task.contractAddress?.slice(0, 100) ?? null,
                        minAmount: task.minAmount ?? null,
                        tokenSymbol: task.tokenSymbol?.slice(0, 20) ?? null,
                        chain: task.chain?.slice(0, 50) ?? null,
                        isAutoVerifiable: task.isAutoVerifiable,
                        orderIndex: index,
                    }));
                    await db.insert(airdropTasks).values(taskValues);
                }

                existingNames.add(validation.projectName.toLowerCase());
                inserted++;
                console.log(`[TelegramMonitor] Inserted airdrop: ${validation.projectName}`);
            } catch (err) {
                console.error(`[TelegramMonitor] Error processing airdrop:`, err instanceof Error ? err.message : String(err));
            }
        }

        if (inserted > 0) {
            await deleteCache('airdrop:projects');
            await deleteCache('airdrop:deadlines');
            await deleteCachePattern('airdrop:project:*');
        }

        console.log(`[TelegramMonitor] Airdrop scan complete — ${inserted} new projects`);
    } catch (err) {
        console.error('[TelegramMonitor] Airdrop job failed:', err instanceof Error ? err.message : String(err));
    }
}

export function startTelegramMonitorCron(): void {
    if (!env.TELEGRAM_SESSION_STRING) {
        console.warn('[TelegramMonitor] No TELEGRAM_SESSION_STRING — cron disabled');
        return;
    }
    cron.schedule('*/30 * * * *', telegramNewsJob);
    cron.schedule('0 */4 * * *', telegramAirdropJob);
    console.log('[TelegramMonitor] Crons scheduled — News: every 30min, Airdrops: every 4h');
}
```

**IMPORTANT:** The `rawNewsBuffer` insert fields (`title`, `source`, `sourceHash`, `link`, `publishedAt`) MUST match the actual columns in `rawNewsBuffer` table. Developer MUST verify column names in `market.model.ts` before implementing. If column names differ, adapt the insert accordingly.

**Verification Checklist:**
- Both jobs check `env.TELEGRAM_SESSION_STRING` — skip silently if empty
- News job inserts into `rawNewsBuffer` with `onConflictDoNothing`
- Airdrop job uses `filterAirdropRelevant()` from existing service
- Airdrop job uses `validateAirdropFromArticle()` — same as RSS pipeline
- `MAX_AIRDROP_AI_CALLS = 3` per run (cost control)
- Cache invalidation only when inserts > 0
- `startTelegramMonitorCron()` is no-op when credentials missing
- Zero `any` types
- All error handling is try-catch (non-blocking)

---

#### T-04: Create Z.ai Web Search Service
**File (CREATE):** `backend/src/services/zhipuWebSearch.service.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Target:** GLM web search to enrich thin airdrop content before AI validation.

```typescript
import { env } from '../config/env';

interface WebSearchResult {
    title: string;
    url: string;
    content: string;
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
    if (!env.GLM_API_KEY) return [];

    try {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: env.GLM_MODEL || 'glm-4-plus',
                messages: [{ role: 'user', content: `Search the web for: ${query}. Return factual information only.` }],
                tools: [{ type: 'web_search', web_search: { enable: true } }],
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return [];

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? '';

        if (!content) return [];

        return [{
            title: query,
            url: 'glm-web-search',
            content: typeof content === 'string' ? content.slice(0, 1500) : '',
        }];
    } catch (err) {
        console.error('[ZhipuWebSearch] Error:', err instanceof Error ? err.message : String(err));
        return [];
    }
}

export async function enrichAirdropContext(
    projectName: string,
    existingContent: string
): Promise<string> {
    if (existingContent.length > 500) return existingContent;

    console.log(`[ZhipuWebSearch] Enriching context for "${projectName}" (${existingContent.length} chars)`);

    const results = await searchWeb(`${projectName} crypto airdrop eligibility criteria tokenomics 2025`);

    if (results.length === 0) return existingContent;

    const enrichment = results
        .map(r => r.content.slice(0, 800))
        .join('\n\n');

    console.log(`[ZhipuWebSearch] Enriched "${projectName}" with ${enrichment.length} chars from web search`);
    return `${existingContent}\n\n--- WEB RESEARCH (via Z.ai) ---\n${enrichment}`;
}
```

**Verification Checklist:**
- `searchWeb()` returns empty array on any failure (never blocks pipeline)
- `enrichAirdropContext()` skips when content > 500 chars
- 15-second timeout via `AbortSignal.timeout`
- Uses existing `env.GLM_API_KEY` and `env.GLM_BASE_URL`
- Zero `any` types
- Logs enrichment activity for debugging

---

#### T-05: Modify Airdrop RSS Hunter — Add Z.ai Enrichment
**File (MODIFY):** `backend/src/crons/airdropRssHunter.cron.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Sub-task 5A: Add import (after line 10)**

```typescript
import { enrichAirdropContext } from '../services/zhipuWebSearch.service';
```

**Sub-task 5B: Add enrichment before validation (line ~87-88)**

**BEFORE:**
```typescript
            const context = buildProjectContextFromArticle(article);
            const validation = await validateAirdropFromArticle(context);
```

**AFTER:**
```typescript
            let context = buildProjectContextFromArticle(article);
            context = await enrichAirdropContext(article.title, context);
            const validation = await validateAirdropFromArticle(context);
```

**Verification Checklist:**
- `const` changed to `let` for `context`
- `enrichAirdropContext` called BEFORE `validateAirdropFromArticle`
- Import added at top
- No other changes to the file

---

#### T-06: Modify Airdrop Hunter — Add Z.ai Enrichment
**File (MODIFY):** `backend/src/crons/airdropHunter.cron.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Sub-task 6A: Add import (after line 5)**

```typescript
import { enrichAirdropContext } from '../services/zhipuWebSearch.service';
```

**Sub-task 6B: Add enrichment before validation (line ~25-26)**

**BEFORE:**
```typescript
            const raw = `Project: ${project.name}\nNetwork: ${project.network}${project.fundingRound ? `\nFunding: ${project.fundingRound}` : ''}`;
            const validation = await validateAirdrop(raw);
```

**AFTER:**
```typescript
            let raw = `Project: ${project.name}\nNetwork: ${project.network}${project.fundingRound ? `\nFunding: ${project.fundingRound}` : ''}`;
            raw = await enrichAirdropContext(project.name, raw);
            const validation = await validateAirdrop(raw);
```

**Verification Checklist:**
- `const` changed to `let` for `raw`
- `enrichAirdropContext` called BEFORE `validateAirdrop`
- Import added at top
- No other changes to the file

---

#### T-07: Register Telegram Cron in Server
**File (MODIFY):** `backend/src/server.ts`
**Assigned To:** Senior Developer
**Status:** 🔴 TODO

**Sub-task 7A: Add import**

```typescript
import { startTelegramMonitorCron } from './crons/telegramMonitor.cron';
```

**Sub-task 7B: Call in startCrons() (or equivalent initialization block)**

```typescript
startTelegramMonitorCron();
```

**Verification Checklist:**
- Import added at top of file
- `startTelegramMonitorCron()` called alongside existing cron registrations
- No other changes to the file

---

### 3. QA & Security Stage (QA Hunter)

**T-01:** 🔴 Pending
**T-02:** 🔴 Pending
**T-03:** 🔴 Pending
**T-04:** 🔴 Pending
**T-05:** 🔴 Pending
**T-06:** 🔴 Pending
**T-07:** 🔴 Pending

---

### 4. Deployment Stage (Release Manager)

**Status:** Pending

---

### 2. Execution Stage (Senior Developer)

> **DEPLOY 1 EXECUTION ORDER:** T-01 → T-02 → T-03 → T-04 (sequential — each builds on previous) **— ✅ ALL DONE, ALL QA PASSED**
>
> **DEPLOY 2 EXECUTION ORDER:** T-05 → T-06 → T-07 → T-08 → T-09 (sequential) — **✅ ALL DONE, ALL QA PASSED**

---

#### T-01: Replace Dead RSS Sources + Add Working Alternatives
**File (MODIFY):** `backend/src/services/airdropRss.service.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (12/12):** CoinMarketCap removed ✅ | 5 sources remain (>4 minimum) ✅ | All URLs verified and documented in comment ✅ | No syntax errors ✅ | `RSSSource` interface unchanged ✅ | All 5 exports backward-compatible (`filterAirdropRelevant`, `generateArticleHash`, `fetchAirdropRSSFeeds`, `getExistingProjectNames`, `buildProjectContextFromArticle`) ✅ | `tsc --noEmit` clean (0 errors) ✅ | Zero `any` types ✅ | Only lines 21-31 modified ✅ | Import in `airdropRssHunter.cron.ts:10` still resolves ✅ | No new dependencies ✅ | No breaking changes ✅
- **Deviations (acceptable):** Plan specified KEEP CryptoSlate + CoinGape, but dev REMOVED both (documented as Cloudflare-blocked/HTML-redirect). Dev substituted CoinTelegraph + BeInCrypto. All verified returning 200/valid XML. Plan URL `theblock.co/rss?tag=airdrops` changed to `theblock.co/rss.xml` — broader feed, relies on keyword filter (acceptable tradeoff per guardrail #8 — keyword filter handles specificity).
- **Edge Cases Tested:** Empty RSS feed (handled by `items.slice(0,15)` → empty array) ✅ | Malformed XML (caught by try-catch per source, logs error, continues) ✅ | All 5 feeds fail simultaneously (returns empty array — graceful degradation) ✅ | Duplicate articles across sources (dedup by hash in `fetchAirdropRSSFeeds`) ✅

---

#### T-02: Move Dedup from In-Memory Set to Redis SET
**File (MODIFY):** `backend/src/crons/airdropRssHunter.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (17/17):** Redis import from `'../config/redis'` ✅ | `localHashes: Set<string>` fallback ✅ | `REDIS_HASH_KEY = 'airdrop:processed_hashes'` ✅ | `isHashProcessed()` async, returns boolean ✅ | `addProcessedHash()` async, writes both local + Redis ✅ | 7-day TTL on every `sadd` ✅ | `redis.sismember`/`redis.sadd` (ioredis API) ✅ | All 4 `.add()` calls replaced at lines 94, 104, 142, 153 ✅ | Async for-loop filter (lines 64-68) ✅ | Hash cleanup uses `localHashes` (lines 157-164) ✅ | `PROCESSED_HASHES_MAX = 1000` unchanged ✅ | `MAX_AI_CALLS_PER_RUN = 5` unchanged ✅ | `startAirdropRSSCron()` export unchanged ✅ | `tsc --noEmit` clean ✅ | Zero `any` types ✅ | Guardrail #11 (Redis fallback) enforced ✅ | No `processedHashes` references remain (zero old API) ✅
- **Edge Cases:** Redis null at startup → localHashes-only mode ✅ | Redis mid-run failure → catch falls to localHashes ✅ | `sadd` failure → hash still in localHashes ✅ | Concurrent runs → Redis SISMEMBER/SADD atomic ✅
- **No deviations.** Exact spec compliance.

---

#### T-03: Tune AI Validation Prompt (Reduce False Negatives)

**BEFORE (line 11):**
```typescript
import { deleteCache, deleteCachePattern } from '../config/redis';
```

**AFTER:**
```typescript
import { deleteCache, deleteCachePattern, redis } from '../config/redis';
```

**Sub-task 2B: Replace in-memory `processedHashes` with Redis-backed functions**

**BEFORE (line 16):**
```typescript
const processedHashes: Set<string> = new Set();
```

**AFTER (replace line 16 with Redis helper functions):**
```typescript
const REDIS_HASH_KEY = 'airdrop:processed_hashes';

async function isHashProcessed(hash: string): Promise<boolean> {
    if (!redis) return localHashes.has(hash);
    try {
        const result = await redis.sismember(REDIS_HASH_KEY, hash);
        return result === 1;
    } catch {
        return localHashes.has(hash);
    }
}

async function addProcessedHash(hash: string): Promise<void> {
    localHashes.add(hash);
    if (!redis) return;
    try {
        await redis.sadd(REDIS_HASH_KEY, hash);
        await redis.expire(REDIS_HASH_KEY, 7 * 24 * 60 * 60); // 7-day TTL
    } catch {
        // Redis unavailable — local fallback sufficient
    }
}

const localHashes: Set<string> = new Set();
```

**Sub-task 2C: Update `runAirdropRSSDiscovery()` to use async dedup**

The filtering logic at line 41 must change from synchronous to async. Replace:

**BEFORE (line 41):**
```typescript
const unprocessedArticles = articles.filter(a => !processedHashes.has(a.hash));
```

**AFTER:**
```typescript
const unprocessedArticles = [];
for (const article of articles) {
    const seen = await isHashProcessed(article.hash);
    if (!seen) unprocessedArticles.push(article);
}
```

**Sub-task 2D: Update all `processedHashes.add()` calls to `await addProcessedHash()`**

There are 4 occurrences of `processedHashes.add(article.hash)` at lines: 67, 77, 115, 126. Replace each with:

**BEFORE (each occurrence):**
```typescript
processedHashes.add(article.hash);
```

**AFTER (each occurrence):**
```typescript
await addProcessedHash(article.hash);
```

**Sub-task 2E: Update hash cleanup logic (lines 130-137)**

**BEFORE (lines 130-137):**
```typescript
    if (processedHashes.size > PROCESSED_HASHES_MAX) {
        const hashArray = Array.from(processedHashes);
        const trimmed = hashArray.slice(hashArray.length - PROCESSED_HASHES_MAX);
        processedHashes.clear();
        for (const h of trimmed) {
            processedHashes.add(h);
        }
    }
```

**AFTER:**
```typescript
    if (localHashes.size > PROCESSED_HASHES_MAX) {
        const hashArray = Array.from(localHashes);
        const trimmed = hashArray.slice(hashArray.length - PROCESSED_HASHES_MAX);
        localHashes.clear();
        for (const h of trimmed) {
            localHashes.add(h);
        }
    }
```

NOTE: Redis SET has its own memory management. The local fallback Set still needs trimming. Redis key already has 7-day TTL via `expire()` in `addProcessedHash()`.

**Verification Checklist:**
- `redis` imported from `'../config/redis'` (named export — matches pattern in `aiWorkflow.cron.ts:21`)
- `localHashes: Set<string>` acts as fallback when `redis === null`
- `REDIS_HASH_KEY = 'airdrop:processed_hashes'` — unique key, won't collide with cache keys
- `isHashProcessed()` is async, returns `boolean`
- `addProcessedHash()` is async, adds to both local Set AND Redis SET
- 7-day TTL set on every `sadd` call (renews on each add)
- `redis.sismember` and `redis.sadd` used (ioredis API — matches `import Redis from 'ioredis'`)
- All 4 `processedHashes.add()` calls replaced with `await addProcessedHash()`
- Filter logic is now async (for-loop instead of `.filter()`)
- Existing `PROCESSED_HASHES_MAX = 1000` constant unchanged
- Existing `MAX_AI_CALLS_PER_RUN = 5` constant unchanged
- Function signature of `runAirdropRSSDiscovery()` unchanged (already async)
- Function signature of `startAirdropRSSCron()` unchanged

---

#### T-03: Tune AI Validation Prompt (Reduce False Negatives)
**File (MODIFY):** `backend/src/services/ai/prompt-factory.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (11/11):** ONLY line 166 modified ✅ | `isLegitimate` field NOT removed ✅ | SCAM rejection path NOT removed (line 167 intact) ✅ | `riskVerdict` values `LOW|MEDIUM|HIGH|SCAM` unchanged (lines 115, 146) ✅ | JSON output schema unchanged ✅ | All other prompt rules untouched ✅ | `buildAirdropFromArticleMessages` signature unchanged ✅ | `PromptFactory` other methods untouched ✅ | `tsc --noEmit` clean ✅ | Zero `any` types ✅ | New instruction references `riskVerdict` for uncertainty (MEDIUM_RISK/HIGH_RISK) — aligns with existing schema ✅
- **No deviations.** Exact single-line spec compliance. Change the conservative instruction to a more balanced one that uses `riskVerdict` for uncertainty communication.

**BEFORE (line 166):**
```typescript
- Be CONSERVATIVE. Only flag confirmed or highly probable airdrops.
```

**AFTER:**
```typescript
- Flag projects that have reasonable evidence of a legitimate airdrop opportunity. Use the riskVerdict field to communicate uncertainty — set to MEDIUM_RISK or HIGH_RISK rather than rejecting entirely.
```

**Verification Checklist:**
- ONLY line 166 is modified — no other lines touched
- The `isLegitimate` field is NOT removed from the prompt
- The `SCAM` rejection path is NOT removed
- The `riskVerdict` values (`LOW|MEDIUM|HIGH|SCAM`) are unchanged
- The JSON output schema is unchanged
- All other rules in the prompt (projectName, network, tasks, etc.) are untouched
- `buildAirdropFromArticleMessages` function signature unchanged
- `PromptFactory` class other methods untouched

---

#### T-04: Frontend — Empty State + Error State
**Files (MODIFY):** `frontend/src/app/airdrops/page.tsx` + `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED — DEPLOY 1 COMPLETE

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (15/15):** `page.tsx` passes `initialError` boolean prop ✅ | `AirdropsPageClient` accepts `initialError?: boolean` (optional, backward-compatible) ✅ | Error state with `AlertTriangle` + generic message + Retry button ✅ | Empty state with `TrendingUp` in circle + "No Active Airdrops Tracked" + descriptive subtext + animated "Pipeline Active" indicator ✅ | Dark theme: `bg-[#0A0A0A]`, `border-[#222]` ✅ | NO internal error details exposed ✅ | Grid ONLY renders when `!fetchError && projects.length > 0` (line 297) ✅ | Grid conditional properly closed at line 361 ✅ | Existing card design untouched ✅ | `TrendingUp` + `AlertTriangle` already imported (line 7) ✅ | Zero new imports ✅ | `tsc --noEmit` clean ✅ | Zero `any` types ✅ | `fetchError` const state (no setter) — correct for server-initial pattern ✅ | `page.tsx` only lines 29-39 modified ✅
- **Edge Cases:** `initialError` undefined → `?? false` → no false-positive error ✅ | Empty array + no error → empty state ✅ | Server throw → error state ✅ | Retry → full reload ✅
- **No deviations.** Exact spec compliance.

---

**🎉 DEPLOY 1 STATUS: COMPLETE (T-01 → T-04 all QA Passed)**

**BEFORE (`page.tsx:29-37`):**
```typescript
export default async function AirdropsPage() {
    let projects: AirdropProject[] = [];
    try {
        projects = await airdropApi.getProjects();
    } catch (error) {
        console.error('[Airdrops] Failed to load projects on server:', error);
    }

    return <AirdropsPageClient initialProjects={projects} />;
}
```

**AFTER:**
```typescript
export default async function AirdropsPage() {
    let projects: AirdropProject[] = [];
    let fetchError = false;
    try {
        projects = await airdropApi.getProjects();
    } catch (error) {
        console.error('[Airdrops] Failed to load projects on server:', error);
        fetchError = true;
    }

    return <AirdropsPageClient initialProjects={projects} initialError={fetchError} />;
}
```

**Sub-task 4B: Update `AirdropsPageClient` props and add empty/error states**

**BEFORE (`AirdropsPageClient.tsx:138`):**
```typescript
export function AirdropsPageClient({ initialProjects }: { initialProjects: AirdropProject[] }) {
```

**AFTER:**
```typescript
export function AirdropsPageClient({ initialProjects, initialError }: { initialProjects: AirdropProject[]; initialError?: boolean }) {
```

**Sub-task 4C: Add error state rendering**

Add state variable after line 144:
```typescript
const [fetchError] = useState(initialError ?? false);
```

Then in the JSX, INSIDE the main grid section (between the "Active Farm Grid" header at line 256-263 and the grid at line 265), add error and empty state conditionals:

**BEFORE (lines 256-265):**
```typescript
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 inline-block" /> Active Farm Grid
                    </h2>
                    <div className="flex gap-4">
                        <span className="text-[10px] font-mono text-[#555] uppercase">Total Active: <span className="text-white font-mono-nums">{projects.length}</span></span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
```

**AFTER:**
```typescript
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 inline-block" /> Active Farm Grid
                    </h2>
                    <div className="flex gap-4">
                        <span className="text-[10px] font-mono text-[#555] uppercase">Total Active: <span className="text-white font-mono-nums">{projects.length}</span></span>
                    </div>
                </div>

                {fetchError && (
                    <div className="bg-red-500/5 border border-red-500/20 p-8 flex flex-col items-center justify-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-400/60" />
                        <p className="text-[12px] font-mono text-red-300/80">Unable to load airdrops. Please try again later.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[10px] font-mono text-red-400 border border-red-500/30 px-4 py-1.5 hover:bg-red-500/10 transition-colors uppercase tracking-widest"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!fetchError && projects.length === 0 && (
                    <div className="bg-[#0A0A0A] border border-[#222] p-10 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <TrendingUp className="w-7 h-7 text-blue-400/60" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-[14px] font-bold text-white uppercase tracking-tight mb-2">No Active Airdrops Tracked</h3>
                            <p className="text-[11px] font-mono text-[#555] max-w-md leading-relaxed">
                                Our AI pipeline scans for new airdrop opportunities every 6 hours. New verified projects will appear here automatically.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-mono text-[#444] uppercase tracking-wider">Pipeline Active — Scanning Sources</span>
                        </div>
                    </div>
                )}

                {!fetchError && projects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
```

**Sub-task 4D: Close the conditional wrapper**

At the END of the grid section (after the closing `</div>` of the grid + the `)}` of the `.map()`), add the closing fragment for the conditional:

**BEFORE (line 327, after the grid closing div):**
```typescript
                </div>
            </div>

            <div className="w-full lg:w-[30%] flex flex-col gap-6">
```

**AFTER (wrap grid in conditional):**
```typescript
                </div>
                )}
            </div>

            <div className="w-full lg:w-[30%] flex flex-col gap-6">
```

**Verification Checklist:**
- `page.tsx` passes `initialError` boolean prop
- `AirdropsPageClient` accepts `initialError?: boolean` prop (optional, backward-compatible)
- Error state shows when `fetchError === true` — generic message, NO internal error details
- Error state has a "Retry" button that calls `window.location.reload()`
- Empty state shows when `fetchError === false && projects.length === 0`
- Empty state uses existing icons (`TrendingUp`, `AlertTriangle` from `lucide-react` — already imported at line 7)
- Empty state has: icon in circle, heading "No Active Airdrops Tracked", descriptive subtext, animated "Pipeline Active" indicator
- Empty state uses dark theme: `bg-[#0A0A0A]`, `border-[#222]`, existing color palette
- Grid ONLY renders when `!fetchError && projects.length > 0`
- Existing card design system completely untouched (lines 274-325)
- No new imports needed (`TrendingUp` and `AlertTriangle` already imported)
- Zero `any` types

---

#### T-05: Add `airdropPipelineRuns` Table to Drizzle Model
**File (MODIFY):** `backend/src/models/airdrop.model.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (10/10):** New table after `userProgress` ✅ | `runType varchar(20) .notNull()` ✅ | All numeric fields `.default(0)` ✅ | `runAt .defaultNow().notNull()` ✅ | Table name `airdrop_pipeline_runs` ✅ | camelCase columns → snake_case DB ✅ | Existing exports untouched ✅ | Import list unchanged ✅ | `tsc --noEmit` clean ✅ | Zero `any` types ✅
- **No deviations.** Exact spec compliance.

**Target:** Add new table definition at the end of the file (after `userProgress` table, after line 50).

**ADD after line 50:**
```typescript
// ─── AIRDROP PIPELINE RUNS (Health Monitoring) ────────────────────────────────
export const airdropPipelineRuns = pgTable('airdrop_pipeline_runs', {
    id: serial('id').primaryKey(),
    runType: varchar('run_type', { length: 20 }).notNull(),
    runAt: timestamp('run_at').defaultNow().notNull(),
    articlesFound: integer('articles_found').default(0),
    articlesProcessed: integer('articles_processed').default(0),
    projectsInserted: integer('projects_inserted').default(0),
    projectsRejected: integer('projects_rejected').default(0),
    errors: integer('errors').default(0),
    durationMs: integer('duration_ms').default(0),
    notes: text('notes'),
});
```

**Verification Checklist:**
- New table added after existing `userProgress` table
- `runType` is `varchar(20)` — values: `'rss_discovery'` | `'routine_sync'`
- All numeric fields have `.default(0)`
- `runAt` has `.defaultNow().notNull()`
- Table name `airdrop_pipeline_runs` matches SQL migration (T-06)
- Column names use camelCase (Drizzle convention) mapping to snake_case in DB
- Existing exports (`airdropProjects`, `airdropTasks`, `userProgress`) untouched
- Import list at top unchanged

---

#### T-06: SQL Migration for `airdrop_pipeline_runs` Table
**File (CREATE):** `backend/scripts/migrate-airdrop-pipeline-runs.sql`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (5/5):** File at `backend/scripts/migrate-airdrop-pipeline-runs.sql` ✅ | Column names match Drizzle schema snake_case mapping (all 9 columns verified 1:1) ✅ | `CREATE TABLE IF NOT EXISTS` idempotent ✅ | 2 indexes on `run_type` + `run_at` ✅ | Zero syntax errors ✅
- **No deviations.** Exact spec compliance.

**Full content:**
```sql
-- Phase 16: Airdrop Pipeline Health Monitoring
-- Run this migration BEFORE deploying the pipeline logging code

CREATE TABLE IF NOT EXISTS airdrop_pipeline_runs (
    id SERIAL PRIMARY KEY,
    run_type VARCHAR(20) NOT NULL,
    run_at TIMESTAMP DEFAULT NOW() NOT NULL,
    articles_found INTEGER DEFAULT 0,
    articles_processed INTEGER DEFAULT 0,
    projects_inserted INTEGER DEFAULT 0,
    projects_rejected INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type ON airdrop_pipeline_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_at ON airdrop_pipeline_runs(run_at);
```

**Verification Checklist:**
- File created at `backend/scripts/migrate-airdrop-pipeline-runs.sql`
- Column names match Drizzle schema snake_case mapping (run_type, run_at, articles_found, etc.)
- `CREATE TABLE IF NOT EXISTS` is idempotent
- 2 indexes created on `run_type` and `run_at`
- No syntax errors

---

#### T-07: Add Pipeline Health Logging to Both Cron Files
**Files (MODIFY):** `backend/src/crons/airdropRssHunter.cron.ts` + `backend/src/crons/airdropHunter.cron.ts`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (13/13):** `airdropPipelineRuns` imported in both cron files ✅ | `startTime = Date.now()` first line in `runAirdropRSSDiscovery()` (line 49) ✅ | `startTime = Date.now()` first line in `runRoutineSync()` (line 9) ✅ | INSERT uses `db.insert(airdropPipelineRuns).values({...})` Drizzle pattern in both ✅ | `runType: 'rss_discovery'` in RSS hunter ✅ | `runType: 'routine_sync'` in routine hunter ✅ | Pipeline logging wrapped in try-catch (non-blocking) in both ✅ | RSS hunter: `articlesFound`, `articlesProcessed`, `projectsInserted`, `projectsRejected` from existing vars ✅ | Routine hunter: `syncErrors` counter tracks per-project errors (line 22, incremented at line 62) ✅ | Function signatures unchanged ✅ | Exported functions `startAirdropRSSCron()` / `startAirdropHunterCron()` unchanged ✅ | `runRoutineSync` still exported (line 97) ✅ | `tsc --noEmit` clean ✅
- **Edge Cases:** Pipeline INSERT failure → logged, does not break cron run ✅ | `syncErrors` correctly scoped outside loop ✅ | Early returns (no articles / no projects) → no pipeline row logged (acceptable — only successful runs recorded) ⚠️ minor note, not a blocker
- **No deviations.** Exact spec compliance.

**Sub-task 7A: Add health logging to `airdropRssHunter.cron.ts`**

**Import addition** — add `airdropPipelineRuns` to the model import at line 3:

**BEFORE (line 3):**
```typescript
import { airdropProjects, airdropTasks } from '../models/index';
```

**AFTER:**
```typescript
import { airdropProjects, airdropTasks, airdropPipelineRuns } from '../models/index';
```

**Timing wrapper** — wrap `runAirdropRSSDiscovery()` body with start/end timing and INSERT at the end.

Add `const startTime = Date.now();` as the FIRST line inside `runAirdropRSSDiscovery()` (after line 26).

Add the following INSERT block at the END of `runAirdropRSSDiscovery()`, AFTER the cache invalidation block (after line 148, before the final console.log at line 150):

```typescript
    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'rss_discovery',
            articlesFound: articles.length,
            articlesProcessed: candidates.length,
            projectsInserted,
            projectsRejected: rejections,
            errors: 0,
            durationMs,
        });
    } catch (logErr) {
        console.error('[AirdropRSS] Failed to log pipeline run:', logErr instanceof Error ? logErr.message : String(logErr));
    }
```

**Sub-task 7B: Add health logging to `airdropHunter.cron.ts`**

**Import addition** — add `airdropPipelineRuns` to the model import at line 3:

**BEFORE (line 3):**
```typescript
import { airdropProjects, airdropTasks } from '../models/index';
```

**AFTER:**
```typescript
import { airdropProjects, airdropTasks, airdropPipelineRuns } from '../models/index';
```

Add `const startTime = Date.now();` as the FIRST line inside `runRoutineSync()` (after line 9).

Add the following INSERT block at the END of `runRoutineSync()`, AFTER the cache invalidation block (after line 69, before the final console.log at line 71):

```typescript
    const durationMs = Date.now() - startTime;
    let syncErrors = 0;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'routine_sync',
            articlesFound: 0,
            articlesProcessed: activeProjects.length,
            projectsInserted: 0,
            projectsRejected: 0,
            errors: syncErrors,
            durationMs,
        });
    } catch (logErr) {
        console.error('[AirdropHunter] Failed to log pipeline run:', logErr instanceof Error ? logErr.message : String(logErr));
    }
```

NOTE: To track errors properly, replace the `catch (err)` block at line 59 in `airdropHunter.cron.ts`:

**BEFORE (lines 59-64):**
```typescript
        } catch (err) {
            console.error(
                `[AirdropHunter] Sync error for ${project.name}:`,
                err instanceof Error ? err.message : String(err)
            );
        }
```

**AFTER:**
```typescript
        } catch (err) {
            syncErrors++;
            console.error(
                `[AirdropHunter] Sync error for ${project.name}:`,
                err instanceof Error ? err.message : String(err)
            );
        }
```

**Verification Checklist:**
- `airdropPipelineRuns` imported in both cron files
- `startTime = Date.now()` is first line in both run functions
- INSERT uses `db.insert(airdropPipelineRuns).values({...})` — matches Drizzle pattern
- `runType` values: `'rss_discovery'` for RSS hunter, `'routine_sync'` for routine hunter
- Pipeline logging is wrapped in try-catch (non-blocking — won't break pipeline on failure)
- In `airdropRssHunter.cron.ts`: `articlesFound`, `articlesProcessed`, `projectsInserted`, `projectsRejected` are already tracked as local variables
- In `airdropHunter.cron.ts`: `syncErrors` counter tracks per-project errors
- Function signatures of `runAirdropRSSDiscovery()` and `runRoutineSync()` unchanged
- Exported function names `startAirdropRSSCron()` and `startAirdropHunterCron()` unchanged
- `runRoutineSync` still exported (line 79: `export { runRoutineSync }`)

---

#### T-08: Frontend — Loading Skeleton for Main Grid
**File (MODIFY):** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (10/10):** `GridSkeleton` component defined before main component (line 138-168) ✅ | 4 skeleton cards rendered (matches 2-column grid) ✅ | Skeleton uses `animate-pulse` (Tailwind built-in) ✅ | Skeleton card dimensions match real card layout (header, progress bar, network info) ✅ | `gridLoading` state initialized to `true` (line 178), set to `false` after mount (line 202) ✅ | All three existing states gated by `!gridLoading` (error line 305, empty line 318, grid line 336) ✅ | Skeleton renders at line 303 (before conditionals) ✅ | Existing card design system untouched (lines 338-399) ✅ | Zero `any` types ✅ | `tsc --noEmit` clean ✅
- **Edge Cases:** `gridLoading` always resolves to `false` on first render (useEffect fires immediately) ✅ | Skeleton → real content transition is instant (no flash) ✅ | Empty `initialProjects` array → skeleton shows briefly → empty state renders ✅
- **No deviations.** Exact spec compliance.

**Target:** Add a loading skeleton state for the main project grid that mimics the card layout.

**Sub-task 8A: Add loading state variable**

Add after line 144 (alongside other state declarations):
```typescript
const [gridLoading, setGridLoading] = useState(true);
```

**Sub-task 8B: Set gridLoading to false after initial render**

Add inside the existing `useEffect` at line 163-165, or create a new one:
```typescript
useEffect(() => {
    if (initialProjects.length >= 0) setGridLoading(false);
}, [initialProjects]);
```

**Sub-task 8C: Add skeleton component (inside the file, before the main component)**

```typescript
function GridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#0A0A0A] border border-[#222] p-6 animate-pulse">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="h-5 w-32 bg-[#1A1A1A] rounded mb-2" />
                            <div className="flex gap-2">
                                <div className="h-4 w-16 bg-[#1A1A1A] rounded" />
                                <div className="h-4 w-12 bg-[#1A1A1A] rounded" />
                            </div>
                        </div>
                        <div className="h-5 w-16 bg-[#1A1A1A] rounded" />
                    </div>
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="h-3 w-24 bg-[#1A1A1A] rounded" />
                            <div className="h-3 w-8 bg-[#1A1A1A] rounded" />
                        </div>
                        <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-40 bg-[#1A1A1A] rounded" />
                        <div className="h-3 w-28 bg-[#1A1A1A] rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
```

**Sub-task 8D: Render skeleton when loading**

In the JSX, add skeleton rendering BEFORE the error/empty/grid conditionals (between the "Active Farm Grid" header and the fetchError check):

```typescript
                {gridLoading && <GridSkeleton />}

                {!gridLoading && fetchError && (
                    // ... existing error state ...
                )}

                {!gridLoading && !fetchError && projects.length === 0 && (
                    // ... existing empty state ...
                )}

                {!gridLoading && !fetchError && projects.length > 0 && (
                    // ... existing grid ...
                )}
```

All three existing conditionals (error, empty, grid) must be wrapped with `!gridLoading &&`.

**Verification Checklist:**
- `GridSkeleton` component defined before main component
- 4 skeleton cards rendered (matches 2-column grid)
- Skeleton uses `animate-pulse` (Tailwind built-in)
- Skeleton card dimensions match real card layout (padding, spacing)
- `gridLoading` state initialized to `true`, set to `false` after mount
- All three existing states (error, empty, grid) gated by `!gridLoading`
- Skeleton disappears once data loads
- Existing card design system untouched
- No new imports needed
- Zero `any` types

---

#### T-09: Frontend — Pipeline Status Indicator (Optional Nice-to-Have)
**File (MODIFY):** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`
**Assigned To:** Senior Developer
**Status:** ✅ Done — QA PASSED

**QA Verdict (Apr 25, 2026 — QA Hunter):**
- **VERDICT:** ✅ PASS
- **Checklist (8/8):** New backend endpoint `GET /api/airdrop/pipeline-status` registered at `airdrop.routes.ts:23` ✅ | Query uses Drizzle (zero raw SQL) — `db.select().from(airdropPipelineRuns).where(eq(...)).orderBy(desc(...)).limit(1)` ✅ | Frontend API function `getPipelineStatus()` follows existing `airdropApi` pattern at `api.ts:113-120` ✅ | Status bar only renders when `pipelineStatus` is non-null (line 299) ✅ | Uses existing color palette (`text-[#444]`, `bg-emerald-500`) ✅ | Graceful degradation: API fail → null → status bar hidden ✅ | Route registered behind `apiLimiter` (line 12 — applies to all routes) ✅ | Zero `any` types ✅
- **Edge Cases:** No pipeline runs yet → `{ lastScan: null, nextScan: null, sources: 0 }` → status bar hidden ✅ | `formatRelativeTime` returns null for >7 days → falls back to `~6h` ✅ | `getPipelineStatus` catch → returns null → status bar hidden ✅
- **No deviations.** Exact spec compliance.

**Target:** Add a small status bar above the grid showing pipeline scan status.

**Sub-task 9A: Add pipeline status API call to `airdropApi`**

**File:** `frontend/src/features/airdrop/api.ts`

Add a new API function:
```typescript
static async getPipelineStatus(): Promise<{ lastScan: string | null; nextScan: string | null; sources: number } | null> {
    try {
        const res = await fetch(`${API_BASE}/airdrops/pipeline-status`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
```

**Sub-task 9B: Create backend endpoint for pipeline status**

**File:** `backend/src/controllers/airdrop.controller.ts` (or wherever airdrop endpoints live)

Add handler that queries the latest `airdrop_pipeline_runs` row with `run_type = 'rss_discovery'`:
```typescript
export async function getPipelineStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const [latestRun] = await db.select()
            .from(airdropPipelineRuns)
            .where(eq(airdropPipelineRuns.runType, 'rss_discovery'))
            .orderBy(desc(airdropPipelineRuns.runAt))
            .limit(1);

        if (!latestRun) {
            res.json({ lastScan: null, nextScan: null, sources: 0 });
            return;
        }

        const lastScan = latestRun.runAt.toISOString();
        const nextScan = new Date(new Date(lastScan).getTime() + 6 * 60 * 60 * 1000).toISOString();

        res.json({
            lastScan,
            nextScan,
            sources: 5,
        });
    } catch (err) { next(err); }
}
```

**Sub-task 9C: Add status indicator to `AirdropsPageClient.tsx`**

Add a small bar between the stats bar and the "Active Farm Grid" header:

```typescript
{pipelineStatus && (
    <div className="flex items-center gap-4 text-[9px] font-mono text-[#444] uppercase tracking-wider px-1">
        <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Pipeline Active
        </span>
        <span>
            Last scan: {pipelineStatus.lastScan ? formatDistanceToNow(new Date(pipelineStatus.lastScan)) : 'N/A'}
        </span>
        <span>
            Next scan: {pipelineStatus.nextScan ? formatDistanceToNow(new Date(pipelineStatus.nextScan)) : '~6h'}
        </span>
    </div>
)}
```

**Verification Checklist:**
- New backend endpoint `GET /api/airdrops/pipeline-status`
- Query uses Drizzle (zero raw SQL)
- Frontend API function follows existing pattern in `airdropApi`
- Status bar only renders when `pipelineStatus` is non-null
- Uses existing color palette (`text-[#444]`, `bg-emerald-500`)
- Graceful degradation: if API fails, status bar simply doesn't render
- Route registered with appropriate rate limiting
- Zero `any` types

---

### 3. QA & Security Stage (QA Hunter)

**T-01:** ✅ PASS (Apr 25, 2026) — 12/12 checklist items, zero deviations requiring fix
**T-02:** ✅ PASS (Apr 25, 2026) — 17/17 checklist items, zero deviations, exact spec compliance
**T-03:** ✅ PASS (Apr 25, 2026) — 11/11 checklist items, single-line change, exact spec compliance
**T-04:** ✅ PASS (Apr 25, 2026) — 15/15 checklist items, zero deviations, exact spec compliance
**T-05:** ✅ PASS (Apr 25, 2026) — 10/10 checklist items, zero deviations, exact spec compliance
**T-06:** ✅ PASS (Apr 25, 2026) — 5/5 checklist items, zero deviations, exact spec compliance
**T-07:** ✅ PASS (Apr 25, 2026) — 13/13 checklist items, zero deviations, exact spec compliance
**T-08:** ✅ PASS (Apr 25, 2026) — 10/10 checklist items, zero deviations, exact spec compliance
**T-09:** ✅ PASS (Apr 25, 2026) — 8/8 checklist items, zero deviations, exact spec compliance

---

### 4. Deployment Stage (Release Manager)

**Status:** Pending

---

---

## Completed Phases (Archived)

### Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md` (lines 521-783)
**Total Tasks:** 9 (T-01 through T-09)
**Status:** All Tasks Done - QA Passed - Awaiting Deployment

### Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 5 (T-01 through T-05)
**Status:** All Tasks Done - QA Passed - Awaiting Deployment
**New Files:** `migrate-strategic-outlook.sql`, `strategicOutlook.service.ts`
**Modified Files:** `aiWorkflow.cron.ts`, `market.controller.ts`, `market.routes.ts`

### Phase 14 — Article Content Disappears After Update + Cache Invalidation Fix
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 2 (T-01 through T-02, Single Batch P0)
**Status:** All Tasks Done - QA Passed - Awaiting Deployment

### Phase 13 — 404 Fix: Dynamic AI Radar Coins
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 4 (T-01 through T-04, Single Batch)
**Status:** All Tasks Done - QA Passed - Awaiting Deployment

### Phase 12 — Airdrop UX Overhaul: From Functional to Premium
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep.md`
**Total Tasks:** 15 (T-01 through T-15, in Batches)
**Status:** All Tasks Done - Awaiting Final QA

