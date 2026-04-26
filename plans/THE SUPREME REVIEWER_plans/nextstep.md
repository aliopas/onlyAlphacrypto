# Phase 15 — Strategic Intelligence Layer (Forward-Looking Intelligence)

**Status:** IN PROGRESS — Partial schema changes applied, service + workflow integration pending  
**Date:** April 24, 2026  
**Priority:** P1 (Core Product Upgrade)  
**Scope:** 2 new files, 3 modified files, 1 SQL migration, 1 new API endpoint  

---

## OBJECTIVE

Transform OnlyAlpha from a **reactive news platform** (what happened) into a **forward-looking intelligence platform** (where the market is going + what to do about it).

Currently, the system is reactive only — signals and articles respond to news events, but there is NO layer that tells the user:
- Where is the market heading in the **next 7 days**?
- What is the best course of action **right now** based on combined technical + fundamental analysis?
- Are we in a **bull run or bear market**?
- Has the market **bottomed** or is there more downside?

The Living Article flips bullish/bearish with every headline, with **no stable strategic stance**.

---

## WHAT HAS ALREADY BEEN DONE ✅

### 1. Database Schema — `market.model.ts` ✅ APPLIED

Two new tables were added to `backend/src/models/market.model.ts`:

**`coin_strategic_outlook`** — Stores per-coin forward-looking intelligence:
- Short-term (7d): direction, target price, invalidation level, upcoming catalysts, confidence
- Long-term (3-6mo): market phase (Wyckoff), bull run probability, major support/resistance, isBottomIn, isTopIn, bull/bear evidence arrays
- Action: recommendation (accumulate/hold/reduce/avoid/watch), rationale, risk management instructions
- Meta: lastUpdatedByEvent, validUntil timestamp

**`smart_event_responses`** — Stores AI-generated action plans for major negative events:
- eventType, eventTitle, immediateImpact
- historicalParallels (JSON array of similar past events with outcomes)
- recommendedAction, watchLevels, timeHorizon
- isActive flag (deactivates when event is resolved)

### 2. DeepAnalysisResult Interface — `openai.service.ts` ✅ APPLIED

The `DeepAnalysisResult` interface now includes an optional `strategicOutlook` field:
```typescript
strategicOutlook?: {
    shortTerm: {
        direction: 'bullish' | 'bearish' | 'neutral';
        target: number | null;
        invalidation: number | null;
        catalysts: string[];
        confidence: number;
    };
    longTerm: {
        marketPhase: 'accumulation' | 'markup' | 'distribution' | 'markdown';
        bullRunProbability: number;
        majorSupport: number | null;
        majorResistance: number | null;
        isBottomIn: boolean;
        isTopIn: boolean;
        bullEvidence: string[];
        bearEvidence: string[];
    };
    action: {
        recommendation: 'accumulate' | 'hold' | 'reduce' | 'avoid' | 'watch';
        rationale: string;
        riskManagement: string;
    };
};
```

### 3. DeepSeek Prompt — `prompt-factory.ts` ✅ APPLIED

The `buildDeepAnalysisMessages()` system prompt now includes:
- Full `strategicOutlook` JSON schema in the output specification
- Strategic Outlook rules (target must come from real data, Wyckoff phases, specific evidence)
- Safe Harbor compliance rules (NFA tag on signalText, forbidden words: buy/sell/invest/recommend/should/must)
- signalText max raised from 40 → 70 words to accommodate source attribution + NFA suffix

---

## WHAT STILL NEEDS TO BE DONE 🔴

### Task 1: SQL Migration Script (Priority: FIRST — blocks everything else)

**Create:** `backend/scripts/migrate-strategic-outlook.sql`

```sql
-- Phase 15: Strategic Intelligence Layer
-- Run this migration BEFORE deploying the new service code

CREATE TABLE IF NOT EXISTS coin_strategic_outlook (
    id SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL UNIQUE,

    -- Short-term (7 days)
    short_term_direction VARCHAR(10),
    short_term_target REAL,
    short_term_invalidation REAL,
    short_term_catalysts JSON,
    short_term_confidence INTEGER,

    -- Long-term (3-6 months)
    market_phase VARCHAR(20),
    bull_run_probability INTEGER,
    major_support REAL,
    major_resistance REAL,
    is_bottom_in BOOLEAN,
    is_top_in BOOLEAN,
    long_term_bull_evidence JSON,
    long_term_bear_evidence JSON,

    -- Recommended action
    recommended_action VARCHAR(20),
    action_rationale TEXT,
    risk_management TEXT,

    -- Meta
    last_updated_by_event TEXT,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_event_responses (
    id SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_title TEXT NOT NULL,
    immediate_impact TEXT,
    historical_parallels JSON,
    recommended_action TEXT,
    watch_levels JSON,
    time_horizon VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strategic_outlook_symbol ON coin_strategic_outlook(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_smart_event_responses_symbol ON smart_event_responses(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_smart_event_responses_active ON smart_event_responses(coin_symbol, is_active);
```

**Run:** `psql $DATABASE_URL -f backend/scripts/migrate-strategic-outlook.sql`

---

### Task 2: Create Strategic Outlook Service (Priority: HIGH)

**Create:** `backend/src/services/strategicOutlook.service.ts`

This service manages the entire Strategic Intelligence Layer. It has 4 functions:

#### Function 1: `shouldUpdateOutlook()`

Determines if an event is significant enough to trigger a strategic outlook update. The outlook should NOT swing with every minor headline — only with structurally significant events.

```typescript
interface OutlookTriggerInput {
    classification: string;       // 'MAJOR' | 'MINOR' | 'NOISE'
    eventType: string;            // 'ETF' | 'Hack' | 'Regulatory' | etc.
    impactScore: number;          // 0-100
    eventSeverity: number;        // 1-3
    priceChange24h?: number;      // from price data
}

export function shouldUpdateOutlook(input: OutlookTriggerInput): boolean {
    // Only MAJOR events qualify
    if (input.classification !== 'MAJOR') return false;
    // Must have meaningful impact
    if (input.impactScore < 70) return false;
    // Must be a structurally significant event type OR a large price move
    const structuralEvents = ['Regulatory', 'ETF', 'Hack', 'Exploit', 'Listing', 'Delisting'];
    const isStructural = structuralEvents.includes(input.eventType);
    const isLargePriceMove = Math.abs(input.priceChange24h ?? 0) > 10;
    return isStructural || isLargePriceMove || input.eventSeverity >= 3;
}
```

#### Function 2: `saveStrategicOutlook()`

Upserts the strategic outlook for a coin. Uses Drizzle `onConflictDoUpdate` on `coinSymbol`.

```typescript
import { db } from '../config/db';
import { coinStrategicOutlook } from '../models/market.model';
import { eq, sql } from 'drizzle-orm';
import type { DeepAnalysisResult } from './openai.service';

export async function saveStrategicOutlook(
    coinSymbol: string,
    outlook: NonNullable<DeepAnalysisResult['strategicOutlook']>,
    triggerEventTitle: string
): Promise<void> {
    const values = {
        coinSymbol,
        shortTermDirection: outlook.shortTerm.direction,
        shortTermTarget: outlook.shortTerm.target,
        shortTermInvalidation: outlook.shortTerm.invalidation,
        shortTermCatalysts: outlook.shortTerm.catalysts,
        shortTermConfidence: outlook.shortTerm.confidence,
        marketPhase: outlook.longTerm.marketPhase,
        bullRunProbability: outlook.longTerm.bullRunProbability,
        majorSupport: outlook.longTerm.majorSupport,
        majorResistance: outlook.longTerm.majorResistance,
        isBottomIn: outlook.longTerm.isBottomIn,
        isTopIn: outlook.longTerm.isTopIn,
        longTermBullEvidence: outlook.longTerm.bullEvidence,
        longTermBearEvidence: outlook.longTerm.bearEvidence,
        recommendedAction: outlook.action.recommendation,
        actionRationale: outlook.action.rationale,
        riskManagement: outlook.action.riskManagement,
        lastUpdatedByEvent: triggerEventTitle,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days validity
    };

    await db.insert(coinStrategicOutlook)
        .values(values)
        .onConflictDoUpdate({
            target: coinStrategicOutlook.coinSymbol,
            set: {
                ...values,
                updatedAt: sql`NOW()`,
            },
        });

    console.log(`[StrategicOutlook] Saved outlook for ${coinSymbol}: ${outlook.shortTerm.direction} → $${outlook.shortTerm.target}`);
}
```

#### Function 3: `buildSmartEventResponse()`

For major negative events (hacks, SEC actions, exploits), queries `coinNewsHistory` for similar past events and generates an action plan.

```typescript
import { coinNewsHistory, smartEventResponses } from '../models/market.model';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

interface HistoricalParallel {
    event: string;
    date: string;
    initialDrop: number;
    recoveryDays: number | null;
    finalOutcome: string;
}

export async function buildSmartEventResponse(
    coinSymbol: string,
    eventType: string,
    eventTitle: string,
    currentPrice: number
): Promise<void> {
    // 1. Find similar historical events across ALL coins (not just this one)
    const similarEvents = await db.select()
        .from(coinNewsHistory)
        .where(and(
            eq(coinNewsHistory.eventType, eventType),
            isNotNull(coinNewsHistory.priceChange7d),
            isNotNull(coinNewsHistory.priceAtTime)
        ))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(10);

    if (similarEvents.length === 0) {
        console.log(`[SmartEventResponse] No historical parallels found for ${eventType}`);
        return;
    }

    // 2. Calculate average impact and recovery stats
    const parallels: HistoricalParallel[] = similarEvents.map(e => ({
        event: `${e.coinSymbol}: ${e.title.slice(0, 80)}`,
        date: e.publishedAt.toISOString().split('T')[0],
        initialDrop: Number(e.priceChange7d ?? 0),
        recoveryDays: null, // Would need price_30d_after data for recovery tracking
        finalOutcome: e.isRugPull
            ? 'Total loss — rug pull confirmed'
            : `${Number(e.priceChange7d ?? 0) > 0 ? '+' : ''}${Number(e.priceChange7d ?? 0).toFixed(1)}% in 7 days`,
    }));

    const avgDrop = parallels.reduce((sum, p) => sum + p.initialDrop, 0) / parallels.length;
    const recoveryRate = parallels.filter(p => p.initialDrop > -5).length / parallels.length;

    // 3. Build recommended action text
    const isBearish = avgDrop < -5;
    const immediateImpact = isBearish
        ? `Historical data shows ${eventType} events cause an average ${avgDrop.toFixed(1)}% price movement within 7 days. Recovery rate: ${(recoveryRate * 100).toFixed(0)}%.`
        : `Historical data shows ${eventType} events have limited price impact (avg ${avgDrop.toFixed(1)}% over 7 days).`;

    const recommendedAction = isBearish
        ? `Short-term (1-2 weeks): Data suggests elevated risk — monitor for contagion. Medium-term (30-60 days): Historical recovery rate is ${(recoveryRate * 100).toFixed(0)}%. Watch key support levels for confirmation of stabilization.`
        : `Data suggests limited direct price impact from this event type. Monitor for secondary effects.`;

    // 4. Deactivate previous responses for same coin + event type
    await db.update(smartEventResponses)
        .set({ isActive: false })
        .where(and(
            eq(smartEventResponses.coinSymbol, coinSymbol),
            eq(smartEventResponses.eventType, eventType),
            eq(smartEventResponses.isActive, true)
        ));

    // 5. Insert new response
    await db.insert(smartEventResponses).values({
        coinSymbol,
        eventType,
        eventTitle,
        immediateImpact,
        historicalParallels: parallels,
        recommendedAction,
        watchLevels: { support: currentPrice * 0.9, exitTrigger: currentPrice * 0.85 },
        timeHorizon: isBearish ? '1month' : '1week',
        isActive: true,
    });

    console.log(`[SmartEventResponse] Generated action plan for ${coinSymbol} — ${eventType} (${parallels.length} parallels, avg impact: ${avgDrop.toFixed(1)}%)`);
}
```

#### Function 4: `getStrategicOutlook()` + `getActiveEventResponses()`

Simple getters for the API layer:

```typescript
export async function getStrategicOutlook(coinSymbol: string) {
    const result = await db.select()
        .from(coinStrategicOutlook)
        .where(eq(coinStrategicOutlook.coinSymbol, coinSymbol))
        .limit(1);
    return result[0] ?? null;
}

export async function getActiveEventResponses(coinSymbol: string) {
    return await db.select()
        .from(smartEventResponses)
        .where(and(
            eq(smartEventResponses.coinSymbol, coinSymbol),
            eq(smartEventResponses.isActive, true)
        ))
        .orderBy(desc(smartEventResponses.createdAt))
        .limit(5);
}
```

---

### Task 3: Integrate into AI Workflow Cron (Priority: HIGH)

**File:** `backend/src/crons/aiWorkflow.cron.ts`

#### 3A. Add imports at top of file (after existing imports):

```typescript
import { shouldUpdateOutlook, saveStrategicOutlook, buildSmartEventResponse } from '../services/strategicOutlook.service';
```

#### 3B. Add strategic outlook logic AFTER factual grounding (after line ~308, before the article writer section)

Insert this block after the factual grounding validation (`if (grounding.removedLevels.length > 0)` block ends), and BEFORE the GPT-nano article writer section (`// 4e. GPT-nano Article`):

```typescript
                // 4d-ii. Strategic Outlook update (only for structurally significant events)
                if (analysisResult.strategicOutlook) {
                    const triggerInput = {
                        classification,
                        eventType,
                        impactScore: analysisResult.impactScore,
                        eventSeverity: analysisResult.eventSeverity,
                        priceChange24h: price?.change24h ?? undefined,
                    };

                    if (shouldUpdateOutlook(triggerInput)) {
                        try {
                            await saveStrategicOutlook(symbol, analysisResult.strategicOutlook, item.title);
                            console.log(`[AI Workflow] Strategic outlook updated for ${symbol}`);
                        } catch (outlookErr) {
                            console.error(`[AI Workflow] Failed to save strategic outlook for ${symbol}:`, outlookErr);
                        }
                    } else {
                        console.log(`[AI Workflow] Outlook update skipped for ${symbol} — event not structurally significant`);
                    }
                }

                // 4d-iii. Smart Event Response (for high-severity negative events)
                const negativeEventTypes = ['Hack', 'Exploit', 'Regulatory', 'Delisting'];
                if (
                    analysisResult.sentiment === 'bearish' &&
                    analysisResult.eventSeverity >= 2 &&
                    negativeEventTypes.includes(eventType)
                ) {
                    try {
                        await buildSmartEventResponse(symbol, eventType, item.title, currentPrice);
                        console.log(`[AI Workflow] Smart event response generated for ${symbol} — ${eventType}`);
                    } catch (eventErr) {
                        console.error(`[AI Workflow] Failed to build smart event response for ${symbol}:`, eventErr);
                    }
                }
```

#### 3C. Add Redis cache invalidation for strategic outlook (at line ~490, alongside existing cache invalidations):

Add after `await deleteCache('insight:all');`:

```typescript
                await deleteCache(`outlook:${symbol}`);
```

---

### Task 4: API Endpoint for Strategic Outlook (Priority: MEDIUM)

**File:** `backend/src/controllers/market.controller.ts` (or create a new controller)

Add a new endpoint that serves the strategic outlook + active event responses for a coin:

```typescript
// GET /api/outlook/:symbol
export async function getStrategicOutlookHandler(req: Request, res: Response) {
    const { symbol } = req.params;
    const cacheKey = `outlook:${symbol.toUpperCase()}`;

    // Check Redis cache
    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
    }

    const [outlook, eventResponses] = await Promise.all([
        getStrategicOutlook(symbol.toUpperCase()),
        getActiveEventResponses(symbol.toUpperCase()),
    ]);

    const response = {
        outlook,
        activeEvents: eventResponses,
    };

    // Cache for 5 minutes
    if (redis) {
        await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    }

    return res.json(response);
}
```

**Route registration** — add to `backend/src/routes/index.ts`:

```typescript
router.get('/outlook/:symbol', getStrategicOutlookHandler);
```

---

### Task 5: Export New Tables from Model Index (Priority: LOW — if needed)

**File:** `backend/src/models/index.ts`

If the models index re-exports from `market.model.ts`, ensure the new tables are included:

```typescript
export { coinStrategicOutlook, smartEventResponses } from './market.model';
```

---

## VALIDATION CHECKLIST

After all tasks are complete, verify the following:

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Run migration SQL against the database | Both tables created with correct columns and indexes |
| 2 | Trigger a MAJOR event for BTC (impactScore ≥ 70, eventType = 'ETF') | Strategic outlook saved to `coin_strategic_outlook` table |
| 3 | Trigger a MINOR event for BTC | Outlook NOT updated (shouldUpdateOutlook returns false) |
| 4 | Trigger a MAJOR bearish event (eventType = 'Hack', severity ≥ 2) | Smart event response generated with historical parallels |
| 5 | Check `signalText` output from DeepSeek | Ends with `\| NFA` |
| 6 | Check `signalText` for forbidden words | No "buy", "sell", "invest", "recommend", "should" in any field |
| 7 | Check `strategicOutlook.shortTerm.target` | Must be within ±50% of current price (not hallucinated) |
| 8 | Call `GET /api/outlook/BTC` | Returns outlook + activeEvents JSON |
| 9 | Check Redis invalidation after outlook update | `outlook:BTC` cache key deleted |
| 10 | Verify existing pipeline still works | Articles, radar signals, timeline updates all function normally |

---

## RISK NOTES

1. **DeepSeek prompt is now longer (~400 extra tokens).** Monitor for any degradation in output quality for the existing fields (sentiment, verdict, keyFacts). If quality drops, the strategic outlook should be split into a SEPARATE AI call using GLM.

2. **`strategicOutlook` is optional (`?`).** The model may sometimes omit it. All code paths must handle `analysisResult.strategicOutlook === undefined` gracefully — the pipeline continues without saving an outlook.

3. **`shouldUpdateOutlook()` is intentionally conservative.** Only ~10-20% of MAJOR events should trigger an outlook update. If the outlook updates too frequently, the "flip-flopping" problem returns. The threshold can be tuned later.

4. **Smart Event Response uses ALL coins' history.** The `coinNewsHistory` query in `buildSmartEventResponse` does NOT filter by `coinSymbol` — it searches across all coins for the same `eventType`. This is intentional (cross-species pattern matching). If the user wants coin-specific parallels only, add an `eq(coinNewsHistory.coinSymbol, coinSymbol)` filter.

5. **No frontend changes in this phase.** The API endpoint serves JSON. Frontend rendering of the strategic outlook (in LivingArticle, DeepDiveSection, or a new component) is a SEPARATE task for the frontend developer.

---

## FILES SUMMARY

| File | Status | Action |
|------|--------|--------|
| `backend/src/models/market.model.ts` | ✅ DONE | 2 new tables added |
| `backend/src/services/openai.service.ts` | ✅ DONE | `strategicOutlook` field added to `DeepAnalysisResult` |
| `backend/src/services/ai/prompt-factory.ts` | ✅ DONE | DeepSeek prompt updated with outlook schema + NFA rules |
| `backend/scripts/migrate-strategic-outlook.sql` | 🔴 TODO | Create migration script (SQL provided above) |
| `backend/src/services/strategicOutlook.service.ts` | 🔴 TODO | Create new service (full code provided above) |
| `backend/src/crons/aiWorkflow.cron.ts` | 🔴 TODO | Add 3 blocks: imports, outlook logic, cache invalidation |
| `backend/src/controllers/market.controller.ts` | 🔴 TODO | Add `getStrategicOutlookHandler` endpoint |
| `backend/src/routes/index.ts` | 🔴 TODO | Register `/outlook/:symbol` route |
| `backend/src/models/index.ts` | 🔴 TODO (if needed) | Export new tables |

---

*Plan authored: April 24, 2026*  
*Based on: Full codebase audit of all backend services, models, crons, and AI pipeline*

---
---

# Phase 16 — Airdrop Feature: Pipeline Fix & UX Empty States (P0)

**Status:** 🔴 BLOCKED — Pipeline produces zero projects, frontend has zero user feedback  
**Date:** April 24, 2026  
**Priority:** P0 (Feature shipped broken-by-default)  
**Scope:** Backend pipeline repair + Frontend UX states  
**Reviewed by:** Tech Lead  

---

## OBJECTIVE

The Airdrop feature is **architecturally complete** — frontend, backend, DB schema, API routes, crons, and AI pipeline are all wired correctly. The code does not crash. However, the pipeline runs but **produces nothing**, and the UI has **zero visibility** into why. The result: users see an empty grid with `$0` everywhere and no explanation.

This is not a new feature request. This is a **P0 fix** for a feature that shipped broken-by-default.

---

## ROOT CAUSE ANALYSIS

### Problem 1: Pipeline Produces Zero Projects (Backend)

The data flow was traced end-to-end:

```
RSS Feeds → Keyword Filter → In-Memory Dedup → AI Validation (DeepSeek) → isLegitimate? → Duplicate Name Check → INSERT into airdrop_projects
```

The pipeline has **6 silent failure points**:

| # | Failure Point | Evidence |
|---|---|---|
| 1 | **RSS feeds are dead/invalid** | `coinmarketcap.com/airdrops/rss/` does NOT exist — this URL returns a 404 silently. CoinDesk's general RSS feed (`coindesk.com/arc/outboundfeeds/rss`) rarely contains airdrop-specific content. Only CryptoSlate and CoinGape have airdrop-targeted search params. |
| 2 | **Keyword filter is too aggressive** | `AIRDROP_KEYWORDS` requires specific airdrop terms. CoinDesk's general feed articles will almost never pass this filter. Net result: only 2 out of 4 sources can possibly produce candidates. |
| 3 | **AI validation is VERY conservative** | The DeepSeek prompt says: *"Be CONSERVATIVE. Only flag confirmed or highly probable airdrops."* + `isLegitimate = false` is the default rejection path. Articles that merely mention airdrops get rejected. |
| 4 | **`MAX_AI_CALLS_PER_RUN = 5`** | Even if articles pass the keyword filter, only 5 are processed per 6-hour cycle. Combined with the above filters, actual insertions approach zero. |
| 5 | **In-memory dedup resets on redeploy** | `processedHashes` is a `Set<string>` in server memory. Every server restart (which happens on every Railway/Render deploy) re-processes the same articles, which then get rejected again (duplicate name check), wasting AI calls. |
| 6 | **No monitoring or alerting** | All rejections go to `console.log`. No DB log, no health metric, no dashboard. Zero visibility into pipeline performance. |

**Net Effect:** The cron runs → fetches RSS → filters out most articles → AI rejects the rest → **zero rows** in `airdrop_projects` → frontend renders an empty grid → user sees nothing.

**Key files involved:**
- `backend/src/crons/airdropRssHunter.cron.ts` (line 13: `MAX_AI_CALLS_PER_RUN = 5`, line 16: in-memory `processedHashes`)
- `backend/src/services/airdropRss.service.ts` (line 21-26: `AIRDROP_RSS_SOURCES` with dead URLs)
- `backend/src/services/ai/prompt-factory.ts` (line 166: "Be CONSERVATIVE" instruction)

---

### Problem 2: Zero User Feedback (Frontend)

When `projects = []` (which is always right now), the user sees:

| UI Element | Current State | Problem |
|---|---|---|
| **Farm Grid** | Empty grid, zero cards rendered | No message explaining why it's empty |
| **Stats bar** | Shows `$0`, `0 Active`, `0 Completed` | Looks like the feature is completely broken |
| **Hint text** | "Start farming to unlock potential value" | Vague — doesn't explain there are no projects |
| **Sidebar Stats** | Shows `Loading...` then `$0+` / `00` wallets | Looks dead |
| **Activity** | "No activity yet" | Fine individually |
| **Deadlines** | "No upcoming deadlines" | Fine individually |
| **Combined effect** | Everything shows zeros or "no data" | User has no idea if this is a bug, empty state, or broken feature |

**What's missing:**
- **No empty state component** — When `projects.length === 0`, should show a designed empty state with explanation
- **No error state** — If the API call fails, user sees the same empty grid. No distinction between "empty" vs "error"
- **No loading skeleton** — The server-side fetch in `page.tsx` catches errors silently and passes `projects = []`
- **No pipeline status** — No indication of when the system last scanned or when the next scan is

**Key files involved:**
- `frontend/src/app/airdrops/page.tsx` (line 31-35: silent error catch returns empty array)
- `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` (line 265-327: no empty state handling for the grid)

---

## EXECUTION PLAN

### Track 1: Fix the Pipeline (Backend)

#### Task 1.1: Seed Initial Projects (IMMEDIATE — do this FIRST)

Create an admin script or use direct SQL to seed 3-5 known active airdrop projects into `airdrop_projects`. This proves the UI works and gives users immediate value.

Example candidates (verify current status before inserting): LayerZero, ZkSync, Starknet, Scroll, or any confirmed active airdrops at time of execution.

**Constraint:** The seeded projects must have `isActive = true`, valid `network`, and reasonable `estValue`. AI report can be manually written or left null initially — the `airdropHunter.cron.ts` routine sync (every 12 hours) will auto-generate AI reports for active projects.

---

#### Task 1.2: Replace Dead RSS Sources

**File:** `backend/src/services/airdropRss.service.ts`

**Action:** Audit and replace `AIRDROP_RSS_SOURCES` array (line 21-26):
- **REMOVE:** `coinmarketcap.com/airdrops/rss/` (404 — does not exist)
- **KEEP:** CryptoSlate and CoinGape (have `?s=airdrop` params, likely functional)
- **EVALUATE:** CoinDesk general feed — either add `?s=airdrop` param or remove
- **ADD:** 2-3 verified working airdrop-specific RSS feeds (e.g., airdrops.io, DeFi-specific aggregators, The Block with search params)

**Constraint:** Every new URL must be manually verified to return valid RSS XML with airdrop content before committing.

---

#### Task 1.3: Move Dedup to Redis

**File:** `backend/src/crons/airdropRssHunter.cron.ts`

**Action:** Replace the in-memory `processedHashes` Set (line 16) with Redis SET operations:
- Use `SADD airdrop:processed_hashes <hash>` to add
- Use `SISMEMBER airdrop:processed_hashes <hash>` to check
- Set TTL of 7 days on the set to auto-cleanup

**Constraint:** Fallback to in-memory Set if Redis is unavailable (existing pattern in the codebase).

---

#### Task 1.4: Tune AI Validation Prompt

**File:** `backend/src/services/ai/prompt-factory.ts`

**Action:** In `buildAirdropFromArticleMessages()` (line 138+):
- Change: *"Be CONSERVATIVE. Only flag confirmed or highly probable airdrops."*
- To: *"Flag projects that have reasonable evidence of a legitimate airdrop opportunity. Use the riskVerdict field to communicate uncertainty — set to MEDIUM_RISK or HIGH_RISK rather than rejecting entirely."*

**Constraint:** Do NOT remove the `isLegitimate` field or the SCAM rejection. The goal is to reduce false negatives while keeping true positives. The `riskVerdict` field already handles risk communication to the user.

---

#### Task 1.5: Add Pipeline Health Logging

**Action:** Create a new table `airdrop_pipeline_runs`:

```sql
CREATE TABLE IF NOT EXISTS airdrop_pipeline_runs (
    id SERIAL PRIMARY KEY,
    run_type VARCHAR(20) NOT NULL,           -- 'rss_discovery' | 'routine_sync'
    run_at TIMESTAMP DEFAULT NOW() NOT NULL,
    articles_found INTEGER DEFAULT 0,
    articles_processed INTEGER DEFAULT 0,
    projects_inserted INTEGER DEFAULT 0,
    projects_rejected INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    notes TEXT
);
```

Log every cron run into this table (at the end of `runAirdropRSSDiscovery` and `runRoutineSync`).

**Constraint:** Keep it simple — one INSERT at the end of each run. No real-time logging.

---

### Track 2: Fix the UX (Frontend)

#### Task 2.1: Empty State Component

**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`

**Action:** When `projects.length === 0` and loading is complete, render a designed empty state component instead of an empty grid. Must include:
- An icon or illustration (use existing Material icons or Lucide)
- Heading: "No Active Airdrops Tracked"
- Subtext: "Our AI pipeline scans for new airdrop opportunities every 6 hours. New verified projects will appear here automatically."
- Optional: "Last scan: X hours ago" (requires adding `lastScanAt` to API response)

**Constraint:** Must be visually premium — dark theme, consistent with existing card design. NOT a sad emoji placeholder.

---

#### Task 2.2: Error State Propagation

**Files:** `frontend/src/app/airdrops/page.tsx` + `AirdropsPageClient.tsx`

**Action:**
- In `page.tsx`: Pass an `error` boolean prop to `AirdropsPageClient` when the server-side fetch fails (line 33-34)
- In `AirdropsPageClient`: Accept `initialError?: boolean` prop. When true, show error state: "Unable to load airdrops. Please try again later." with a retry button.

**Constraint:** Do NOT expose internal error details to the user. Keep it generic and clean.

---

#### Task 2.3: Loading Skeleton for Main Grid

**File:** `frontend/src/features/airdrop/components/AirdropsPageClient.tsx`

**Action:** Add a loading skeleton state for the main project grid. Can reuse the card layout structure with pulsing placeholder blocks.

**Constraint:** The sidebar already has `sidebarLoading` with "Loading..." text. The main grid needs a similar (but better-designed) skeleton.

---

#### Task 2.4: Pipeline Status Indicator (Optional — next deploy)

**Action:** Add a small status bar above the grid showing:
- "Last scan: 2h ago"
- "Next scan in: ~4h"
- "Sources: 3/4 active"

This requires a new API endpoint that reads from `airdrop_pipeline_runs` (Task 1.5).

**Constraint:** This is a nice-to-have for the second deploy. Not blocking.

---

## PRIORITY ORDER

```
1. Task 1.1 — Seed 3-5 real projects manually (IMMEDIATE — proves UI works)
2. Task 1.2 — Fix RSS sources (same deploy as seed)
3. Task 2.1 — Add empty state to frontend (same deploy)
4. Task 2.2 — Add error state propagation (same deploy)
5. Task 1.3 — Move dedup to Redis (next deploy)
6. Task 1.4 — Tune AI validation prompt (next deploy)
7. Task 1.5 — Add pipeline health logging (next deploy)
8. Task 2.3 — Loading skeleton (next deploy)
9. Task 2.4 — Pipeline status indicator (next deploy)
```

---

## TECHNICAL CONSTRAINTS (Architect MUST Follow)

1. **Do NOT change the core AI model routing** — DeepSeek for airdrop analysis is correct for cost
2. **Do NOT remove `onConflictDoNothing`** on `airdropProjects.name` — dedup by project name is essential
3. **Do NOT increase `MAX_AI_CALLS_PER_RUN` beyond 10** — cost control
4. **Do NOT add manual airdrop submission from the frontend** — admin-only concern
5. **Keep the existing card design system** — it is well-built and should not be redesigned
6. **Empty state must be visually premium** — not a minimal placeholder

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Visit `/airdrops` page after seeding | Cards appear with project names, risk verdicts, and progress bars |
| 2 | Visit `/airdrops` page with zero projects | Empty state component appears with explanation text |
| 3 | Simulate API failure on server-side fetch | Error state appears with retry button |
| 4 | Check server logs after RSS cron runs | At least 1 article passes keyword filter from working sources |
| 5 | Restart server and check dedup behavior | Previously processed hashes still exist in Redis (not re-processed) |
| 6 | Check `airdrop_pipeline_runs` table after cron | Row inserted with accurate counts |
| 7 | Verify AI validation on a real airdrop article | `isLegitimate = true` for a clearly valid airdrop (not falsely rejected) |

---

## FILES SUMMARY

| File | Status | Action |
|------|--------|--------|
| `backend/src/services/airdropRss.service.ts` | 🔴 TODO | Replace dead RSS sources (line 21-26) |
| `backend/src/crons/airdropRssHunter.cron.ts` | 🔴 TODO | Move dedup to Redis, log pipeline runs |
| `backend/src/services/ai/prompt-factory.ts` | 🔴 TODO | Tune airdrop validation prompt (line 166) |
| `frontend/src/app/airdrops/page.tsx` | 🔴 TODO | Pass error state to client component |
| `frontend/src/features/airdrop/components/AirdropsPageClient.tsx` | 🔴 TODO | Add empty state, error state, loading skeleton |
| DB: `airdrop_projects` | 🔴 TODO | Seed 3-5 real projects manually |
| DB: `airdrop_pipeline_runs` | 🔴 TODO | Create new health logging table |

---

*Report authored: April 24, 2026*  
*Based on: Full end-to-end audit of Airdrop pipeline (RSS → AI → DB → API → Frontend)*  
*Reviewed by: Tech Lead — APPROVED FOR FIX*

---
---

# Phase 16 — Telegram Data Sources + Z.ai Web Search Enrichment

**Status:** PLANNED  
**Date:** April 24, 2026  
**Priority:** P2 (Data Quality Upgrade)  
**Scope:** 2 new files, 2 modified files, 2 new env variables  

---

## OBJECTIVE

Two upgrades to the data layer:

1. **Telegram Channel Monitor** — Pull real-time data from public Telegram channels (crypto news + airdrop channels) and feed it into the existing `rawNewsBuffer` and `airdropRssHunter` pipelines.
2. **Z.ai Web Search Enrichment** — When an airdrop project has insufficient data from RSS/Telegram alone, use GLM Web Search to find additional information before AI validation.

---

## PART A: Telegram Channel Monitor

### Technical Approach

Use **`telegram`** npm package (gramjs for Node.js) with MTProto API to read public channels as a user client.

### Env Variables Required

Add to `backend/.env`:
```
TELEGRAM_API_ID=your_api_id          # Get from https://my.telegram.org
TELEGRAM_API_HASH=your_api_hash      # Get from https://my.telegram.org
TELEGRAM_SESSION_STRING=              # Generated on first login (one-time)
```

Add to `backend/src/config/env.ts`:
```typescript
TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ?? '',
TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH ?? '',
TELEGRAM_SESSION_STRING: process.env.TELEGRAM_SESSION_STRING ?? '',
```

### Task 1: Create `backend/src/services/telegram.service.ts`

Core service that connects to Telegram and reads messages from configured channels.

**Key exports:**

```typescript
// Channels to monitor — split by purpose
const NEWS_CHANNELS: string[] = [
    'WhaleAlert',              // Whale movements
    'binaborede',              // Binance Arabic announcements  
    'binaborede',              // Binance announcements
    'OKXAnnouncements',        // OKX listings/delistings
    'WuBlockchain',            // Wu Blockchain — early news
    'theaborede',              // The Block news
    'CryptoQuantAlerts',       // On-chain alerts
];

const AIRDROP_CHANNELS: string[] = [
    'aaborede',                // Airdrop Alpha
    'earndrop',                // EarnDrop
    'AirdropAlert',            // Airdrop Alert Official
    'DeFinance_Airdrop',       // DeFi Airdrops
    'crypto_airdrops',         // Crypto Airdrops
];

// Reads last N messages from a channel, returns structured data
export async function fetchChannelMessages(
    channelUsername: string, 
    limit: number
): Promise<TelegramMessage[]>

// Filters messages for crypto news relevance
export async function fetchNewsFromTelegram(): Promise<TelegramNewsItem[]>

// Filters messages for airdrop relevance  
export async function fetchAirdropsFromTelegram(): Promise<TelegramAirdropItem[]>
```

**Output interface (for news pipeline):**
```typescript
interface TelegramNewsItem {
    title: string;          // First 200 chars of message
    source: string;         // "telegram:WuBlockchain"
    sourceHash: string;     // SHA256 of message content
    link: string;           // t.me link to original message
    publishedAt: Date;      // Message timestamp
    rawContent: string;     // Full message text
}
```

**Output interface (for airdrop pipeline):**
```typescript
interface TelegramAirdropItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;         // "telegram:AirdropAlert"
    content: string;
    hash: string;
}
// NOTE: This matches AirdropRSSArticle interface exactly — so it feeds
// directly into the existing airdropRssHunter pipeline with zero changes!
```

**Spam filtering logic:**
```typescript
const SPAM_PATTERNS = [
    /join.*group/i, /click.*link/i, /send.*dm/i,
    /guaranteed.*profit/i, /100x/i, /pump/i,
    /t\.me\/joinchat/i, /forward.*from/i,
];

function isSpam(text: string): boolean {
    return SPAM_PATTERNS.some(p => p.test(text));
}
```

### Task 2: Create `backend/src/crons/telegramMonitor.cron.ts`

Cron that runs every 30 minutes. Two jobs:

**Job A — News channels → `rawNewsBuffer`:**
```typescript
// 1. Fetch messages from NEWS_CHANNELS (last 30 min only)
// 2. Filter spam
// 3. Deduplicate against existing rawNewsBuffer (by sourceHash)
// 4. Insert into rawNewsBuffer with source = "telegram:ChannelName"
// 5. The existing triageEngine + aiWorkflow pick them up automatically
```

**Job B — Airdrop channels → airdrop pipeline:**
```typescript
// 1. Fetch messages from AIRDROP_CHANNELS (last 6 hours)
// 2. Filter using existing filterAirdropRelevant() from airdropRss.service.ts
// 3. Convert to AirdropRSSArticle format
// 4. Feed into validateAirdropFromArticle() — same as RSS pipeline
// 5. Insert valid projects into airdrop_projects table
```

**Cron schedule:**
```typescript
cron.schedule('*/30 * * * *', fetchNewsJob);     // Every 30 min
cron.schedule('0 */4 * * *', fetchAirdropJob);   // Every 4 hours
```

### Task 3: Modify `backend/src/crons/airdropRssHunter.cron.ts`

Add Telegram as an additional source alongside RSS:

```typescript
// Line ~30, after fetching RSS articles:
const rssArticles = await fetchAirdropRSSFeeds();
const telegramArticles = await fetchAirdropsFromTelegram(); // NEW
const articles = [...rssArticles, ...telegramArticles];     // Merge
```

### Task 4: Register cron in `backend/src/server.ts`

```typescript
import { startTelegramMonitorCron } from './crons/telegramMonitor.cron';
// In startCrons():
startTelegramMonitorCron();
```

### Important Notes for Telegram

1. **First-time setup requires manual login** — Run a one-time script to generate `TELEGRAM_SESSION_STRING` via phone + OTP. After that, the session persists.
2. **Rate limits** — Telegram limits to ~30 requests/minute for user clients. The 30-min cron interval is safe.
3. **Public channels ONLY** — Never attempt to read private channels.
4. **If Telegram credentials are missing** — The cron should log a warning and skip silently. The rest of the pipeline works without it.

---

## PART B: Z.ai Web Search Enrichment for Airdrops

### Problem

When the airdrop RSS/Telegram source provides only a short mention (e.g., "LayerZero airdrop confirmed"), the AI validation has very little context. The validation quality is poor because DeepSeek is guessing based on a title.

### Solution

Before calling `validateAirdropFromArticle()`, check if the article content is too short. If yes, use GLM Web Search to find more information about the project.

### Task 5: Create `backend/src/services/zhipuWebSearch.service.ts`

Uses the existing GLM gateway (`createGLMGateway()` from `ai-gateway.ts`) with the `web_search` tool:

```typescript
import { createGLMGateway } from './ai/ai-gateway';
import { env } from '../config/env';

interface WebSearchResult {
    title: string;
    url: string;
    content: string;
    source: string;
}

export async function searchWeb(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
    // Use GLM with web_search tool
    // GLM_BASE_URL should be https://open.bigmodel.cn/api/paas/v4 (NOT /coding/)
    // Model: glm-4-plus (stable for tool calling)
    //
    // API call pattern:
    // const response = await client.chat.completions.create({
    //     model: 'glm-4-plus',
    //     messages: [{ role: 'user', content: query }],
    //     tools: [{
    //         type: 'web_search',
    //         web_search: { enable: true }
    //     }],
    // });
    //
    // Parse web_search results from response
    // Return structured WebSearchResult[]
    // Timeout: 15 seconds
    // On failure: return empty array (never block pipeline)
}

export async function enrichAirdropContext(
    projectName: string,
    existingContent: string
): Promise<string> {
    // If existingContent is already >500 chars, skip — enough context
    if (existingContent.length > 500) return existingContent;

    const queries = [
        `${projectName} airdrop eligibility criteria tasks 2024 2025`,
        `${projectName} crypto project funding tokenomics`,
    ];

    const results: WebSearchResult[] = [];
    for (const q of queries) {
        const searchResults = await searchWeb(q, 3);
        results.push(...searchResults);
    }

    if (results.length === 0) return existingContent;

    // Build enriched context
    const enrichment = results
        .map(r => `[${r.source}]: ${r.content.slice(0, 400)}`)
        .join('\n\n');

    return `${existingContent}\n\n--- WEB RESEARCH (via Z.ai) ---\n${enrichment}`;
}
```

### Task 6: Modify `backend/src/crons/airdropRssHunter.cron.ts`

Add web search enrichment before AI validation (line ~59):

```typescript
// BEFORE (current):
const context = buildProjectContextFromArticle(article);
const validation = await validateAirdropFromArticle(context);

// AFTER (enriched):
let context = buildProjectContextFromArticle(article);
context = await enrichAirdropContext(article.title, context);  // NEW — Z.ai enrichment
const validation = await validateAirdropFromArticle(context);
```

### Task 7: Modify `backend/src/crons/airdropHunter.cron.ts` (routine sync)

Same enrichment for routine re-validation (line ~23):

```typescript
// BEFORE:
const raw = `Project: ${project.name}\nNetwork: ${project.network}...`;
const validation = await validateAirdrop(raw);

// AFTER:
let raw = `Project: ${project.name}\nNetwork: ${project.network}...`;
raw = await enrichAirdropContext(project.name, raw);  // NEW
const validation = await validateAirdrop(raw);
```

---

## ENV VARIABLES SUMMARY

| Variable | Value | Where to get |
|---|---|---|
| `TELEGRAM_API_ID` | Numeric ID | https://my.telegram.org → API Development Tools |
| `TELEGRAM_API_HASH` | Hex string | Same page |
| `TELEGRAM_SESSION_STRING` | Base64 string | Generated by one-time login script |
| `GLM_API_KEY` | ✅ Already exists | Already in `.env` |
| `GLM_BASE_URL` | ⚠️ May need adjustment | Change to `https://open.bigmodel.cn/api/paas/v4` for web search (remove `/coding/`) |

---

## NPM PACKAGE REQUIRED

```bash
npm install telegram
```

This is the `gramjs` wrapper for Node.js MTProto protocol.

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Start server without Telegram credentials | Cron logs warning, skips Telegram, RSS continues normally |
| 2 | Start server with Telegram credentials | Cron connects, reads channels, logs message counts |
| 3 | Telegram news message appears in `rawNewsBuffer` | `source = "telegram:WuBlockchain"`, triageEngine picks it up |
| 4 | Telegram airdrop message detected | Feeds into `validateAirdropFromArticle`, project inserted if valid |
| 5 | Short airdrop article (< 500 chars) triggers Z.ai search | Console logs `[ZhipuWebSearch] Enriched context for "ProjectName"` |
| 6 | Z.ai search fails/times out | Pipeline continues with original content (no crash) |
| 7 | Spam message from Telegram channel | Filtered out by spam patterns, never reaches buffer |

---

## FILES SUMMARY

| File | Status | Action |
|------|--------|--------|
| `backend/src/services/telegram.service.ts` | 🔴 TODO | New — Telegram MTProto client + channel reader |
| `backend/src/services/zhipuWebSearch.service.ts` | 🔴 TODO | New — GLM web search + airdrop enrichment |
| `backend/src/crons/telegramMonitor.cron.ts` | 🔴 TODO | New — Cron for news + airdrop channel monitoring |
| `backend/src/crons/airdropRssHunter.cron.ts` | 🔴 TODO | Add Telegram merge + Z.ai enrichment (2 lines) |
| `backend/src/crons/airdropHunter.cron.ts` | 🔴 TODO | Add Z.ai enrichment (1 line) |
| `backend/src/server.ts` | 🔴 TODO | Register telegramMonitor cron |
| `backend/src/config/env.ts` | 🔴 TODO | Add 3 Telegram env vars |
| `backend/.env` | 🔴 TODO | Add Telegram credentials |

---

*Phase 16 authored: April 24, 2026*  
*Data flow: Telegram Channels → rawNewsBuffer / airdropProjects (same pipeline)*  
*Enrichment flow: Short airdrop content → Z.ai Web Search → enriched context → AI validation*

---
---

# Phase 17 — Signal P&L Tracker (Proof of Concept)

**Status:** PLANNED  
**Date:** April 24, 2026  
**Priority:** P2 (Trust & Transparency Feature)  
**Scope:** 1 new table, 1 new cron, 1 new API endpoint, 1 new page, sidebar update  

---

## OBJECTIVE

Track the **profit and loss performance** of every signal OnlyAlpha publishes. For each coin that gets a signal (BUY/SELL/etc.), record the price at signal time, then snapshot the price at 24h, 7d, and 30d after. Display a public scorecard showing OnlyAlpha's track record.

**Why this matters:** No crypto intelligence platform shows you their hit rate. This is the ultimate trust builder — "Here's proof that our signals work."

---

## THE USER EXPERIENCE

### New Sidebar Item: "Scorecard" (icon: `leaderboard`)

```typescript
// In Sidebar.tsx NAV_ITEMS:
{ href: '/scorecard', icon: 'leaderboard', label: 'Scorecard', disabled: false }
```

### What the Page Shows

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 OnlyAlpha Signal Scorecard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL STATS
├── Total Signals: 127
├── Win Rate (7d): 64%
├── Avg Return (7d): +8.3%
└── Best Call: $SOL BUY at $142 → +34% (7d)

RECENT SIGNALS
┌──────┬────────┬──────────┬────────┬────────┬────────┐
│ Coin │ Verdict│ Entry $  │  24h   │   7d   │  30d   │
├──────┼────────┼──────────┼────────┼────────┼────────┤
│ BTC  │  BUY   │ $84,200  │ +2.1%  │ +7.4%  │  ...   │
│ ETH  │  BUY   │ $3,150   │ +1.8%  │ +5.2%  │  ...   │
│ SOL  │ S.BUY  │ $142     │ +5.3%  │ +34.1% │  ...   │
│ AVAX │  SELL  │ $38.50   │ -1.2%  │ -8.7%  │  ...   │
│ DOGE │  BUY   │ $0.165   │ -0.4%  │ -2.1%  │  ...   │
└──────┴────────┴──────────┴────────┴────────┴────────┘
  🟢 = profitable  🔴 = loss  ⚪ = pending

PER-COIN TRACK RECORD
BTC: 12 signals → 9 wins → 75% win rate → avg +6.2%
ETH: 8 signals  → 5 wins → 62% win rate → avg +4.1%
SOL: 6 signals  → 5 wins → 83% win rate → avg +12.3%

⚠️ Past performance does not guarantee future results. NFA.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## BACKEND IMPLEMENTATION

### Task 1: New Table — `signal_performance`

**File:** `backend/src/models/market.model.ts`

```typescript
export const signalPerformance = pgTable('signal_performance', {
    id: serial('id').primaryKey(),
    signalId: integer('signal_id').references(() => radarSignals.id).notNull(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    verdict: varchar('verdict', { length: 20 }).notNull(),        // STRONG_BUY, BUY, SELL, STRONG_SELL
    sentiment: varchar('sentiment', { length: 20 }),

    // Price at signal time
    entryPrice: real('entry_price').notNull(),
    entryAt: timestamp('entry_at').notNull(),

    // Price snapshots (filled by cron over time)
    price24h: real('price_24h'),
    price7d: real('price_7d'),
    price30d: real('price_30d'),

    // Calculated P&L (filled by cron)
    pnl24h: real('pnl_24h'),          // percentage change
    pnl7d: real('pnl_7d'),
    pnl30d: real('pnl_30d'),

    // Win/Loss determination
    isWin7d: boolean('is_win_7d'),     // true if direction matches P&L sign
    isWin30d: boolean('is_win_30d'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Win logic:**
- If verdict = BUY/STRONG_BUY → `isWin = pnl > 0`
- If verdict = SELL/STRONG_SELL → `isWin = pnl < 0` (shorting thesis was correct)

### Task 2: SQL Migration

```sql
CREATE TABLE IF NOT EXISTS signal_performance (
    id SERIAL PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES radar_signals(id),
    coin_symbol VARCHAR(20) NOT NULL,
    verdict VARCHAR(20) NOT NULL,
    sentiment VARCHAR(20),
    entry_price REAL NOT NULL,
    entry_at TIMESTAMP NOT NULL,
    price_24h REAL,
    price_7d REAL,
    price_30d REAL,
    pnl_24h REAL,
    pnl_7d REAL,
    pnl_30d REAL,
    is_win_7d BOOLEAN,
    is_win_30d BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signal_perf_symbol ON signal_performance(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_signal_perf_entry ON signal_performance(entry_at);
```

### Task 3: Record Entry Price at Signal Creation

**File:** `backend/src/crons/aiWorkflow.cron.ts`

After the radar signal insert (line ~462), add:

```typescript
// After: await db.insert(radarSignals).values({...}).onConflictDoNothing();
// Add:
if (actionableVerdicts.includes(analysisResult.verdict) && currentPrice > 0) {
    try {
        const [insertedSignal] = await db.select({ id: radarSignals.id })
            .from(radarSignals)
            .where(eq(radarSignals.coinSymbol, symbol))
            .orderBy(desc(radarSignals.createdAt))
            .limit(1);

        if (insertedSignal) {
            await db.insert(signalPerformance).values({
                signalId: insertedSignal.id,
                coinSymbol: symbol,
                verdict: analysisResult.verdict,
                sentiment: analysisResult.sentiment,
                entryPrice: currentPrice,
                entryAt: new Date(),
            });
        }
    } catch (perfErr) {
        console.error(`[AI Workflow] Failed to record signal performance for ${symbol}:`, perfErr);
    }
}
```

### Task 4: Create P&L Snapshot Cron

**File:** `backend/src/crons/signalPerformance.cron.ts`

Runs every 6 hours. Fills in price snapshots for signals that have matured:

```typescript
import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, isNull, lte, and, sql } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';

async function updateSignalPerformance(): Promise<void> {
    const now = new Date();

    // 1. Fill 24h snapshots (signals older than 24h with no price_24h)
    const need24h = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price24h),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '24 hours'`)
        ))
        .limit(50);

    for (const row of need24h) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        await db.update(signalPerformance).set({
            price24h: priceResult.price,
            pnl24h: pnl,
        }).where(eq(signalPerformance.id, row.id));
    }

    // 2. Fill 7d snapshots
    const need7d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price7d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '7 days'`)
        ))
        .limit(50);

    for (const row of need7d) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
        const isWin = isBullish ? pnl > 0 : pnl < 0;
        await db.update(signalPerformance).set({
            price7d: priceResult.price,
            pnl7d: pnl,
            isWin7d: isWin,
        }).where(eq(signalPerformance.id, row.id));
    }

    // 3. Fill 30d snapshots
    const need30d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price30d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '30 days'`)
        ))
        .limit(50);

    for (const row of need30d) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
        const isWin = isBullish ? pnl > 0 : pnl < 0;
        await db.update(signalPerformance).set({
            price30d: priceResult.price,
            pnl30d: pnl,
            isWin30d: isWin,
        }).where(eq(signalPerformance.id, row.id));
    }

    console.log(`[SignalPerf] Updated: ${need24h.length} (24h), ${need7d.length} (7d), ${need30d.length} (30d)`);
}

export function startSignalPerformanceCron(): void {
    cron.schedule('0 */6 * * *', updateSignalPerformance);
    console.log('[SignalPerf] Cron scheduled — every 6 hours');
}
```

### Task 5: API Endpoint

**File:** `backend/src/controllers/market.controller.ts` (or new controller)

```typescript
// GET /api/scorecard
// Returns: overall stats + recent signals with P&L + per-coin breakdown

export async function getScorecardHandler(req: Request, res: Response) {
    // 1. Get all signal performances
    const signals = await db.select()
        .from(signalPerformance)
        .orderBy(desc(signalPerformance.entryAt))
        .limit(100);

    // 2. Calculate overall stats
    const withPnl7d = signals.filter(s => s.pnl7d !== null);
    const wins7d = withPnl7d.filter(s => s.isWin7d === true);
    const totalSignals = signals.length;
    const winRate7d = withPnl7d.length > 0
        ? Math.round((wins7d.length / withPnl7d.length) * 100) : null;
    const avgReturn7d = withPnl7d.length > 0
        ? withPnl7d.reduce((sum, s) => sum + (s.pnl7d ?? 0), 0) / withPnl7d.length : null;

    // 3. Per-coin breakdown
    const coinMap = new Map<string, { signals: number; wins: number; totalPnl: number }>();
    for (const s of withPnl7d) {
        const existing = coinMap.get(s.coinSymbol) ?? { signals: 0, wins: 0, totalPnl: 0 };
        existing.signals++;
        if (s.isWin7d) existing.wins++;
        existing.totalPnl += s.pnl7d ?? 0;
        coinMap.set(s.coinSymbol, existing);
    }

    // 4. Best call
    const bestCall = withPnl7d.reduce((best, s) =>
        (s.pnl7d ?? 0) > (best?.pnl7d ?? -Infinity) ? s : best, withPnl7d[0] ?? null);

    res.json({
        overall: { totalSignals, winRate7d, avgReturn7d: avgReturn7d?.toFixed(1), bestCall },
        recent: signals.slice(0, 20),
        perCoin: Object.fromEntries(coinMap),
    });
}
```

**Route:** `router.get('/scorecard', getScorecardHandler);`

---

## FRONTEND IMPLEMENTATION

### Task 6: Add Sidebar Item

**File:** `frontend/src/features/shared/components/Sidebar.tsx` — Line 9

```typescript
// Add to NAV_ITEMS array:
{ href: '/scorecard', icon: 'leaderboard', label: 'Scorecard', disabled: false }
```

### Task 7: Create Scorecard Page

**File:** `frontend/src/app/scorecard/page.tsx` (server component)

```typescript
// Fetches /api/scorecard server-side
// Passes data to ScorecardPageClient
```

### Task 8: Create Scorecard Client Component

**File:** `frontend/src/features/scorecard/components/ScorecardPageClient.tsx`

Three sections:
1. **Overall Stats Bar** — Total signals, win rate %, avg return %, best call
2. **Recent Signals Table** — Coin, verdict, entry $, 24h %, 7d %, 30d % (color-coded green/red)
3. **Per-Coin Breakdown** — Mini cards per coin showing signal count, win rate, avg return

**Design notes:**
- Use the same dark theme as the rest of OnlyAlpha (black bg, `--color-primary` accents)
- Green for profits, red for losses, gray for pending (no data yet)
- NFA disclaimer at the bottom: "Past performance does not guarantee future results. Not financial advice."

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | New signal published for BTC | Row inserted in `signal_performance` with `entry_price` and `entry_at` |
| 2 | Wait 24h+ then run cron | `price_24h` and `pnl_24h` filled for that signal |
| 3 | Visit `/scorecard` page | Overall stats + recent signals table rendered |
| 4 | BUY signal where price went up | Shows green `+X.X%`, `isWin7d = true` |
| 5 | SELL signal where price went up | Shows red `+X.X%`, `isWin7d = false` (sell thesis was wrong) |
| 6 | Sidebar shows "Scorecard" icon | Clickable, navigates to `/scorecard` |
| 7 | NFA disclaimer visible | At bottom of scorecard page |

---

## FILES SUMMARY

| File | Status | Action |
|------|--------|--------|
| `backend/src/models/market.model.ts` | 🔴 TODO | Add `signalPerformance` table |
| `backend/scripts/migrate-signal-performance.sql` | 🔴 TODO | Create migration script |
| `backend/src/crons/aiWorkflow.cron.ts` | 🔴 TODO | Record entry price at signal creation (after line ~462) |
| `backend/src/crons/signalPerformance.cron.ts` | 🔴 TODO | New — P&L snapshot cron (every 6h) |
| `backend/src/controllers/market.controller.ts` | 🔴 TODO | Add `getScorecardHandler` |
| `backend/src/routes/index.ts` | 🔴 TODO | Register `/scorecard` route |
| `backend/src/server.ts` | 🔴 TODO | Register signalPerformance cron |
| `frontend/src/features/shared/components/Sidebar.tsx` | 🔴 TODO | Add Scorecard nav item (line 9) |
| `frontend/src/app/scorecard/page.tsx` | 🔴 TODO | New — Server component page |
| `frontend/src/features/scorecard/components/ScorecardPageClient.tsx` | 🔴 TODO | New — Scorecard UI |

---

*Phase 17 authored: April 24, 2026*  
*Signal flow: radarSignals insert → signalPerformance record (entry price) → cron fills 24h/7d/30d P&L → scorecard API → frontend*


---
---

# Phase 19 — Google AdSense Readiness & Legal Compliance

**Status:** PLANNED  
**Date:** April 25, 2026  
**Priority:** P1 (Monetization Blocker)  
**Scope:** 5 new static pages, 1 UI component, routing updates

## OBJECTIVE

To get OnlyAlpha approved for Google AdSense monetization, the platform must meet Google's strict publisher guidelines. Currently, the site acts as an intelligence dashboard but lacks the required legal, compliance, and structural pages that AdSense manual reviewers look for to verify legitimacy and user safety. 

Because the site uses AI to aggregate and rewrite news/signals, having explicit disclaimers and policy pages is non-negotiable.

## REQUIRED TASKS

### 1. Mandatory Static Pages
Create the following static routes in the Next.js frontend (`frontend/src/app/...`):
- `/privacy-policy` (سياسة الخصوصية): Explaining data collection, third-party cookies (AdSense), and analytics.
- `/terms` (الشروط والأحكام): User agreements, IP rights.
- `/about` (من نحن): Explaining what OnlyAlpha is, how the AI pipeline works, and establishing "E-E-A-T" (Experience, Expertise, Authoritativeness, and Trustworthiness).
- `/contact` (اتصل بنا): A form or email address for users to reach out.
- `/disclaimer` (إخلاء المسؤولية): **CRITICAL**. A comprehensive "Not Financial Advice" (NFA) disclaimer explaining that signals are automated intelligence, not investment advice.

### 2. Cookie Consent Banner (GDPR/CCPA)
- Create a global `CookieBanner` component that appears for all new users.
- It must explicitly mention that third-party vendors (Google) use cookies to serve ads based on prior visits.
- Requires "Accept" and "Decline" states.

### 3. Clear Navigation (Footer)
- Create a `Footer` component (or update existing) to house links to all the legal pages.
- AdSense reviewers look for these links at the bottom of the page.

### 4. NFA Warning Visibility
- Ensure the "Not Financial Advice" label is explicitly visible on the `/scorecard` and individual article pages, not just buried in text.

### 5. AdSense Script Injection Placeholder
- Add the Google AdSense script tag to `frontend/src/app/layout.tsx` (can be commented out or conditional based on `NEXT_PUBLIC_ADSENSE_ID`) so the `<head>` is ready for the verification process.

## FILES AFFECTED
- `frontend/src/app/privacy-policy/page.tsx` (NEW)
- `frontend/src/app/terms/page.tsx` (NEW)
- `frontend/src/app/about/page.tsx` (NEW)
- `frontend/src/app/contact/page.tsx` (NEW)
- `frontend/src/app/disclaimer/page.tsx` (NEW)
- `frontend/src/features/shared/components/CookieBanner.tsx` (NEW)
- `frontend/src/features/shared/components/Footer.tsx` (NEW/UPDATE)
- `frontend/src/app/layout.tsx` (UPDATE)
