# PHASE 7 — Wire Everything in aiWorkflow

> **Depends on:** Phases 3 + 4 + 5 + 6 all complete.
> **Goal:** Connect all layers into the single orchestration file.
> **Modified:** `backend/src/crons/aiWorkflow.cron.ts`

---

## Task 7-A: Rewrite aiWorkflow.cron.ts

**File:** `backend/src/crons/aiWorkflow.cron.ts`

### What to KEEP:
- The `isAiWorkflowRunning` boolean lock (line 14)
- The `runAiWorkflow()` export signature
- The `startAiWorkflowCron()` export and cron schedule (`0 * * * *`)
- The `generateSlug()` helper function (line 17-19)

### What to REMOVE (old imports):
```typescript
import { getTopBoostedTokens, getTokenData, DexTokenInfo } from '../services/dexscreener.service';
import { searchTavily } from '../services/tavily.service';
import { generateDeepIntelligenceReport, DeepIntelligenceReport } from '../services/openai.service';
import { fetchTopItemsForDeepAnalysis } from '../services/ai/deep-analysis-router';
```

### What to ADD (new imports):
```typescript
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { fetchHistoricalNewsForCoins, buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter, DeepAnalysisResult } from '../services/openai.service';
```

### New Pipeline Logic:

```
1. HARD CAP: countPublishedLastHour() >= 5 → skip
2. DYNAMIC THRESHOLD: getDynamicThreshold()
3. FETCH ELIGIBLE ITEMS: from rawNewsBuffer where:
   - relevanceScore >= threshold
   - processed = true (already triaged)
   - symbolMentions IS NOT NULL AND symbolMentions != '[]' (has coin symbols)
   - Sort by relevanceScore DESC
   - Limit: 5 - hourlyCount
4. FOR EACH ITEM:
   a. Extract primary symbol from symbolMentions[0]
   b. Get coin intelligence (cached, Phase 3)
   c. Fetch historical news + build temporal pattern (Phase 4)
   d. Get current price (Phase 2)
   e. Call DeepSeek analysis with circuit breaker (Phase 5)
   f. Call GPT-nano article writer with circuit breaker (Phase 5)
   g. Save article to coinNews table
   h. Save radar signal if verdict is STRONG_BUY/STRONG_SELL
   i. Targeted Redis cache invalidation
   j. Mark buffer item processed
```

### Drizzle ORM Query for Eligible Items:
```typescript
import { rawNewsBuffer } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne } from 'drizzle-orm';

const items = await db.select()
    .from(rawNewsBuffer)
    .where(and(
        gte(rawNewsBuffer.relevanceScore, threshold),
        eq(rawNewsBuffer.processed, true),
        ne(rawNewsBuffer.symbolMentions, null),
        ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
    ))
    .orderBy(desc(rawNewsBuffer.relevanceScore))
    .limit(5 - hourlyCount);
```

### Article Publishing to DB:
```typescript
import { coinNews, radarSignals } from '../models/market.model';
import { createHash } from 'crypto';

const sourceHash = createHash('sha256').update(article.headline).digest('hex');

const insertResult = await db.insert(coinNews).values({
    coinSymbol: symbol,
    headline: article.headline,
    summary: article.fullArticle,
    hook: article.hook,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    seoKeywords: article.seoKeywords,
    sentiment: analysisResult.sentiment,
    impactScore: analysisResult.impactScore,
    isBreaking: analysisResult.isBreaking ? 1 : 0,
    sourceHash,
    aiProcessed: 1,
}).onConflictDoNothing().returning();

if (analysisResult.verdict === 'STRONG_BUY' || analysisResult.verdict === 'STRONG_SELL') {
    await db.insert(radarSignals).values({
        coinSymbol: symbol,
        signalText: analysisResult.signalText,
        sentiment: analysisResult.sentiment,
        impactScore: analysisResult.impactScore,
    }).onConflictDoNothing();
}
```

### Targeted Redis Invalidation:
```typescript
import { redis } from '../config/redis';

const keysToInvalidate = [
    `news:${symbol}`,
    `news:${symbol}:latest`,
    `feed:global:latest`,
];

if (redis) {
    const pipeline = redis.pipeline();
    for (const key of keysToInvalidate) {
        pipeline.del(key);
    }
    await pipeline.exec();
}
```

---

### Prompt for Senior AI — Task 7:

```
You are the Senior Developer for OnlyAlpha. REWRITE a cron file completely.

=== FILE: backend/src/crons/aiWorkflow.cron.ts ===

KEEP:
- `isAiWorkflowRunning` boolean lock
- `runAiWorkflow()` export (rewrite body)
- `startAiWorkflowCron()` export with cron '0 * * * *'
- `generateSlug()` helper function (keep as-is)
- crypto import (for hashTitle/createHash)

REMOVE these imports:
- getTopBoostedTokens, getTokenData, DexTokenInfo from dexscreener.service
- searchTavily from tavily.service
- generateDeepIntelligenceReport, DeepIntelligenceReport from openai.service
- fetchTopItemsForDeepAnalysis from deep-analysis-router

ADD these imports:
```typescript
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { fetchHistoricalNewsForCoins, buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { getDynamicThreshold, countPublishedLastHour } from '../services/dynamicThreshold.service';
import { deepseekBreaker, gptNanoBreaker } from '../services/circuitBreaker.service';
import { callDeepSeekAnalysis, callGptNanoWriter } from '../services/openai.service';
import { coinNews, radarSignals, rawNewsBuffer } from '../models/market.model';
import { eq, gte, and, desc, sql, isNotNull, ne } from 'drizzle-orm';
import { deleteCache } from '../config/redis';
```

REMOVE the old `targetedPhase` parameter from `runAiWorkflow`. New signature:
```typescript
export async function runAiWorkflow(): Promise<void>
```

NEW PIPELINE BODY:

Step 1: Hard cap
```typescript
const hourlyCount = await countPublishedLastHour();
if (hourlyCount >= 5) {
    console.log('[AI Workflow] Hourly cap reached (5). Skipping.');
    return;
}
```

Step 2: Dynamic threshold
```typescript
const threshold = await getDynamicThreshold();
console.log(`[AI Workflow] Dynamic threshold: ${threshold}`);
```

Step 3: Fetch eligible items from rawNewsBuffer
```typescript
const items = await db.select()
    .from(rawNewsBuffer)
    .where(and(
        gte(rawNewsBuffer.relevanceScore, threshold),
        eq(rawNewsBuffer.processed, true),
        isNotNull(rawNewsBuffer.symbolMentions),
        ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
    ))
    .orderBy(desc(rawNewsBuffer.relevanceScore))
    .limit(5 - hourlyCount);
```

Step 4: Loop through items
```typescript
for (const item of items) {
    const mentions = (item.symbolMentions as string[]) || [];
    if (mentions.length === 0) continue;
    const symbol = mentions[0];
    const eventType = typeof item.eventType === 'string' ? item.eventType : 'Other';
    const eventSeverity = typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;

    console.log(`[AI Workflow] Processing: ${symbol} — "${item.title.slice(0, 60)}..."`);

    try {
        // 4a. Coin Intelligence
        const intelligence = await getCoinIntelligence(symbol);

        // 4b. Temporal Pattern
        await fetchHistoricalNewsForCoins([symbol]);
        const pattern = await buildTemporalPattern(symbol, eventType, eventSeverity);

        // 4c. Current Price
        const price = await getPriceWithFallback(symbol);

        // 4d. DeepSeek Analysis (circuit breaker)
        if (deepseekBreaker.isOpen()) {
            console.warn(`[AI Workflow] DeepSeek circuit open — skipping ${symbol}`);
            continue;
        }

        const analysisResult = await callDeepSeekAnalysis({
            headline: item.title,
            intelligence,
            pattern,
            price,
        });
        deepseekBreaker.recordSuccess();

        // 4e. GPT-nano Article (circuit breaker)
        if (gptNanoBreaker.isOpen()) {
            console.warn(`[AI Workflow] GPT-nano circuit open — skipping ${symbol}`);
            continue;
        }

        const article = await callGptNanoWriter(JSON.stringify(analysisResult));
        gptNanoBreaker.recordSuccess();

        // 4f. Save to coinNews
        const sourceHash = createHash('sha256').update(article.headline).digest('hex');
        await db.insert(coinNews).values({
            coinSymbol: symbol,
            headline: article.headline,
            summary: article.fullArticle,
            hook: article.hook,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
            seoKeywords: article.seoKeywords,
            sentiment: analysisResult.sentiment,
            impactScore: analysisResult.impactScore,
            isBreaking: analysisResult.isBreaking ? 1 : 0,
            sourceHash,
            aiProcessed: 1,
        }).onConflictDoNothing();

        // 4g. Radar signal for strong verdicts
        if (analysisResult.verdict === 'STRONG_BUY' || analysisResult.verdict === 'STRONG_SELL') {
            await db.insert(radarSignals).values({
                coinSymbol: symbol,
                signalText: analysisResult.signalText,
                sentiment: analysisResult.sentiment,
                impactScore: analysisResult.impactScore,
            }).onConflictDoNothing();
        }

        // 4h. Redis invalidation (targeted only)
        await deleteCache(`news:${symbol}`);
        await deleteCache('insight:all');

        console.log(`[AI Workflow] Published: ${symbol} — "${article.headline.slice(0, 50)}..."`);

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AI Workflow] Failed for ${symbol}:`, message);
        deepseekBreaker.recordFailure('DeepSeek');
        gptNanoBreaker.recordFailure('GPT-nano');
    }
}
```

IMPORTANT:
- Do NOT use `redis.pipeline()` — use the existing `deleteCache()` helper from redis.ts
- Wrap the entire item loop body in try/catch — individual failures should NOT stop the pipeline
- Keep `marketInsights` import if it's still used, otherwise remove it
- The cron schedule remains `'0 * * * *'` (hourly)

Rules: ZERO `any` types. Use Drizzle ORM for all DB operations. Do NOT modify any other files.
```

---

## Phase 7 Completion Checklist

- [ ] Old imports removed (dexscreener, tavily, deep-analysis-router, generateDeepIntelligenceReport)
- [ ] New imports added (coinIntelligence, temporal, priceService, threshold, circuitBreaker, callDeepSeekAnalysis, callGptNanoWriter)
- [ ] Hard cap: max 5 articles per hour
- [ ] Dynamic threshold applied to buffer query
- [ ] Coin intelligence fetched per item (cached)
- [ ] Temporal pattern built per item
- [ ] DeepSeek analysis with circuit breaker protection
- [ ] GPT-nano article writing with circuit breaker protection
- [ ] Article saved to `coinNews` with deduplication
- [ ] Radar signals created for STRONG_BUY/STRONG_SELL
- [ ] Targeted Redis invalidation (no flushall)
- [ ] Individual item failures don't stop the pipeline
- [ ] `startAiWorkflowCron()` still exports correctly
- [ ] Zero `any` types
