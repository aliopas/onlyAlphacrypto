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
