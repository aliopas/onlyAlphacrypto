# 🚀 OnlyAlpha — Master Execution Plan
### From Zero to Production-Ready

**Created:** 2026-04-09
**Status:** Active
**Total Phases:** 7 | **Estimated Duration:** 6-8 weeks

---

## 📋 Table of Contents

1. [Phase 0: Critical Hotfixes](#phase-0-critical-hotfixes)
2. [Phase 1: AI Cost Optimization & Infrastructure](#phase-1-ai-cost-optimization--infrastructure)
3. [Phase 2: Living Article System](#phase-2-living-article-system)
4. [Phase 3: Temporal Intelligence Layer](#phase-3-temporal-intelligence-layer)
5. [Phase 4: Chat System Rebuild](#phase-4-chat-system-rebuild)
6. [Phase 5: Frontend Refactor & Institutional Branding](#phase-5-frontend-refactor--institutional-branding)
7. [Phase 6: Text Embeddings & Semantic Dedup](#phase-6-text-embeddings--semantic-dedup)
8. [Appendix A: Dead Code Cleanup](#appendix-a-dead-code-cleanup)
9. [Appendix B: Model Cost Map](#appendix-b-model-cost-map)

---

## Legend

```
[ ] = Not started
[~] = In progress
[x] = Done
[!] = Blocked / needs decision
```

---

# Phase 0: Critical Hotfixes
**Priority:** 🔴 CRITICAL — Do before ANYTHING else
**Duration:** 1-2 days
**Goal:** Make the existing product actually work

---

## Task 0.1: Fix Chat Context Mode Mismatch
**Bug:** Context AI never activates — users always get General AI regardless of mode selection.
**Root Cause:** Backend checks for `resolvedMode === 'private'` but frontend sends `mode: 'context'`.

### 0.1.1 — Backend: Accept 'context' as valid mode
**File:** `backend/src/controllers/chat.controller.ts`

```diff
 // Line 36 — Change the condition to accept both 'private' and 'context'
-if (resolvedMode === 'private' && articleId && articleType) {
+if ((resolvedMode === 'private' || resolvedMode === 'context') && articleId && articleType) {
```

### 0.1.2 — Backend: Read mode from request body too
**File:** `backend/src/controllers/chat.controller.ts`

```diff
 // Line 28 — Also check the body mode field
-const resolvedMode = isContextRoute ? 'private' : (mode || 'general');
+const resolvedMode = isContextRoute ? 'private' : (mode === 'context' ? 'context' : 'general');
```

### 0.1.3 — Frontend: Route to correct endpoint based on mode
**File:** `frontend/src/features/terminal/hooks/useTerminalChat.ts`

The frontend must send Context requests to `/chat/stream/context` (which has `authMiddleware`), not the general `/chat/stream` endpoint.

```diff
 // Line 89 — Change endpoint based on mode
-const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/chat/stream`, {
+const chatEndpoint = mode === 'context'
+    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/chat/stream/context`
+    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/chat/stream`;
+const resp = await fetch(chatEndpoint, {
```

> **Note on `userPlan`:** The `AuthRequest` interface already includes `userPlan?: string` (line 7 of `auth.middleware.ts`) and it's already populated from the JWT in both `authMiddleware` (line 23) and `optionalAuth` (line 38). No changes needed.

**Status:** `[ ]`

---

## Task 0.1b: General AI Ignores Article Context
**Bug:** When in "General AI" mode, the chat completely ignores `articleId` — users can't ask questions about the article they're viewing.
**Source:** `Issues_And_Improvements_Log.md` — Issue #4 under AI Chat System Failures
**Root Cause:** The General branch in `chat.controller.ts` skips the article context fetch entirely.

**File:** `backend/src/controllers/chat.controller.ts`

Even in General mode, if an `articleId` is provided, inject a lightweight context:

```diff
 // After the context branch (line ~85), add fallback for General mode:
+// Even in general mode, if user is viewing an article, include it as light context
+if (resolvedMode === 'general' && articleId && articleType) {
+    try {
+        const table = articleType === 'WIRE' ? coinNews : radarSignals;
+        const [item] = await db.select().from(table).where(eq(table.id, articleId)).limit(1);
+        if (item) {
+            const headline = 'headline' in item ? item.headline : ('signalText' in item ? item.signalText : '');
+            systemPrompt += `\n\n[ARTICLE CONTEXT]: The user is currently viewing: "${headline}". You may reference this if relevant to their question.`;
+        }
+    } catch { /* non-blocking */ }
+}
```

**Status:** `[ ]`

---

## Task 0.2: Fix SSE Stream Parsing Bug
**Bug:** Users see raw JSON like `{"content":"Hello"}` instead of plain text.
**Root Cause:** Frontend appends raw JSON string to buffer without parsing.

**File:** `frontend/src/features/terminal/hooks/useTerminalChat.ts`

```diff
 // Lines 110-113 — Parse the JSON to extract content
 text.split('\n').filter(l => l.startsWith('data:')).forEach(line => {
     const chunk = line.slice(5).trim();
-    if (chunk && chunk !== '[DONE]') { aiBuffer += chunk; }
+    if (chunk && chunk !== '[DONE]') {
+        try {
+            const parsed = JSON.parse(chunk);
+            if (parsed.content) aiBuffer += parsed.content;
+            if (parsed.error) aiBuffer += `\n⚠️ ${parsed.error}`;
+        } catch {
+            // If not valid JSON, append as-is (fallback)
+            aiBuffer += chunk;
+        }
+    }
 });
```

**Status:** `[ ]`

---

## Task 0.3: Fix Buffer Cleanup (ttlExpiresAt never set)
**Bug:** `raw_news_buffer` grows forever — cleanup cron deletes nothing because `ttlExpiresAt` is always NULL.
**Root Cause:** `terminalEngine.cron.ts` inserts rows without setting `ttlExpiresAt`.

**File:** `backend/src/crons/terminalEngine.cron.ts`

```diff
 // Lines 45-49 — Add ttlExpiresAt when inserting
 await db.insert(rawNewsBuffer).values({
     title: rawText,
     source: newsItem.source || 'Unknown',
     sourceHash: hash,
+    ttlExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
 }).onConflictDoNothing();
```

**Status:** `[ ]`

---

## Task 0.4: Fix Asset Count Showing 0
**Bug:** "Scanning X Assets" always shows 0.
**Root Cause:** Counting from `market_insights` table (never populated by current workflow) instead of `coin_news`.

**File:** `backend/src/controllers/market.controller.ts`

```diff
 // Lines 135-137 — Count from the table that actually has data
+import { coinNews } from '../models/index';
+
 const [{ count }] = await db
-    .select({ count: sql<number>`COUNT(DISTINCT ${marketInsights.coinSymbol})` })
-    .from(marketInsights);
+    .select({ count: sql<number>`COUNT(DISTINCT ${coinNews.coinSymbol})` })
+    .from(coinNews);
```

> **Note:** `coinNews` is already imported at the top of the file. Only the query itself needs to change.

**Status:** `[ ]`

### 0.4.2 — Fix Aggressive Caching on Zero
**Bug:** Asset count cached for 300 seconds. If initial result is 0, UI shows 0 for 5 minutes even after data appears.
**Source:** `Issues_And_Improvements_Log.md` — Issue #2 under Scanning Assets

```diff
 // market.controller.ts — Line 140
-await setCache(cacheKey, result, 300);
+await setCache(cacheKey, result, count > 0 ? 300 : 30); // Short cache if 0 to re-check quickly
```

### 0.4.3 — Fix Misleading Metric Source
**Bug:** "Scanning Assets" should reflect total monitored tokens, not only those with full insights.
**Source:** `Issues_And_Improvements_Log.md` — Issue #3 under Scanning Assets

The fix in 0.4 (switching to `coinNews`) already addresses this. But for an even more accurate count, use `radarSignals`:

```typescript
// Alternative — count from radar_signals (reflects actual AI-processed tokens)
const [{ count }] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${radarSignals.coinSymbol})` })
    .from(radarSignals);
```

**Status:** `[ ]`

---

## Task 0.5: Protect force-seed Endpoint
**Bug:** `/api/market/force-seed` has no authentication — anyone can trigger all AI crons.
**Root Cause:** Missing `authMiddleware`.

**File:** `backend/src/routes/market.routes.ts`

```diff
+import { authMiddleware } from '../middleware/auth.middleware';
+
 // Line 17 — Add auth protection
-router.post('/force-seed', forceSeed);
+router.post('/force-seed', authMiddleware, forceSeed);
```

**Status:** `[ ]`

---

## Task 0.6: Fix Radar Backfill Duplication
**Bug:** `backfillRadarSignals` can create duplicate Radar entries for news articles that already have signals.
**Root Cause:** The newsId check uses a Set but doesn't also check for content similarity.

**File:** `backend/src/crons/aiWorkflow.cron.ts`

```diff
 // Line 184 — Also link the newly created signal to the news ID
 if (actionableVerdicts.includes(analysisResult.verdict)) {
     await db.insert(radarSignals).values({
         coinSymbol: symbol,
         signalText: analysisResult.signalText,
         sentiment: analysisResult.sentiment,
         impactScore: analysisResult.impactScore,
+        newsId: (await db.select({ id: coinNews.id })
+            .from(coinNews)
+            .where(eq(coinNews.sourceHash, sourceHash))
+            .limit(1)
+        )[0]?.id ?? null,
     }).onConflictDoNothing();
 }
```

**Status:** `[ ]`

---

# Phase 1: AI Cost Optimization & Infrastructure
**Priority:** 🟠 HIGH — Directly saves money
**Duration:** 1 week
**Goal:** Cut AI costs by ~35% without changing any user-visible behavior

---

## Task 1.1: Dual Gateway — DeepSeek Direct API
**What:** Create a second AIGateway instance for DeepSeek direct API (bypassing OpenRouter markup).
**Files:** `backend/src/config/env.ts` + `backend/src/services/openai.service.ts`

### 1.1.1 — Add DeepSeek Direct env vars
**File:** `backend/src/config/env.ts`

```diff
 // After line 28 (DEEPSEEK_MODEL)
+    // DeepSeek Direct API (cheaper than OpenRouter for reasoning tasks)
+    DEEPSEEK_API_KEY: z.string().optional(),
+    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
+    DEEPSEEK_DIRECT_MODEL: z.string().default('deepseek-reasoner'),
```

### 1.1.2 — Add to .env file
**File:** `backend/.env`

```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_DIRECT_MODEL=deepseek-reasoner
```

### 1.1.3 — Create dual gateways
**File:** `backend/src/services/openai.service.ts`

```diff
 // Replace the single gateway (lines 106-114) with dual gateways
-const gateway = new AIGateway({
-    apiKey: env.OPENROUTER_API_KEY,
-    baseURL: 'https://openrouter.ai/api/v1',
-    timeoutMs: 90000,
-    defaultHeaders: {
-        'HTTP-Referer': 'https://onlyalpha.app',
-        'X-Title': 'OnlyAlpha',
-    }
-});
+// OpenRouter — for GPT-5-nano (writing, chat, SEO)
+const openRouterGateway = new AIGateway({
+    apiKey: env.OPENROUTER_API_KEY,
+    baseURL: 'https://openrouter.ai/api/v1',
+    timeoutMs: 90000,
+    defaultHeaders: {
+        'HTTP-Referer': 'https://onlyalpha.app',
+        'X-Title': 'OnlyAlpha',
+    }
+});
+
+// DeepSeek Direct — for analysis, triage, audit (cheaper, no OpenRouter markup)
+const deepseekGateway = env.DEEPSEEK_API_KEY
+    ? new AIGateway({
+        apiKey: env.DEEPSEEK_API_KEY,
+        baseURL: env.DEEPSEEK_BASE_URL,
+        timeoutMs: 120000,
+        defaultHeaders: {},
+    })
+    : openRouterGateway; // Fallback to OpenRouter if no direct key
+
+// Legacy alias — keep existing code working during migration
+const gateway = openRouterGateway;
```

### 1.1.4 — Route analysis calls through DeepSeek Direct
**File:** `backend/src/services/openai.service.ts`

```diff
 // callDeepSeekAnalysis (line ~417)
 const result = await gateway.chat<DeepAnalysisResult>({
-    model: env.DEEPSEEK_MODEL,
+    model: env.DEEPSEEK_API_KEY ? env.DEEPSEEK_DIRECT_MODEL : env.DEEPSEEK_MODEL,
```

Apply the same pattern to:
- `callDeepSeekAnalysis` (line 417)
- `auditArticleQuality` in `quality-auditor.ts` (line 49) — pass `deepseekGateway` instead of `gateway`
- `generateLightweightTriage` (Task 1.2 below)

### 1.1.5 — Update quality-auditor to accept gateway parameter
**File:** `backend/src/services/ai/quality-auditor.ts`

```diff
-const AUDITOR_MODEL = process.env.ANALYSIS_MODEL ?? 'deepseek/deepseek-r1';
+import { env } from '../../config/env';
+const AUDITOR_MODEL = env.DEEPSEEK_API_KEY ? env.DEEPSEEK_DIRECT_MODEL : env.DEEPSEEK_MODEL;
```

**Status:** `[ ]`

---

## Task 1.2: Move Triage to DeepSeek
**What:** Triage is classification, not writing. DeepSeek-R1 is better and vastly cheaper for this.
**File:** `backend/src/services/openai.service.ts`

```diff
 // generateLightweightTriage (line ~234)
-    model: env.SEO_MODEL, // GPT-5-nano equivalent (cheap/fast model)
+    model: env.DEEPSEEK_API_KEY ? env.DEEPSEEK_DIRECT_MODEL : env.DEEPSEEK_MODEL,
```

And use the correct gateway:
```diff
-        const parsed = await gateway.chat<{
+        const parsed = await deepseekGateway.chat<{
```

**Status:** `[ ]`

---

## Task 1.3: Move Historical News Fetch to Daily Cron
**What:** `fetchHistoricalNewsForCoins()` currently runs every hour inside `aiWorkflow`. Historical news doesn't change hourly.

### 1.3.1 — Remove from aiWorkflow
**File:** `backend/src/crons/aiWorkflow.cron.ts`

```diff
 // Line 89 — Remove the per-run historical fetch
-await fetchHistoricalNewsForCoins([symbol]);
 const pattern = await buildTemporalPattern(symbol, eventType, eventSeverity);
```

### 1.3.2 — Create daily historical fetch cron
**File:** `backend/src/crons/historicalNews.cron.ts` (NEW FILE)

```typescript
import cron from 'node-cron';
import { db } from '../config/db';
import { coinNews } from '../models/market.model';
import { sql } from 'drizzle-orm';
import { fetchHistoricalNewsForCoins, backfillPriceOutcomes } from '../services/temporalIntelligence.service';

export async function runHistoricalNewsFetch(): Promise<void> {
    console.log('📚 [HistoricalNews] Running daily historical news fetch...');

    try {
        // Get unique coins from last 7 days of published articles
        const recentCoins = await db
            .selectDistinct({ coinSymbol: coinNews.coinSymbol })
            .from(coinNews)
            .where(sql`${coinNews.publishedAt} > NOW() - INTERVAL '7 days'`);

        const symbols = recentCoins
            .map(r => r.coinSymbol)
            .filter((s): s is string => !!s);

        if (symbols.length === 0) {
            console.log('[HistoricalNews] No recent coins to fetch history for.');
            return;
        }

        console.log(`[HistoricalNews] Fetching history for ${symbols.length} coins: ${symbols.join(', ')}`);
        await fetchHistoricalNewsForCoins(symbols);

        // Also backfill price outcomes for old events
        await backfillPriceOutcomes();

        console.log('✅ [HistoricalNews] Daily fetch completed.');
    } catch (error) {
        console.error('❌ [HistoricalNews] Failed:', error);
    }
}

export function startHistoricalNewsCron(): void {
    // Run daily at 04:00 UTC (before the 06:00 UTC daily alpha cron)
    cron.schedule('0 4 * * *', runHistoricalNewsFetch, { timezone: 'UTC' });
    console.log('⏰ Historical News cron scheduled — 04:00 UTC daily');
}
```

### 1.3.3 — Register in server.ts
**File:** `backend/src/server.ts`

```diff
+import { startHistoricalNewsCron } from './crons/historicalNews.cron';

 const crons = [
     { name: 'AiWorkflow', fn: startAiWorkflowCron },
+    { name: 'HistoricalNews', fn: startHistoricalNewsCron },
     { name: 'DailyAlpha', fn: startDailyAlphaCron },
```

**Status:** `[ ]`

---

## Task 1.4: Conditional Audit (MAJOR only)
**What:** Only run DeepSeek audit on high-impact articles.
**File:** `backend/src/crons/aiWorkflow.cron.ts`

```diff
 // Lines 155-164 — Add condition before audit
-const audit = await auditArticleQuality(gateway, JSON.stringify(analysisResult), article);
+// Only audit high-impact articles to save costs
+let audit = { passed: true, score: 0, issues: [] as string[], suggestion: null as string | null };
+if (analysisResult.impactScore >= 75 || analysisResult.isBreaking) {
+    audit = await auditArticleQuality(deepseekGateway, JSON.stringify(analysisResult), article);
+} else {
+    console.log(`[AI Workflow] Skipping audit for ${symbol} (impact: ${analysisResult.impactScore} < 75)`);
+}
```

**Status:** `[ ]`

---

## Task 1.5: Feed coinMemory After Every Published Article
**What:** The `coinMemory` table is empty — the chat system has no historical context.
**File:** `backend/src/crons/aiWorkflow.cron.ts`

```diff
+import { saveMemory } from '../services/coin-memory.service';

 // After line 198 (after successful publish log) — Save to coinMemory
 console.log(`[AI Workflow] Published: ${symbol} — "${article.headline.slice(0, 50)}..."`);

+// Save to coinMemory for chat context and temporal intelligence
+try {
+    await saveMemory({
+        coinSymbol: symbol,
+        eventType,
+        eventSummary: `${article.headline}. ${analysisResult.analysis.mainDriver}`,
+        priceAtEvent: price?.price ?? undefined,
+        verdict: analysisResult.verdict,
+        confidenceScore: analysisResult.confidenceScore,
+        riskVerdict: analysisResult.analysis.riskNote ? 'MEDIUM' : 'LOW',
+        keyDrivers: analysisResult.keyFacts,
+        redFlags: analysisResult.analysis.riskNote ? [analysisResult.analysis.riskNote] : [],
+        sourceNewsHashes: [sourceHash],
+    });
+    console.log(`[AI Workflow] Memory saved for ${symbol}`);
+} catch (memErr) {
+    console.error(`[AI Workflow] Failed to save memory for ${symbol}:`, memErr);
+}
```

**Status:** `[ ]`

---

# Phase 2: Living Article System
**Priority:** 🟠 HIGH — Core product improvement
**Duration:** 2-3 weeks
**Goal:** One evolving article per coin instead of duplicate full articles

---

## Task 2.1: New Database Schema

### 2.1.1 — Add `coin_master_articles` table
**File:** `backend/src/models/market.model.ts` (ADD at bottom)

```typescript
// ─── MASTER ARTICLES (Living Article per Coin) ───────────────────────────────
export const coinMasterArticles = pgTable('coin_master_articles', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull().unique(),

    // Modular sections (not one big summary field)
    coreCatalyst: text('core_catalyst'),              // [HOOK] expanded
    marketContext: text('market_context'),             // [WHAT HAPPENED]
    strategicImpact: text('strategic_impact'),         // [WHY IT MATTERS]
    historicalContext: text('historical_context'),      // [HISTORY REPEATS?]
    technicalLevels: text('technical_levels'),         // [PRICE PICTURE] — support/resistance
    riskAssessment: text('risk_assessment'),            // [RISK CHECK]
    bottomLine: text('bottom_line'),                   // [BOTTOM LINE] verdict

    // Meta
    headline: text('headline').notNull(),
    hook: text('hook'),
    metaTitle: varchar('meta_title', { length: 80 }),
    metaDescription: varchar('meta_description', { length: 200 }),
    seoKeywords: json('seo_keywords'),

    // Analytical fields
    sentiment: varchar('sentiment', { length: 20 }),
    verdict: varchar('verdict', { length: 20 }),
    confidenceScore: real('confidence_score'),
    convictionScore: real('conviction_score'),         // Algorithmic, not AI
    posture: varchar('posture', { length: 30 }),       // 'accumulation', 'distribution', 'neutral'

    // Risk tags (array of active tags)
    riskTags: json('risk_tags'),                       // ['High Volatility', 'Whale Active']
    triggerType: varchar('trigger_type', { length: 20 }), // 'whale', 'regulation', 'technical'

    // Tracking
    majorUpdateCount: integer('major_update_count').default(0),
    minorUpdateCount: integer('minor_update_count').default(0),
    lastMajorUpdate: timestamp('last_major_update'),
    lastMinorUpdate: timestamp('last_minor_update'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2.1.2 — Add `coin_timeline_updates` table
**File:** `backend/src/models/market.model.ts` (ADD after master articles)

```typescript
// ─── TIMELINE UPDATES (Minor events under Master Article) ────────────────────
export const coinTimelineUpdates = pgTable('coin_timeline_updates', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    masterArticleId: integer('master_article_id')
        .references(() => coinMasterArticles.id)
        .notNull(),

    // Content
    updateText: text('update_text').notNull(),         // 1-2 paragraph update
    triggerType: varchar('trigger_type', { length: 20 }), // 'whale', 'regulation', 'technical', 'news'
    severity: varchar('severity', { length: 10 }).notNull(), // 'MAJOR', 'MINOR'

    // Source tracking
    sourceTitle: text('source_title'),                 // The news headline that caused this
    sourceHash: varchar('source_hash', { length: 64 }),

    // Impact
    sentiment: varchar('sentiment', { length: 20 }),
    impactScore: real('impact_score'),
    convictionDelta: real('conviction_delta'),         // How much this changed conviction

    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 2.1.3 — Export new models
**File:** `backend/src/models/index.ts`

```diff
-export { marketInsights, coinNews, rawNewsBuffer, radarSignals, dailyAlphaFocus, dailyMarketMood, priceSnapshots, coinMemory, coinIntelligenceCache, coinNewsHistory } from './market.model';
+export { marketInsights, coinNews, rawNewsBuffer, radarSignals, dailyAlphaFocus, dailyMarketMood, priceSnapshots, coinMemory, coinIntelligenceCache, coinNewsHistory, coinMasterArticles, coinTimelineUpdates } from './market.model';
```

### 2.1.4 — Run Drizzle migration

> [!CAUTION]
> **NEVER use `drizzle-kit push` on a production database with user data!**
> `push` can drop columns/tables to match the schema. Always use `generate` → review SQL → `migrate`.

**Development:**
```bash
npx drizzle-kit generate
npx drizzle-kit push   # ← OK in dev only
```

**Production:**
```bash
npx drizzle-kit generate              # Creates SQL migration file
# Review the generated SQL in drizzle/ folder!
npx drizzle-kit migrate               # Applies reviewed migration safely
```

**Status:** `[ ]`

---

## Task 2.2: Upgrade Triage — MAJOR/MINOR/NOISE Classification

### 2.2.1 — Update Triage Prompt
**File:** `backend/src/services/ai/prompt-factory.ts`

Update `buildTriageMessages` to add classification output:

```diff
 // Inside the system prompt of buildTriageMessages (line ~143)
 Per item:
 {
   "relevanceScore": <0-100>,
   "sentimentHint": "bullish|bearish|neutral",
   "symbolMentions": ["BTC", "ETH"],
   "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
-  "eventSeverity": <1|2|3>
+  "eventSeverity": <1|2|3>,
+  "classification": "MAJOR|MINOR|NOISE",
+  "triggerType": "whale|regulation|technical|market|news|other"
 }
+
+Classification rules:
+MAJOR: ETF approvals, major hacks/exploits, SEC actions, top-10 exchange listings, mainnet launches,
+        $100M+ funding, protocol breaking changes. Requires full article update.
+MINOR: Price milestones, whale moves, partnerships, upgrades, small-to-medium funding.
+        Gets a timeline update only.
+NOISE: Rehashed/duplicate news, promotional, opinion pieces, old news rewritten.
+        Gets discarded entirely.
```

### 2.2.2 — Update TriageResult interface
**File:** `backend/src/services/openai.service.ts`

```diff
 interface TriageResult {
     title: string;
     source?: string;
     relevanceScore: number;
     sentimentHint: string | null;
     symbolMentions: string[];
     eventType: string;
     eventSeverity: number;
+    classification: 'MAJOR' | 'MINOR' | 'NOISE';
+    triggerType: string;
 }
```

### 2.2.3 — Save classification to rawNewsBuffer
**File:** `backend/src/models/market.model.ts`

```diff
 export const rawNewsBuffer = pgTable('raw_news_buffer', {
     // ... existing fields ...
     eventType: varchar('event_type', { length: 50 }),
     eventSeverity: integer('event_severity'),
+    classification: varchar('classification', { length: 10 }),  // MAJOR, MINOR, NOISE
+    triggerType: varchar('trigger_type', { length: 20 }),
 });
```

### 2.2.4 — Update triageEngine to save new fields
**File:** `backend/src/crons/triageEngine.cron.ts`

```diff
 .set({
     relevanceScore: scoredItem.relevanceScore,
     sentimentHint: scoredItem.sentimentHint,
     symbolMentions: scoredItem.symbolMentions,
     eventType: scoredItem.eventType,
     eventSeverity: scoredItem.eventSeverity,
+    classification: scoredItem.classification || 'MINOR',
+    triggerType: scoredItem.triggerType || 'other',
     processed: true
 })
```

**Status:** `[ ]`

---

## Task 2.3: Refactor aiWorkflow for Living Articles

### Rewrite `runAiWorkflow` to follow MAJOR/MINOR/NOISE paths

**File:** `backend/src/crons/aiWorkflow.cron.ts` — Major rewrite

The core logic becomes:

```typescript
// Pseudo-code — full implementation details:

for (const item of items) {
    const symbol = mentions[0];
    const classification = item.classification || 'MINOR';

    // 1. Skip NOISE
    if (classification === 'NOISE') {
        console.log(`[AI Workflow] NOISE — skipping ${symbol}: "${item.title.slice(0, 50)}"`);
        continue;
    }

    // 2. Check if master article exists
    const [existingMaster] = await db.select()
        .from(coinMasterArticles)
        .where(eq(coinMasterArticles.coinSymbol, symbol))
        .limit(1);

    if (classification === 'MINOR' && existingMaster) {
        // === MINOR PATH ===
        // 1 AI call only: GPT-nano writes a timeline update paragraph
        // No DeepSeek analysis, no audit
        const updateText = await callGptNanoMinorUpdate(item.title, existingMaster.headline);
        await db.insert(coinTimelineUpdates).values({
            coinSymbol: symbol,
            masterArticleId: existingMaster.id,
            updateText,
            triggerType: item.triggerType || 'news',
            severity: 'MINOR',
            sourceTitle: item.title,
            sourceHash: hashTitle(item.title),
            sentiment: item.sentimentHint,
            impactScore: item.relevanceScore,
        });
        // Update minor count
        await db.update(coinMasterArticles)
            .set({
                minorUpdateCount: sql`${coinMasterArticles.minorUpdateCount} + 1`,
                lastMinorUpdate: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(coinMasterArticles.id, existingMaster.id));

    } else {
        // === MAJOR PATH (or first article for this coin) ===
        // Full pipeline: DeepSeek analysis → GPT-nano writer → optional audit

        // Step A: DeepSeek Analysis (same as current)
        const analysisResult = await callDeepSeekAnalysis({ ... });

        // Step B: Factual grounding (same as current)
        // ...

        // Step C: GPT-nano writes/updates master article
        if (existingMaster) {
            // UPDATE existing sections that changed
            const updatedSections = await callGptNanoMasterUpdate(
                analysisResult, existingMaster
            );
            await db.update(coinMasterArticles)
                .set({
                    ...updatedSections,
                    majorUpdateCount: sql`${coinMasterArticles.majorUpdateCount} + 1`,
                    lastMajorUpdate: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(coinMasterArticles.id, existingMaster.id));
        } else {
            // CREATE new master article
            const article = await callGptNanoWriter(JSON.stringify(analysisResult), tone);
            await db.insert(coinMasterArticles).values({
                coinSymbol: symbol,
                headline: article.headline,
                hook: article.hook,
                coreCatalyst: extractSection(article.fullArticle, 'HOOK'),
                marketContext: extractSection(article.fullArticle, 'WHAT HAPPENED'),
                strategicImpact: extractSection(article.fullArticle, 'WHY IT MATTERS'),
                historicalContext: extractSection(article.fullArticle, 'HISTORY REPEATS'),
                technicalLevels: extractSection(article.fullArticle, 'PRICE PICTURE'),
                riskAssessment: extractSection(article.fullArticle, 'RISK CHECK'),
                bottomLine: extractSection(article.fullArticle, 'BOTTOM LINE'),
                // ... meta fields ...
            });
        }

        // Step D: Also add MAJOR update to timeline
        await db.insert(coinTimelineUpdates).values({
            coinSymbol: symbol,
            masterArticleId: existingMaster?.id || newId,
            updateText: `MAJOR: ${analysisResult.analysis.mainDriver}`,
            triggerType: item.triggerType || eventType,
            severity: 'MAJOR',
            sourceTitle: item.title,
            sentiment: analysisResult.sentiment,
            impactScore: analysisResult.impactScore,
        });

        // Step E: Audit (MAJOR only, impact >= 75)
        if (analysisResult.impactScore >= 75 || analysisResult.isBreaking) {
            await auditArticleQuality(deepseekGateway, ...);
        }

        // Step F: Save to coinMemory
        await saveMemory({ ... });
    }

    // Still write to coin_news for backward compatibility during migration
    await db.insert(coinNews).values({ ... }).onConflictDoNothing();
}
```

### Helper functions needed:

```typescript
// New function: Minor update writer (1 AI call, nano only)
export async function callGptNanoMinorUpdate(
    newsTitle: string,
    existingHeadline: string
): Promise<string> {
    // Single call to GPT-5-nano to write 1-2 paragraph timeline update
    // Much cheaper than full article generation
}

// New function: Master article section updater
export async function callGptNanoMasterUpdate(
    analysisResult: DeepAnalysisResult,
    existingArticle: typeof coinMasterArticles.$inferSelect
): Promise<Partial<typeof coinMasterArticles.$inferInsert>> {
    // Tells nano which sections to update based on analysis diff
    // Returns only the changed sections
}

// Helper: Extract section from article text
function extractSection(fullArticle: string, sectionTag: string): string | null {
    const regex = new RegExp(`\\[${sectionTag}\\??\\]\\s*([\\s\\S]*?)(?=\\[|$)`, 'i');
    const match = fullArticle.match(regex);
    return match?.[1]?.trim() || null;
}
```

**Status:** `[ ]`

---

## Task 2.4: Algorithmic Conviction Score
**What:** Calculate conviction locally without AI calls.
**File:** `backend/src/services/conviction.service.ts` (NEW FILE)

```typescript
import { db } from '../config/db';
import { coinTimelineUpdates, coinMasterArticles, coinMemory } from '../models/market.model';
import { eq, gte, desc, and, sql } from 'drizzle-orm';

interface ConvictionInput {
    coinSymbol: string;
}

interface ConvictionResult {
    score: number;         // 0-100
    posture: string;       // 'strong_accumulate' | 'accumulate' | 'neutral' | 'distribute' | 'strong_distribute'
    trend: 'improving' | 'stable' | 'declining';
}

export async function calculateConviction({ coinSymbol }: ConvictionInput): Promise<ConvictionResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch recent timeline updates
    const updates = await db.select()
        .from(coinTimelineUpdates)
        .where(and(
            eq(coinTimelineUpdates.coinSymbol, coinSymbol),
            gte(coinTimelineUpdates.createdAt, thirtyDaysAgo)
        ))
        .orderBy(desc(coinTimelineUpdates.createdAt));

    // Count by type
    let score = 50; // base neutral

    for (const update of updates) {
        const weight = update.severity === 'MAJOR' ? 3 : 1;
        const sentiment = update.sentiment?.toLowerCase();

        if (sentiment === 'bullish' || sentiment === 'strong_bullish') {
            score += 5 * weight;
        } else if (sentiment === 'bearish' || sentiment === 'strong_bearish') {
            score -= 7 * weight; // bearish weighted harder (risk management)
        }
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));

    // Determine posture
    let posture: string;
    if (score >= 80) posture = 'strong_accumulate';
    else if (score >= 60) posture = 'accumulate';
    else if (score >= 40) posture = 'neutral';
    else if (score >= 20) posture = 'distribute';
    else posture = 'strong_distribute';

    // Trend: compare first half vs second half of updates
    const mid = Math.floor(updates.length / 2);
    const recentAvg = updates.slice(0, mid).reduce((s, u) => s + (u.impactScore || 0), 0) / (mid || 1);
    const olderAvg = updates.slice(mid).reduce((s, u) => s + (u.impactScore || 0), 0) / ((updates.length - mid) || 1);
    const trend = recentAvg > olderAvg + 5 ? 'improving' : recentAvg < olderAvg - 5 ? 'declining' : 'stable';

    return { score, posture, trend };
}
```

**Status:** `[ ]`

---

## Task 2.5: ConvictionUpdate Cron
**What:** The `conviction.service.ts` from Task 2.4 has no caller. This cron recalculates conviction for all active coins every 6 hours.
**File:** `backend/src/crons/convictionUpdate.cron.ts` (NEW FILE)

```typescript
import cron from 'node-cron';
import { db } from '../config/db';
import { coinMasterArticles } from '../models/market.model';
import { calculateConviction } from '../services/conviction.service';
import { eq } from 'drizzle-orm';

export async function runConvictionUpdate(): Promise<void> {
    console.log('📊 [ConvictionUpdate] Recalculating conviction scores...');

    try {
        const articles = await db.select({
            id: coinMasterArticles.id,
            coinSymbol: coinMasterArticles.coinSymbol,
        }).from(coinMasterArticles);

        if (articles.length === 0) {
            console.log('[ConvictionUpdate] No master articles yet. Skipping.');
            return;
        }

        let updated = 0;
        for (const article of articles) {
            try {
                const result = await calculateConviction({ coinSymbol: article.coinSymbol });
                await db.update(coinMasterArticles)
                    .set({
                        convictionScore: result.score,
                        posture: result.posture,
                    })
                    .where(eq(coinMasterArticles.id, article.id));
                updated++;
            } catch (err) {
                console.error(`[ConvictionUpdate] Failed for ${article.coinSymbol}:`, err);
            }
        }

        console.log(`✅ [ConvictionUpdate] Updated ${updated}/${articles.length} coins.`);
    } catch (error) {
        console.error('❌ [ConvictionUpdate] Failed:', error);
    }
}

export function startConvictionUpdateCron(): void {
    cron.schedule('0 */6 * * *', runConvictionUpdate);
    console.log('⏰ ConvictionUpdate cron scheduled — every 6 hours');
}
```

### Register in server.ts
**File:** `backend/src/server.ts`

```diff
+import { startConvictionUpdateCron } from './crons/convictionUpdate.cron';

 const crons = [
     // ... existing crons ...
+    { name: 'ConvictionUpdate', fn: startConvictionUpdateCron },
 ];
```

**Status:** `[ ]`

---

# Phase 3: Temporal Intelligence Layer
**Priority:** 🟡 MEDIUM
**Duration:** 1 week
**Goal:** Make the AI understand market history and filter noise intelligently

---

## Task 3.1: Local Similarity Check (No AI Cost)
**What:** Before sending any news to AI, check if something very similar was already processed.
**File:** `backend/src/services/similarity.service.ts` (NEW FILE)

```typescript
import { db } from '../config/db';
import { coinNews, coinTimelineUpdates } from '../models/market.model';
import { desc, gte, sql } from 'drizzle-orm';

/**
 * Keyword-based similarity check — no AI required.
 * Returns true if a similar headline was processed in the last 24 hours.
 */
export async function isDuplicateByKeywords(headline: string): Promise<boolean> {
    const keywords = extractKeywords(headline);
    if (keywords.length < 2) return false;

    const recentHeadlines = await db.select({ headline: coinNews.headline })
        .from(coinNews)
        .where(gte(coinNews.publishedAt, sql`NOW() - INTERVAL '24 hours'`))
        .orderBy(desc(coinNews.publishedAt))
        .limit(50);

    for (const existing of recentHeadlines) {
        const existingKeywords = extractKeywords(existing.headline);
        const overlap = keywords.filter(k => existingKeywords.includes(k));
        const similarity = overlap.length / Math.max(keywords.length, existingKeywords.length);

        if (similarity >= 0.6) {
            return true; // 60%+ keyword overlap = duplicate
        }
    }

    return false;
}

function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'about',
        'after', 'before', 'between', 'and', 'but', 'or', 'not', 'no', 'so',
        'if', 'then', 'than', 'too', 'very', 'just', 'that', 'this', 'its',
        'it', 'he', 'she', 'they', 'we', 'you', 'i', 'my', 'your', 'his',
        'her', 'their', 'our', 'new', 'says', 'said', 'report', 'reports',
        'crypto', 'cryptocurrency', 'market', 'price', 'token', 'coin',
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}
```

### Integration into aiWorkflow:
**File:** `backend/src/crons/aiWorkflow.cron.ts`

```diff
+import { isDuplicateByKeywords } from '../services/similarity.service';

 for (const item of items) {
+    // Pre-AI similarity check (free, no API calls)
+    const isDup = await isDuplicateByKeywords(item.title);
+    if (isDup) {
+        console.log(`[AI Workflow] Keyword-similar to recent article — skipping: "${item.title.slice(0, 50)}"`);
+        continue;
+    }
```

**Status:** `[ ]`

---

## Task 3.2: Fix buildTemporalPattern — Fuzzy Matching
**What:** Current implementation requires exact match on eventType + severity → returns null 99% of time.

**File:** `backend/src/services/temporalIntelligence.service.ts`

```diff
 // buildTemporalPattern (line 63-74)
 const rows = await db.select()
     .from(coinNewsHistory)
     .where(and(
         eq(coinNewsHistory.coinSymbol, symbol),
-        eq(coinNewsHistory.eventType, eventType),
-        eq(coinNewsHistory.eventSeverity, severity),
         isNotNull(coinNewsHistory.price7dAfter),
         gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '365 days'`)
     ))
     .orderBy(desc(coinNewsHistory.publishedAt))
-    .limit(5);
+    .limit(20);
+
+// Post-query fuzzy filter: prefer same eventType, but accept any
+const exactMatch = rows.filter(r => r.eventType === eventType);
+const filtered = exactMatch.length >= 3 ? exactMatch.slice(0, 5) : rows.slice(0, 5);
+
+if (filtered.length === 0) return null;
```

Then use `filtered` instead of `rows` for the rest of the function.

**Status:** `[ ]`

---

# Phase 4: Chat System Rebuild
**Priority:** 🟡 MEDIUM
**Duration:** 1 week
**Goal:** Working General + Context AI with proper data and rate limits

---

## Task 4.1: Context AI Prompt — Fed by Master Article + Timeline

**File:** `backend/src/controllers/chat.controller.ts`

Rewrite the Context mode branch (lines 36-84) to use the new tables:

```typescript
if ((resolvedMode === 'private' || resolvedMode === 'context') && articleId && articleType) {
    // --- NEW: Fetch from Master Article ---
    const [masterArticle] = await db.select()
        .from(coinMasterArticles)
        .where(eq(coinMasterArticles.coinSymbol, symbol))
        .limit(1);

    if (masterArticle) {
        contextText = `[MASTER ARTICLE - ${symbol}]
Headline: ${masterArticle.headline}
Conviction Score: ${masterArticle.convictionScore || 'N/A'}/100
Posture: ${masterArticle.posture || 'N/A'}
Risk Tags: ${JSON.stringify(masterArticle.riskTags || [])}

Core Catalyst: ${masterArticle.coreCatalyst || 'N/A'}
Market Context: ${masterArticle.marketContext || 'N/A'}
Technical Levels: ${masterArticle.technicalLevels || 'N/A'}
Risk Assessment: ${masterArticle.riskAssessment || 'N/A'}
Bottom Line: ${masterArticle.bottomLine || 'N/A'}
`;
    }

    // Also fetch the selected article/radar for direct context
    // ... (keep existing specific article fetch logic) ...

    // Fetch recent timeline
    const timeline = await db.select()
        .from(coinTimelineUpdates)
        .where(eq(coinTimelineUpdates.coinSymbol, symbol))
        .orderBy(desc(coinTimelineUpdates.createdAt))
        .limit(5);

    if (timeline.length > 0) {
        const tlStr = timeline.map(t =>
            `[${t.severity}|${t.triggerType}] ${t.updateText.slice(0, 100)}`
        ).join('\n');
        contextText += `\n[RECENT TIMELINE]:\n${tlStr}`;
    }

    // Memory (now actually populated by Phase 1 Task 1.5)
    const memory = await db.select(...)
        .from(coinMemory)
        .where(eq(coinMemory.coinSymbol, symbol))
        .orderBy(desc(coinMemory.createdAt))
        .limit(5);

    // ... rest stays similar ...
}
```

**Status:** `[ ]`

---

## Task 4.2: Redis-Based Chat Quotas

**File:** `backend/src/middleware/chat-quota.middleware.ts` (NEW FILE)

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface QuotaConfig {
    guest: { daily: number };
    free: { daily: number; contextDaily: number };
    pro: { daily: number; contextDaily: number };
}

const QUOTAS: QuotaConfig = {
    guest: { daily: 5 },
    free: { daily: 15, contextDaily: 0 },     // No context for free
    pro: { daily: 999, contextDaily: 30 },
};

export async function chatQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (!redis) { next(); return; }

    const isContext = req.originalUrl?.includes('/context') || req.body?.mode === 'context';
    const plan = req.userPlan || 'free';
    const isGuest = !req.userId;

    try {
        if (isGuest) {
            const ip = req.ip || 'unknown';
            const key = `quota:guest:${ip}`;
            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, 86400);
            if (count > QUOTAS.guest.daily) {
                res.status(429).json({
                    error: 'Daily limit reached. Sign in for more.',
                    limit: QUOTAS.guest.daily,
                    loginUrl: '/auth',
                });
                return;
            }
        } else {
            const quotaKey = isContext
                ? `quota:context:${req.userId}`
                : `quota:chat:${req.userId}`;

            const limit = isContext
                ? (QUOTAS[plan as keyof QuotaConfig] as any)?.contextDaily || 0
                : (QUOTAS[plan as keyof QuotaConfig] as any)?.daily || 15;

            if (limit === 0 && isContext) {
                res.status(403).json({
                    error: 'Context AI is a Pro feature. Upgrade to access.',
                    upgradeUrl: '/settings#upgrade',
                });
                return;
            }

            const count = await redis.incr(quotaKey);
            if (count === 1) await redis.expire(quotaKey, 86400);
            if (count > limit) {
                res.status(429).json({
                    error: `Daily ${isContext ? 'Context AI' : 'chat'} limit reached (${limit}/day).`,
                    limit,
                    remaining: 0,
                });
                return;
            }

            res.setHeader('X-Chat-Remaining', Math.max(0, limit - count));
        }

        next();
    } catch (err) {
        logger.error('[ChatQuota] Error:', err);
        next(); // Don't block on quota errors
    }
}
```

### Integration:
**File:** `backend/src/routes/chat.routes.ts`

```diff
+import { chatQuota } from '../middleware/chat-quota.middleware';

-router.post('/stream', optionalAuth, guestLimit, chatLimiter, chatStream);
-router.post('/stream/context', authMiddleware, chatLimiter, chatStream);
+router.post('/stream', optionalAuth, chatQuota, chatLimiter, chatStream);
+router.post('/stream/context', authMiddleware, chatQuota, chatLimiter, chatStream);
```

**Status:** `[ ]`

---

# Phase 5: Frontend Refactor & Institutional Branding
**Priority:** 🟡 MEDIUM
**Duration:** 1 week
**Goal:** Premium, institutional-grade UI

---

## Task 5.1: Parse Article Sections in AlphaStream
**What:** Display the 800-word article as structured accordion sections.
**File:** `frontend/src/features/terminal/components/AlphaStream.tsx`

Replace the raw `displayBody` with parsed sections:
```typescript
function parseArticleSections(summary: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionNames = [
        'HOOK', 'WHAT HAPPENED', 'WHY IT MATTERS',
        'HISTORY REPEATS', 'PRICE PICTURE', 'RISK CHECK', 'BOTTOM LINE'
    ];

    for (let i = 0; i < sectionNames.length; i++) {
        const current = `[${sectionNames[i]}`;
        const nextPatterns = sectionNames.slice(i + 1).map(s => `[${s}`);

        const startIdx = summary.indexOf(current);
        if (startIdx === -1) continue;

        const contentStart = summary.indexOf(']', startIdx) + 1;
        let endIdx = summary.length;
        for (const pattern of nextPatterns) {
            const idx = summary.indexOf(pattern, contentStart);
            if (idx !== -1) { endIdx = idx; break; }
        }

        sections[sectionNames[i]] = summary.slice(contentStart, endIdx).trim();
    }

    return sections;
}
```

Render with accordion:
```tsx
{Object.entries(sections).map(([name, content]) => (
    <details key={name} open={name === 'HOOK' || name === 'BOTTOM LINE'}>
        <summary className="cursor-pointer text-sm font-mono tracking-widest text-[#888] uppercase py-2 hover:text-white">
            {SECTION_LABELS[name] || name}
        </summary>
        <p className="text-[#CCC] leading-relaxed text-[15px] pl-4 pb-4">{content}</p>
    </details>
))}
```

**Status:** `[ ]`

---

## Task 5.2: Institutional Branding Rename
**Files:** Multiple frontend components

| Current Term | New Term | Files to Change |
|-------------|----------|-----------------|
| `AI Radar Stream` | `Alpha Detection Stream` | `TerminalWire.tsx:45,59` |
| `AI Radar Detection Event` | `Verified Alpha Catalyst` | `AlphaStream.tsx:76` |
| `DeepSeek Analysis` | `Neural Consensus Verdict` | `AlphaStream.tsx:134` |
| `GENERAL AI` | `Macro Intelligence` | `TerminalChat.tsx:37` |
| `CONTEXT AI` | `Asset Context` | `TerminalChat.tsx:48` |
| `Network Secure` | `Data Integrity: Verified` | `AlphaStream.tsx:166` |
| `Alpha-Turbo-4` | `Alpha-Macro` | `TerminalChat.tsx:117` |
| `Alpha-Context-5` | `Alpha-Context` | `TerminalChat.tsx:117` |

**Status:** `[ ]`

---

## Task 5.3: Living Article View + Timeline
New component: `frontend/src/features/terminal/components/LivingArticle.tsx`

Shows:
1. **Alpha Snapshot** header (Conviction Score, Posture, Risk Tags)
2. **Master Article** sections as accordion
3. **Contextual Timeline** feed below

**Status:** `[ ]`

---

## Task 5.4: Alpha Snapshot Widget
New component for the coin header:

```
┌─────────────────────────────────────────────────┐
│  ₿ BITCOIN                          🟢 Accumulate│
│  Conviction Score        ████████░░  85/100      │
│  [⚠️ High Volatility]  [🐋 Whale Active]         │
└─────────────────────────────────────────────────┘
```

**Status:** `[ ]`

---

## Task 5.5: Fix Terminal Selection & Pagination Bugs
**Source:** `Issues_And_Improvements_Log.md` — Terminal Page section

### 5.5.1 — Fix Non-Unique Selection Highlighting
**Bug:** If multiple radar items share the same ID (pagination boundary or data bug), all light up as "Active".
**File:** `frontend/src/features/terminal/components/TerminalWire.tsx`

```diff
 // Line 71 — Add index-based uniqueness fallback
-const isSelectedRadar = activeTab === 'RADAR' && selectedRadarId === item.id;
+const isSelectedRadar = activeTab === 'RADAR' && selectedRadarId === item.id && selectedRadarId !== null;
```

### 5.5.2 — Fix Pagination Duplicates
**Bug:** "Show More" appends data without ID deduplication.
**File:** `frontend/src/features/terminal/components/TerminalPageClient.tsx`

```diff
 // Line 53 — Deduplicate by ID before appending
-setSignals(prev => [...prev, ...data]);
+setSignals(prev => {
+    const existingIds = new Set(prev.map(s => s.id));
+    const newItems = data.filter((s: RadarSignal) => !existingIds.has(s.id));
+    return [...prev, ...newItems];
+});
```

### 5.5.3 — Add Wire Tab Pagination
**Bug:** WIRE tab only shows initial 20 articles with no "Load More" button.
**File:** `frontend/src/features/terminal/components/TerminalPageClient.tsx`

Add state + handler for wire pagination (same pattern as radar):

```typescript
// Add alongside radar pagination state:
const [wireNews, setWireNews] = useState<CoinNews[]>(initialNews);
const [wireOffset, setWireOffset] = useState(initialNews.length);
const [hasMoreWire, setHasMoreWire] = useState(initialNews.length >= 20);
const [isLoadingMoreWire, setIsLoadingMoreWire] = useState(false);

const handleLoadMoreWire = async () => {
    if (isLoadingMoreWire || !hasMoreWire) return;
    setIsLoadingMoreWire(true);
    try {
        const { data } = await apiClient.get<CoinNews[]>(`/market/wire?offset=${wireOffset}&limit=20`);
        if (Array.isArray(data)) {
            if (data.length < 20) setHasMoreWire(false);
            if (data.length > 0) {
                const existingIds = new Set(wireNews.map(n => n.id));
                const newItems = data.filter(n => !existingIds.has(n.id));
                setWireNews(prev => [...prev, ...newItems]);
                setWireOffset(prev => prev + data.length);
            }
        } else {
            setHasMoreWire(false);
        }
    } catch (err) {
        console.error('Failed to load more wire:', err);
    } finally {
        setIsLoadingMoreWire(false);
    }
};
```

Also add offset support to the backend `getLatestWire` (same pattern as `getRadarSignals`):

```diff
 // market.controller.ts — getLatestWire function
+const offsetParam = req.query.offset as string | undefined;
+const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

 const news = await query
     .orderBy(desc(coinNews.publishedAt))
-    .limit(limit);
+    .limit(limit)
+    .offset(offset);
```

**Status:** `[ ]`

---

## Task 5.6: Fix Radar Sources Limitation
**Bug:** "Sources Analyzed" under each radar signal only searches the latest 20 articles. Old radar signals show no sources.
**Source:** `Issues_And_Improvements_Log.md` — Contextual Mismatches
**File:** `frontend/src/features/terminal/components/TerminalWire.tsx`

```diff
 // Line 76 — Search all available news, not just latest page
-const itemNews = news.filter(n => (n.coin || n.coinSymbol) === item.coin).slice(0, 2);
+const itemNews = news
+    .filter(n => (n.coin || n.coinSymbol) === item.coin)
+    .filter(n => {
+        // Filter by time proximity: sources from around the same time as the signal
+        const signalTime = new Date(item.createdAt).getTime();
+        const newsTime = new Date(n.createdAt).getTime();
+        const hoursDiff = Math.abs(signalTime - newsTime) / (1000 * 60 * 60);
+        return hoursDiff < 48; // Within 48 hours of signal creation
+    })
+    .slice(0, 3);
```

> **Note:** This is a client-side improvement. For a full fix, the backend should link news IDs to radar signals (partially addressed in Task 0.6) so sources can be fetched by relationship instead of heuristic matching.

**Status:** `[ ]`

---

# Phase 6: Text Embeddings & Semantic Dedup
**Priority:** 🔵 OPTIONAL (recommended after Phase 2)
**Duration:** 1 week
**Goal:** 90%+ duplicate detection accuracy

---

## Task 6.1: Enable pgvector Extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Task 6.2: Add Embedding Column
**File:** `backend/src/models/market.model.ts`

```diff
 export const rawNewsBuffer = pgTable('raw_news_buffer', {
     // ... existing ...
+    embedding: vector('embedding', { dimensions: 1536 }),
 });
```

> Requires `drizzle-orm/pg-core` pgvector support or raw SQL column.

## Task 6.3: Embedding Generation Service
**File:** `backend/src/services/embedding.service.ts` (NEW FILE)

Two options:
- **Option A:** OpenAI `text-embedding-3-small` ($0.02/M tokens)
- **Option B:** Self-hosted Ollama `nomic-embed-text` (free)

```typescript
import OpenAI from 'openai';

const embeddingClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY,
    baseURL: process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1',
});

export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await embeddingClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## Task 6.4: Replace Keyword Dedup with Semantic Dedup
**File:** `backend/src/services/similarity.service.ts`

```typescript
// Add alongside the keyword-based check:
export async function isDuplicateBySemantic(
    headline: string,
    threshold: number = 0.88
): Promise<boolean> {
    const embedding = await generateEmbedding(headline);

    // SQL: find nearest neighbor using pgvector
    const [nearest] = await db.execute(sql`
        SELECT headline, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
        FROM raw_news_buffer
        WHERE embedding IS NOT NULL
        AND retrieved_at > NOW() - INTERVAL '24 hours'
        ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
        LIMIT 1
    `);

    if (nearest && nearest.similarity > threshold) {
        return true; // 88%+ similarity = duplicate
    }
    return false;
}
```

## Task 6.5: Generate Embeddings on Insert
**File:** `backend/src/crons/terminalEngine.cron.ts`

```diff
+import { generateEmbedding } from '../services/embedding.service';

 await db.insert(rawNewsBuffer).values({
     title: rawText,
     source: newsItem.source || 'Unknown',
     sourceHash: hash,
     ttlExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
+    embedding: await generateEmbedding(rawText).catch(() => null),
 }).onConflictDoNothing();
```

**Status:** `[ ]`

---

# Appendix A: Dead Code Cleanup
**When:** Execute during Phase 1 (safe to do anytime)

## Files to Delete
| File | Reason |
|------|--------|
| `backend/src/services/ai/deep-analysis-router.ts` | Never called from any workflow/cron |
| `backend/src/services/ai/data-augmenter.ts` | `gatherCoinContext()` never called |

## Functions to Delete
| Function | File | Line | Reason |
|----------|------|------|--------|
| `generateMarketVerdict()` | `openai.service.ts` | 119-146 | Never called |
| `generateDeepIntelligenceReport()` | `openai.service.ts` | 150-189 | Never called |
| `generateDualNewsOutput()` | `openai.service.ts` | 302-385 | Never called |
| Related interfaces: `MarketVerdictResult`, `DeepIntelligenceReport`, `DualNewsOutput`, `RawAnalysis` | `openai.service.ts` | 9-46, 292-300 | Unused |
| `getAlphaStream()` | `terminal/api.ts` | 25-33 | Route doesn't exist |
| `AnalysisStream` type | `terminal/types.ts` | 24-34 | Unused |

## Functions from prompt-factory.ts to Delete
| Function | Line | Reason |
|----------|------|--------|
| `buildMarketVerdictMessages()` | 85-106 | Only called from deleted `generateMarketVerdict` |
| `buildDeepIntelligenceMessages()` | 108-137 | Only called from deleted `generateDeepIntelligenceReport` |
| `buildDualNewsStep1Messages()` | 175-197 | Only called from deleted `generateDualNewsOutput` |
| `buildDualNewsStep2Messages()` | 199-224 | Only called from deleted `generateDualNewsOutput` |

**Estimated cleanup: ~400 lines removed**

---

# Appendix B: Model Cost Map

## Current Usage (Before Changes)

| Task | Model | Via | Est. Cost/1000 calls |
|------|-------|----|---------------------|
| Triage (50 items batch) | GPT-5-nano | OpenRouter | $$$ |
| DeepSeek Analysis | DeepSeek-R1 | OpenRouter | $$ |
| GPT-nano Writer (800 words) | GPT-5-nano | OpenRouter | $$$ |
| Quality Audit | DeepSeek-R1 | OpenRouter | $$ |
| Chat (per message) | GPT-5-nano | OpenRouter | $ |
| **Total per news cycle** | | | **~4 calls** |

## After All Phases

| Task | Model | Via | Est. Cost/1000 calls | Change |
|------|-------|----|---------------------|--------|
| Triage | DeepSeek-R1 | **Direct API** | ¢ | -90% |
| NOISE filter | None (local) | N/A | Free | -100% |
| MINOR update | GPT-5-nano | OpenRouter | ¢ | -80% (1 paragraph vs article) |
| MAJOR analysis | DeepSeek-R1 | **Direct API** | ¢ | -50% |
| MAJOR write | GPT-5-nano | OpenRouter | $$ | Same |
| MAJOR audit | DeepSeek-R1 | **Direct API** | ¢ | -50% (conditional) |
| Chat | GPT-5-nano | OpenRouter | $ | Same |
| Embedding | text-embedding-3-small | OpenAI | ¢¢ | New, cheap |
| **Total per NOISE** | | | **0 calls** | -100% |
| **Total per MINOR** | | | **1 call** | -75% |
| **Total per MAJOR** | | | **2-3 calls** | -25% |

**Estimated overall reduction: 70-80%**

---

# Appendix C: Cron Schedule (After All Phases)

| Cron | Schedule | Purpose |
|------|----------|---------|
| `TerminalEngine` | Every 10 min | RSS → `raw_news_buffer` |
| `TriageEngine` | Every 2 hours | Score + classify MAJOR/MINOR/NOISE |
| `AiWorkflow` | Every hour | Process classified items → articles/updates |
| `HistoricalNews` | Daily 04:00 UTC | Fetch historical + backfill outcomes |
| `DailyAlpha` | Daily 06:00 UTC | Select day's top coin |
| `MarketMood` | Daily 07:00 UTC | Fear & Greed computation |
| `BufferCleanup` | Daily 00:00 UTC | Purge expired buffer items |
| `ConvictionUpdate` | Every 6 hours | Recalculate conviction for active coins |

---

# Appendix D: New Files Summary

| File | Created In | Purpose |
|------|-----------|---------|
| `backend/src/crons/historicalNews.cron.ts` | Phase 1 | Daily historical news fetch |
| `backend/src/services/conviction.service.ts` | Phase 2 | Algorithmic conviction scoring |
| `backend/src/crons/convictionUpdate.cron.ts` | Phase 2 | Runs conviction calc every 6h |
| `backend/src/services/similarity.service.ts` | Phase 3 | Local keyword-based dedup |
| `backend/src/middleware/chat-quota.middleware.ts` | Phase 4 | Redis-based chat rate limits |
| `backend/src/services/embedding.service.ts` | Phase 6 | Text embedding generation |
| `frontend/src/features/terminal/components/LivingArticle.tsx` | Phase 5 | Living article display |
| `frontend/src/features/terminal/components/AlphaSnapshot.tsx` | Phase 5 | Conviction/posture widget |

---

# Appendix E: Database Changes Summary

| Phase | Table | Action |
|-------|-------|--------|
| 2 | `coin_master_articles` | CREATE |
| 2 | `coin_timeline_updates` | CREATE |
| 2 | `raw_news_buffer` | ALTER — add `classification`, `triggerType` |
| 6 | `raw_news_buffer` | ALTER — add `embedding vector(1536)` |
| 6 | Extension | `CREATE EXTENSION vector` |

---

# Appendix F: Safety Notes

## ⚠️ F.1: Drizzle-Kit Push vs Migrate

**NEVER use `drizzle-kit push` on production:**
- `push` diffs your schema against the live DB and may **DROP columns/tables** to match
- Safe in development, **dangerous with real user data**
- Always use: `generate` → **review SQL** → `migrate`

## ⚠️ F.2: Cron Race Conditions (Mutex Lock)

After implementing Living Articles, the `AiWorkflow` cron processes more logic per run. During heavy market activity + API rate limits, a single run could exceed 1 hour → the next cron fires while the previous is still running → duplicate processing.

**Solution: Add a Redis-based mutex lock to AiWorkflow:**

```typescript
// At the top of runAiWorkflow():
const LOCK_KEY = 'cron:aiworkflow:lock';
const LOCK_TTL = 3600; // 1 hour max

if (redis) {
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    if (!acquired) {
        console.log('[AI Workflow] Previous run still active — skipping this cycle.');
        return;
    }
}

try {
    // ... entire workflow logic ...
} finally {
    if (redis) await redis.del(LOCK_KEY);
}
```

Apply the same pattern to `TriageEngine` and `TerminalEngine` if needed.

## ⚠️ F.3: `optionalAuth` on Context Route

The `/chat/stream` route uses `optionalAuth` — meaning guests CAN send `mode: 'context'` in the body. After Task 0.1.3, context requests go to `/chat/stream/context` which has `authMiddleware` — this is the correct and secure route. But the backend should also guard against body-level `mode: 'context'` on the general route:

```typescript
// In chat.controller.ts, after resolving mode:
if (resolvedMode === 'context' && !req.userId) {
    res.status(401).json({ error: 'Context AI requires authentication.' });
    return;
}
```

---

# Execution Checklist

```
Phase 0: [x] 0.1  [x] 0.1b [x] 0.2  [x] 0.3  [x] 0.4  [x] 0.5  [x] 0.6
Phase 1: [x] 1.1  [x] 1.2  [x] 1.3  [x] 1.4  [x] 1.5
Phase 2: [ ] 2.1  [ ] 2.1b(API) [ ] 2.1c(Seed) [ ] 2.2  [ ] 2.3  [ ] 2.4  [ ] 2.5
Phase 3: [ ] 3.1  [ ] 3.2
Phase 4: [ ] 4.1  [ ] 4.2
Phase 5: [ ] 5.1  [ ] 5.2  [ ] 5.3  [ ] 5.4  [ ] 5.5  [ ] 5.6
Phase 6: [ ] 6.1  [ ] 6.2  [ ] 6.3  [ ] 6.4  [ ] 6.5
Cleanup: [x] Dead code removal
```

---

# Tech Lead Review Log

## 2026-04-09 — Full Architecture Audit

### Completed: Phase 0 + Phase 1
All tasks verified through codebase inspection:
- Chat context mode, SSE parsing, buffer cleanup, asset count, force-seed auth, radar dedup
- Dual gateway (OpenRouter + DeepSeek Direct), triage on DeepSeek, historical cron, conditional audit, coinMemory feed
- Dead code removed (~400 lines)

### Critical Gaps Found & Fixed

1. **Missing API Endpoints for Living Articles** (Task 2.1b added)
   Phase 2 creates tables but no endpoints. Frontend needs `GET /market/master/:symbol` and `GET /market/timeline/:symbol`.

2. **Missing Data Migration** (Task 2.1c added)
   System would start empty without migrating existing coin_news to coin_master_articles.

3. **Triage Field Naming Conflict** (Task 2.2 scope updated)
   Removed `triggerType` from AI output. Now derived from existing `eventType` via code mapping. Saves 1 field on DB and reduces AI output complexity.

4. **Conviction Algorithm Weaknesses** (Task 2.4 scope updated)
   Added recency decay, impact-weighted scoring, bearish penalty multiplier, proper trend windowing.

5. **Chat Quotas `any` Type** (Task 4.2 scope updated)
   Must use `Record<PlanTier, PlanQuota>` with proper type narrowing. Zero `any` policy.

### Phase Dependency Chain
```
Phase 0 → Phase 1 → Phase 2 (11 → 11b → 11c → 12 → 13 → 14)
                                    ↓
                              Phase 3 (15)  ← can run parallel with 14
                                    ↓
                              Phase 4 (16)  ← depends on Phase 2 tables
                                    ↓
                              Phase 5 (17-19)
                                    ↓
                              Phase 6 (20)  ← optional
```

### Next Action
Start **Task 11: Living Article DB Schema** — create `coin_master_articles` + `coin_timeline_updates` tables, run migration.
Phase 0: [  ] 0.1  [  ] 0.1b [  ] 0.2  [  ] 0.3  [  ] 0.4  [  ] 0.5  [  ] 0.6
Phase 1: [  ] 1.1  [  ] 1.2  [  ] 1.3  [  ] 1.4  [  ] 1.5
Phase 2: [  ] 2.1  [  ] 2.2  [  ] 2.3  [  ] 2.4  [  ] 2.5
Phase 3: [  ] 3.1  [  ] 3.2
Phase 4: [  ] 4.1  [  ] 4.2
Phase 5: [  ] 5.1  [  ] 5.2  [  ] 5.3  [  ] 5.4  [  ] 5.5  [  ] 5.6
Phase 6: [  ] 6.1  [  ] 6.2  [  ] 6.3  [  ] 6.4  [  ] 6.5
Cleanup: [  ] Dead code removal
```
