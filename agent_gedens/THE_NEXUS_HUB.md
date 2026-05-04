# Phase 2 — Full Event Impact Engine

**Status:** ✅ COMPLETE — Code committed (4ae0af4), QA PASSED WITH NOTES (68/68)
**Date:** May 4, 2026
**Priority:** P1 (Transforms passive data collection into active intelligence engine)
**Scope:** 1 new service, 1 new API endpoint, 2 modified files (prompts + workflow), 1 new env flag, 1 optional migration, 1 documentation update, 1 QA checklist
**Prerequisites:** Phase 6A (complete) + Phase 6B (complete) + Phase 1 (complete)
**Authorized By:** Strategic Planner — May 4, 2026
**Commit:** `4ae0af4 feat: add Phase 2 event impact stats engine behind feature flag`
**QA Result:** 68/68 PASS — APPROVE WITH NOTES
**Notes:**
- Classification confidence function exists but not fully wired into workflow; documented TODO, acceptable.
- Minor duplicate `eventScope` computation in aiWorkflow.cron.ts (lines 241, 703); different scopes, harmless — documented for future cleanup.
- Runtime stats injection disabled by feature flag (`EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` defaults `false`).
- Do not enable flag until DB coverage/performance check.

## OBJECTIVE

Transform Event Impact from passive data collection into an **active intelligence engine** that provides:

1. **Historical event comparison** — When a new event happens, find similar past events and return their statistical outcomes from `event_impact_outcomes`
2. **Event impact statistics API** — Internal/admin endpoint to query impact stats from the new tables
3. **Extended event taxonomy** — Add macro, personality, whale event types to classification prompts
4. **AI workflow stats integration** — Inject real historical stats into AI analysis prompts (behind a flag)
5. **Classification confidence scoring** — Add a confidence score (0-1) to event classification output

## ARCHITECTURE OVERVIEW

```
event_impacts + event_impact_outcomes (Phase 6B tables, growing dataset)
          │
          ├──► historicalEventComparison.service.ts (NEW — T-2.1)
          │       ├── Queries similar past events by eventType, coinSymbol, eventSeverity
          │       ├── Returns statistical summary from real outcomes data
          │       └── Used by: AI workflow stats injection + admin API
          │
          ├──► Event Impact Stats API (NEW — T-2.2)
          │       ├── GET /api/market/event-impact-stats (authMiddleware protected)
          │       ├── Query params: eventType, coinSymbol, horizon, eventSeverity
          │       └── Read-only from event_impacts + event_impact_outcomes
          │
          └──► AI Workflow Integration (MODIFY — T-2.4)
                  ├── Before DeepSeek analysis, query historicalEventComparison
                  ├── Format stats as prompt context via prompt-factory
                  ├── AI explains DB stats, does NOT invent history
                  └── Behind EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED=false flag
```

## PHASE 2 SCOPE LIMITATIONS

**Allowed:**
- Create `historicalEventComparison.service.ts` (new file)
- Create event impact stats API endpoint (new handler + route)
- Extend event taxonomy in `prompt-factory.ts` (modify existing)
- Extend `TRIGGER_TYPE_MAP` + `selectTone()` in `aiWorkflow.cron.ts` (modify existing)
- Integrate stats into AI workflow in `aiWorkflow.cron.ts` (modify existing, behind flag)
- Add `buildHistoricalEventContext()` to `prompt-factory.ts` (new function, behind flag)
- Add classification confidence output to `openai.service.ts` triage result
- Optional: ALTER TABLE for `classification_confidence` column on `event_impacts`
- Add 1 new env flag: `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED`

**Forbidden:**
- Modify `coin_news_history` schema
- Modify Living Articles rendering logic
- Modify public-facing UI components
- Modify scorecard system
- Add new paid external APIs
- Use prediction/forecasting language in outputs
- Modify `eventImpactAnalysis.service.ts` (Phase 6A, untouched)
- Modify `eventImpactPersistence.service.ts` (Phase 6B, untouched)
- Commit or push before QA PASS

## IMPORTANT DESIGN PRINCIPLES

1. **AI must explain database stats, not invent history.** All historical context injected into prompts MUST come from real `event_impact_outcomes` rows.
2. **Historical context must come from real data.** No fabricated statistics. If no data exists, the prompt must say "No historical data available for this event type."
3. **Insufficient data guard.** If sample size < 5 for a comparison query, the system MUST return "insufficient_data" status instead of unreliable statistics.
4. **All public-facing language must be policy-safe.** Use terms from Phase 6A T-6A.5 (historical observed movement, historical pattern, etc.). Never use buy/sell/take profit/stop loss.
5. **Stats injection is optional and behind a flag.** `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` defaults to `false`. When disabled, the AI workflow behaves exactly as before Phase 2.
6. **Backward compatibility mandatory.** Existing triage/classification must still work with old event types. New types extend the taxonomy, not replace it.

## EXECUTION ORDER

```
T-2.6 (env flag) ─────────────────────────┐
                                             ├── T-2.1 (comparison service) ──┐
                                             │                                 ├── T-2.2 (API endpoint)
T-2.3 (taxonomy in prompts + workflow) ─────┤                                 │
                                             │                                 ├── T-2.4 (AI stats injection)
                                             │                                 │
                                             └─────────────────────────────────┘
                                                                       │
                                                                       ├── T-2.5 (confidence field)
                                                                       │
                                                                       ├── T-2.7 (docs update)
                                                                       └── T-2.8 (QA checklist)
```

T-2.6 and T-2.3 can run in parallel (independent).
T-2.1 depends on nothing new (reads existing tables).
T-2.2 depends on T-2.1 (uses the comparison service).
T-2.4 depends on T-2.1 + T-2.3 + T-2.6.
T-2.5 is independent (can run in parallel with T-2.4).
T-2.7 and T-2.8 after all code tasks.

---

## REQUIRED TASKS

### T-2.1 — Historical Event Comparison Service

**Task ID:** T-2.1
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create `backend/src/services/historicalEventComparison.service.ts` — a service that, given a new event (eventType, coinSymbol, eventSeverity), queries `event_impacts` + `event_impact_outcomes` to find similar past events and returns statistical summaries of their real outcomes.

**Files to inspect:**
- `backend/src/models/market.model.ts` — `eventImpacts` table (lines 464-484) and `eventImpactOutcomes` table (lines 487-510)
- `backend/src/services/eventImpactAnalysis.service.ts` — reference for calculation patterns (calculateMedian, calculateRates)
- `backend/src/services/eventImpactPersistence.service.ts` — reference for Drizzle query patterns and types

**Files allowed to create:**
- `backend/src/services/historicalEventComparison.service.ts` (new file)

**Forbidden files:**
- Any existing service files (read-only reference only)
- Any cron files
- Any controller/route files
- Any model files

**Constraints:**
- ZERO `any` types
- Read-only queries from `event_impacts` and `event_impact_outcomes` only
- No external API calls
- No AI calls
- Insufficient data guard: return `insufficient_data` if sample size < 5
- Must use `event_impact_outcomes.status = 'completed'` to filter only verified outcomes

**Design specification:**

1. **Input interface:**
```typescript
interface HistoricalComparisonInput {
    eventType: string;           // e.g. 'Hack', 'ETF', 'Regulatory'
    coinSymbol?: string;         // optional — filter to same coin
    eventSeverity?: number;      // optional — filter to same severity (±1 range)
    horizon?: string;            // optional — specific horizon ('1h','4h','24h','3d','7d')
    maxResults?: number;         // default 50
}
```

2. **Output interface:**
```typescript
interface HistoricalComparisonResult {
    status: 'success' | 'insufficient_data' | 'no_data';
    sampleSize: number;
    filters: {
        eventType: string;
        coinSymbol: string | null;
        eventSeverityRange: [number | null, number | null];
    };
    summary: {
        totalEvents: number;
        distinctCoins: number;
        dateRange: { earliest: string | null; latest: string | null };
    } | null;
    horizonStats: {
        horizon: string;
        sampleSize: number;
        medianChange: number | null;
        avgChange: number | null;
        positiveRate: number | null;
        negativeRate: number | null;
        avgMaxUpside: number | null;
        avgMaxDrawdown: number | null;
        avgTimeToPeak: number | null;
        avgTimeToBottom: number | null;
    }[] | null;
    severityBreakdown: {
        severity: number;
        count: number;
        medianChange24h: number | null;
    }[] | null;
    topCoins: {
        coinSymbol: string;
        count: number;
        medianChange24h: number | null;
    }[] | null;
    contextString: string | null;
}
```

3. **Core query logic:**
```typescript
// Step 1: Find similar event_impacts (same eventType, optionally same coin)
// Step 2: JOIN with event_impact_outcomes WHERE status='completed'
// Step 3: Group by horizon, calculate stats
// Step 4: If sampleSize < 5, return insufficient_data
// Step 5: Generate a human-readable contextString for prompt injection
```

4. **Context string format (for prompt injection in T-2.4):**
```
"Historical context for {eventType} events ({sampleSize} similar events found):
- Median 24h price movement: {medianChange24h}%
- Positive outcome rate (24h): {positiveRate24h}%
- Average max upside (24h): {avgMaxUpside24h}%
- Average max drawdown (24h): {avgMaxDrawdown24h}%
- Most affected coins: {topCoins}
Data sourced from OnlyAlpha event impact database. Not financial advice."
```

5. **Exported functions:**
- `compareWithHistoricalEvents(input: HistoricalComparisonInput): Promise<HistoricalComparisonResult>`
- `buildHistoricalContextString(input: HistoricalComparisonInput): Promise<string>` — convenience wrapper that returns just the contextString

**Step-by-step instructions for Senior Developer:**

1. Create `backend/src/services/historicalEventComparison.service.ts`
2. Import: db, Drizzle operators (eq, and, lte, gte, sql, desc, asc), eventImpacts, eventImpactOutcomes from models
3. Define input/output TypeScript interfaces (zero `any`)
4. Reuse `calculateMedian()` pattern from eventImpactAnalysis.service.ts (copy the helper function — do NOT import from it to keep files independent)
5. Implement `compareWithHistoricalEvents()`:
   a. Build WHERE clause: `eventType` match, optional `coinSymbol` match, optional `eventSeverity` range (±1)
   b. Query `event_impacts` with LEFT JOIN to `event_impact_outcomes`
   c. Filter outcomes to `status = 'completed'` only
   d. Group by horizon, calculate stats per horizon
   e. Calculate severity breakdown and top coins
   f. If sampleSize < 5, return `status: 'insufficient_data'`
   g. If no rows, return `status: 'no_data'`
   h. Generate `contextString` from calculated stats
6. Implement `buildHistoricalContextString()` as convenience wrapper
7. Export both functions + all interfaces

**Acceptance criteria:**
- Service compiles with zero `any` types
- Queries only `event_impacts` + `event_impact_outcomes` (no other tables)
- Returns `insufficient_data` when sample size < 5
- Returns `no_data` when zero matching events
- Context string is policy-safe (no buy/sell/prediction language)
- `tsc --noEmit` clean

**QA checklist:**
- [ ] File created at correct path
- [ ] Zero `any` types
- [ ] Input interface with all fields (eventType required, others optional)
- [ ] Output interface with status field ('success'|'insufficient_data'|'no_data')
- [ ] Query uses event_impacts + event_impact_outcomes (no other tables)
- [ ] WHERE: eventType match, optional coinSymbol, optional eventSeverity ±1 range
- [ ] JOIN: outcomes filtered to status='completed'
- [ ] Sample size < 5 returns insufficient_data
- [ ] Zero results returns no_data
- [ ] Per-horizon stats: median, avg, positive/negative rate, max upside/drawdown, time to peak/bottom
- [ ] Severity breakdown calculated
- [ ] Top coins breakdown calculated
- [ ] contextString generated in policy-safe format
- [ ] NFA disclaimer in context string
- [ ] buildHistoricalContextString convenience wrapper exported
- [ ] No external API calls
- [ ] No AI calls
- [ ] `tsc --noEmit` clean

**Dependencies:** None (reads existing tables only)

**Rollback notes:**
- Delete `backend/src/services/historicalEventComparison.service.ts`

---

### T-2.2 — Event Impact Stats API Endpoint

**Task ID:** T-2.2
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create an internal/admin API endpoint for querying event impact statistics. Read-only from `event_impacts` and `event_impact_outcomes`. Protected by `authMiddleware`.

**Files to inspect:**
- `backend/src/controllers/market.controller.ts` — reference for controller pattern, existing endpoints
- `backend/src/routes/market.routes.ts` — route registration pattern (line 25 for authMiddleware usage)
- `backend/src/services/historicalEventComparison.service.ts` (from T-2.1) — the service this endpoint wraps

**Files allowed to modify:**
- `backend/src/controllers/market.controller.ts` (add new handler)
- `backend/src/routes/market.routes.ts` (add new route)

**Forbidden files:**
- Any service files
- Any cron files
- Any frontend files

**Constraints:**
- Read-only endpoint (GET only)
- Protected by `authMiddleware` (not public)
- Uses `historicalEventComparison.service.ts` (from T-2.1) for data
- Input validation on query params
- Rate limited via existing `apiLimiter` pattern

**Design specification:**

1. **Endpoint:** `GET /api/market/event-impact-stats`

2. **Query parameters:**
   - `eventType` (required) — e.g. `Hack`, `ETF`, `Regulatory`
   - `coinSymbol` (optional) — e.g. `BTC`, `ETH`
   - `eventSeverity` (optional) — integer 1-5
   - `horizon` (optional) — `1h`, `4h`, `24h`, `3d`, `7d`

3. **Handler pattern (following existing market.controller.ts style):**
```typescript
export async function getEventImpactStatsHandler(req: Request, res: Response): Promise<void> {
    // 1. Validate required params (eventType)
    // 2. Build HistoricalComparisonInput from query params
    // 3. Call compareWithHistoricalEvents(input)
    // 4. Return JSON response with proper status codes
    // 5. Handle errors with proper error responses
}
```

4. **Route registration (in market.routes.ts):**
```typescript
router.get('/event-impact-stats', authMiddleware, getEventImpactStatsHandler);
```

**Step-by-step instructions for Senior Developer:**

1. Open `backend/src/controllers/market.controller.ts`
2. Add import for `compareWithHistoricalEvents` from `../services/historicalEventComparison.service`
3. Implement `getEventImpactStatsHandler`:
   a. Extract query params: eventType (required), coinSymbol, eventSeverity, horizon
   b. Validate eventType is non-empty string — return 400 if missing
   c. Parse eventSeverity as integer if provided (return 400 if invalid)
   d. Validate horizon against allowed values if provided
   e. Call `compareWithHistoricalEvents({ eventType, coinSymbol, eventSeverity, horizon })`
   f. Return `res.json(result)` with 200 status
   g. Wrap in try/catch — return 500 on error
4. Open `backend/src/routes/market.routes.ts`
5. Add import for `getEventImpactStatsHandler` from market.controller
6. Add route: `router.get('/event-impact-stats', authMiddleware, getEventImpactStatsHandler);`
7. Verify `tsc --noEmit` clean

**Acceptance criteria:**
- GET /api/market/event-impact-stats?eventType=Hack returns 200 with stats
- Missing eventType returns 400
- Invalid eventSeverity returns 400
- Invalid horizon returns 400
- AuthMiddleware protects the endpoint
- `tsc --noEmit` clean

**QA checklist:**
- [ ] Handler added to market.controller.ts
- [ ] Route added to market.routes.ts with authMiddleware
- [ ] eventType validation (required, non-empty string)
- [ ] eventSeverity validation (optional, integer 1-5)
- [ ] horizon validation (optional, one of 1h/4h/24h/3d/7d)
- [ ] coinSymbol passed through (optional)
- [ ] 400 on missing eventType
- [ ] 400 on invalid eventSeverity
- [ ] 400 on invalid horizon
- [ ] 200 on valid request with stats data
- [ ] 500 on unexpected error
- [ ] authMiddleware applied
- [ ] Uses historicalEventComparison.service.ts (not direct DB queries)
- [ ] No `any` types
- [ ] `tsc --noEmit` clean

**Dependencies:** T-2.1 (comparison service must exist)

**Rollback notes:**
- Remove handler from market.controller.ts
- Remove route from market.routes.ts

---

### T-2.3 — Extended Event Taxonomy

**Task ID:** T-2.3
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Extend the event classification taxonomy in `prompt-factory.ts` and `aiWorkflow.cron.ts` to support macro, personality, whale, and on-chain event types. Must be backward compatible with existing types.

**Files to inspect:**
- `backend/src/services/ai/prompt-factory.ts` — triage prompt (line 109) and deep analysis prompt (line 277)
- `backend/src/crons/aiWorkflow.cron.ts` — TRIGGER_TYPE_MAP (lines 38-48) and selectTone() (lines 54-75)
- `backend/src/services/openai.service.ts` — TriageResult interface (lines 237-246)

**Files allowed to modify:**
- `backend/src/services/ai/prompt-factory.ts` (extend event type list in prompts)
- `backend/src/crons/aiWorkflow.cron.ts` (extend TRIGGER_TYPE_MAP and selectTone)

**Forbidden files:**
- `openai.service.ts` (TriageResult interface change is T-2.5 scope)
- Any model files
- Any controller/route files
- Any frontend files

**Constraints:**
- BACKWARD COMPATIBLE: all existing types (ETF, Hack, Exploit, Listing, Delisting, Upgrade, TokenLaunch, Regulatory, Funding, Partnership, Other) must remain valid
- New types added to the END of the list (existing AI outputs still parse correctly)
- Both triage prompt AND deep analysis prompt must be updated (currently out of sync — triage has Exploit/Delisting/TokenLaunch, deep analysis does not)
- TRIGGER_TYPE_MAP must cover all new types
- selectTone() must handle all new types

**New event types to add:**

| Category | New Type | Description | TRIGGER_TYPE_MAP Value | Tone |
|---|---|---|---|---|
| Macro | Fed_Rate | Federal Reserve rate decisions | macro | cautious |
| Macro | CPI | CPI/inflation data releases | macro | analytical |
| Macro | Geopolitical | Wars, elections, sanctions | macro | cautious |
| Personality | Influencer_Statement | Elon Musk, CZ, Vitalik tweets/statements | personality | exciting |
| Corporate | Executive_Change | CEO resignation, team departure | corporate | analytical |
| Whale | Large_Transfer | Significant whale wallet movements | whale | analytical |
| Protocol | Token_Unlock | Token unlock/vesting events | protocol | analytical |
| Exchange | Exchange_Netflow | Exchange inflow/outflow anomalies | whale | analytical |

**Current event type list (triage, line 109):**
```
ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other
```

**Current event type list (deep analysis, line 277):**
```
ETF|Hack|Listing|Upgrade|Partnership|Funding|Regulatory|Other
```

**New event type list (both prompts, synchronized):**
```
ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Fed_Rate|CPI|Geopolitical|Influencer_Statement|Executive_Change|Large_Transfer|Token_Unlock|Exchange_Netflow|Other
```

**Updated TRIGGER_TYPE_MAP:**
```typescript
const TRIGGER_TYPE_MAP: Record<string, string> = {
    // Existing
    'Hack': 'security',
    'Exploit': 'security',
    'ETF': 'regulation',
    'Regulatory': 'regulation',
    'Listing': 'market',
    'Delisting': 'market',
    'Funding': 'whale',
    'Partnership': 'news',
    'Upgrade': 'technical',
    'TokenLaunch': 'market',
    // New
    'Fed_Rate': 'macro',
    'CPI': 'macro',
    'Geopolitical': 'macro',
    'Influencer_Statement': 'personality',
    'Executive_Change': 'corporate',
    'Large_Transfer': 'whale',
    'Token_Unlock': 'protocol',
    'Exchange_Netflow': 'whale',
};
```

**Updated selectTone() additions:**
```typescript
// Add these cases before the default:
'Fed_Rate': 'cautious',
'CPI': 'analytical',
'Geopolitical': 'cautious',
'Influencer_Statement': 'exciting',
'Executive_Change': 'analytical',
'Large_Transfer': 'analytical',
'Token_Unlock': 'analytical',
'Exchange_Netflow': 'analytical',
```

**Step-by-step instructions for Senior Developer:**

1. Open `backend/src/services/ai/prompt-factory.ts`
2. At line 109 (triage prompt): Replace the eventType enum with the full synchronized list
3. At line 277 (deep analysis prompt): Replace the eventType enum with the full synchronized list (also fixes the existing out-of-sync bug — adds back Exploit, Delisting, TokenLaunch)
4. Open `backend/src/crons/aiWorkflow.cron.ts`
5. At lines 38-48 (TRIGGER_TYPE_MAP): Add all 8 new type mappings
6. At lines 54-75 (selectTone): Add all 8 new type tone mappings
7. Verify `tsc --noEmit` clean
8. Verify both prompts now have IDENTICAL event type lists

**Acceptance criteria:**
- Both prompts have identical event type lists (18 types)
- New types: Fed_Rate, CPI, Geopolitical, Influencer_Statement, Executive_Change, Large_Transfer, Token_Unlock, Exchange_Netflow
- All existing types preserved
- TRIGGER_TYPE_MAP covers all 18 types
- selectTone() handles all 18 types (17 explicit + default)
- Deep analysis prompt now includes Exploit, Delisting, TokenLaunch (bug fix)
- `tsc --noEmit` clean

**QA checklist:**
- [ ] Triage prompt eventType list has all 18 types
- [ ] Deep analysis prompt eventType list has all 18 types
- [ ] Both lists are IDENTICAL (synchronized)
- [ ] Existing 11 types preserved: ETF, Hack, Exploit, Listing, Delisting, Upgrade, TokenLaunch, Regulatory, Funding, Partnership, Other
- [ ] New 8 types added: Fed_Rate, CPI, Geopolitical, Influencer_Statement, Executive_Change, Large_Transfer, Token_Unlock, Exchange_Netflow
- [ ] Deep analysis prompt bug fixed (now includes Exploit, Delisting, TokenLaunch)
- [ ] TRIGGER_TYPE_MAP has all 18 entries
- [ ] selectTone() has all 18 cases (17 explicit + default)
- [ ] No `any` types introduced
- [ ] `tsc --noEmit` clean
- [ ] No other lines modified in prompt-factory.ts
- [ ] No other lines modified in aiWorkflow.cron.ts

**Dependencies:** None

**Rollback notes:**
- Revert eventType lists to original values in both prompts
- Revert TRIGGER_TYPE_MAP to original 10 entries
- Revert selectTone() to original cases

---

### T-2.4 — AI Workflow Stats Integration

**Task ID:** T-2.4
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Integrate real historical event stats into the AI workflow. Before generating DeepSeek analysis, query `historicalEventComparison.service.ts` and inject the context string into the analysis prompt. Entirely behind `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` flag (default false).

**Files to inspect:**
- `backend/src/crons/aiWorkflow.cron.ts` — lines 216-229 (existing historicalStats injection), lines 345-353 (callDeepSeekAnalysis call), lines 233-294 (full analysis section)
- `backend/src/services/ai/prompt-factory.ts` — `buildDeepAnalysisMessages()` (line 264), `buildHistoricalStatsContext()` (line 338)
- `backend/src/services/openai.service.ts` — `callDeepSeekAnalysis()` signature
- `backend/src/services/historicalEventComparison.service.ts` (from T-2.1) — `buildHistoricalContextString()`

**Files allowed to modify:**
- `backend/src/crons/aiWorkflow.cron.ts` (add stats query + injection)
- `backend/src/services/ai/prompt-factory.ts` (add `buildEventImpactContext()` function)

**Forbidden files:**
- `openai.service.ts` (no changes to analysis function signature)
- Any model files
- Any controller/route files
- Any frontend files

**Constraints:**
- Entirely behind `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` flag (default false)
- When flag is false: ZERO behavioral change to existing workflow
- Stats come ONLY from `event_impact_outcomes` via the comparison service
- If comparison returns `insufficient_data` or `no_data`, do NOT inject empty context — skip injection entirely
- The injected context must include NFA disclaimer
- The AI explains stats, does not invent them
- No changes to `callDeepSeekAnalysis()` function signature

**Design specification:**

1. **New function in prompt-factory.ts:**
```typescript
export function buildEventImpactContext(contextString: string): string {
    return `
## Historical Event Impact Data (from OnlyAlpha Database)
The following statistics are from real historical events in our database.
Use this data to inform your analysis. Explain these statistics to the reader.
Do NOT invent additional historical data beyond what is provided.

${contextString}

Remember: This is historical context, not a prediction. Past events do not guarantee future outcomes. Not financial advice.
`;
}
```

2. **Integration in aiWorkflow.cron.ts (after existing historicalStats at lines 216-229):**
```typescript
// After existing historicalStats block, before callDeepSeekAnalysis:

let eventImpactContext: string | undefined;

if (env.EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED) {
    try {
        const comparisonResult = await compareWithHistoricalEvents({
            eventType,
            coinSymbol: symbol,
            horizon: '24h',
        });

        if (comparisonResult.status === 'success' && comparisonResult.contextString) {
            eventImpactContext = PromptFactory.buildEventImpactContext(comparisonResult.contextString);
            console.log(`[AI Workflow] Event impact stats injected for ${symbol} — ${eventType}`);
        } else {
            console.log(`[AI Workflow] Event impact stats skipped for ${symbol} — ${comparisonResult.status}`);
        }
    } catch (statsErr) {
        console.error(`[AI Workflow] Failed to fetch event impact stats for ${symbol}:`, statsErr instanceof Error ? statsErr.message : String(statsErr));
    }
}
```

3. **Pass eventImpactContext to the analysis prompt:**
The context should be appended to the user message in `buildDeepAnalysisMessages()`. Since we cannot modify `callDeepSeekAnalysis()` signature, we need to append the context to an existing field or pass it through the prompt builder.

**Approach:** Add an optional `eventImpactContext?: string` parameter to `buildDeepAnalysisMessages()` in prompt-factory.ts, and append it to the user message. Then in aiWorkflow.cron.ts, pass it through.

4. **Changes to openai.service.ts:** The `callDeepSeekAnalysis()` function already accepts a `historicalStats` parameter. We can repurpose this pattern: check if there's an existing mechanism to pass additional context. If `DeepAnalysisInput` has optional fields we can use, add `eventImpactContext` there. Otherwise, concatenate it with `historicalStats`.

**IMPORTANT:** Inspect `DeepAnalysisInput` interface in `openai.service.ts` and `buildDeepAnalysisMessages()` to determine the cleanest injection point. The goal is minimal changes — ideally appending to the user message.

**Step-by-step instructions for Senior Developer:**

1. Inspect `DeepAnalysisInput` in `openai.service.ts` to find the cleanest injection point
2. Inspect `buildDeepAnalysisMessages()` in `prompt-factory.ts` to understand user message structure
3. In `prompt-factory.ts`: Add `buildEventImpactContext(contextString: string): string` function
4. In `prompt-factory.ts`: If `buildDeepAnalysisMessages()` accepts optional params, add `eventImpactContext?: string` and append to user message. If not, find another clean way (e.g., append to historicalStats).
5. In `aiWorkflow.cron.ts`: Add import for `compareWithHistoricalEvents` from the new service
6. In `aiWorkflow.cron.ts`: After the existing historicalStats block, add the eventImpactContext query block (wrapped in flag check + try/catch)
7. In `aiWorkflow.cron.ts`: Pass eventImpactContext to the prompt builder
8. Verify: when flag is false, the workflow is byte-identical to before
9. Verify `tsc --noEmit` clean

**Acceptance criteria:**
- When `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED=false`: workflow behaves identically to before (no new DB queries, no prompt changes)
- When flag is true: queries comparison service, injects real stats into prompt
- When comparison returns insufficient_data: no injection (skip silently)
- When comparison returns no_data: no injection (skip silently)
- When comparison service throws: no injection (catch + log, continue)
- Injected context includes NFA disclaimer
- AI prompt explicitly says "do NOT invent additional historical data"
- No changes to `callDeepSeekAnalysis()` return type
- `tsc --noEmit` clean

**QA checklist:**
- [ ] EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED flag added to env.ts (default false)
- [ ] buildEventImpactContext() added to prompt-factory.ts
- [ ] NFA disclaimer in built context
- [ ] "Do NOT invent" instruction in built context
- [ ] Flag check in aiWorkflow.cron.ts before query
- [ ] try/catch around comparison service call
- [ ] insufficient_data → no injection (log only)
- [ ] no_data → no injection (log only)
- [ ] exception → no injection (error log, continue)
- [ ] success → context injected into prompt
- [ ] When flag false: no comparison query executed
- [ ] No changes to callDeepSeekAnalysis() return type
- [ ] No `any` types introduced
- [ ] `tsc --noEmit` clean

**Dependencies:** T-2.1 (comparison service), T-2.3 (taxonomy must include new types for future events), T-2.6 (env flag)

**Rollback notes:**
- Set EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED=false
- Revert prompt-factory.ts (remove buildEventImpactContext, revert buildDeepAnalysisMessages)
- Revert aiWorkflow.cron.ts (remove comparison query block)

---

### T-2.5 — Classification Confidence Field

**Task ID:** T-2.5
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Add a confidence score (0-1) to the event classification output from triage. Store it in the `event_impacts` table via the existing persistence flow.

**Files to inspect:**
- `backend/src/services/openai.service.ts` — `TriageResult` interface (lines 237-246), `generateLightweightTriage()` function (line 248)
- `backend/src/services/ai/prompt-factory.ts` — triage prompt (line 96, `buildTriageMessages`)
- `backend/src/services/eventImpactPersistence.service.ts` — `persistEventImpact()` (line 113)
- `backend/src/crons/aiWorkflow.cron.ts` — where triage results are consumed

**Files allowed to modify:**
- `backend/src/services/openai.service.ts` (add confidence to TriageResult + prompt parsing)
- `backend/src/services/ai/prompt-factory.ts` (add confidence to triage JSON schema in prompt)
- `backend/src/models/market.model.ts` (add classificationConfidence column to eventImpacts Drizzle model)
- `backend/scripts/migrate-event-impacts.sql` (ALTER TABLE for new column — optional, see decision below)
- `backend/src/services/eventImpactPersistence.service.ts` (pass confidence through to INSERT)

**Forbidden files:**
- Any controller/route files
- Any cron files (except to read the confidence value — but T-2.4 handles the workflow)
- Any frontend files

**Constraints:**
- Confidence is OPTIONAL in TriageResult (backward compatible — existing triage outputs without confidence still work)
- Default confidence is null (not 0) — absence of confidence means "not scored"
- AI prompt should instruct the model to self-assess how confident it is in the classification
- Confidence stored in event_impacts.classification_confidence
- No changes to existing classification logic

**Design decision — Migration:**
Since `event_impacts` table already exists (Phase 6B migration ran), we need an ALTER TABLE to add the column. However, since Drizzle pushSchema may handle this in dev, we have two options:

**Option A (Preferred):** Add a new migration script `backend/scripts/migrate-event-impacts-v2.sql` with:
```sql
ALTER TABLE event_impacts ADD COLUMN IF NOT EXISTS classification_confidence REAL;
```

**Option B:** Use Drizzle pushSchema (dev only, may not work in production Neon).

**Choose Option A** for production safety.

**Design specification:**

1. **TriageResult interface change (openai.service.ts):**
```typescript
interface TriageResult {
    title: string;
    source?: string;
    relevanceScore: number;
    sentimentHint: string | null;
    symbolMentions: string[];
    eventType: string;
    eventSeverity: number;
    classification: 'MAJOR' | 'MINOR' | 'NOISE';
    confidence?: number;  // NEW — 0.0 to 1.0, optional
}
```

2. **Prompt change (prompt-factory.ts triage prompt):**
Add `confidence` field to the JSON output schema with instructions:
```
"confidence": <0.0-1.0 — how confident are you in this classification? 1.0 = very confident, 0.0 = guessing. Consider: is the event type clear? Is the sentiment obvious? Is the coin impact direct or indirect?>
```

3. **Drizzle model change (market.model.ts):**
Add to eventImpacts table:
```typescript
classificationConfidence: real('classification_confidence'),
```

4. **Persistence change (eventImpactPersistence.service.ts):**
In `persistEventImpact()`, add:
```typescript
classificationConfidence: source.classification_confidence ?? null,
```
Wait — the source is `CoinNewsHistoryRecord` which doesn't have `classification_confidence`. The confidence comes from triage, not from coin_news_history.

**CORRECTION:** The confidence should be passed from aiWorkflow.cron.ts through the persistence flow. But aiWorkflow doesn't call persistEventImpact directly — that's done by eventImpactSync.cron.ts (Phase 1).

**REVISED APPROACH:** The sync cron reads from coin_news_history which doesn't store confidence. We need to either:
- (A) Store confidence in coin_news_history first, then sync picks it up
- (B) Have the workflow directly write confidence to event_impacts after sync creates the row

**Option A is simpler:** Add `classification_confidence` column to `coin_news_history` (nullable), write it from aiWorkflow after triage, then the sync cron picks it up via persistence service.

But wait — the constraint says "Do NOT modify coin_news_history schema."

**REVISED APPROACH (Option C):** Store confidence in event_impacts only. After the sync cron creates the event_impacts row (from coin_news_history), add a SEPARATE update step in the workflow or a new mechanism.

Actually, the simplest approach:
1. The confidence is output by triage in aiWorkflow
2. After triage, the workflow already has the confidence value
3. We need a function to UPDATE event_impacts SET classification_confidence = X WHERE source_id = Y
4. This can be done in aiWorkflow.cron.ts right after the sync creates the row, OR we can create a helper in eventImpactPersistence.service.ts

**FINAL APPROACH:**
- Add `classification_confidence` to `event_impacts` only (not coin_news_history)
- Add `updateEventImpactConfidence(sourceId: number, confidence: number)` to `eventImpactPersistence.service.ts`
- In `aiWorkflow.cron.ts`, after triage returns with confidence, call `updateEventImpactConfidence()` — but only if the event_impacts row already exists (it may not exist yet since sync runs every 30 min)
- If the row doesn't exist yet, skip (the confidence is lost — acceptable trade-off for simplicity)

Actually, this is getting complex. Let me simplify:

**SIMPLEST APPROACH:**
1. Add confidence to TriageResult (openai.service.ts) — optional field, backward compatible
2. Add confidence to triage prompt JSON schema (prompt-factory.ts)
3. Add `classification_confidence` column to event_impacts (migration + Drizzle model)
4. In `eventImpactPersistence.service.ts`, update `persistEventImpact()` to accept optional confidence parameter
5. In `eventImpactSync.cron.ts`, pass null for confidence (sync cron doesn't have triage confidence — it reads from coin_news_history)
6. Future enhancement: confidence can be set by a separate mechanism

Wait, this defeats the purpose. The user wants confidence scoring to actually work.

**PRACTICAL APPROACH:**
1. Add confidence to TriageResult (openai.service.ts)
2. Add to triage prompt (prompt-factory.ts)
3. In aiWorkflow.cron.ts, after triage returns, if confidence exists, store it in coin_news_history (add a nullable column). Yes, this modifies coin_news_history, but only adds a nullable column — backward compatible, no data loss.

Hmm, but the constraint says "Do NOT modify coin_news_history schema."

Let me re-read the user's instructions:
> Forbidden:
> - Modify coin_news_history schema

OK, so I cannot add a column to coin_news_history.

**FINAL PRACTICAL APPROACH:**
1. Add confidence to TriageResult (openai.service.ts) — AI outputs it
2. Add to triage prompt (prompt-factory.ts) — AI knows to score itself
3. Add `classification_confidence` column to `event_impacts` only (migration + Drizzle)
4. Add `updateEventImpactConfidence(sourceId: number, confidence: number): Promise<void>` to `eventImpactPersistence.service.ts`
5. In `aiWorkflow.cron.ts`, after triage AND after confirming the news item gets classified as MAJOR/MINOR:
   - Try to find existing event_impacts row by source_id
   - If found, UPDATE classification_confidence
   - If not found, skip (sync cron will create it later without confidence — acceptable)
6. Log when confidence is stored or skipped

This is the cleanest approach given the constraint.

**Step-by-step instructions for Senior Developer:**

1. Create `backend/scripts/migrate-event-impacts-v2.sql`:
```sql
ALTER TABLE event_impacts ADD COLUMN IF NOT EXISTS classification_confidence REAL;
```

2. In `backend/src/models/market.model.ts`, add to `eventImpacts` table definition:
```typescript
classificationConfidence: real('classification_confidence'),
```

3. In `backend/src/services/openai.service.ts`, add to `TriageResult`:
```typescript
confidence?: number;
```

4. In `backend/src/services/ai/prompt-factory.ts`, add to triage JSON output schema:
```
"confidence": <0.0-1.0 — self-assessed confidence in this classification>
```

5. In `backend/src/services/eventImpactPersistence.service.ts`, add new function:
```typescript
async function updateEventImpactConfidence(sourceId: number, confidence: number): Promise<boolean> {
    // UPDATE event_impacts SET classification_confidence = confidence WHERE source_id = sourceId
    // Return true if row was updated, false if not found
}
```
Export it.

6. In `backend/src/crons/aiWorkflow.cron.ts`:
   a. Import `updateEventImpactConfidence` from eventImpactPersistence.service
   b. After triage returns, if triageResult.confidence exists and classification is MAJOR or MINOR:
      ```typescript
      if (triageResult.confidence !== undefined && (classification === 'MAJOR' || classification === 'MINOR')) {
          const newsId = /* the coin_news_history id for this item */;
          try {
              await updateEventImpactConfidence(newsId, triageResult.confidence);
              console.log(`[AI Workflow] Classification confidence ${triageResult.confidence} stored for source_id=${newsId}`);
          } catch (confErr) {
              console.error(`[AI Workflow] Failed to store confidence:`, confErr);
          }
      }
      ```
   c. Wrap in try/catch — confidence storage failure must not break the pipeline

7. Verify `tsc --noEmit` clean

**Acceptance criteria:**
- Confidence field added to TriageResult (optional, backward compatible)
- Triage prompt instructs model to output confidence 0.0-1.0
- event_impacts table has classification_confidence column
- Drizzle model updated
- updateEventImpactConfidence() function works
- aiWorkflow stores confidence when available
- Pipeline continues if confidence storage fails
- When event_impacts row doesn't exist yet: skip silently (log only)
- `tsc --noEmit` clean

**QA checklist:**
- [ ] Migration script created (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- [ ] Drizzle model has classificationConfidence column
- [ ] TriageResult has confidence?: number
- [ ] Triage prompt JSON schema includes confidence field
- [ ] updateEventImpactConfidence() exported from persistence service
- [ ] aiWorkflow imports updateEventImpactConfidence
- [ ] Confidence stored only for MAJOR/MINOR (not NOISE)
- [ ] try/catch around confidence storage
- [ ] Skips if event_impacts row not found (no crash)
- [ ] Logs confidence stored/skipped
- [ ] No existing behavior changes when confidence is undefined
- [ ] No `any` types
- [ ] `tsc --noEmit` clean

**Dependencies:** None (can run in parallel with other tasks)

**Rollback notes:**
- Drop column: `ALTER TABLE event_impacts DROP COLUMN IF EXISTS classification_confidence;`
- Revert Drizzle model
- Revert TriageResult interface
- Revert prompt schema
- Revert aiWorkflow changes
- Revert persistence service

---

### T-2.6 — Add Phase 2 Feature Flag

**Task ID:** T-2.6
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Add one new feature flag `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` to `backend/src/config/env.ts` for controlling AI workflow stats injection (T-2.4).

**Files to inspect:**
- `backend/src/config/env.ts` — existing flags at lines 84-90

**Files allowed to modify:**
- `backend/src/config/env.ts`

**Forbidden files:**
- All other files

**Design specification:**

Add after the existing Phase 1 flags (after line 90):
```typescript
EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED: z.boolean().default(false),
```

**Step-by-step instructions:**

1. Open `backend/src/config/env.ts`
2. After line 90 (`EVENT_IMPACT_OUTCOME_CHECKER_ENABLED: z.boolean().default(false),`), add:
   ```typescript
   EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED: z.boolean().default(false),
   ```
3. Verify `tsc --noEmit` clean

**Acceptance criteria:**
- Flag added with correct Zod schema
- Default is `false`
- Placed logically with other event impact flags
- `tsc --noEmit` clean

**QA checklist:**
- [ ] `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED: z.boolean().default(false)` present
- [ ] Defaults to false
- [ ] No other lines changed
- [ ] `tsc --noEmit` clean

**Dependencies:** None (first code task to execute)

**Rollback notes:**
- Remove the 1 added line from env.ts

---

### T-2.7 — Documentation Update

**Task ID:** T-2.7
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Prompt Engineer
**Status:** Pending

**Objective:**
Update PROJECT_STATE.md and AGENT_LOGS.md to reflect Phase 2 planning.

**Files to modify:**
- `agent_gedens/PROJECT_STATE.md` — Add Phase 2 to Current Mission
- `agent_gedens/AGENT_LOGS.md` — Add Phase 2 planning entry

**Dependencies:** All code tasks (for accurate documentation)

---

### T-2.8 — QA Checklist

**Task ID:** T-2.8
**Phase:** Phase 2 — Full Event Impact Engine
**Assigned Agent:** Prompt Engineer
**Status:** Pending

**Objective:**
Comprehensive QA checklist for validating all Phase 2 deliverables.

**Dependencies:** All code tasks

---

## PHASE 2 COMPREHENSIVE QA CHECKLIST

---

### A. Historical Comparison Service (T-2.1)

- [ ] **A1.** File exists at `backend/src/services/historicalEventComparison.service.ts`
- [ ] **A2.** Exports: `compareWithHistoricalEvents`, `buildHistoricalContextString`
- [ ] **A3.** Input interface: eventType (required), coinSymbol (optional), eventSeverity (optional), horizon (optional), maxResults (optional)
- [ ] **A4.** Output interface has status field: 'success' | 'insufficient_data' | 'no_data'
- [ ] **A5.** Queries only event_impacts + event_impact_outcomes (no other tables)
- [ ] **A6.** eventSeverity filter uses ±1 range
- [ ] **A7.** Outcomes filtered to status='completed' only
- [ ] **A8.** sampleSize < 5 returns insufficient_data
- [ ] **A9.** Zero results returns no_data
- [ ] **A10.** Per-horizon stats calculated: median, avg, positive/negative rate, max upside/drawdown, time to peak/bottom
- [ ] **A11.** Severity breakdown calculated
- [ ] **A12.** Top coins breakdown calculated
- [ ] **A13.** contextString is policy-safe (no buy/sell/prediction language)
- [ ] **A14.** contextString includes NFA disclaimer
- [ ] **A15.** Zero `any` types

---

### B. Event Impact Stats API (T-2.2)

- [ ] **B1.** GET /api/market/event-impact-stats returns 200 with stats
- [ ] **B2.** Missing eventType returns 400
- [ ] **B3.** Invalid eventSeverity returns 400
- [ ] **B4.** Invalid horizon returns 400
- [ ] **B5.** authMiddleware protects endpoint
- [ ] **B6.** Route registered in market.routes.ts
- [ ] **B7.** Uses historicalEventComparison.service.ts (not direct DB queries)
- [ ] **B8.** Zero `any` types

---

### C. Extended Event Taxonomy (T-2.3)

- [ ] **C1.** Both triage and deep analysis prompts have IDENTICAL event type lists
- [ ] **C2.** All 18 types present in both prompts
- [ ] **C3.** All 11 existing types preserved
- [ ] **C4.** All 8 new types added
- [ ] **C5.** Deep analysis prompt bug fixed (now has Exploit, Delisting, TokenLaunch)
- [ ] **C6.** TRIGGER_TYPE_MAP covers all 18 types
- [ ] **C7.** selectTone() handles all 18 types
- [ ] **C8.** No other lines modified in prompt-factory.ts
- [ ] **C9.** No other lines modified in aiWorkflow.cron.ts (besides TRIGGER_TYPE_MAP + selectTone)

---

### D. AI Workflow Stats Integration (T-2.4)

- [ ] **D1.** EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED flag exists (default false)
- [ ] **D2.** buildEventImpactContext() function in prompt-factory.ts
- [ ] **D3.** NFA disclaimer in built context
- [ ] **D4.** "Do NOT invent" instruction in built context
- [ ] **D5.** Flag check in aiWorkflow.cron.ts before query
- [ ] **D6.** try/catch around comparison service call
- [ ] **D7.** insufficient_data → no injection
- [ ] **D8.** no_data → no injection
- [ ] **D9.** exception → no injection, error logged
- [ ] **D10.** success → context injected into prompt
- [ ] **D11.** When flag false: no comparison query executed
- [ ] **D12.** No changes to callDeepSeekAnalysis() return type
- [ ] **D13.** Zero `any` types

---

### E. Classification Confidence (T-2.5)

- [ ] **E1.** Migration script exists (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- [ ] **E2.** Drizzle model has classificationConfidence column on eventImpacts
- [ ] **E3.** TriageResult has confidence?: number (optional)
- [ ] **E4.** Triage prompt JSON schema includes confidence field
- [ ] **E5.** updateEventImpactConfidence() exported from persistence service
- [ ] **E6.** aiWorkflow imports and calls updateEventImpactConfidence
- [ ] **E7.** Confidence stored only for MAJOR/MINOR classifications
- [ ] **E8.** try/catch around confidence storage
- [ ] **E9.** Skips if event_impacts row not found
- [ ] **E10.** No existing behavior changes when confidence undefined
- [ ] **E11.** Zero `any` types

---

### F. Feature Flags

- [ ] **F1.** EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED defaults to false
- [ ] **F2.** All 7 event impact flags present in env.ts (6 existing + 1 new)
- [ ] **F3.** Missing env vars do NOT crash server

---

### G. No Existing System Modifications

- [ ] **G1.** eventImpactAnalysis.service.ts — unchanged
- [ ] **G2.** eventImpactPersistence.service.ts — only NEW function added (updateEventImpactConfidence), existing functions unchanged
- [ ] **G3.** Living Articles — unchanged
- [ ] **G4.** Scorecard — unchanged
- [ ] **G5.** coin_news_history schema — unchanged
- [ ] **G6.** Public UI — unchanged
- [ ] **G7.** callDeepSeekAnalysis() return type — unchanged

---

### H. TypeScript Quality

- [ ] **H1.** `tsc --noEmit` clean on entire backend
- [ ] **H2.** Zero `any` types across all new/modified files

---

### Summary Scorecard

| Section | Items | Status |
|---------|-------|--------|
| A. Historical Comparison Service | 15 | ☐ |
| B. Event Impact Stats API | 8 | ☐ |
| C. Extended Event Taxonomy | 9 | ☐ |
| D. AI Workflow Stats Integration | 13 | ☐ |
| E. Classification Confidence | 11 | ☐ |
| F. Feature Flags | 3 | ☐ |
| G. No Existing System Modifications | 7 | ☐ |
| H. TypeScript Quality | 2 | ☐ |
| **TOTAL** | **68** | **☐/68** |

**QA PASS Criteria:** All 68 items checked. Zero blocking failures allowed.

---

## GUARDRAILS

1. **ZERO `any` types** across all new/modified files.
2. **Read-only queries** for comparison service and API endpoint — no writes to event_impacts/outcomes except confidence update.
3. **Feature flag defaults to `false`** — AI workflow stats injection disabled by default.
4. **Backward compatible taxonomy** — all existing event types remain valid, new types extend the list.
5. **Insufficient data guard** — sample size < 5 returns `insufficient_data`, not unreliable statistics.
6. **No prediction language** — all outputs framed as historical observation, not forecasting.
7. **No frontend changes** — this phase is backend-only.
8. **No coin_news_history schema changes** — confidence stored in event_impacts only.
9. **No external API calls** — all data from existing event_impact_outcomes.
10. **No commit/push before QA PASS**.

## RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stats injection increases prompt length and cost | Low | Flag defaults to false, optional feature |
| Insufficient historical data for new event types | Medium | Guard returns insufficient_data, AI prompted to note lack of data |
| New taxonomy types not recognized by AI | Low | Types are in prompt enum, AI will use them |
| Confidence score not stored if event_impacts row doesn't exist yet | Low | Acceptable — sync cron creates rows, future events will have confidence |
| Deep analysis prompt missing event types (pre-existing bug) | None | Fixed as part of T-2.3 (synchronize both prompts) |

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/src/services/historicalEventComparison.service.ts` | ✅ Done | New — historical comparison service |
| `backend/src/controllers/market.controller.ts` | ✅ Done | Add getEventImpactStatsHandler |
| `backend/src/routes/market.routes.ts` | ✅ Done | Add /event-impact-stats route |
| `backend/src/services/ai/prompt-factory.ts` | ✅ Done | Extend taxonomy + add buildEventImpactContext |
| `backend/src/crons/aiWorkflow.cron.ts` | ✅ Done | Extend TRIGGER_TYPE_MAP + selectTone + stats injection |
| `backend/src/services/openai.service.ts` | ✅ Done | Add confidence to TriageResult |
| `backend/src/models/market.model.ts` | ✅ Done | Add classificationConfidence column |
| `backend/scripts/migrate-event-impacts-v2.sql` | ✅ Done | New — ALTER TABLE for confidence column |
| `backend/src/services/eventImpactPersistence.service.ts` | ✅ Done | Add updateEventImpactConfidence function |
| `backend/src/config/env.ts` | ✅ Done | Add EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED flag |
| `agent_gedens/PROJECT_STATE.md` | ✅ Done | Phase 2 status update |
| `agent_gedens/AGENT_LOGS.md` | ✅ Done | Phase 2 log entries |

**Total: 2 new files, 8 modified files, 2 documentation updates**

---

## PRIORITY ORDER

```
1. T-2.6 — Feature flag (independent, no deps)
2. T-2.3 — Extended taxonomy (independent, can parallel with T-2.6)
3. T-2.1 — Historical comparison service (independent, reads existing tables)
4. T-2.2 — API endpoint (depends on T-2.1)
5. T-2.4 — AI workflow stats injection (depends on T-2.1 + T-2.3 + T-2.6)
6. T-2.5 — Classification confidence (independent, can parallel with T-2.4)
7. T-2.7 — Documentation (depends on all code tasks)
8. T-2.8 — QA checklist (depends on all code tasks)
```

**Parallelizable:**
- T-2.6 (flag) + T-2.3 (taxonomy) + T-2.1 (service) + T-2.5 (confidence) can all run in parallel

---

*Phase 2 authored: May 4, 2026 | Strategic Planner*
*Prerequisites: Phase 6A (complete) + Phase 6B (complete) + Phase 1 (pending code tasks)*
*Enables: Real historical stats in AI prompts, extended event taxonomy, classification confidence*

---

---

# Phase 1 — Minimum Data Foundation (Activate Event Impact Engine)

**Status:** ✅ COMPLETE — Code committed (f206e39, 886bea9), QA PASSED
**Date:** May 4, 2026
**Priority:** P1 (Activates Phase 6A+6B deliverables in production)
**Scope:** 2 new crons, 2 new env flags, 1 server.ts registration, 1 runbook, 1 QA checklist
**Prerequisites:** Phase 6A (complete) + Phase 6B (complete) — both pushed
**Authorized By:** Strategic Planner — May 4, 2026
**Commits:** `f206e39` (initial), `886bea9` (QA re-review fixes)

## OBJECTIVE

Activate the Event Impact Engine in production. After Phase 1, every new event/news item should automatically:
1. Create an `event_impacts` record (via sync cron reading `coin_news_history`)
2. Create `event_impact_outcomes` records for each horizon (1h, 4h, 24h, 3d, 7d)
3. Have outcomes checked and filled as time passes (via outcome checker cron)

Phase 1 does NOT modify any existing tables, crons, AI workflows, or frontend.

## ARCHITECTURE DECISION — Option D (Separate Sync Cron)

**Integration point:** A new `eventImpactSync.cron.ts` that independently reads recent `coin_news_history` records and creates `event_impacts` for any missing records.

**Why Option D over alternatives:**
- Does NOT modify any existing cron (aiWorkflow, triageEngine, eventOutcomeChecker)
- Runs independently with its own flag
- Idempotent by design (skips already-synced records via LEFT JOIN)
- Can be enabled/disabled without affecting the rest of the pipeline
- Safest possible integration — zero risk to existing data flow

**Data flow:**
```
coin_news_history (existing, unchanged)
         │
         ▼
eventImpactSync.cron.ts (NEW — every 30 min)
   ├── LEFT JOIN: finds records with eventSeverity but no event_impacts row
   ├── calls persistEventImpact() → event_impacts
   └── calls persistEventImpactOutcomes() → event_impact_outcomes (5 rows, status='pending')
         │
         ▼
eventImpactOutcomeChecker.cron.ts (NEW — every 30 min)
   ├── finds event_impact_outcomes WHERE status='pending' AND due_at <= now()
   ├── fetches price via getCoinKlinesRange() from Binance
   ├── calculates change_percent, max_upside, max_drawdown, times
   ├── classifies outcome
   └── updates event_impact_outcomes row → status='completed'
         │
         ▼
event_impacts table (growing dataset of event-price impact records)
event_impact_outcomes table (per-horizon outcomes with real price data)
```

## PHASE 1 SCOPE LIMITATIONS

**Allowed:**
- Create 2 new cron files (eventImpactSync, eventImpactOutcomeChecker)
- Add 2 new env flags (EVENT_IMPACT_SYNC_ENABLED, EVENT_IMPACT_OUTCOME_CHECKER_ENABLED)
- Register new crons in server.ts (conditional on flags)
- Create production runbook (T-1.1, T-1.5)

**Forbidden:**
- Modify coin_news_history schema
- Modify existing cron behavior
- Modify Living Articles
- Modify scorecard
- Modify public UI / frontend
- Add external APIs beyond existing Binance
- Modify AI workflow prompts
- Add prediction/forecasting language
- Commit or push before QA PASS

## EXECUTION ORDER

```
T-1.4 (feature flags) ─────────────────────────┐
                                                  ├── T-1.2 (sync cron) ──┐
T-1.5 (runbook plan) ───────────────────────────┤                         ├── T-1.6 (docs) ── T-1.7 (QA)
                                                  ├── T-1.3 (outcome cron)─┘
```

T-1.4 must complete first (flags needed by T-1.2 and T-1.3).
T-1.2 and T-1.3 can run in parallel.
T-1.5 can run in parallel with all code tasks.
T-1.6 and T-1.7 after all code tasks complete.

---

## REQUIRED TASKS

### T-1.1 — Production Migration Execution Plan

**Task ID:** T-1.1
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Prompt Engineer
**Status:** Pending

**Objective:**
Document a safe production migration execution plan for running `migrate-event-impacts.sql`. This is a PLAN document, not execution.

**Files to inspect:**
- `backend/scripts/migrate-event-impacts.sql` — the migration to execute
- `backend/src/models/market.model.ts` — Drizzle model (verify it matches SQL)

**Deliverable:**
Write a detailed runbook section covering:

1. **Pre-migration checklist:**
   - Verify `event_impacts` and `event_impact_outcomes` tables do NOT already exist
   - Verify `coin_news_history` table exists and has expected row count
   - Take a pg_dump backup of the database (or at minimum the coin_news_history table)
   - Verify DATABASE_URL points to correct database
   - Estimate row count impact (how many eligible coin_news_history rows have eventSeverity IS NOT NULL)

2. **Migration execution:**
   - Exact command: `psql $DATABASE_URL -f backend/scripts/migrate-event-impacts.sql`
   - Expected output (table/index creation messages)
   - Verification queries:
     ```sql
     SELECT table_name FROM information_schema.tables WHERE table_name IN ('event_impacts', 'event_impact_outcomes');
     SELECT indexname FROM pg_indexes WHERE tablename IN ('event_impacts', 'event_impact_outcomes');
     SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'event_impacts' ORDER BY ordinal_position;
     SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'event_impact_outcomes' ORDER BY ordinal_position;
     ```

3. **Rollback procedure:**
   ```sql
   DROP TABLE IF EXISTS event_impact_outcomes;
   DROP TABLE IF EXISTS event_impacts;
   ```
   - Note: CASCADE on DROP handles index cleanup
   - No data in existing tables affected (new tables only)

4. **Post-migration verification:**
   - Both tables exist with correct column count (13 + 16)
   - All indexes present (5 + 4)
   - FK constraints correct
   - Idempotency confirmed (re-running migration produces no errors)

**Acceptance criteria:**
- Plan documented as a subsection in THE_NEXUS_HUB.md
- All verification queries provided
- Rollback procedure documented
- Pre-flight checklist complete

**QA checklist:**
- [ ] All table names match migration SQL
- [ ] All column names and types verified against Drizzle model
- [ ] FK constraints documented (ON DELETE SET NULL for source_id, ON DELETE CASCADE for outcomes)
- [ ] Backup command provided
- [ ] Rollback drops in correct order (outcomes first)

**Dependencies:** None

---

### T-1.2 — Event Impact Sync Cron

**Task ID:** T-1.2
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create `backend/src/crons/eventImpactSync.cron.ts` — a cron that periodically reads recent `coin_news_history` records and creates `event_impacts` + `event_impact_outcomes` for any records not yet synced. This is the primary data ingestion point for the Event Impact Engine.

**Files to inspect:**
- `backend/src/services/eventImpactPersistence.service.ts` — existing `persistEventImpact()` and `persistEventImpactOutcomes()` functions
- `backend/src/crons/eventOutcomeChecker.cron.ts` — reference cron pattern (schedule, logger, error handling)
- `backend/src/crons/scenarioOutcomeChecker.cron.ts` — reference for env flag check pattern
- `backend/src/models/market.model.ts` — `coinNewsHistory` and `eventImpacts` Drizzle tables
- `backend/src/config/env.ts` — `EVENT_IMPACT_SYNC_ENABLED` flag (added in T-1.4)
- `backend/src/server.ts` — cron registration pattern (lines 93-135)

**Files allowed to create:**
- `backend/src/crons/eventImpactSync.cron.ts` (new file)

**Files allowed to modify:**
- `backend/src/server.ts` (add import + registration, lines 27 and 111-112)

**Forbidden files:**
- Any existing cron files
- Any service files
- Any model files
- Any controller/route files
- `backend/src/config/env.ts` (T-1.4 handles flags)

**Constraints:**
- ZERO `any` types
- Feature-flagged: check `env.EVENT_IMPACT_SYNC_ENABLED` at cron start
- Idempotent: skip records that already have event_impacts rows
- Independent: does NOT modify existing pipeline or cron behavior
- Uses existing persistence functions from eventImpactPersistence.service.ts

**Design specification:**

1. **Query for unsynced records:**
   ```sql
   SELECT cnh.*
   FROM coin_news_history cnh
   LEFT JOIN event_impacts ei ON ei.source_id = cnh.id
   WHERE cnh.event_severity IS NOT NULL
     AND ei.id IS NULL
     AND cnh.published_at > NOW() - INTERVAL '48 hours'
   ORDER BY cnh.published_at DESC
   LIMIT 50
   ```

   Drizzle equivalent:
   ```typescript
   import { db } from '../config/db';
   import { coinNewsHistory, eventImpacts } from '../models/market.model';
   import { and, isNotNull, isNull, gt, sql, desc } from 'drizzle-orm';

   const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

   const unsyncedRows = await db
       .select()
       .from(coinNewsHistory)
       .leftJoin(eventImpacts, eq(eventImpacts.sourceId, coinNewsHistory.id))
       .where(and(
           isNotNull(coinNewsHistory.eventSeverity),
           isNull(eventImpacts.id),
           gt(coinNewsHistory.publishedAt, fortyEightHoursAgo)
       ))
       .orderBy(desc(coinNewsHistory.publishedAt))
       .limit(50);
   ```

   Filter out rows where the JOIN produced an eventImpacts result (shouldn't happen due to isNull, but defensive):
   ```typescript
   const candidates = unsyncedRows.filter(row => !row.eventImpacts);
   ```

2. **Process each candidate:**
   ```typescript
   import { persistEventImpact, persistEventImpactOutcomes } from '../services/eventImpactPersistence.service';

   for (const row of candidates) {
       const sourceRecord = row.coin_news_history; // LEFT JOIN result shape
       const eventImpactId = await persistEventImpact(sourceRecord as CoinNewsHistoryRecord);
       if (eventImpactId !== null) {
           await persistEventImpactOutcomes(eventImpactId, sourceRecord as CoinNewsHistoryRecord);
       }
   }
   ```

3. **Export pattern (following existing crons):**
   ```typescript
   export async function runEventImpactSync(): Promise<void> { ... }
   export function startEventImpactSyncCron(): void {
       cron.schedule('*/30 * * * *', () => runEventImpactSync());
       console.log('EventImpactSync scheduled — every 30 minutes');
   }
   ```

4. **server.ts registration (conditional, following MONITORING_CRON_ENABLED pattern at lines 125-135):**
   ```typescript
   // Add import at line 27 (after startScenarioOutcomeCheckerCron):
   import { startEventImpactSyncCron } from './crons/eventImpactSync.cron';

   // Add conditional registration after the monitoring cron block (after line 135):
   if (env.EVENT_IMPACT_SYNC_ENABLED) {
       setTimeout(() => {
           try {
               startEventImpactSyncCron();
               logger.info('[Server] Optional cron started: EventImpactSync');
           } catch (error) {
               logger.error('[Server] Failed to start optional cron EventImpactSync: %s', error instanceof Error ? error.message : String(error));
           }
       }, crons.length * cronStartDelay);
   }
   ```

   **IMPORTANT:** The sync cron must NOT be added to the main `crons` array (lines 94-112). It must use the conditional pattern (lines 125-135) since its flag defaults to `false`.

**Error handling:**
- Outer try/catch in `runEventImpactSync()` with logger.error
- Inner try/catch per row (skip failed rows, continue processing)
- Log summary: `{ scanned, synced, skipped, errors }`

**Step-by-step instructions for Senior Developer:**

1. Create `backend/src/crons/eventImpactSync.cron.ts`
2. Import: cron, db, Drizzle operators, persistence functions, env, logger
3. Implement `runEventImpactSync()`:
   a. Check `env.EVENT_IMPACT_SYNC_ENABLED` — return early if false
   b. Calculate 48-hour cutoff
   c. LEFT JOIN query to find unsynced candidates
   d. Filter candidates (defensive null check on JOIN result)
   e. Loop: call `persistEventImpact()` then `persistEventImpactOutcomes()`
   f. Log summary
4. Implement `startEventImpactSyncCron()` with `*/30 * * * *` schedule
5. Export both functions
6. Add import to `server.ts` at line 27
7. Add conditional registration after monitoring cron block in `server.ts`

**Acceptance criteria:**
- Cron created with correct LEFT JOIN query
- Idempotent (skips already-synced records)
- Feature-flagged (env.EVENT_IMPACT_SYNC_ENABLED)
- Registered in server.ts conditionally (not in main crons array)
- Zero `any` types
- Proper error handling (outer + inner try/catch)
- `tsc --noEmit` clean

**QA checklist:**
- [ ] File created at correct path
- [ ] LEFT JOIN query uses correct tables and conditions
- [ ] 48-hour window filter present
- [ ] LIMIT 50 per run
- [ ] env.EVENT_IMPACT_SYNC_ENABLED check at function start
- [ ] persistEventImpact() and persistEventImpactOutcomes() called correctly
- [ ] CoinNewsHistoryRecord type cast without `any` (use `as unknown as CoinNewsHistoryRecord` or proper type narrowing)
- [ ] Outer try/catch with logger.error
- [ ] Inner try/catch per row
- [ ] Summary logged: scanned, synced, skipped, errors
- [ ] Export: runEventImpactSync + startEventImpactSyncCron
- [ ] server.ts import added at line 27
- [ ] server.ts conditional registration (not in main crons array)
- [ ] Zero `any` types
- [ ] `tsc --noEmit` clean

**Dependencies:** T-1.4 (env flag must exist)

**Rollback notes:**
- Delete `backend/src/crons/eventImpactSync.cron.ts`
- Revert server.ts (remove import + conditional block)

---

### T-1.3 — Event Impact Outcome Checker Cron

**Task ID:** T-1.3
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create `backend/src/crons/eventImpactOutcomeChecker.cron.ts` — a cron that checks due `event_impact_outcomes` records, fetches real price data from Binance, calculates outcome metrics, and updates the records.

**Files to inspect:**
- `backend/src/crons/eventOutcomeChecker.cron.ts` — reference for Binance kline fetching + metric calculation pattern (lines 99-186)
- `backend/src/crons/scenarioOutcomeChecker.cron.ts` — reference for env flag check + due_at query pattern (lines 8-55)
- `backend/src/services/binance.service.ts` — `getCoinKlinesRange(symbol, interval, startTime, endTime)` function (lines 120-187)
- `backend/src/models/market.model.ts` — `eventImpactOutcomes` and `eventImpacts` Drizzle tables
- `backend/src/config/env.ts` — `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` flag (added in T-1.4)
- `backend/src/server.ts` — cron registration pattern

**Files allowed to create:**
- `backend/src/crons/eventImpactOutcomeChecker.cron.ts` (new file)

**Files allowed to modify:**
- `backend/src/server.ts` (add import + conditional registration)

**Forbidden files:**
- Any existing cron files
- Any service files
- Any model files
- Any controller/route files

**Constraints:**
- ZERO `any` types
- Feature-flagged: check `env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` at cron start
- Use existing `getCoinKlinesRange()` from binance.service.ts ONLY
- Handle missing prices gracefully (mark as 'failed' with error_message)
- Handle non-Binance coins gracefully (mark as 'unsupported')
- Registered in server.ts conditionally (NOT in main crons array)

**Design specification:**

1. **Query for due pending outcomes:**
   ```typescript
   const now = new Date();

   const dueOutcomes = await db
       .select({
           outcomeId: eventImpactOutcomes.id,
           eventImpactId: eventImpactOutcomes.eventImpactId,
           horizon: eventImpactOutcomes.horizon,
           horizonHours: eventImpactOutcomes.horizonHours,
           dueAt: eventImpactOutcomes.dueAt,
           coinSymbol: eventImpacts.coinSymbol,
           priceAtEvent: eventImpacts.priceAtEvent,
           publishedAt: eventImpacts.publishedAt,
       })
       .from(eventImpactOutcomes)
       .innerJoin(eventImpacts, eq(eventImpactOutcomes.eventImpactId, eventImpacts.id))
       .where(and(
           eq(eventImpactOutcomes.status, 'pending'),
           lte(eventImpactOutcomes.dueAt, now)
       ))
       .limit(100);
   ```

2. **Process each outcome:**
   For each due outcome:
   a. Check `priceAtEvent` is not null — if null, mark as 'failed' with "Missing price_at_event"
   b. Validate `coinSymbol` is a valid Binance pair (format: BTCUSDT, ETHUSDT, etc.)
   c. Fetch candles: `getCoinKlinesRange(coinSymbol + 'USDT', '1h', publishedAtMs, dueAtMs)`
   d. If candles empty → mark as 'failed' with "No candles available from Binance"
   e. Find price at horizon (closest candle to dueAt)
   f. Calculate change_percent: `((priceAtHorizon - priceAtEvent) / priceAtEvent) * 100`
   g. Calculate max_upside, max_drawdown, time_to_peak, time_to_bottom from all candles
   h. Classify outcome at the horizon level:
      - >15%: strong_bullish
      - >5%: bullish
      - [-5%, +5%]: neutral
      - >-15%: bearish
      - <=-15%: strong_bearish
   i. Update the outcome record with all calculated fields + status='completed'

3. **Coin symbol handling:**
   - `coinSymbol` in the DB is stored as 'BTC', 'ETH', etc. (without USDT suffix)
   - Binance API requires 'BTCUSDT', 'ETHUSDT'
   - Append 'USDT' when calling `getCoinKlinesRange()`
   - If the coin is not on Binance (API returns empty candles), mark as 'unsupported'

4. **Metric calculation logic (from eventOutcomeChecker.cron.ts lines 154-175):**
   ```typescript
   let maxUpside = 0;
   let maxDrawdown = 0;
   let peakTimeMs = 0;
   let bottomTimeMs = 0;

   for (const candle of allCandles) {
       const changePct = ((candle.close - priceAtEvent) / priceAtEvent) * 100;
       if (changePct > maxUpside) {
           maxUpside = changePct;
           peakTimeMs = candle.closeTime;
       }
       if (changePct < maxDrawdown) {
           maxDrawdown = changePct;
           bottomTimeMs = candle.closeTime;
       }
   }

   const timeToPeakHours = peakTimeMs > 0 ? Math.round((peakTimeMs - publishedAtMs) / 3600000) : null;
   const timeToBottomHours = bottomTimeMs > 0 ? Math.round((bottomTimeMs - publishedAtMs) / 3600000) : null;
   ```

5. **Classification thresholds (same as eventOutcomeChecker.cron.ts lines 178-186):**
   ```typescript
   let classification: string;
   if (changePercent > 15) classification = 'strong_bullish';
   else if (changePercent > 5) classification = 'bullish';
   else if (changePercent > -5) classification = 'neutral';
   else if (changePercent > -15) classification = 'bearish';
   else classification = 'strong_bearish';
   ```

6. **Update query:**
   ```typescript
   await db.update(eventImpactOutcomes)
       .set({
           priceAtHorizon: priceAtHorizon,
           changePercent,
           maxUpsidePercent: maxUpside,
           maxDrawdownPercent: maxDrawdown,
           timeToPeakHours,
           timeToBottomHours,
           outcomeClassification: classification,
           status: 'completed',
           checkedAt: new Date(),
           updatedAt: new Date(),
       })
       .where(eq(eventImpactOutcomes.id, outcomeId));
   ```

7. **Failure cases:**
   ```typescript
   // Price at event missing:
   await db.update(eventImpactOutcomes)
       .set({ status: 'failed', errorMessage: 'Missing price_at_event', checkedAt: new Date(), updatedAt: new Date() })
       .where(eq(eventImpactOutcomes.id, outcomeId));

   // No candles from Binance (non-Binance coin):
   await db.update(eventImpactOutcomes)
       .set({ status: 'unsupported', errorMessage: `No candles for ${coinSymbol} on Binance`, checkedAt: new Date(), updatedAt: new Date() })
       .where(eq(eventImpactOutcomes.id, outcomeId));

   // Binance API error:
   await db.update(eventImpactOutcomes)
       .set({ status: 'failed', errorMessage: 'Binance API error', checkedAt: new Date(), updatedAt: new Date() })
       .where(eq(eventImpactOutcomes.id, outcomeId));
   ```

8. **server.ts registration (conditional, same pattern as T-1.2):**
   ```typescript
   // Add import at line 27:
   import { startEventImpactOutcomeCheckerCron } from './crons/eventImpactOutcomeChecker.cron';

   // Add conditional registration:
   if (env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED) {
       setTimeout(() => {
           try {
               startEventImpactOutcomeCheckerCron();
               logger.info('[Server] Optional cron started: EventImpactOutcomeChecker');
           } catch (error) {
               logger.error('[Server] Failed to start optional cron EventImpactOutcomeChecker: %s', error instanceof Error ? error.message : String(error));
           }
       }, crons.length * cronStartDelay);
   }
   ```

**Step-by-step instructions for Senior Developer:**

1. Create `backend/src/crons/eventImpactOutcomeChecker.cron.ts`
2. Import: cron, db, Drizzle operators (eq, lte, and), binance getCoinKlinesRange, logger, env
3. Implement `runEventImpactOutcomeChecker()`:
   a. Check `env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` — return early if false
   b. Query due outcomes via INNER JOIN with event_impacts
   c. Loop through outcomes, call `processOutcome(outcome)`
   d. Log summary
4. Implement `processOutcome()`:
   a. Validate priceAtEvent not null
   b. Append 'USDT' to coinSymbol
   c. Fetch candles via getCoinKlinesRange
   d. Handle failure cases (no candles, API error)
   e. Calculate metrics (change, max upside/drawdown, times)
   f. Classify outcome
   g. Update record
5. Implement `startEventImpactOutcomeCheckerCron()` with `*/30 * * * *` schedule
6. Export both functions
7. Add import to server.ts at line 27
8. Add conditional registration in server.ts

**Acceptance criteria:**
- Cron finds due pending outcomes via INNER JOIN
- Fetches Binance klines correctly (USDT suffix appended)
- Calculates all 6 metrics correctly
- Classifies outcome using correct thresholds
- Handles failure cases (missing price, no candles, API error)
- Non-Binance coins marked as 'unsupported'
- Feature-flagged
- Registered in server.ts conditionally
- Zero `any` types
- `tsc --noEmit` clean

**QA checklist:**
- [ ] File created at correct path
- [ ] INNER JOIN query joins eventImpactOutcomes with eventImpacts
- [ ] WHERE: status='pending' AND due_at <= now()
- [ ] LIMIT 100 per run
- [ ] env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED check at function start
- [ ] USDT suffix appended to coinSymbol for Binance API
- [ ] priceAtEvent null check (mark 'failed')
- [ ] Empty candles check (mark 'unsupported' or 'failed')
- [ ] change_percent calculated: ((priceAtHorizon - priceAtEvent) / priceAtEvent) * 100
- [ ] max_upside_percent: max positive change across all candles
- [ ] max_drawdown_percent: max negative change across all candles
- [ ] time_to_peak_hours: (peakCandle.closeTime - publishedAt) / 3600000
- [ ] time_to_bottom_hours: (bottomCandle.closeTime - publishedAt) / 3600000
- [ ] Classification thresholds: strong_bullish(>15), bullish(>5), neutral(±5), bearish(>-15), strong_bearish(<=-15)
- [ ] Update sets status='completed', checkedAt=now()
- [ ] Failure updates set appropriate status + errorMessage
- [ ] Outer try/catch with logger.error
- [ ] Inner try/catch per outcome
- [ ] Summary logged: processed, completed, failed, unsupported
- [ ] Export: runEventImpactOutcomeChecker + startEventImpactOutcomeCheckerCron
- [ ] server.ts import + conditional registration
- [ ] Zero `any` types
- [ ] `tsc --noEmit` clean

**Dependencies:** T-1.4 (env flag must exist)

**Rollback notes:**
- Delete `backend/src/crons/eventImpactOutcomeChecker.cron.ts`
- Revert server.ts (remove import + conditional block)
- Outcome records with status='completed' remain in DB (harmless, no rollback needed)

---

### T-1.4 — Add Phase 1 Feature Flags

**Task ID:** T-1.4
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Add two new feature flags to `backend/src/config/env.ts` for the new crons created in T-1.2 and T-1.3.

**Files to inspect:**
- `backend/src/config/env.ts` — existing env schema (lines 84-88 for event impact flags, lines 77-91 for all feature flags)

**Files allowed to modify:**
- `backend/src/config/env.ts` (add 2 new boolean flags)

**Forbidden files:**
- Any other files

**Design specification:**

Add two new boolean flags after the existing event impact flags (after line 88):

```typescript
// Event Impact Engine (Phase 6A/6B — existing, keep unchanged)
EVENT_IMPACT_ENGINE_ENABLED: z.boolean().default(false),
EVENT_IMPACT_PERSISTENCE_ENABLED: z.boolean().default(false),
EVENT_IMPACT_BACKFILL_ENABLED: z.boolean().default(false),
EVENT_IMPACT_BACKFILL_DRY_RUN: z.boolean().default(true),

// Event Impact Engine — Phase 1 Activation (NEW)
EVENT_IMPACT_SYNC_ENABLED: z.boolean().default(false),
EVENT_IMPACT_OUTCOME_CHECKER_ENABLED: z.boolean().default(false),
```

**Constraints:**
- Both flags default to `false` (safe — crons won't run unless explicitly enabled)
- Use `z.boolean().default(false)` pattern (same as existing flags)
- Add after existing EVENT_IMPACT_BACKFILL_DRY_RUN (line 88)
- Before MONITORING_CRON_ENABLED (line 91)

**Step-by-step instructions:**

1. Open `backend/src/config/env.ts`
2. After line 88 (`EVENT_IMPACT_BACKFILL_DRY_RUN: z.boolean().default(true),`), add:
   ```typescript
   EVENT_IMPACT_SYNC_ENABLED: z.boolean().default(false),
   EVENT_IMPACT_OUTCOME_CHECKER_ENABLED: z.boolean().default(false),
   ```
3. Verify `tsc --noEmit` clean
4. Verify no other files modified

**Acceptance criteria:**
- Two new flags added with correct Zod schema
- Both default to `false`
- Placed logically with other event impact flags
- `tsc --noEmit` clean

**QA checklist:**
- [ ] `EVENT_IMPACT_SYNC_ENABLED: z.boolean().default(false)` present
- [ ] `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED: z.boolean().default(false)` present
- [ ] Both default to false
- [ ] Placed after existing event impact flags
- [ ] No other lines changed in env.ts
- [ ] `tsc --noEmit` clean

**Dependencies:** None (this should be the FIRST code task executed)

**Rollback notes:**
- Remove the 2 added lines from env.ts

---

### T-1.5 — Production Activation Runbook

**Task ID:** T-1.5
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Prompt Engineer
**Status:** ✅ COMPLETED

**Objective:**
Document a comprehensive production activation runbook for enabling the Event Impact Engine in production. This covers the entire sequence from migration to full activation.

---

## PRODUCTION ACTIVATION RUNBOOK — Phase 1: Event Impact Engine

**Version:** 1.0
**Date:** May 4, 2026
**Author:** Prompt Engineer
**Prerequisites:** Phase 6A (✅ complete) + Phase 6B (✅ complete) — both pushed

---

### Day 0 — Pre-Activation Checks

Before any activation steps, verify the following:

- [ ] **Phase 6B deployed successfully** — `event_impacts` and `event_impact_outcomes` tables exist in DB, `eventImpactPersistence.service.ts` deployed
- [ ] **All Phase 1 flags are currently false:**
  ```bash
  # Verify in .env or runtime:
  EVENT_IMPACT_SYNC_ENABLED=false
  EVENT_IMPACT_OUTCOME_CHECKER_ENABLED=false
  EVENT_IMPACT_PERSISTENCE_ENABLED=false
  EVENT_IMPACT_BACKFILL_ENABLED=false
  ```
- [ ] **Run intelligence health check:**
  ```bash
  node backend/scripts/verify-intelligence-health.js
  ```
  Verify no critical errors in output.
- [ ] **Existing crons are healthy** — check server logs for all 14 crons registering without error on startup
- [ ] **Database backup:**
  ```bash
  pg_dump $DATABASE_URL > backup_pre_phase1_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Binance API accessible:**
  ```bash
  curl -s "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1"
  ```
  Should return JSON array with candle data.
- [ ] **Phase 1 code deployed** — `tsc --noEmit` clean, both new cron files present

---

### Step 1 — Run Migration

Create the `event_impacts` and `event_impact_outcomes` tables.

**1.1. Execute migration:**
```bash
psql $DATABASE_URL -f backend/scripts/migrate-event-impacts.sql
```

Expected output: `CREATE TABLE`, `CREATE INDEX` (no errors).

**1.2. Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('event_impacts', 'event_impact_outcomes');
-- Expected: 2 rows
```

**1.3. Verify indexes created:**
```sql
SELECT indexname, tablename FROM pg_indexes
WHERE tablename IN ('event_impacts', 'event_impact_outcomes')
ORDER BY tablename, indexname;
-- Expected: 5 indexes for event_impacts, 4 indexes for event_impact_outcomes
```

**1.4. Verify foreign keys correct:**
```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('event_impacts', 'event_impact_outcomes');
-- Expected:
--   event_impacts.source_id → coin_news_history.id ON DELETE SET NULL
--   event_impact_outcomes.event_impact_id → event_impacts.id ON DELETE CASCADE
```

**1.5. Verify no data exists yet:**
```sql
SELECT count(*) AS event_impacts_count FROM event_impacts;
-- Expected: 0

SELECT count(*) AS outcomes_count FROM event_impact_outcomes;
-- Expected: 0
```

---

### Step 2 — Run Backfill in Dry-Run Mode

Preview what the backfill would write without actually writing anything.

**2.1. Set flags:**
```bash
EVENT_IMPACT_BACKFILL_ENABLED=true      # Enable backfill script
EVENT_IMPACT_BACKFILL_DRY_RUN=true       # Default — keep as dry-run
```

**2.2. Execute:**
```bash
npx ts-node backend/scripts/backfill-event-impacts.ts
```

**2.3. Review output:**
- Note the `Eligible` count (records with eventSeverity IS NOT NULL)
- Note the `Would Create` count (should equal Eligible minus already-existing)
- Verify no errors in output

**2.4. Verify no actual writes:**
```sql
SELECT count(*) FROM event_impacts;
-- Expected: 0 (dry-run produces no writes)

SELECT count(*) FROM event_impact_outcomes;
-- Expected: 0
```

---

### Step 3 — Run Backfill in Execute Mode

Write historical event data to the new tables.

**3.1. Enable persistence (required for writes):**
```bash
EVENT_IMPACT_PERSISTENCE_ENABLED=true   # Required for persist functions to write
```

**3.2. Execute backfill:**
```bash
npx ts-node backend/scripts/backfill-event-impacts.ts --execute
```

**3.3. Monitor logs:**
- Watch for batch progress output
- Watch for error count in final summary
- Note total Created count

**3.4. Verify event_impacts rows created:**
```sql
SELECT count(*) AS total_impacts FROM event_impacts;
-- Expected: matches "Created" count from backfill summary

SELECT status, count(*) FROM event_impacts GROUP BY status;
-- Expected: mix of 'completed' (all 5 horizons had data) and 'pending'
```

**3.5. Verify event_impact_outcomes rows created:**
```sql
SELECT count(*) AS total_outcomes FROM event_impact_outcomes;
-- Expected: ~5x the event_impacts count (5 horizons per event)

SELECT status, count(*) FROM event_impact_outcomes GROUP BY status;
-- Expected: mix of 'completed' (had pre-existing change data) and 'pending' (awaiting outcome check)
```

**3.6. Disable backfill after completion:**
```bash
EVENT_IMPACT_BACKFILL_ENABLED=false      # Disable — one-time operation complete
```

---

### Step 4 — Enable Sync Cron

Start the automatic sync of new coin_news_history records into event_impacts.

**4.1. Set flag:**
```bash
EVENT_IMPACT_SYNC_ENABLED=true
```

**4.2. Restart server** to pick up the new flag.

**4.3. Monitor for 1–2 hours:**
- Check server logs for: `EventImpactSync scheduled — every 30 minutes`
- After first run (~30 min), check logs for sync summary: `{ scanned, synced, skipped, errors }`
- Verify new coin_news_history records (with eventSeverity) are creating event_impacts

**4.4. Verification queries:**
```sql
-- New records created since activation
SELECT count(*) AS new_impacts FROM event_impacts
WHERE created_at > NOW() - INTERVAL '2 hours';

-- Verify source linkage
SELECT ei.id, ei.coin_symbol, ei.published_at, cnh.title
FROM event_impacts ei
LEFT JOIN coin_news_history cnh ON ei.source_id = cnh.id
WHERE ei.created_at > NOW() - INTERVAL '2 hours'
ORDER BY ei.published_at DESC
LIMIT 10;
```

---

### Step 5 — Enable Outcome Checker

Start the automatic checking of due outcomes against real Binance price data.

**5.1. Set flag:**
```bash
EVENT_IMPACT_OUTCOME_CHECKER_ENABLED=true
```

**5.2. Restart server** to pick up the new flag.

**5.3. Monitor for 24 hours:**
- Check server logs for: `EventImpactOutcomeChecker scheduled — every 30 minutes`
- After each run, check logs for summary: `{ processed, completed, failed, unsupported }`
- Verify pending outcomes (where due_at <= now) are being filled

**5.4. Verification queries:**
```sql
-- Outcomes completed since activation
SELECT count(*) AS completed_outcomes FROM event_impact_outcomes
WHERE status = 'completed' AND checked_at > NOW() - INTERVAL '24 hours';

-- Pending outcomes still awaiting check
SELECT count(*) AS pending_overdue FROM event_impact_outcomes
WHERE status = 'pending' AND due_at <= NOW();

-- Failed outcomes (investigate)
SELECT count(*) AS failed FROM event_impact_outcomes
WHERE status = 'failed' AND checked_at > NOW() - INTERVAL '24 hours';

-- Unsupported outcomes (non-Binance coins)
SELECT count(*) AS unsupported FROM event_impact_outcomes
WHERE status = 'unsupported';

-- Error messages for failed outcomes
SELECT error_message, count(*) FROM event_impact_outcomes
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count(*) DESC;
```

---

### Daily Monitoring (Days 1–7)

Run these checks every day during the stabilization window:

**Health check script:**
```bash
node backend/scripts/verify-intelligence-health.js
```

**DB growth monitoring:**
```sql
-- 1. Event impacts created per day (last 7 days)
SELECT
    DATE(created_at) AS day,
    count(*) AS new_impacts
FROM event_impacts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- 2. Outcomes filled per day (last 7 days)
SELECT
    DATE(checked_at) AS day,
    status,
    count(*) AS count
FROM event_impact_outcomes
WHERE checked_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(checked_at), status
ORDER BY day DESC, status;

-- 3. Pending outcomes >24h overdue
SELECT count(*) AS overdue_pending FROM event_impact_outcomes
WHERE status = 'pending' AND due_at < NOW() - INTERVAL '24 hours';

-- 4. Failed outcomes breakdown
SELECT status, count(*),
    round(count(*)::numeric * 100.0 / sum(count(*)) over(), 1) AS pct
FROM event_impact_outcomes
GROUP BY status
ORDER BY count(*) DESC;

-- 5. Unsupported coins (non-Binance)
SELECT DISTINCT ei.coin_symbol, count(*) AS outcome_count
FROM event_impact_outcomes eio
JOIN event_impacts ei ON eio.event_impact_id = ei.id
WHERE eio.status = 'unsupported'
GROUP BY ei.coin_symbol
ORDER BY outcome_count DESC;

-- 6. Duplicate prevention check (should always return 0)
SELECT source_id, count(*) AS dupes
FROM event_impacts
WHERE source_id IS NOT NULL
GROUP BY source_id
HAVING count(*) > 1;
-- Expected: 0 rows (UNIQUE index prevents this)
```

**Server log monitoring:**
- Grep for `[EventImpactSync]` errors
- Grep for `[EventImpactOutcomeChecker]` errors
- Grep for Binance API errors (429 status, timeouts)
- Check server memory usage

---

### Healthy / Warning Thresholds

| Metric | Healthy | Warning | Action |
|--------|---------|---------|--------|
| event_impacts created/day | >0 (if news flowing) | 0 for 24h | Check coin_news_history ingestion, check eventSeverity population |
| event_impact_outcomes filled/day | >0 (after 1h horizon passes) | <50% of due outcomes | Check outcome checker cron logs, Binance API status |
| Pending outcomes >24h overdue | 0 | >10 | Check outcome checker is running, check Binance availability |
| Failed outcomes percentage | <5% | >10% | Investigate error_message distribution |
| Unsupported coins percentage | <10% | >20% | Expected for obscure coins; if high, review coin_news_history source quality |
| Binance API error rate (429s) | 0/hour | >3/hour | Reduce outcome checker LIMIT or increase interval |
| Server memory | <70% | >80% | Reduce batch sizes, check for memory leaks in outcome checker |

---

### Rollback Procedure

**Soft rollback (flags only — data preserved):**
```bash
EVENT_IMPACT_SYNC_ENABLED=false
EVENT_IMPACT_OUTCOME_CHECKER_ENABLED=false
EVENT_IMPACT_PERSISTENCE_ENABLED=false
```
Restart server. New events will no longer create event_impacts. All existing data remains in tables (harmless, zero impact on other features).

**Full rollback (data removal — ONLY if absolutely necessary):**
```sql
DROP TABLE IF EXISTS event_impact_outcomes;   -- Must drop first (FK depends on event_impacts)
DROP TABLE IF EXISTS event_impacts;
```
No existing tables are affected. CASCADE on DROP handles index cleanup.

**Code rollback (if Phase 1 code needs removal):**
1. Delete `backend/src/crons/eventImpactSync.cron.ts`
2. Delete `backend/src/crons/eventImpactOutcomeChecker.cron.ts`
3. Revert `backend/src/server.ts` (remove 2 imports + 2 conditional registration blocks)
4. Revert `backend/src/config/env.ts` (remove 2 Phase 1 flags)

---

### Flag Reference

| Flag | Default | Purpose | Set When |
|------|---------|---------|----------|
| `EVENT_IMPACT_PERSISTENCE_ENABLED` | `false` | Allows persist functions to write | Before migration + backfill |
| `EVENT_IMPACT_BACKFILL_ENABLED` | `false` | Allows backfill script to run | Step 2 (dry-run), Step 3 (execute) |
| `EVENT_IMPACT_BACKFILL_DRY_RUN` | `true` | Backfill preview mode (no writes) | Step 2 (keep true), Step 3 (set false) |
| `EVENT_IMPACT_SYNC_ENABLED` | `false` | Enables sync cron (30 min) | Step 4 |
| `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` | `false` | Enables outcome checker cron (30 min) | Step 5 |

**Flag enablement order:** persistence → backfill → sync → outcome checker

---

*Runbook authored: May 4, 2026 | Prompt Engineer | Phase 1 — Minimum Data Foundation*

---

### T-1.6 — Documentation Update

**Task ID:** T-1.6
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Prompt Engineer
**Status:** ✅ COMPLETED

**Objective:**
Update PROJECT_STATE.md and AGENT_LOGS.md to reflect Phase 1 documentation tasks completion.

**Files modified:**
- `agent_gedens/PROJECT_STATE.md` — Phase 1 docs tasks (T-1.5, T-1.6, T-1.7) status updated
- `agent_gedens/AGENT_LOGS.md` — T-1.5, T-1.6, T-1.7 completion entries added

**Updates performed:**

1. **PROJECT_STATE.md:**
   - Phase 1 task statuses updated to reflect documentation completion
   - T-1.5 (Runbook): ✅ COMPLETED
   - T-1.6 (Docs Update): ✅ COMPLETED
   - T-1.7 (QA Checklist): ✅ COMPLETED

2. **AGENT_LOGS.md:**
   - T-1.5 runbook completion entry added
   - T-1.6 documentation update entry added
   - T-1.7 QA checklist completion entry added

3. **THE_NEXUS_HUB.md:**
   - T-1.5 status updated to ✅ COMPLETED with full runbook
   - T-1.6 status updated to ✅ COMPLETED
   - T-1.7 status updated to ✅ COMPLETED with full QA checklist
   - Phase 1 header status updated

**Acceptance criteria:**
- [x] PROJECT_STATE.md reflects documentation task completion
- [x] AGENT_LOGS.md has completion entries for T-1.5, T-1.6, T-1.7
- [x] THE_NEXUS_HUB.md updated with completed statuses

**Dependencies:** None (documentation tasks are independent)

---

### T-1.7 — QA Checklist

**Task ID:** T-1.7
**Phase:** Phase 1 — Minimum Data Foundation
**Assigned Agent:** Prompt Engineer
**Status:** ✅ COMPLETED

**Objective:**
Comprehensive QA checklist for validating all Phase 1 deliverables before production activation.

---

## PHASE 1 — COMPREHENSIVE QA CHECKLIST

---

### A. Cron Registration Safety

- [ ] **A1.** `eventImpactSync.cron.ts` is NOT in the main `crons` array in `server.ts` (lines 94-112)
- [ ] **A2.** `eventImpactOutcomeChecker.cron.ts` is NOT in the main `crons` array in `server.ts`
- [ ] **A3.** Both new crons use the conditional registration pattern (lines 125-135 style)
- [ ] **A4.** Sync cron registration wrapped in `if (env.EVENT_IMPACT_SYNC_ENABLED)`
- [ ] **A5.** Outcome checker registration wrapped in `if (env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED)`
- [ ] **A6.** Both conditional blocks use `setTimeout` with `crons.length * cronStartDelay`
- [ ] **A7.** Both conditional blocks have try/catch with `logger.error` on failure
- [ ] **A8.** Server starts without errors when both flags are false (default)
- [ ] **A9.** Existing 14 crons still register normally (no regressions)
- [ ] **A10.** Import paths for both new crons are correct in server.ts

---

### B. Feature Flag Defaults

- [ ] **B1.** `EVENT_IMPACT_SYNC_ENABLED` defaults to `false` in `env.ts`
- [ ] **B2.** `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` defaults to `false` in `env.ts`
- [ ] **B3.** All 6 event impact flags present in `env.ts` (4 Phase 6B + 2 Phase 1):
  - `EVENT_IMPACT_ENGINE_ENABLED` (default false)
  - `EVENT_IMPACT_PERSISTENCE_ENABLED` (default false)
  - `EVENT_IMPACT_BACKFILL_ENABLED` (default false)
  - `EVENT_IMPACT_BACKFILL_DRY_RUN` (default true)
  - `EVENT_IMPACT_SYNC_ENABLED` (default false)
  - `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` (default false)
- [ ] **B4.** Missing env vars do NOT crash the server (Zod defaults)
- [ ] **B5.** Flags are accessible via `env.FLAG_NAME` in code
- [ ] **B6.** No other env flags were modified or renamed

---

### C. Disabled Flag Behavior

- [ ] **C1.** When `EVENT_IMPACT_SYNC_ENABLED=false`: sync cron function returns early without querying DB
- [ ] **C2.** When `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED=false`: outcome checker function returns early without querying DB
- [ ] **C3.** When both flags are false: zero references to event_impacts/event_impact_outcomes tables in server logs
- [ ] **C4.** Server memory footprint unchanged when flags are false (cron functions not loaded into memory path)
- [ ] **C5.** No background processes or side effects when flags are false

---

### D. No Existing Cron Modifications

- [ ] **D1.** `aiWorkflow.cron.ts` — unchanged (verify via git diff)
- [ ] **D2.** `triageEngine.cron.ts` — unchanged (if exists)
- [ ] **D3.** `eventOutcomeChecker.cron.ts` — unchanged (this is the existing Phase 6A outcome checker)
- [ ] **D4.** `scenarioOutcomeChecker.cron.ts` — unchanged
- [ ] **D5.** `signalPerformance.cron.ts` — unchanged
- [ ] **D6.** `tpslMonitor.cron.ts` — unchanged
- [ ] **D7.** `airdropDiscovery.cron.ts` — unchanged
- [ ] **D8.** `airdropRssHunter.cron.ts` — unchanged
- [ ] **D9.** `convictionUpdate.cron.ts` — unchanged
- [ ] **D10.** `historicalNews.cron.ts` — unchanged
- [ ] **D11.** `telegramMonitor.cron.ts` — unchanged
- [ ] **D12.** `levelIntelligenceCron.ts` — unchanged

**Verification:** `git diff --name-only` should only show `server.ts`, `env.ts`, and the 2 new cron files.

---

### E. No Existing Service Modifications

- [ ] **E1.** `eventImpactAnalysis.service.ts` — unchanged
- [ ] **E2.** `eventImpactPersistence.service.ts` — unchanged (used by new crons but not modified)
- [ ] **E3.** `openai.service.ts` — unchanged
- [ ] **E4.** `binance.service.ts` — unchanged (used by outcome checker but not modified)
- [ ] **E5.** All other service files — unchanged

**Verification:** No service file in `backend/src/services/` modified except the 2 new cron files.

---

### F. No Existing Table Modifications

- [ ] **F1.** `coin_news_history` table — schema unchanged
- [ ] **F2.** `coin_memory` table — schema unchanged
- [ ] **F3.** `radarSignals` table — schema unchanged
- [ ] **F4.** `signalPerformance` table — schema unchanged
- [ ] **F5.** `market_scenarios` table — schema unchanged
- [ ] **F6.** No `ALTER TABLE` statements in migration SQL
- [ ] **F7.** Migration SQL only contains `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX`

**Verification:** `grep -i "ALTER TABLE" backend/scripts/migrate-event-impacts.sql` returns nothing.

---

### G. Outcome Reuse from coin_news_history

- [ ] **G1.** Backfill correctly maps `change1h` → 1h horizon outcome `change_percent`
- [ ] **G2.** Backfill correctly maps `change4h` → 4h horizon outcome `change_percent`
- [ ] **G3.** Backfill correctly maps `change24h` → 24h horizon outcome `change_percent`
- [ ] **G4.** Backfill correctly maps `change3d` → 3d (72h) horizon outcome `change_percent`
- [ ] **G5.** Backfill correctly maps `change7d` → 7d (168h) horizon outcome `change_percent`
- [ ] **G6.** Backfill correctly maps `priceXhAfter` → `price_at_horizon`
- [ ] **G7.** Backfill correctly maps `maxUpsideAfterEvent` → `max_upside_percent` (same for all 5 horizons)
- [ ] **G8.** Backfill correctly maps `maxDrawdownAfterEvent` → `max_drawdown_percent` (same for all 5 horizons)
- [ ] **G9.** Backfill correctly maps `timeToPeakHours` → `time_to_peak_hours` (same for all 5 horizons)
- [ ] **G10.** Backfill correctly maps `timeToBottomHours` → `time_to_bottom_hours` (same for all 5 horizons)
- [ ] **G11.** Backfill correctly maps `outcomeClassification` → `outcome_classification` (same for all 5 horizons)
- [ ] **G12.** `due_at` calculated correctly: `published_at + horizon_hours`
- [ ] **G13.** `status` set to `'completed'` when `change_percent` is not null, `'pending'` otherwise

---

### H. Idempotency

- [ ] **H1.** Sync cron LEFT JOIN query skips already-synced records (WHERE event_impacts.id IS NULL)
- [ ] **H2.** Running sync cron twice produces no duplicate event_impacts
- [ ] **H3.** UNIQUE index on `event_impacts.source_id` prevents duplicates at DB level
- [ ] **H4.** UNIQUE index on `event_impact_outcomes (event_impact_id, horizon)` prevents duplicate outcomes
- [ ] **H5.** Backfill script skips already-processed records (checks source_id existence)
- [ ] **H6.** Running backfill script twice produces identical results (same row counts)
- [ ] **H7.** Outcome checker only processes `status='pending'` records (skips already-completed)
- [ ] **H8.** Migration SQL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` (idempotent)

---

### I. Error Handling

- [ ] **I1.** Sync cron has outer try/catch in `runEventImpactSync()`
- [ ] **I2.** Sync cron has inner try/catch per row (failed rows don't stop batch)
- [ ] **I3.** Sync cron logs summary: `{ scanned, synced, skipped, errors }`
- [ ] **I4.** Outcome checker has outer try/catch in `runEventImpactOutcomeChecker()`
- [ ] **I5.** Outcome checker has inner try/catch per outcome
- [ ] **I6.** Outcome checker logs summary: `{ processed, completed, failed, unsupported }`
- [ ] **I7.** Outcome checker handles missing `priceAtEvent` → marks as 'failed' with error message
- [ ] **I8.** Outcome checker handles empty candles from Binance → marks as 'unsupported'
- [ ] **I9.** Outcome checker handles Binance API errors → marks as 'failed' with error message
- [ ] **I10.** Both crons log errors via `logger.error` (not console.log)
- [ ] **I11.** Neither cron crashes the server on error (both use try/catch in startCron)

---

### J. TypeScript Quality

- [ ] **J1.** `tsc --noEmit` clean on entire backend
- [ ] **J2.** Zero `any` types in `eventImpactSync.cron.ts` (verify: `rg '\bany\b' backend/src/crons/eventImpactSync.cron.ts`)
- [ ] **J3.** Zero `any` types in `eventImpactOutcomeChecker.cron.ts` (verify: `rg '\bany\b' backend/src/crons/eventImpactOutcomeChecker.cron.ts`)
- [ ] **J4.** All Drizzle query results properly typed (no implicit `any` from ORM)
- [ ] **J5.** `CoinNewsHistoryRecord` type used correctly (no unsafe casts)
- [ ] **J6.** Import paths are correct and resolve without errors
- [ ] **J7.** No `@ts-ignore` or `@ts-expect-error` directives

---

### K. No External API Additions

- [ ] **K1.** No new API endpoints added to `market.routes.ts`
- [ ] **K2.** No new controller handlers added to `market.controller.ts`
- [ ] **K3.** Outcome checker uses ONLY existing `getCoinKlinesRange()` from `binance.service.ts`
- [ ] **K4.** No new HTTP client libraries installed
- [ ] **K5.** No new external API URLs referenced in new code
- [ ] **K6.** Sync cron makes zero network calls (DB only)
- [ ] **K7.** `package.json` has no new dependencies

**Verification:** `git diff package.json` shows no changes (or only dev dependency changes).

---

### L. Sync Cron Implementation (T-1.2)

- [ ] **L1.** File exists at `backend/src/crons/eventImpactSync.cron.ts`
- [ ] **L2.** Exports: `runEventImpactSync`, `startEventImpactSyncCron`
- [ ] **L3.** Schedule: `*/30 * * * *` (every 30 minutes)
- [ ] **L4.** Env flag check at function start: `env.EVENT_IMPACT_SYNC_ENABLED`
- [ ] **L5.** LEFT JOIN query: `coinNewsHistory LEFT JOIN eventImpacts ON eventImpacts.sourceId = coinNewsHistory.id`
- [ ] **L6.** WHERE conditions: `isNotNull(eventSeverity)`, `isNull(eventImpacts.id)`, `gt(publishedAt, 48h ago)`
- [ ] **L7.** `orderBy(desc(publishedAt))` + `.limit(50)`
- [ ] **L8.** Defensive filter: `unsyncedRows.filter(row => !row.eventImpacts)`
- [ ] **L9.** Calls `persistEventImpact()` then `persistEventImpactOutcomes()` per row
- [ ] **L10.** Summary logged at end of run

---

### M. Outcome Checker Cron Implementation (T-1.3)

- [ ] **M1.** File exists at `backend/src/crons/eventImpactOutcomeChecker.cron.ts`
- [ ] **M2.** Exports: `runEventImpactOutcomeChecker`, `startEventImpactOutcomeCheckerCron`
- [ ] **M3.** Schedule: `*/30 * * * *` (every 30 minutes)
- [ ] **M4.** Env flag check at function start: `env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED`
- [ ] **M5.** INNER JOIN query: `eventImpactOutcomes JOIN eventImpacts`
- [ ] **M6.** WHERE: `eq(status, 'pending')` AND `lte(dueAt, now)`
- [ ] **M7.** `.limit(100)`
- [ ] **M8.** USDT suffix appended: `coinSymbol + 'USDT'` for Binance API
- [ ] **M9.** `priceAtEvent` null check → status 'failed'
- [ ] **M10.** Empty candles → status 'unsupported'
- [ ] **M11.** `change_percent = ((priceAtHorizon - priceAtEvent) / priceAtEvent) * 100`
- [ ] **M12.** `max_upside_percent` = max positive change across all candles
- [ ] **M13.** `max_drawdown_percent` = max negative change across all candles
- [ ] **M14.** `time_to_peak_hours` = `(peakCandle.closeTime - publishedAtMs) / 3600000`
- [ ] **M15.** `time_to_bottom_hours` = `(bottomCandle.closeTime - publishedAtMs) / 3600000`
- [ ] **M16.** Classification thresholds: strong_bullish (>15), bullish (>5), neutral (±5), bearish (>-15), strong_bearish (<=-15)
- [ ] **M17.** Update sets: `status='completed'`, `checkedAt=new Date()`, `updatedAt=new Date()`
- [ ] **M18.** Failure updates set appropriate `status` + `errorMessage`

---

### N. Runbook Verification (T-1.5)

- [ ] **N1.** All flag names in runbook match `env.ts` exactly
- [ ] **N2.** All SQL queries in runbook are syntactically correct for PostgreSQL
- [ ] **N3.** Migration execution steps documented with verification queries
- [ ] **N4.** Backfill steps follow dry-run → execute sequence
- [ ] **N5.** Flag enablement order: persistence → backfill → sync → outcome checker
- [ ] **N6.** Monitoring queries return useful diagnostic data
- [ ] **N7.** Rollback sets all Phase 1 flags to false
- [ ] **N8.** Full rollback SQL drops tables in correct order (outcomes first)
- [ ] **N9.** Healthy/warning thresholds defined with actionable responses
- [ ] **N10.** Daily monitoring section covers 7-day stabilization window

---

### Summary Scorecard

| Section | Items | Status |
|---------|-------|--------|
| A. Cron Registration Safety | 10 | ☐ |
| B. Feature Flag Defaults | 6 | ☐ |
| C. Disabled Flag Behavior | 5 | ☐ |
| D. No Existing Cron Modifications | 12 | ☐ |
| E. No Existing Service Modifications | 5 | ☐ |
| F. No Existing Table Modifications | 7 | ☐ |
| G. Outcome Reuse from coin_news_history | 13 | ☐ |
| H. Idempotency | 8 | ☐ |
| I. Error Handling | 11 | ☐ |
| J. TypeScript Quality | 7 | ☐ |
| K. No External API Additions | 7 | ☐ |
| L. Sync Cron Implementation | 10 | ☐ |
| M. Outcome Checker Implementation | 18 | ☐ |
| N. Runbook Verification | 10 | ☐ |
| **TOTAL** | **129** | **☐/129** |

**QA PASS Criteria:** All 129 items checked. Zero blocking failures allowed.

---

*QA Checklist authored: May 4, 2026 | Prompt Engineer | Phase 1 — Minimum Data Foundation*

---

## GUARDRAILS

1. **ZERO `any` types** across all new files.
2. **No existing cron modifications** — new crons only.
3. **No existing service modifications** — use existing `persistEventImpact()` and `persistEventImpactOutcomes()`.
4. **No existing model modifications** — Drizzle models already have event_impacts + event_impact_outcomes.
5. **Feature flags default to `false`** — safe to deploy without enabling.
6. **Conditional server.ts registration** — new crons only start when flags are true.
7. **Idempotent sync** — LEFT JOIN ensures no duplicate event_impacts records.
8. **Graceful failure** — individual outcome check failures don't stop the cron.
9. **Binance only** — no new external APIs.
10. **No AI calls** — outcome checking is deterministic (price data only).
11. **No frontend changes** — this is backend-only.
12. **No commit/push before QA PASS**.

## RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| Binance API rate limits during outcome checking | Medium | LIMIT 100 per run, 30-min interval, handle 429 errors gracefully |
| Non-Binance coins cause repeated failures | Low | Mark as 'unsupported' on first failure, don't retry |
| Sync cron creates duplicates | None | LEFT JOIN + UNIQUE constraint on source_id prevents duplicates |
| Existing pipeline breaks | None | Zero modifications to existing crons/services |
| Large backfill causes DB load | Low | Batch size 100, run during low-traffic period |
| Migration fails | Low | IF NOT EXISTS + documented rollback (DROP TABLE) |

---

---

# Phase 6B — Event Impact Persistence

**Status:** ✅ COMPLETED — Pushed (6a3c9f4)
**Date:** May 4, 2026
**Priority:** P1 (Persists Phase 6A analysis into dedicated parallel tables)
**Scope:** 2 migrations, 2 Drizzle models, 1 persistence service, 1 backfill script, 2 env flags, 1 documentation update, 1 QA checklist
**Reviewed by:** Strategic Planner — APPROVED FOR PLANNING

## OBJECTIVE

Create a persistence layer for the Event Impact Engine. Store calculated event impact data in two dedicated parallel tables (`event_impacts` and `event_impact_outcomes`) that normalize and extend the data already computed by the existing `eventImpactAnalysis.service.ts`. Phase 6B does NOT modify any existing tables or public-facing features.

## PHASE 6B SCOPE LIMITATIONS

**Phase 6B is strictly additive persistence only:**

- ✅ Create new `event_impacts` table (parallel to coin_news_history)
- ✅ Create new `event_impact_outcomes` table (per-horizon outcomes)
- ✅ Create persistence service that reads from coin_news_history and writes to new tables
- ✅ Create backfill script with dry-run mode
- ✅ Add feature flags (default false)
- ✅ Write to new tables only

**Phase 6B explicitly does NOT include:**

- ❌ Modify coin_news_history schema
- ❌ Modify any existing table schema
- ❌ Modify Living Articles
- ❌ Modify scorecard
- ❌ Modify public UI / frontend
- ❌ Add external APIs
- ❌ Modify AI workflow prompts
- ❌ Add prediction/forecasting
- ❌ Enable flags in production
- ❌ Commit or push before QA PASS

## ARCHITECTURE OVERVIEW

```
coin_news_history (existing, read-only)
         │
         ▼
eventImpactPersistence.service.ts (new)
  ├── reads coin_news_history rows
  ├── normalizes into event_impacts row
  ├── generates 5 event_impact_outcomes rows per event
  │     (1h, 4h, 24h, 3d, 7d)
  └── writes ONLY to new tables
         │
         ▼
  ┌─────────────────┐    ┌──────────────────────────┐
  │  event_impacts   │───<│  event_impact_outcomes    │
  │  (1 row/event)   │    │  (5 rows/event)           │
  └─────────────────┘    └──────────────────────────┘
```

## DATA MAPPING

### coin_news_history → event_impacts

| Source Field | Target Field | Transform |
|---|---|---|
| id | source_id | Direct copy (nullable in target) |
| — | source_table | Hardcoded 'coin_news_history' |
| coinSymbol | coinSymbol | Direct copy |
| eventType | eventType | Direct copy |
| eventSeverity | eventSeverity | Direct copy (integer) |
| eventScope | eventScope | Direct copy |
| publishedAt | publishedAt | Direct copy |
| priceAtTime | priceAtEvent | Direct copy |
| — | priceSource | Default 'binance' |
| — | status | 'completed' if all 5 horizons have data, else 'pending' |

### coin_news_history → event_impact_outcomes (5 rows per event)

| Horizon | horizon_hours | change_source | price_source |
|---|---|---|---|
| '1h' | 1 | change1h | price1hAfter |
| '4h' | 4 | change4h | price4hAfter |
| '24h' | 24 | change24h | price24hAfter |
| '3d' | 72 | change3d | price3dAfter |
| '7d' | 168 | change7d | price7dAfter |

Per-outcome row fields:
- change_percent ← changeXh from coin_news_history
- price_at_horizon ← priceXhAfter from coin_news_history
- max_upside_percent ← maxUpsideAfterEvent (same value for all 5 horizons)
- max_drawdown_percent ← maxDrawdownAfterEvent (same value for all 5 horizons)
- time_to_peak_hours ← timeToPeakHours (same value for all 5 horizons)
- time_to_bottom_hours ← timeToBottomHours (same value for all 5 horizons)
- outcome_classification ← outcomeClassification (same value for all 5 horizons)
- due_at ← publishedAt + horizon_hours hours
- checked_at ← now() if data exists, null otherwise
- status ← 'completed' if change_percent is not null, else 'pending'

## REQUIRED TASKS

### T-6B.1 — Create event_impacts Migration

**Task ID:** T-6B.1  
**Phase:** Phase 6B — Create event_impacts migration  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create SQL migration for `event_impacts` table with all required columns, constraints, and indexes. This table is parallel to coin_news_history and does not modify it.

**Files to inspect:**
- `backend/src/models/market.model.ts` — existing table patterns and Drizzle conventions
- `backend/scripts/migrate-market-scenarios.sql` — reference migration pattern

**Files allowed to modify:**
- `backend/scripts/migrate-event-impacts.sql` (new file)

**Forbidden files:**
- `backend/src/models/market.model.ts` (T-6B.3 handles Drizzle model)
- Any existing migration files
- Any existing table schemas
- Any service/cron/controller files

**Constraints:**
- Additive only — no existing tables modified
- source_id is nullable (NOT NOT NULL) — preserves impact data if source deleted
- NO ON DELETE CASCADE — use ON DELETE SET NULL for source_id FK
- UNIQUE constraint on source_id (one impact record per source event)
- All timestamps use `DEFAULT NOW()`
- status defaults to 'pending'

**Step-by-step instructions:**

1. Create new file `backend/scripts/migrate-event-impacts.sql`
2. Add header comment with phase, date, description
3. Create `event_impacts` table:
```sql
CREATE TABLE IF NOT EXISTS event_impacts (
  id SERIAL PRIMARY KEY,
  source_table VARCHAR(50) NOT NULL DEFAULT 'coin_news_history',
  source_id INTEGER REFERENCES coin_news_history(id) ON DELETE SET NULL,
  coin_symbol VARCHAR(20) NOT NULL,
  event_type VARCHAR(50),
  event_severity INTEGER,
  event_scope VARCHAR(20),
  published_at TIMESTAMP NOT NULL,
  price_at_event REAL,
  price_source VARCHAR(20) NOT NULL DEFAULT 'binance',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```
4. Add UNIQUE constraint on source_id:
```sql
CREATE UNIQUE INDEX idx_event_impacts_source_id ON event_impacts (source_id) WHERE source_id IS NOT NULL;
```
5. Add required indexes:
```sql
CREATE INDEX idx_event_impacts_coin_symbol ON event_impacts (coin_symbol);
CREATE INDEX idx_event_impacts_event_type ON event_impacts (event_type);
CREATE INDEX idx_event_impacts_status ON event_impacts (status);
CREATE INDEX idx_event_impacts_published_at ON event_impacts (published_at);
```
6. Add rollback section at bottom (commented):
```sql
-- ROLLBACK:
-- DROP TABLE IF EXISTS event_impacts;
```

**Acceptance criteria:**
- Migration creates `event_impacts` table with all 13 columns
- UNIQUE partial index on source_id (WHERE source_id IS NOT NULL)
- 4 performance indexes (coin_symbol, event_type, status, published_at)
- source_id references coin_news_history(id) ON DELETE SET NULL
- No ON DELETE CASCADE anywhere
- status defaults to 'pending'
- created_at and updated_at default to NOW()
- Migration is idempotent (CREATE TABLE IF NOT EXISTS)
- Rollback is clean (single DROP TABLE)

**QA checklist:**
- [ ] SQL syntax valid for PostgreSQL
- [ ] All 13 columns present with correct types
- [ ] UNIQUE index on source_id (partial, NULL-aware)
- [ ] 4 performance indexes created
- [ ] FK uses ON DELETE SET NULL (not CASCADE)
- [ ] Defaults correct (source_table, price_source, status, timestamps)
- [ ] Idempotent (IF NOT EXISTS)
- [ ] Rollback section documented
- [ ] No existing tables referenced except FK

**Rollback notes:**
- `DROP TABLE IF EXISTS event_impacts;`
- No data in existing tables affected
- CASCADE on DROP handles index cleanup

**Dependencies:**
- None (table is standalone with optional FK)

---

### T-6B.2 — Create event_impact_outcomes Migration

**Task ID:** T-6B.2  
**Phase:** Phase 6B — Create event_impact_outcomes migration  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create SQL migration for `event_impact_outcomes` table that stores per-horizon outcome data for each event impact record. Each event_impacts row will have up to 5 outcome rows (1h, 4h, 24h, 3d, 7d).

**Files to inspect:**
- `backend/scripts/migrate-event-impacts.sql` (from T-6B.1 — must exist first)
- `backend/scripts/migrate-market-scenarios.sql` — reference for scenario_horizon_outcomes pattern

**Files allowed to modify:**
- `backend/scripts/migrate-event-impacts.sql` (append to T-6B.1 migration)

**Forbidden files:**
- `backend/src/models/market.model.ts` (T-6B.3 handles Drizzle model)
- Any service/cron/controller files
- Any existing table schemas

**Constraints:**
- Additive only — no existing tables modified
- UNIQUE on (event_impact_id, horizon) — one outcome per horizon per event
- FK on event_impact_id references event_impacts(id) ON DELETE CASCADE (if event deleted, outcomes go too — this is the SAME table pair, not cross-table)
- All nullable outcome fields for partial data
- status defaults to 'pending'
- error_message for logging failures

**Step-by-step instructions:**

1. Append to `backend/scripts/migrate-event-impacts.sql`
2. Create `event_impact_outcomes` table:
```sql
CREATE TABLE IF NOT EXISTS event_impact_outcomes (
  id SERIAL PRIMARY KEY,
  event_impact_id INTEGER NOT NULL REFERENCES event_impacts(id) ON DELETE CASCADE,
  horizon VARCHAR(10) NOT NULL,
  horizon_hours INTEGER NOT NULL,
  due_at TIMESTAMP NOT NULL,
  checked_at TIMESTAMP,
  price_at_horizon REAL,
  change_percent REAL,
  max_upside_percent REAL,
  max_drawdown_percent REAL,
  time_to_peak_hours INTEGER,
  time_to_bottom_hours INTEGER,
  outcome_classification VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```
3. Add UNIQUE constraint:
```sql
CREATE UNIQUE INDEX idx_event_impact_outcomes_unique ON event_impact_outcomes (event_impact_id, horizon);
```
4. Add required indexes:
```sql
CREATE INDEX idx_event_impact_outcomes_status ON event_impact_outcomes (status);
CREATE INDEX idx_event_impact_outcomes_due_at ON event_impact_outcomes (due_at);
CREATE INDEX idx_event_impact_outcomes_event_impact_id ON event_impact_outcomes (event_impact_id);
```
5. Update rollback section:
```sql
-- ROLLBACK:
-- DROP TABLE IF EXISTS event_impact_outcomes;
-- DROP TABLE IF EXISTS event_impacts;
```

**Acceptance criteria:**
- Migration creates `event_impact_outcomes` table with all 16 columns
- UNIQUE index on (event_impact_id, horizon)
- 3 performance indexes (status, due_at, event_impact_id)
- FK uses ON DELETE CASCADE (within same table pair — acceptable)
- All outcome fields nullable (partial data OK)
- status defaults to 'pending'
- Horizon values: '1h', '4h', '24h', '3d', '7d'
- Rollback drops outcomes first, then impacts (FK order)

**QA checklist:**
- [ ] SQL syntax valid for PostgreSQL
- [ ] All 16 columns present with correct types
- [ ] UNIQUE index on (event_impact_id, horizon)
- [ ] 3 performance indexes created
- [ ] FK to event_impacts(id) with CASCADE (same-pair only)
- [ ] All outcome fields nullable
- [ ] Defaults correct (status, timestamps)
- [ ] Rollback order correct (outcomes first, then impacts)
- [ ] Horizon varchar(10) sufficient for '1h','4h','24h','3d','7d'

**Rollback notes:**
- `DROP TABLE IF EXISTS event_impact_outcomes;`
- `DROP TABLE IF EXISTS event_impacts;`
- No data in existing tables affected

**Dependencies:**
- T-6B.1 (event_impacts table must be created first in same migration)

---

### T-6B.3 — Create Event Impact Persistence Service

**Task ID:** T-6B.3  
**Phase:** Phase 6B — Create eventImpactPersistence.service.ts  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create `backend/src/services/eventImpactPersistence.service.ts` that reads processed event data from `coin_news_history` and persists normalized records into the new `event_impacts` and `event_impact_outcomes` tables. This service is the core persistence bridge.

**Files to inspect:**
- `backend/src/services/eventImpactAnalysis.service.ts` — existing read-only analysis service (pattern reference)
- `backend/src/services/scenarioTracker.service.ts` — reference for write service patterns
- `backend/src/models/market.model.ts` — Drizzle table definitions (after T-6B Drizzle update)
- `backend/src/config/env.ts` — env flag pattern

**Files allowed to modify:**
- `backend/src/services/eventImpactPersistence.service.ts` (new file)

**Forbidden files:**
- `backend/src/services/eventImpactAnalysis.service.ts` (read-only, must not change)
- `backend/src/models/market.model.ts` (separate task)
- `backend/src/config/env.ts` (separate task)
- Any cron, controller, or route files
- Any frontend files

**Constraints:**
- Zero `any` types — use explicit TypeScript interfaces
- Read from coin_news_history (SELECT only)
- Write ONLY to event_impacts and event_impact_outcomes
- Idempotent — skip if source_id already exists in event_impacts
- Must check EVENT_IMPACT_PERSISTENCE_ENABLED flag before any write
- All writes wrapped in try/catch with proper error logging
- No external API calls
- No AI calls
- Service must be stateless

**Step-by-step instructions:**

1. Create new file `backend/src/services/eventImpactPersistence.service.ts`
2. Import Drizzle db, coinNewsHistory, eventImpacts, eventImpactOutcomes from models
3. Import env config for EVENT_IMPACT_PERSISTENCE_ENABLED
4. Define TypeScript interfaces:

```typescript
interface EventImpactRow {
  sourceTable: string;
  sourceId: number | null;
  coinSymbol: string;
  eventType: string | null;
  eventSeverity: number | null;
  eventScope: string | null;
  publishedAt: Date;
  priceAtEvent: number | null;
  priceSource: string;
  status: string;
}

interface EventImpactOutcomeRow {
  eventImpactId: number;
  horizon: string;
  horizonHours: number;
  dueAt: Date;
  checkedAt: Date | null;
  priceAtHorizon: number | null;
  changePercent: number | null;
  maxUpsidePercent: number | null;
  maxDrawdownPercent: number | null;
  timeToPeakHours: number | null;
  timeToBottomHours: number | null;
  outcomeClassification: string | null;
  status: string;
  errorMessage: string | null;
}
```

5. Implement `persistEventImpact(sourceRecord)` function:
   - Check EVENT_IMPACT_PERSISTENCE_ENABLED, return null if false
   - Check idempotency: query event_impacts WHERE source_id = sourceRecord.id, skip if exists
   - Determine status: 'completed' if all 5 change fields non-null, else 'pending'
   - INSERT into event_impacts with mapped fields
   - Return the new event_impact.id

6. Implement `persistEventImpactOutcomes(eventImpactId, sourceRecord)` function:
   - Define HORIZONS constant: `[{horizon:'1h',hours:1,change:'change1h',price:'price1hAfter'}, ...]`
   - For each horizon, calculate due_at = publishedAt + hours
   - Determine per-horizon status: 'completed' if change_percent non-null, else 'pending'
   - Set checked_at = new Date() if data exists, null otherwise
   - Map maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification (same values from source, applied to all 5 horizons)
   - INSERT all 5 rows into event_impact_outcomes using db.insert().values([...])
   - Return count of inserted outcomes

7. Implement `persistBatchFromCoinNewsHistory(limit, offset)` function:
   - Query coin_news_history with limit/offset (for batching)
   - Only select rows where eventSeverity IS NOT NULL (have been classified)
   - For each row, call persistEventImpact then persistEventImpactOutcomes
   - Track success/skip/error counts
   - Return batch summary: { processed, created, skipped, errors }

8. Implement `getEventImpactBySourceId(sourceId)` function:
   - Query event_impacts WHERE source_id = sourceId
   - Return the impact record or null

9. Implement `getOutcomesForEventImpact(eventImpactId)` function:
   - Query event_impact_outcomes WHERE event_impact_id = eventImpactId
   - Return array of outcome records

10. Export all functions

**Acceptance criteria:**
- Service compiles with zero `any` types
- All functions check EVENT_IMPACT_PERSISTENCE_ENABLED
- persistEventImpact is idempotent (skips existing source_ids)
- persistEventImpactOutcomes creates exactly 5 rows per event
- Batch function processes in configurable chunks
- Error handling: individual record failures don't stop batch
- TypeScript strict mode clean

**QA checklist:**
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] Zero `any` types (grep verification)
- [ ] EVENT_IMPACT_PERSISTENCE_ENABLED check in all write functions
- [ ] Idempotency verified (run twice, no duplicates)
- [ ] 5 outcome rows created per event impact
- [ ] Null handling for all optional fields
- [ ] Error logging on individual record failures
- [ ] No external API calls
- [ ] No modifications to coin_news_history
- [ ] Interfaces match migration column types

**Rollback notes:**
- Delete `backend/src/services/eventImpactPersistence.service.ts`
- No data cleanup needed (tables managed separately)

**Dependencies:**
- T-6B.1 + T-6B.2 (migrations must exist for Drizzle model)
- Drizzle model updates for event_impacts and event_impact_outcomes

---

### T-6B.4 — Create Backfill Script with Dry-Run

**Task ID:** T-6B.4  
**Phase:** Phase 6B — Create backfill script with dry-run mode  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Create `backend/scripts/backfill-event-impacts.js` that processes existing `coin_news_history` records and populates the new `event_impacts` and `event_impact_outcomes` tables. Must have dry-run mode by default and be feature-flagged.

**Files to inspect:**
- `backend/scripts/backfill-phase45-scenarios.js` — reference backfill pattern (dry-run/execute, batching, logging)
- `backend/src/services/eventImpactPersistence.service.ts` (after T-6B.3)

**Files allowed to modify:**
- `backend/scripts/backfill-event-impacts.js` (new file)

**Forbidden files:**
- Any service, model, cron, controller, route files
- Any frontend files

**Constraints:**
- Dry-run mode is DEFAULT (safe to run without arguments)
- Requires `--execute` flag to actually write data
- Must check EVENT_IMPACT_BACKFILL_ENABLED env flag (default false)
- Must check EVENT_IMPACT_BACKFILL_DRY_RUN env flag (default true)
- Process in batches of 100 records
- Idempotent — skip already-processed records (check source_id in event_impacts)
- Handle individual record failures gracefully (continue batch)
- Log progress every 100 records
- Log summary at end: scanned, eligible, created, skipped, errors

**Step-by-step instructions:**

1. Create new file `backend/scripts/backfill-event-impacts.js`
2. Follow pattern from `backfill-phase45-scenarios.js`:
   - Require compiled dist files
   - Parse CLI args: `--dry-run` (default) or `--execute`
3. Check env flags:
   - If EVENT_IMPACT_BACKFILL_ENABLED is false: print message and exit
   - In `--execute` mode: if EVENT_IMPACT_BACKFILL_DRY_RUN is true, warn but allow override with `--force`
4. Query coin_news_history:
   - Select rows where eventSeverity IS NOT NULL (classified events)
   - Order by publishedAt ASC (oldest first for chronological consistency)
   - Process in batches of 100 using LIMIT/OFFSET
5. For each batch:
   - For each record, check if source_id already in event_impacts (idempotency)
   - If dry-run: log what would be created
   - If execute: call persistEventImpact + persistEventImpactOutcomes
   - Track counts: scanned, eligible, created, skipped (already exists), errors
6. Log progress after each batch
7. Print final summary

**Expected CLI behavior:**
```
# Safe dry-run (default)
node backfill-event-impacts.js
> [Backfill] DRY RUN mode (default)
> [Backfill] EVENT_IMPACT_BACKFILL_ENABLED=false — exiting safely

# With env flag enabled, still dry-run
EVENT_IMPACT_BACKFILL_ENABLED=true node backfill-event-impacts.js
> [Backfill] DRY RUN mode
> [Backfill] Scanned: 500, Eligible: 320, Would Create: 320, Skipped: 180

# Actual execution
EVENT_IMPACT_BACKFILL_ENABLED=true node backfill-event-impacts.js --execute
> [Backfill] EXECUTE mode
> [Backfill] Batch 1/5: 100 records processed...
> [Backfill] Summary: Scanned=500, Created=320, Skipped=180, Errors=0
```

**Acceptance criteria:**
- Script runs with `node scripts/backfill-event-impacts.js` (after `npm run build`)
- Dry-run is default — no writes without explicit `--execute`
- Checks EVENT_IMPACT_BACKFILL_ENABLED flag
- Idempotent — running twice produces same results
- Batches of 100 records
- Individual failures logged but don't stop batch
- Progress logging every batch
- Final summary with counts

**QA checklist:**
- [ ] Dry-run mode: no INSERT/UPDATE/DELETE operations
- [ ] Execute mode: writes to event_impacts and event_impact_outcomes only
- [ ] EVENT_IMPACT_BACKFILL_ENABLED=false: exits safely
- [ ] Idempotent: second run skips all existing records
- [ ] Batch size 100 respected
- [ ] Error handling: single failure doesn't stop batch
- [ ] Progress logging visible
- [ ] Final summary accurate
- [ ] No modifications to coin_news_history
- [ ] No modifications to any existing tables

**Rollback notes:**
- Delete `backend/scripts/backfill-event-impacts.js`
- Data in new tables can be preserved or dropped separately

**Dependencies:**
- T-6B.1 + T-6B.2 (migrations run)
- T-6B.3 (persistence service exists)
- T-6B.5 (feature flags in env.ts)

---

### T-6B.5 — Add Feature Flags

**Task ID:** T-6B.5  
**Phase:** Phase 6B — Add feature flags to env.ts  
**Assigned Agent:** Senior Developer  
**Status:** Pending  

**Objective:**  
Add two new feature flags to `backend/src/config/env.ts` for controlling event impact persistence and backfill operations. Both default to false for safe production deployment.

**Files to inspect:**
- `backend/src/config/env.ts` — existing env configuration with Zod schema

**Files allowed to modify:**
- `backend/src/config/env.ts`

**Forbidden files:**
- All other files

**Constraints:**
- Both flags default to false
- Missing env vars must NOT crash server
- Use existing Zod boolean pattern
- Flags must be accessible by services and scripts

**Step-by-step instructions:**

1. Locate the env schema in `backend/src/config/env.ts`
2. Add `EVENT_IMPACT_PERSISTENCE_ENABLED`:
   ```typescript
   EVENT_IMPACT_PERSISTENCE_ENABLED: z.boolean().default(false),
   ```
3. Add `EVENT_IMPACT_BACKFILL_ENABLED`:
   ```typescript
   EVENT_IMPACT_BACKFILL_ENABLED: z.boolean().default(false),
   ```
4. Add `EVENT_IMPACT_BACKFILL_DRY_RUN`:
   ```typescript
   EVENT_IMPACT_BACKFILL_DRY_RUN: z.boolean().default(true),
   ```
5. Place flags near existing `EVENT_IMPACT_ENGINE_ENABLED` flag (grouping by feature)
6. Verify no startup crashes with missing env vars

**Acceptance criteria:**
- 3 new flags added: EVENT_IMPACT_PERSISTENCE_ENABLED, EVENT_IMPACT_BACKFILL_ENABLED, EVENT_IMPACT_BACKFILL_DRY_RUN
- All default to safe values (false, false, true)
- Server starts normally with no env vars set
- `cd backend && npx tsc --noEmit` passes
- Flags accessible via env config export

**QA checklist:**
- [ ] Server starts without any new env vars
- [ ] EVENT_IMPACT_PERSISTENCE_ENABLED defaults to false
- [ ] EVENT_IMPACT_BACKFILL_ENABLED defaults to false
- [ ] EVENT_IMPACT_BACKFILL_DRY_RUN defaults to true
- [ ] Flags grouped near existing EVENT_IMPACT_ENGINE_ENABLED
- [ ] `tsc --noEmit` clean
- [ ] No changes to existing flags

**Rollback notes:**
- Remove the 3 new flag definitions
- Server starts normally without them

**Dependencies:**
- None (can be done in parallel with T-6B.1/T-6B.2)

---

### T-6B.6 — Documentation Update

**Task ID:** T-6B.6  
**Phase:** Phase 6B — Documentation update  
**Assigned Agent:** Prompt Engineer  
**Status:** COMPLETED — QA & Security PASS  

**Objective:**  
Update THE_NEXUS_HUB.md with Phase 6B scope, schema diagrams, operational controls, rollback procedures, and what Phase 6B does NOT change.

**Files modified:**
- THE_NEXUS_HUB.md

**Implementation requirements:**
- Document Phase 6B as persistence layer for Phase 6A with clear scope and limitations
- Include schema diagrams for event_impacts and event_impact_outcomes tables with column descriptions
- Document data mapping from coin_news_history to both new tables
- Document operational controls section with all 3 env flags and their defaults
- Document backfill dry-run vs execute behavior
- Include comprehensive rollback procedure
- Document what Phase 6B explicitly does NOT change (no existing table modifications, no UI changes, no Living Articles changes, no scorecard changes, no AI workflow changes)
- Reference Phase 6A as prerequisite

**Acceptance criteria:**
- Phase 6B scope and limitations clearly documented
- Both table schemas documented with all columns
- Operational controls documented with defaults (false, false, true)
- Backfill dry-run vs execute behavior clearly explained
- Rollback procedures documented (disable flags, data preserved, DROP TABLE only if necessary)
- What Phase 6B does NOT change explicitly listed
- Phase 6A reference included

**QA checklist:**
- [x] Documentation accurate and complete
- [x] Schema matches migration
- [x] Env flags documented with defaults
- [x] Rollback procedures documented
- [x] No conflicting information

**Rollback notes:**
- Documentation is informational only — removal not critical

**Dependencies:**
- T-6B.1 through T-6B.5 (for accurate documentation)

---

### T-6B.7 — QA Checklist Preparation

**Task ID:** T-6B.7  
**Phase:** Phase 6B — QA checklist preparation  
**Assigned Agent:** Prompt Engineer  
**Status:** COMPLETED — QA & Security PASS  

**Objective:**  
Prepare comprehensive QA checklist for Phase 6B implementation covering migrations, service, backfill, and env flags.

**Files modified:**
- THE_NEXUS_HUB.md

**Implementation requirements:**
- Create comprehensive QA checklist section for Phase 6B
- Cover all tasks T-6B.1 through T-6B.5 with specific verification steps
- Include safety checks for data integrity and migration safety
- Include verification steps for idempotency across all components
- Include rollback verification procedures
- Cover edge cases and error scenarios
- Define clear pass/fail criteria for each check

**QA checklist:**
- [x] Checklist covers T-6B.1 through T-6B.5
- [x] Migration checks included
- [x] Service checks included
- [x] Backfill checks included
- [x] Env flag checks included
- [x] Data integrity checks included
- [x] Rollback verification included

**Acceptance criteria:**
- Comprehensive QA checklist covering all Phase 6B tasks
- Clear pass/fail criteria for each check
- Includes edge cases and error scenarios
- Includes rollback verification

**Rollback notes:**
- Documentation is informational only — removal not critical

**Dependencies:**
- All T-6B tasks (for comprehensive checklist)

---

## WHAT DOES NOT CHANGE

1. **coin_news_history schema** — zero modifications  
2. **Any existing table schema** — zero modifications  
3. **Living Articles** — unchanged  
4. **Scorecard** — unchanged  
5. **Public UI / Frontend** — unchanged  
6. **AI workflow prompts** — unchanged  
7. **eventImpactAnalysis.service.ts** — read-only service untouched  
8. **External APIs** — no new integrations  
9. **Crons** — no new cron registrations  
10. **Routes/Controllers** — no new endpoints  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/scripts/migrate-event-impacts.sql` | 🔴 TODO | New — migration for both tables |
| `backend/src/models/market.model.ts` | 🔴 TODO | Add eventImpacts + eventImpactOutcomes Drizzle tables |
| `backend/src/services/eventImpactPersistence.service.ts` | 🔴 TODO | New — persistence bridge service |
| `backend/scripts/backfill-event-impacts.js` | 🔴 TODO | New — backfill with dry-run |
| `backend/src/config/env.ts` | 🔴 TODO | Add 3 feature flags |
| `agent_gedens/THE_NEXUS_HUB.md` | 🔴 TODO | Documentation + QA checklist |

**Total: 3 new files, 2 modified files, 1 documentation update**

---

## PRIORITY ORDER

```
1. T-6B.5 — Feature flags (independent, no deps)
2. T-6B.1 — event_impacts migration (blocks T-6B.3)
3. T-6B.2 — event_impact_outcomes migration (blocks T-6B.3)
4. Drizzle model updates (part of T-6B.3 or separate micro-task)
5. T-6B.3 — Persistence service (needs migrations + models + flags)
6. T-6B.4 — Backfill script (needs service + flags)
7. T-6B.6 — Documentation (needs all above)
8. T-6B.7 — QA checklist (needs all above)
```

**Parallelizable:**
- T-6B.5 (flags) + T-6B.1/T-6B.2 (migrations) can run in parallel

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Run migration | event_impacts + event_impact_outcomes tables created |
| 2 | TypeScript check | `npx tsc --noEmit` passes with zero errors |
| 3 | Drizzle model | Schema matches migration exactly |
| 4 | Feature flags | Server starts without new env vars |
| 5 | Persistence service | Creates 1 impact + 5 outcomes per source event |
| 6 | Idempotency | Second run skips existing records |
| 7 | Backfill dry-run | Zero writes, shows what would be created |
| 8 | Backfill execute | Correct data written to new tables |
| 9 | FK integrity | source_id SET NULL on source delete |
| 10 | No side effects | coin_news_history unchanged |

---

## RISK NOTES

1. **FK with SET NULL** — If coin_news_history rows are deleted, source_id becomes NULL but impact data preserved
2. **Batch size 100** — Conservative to avoid memory/timeout issues
3. **Dry-run default** — Backfill cannot accidentally write without explicit flag
4. **Feature flags false** — All persistence disabled by default
5. **No cascade on source_id** — Protects impact data from accidental source deletion
6. **Cascade within pair** — event_impact_outcomes cascade on event_impacts delete (same data pair)

---

## OPERATIONAL CONTROLS

### Environment Variables

**EVENT_IMPACT_PERSISTENCE_ENABLED** (default: false)
- Controls whether persistence service writes to new tables
- When false: all persist functions return null/0
- When true: writes enabled

**EVENT_IMPACT_BACKFILL_ENABLED** (default: false)
- Controls whether backfill script processes records
- When false: script exits immediately
- When true: script proceeds (still checks dry-run flag)

**EVENT_IMPACT_BACKFILL_DRY_RUN** (default: true)
- Controls backfill write behavior
- When true: backfill logs what it would do without writing
- When false: backfill actually writes data

### Safe Defaults

- All persistence disabled by default
- Backfill requires both BACKFILL_ENABLED=true and either --execute or BACKFILL_DRY_RUN=false
- Production starts safely with no impact persistence activity
- Operators must explicitly enable each feature

### Rollback Plan

1. **Disable persistence:**
   - EVENT_IMPACT_PERSISTENCE_ENABLED=false
   - EVENT_IMPACT_BACKFILL_ENABLED=false

2. **Leave tables in place:**
   - Data in event_impacts and event_impact_outcomes preserved
   - No harm in keeping populated tables

3. **Full cleanup (if absolutely necessary):**
   ```sql
   DROP TABLE IF EXISTS event_impact_outcomes;
   DROP TABLE IF EXISTS event_impacts;
   ```

4. **Code cleanup:**
   - Delete eventImpactPersistence.service.ts
   - Delete backfill-event-impacts.js
   - Delete migration file
   - Remove Drizzle model additions
   - Remove env flag definitions

5. **No changes to existing tables needed for rollback**

---

## SQL SCHEMA REFERENCE

### event_impacts

```
┌──────────────────┬───────────────┬──────────┬─────────┬─────────────────────────┐
│ Column           │ Type          │ Nullable │ Default │ Notes                   │
├──────────────────┼───────────────┼──────────┼─────────┼─────────────────────────┤
│ id               │ SERIAL        │ NO       │ auto    │ Primary key             │
│ source_table     │ VARCHAR(50)   │ NO       │ 'coin_… │ Source table name       │
│ source_id        │ INTEGER       │ YES      │ —       │ FK → cnh(id) SET NULL   │
│ coin_symbol      │ VARCHAR(20)   │ NO       │ —       │ e.g. 'BTC'              │
│ event_type       │ VARCHAR(50)   │ YES      │ —       │ e.g. 'regulation'       │
│ event_severity   │ INTEGER       │ YES      │ —       │ 1-5 scale               │
│ event_scope      │ VARCHAR(20)   │ YES      │ —       │ e.g. 'COIN', 'MARKET'   │
│ published_at     │ TIMESTAMP     │ NO       │ —       │ Event publication time  │
│ price_at_event   │ REAL          │ YES      │ —       │ Price when event hit    │
│ price_source     │ VARCHAR(20)   │ NO       │ 'binan… │ Price data source       │
│ status           │ VARCHAR(20)   │ NO       │ 'pendi… │ pending/completed       │
│ created_at       │ TIMESTAMP     │ NO       │ NOW()   │ Record creation time    │
│ updated_at       │ TIMESTAMP     │ NO       │ NOW()   │ Last update time        │
└──────────────────┴───────────────┴──────────┴─────────┴─────────────────────────┘

Indexes:
  UNIQUE  (source_id) WHERE source_id IS NOT NULL
  BTREE   (coin_symbol)
  BTREE   (event_type)
  BTREE   (status)
  BTREE   (published_at)
```

### event_impact_outcomes

```
┌───────────────────────────┼───────────────┼──────────┼─────────┼──────────────────────────────┐
│ Column                    │ Type          │ Nullable │ Default │ Notes                        │
├───────────────────────────┼───────────────┼──────────┼─────────┼──────────────────────────────┤
│ id                        │ SERIAL        │ NO       │ auto    │ Primary key                  │
│ event_impact_id           │ INTEGER       │ NO       │ —       │ FK → ei(id) CASCADE          │
│ horizon                   │ VARCHAR(10)   │ NO       │ —       │ '1h','4h','24h','3d','7d'    │
│ horizon_hours             │ INTEGER       │ NO       │ —       │ 1, 4, 24, 72, 168            │
│ due_at                    │ TIMESTAMP     │ NO       │ —       │ published_at + horizon_hours  │
│ checked_at                │ TIMESTAMP     │ YES      │ —       │ When outcome was checked      │
│ price_at_horizon          │ REAL          │ YES      │ —       │ Price at horizon time         │
│ change_percent            │ REAL          │ YES      │ —       │ % change from price_at_event  │
│ max_upside_percent        │ REAL          │ YES      │ —       │ Max upside within horizon     │
│ max_drawdown_percent      │ REAL          │ YES      │ —       │ Max drawdown within horizon   │
│ time_to_peak_hours        │ INTEGER       │ YES      │ —       │ Hours to reach peak           │
│ time_to_bottom_hours      │ INTEGER       │ YES      │ —       │ Hours to reach bottom         │
│ outcome_classification    │ VARCHAR(30)   │ YES      │ —       │ POSITIVE/NEGATIVE/NEUTRAL     │
│ status                    │ VARCHAR(20)   │ NO       │ 'pendi… │ pending/completed/failed      │
│ error_message             │ TEXT          │ YES      │ —       │ Error details if failed       │
│ created_at                │ TIMESTAMP     │ NO       │ NOW()   │ Record creation time          │
│ updated_at                │ TIMESTAMP     │ NO       │ NOW()   │ Last update time              │
└───────────────────────────┴───────────────┴──────────┴─────────┴──────────────────────────────┘

Indexes:
  UNIQUE  (event_impact_id, horizon)
  BTREE   (status)
  BTREE   (due_at)
  BTREE   (event_impact_id)
```

---

*Phase 6B authored: May 4, 2026*  
*Depends on: Phase 6A (read-only analysis engine — COMPLETED)*  
*Enables: Persistent event impact data for future analysis, UI, and AI integration*

---

---

# Phase 6A — Event Impact Analysis Engine

**Status:** COMPLETED — QA PASS  
**Date:** May 3, 2026  
**Priority:** P1 (Enables data-driven event impact insights)  
**Scope:** 3 new files, 1 env flag, 1 verification checklist  
**Reviewed by:** QA & Security Hunter — APPROVED  

## OBJECTIVE

Create a read-only event impact analysis service that calculates deterministic statistics from historical coin_news_history data, including per-horizon outcome rates, average max upside/drawdown, and outcome classification rates.

## REQUIRED TASKS

### T-6A.1: Verify coin_news_history Field Names

**Task ID:** T-6A.1  
**Phase:** Phase 6A — Verify coin_news_history field names  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Confirm all required fields for event impact analysis exist in market.model.ts with correct nullable types and camelCase mappings.

**Files inspected:**  
- `backend/src/models/market.model.ts:209-248` — coinNewsHistory table definition  

**Acceptance criteria:**  
- All Phase 1-2 outcome fields present: change1h through change7d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification  
- All fields nullable  
- Correct camelCase property mappings  

**Testing / verification:**  
- Drizzle schema matches database  
- TypeScript compilation clean  

**Dependencies:**  
None (verification only)  

---

### T-6A.2: Create Read-Only Event Impact Analysis Service

**Task ID:** T-6A.2  
**Phase:** Phase 6A — Create read-only event impact analysis service  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Implement backend/src/services/eventImpactAnalysis.service.ts with deterministic calculations for all required statistics.

**Files modified:**  
- `backend/src/services/eventImpactAnalysis.service.ts` (new)  

**Implementation requirements:**  
- Pure read-only SELECT queries from coin_news_history  
- Calculates per-horizon sample sizes, median returns, positive/bullish outcome rates, average max upside/drawdown  
- Filters by optional coinSymbol, eventType, eventSeverity  
- Returns structured statistics object  
- No external API calls, no AI, no caching  

**Acceptance criteria:**  
- Service exports getEventImpactAnalysis function  
- All calculations deterministic from database data  
- Handles edge cases (no matches, null values) gracefully  
- TypeScript strict, no any types  

**Testing / verification:**  
- `cd backend && npx tsc --noEmit` — passes  
- Manual query verification with known data  

**Dependencies:**  
- T-6A.1 (fields exist)  

---

### T-6A.3: Create Manual Read-Only Analysis Script

**Task ID:** T-6A.3  
**Phase:** Phase 6A — Create manual read-only analysis script  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Create backend/scripts/analyze-event-impact.js that checks EVENT_IMPACT_ENGINE_ENABLED and prints console summary.

**Files modified:**  
- `backend/scripts/analyze-event-impact.js` (new)  

**Implementation requirements:**  
- Checks EVENT_IMPACT_ENGINE_ENABLED flag  
- Exits safely if disabled (no writes, no analysis)  
- Calls getEventImpactAnalysis() with no filters  
- Pretty-prints all statistics to console  
- No database writes  

**Acceptance criteria:**  
- Script runs with `node scripts/analyze-event-impact.js` (ts-node for dev)  
- When disabled: exits with appropriate message  
- When enabled: prints comprehensive analysis  
- Handles errors gracefully  

**Testing / verification:**  
- Disabled flag: `npx ts-node scripts/analyze-event-impact.js` exits safely  
- No database writes confirmed  

**Dependencies:**  
- T-6A.2 (service exists)  

---

### T-6A.4: Add EVENT_IMPACT_ENGINE_ENABLED Flag

**Task ID:** T-6A.4  
**Phase:** Phase 6A — Add EVENT_IMPACT_ENGINE_ENABLED flag  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Confirm EVENT_IMPACT_ENGINE_ENABLED exists in backend/src/config/env.ts with default false.

**Files inspected:**  
- `backend/src/config/env.ts:84-85` — env schema definition  

**Acceptance criteria:**  
- Flag defined as boolean with default false  
- Zod validation includes the flag  
- Server starts normally with missing env var  

**Testing / verification:**  
- Server startup logs no env validation errors  
- Script exits safely when flag false  

**Dependencies:**  
None  

---

### T-6A.5: Policy-Safe Output Wording

**Task ID:** T-6A.5  
**Phase:** Phase 6A — Policy-safe output wording  
**Owner:** Prompt Engineer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Define preferred terms for policy-safe historical analysis framing.

**Preferred terms:**  
- Historical observed movement  
- Historical pattern  
- Reference price  
- Upside target zone  
- Invalidation zone  
- Risk zone  
- Bullish/bearish bias  
- Observed outcome  
- Historical summary  
- Data-driven market context  
- Not financial advice  

**Prohibited terms:**  
- Buy/sell  
- Take profit/stop loss  
- Expected/guaranteed profit  
- Trading advice  

**Guidelines:**  
- Emphasize historical analysis framing  
- Avoid predictive language  
- Focus on data-driven insights  

**Files modified:**  
- THE_NEXUS_HUB.md (added policy-safe terminology guidelines, Phase 6A scope limitations section)  

**Acceptance criteria:**  
- Terminology guidelines documented  
- Prohibited terms clearly listed  
- Guidelines emphasize historical framing  

---

### T-6A.6: Documentation Update

**Task ID:** T-6A.6  
**Phase:** Phase 6A — Documentation update  
**Owner:** Senior Developer  
**Status:** Done — QA & Security PASS  

**Objective:**  
Update THE_NEXUS_HUB.md with Phase 6A scope limitations and comprehensive QA checklist.

**Files modified:**  
- THE_NEXUS_HUB.md  

**Implementation requirements:**  
- Add "PHASE 6A SCOPE LIMITATIONS" section  
- Clarify read-only nature, excluded features, future Phase 6B reference  
- Comprehensive QA checklist covering all T-6A.1 through T-6A.7 tasks  
- Verification steps, safety checks, edge cases, pass/fail criteria  

**Acceptance criteria:**  
- Scope limitations clearly documented  
- QA checklist covers all tasks  
- Documentation accurate and complete  

---

### T-6A.7: QA Checklist Preparation

**Task ID:** T-6A.7  
**Phase:** Phase 6A — QA checklist preparation  
**Owner:** QA & Security Hunter  
**Status:** Done — QA & Security PASS  

**Objective:**  
Prepare comprehensive QA checklist for Phase 6A implementation.

**Checklist coverage:**  
- Schema verification  
- Service functionality  
- Script behavior  
- Env flag handling  
- TypeScript compilation  
- Read-only confirmation  
- Edge case handling  
- Error handling  
- Performance considerations  

**Acceptance criteria:**  
- All T-6A.1 through T-6A.7 tasks have verification steps  
- Safety checks for read-only operations  
- Edge cases identified and tested  
- Pass/fail criteria defined  

---

## WHAT DOES NOT CHANGE

1. **Existing coin_news_history rows** — remain unchanged  
2. **No new database writes** — Phase 6A is read-only analysis  
3. **No AI workflows** — no integration into prompts or analysis  
4. **No UI changes** — no frontend modifications  
5. **No external API calls** — all calculations from existing data  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/src/services/eventImpactAnalysis.service.ts` | ✅ Done | New — read-only analysis service |
| `backend/scripts/analyze-event-impact.js` | ✅ Done | New — manual analysis script |
| `backend/src/config/env.ts` | ✅ Done | EVENT_IMPACT_ENGINE_ENABLED flag confirmed |
| `backend/src/models/market.model.ts` | ✅ Verified | Fields confirmed present |
| `THE_NEXUS_HUB.md` | ✅ Done | Documentation and QA checklist added |

**Total: 2 new files, 1 modified file, 2 verified files**

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Schema verification | All required fields exist in coinNewsHistory |
| 2 | TypeScript check | `npx tsc --noEmit` passes with no errors |
| 3 | Service functionality | getEventImpactAnalysis returns correct statistics |
| 4 | Script disabled | Exits safely when EVENT_IMPACT_ENGINE_ENABLED=false |
| 5 | Script enabled | Prints comprehensive analysis when enabled |
| 6 | Read-only confirmation | No INSERT/UPDATE/DELETE operations |
| 7 | Edge cases | Handles no data, null values, errors gracefully |
| 8 | Performance | Query completes within reasonable time |

---

## RISK NOTES

1. **Flag default false** — Analysis disabled by default, must be explicitly enabled  
2. **Read-only operations** — No risk of data corruption  
3. **Error handling** — Service returns empty results on failures  
4. **No external dependencies** — All calculations from existing database  

---

## QA & SECURITY AUDIT RESULTS

**VERDICT:** APPROVED  
**CRITICAL REVIEW:** No bugs, security issues, or architectural flaws found. Code is production-ready.  
**CORRECTION SNIPPETS:** None required.  
**NEXT INSTRUCTIONS FOR JUNIOR:** No corrections needed — proceed to Phase 6B planning.  
**LOG UPDATE:** Agent logs updated with Phase 6A completion and PASS verdict.  
**STATE UPDATE:** Project state updated — Phase 6A marked completed, Phase 6B ready for planning.

---

*Phase 6A authored: May 3, 2026*  
*Enables: Data-driven historical event impact analysis*

---

# Phase 1 — Event-Price Foundation

**Status:** ✅ COMPLETE — Committed (f206e39, 886bea9)
**Date:** May 2, 2026
**Priority:** P0 (Foundation for all temporal intelligence)
**Scope:** 1 SQL migration, 1 model update, 2 new files, 2 modified files
**Reviewed by:** Lead Architect — APPROVED FOR EXECUTION

## OBJECTIVE

Establish the data foundation for all event-price relationship analysis. The current `coin_news_history` table stores events but lacks outcome tracking. Phase 1 adds live event capture, outcome measurement at multiple horizons, and price range analysis.

## REQUIRED TASKS

### T-1A-01: Expand coin_news_history Schema Migration

**Task ID:** T-1A-01
**Phase:** Phase 1A — Expand coin_news_history schema
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add 18 new nullable columns to `coin_news_history` for multi-horizon outcome tracking and price analysis. Maintain backward compatibility by keeping all columns nullable.

**Migration path:** backend/scripts/migrate-coin-news-history-phase1.sql

**Detailed steps:**
1. ALTER TABLE coin_news_history ADD COLUMN source_hash varchar(64) nullable
2. ALTER TABLE coin_news_history ADD COLUMN event_scope varchar(20) nullable
3. ALTER TABLE coin_news_history ADD COLUMN btc_price_at_event real nullable
4. ALTER TABLE coin_news_history ADD COLUMN eth_price_at_event real nullable
5. ALTER TABLE coin_news_history ADD COLUMN fear_greed_at_event integer nullable
6. ALTER TABLE coin_news_history ADD COLUMN price_1h_after real nullable
7. ALTER TABLE coin_news_history ADD COLUMN price_4h_after real nullable
8. ALTER TABLE coin_news_history ADD COLUMN price_24h_after real nullable
9. ALTER TABLE coin_news_history ADD COLUMN price_3d_after real nullable
10. ALTER TABLE coin_news_history ADD COLUMN change_1h real nullable
11. ALTER TABLE coin_news_history ADD COLUMN change_4h real nullable
12. ALTER TABLE coin_news_history ADD COLUMN change_24h real nullable
13. ALTER TABLE coin_news_history ADD COLUMN change_3d real nullable
14. ALTER TABLE coin_news_history ADD COLUMN max_upside_after_event real nullable
15. ALTER TABLE coin_news_history ADD COLUMN max_drawdown_after_event real nullable
16. ALTER TABLE coin_news_history ADD COLUMN time_to_peak_hours integer nullable
17. ALTER TABLE coin_news_history ADD COLUMN time_to_bottom_hours integer nullable
18. ALTER TABLE coin_news_history ADD COLUMN outcome_classification varchar(30) nullable
19. CREATE UNIQUE INDEX idx_cnh_sourcehash ON coin_news_history (source_hash) WHERE source_hash IS NOT NULL;

**Acceptance criteria:**
- All 18 columns added as nullable
- No existing data loss
- Index created for exact-content dedup
- Migration rollback-safe

**Testing / verification:**
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'coin_news_history'
AND column_name IN (
  'source_hash',
  'event_scope',
  'btc_price_at_event',
  'eth_price_at_event',
  'fear_greed_at_event',
  'price_1h_after',
  'price_4h_after',
  'price_24h_after',
  'price_3d_after',
  'change_1h',
  'change_4h',
  'change_24h',
  'change_3d',
  'max_upside_after_event',
  'max_drawdown_after_event',
  'time_to_peak_hours',
  'time_to_bottom_hours',
  'outcome_classification'
);

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'coin_news_history'
AND indexname = 'idx_cnh_sourcehash';

**Rollback notes:**
- DROP INDEX IF EXISTS idx_cnh_sourcehash;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS outcome_classification;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_bottom_hours;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_peak_hours;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_drawdown_after_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_upside_after_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_3d;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_24h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_4h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_1h;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_3d_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_24h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_4h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_1h_after;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS fear_greed_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS eth_price_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS btc_price_at_event;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS event_scope;
- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS source_hash;
- No data loss risk

**Dependencies:**
None (independent schema change)  

---

### T-1A-02: Update Drizzle Model for coin_news_history

**Task ID:** T-1A-02
**Phase:** Phase 1A — Expand coin_news_history schema
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Update `backend/src/models/market.model.ts` to match the 18 new columns added in migration.

**Files to inspect:**
- `backend/src/models/market.model.ts:276-295` — current coin_news_history table definition

**Files likely to modify:**
- `backend/src/models/market.model.ts`

**Detailed steps:**
1. Add the 18 new columns to the `coinNewsHistory` table definition in `market.model.ts` using camelCase properties mapped to snake_case SQL names:
   - sourceHash: varchar('source_hash', { length: 64 }).nullable()
   - eventScope: varchar('event_scope', { length: 20 }).nullable()
   - btcPriceAtEvent: real('btc_price_at_event').nullable()
   - ethPriceAtEvent: real('eth_price_at_event').nullable()
   - fearGreedAtEvent: integer('fear_greed_at_event').nullable()
   - price1hAfter: real('price_1h_after').nullable()
   - price4hAfter: real('price_4h_after').nullable()
   - price24hAfter: real('price_24h_after').nullable()
   - price3dAfter: real('price_3d_after').nullable()
   - change1h: real('change_1h').nullable()
   - change4h: real('change_4h').nullable()
   - change24h: real('change_24h').nullable()
   - change3d: real('change_3d').nullable()
   - maxUpsideAfterEvent: real('max_upside_after_event').nullable()
   - maxDrawdownAfterEvent: real('max_drawdown_after_event').nullable()
   - timeToPeakHours: integer('time_to_peak_hours').nullable()
   - timeToBottomHours: integer('time_to_bottom_hours').nullable()
   - outcomeClassification: varchar('outcome_classification', { length: 30 }).nullable()
2. Match exact column names and types from migration
3. Ensure all are nullable (.nullable())
4. Verify column order matches migration

**Acceptance criteria:**
- `tsc --noEmit` clean in backend
- Drizzle schema matches database schema exactly
- No any types introduced

**Testing / verification:**
- `cd backend && npx drizzle-kit generate` — should succeed with no errors
- `cd backend && npx tsc --noEmit` — zero errors

**Rollback notes:**
- Remove the 18 new column definitions
- Regenerate Drizzle types

**Dependencies:**
- T-1A-01 (migration must run first)  

---

### T-1B-01: Live MAJOR Event Bridge in AI Workflow

**Task ID:** T-1B-01
**Phase:** Phase 1B — Live MAJOR event bridge from aiWorkflow.cron.ts to coin_news_history
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add live capture of MAJOR events into `coin_news_history` immediately after they trigger AI analysis, including BTC/ETH/FearGreed context.

**Files to inspect:**
- `backend/src/crons/aiWorkflow.cron.ts:500-550` — current MAJOR event processing block
- `backend/src/services/binance.service.ts:76-98` — getPriceWithFallback signature

**Files likely to modify:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Detailed steps:**
1. After `saveMemory()` call (around line 527), add event INSERT into `coin_news_history`
2. Fetch BTC/ETH prices once per workflow run (cache in memory)
3. Fetch FearGreed index once per workflow run
4. Populate: coinSymbol, title, source, publishedAt, sentiment, eventType, eventSeverity, priceAtTime, sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent
5. Set sourceHash for dedup (exact-content only)
6. Handle duplicate key errors gracefully (skip if sourceHash exists)

**Acceptance criteria:**
- MAJOR events inserted immediately after memory save
- BTC/ETH prices cached per run
- Dedup via sourceHash (not semantic)
- No blocking errors on duplicate inserts

**Testing / verification:**
- Trigger MAJOR event, check `coin_news_history` row inserted
- Verify priceAtTime populated correctly
- Verify sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent populated

**Rollback notes:**
- Remove the INSERT block
- No data cleanup needed (rows can remain)

**Dependencies:**
- T-1A-01 + T-1A-02 (schema ready)  

---

### T-1C-01: Create eventOutcomeChecker.cron.ts

**Task ID:** T-1C-01
**Phase:** Phase 1C — eventOutcomeChecker.cron.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
New cron job that checks event outcomes at 30-minute intervals, filling price1hAfter/change1h to price3dAfter/change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification using price data.

**Files to inspect:**
- `backend/src/services/binance.service.ts` — for price fetching
- `backend/src/services/coin-memory.service.ts` — for outcome classification logic

**Files likely to modify:**
- `backend/src/crons/eventOutcomeChecker.cron.ts` (NEW FILE)

**Detailed steps:**
1. Create new file with Redis lock
2. Query `coin_news_history` where price1hAfter IS NULL and publishedAt > 1 hour ago (limit 50)
3. For each event, fetch price data using `getCoinKlinesRange()` (new function from T-1D-01)
4. Calculate price1hAfter/change1h to price3dAfter/change3d based on price at horizons
5. Calculate maxUpsideAfterEvent/maxDrawdownAfterEvent using 1h OHLCV candles only (never use 1D candles)
6. Calculate timeToPeakHours (hours to max upside), timeToBottomHours (hours to max drawdown)
7. Classify outcomeClassification (POSITIVE/NEGATIVE/NEUTRAL) based on price movement direction
8. Update existing 7d fields if missing
9. Process all horizons (1h/4h/24h/3d/7d) in batches

**Acceptance criteria:**
- Redis lock prevents duplicate runs
- maxUpsideAfterEvent/maxDrawdownAfterEvent use 1h candles only
- Outcome classification matches event sentiment direction
- Handles missing price data gracefully

**Testing / verification:**
- Check cron logs for successful updates
- Verify outcome fields populated after 1h
- SQL: `SELECT price1hAfter, maxUpsideAfterEvent FROM coin_news_history WHERE price1hAfter IS NOT NULL LIMIT 5`

**Rollback notes:**
- Delete the cron file
- Remove from server.ts registration
- No data rollback (calculated fields optional)

**Dependencies:**
- T-1A-01 + T-1A-02 + T-1D-01 (schema + getCoinKlinesRange)

---

### T-1C-02: Register eventOutcomeChecker Cron in server.ts

**Task ID:** T-1C-02  
**Phase:** Phase 1C — eventOutcomeChecker.cron.ts  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Register the new eventOutcomeChecker cron in the server startup sequence.

**Files to inspect:**  
- `backend/src/server.ts:50-70` — current cron registrations  

**Files likely to modify:**  
- `backend/src/server.ts`  

**Detailed steps:**  
1. Import `startEventOutcomeCheckerCron` from the new cron file  
2. Add to the cron startup sequence with 30-minute schedule  
3. Follow existing pattern (staggered 5s delays)  

**Acceptance criteria:**  
- Cron registered and starts on server boot  
- No import errors  
- Logs show cron scheduled  

**Testing / verification:**  
- Server logs: "eventOutcomeChecker cron scheduled"  
- No startup errors  

**Rollback notes:**  
- Remove the import and registration call  
- Server starts normally without it  

**Dependencies:**  
- T-1C-01 (cron file exists)  

---

### T-1D-01: getCoinKlinesRange() in binance.service.ts

**Task ID:** T-1D-01  
**Phase:** Phase 1D — getCoinKlinesRange() in binance.service.ts  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Add a new function to fetch historical klines for date ranges, with pagination cap at 1500 candles.

**Files to inspect:**  
- `backend/src/services/binance.service.ts:100-120` — existing getCoinKlines function  

**Files likely to modify:**  
- `backend/src/services/binance.service.ts`  

**Detailed steps:**  
1. Add `getCoinKlinesRange(symbol: string, interval: string, startTime: number, endTime: number)`  
2. Paginate requests (Binance limit 1000 per call) up to 1500 total  
3. Return array of OHLCV objects with timestamps  
4. Handle rate limits and errors gracefully  

**Acceptance criteria:**  
- Returns historical klines for date range  
- Pagination handles >1000 candles  
- Compatible with existing getCoinKlines format  

**Testing / verification:**  
- Call for BTC 1h candles over 2 days  
- Verify correct number of candles returned  
- Handle invalid date ranges  

**Rollback notes:**  
- Remove the new function  
- No impact on existing code  

**Dependencies:**  
None (independent utility function)  

---

### T-1E-01: Phase 1 Verification and Rollback Checklist

**Task ID:** T-1E-01  
**Phase:** Phase 1 — Verification  
**Owner:** Senior Developer  
**Status:** Done  

**Objective:**  
Comprehensive verification that Phase 1 foundation is working correctly, with rollback procedures.

**Detailed steps:**  
1. SQL schema verification  
2. Cron registration check  
3. Live event insertion test  
4. Outcome calculation verification  
5. Price data accuracy checks  

**Acceptance criteria:**  
- All SQL checks pass  
- Live MAJOR events populate coin_news_history  
- Outcome fields fill correctly after horizons  
- maxUpside/maxDrawdown calculated from 1h candles only  

**Testing / verification:**
- SQL: Check all 18 columns exist on coin_news_history
- SQL: Verify partial sourceHash index exists
- Trigger MAJOR event, verify row inserted
- Wait 1h+, verify price1hAfter populated
- Verify maxUpsideAfterEvent/maxDrawdownAfterEvent use 1h OHLCV only  

**Rollback notes:**
- Migration: Drop 18 columns + index  
- Cron: Remove eventOutcomeChecker registration + delete file  
- Workflow: Remove INSERT block from aiWorkflow.cron.ts  
- Data: No permanent data loss (calculated fields optional)  

**Dependencies:**  
- All T-1A through T-1D tasks  

---

## WHAT DOES NOT CHANGE

1. **Existing coin_news_history rows** — remain unchanged  
2. **Semantic dedup** — remains embedding-based in other tables  
3. **AI workflow for non-MAJOR events** — unchanged  
4. **Existing crons** — continue running normally  
5. **No new npm packages**  

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| `backend/scripts/migrate-coin-news-history-phase1.sql` | 🔴 TODO | New — schema expansion migration |
| `backend/src/models/market.model.ts` | 🔴 TODO | Add 19 new columns to coinNewsHistory |
| `backend/src/crons/aiWorkflow.cron.ts` | 🔴 TODO | Add live MAJOR event INSERT after saveMemory |
| `backend/src/crons/eventOutcomeChecker.cron.ts` | 🔴 TODO | New — 30min outcome checking cron |
| `backend/src/server.ts` | 🔴 TODO | Register eventOutcomeChecker cron |
| `backend/src/services/binance.service.ts` | 🔴 TODO | Add getCoinKlinesRange() function |

**Total: 1 new SQL, 1 new cron file, 4 modified files**

---

## PRIORITY ORDER

```
1. T-1A-01 — Migration (blocks everything)
2. T-1A-02 — Model update (matches migration)
3. T-1D-01 — Utility function (independent)
4. T-1B-01 — Workflow bridge (needs schema)
5. T-1C-01 — New cron (needs schema + utility)
6. T-1C-02 — Cron registration (needs cron file)
7. T-1E-01 — Verification (final)
```

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|---|-----------------|
| 1 | Run migration | All 18 columns added, index created |
| 2 | Server starts | eventOutcomeChecker cron registered, no errors |
| 3 | MAJOR event triggers | Row inserted in coin_news_history with priceAtTime, sourceHash, eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent |
| 4 | Wait 1 hour | price1hAfter field populated with outcome classification |
| 5 | Check maxUpsideAfterEvent calculation | Uses 1h OHLCV high - priceAtTime |
| 6 | Check maxDrawdownAfterEvent calculation | Uses priceAtTime - 1h OHLCV low |
| 7 | Duplicate MAJOR event | Skipped due to sourceHash dedup |

---

## RISK NOTES

1. **Migration size** — 19 columns is significant; test on staging first  
2. **Rate limits** — getCoinKlinesRange pagination may hit Binance limits  
3. **Data accuracy** — Ensure priceAtTime is captured at event time, not delayed  
4. **Backward compatibility** — All new columns nullable, no breaking changes  

---

## Planning Correction Log

**Date:** May 2, 2026  
**Issue:** Blocking inconsistency in T-1A-01 schema plan — listed 27 columns but claimed 19, using old v2 plan instead of final v3.  
**Correction:** Replaced with final v3 18-column schema as specified by Lead Architect. Removed outcome1h/outcome4h/outcome24h/outcome3d/outcome7d, maxUpside1h/maxDrawdown1h etc., high1h/low1h etc., price1h/price4h/price24h/price3d, majorCoinsImpact, eventHorizon. Added sourceHash (dedup), eventScope, btcPriceAtEvent, ethPriceAtEvent, fearGreedAtEvent, price1hAfter to price3dAfter, change1h to change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification.  
**Impact:** Downstream tasks T-1A-02, T-1B-01, T-1C-01 corrected accordingly. No application code modified.

---

*Phase 1 authored: May 2, 2026*  
*Foundation for: All temporal intelligence, event-outcome correlation, price impact analysis*

---

---

# Phase 2 — Expand Temporal Intelligence

**Status:** PLANNED — Partially executable after Phase 1 schema
**Date:** May 3, 2026
**Priority:** P1 (Enables data-rich temporal patterns)
**Scope:** 1 SQL migration, 1 model update, 1 cron extension, 1 new service, 2 workflow updates, 1 verification checklist
**Reviewed by:** Lead Architect + Tech Lead/Supreme Reviewer — APPROVED FOR EXECUTION

## OBJECTIVE

Enable OnlyAlpha to compare live classified events against historical similar events from coin_news_history, calculate deterministic outcome statistics, and inject DB-grounded context into AI workflows for policy-safe market scenarios.

## REQUIRED TASKS

### T-2A-01: 7d Schema Migration and Rollback

**Task ID:** T-2A-01
**Phase:** Phase 2A — 7d schema migration and rollback
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Add 7d support to coin_news_history schema with price_7d_after and change_7d nullable columns, plus safe rollback procedures.

**Files allowed:**
- `backend/scripts/migrate-coin-news-history-phase2.sql` (new migration file)

**Implementation requirements:**
1. ALTER TABLE coin_news_history ADD COLUMN price_7d_after real nullable
2. ALTER TABLE coin_news_history ADD COLUMN change_7d real nullable
3. Ensure migration is rollback-safe (DROP COLUMN statements in reverse order)

**Explicit exclusions:**
- Do not modify any existing columns or indexes
- Do not alter outcome_classification (kept based on 3d)
- No data backfill in migration (handled by eventOutcomeChecker)

**Acceptance criteria:**
- Migration adds exactly 2 new nullable columns
- No existing data loss
- Rollback drops the 2 columns cleanly

**QA notes:**
- Test migration on staging DB first
- Verify column types match Drizzle model expectations
- Confirm rollback leaves schema identical to pre-migration state

**Dependencies:**
- Phase 1 schema (T-1A-01 + T-1A-02)

---

### T-2B-01: Drizzle Model Update

**Task ID:** T-2B-01
**Phase:** Phase 2B — Drizzle model update
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Update backend/src/models/market.model.ts to include price7dAfter and change7d fields in coinNewsHistory table definition.

**Files allowed:**
- `backend/src/models/market.model.ts`

**Implementation requirements:**
1. Add price7dAfter: real('price_7d_after').nullable()
2. Add change7d: real('change_7d').nullable()
3. Map camelCase properties to snake_case SQL columns
4. Ensure column order matches migration

**Explicit exclusions:**
- Do not modify any other columns in coinNewsHistory table
- No changes to other table definitions
- No type changes to existing fields

**Acceptance criteria:**
- `tsc --noEmit` passes in backend
- Drizzle schema matches database schema after migration
- No any types introduced

**QA notes:**
- Run `cd backend && npx drizzle-kit generate` to verify schema generation
- Check that existing code compiles without changes

**Dependencies:**
- T-2A-01 (migration must run first)

---

### T-2C-01: eventOutcomeChecker 7d Extension

**Task ID:** T-2C-01
**Phase:** Phase 2C — eventOutcomeChecker 7d extension
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Extend eventOutcomeChecker.cron.ts to fill 7d fields after publishedAt + 7d, maintaining existing 3d logic unchanged.

**Files allowed:**
- `backend/src/crons/eventOutcomeChecker.cron.ts`

**Implementation requirements:**
1. Add 7d horizon calculation logic after 3d calculations
2. Fill price_7d_after and change_7d based on price at publishedAt + 7 days
3. Keep all existing retry logic (3 attempts) for generateDualNewsOutput
4. Keep all existing fallback logic for generateLightweightTriage
5. Keep existing adaptive model routing logic (temperature adjustment)

**Explicit exclusions:**
- Do not modify outcome_classification (remains 3d-based)
- No changes to 1h/4h/24h/3d field population logic
- No new AI calls or service integrations

**Acceptance criteria:**
- 7d fields populated after 7 days from publishedAt
- Existing 3d outcome logic unchanged
- Cron continues to run at 30-minute intervals

**QA notes:**
- Verify 7d fields remain null until 7 days pass
- Test with events >7 days old to confirm population
- Ensure no regression in existing 3d calculations

**Dependencies:**
- T-2A-01 + T-2B-01 (schema ready)
- T-1C-01 (existing eventOutcomeChecker exists)

---

### T-2D-01: historicalEventStats.service.ts Creation

**Task ID:** T-2D-01
**Phase:** Phase 2D — historicalEventStats.service.ts creation
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Create backend/src/services/historicalEventStats.service.ts that deterministically queries coin_news_history and calculates statistics per matching hierarchy.

**Files allowed:**
- `backend/src/services/historicalEventStats.service.ts` (new file)

**Implementation requirements:**
1. Implement matching hierarchy: A. exact (coinSymbol + eventType + eventScope + sentiment), B. relaxed level 1 (coinSymbol + eventType + eventScope), C. relaxed level 2 (eventType + eventScope + sentiment), D. relaxed level 3 (eventType + eventScope), E. market-wide fallback (eventType only)
2. Calculate per-horizon sample sizes, median returns, positive/bullish outcome rates, average max upside/drawdown
3. Assign confidence: 0 (none), 1-2 (very_low), 3-5 (low), 6-15 (medium), 16+ (high); adjust downward for relaxed match level/incomplete data/mixed outcomes
4. Use query strategy: rows eligible if at least one relevant change field non-null, per-horizon stats skip nulls independently, order by publishedAt DESC, limit 100 rows
5. Return: matchLevelUsed, sampleSize, horizonSampleSizes, horizonsAvailable, medianReturn per horizon, positive/bullish outcome rate per horizon, averageMaxUpside, averageMaxDrawdown, confidenceLevel, limitations
6. Never call AI, never invent data

**Explicit exclusions:**
- No AI integrations or calls
- No caching or state management (pure query/service)
- No external API calls
- No prompt or workflow logic

**Acceptance criteria:**
- Service exports function that takes event parameters and returns statistics object
- All calculations deterministic from database data
- Handles edge cases (no matches, small samples) gracefully

**QA notes:**
- Test with known historical data to verify calculations
- Verify confidence levels adjust correctly for match levels
- Ensure limitations field populated when data insufficient

**Dependencies:**
- T-2A-01 + T-2B-01 + T-2C-01 (7d data available)

---

### T-2E-01: AI Workflow Integration

**Task ID:** T-2E-01
**Phase:** Phase 2E — AI workflow integration
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Integrate historicalEventStats.service.ts into aiWorkflow.cron.ts to call stats service after event classification and inject returned stats into AI prompts.

**Files allowed:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Implementation requirements:**
1. Import historicalEventStats service
2. Call stats service after event classification (before AI analysis)
3. Inject returned stats into prompt context
4. AI must use provided stats only, never invent numbers
5. If no stats, omit historical comparison section
6. If low confidence, state "limited historical sample available"

**Explicit exclusions:**
- No changes to event classification logic
- No modifications to existing AI model routing
- No changes to prompt structure beyond stats injection

**Acceptance criteria:**
- Stats service called for each classified event
- AI prompts include historical stats when available
- No AI hallucinations or invented statistics

**QA notes:**
- Verify stats appear in AI prompts for events with historical matches
- Test behavior when no historical data exists
- Ensure AI responses reference provided stats accurately

**Dependencies:**
- T-2D-01 (stats service exists)
- T-1B-01 (existing AI workflow)

---

### T-2F-01: Prompt/Policy-Safe Stats Injection

**Task ID:** T-2F-01
**Phase:** Phase 2F — prompt/policy-safe stats injection
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Update AI prompts to use policy-safe language mapping for historical stats presentation, maintaining AdSense-safe output.

**Files allowed:**
- `backend/src/services/ai/prompt-factory.ts`

**Implementation requirements:**
1. Map internal stats to public language: Signal -> Market Scenario, Entry -> Reference Price, TP -> Target Zone, SL -> Risk Zone / Invalidation Zone, P&L -> Historical Outcome, Win Rate -> Outcome Rate, Buy/Sell -> Bullish/Bearish Bias
2. Format stats injection as policy-safe analysis context
3. Public language must remain AdSense-safe

**Explicit exclusions:**
- No changes to internal data structures or calculations
- No modifications to stats service output
- Backend/internal verdict values remain raw

**Acceptance criteria:**
- AI outputs use policy-safe terminology
- Historical stats presented as analysis context, not predictions
- No financial advice framing

**QA notes:**
- Audit AI outputs for policy-safe language
- Verify mapping table applied consistently
- Test with various stat confidence levels

**Dependencies:**
- T-2E-01 (stats injection exists)
- Existing prompt-factory structure

---

### T-2G-01: Phase 2 Verification Checklist

**Task ID:** T-2G-01
**Phase:** Phase 2G — Phase 2 verification checklist
**Owner:** Senior Developer
**Status:** Done — QA & Security PASS

**Objective:**
Create comprehensive verification checklist/script for Phase 2 stats behavior and AI integration.

**Files allowed:**
- `backend/scripts/verify-phase2-stats.js` (new verification script)

**Implementation requirements:**
1. SQL checks for 7d column existence and population
2. Test historicalEventStats service with sample events
3. Verify AI workflow integration and prompt injection
4. Validate policy-safe language mapping
5. Check confidence level calculations

**Explicit exclusions:**
- No modifications to application code
- Pure verification/testing script
- No deployment or runtime changes

**Acceptance criteria:**
- Script runs without errors on staging environment
- All checks pass for Phase 2 functionality
- Provides clear pass/fail results

**QA notes:**
- Run script after Phase 2 deployment
- Use for regression testing in future updates
- Include sample data for consistent testing

**Dependencies:**
- All T-2A through T-2F tasks

---

### T-2H-01: Optional Index Migration

**Task ID:** T-2H-01
**Phase:** Phase 2H — optional index migration
**Owner:** Senior Developer
**Status:** Planned

**Objective:**
Determine if separate index migration needed for 7d query performance, and implement if required.

**Files allowed:**
- `backend/scripts/migrate-coin-news-history-phase2-index.sql` (new if needed)

**Implementation requirements:**
1. Analyze query patterns in historicalEventStats.service.ts
2. Determine if additional indexes needed beyond Phase 1 index
3. Create migration script if performance optimization required

**Explicit exclusions:**
- Only create if determined necessary after analysis
- No forced index creation without justification
- Maintain backward compatibility

**Acceptance criteria:**
- If created: index improves query performance for 7d stats
- If skipped: documented reasoning for no additional indexes
- No negative impact on existing queries

**QA notes:**
- Performance test queries before/after index creation
- Monitor database performance post-deployment
- Rollback plan includes index removal

**Dependencies:**
- T-2D-01 (to analyze query patterns)

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|---|-----------------|
| 1 | Migration runs | price_7d_after and change_7d columns added |
| 2 | Drizzle generate | Schema updates without errors |
| 3 | eventOutcomeChecker | Populates 7d fields after 7 days |
| 4 | historicalEventStats service | Returns accurate statistics for sample events |
| 5 | AI workflow | Calls stats service and injects into prompts |
| 6 | AI output | Uses policy-safe language for historical stats |
| 7 | Verification script | All Phase 2 checks pass |

---

*Phase 2 authored: May 2, 2026*  
*Depends on: Phase 1 data accumulation for meaningful statistics*

---

---

# Phase 3 — Multi-Horizon Scenario Tracker

**Status:** PLANNED — After Phase 1 stable  
**Date:** May 2, 2026  
**Priority:** P1 (Enables investment vs speculation tracking)  
**Scope:** 4 model updates, 3 cron updates, 1 scorecard update  

## OBJECTIVE

Separate short-term signals (speculation/swing) from long-term convictions (investment). Add horizon-based expiry and tracking.

## REQUIRED TASKS

### T-3A-01: Add horizon Column to signal_performance

**Task ID:** T-3A-01  
**Phase:** Phase 3A — Horizon column on signal_performance  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Add nullable horizon column to distinguish speculation (7d), swing (90d), investment (ongoing).

**Files to inspect:**  
- `backend/src/models/market.model.ts:180-200` — signalPerformance table  

**Files likely to modify:**  
- `backend/src/models/market.model.ts`  
- Migration script  

**Detailed steps:**  
1. Add `horizon` column (VARCHAR, nullable)  
2. Migration with backfill logic  

**Acceptance criteria:**  
- Schema updated without breaking existing rows  

**Testing / verification:**  
- New signals get horizon assigned  

**Rollback notes:**  
- Drop horizon column  

**Dependencies:**  
None  

---

### T-3B-01: AI Horizon Classification in Deep Analysis

**Task ID:** T-3B-01  
**Phase:** Phase 3B — AI horizon classification  
**Owner:** Prompt Engineer  
**Status:** Planned  

**Objective:**  
Update deep analysis JSON schema to include horizon classification.

**Files to inspect:**  
- `backend/src/services/ai/prompt-factory.ts:100-150` — deep analysis prompt  

**Files likely to modify:**  
- `backend/src/services/ai/prompt-factory.ts`  

**Detailed steps:**  
1. Add horizon field to JSON schema  
2. Update system prompt for horizon reasoning  

**Acceptance criteria:**  
- AI classifies signals by timeframe appropriately  

**Testing / verification:**  
- Analysis output includes horizon field  

**Rollback notes:**  
- Remove horizon from schema  

**Dependencies:**  
None  

---

### T-3C-01: Horizon-Aware Signal Creation

**Task ID:** T-3C-01  
**Phase:** Phase 3C — Horizon-aware signal creation  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Route investment signals to coin_strategic_outlook, speculation to signal_performance.

**Files to inspect:**  
- `backend/src/crons/aiWorkflow.cron.ts:520-540` — signal creation logic  

**Files likely to modify:**  
- `backend/src/crons/aiWorkflow.cron.ts`  

**Detailed steps:**  
1. Check horizon from analysis result  
2. Investment horizon → INSERT coin_strategic_outlook  
3. Speculation/swing → existing signal_performance logic  

**Acceptance criteria:**  
- Signals routed correctly by horizon  

**Testing / verification:**  
- Investment signals appear in strategic_outlook  

**Rollback notes:**  
- Revert routing logic  

**Dependencies:**  
- T-3A-01 + T-3B-01  

---

### T-3D-01: Horizon-Based Auto-Expiry

**Task ID:** T-3D-01  
**Phase:** Phase 3D — Horizon-based expiry in tpslMonitor  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Auto-close signals based on horizon: speculation (7d), swing (90d).

**Files to inspect:**  
- `backend/src/crons/tpslMonitor.cron.ts` — current TP/SL logic  

**Files likely to modify:**  
- `backend/src/crons/tpslMonitor.cron.ts`  

**Detailed steps:**  
1. Add horizon-based expiry checks  
2. Close expired signals with reason  

**Acceptance criteria:**  
- Signals expire at appropriate horizons  

**Testing / verification:**  
- Old signals auto-closed  

**Rollback notes:**  
- Remove expiry logic  

**Dependencies:**  
- T-3A-01  

---

### T-3E-01: Investment Thesis Tracking

**Task ID:** T-3E-01  
**Phase:** Phase 3E — Investment thesis on coin_strategic_outlook  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Add thesis tracking columns to coin_strategic_outlook.

**Files to inspect:**  
- `backend/src/models/market.model.ts:230-250` — coinStrategicOutlook table  

**Files likely to modify:**  
- `backend/src/models/market.model.ts`  

**Detailed steps:**  
1. Add thesis tracking columns  
2. Update migration  

**Acceptance criteria:**  
- Investment theses tracked with outcomes  

**Testing / verification:**  
- Thesis entries have outcome fields  

**Rollback notes:**  
- Drop thesis columns  

**Dependencies:**  
None  

---

### T-3F-01: 90d P&L Tracking for Swing Signals

**Task ID:** T-3F-01  
**Phase:** Phase 3F — 90d P&L tracking  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Extend signalPerformance cron to track 90d P&L for swing signals.

**Files to inspect:**  
- `backend/src/crons/signalPerformance.cron.ts:80-100` — current 30d logic  

**Files likely to modify:**  
- `backend/src/crons/signalPerformance.cron.ts`  

**Detailed steps:**  
1. Add 90d P&L calculation block  
2. Only for swing horizon signals  

**Acceptance criteria:**  
- Swing signals get 90d tracking  

**Testing / verification:**  
- 90d fields populated for swing signals  

**Rollback notes:**  
- Remove 90d calculation  

**Dependencies:**  
- T-3A-01  

---

### T-3G-01: Scorecard 3-Section Layout

**Task ID:** T-3G-01  
**Phase:** Phase 3G — Scorecard 3-section display  
**Owner:** Senior Developer  
**Status:** Planned  

**Objective:**  
Update scorecard to show Active Market Scenarios, Long-Term Convictions, Completed Scenarios.

**Files to inspect:**  
- `frontend/src/app/(standard)/scorecard/page.tsx` — current layout  

**Files likely to modify:**  
- `frontend/src/app/(standard)/scorecard/page.tsx`  

**Detailed steps:**  
1. Restructure into 3 sections  
2. Pull from both signal_performance and coin_strategic_outlook  

**Acceptance criteria:**  
- Scorecard shows separated sections  

**Testing / verification:**  
- All sections render correctly  

**Rollback notes:**  
- Revert to single table layout  

**Dependencies:**  
- T-3A-01 + T-3C-01 + T-3E-01  

---

*Phase 3 authored: May 2, 2026*  
*Enables: Clear separation of short-term trading vs long-term investing*

---

---

# Phase 4 — Multi-Horizon Scenario Tracker

**Status:** DONE — QA PASS  
**Date:** May 3, 2026  
**Priority:** P1 (Enables investment vs speculation tracking)  
**Scope:** 1 SQL migration, 3 new files, 2 modified files  

## OBJECTIVE

Track market scenarios across multiple horizons (speculation, swing, investment) with bias-aware outcome classification, dedup prevention, and automated invalidation logic.

## REQUIRED TASKS

### T-4A-01: Market Scenarios Migration

**Task ID:** T-4A-01
**Phase:** Phase 4A — market_scenarios tables
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Create market_scenarios, scenario_horizon_outcomes, scenario_status_history tables with enums for multi-horizon tracking.

**Migration path:** backend/scripts/migrate-market-scenarios.sql

**Acceptance criteria:**
- All tables and enums created
- Numeric precision correct (numeric(24,12) for prices, numeric(10,4) for percents)
- Indexes on dedupeKey, status, dueAt, etc.
- Additive only (no existing tables modified)

**Testing / verification:**
- Tables exist with correct schemas
- Enums include all required values (scenario_status: pending/active/completed/expired/invalidated)

### T-4B-01: Scenario Tracker Service

**Task ID:** T-4B-01
**Phase:** Phase 4B — scenarioTracker.service.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Implement scenario creation with dedup, horizon outcomes generation, and status updates.

**Files modified:**
- backend/src/services/scenarioTracker.service.ts (new)

**Acceptance criteria:**
- createScenario generates dedupeKey correctly and prevents duplicates
- createHorizonOutcomesForScenario creates 11 outcomes (3 spec + 3 swing + 5 invest) with dueAt from referencePriceAt + duration
- updateScenarioStatus inserts history row

### T-4C-01: Outcome Checker Cron

**Task ID:** T-4C-01
**Phase:** Phase 4C — scenarioOutcomeChecker.cron.ts
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Hourly cron to capture outcomes using historical candles from referencePriceAt to dueAt.

**Files modified:**
- backend/src/crons/scenarioOutcomeChecker.cron.ts (new)
- backend/src/server.ts (cron registration)

**Acceptance criteria:**
- Fetches candles from referencePriceAt to dueAt
- Bias-aware classification (bullish favors positive change, bearish favors negative)
- Invalidation logic checks risk zones and invalidationPrice
- changePercent = ((priceAtHorizon - priceAtStart) / priceAtStart) * 100

### T-4D-01: Drizzle Model Updates

**Task ID:** T-4D-01
**Phase:** Phase 4D — market.model.ts updates
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Add market_scenarios, scenario_horizon_outcomes, scenario_status_history tables to Drizzle schema.

**Files modified:**
- backend/src/models/market.model.ts

**Acceptance criteria:**
- All enums defined (source_type, scenario_type, bias_type, etc.)
- Numeric precision matches migration
- Indexes match migration

### T-4E-01: Verification Script

**Task ID:** T-4E-01
**Phase:** Phase 4E — verify-phase4-scenarios.js
**Owner:** Senior Developer
**Status:** Done

**Objective:**
Read-only script to verify scenario data integrity.

**Files modified:**
- backend/scripts/verify-phase4-scenarios.js (new)

**Acceptance criteria:**
- Checks total scenarios, by status/type/bias
- Verifies duplicate dedupeKeys
- Validates reference prices
- Handles no-data gracefully

---

## DEFERRED ITEMS

- **aiWorkflow scenario integration:** Deferred per Phase 4 plan (env flag SCENARIO_TRACKER_ENABLED exists for future enable)
- **Phase 3 levelIntelligenceCron.ts:** Known gap/stub - level intelligence does not run automatically (confirmed in QA)

---

*Phase 4 completed: May 3, 2026*
*Enables: Multi-horizon scenario tracking with automated outcomes and invalidation*

---

---

# Phase 4.5 — Activation & Backfill Readiness

**Status:** DONE — QA PASS
**Date:** May 3, 2026
**Priority:** P0 (Activates Phase 3/4 infrastructure)
**Scope:** 4 modified files, 1 new script

## OBJECTIVE

Turn Phase 3/4 passive infrastructure into safely activated production systems with controlled backfill.

## REQUIRED TASKS

### T-4.5A-01: Level Intelligence Cron Activation

**Status:** Done

**Implementation:**
- Replaced stub with real cron calling levelIntelligence.service.ts
- Processes MAJOR_COINS = ['BTC', 'ETH', 'SOL', 'ADA', 'LINK', 'DOT', 'AVAX', 'MATIC']
- Supports timeframes: 1h, 4h, 1d, 1w
- Configurable via LEVEL_INTELLIGENCE_MAX_COINS (default 8), LEVEL_INTELLIGENCE_TIMEFRAMES
- Per coin/timeframe try/catch isolation
- Rate-limited with 100ms delays between requests
- Logs: start, enabled/disabled, coin count, timeframes, success/failure summary

### T-4.5A-02: Scenario Creation Integration

**Status:** Done

**Implementation:**
- Added scenario creation to aiWorkflow.cron.ts after coinNewsHistory insert
- Controlled by SCENARIO_TRACKER_ENABLED (default false)
- Eligibility: eventSeverity >=3 (MAJOR), price available, sentiment in ['bullish','bearish']
- Creates speculation scenarios with dedupeKey prevention
- Maps: event->sourceType, sourceHash->sourceId, symbol->coinSymbol, sentiment->bias
- Failure wrapped in try/catch, does not break articles/radar/scorecard

### T-4.5A-03: Safe Backfill Script

**Status:** Done

**Files:** backend/scripts/backfill-phase45-scenarios.js

**Implementation:**
- Dry-run default mode, requires --execute for writes
- Scope: Last 14 days, MAJOR_COINS, major/high-severity events only
- Conservative mapping: sentiment->bias, title->thesis, eventType->eventType
- Logs: scanned, eligible, skipped, created, duplicates
- Respects dedupeKey, creates speculation scenarios

### T-4.5A-04: Verification Updates

**Status:** Done

**Implementation:**
- Extended verify-phase3-levels.js: checks levels/interactions updated in last 24h, activation status
- Extended verify-phase4-scenarios.js: checks scenarios created in last 24h, activation status
- Added invalid price/confidence checks

## OPERATIONAL CONTROLS

### Environment Variables

**LEVEL_INTELLIGENCE_ENABLED** (default: false)
- Controls level intelligence cron execution
- When false: cron logs and exits safely
- When true: processes levels and interactions

**LEVEL_INTELLIGENCE_MAX_COINS** (default: 8)
- Limits coins processed per run
- Prevents excessive API load
- Major coins: BTC, ETH, SOL, ADA, LINK, DOT, AVAX, MATIC

**LEVEL_INTELLIGENCE_TIMEFRAMES** (default: '1h,4h,1d,1w')
- Configurable timeframes as comma-separated string
- Supported: 1h, 4h, 1d, 1w

**SCENARIO_TRACKER_ENABLED** (default: false)
- Controls automatic scenario creation in aiWorkflow
- When false: scenario creation skipped safely
- When true: creates scenarios for eligible MAJOR events

### Safe Defaults

- All activation flags default to false
- Production starts safely disabled
- Operators must explicitly enable
- No broad backfill by default

### Rollback Plan

1. **Disable env flags:**
   - LEVEL_INTELLIGENCE_ENABLED=false
   - SCENARIO_TRACKER_ENABLED=false

2. **Stop crons:**
   - Comment out levelIntelligenceCron registration in server.ts
   - aiWorkflow continues running normally

3. **Leave tables unused:**
   - level_intelligence/interactions remain populated
   - market_scenarios remain populated
   - No data deletion needed

4. **Verify deactivation:**
   - Run verification scripts
   - Confirm no new updates in 24h

### Run Commands

**Enable Level Intelligence:**
```bash
# Set env vars
LEVEL_INTELLIGENCE_ENABLED=true
LEVEL_INTELLIGENCE_MAX_COINS=8
LEVEL_INTELLIGENCE_TIMEFRAMES=1h,4h,1d,1w

# Restart server to pick up env changes
# Cron runs automatically every 6 hours
```

**Enable Scenario Creation:**
```bash
# Set env var
SCENARIO_TRACKER_ENABLED=true

# Restart server
# Scenarios created automatically for new MAJOR events
```

**Run Verification:**
```bash
# Level intelligence health
node backend/scripts/verify-phase3-levels.js

# Scenario tracker health
node backend/scripts/verify-phase4-scenarios.js
```

**Safe Backfill:**
```bash
# Preview what would be created
node backend/scripts/backfill-phase45-scenarios.js

# Execute backfill (requires explicit flag)
node backend/scripts/backfill-phase45-scenarios.js --execute
```

### Known Limitations

- Level intelligence processes only major coins (no all-Binance scanning)
- Scenario creation limited to speculation type initially
- Backfill limited to last 14 days only
- No AI-generated outcomes (uses real price data only)
- No target/risk zone invention (conservative mapping)

### Monitoring

**Level Intelligence:**
- Check cron logs for "LevelIntelligenceCron" entries
- Verify levels updated in last 24h via verification script
- Monitor interaction creation rates

**Scenario Creation:**
- Check aiWorkflow logs for "Created scenario" entries
- Verify scenarios created in last 24h via verification script
- Monitor dedupeKey duplicates (should be 0)

**Performance:**
- Level cron should complete within minutes
- Scenario creation should not slow aiWorkflow
- No impact on existing Living Articles/Radar/Scorecard

---

*Phase 4.5 authored: May 3, 2026*
*Enables: Safe activation of intelligence infrastructure*

---

---

# Phase 5 — Smart Monitoring Cadence & Production Observation

**Status:** DONE — QA PASS
**Date:** May 3, 2026
**Priority:** P0 (Safe monitoring for intelligence systems)
**Scope:** 1 health script, 1 matrix deliverable, 1 runbook, 1 optional cron

## OBJECTIVE

Create production-safe monitoring layer for intelligence infrastructure activated in Phase 4.5. Focus on read-only health checks and cadence analysis - no public changes, no forced activation, no heavy services.

## REQUIRED TASKS

### T-5.1: Cron/Cadence Audit

**Status:** Done

**Implementation:**
- Audited all 17 registered crons in server.ts
- 15 crons have no env flag (cannot be disabled without code edit)
- 2 crons have env flags (LevelIntelligence, ScenarioOutcomeChecker - disabled by default)
- Core chain: TerminalEngine → TriageEngine → AiWorkflow (highest risk if any fails)
- All other crons are isolated
- External API dependencies: OpenRouter (AI), Binance (price/data), Telegram, RSS feeds, Alternative.me, DeFiLlama, Zhipu

### T-5.2: Production Health Check Script

**Status:** Done

**Files:** backend/scripts/verify-intelligence-health.js

**Implementation:**
- Read-only health verification for Phase 2/3/4/4.5
- Checks env flag status, duplicate dedupeKeys, due pending outcomes, failed outcomes, stale active scenarios, invalid confidence/price values
- Reports row counts for all intelligence tables
- Handles no-data state gracefully
- No INSERT/UPDATE/DELETE operations

### T-5.3: Smart Cadence Matrix

**Status:** Done

**Implementation:**
Matrix based on T-5.1 audit findings:

| System | Current Cadence | Proposed Cadence | Env Flag | External API Risk | DB Growth Risk | Recommendation |
|--------|-----------------|------------------|----------|-------------------|----------------|-----------------|
| AiWorkflow | Hourly (0 * * * *) | Keep hourly | None | High (OpenRouter/Binance) | High (articles/radar) | Keep hourly, monitor AI rate limits |
| LevelIntelligence | 6h (0 */6 * * *) | Keep 6h | LEVEL_INTELLIGENCE_ENABLED | Medium (Binance) | Medium | Keep 6h |
| ScenarioOutcomeChecker | Hourly (0 * * * *) | Keep hourly | SCENARIO_TRACKER_ENABLED | Medium (Binance) | Low | Keep hourly |
| SignalPerformance | 6h (0 */6 * * * ) | Keep 6h | None | Low (Binance) | Low | Keep 6h |
| EventOutcomeChecker | 30min (*/30 * * * *) | Keep 30min | None | Medium (Binance) | Low | Keep 30min, note: high-frequency monitoring |
| TpslMonitor | 15min (*/15 * * * *) | Keep 15min | None | Low (Binance) | Low | Keep 15min, note: high-frequency monitoring |
| HistoricalNews | Daily (0 4 * * *) | Keep daily | None | None | Low | Keep daily |
| TelegramMonitor | 30min news + 4h airdrops | Keep schedules | TELEGRAM_SESSION_STRING | Low (Telegram) | Medium (buffer) | Keep schedules |
| AirdropDiscovery | 6h (0 */6 * * *) | Keep 6h | None | Medium (Zhipu/DeFiLlama) | Medium | Keep 6h |
| AirdropRSSHunter | 6h (0 */6 * * *) | Keep 6h | None | Medium (OpenRouter) | Medium | Keep 6h |
| AirdropHunter | 12h (0 */12 * * *) | Keep 12h | None | Medium (OpenRouter) | Medium | Keep 12h |
| BufferCleanup | Daily (0 0 * * *) | Keep daily | None | None | Low | Keep daily |
| DailyAlpha | 8h (0 */8 * * *) | Keep 8h | None | None | Low | Keep 8h |
| TerminalEngine | 10min (*/10 * * * *) | Keep 10min | None | Low (RSS) | High (buffer) | Keep 10min, note: core gathering |
| TriageEngine | 2h (0 */2 * * *) | Keep 2h | None | Medium (OpenRouter) | Low | Keep 2h |
| ConvictionUpdate | 6h (0 */6 * * *) | Keep 6h | None | None | Low | Keep 6h |
| MarketMood | Daily (0 7 * * *) | Keep daily | None | Low (Alternative.me) | Low | Keep daily |

**Key Findings:**
- AiWorkflow is highest risk (core AI processing, no env flag)
- EventOutcomeChecker and TpslMonitor are high-frequency monitors (30min and 15min)
- TerminalEngine is core gathering engine (10min, feeds triage)
- 15 crons cannot be disabled via env flags (limitation for rollback)
- All cadences are conservative and match current production schedules

### T-5.4: Production Observation Runbook

**Status:** Done

**Implementation:**
Comprehensive runbook added to THE_NEXUS_HUB.md with:

**Day 0 Checks (Pre-Activation):**
- Run `node backend/scripts/verify-intelligence-health.js`
- Confirm LEVEL_INTELLIGENCE_ENABLED=false, SCENARIO_TRACKER_ENABLED=false
- Verify no intelligence activity in logs for 24h
- Check table row counts as baseline

**Canary Activation Steps (Gradual Enablement):**
1. Enable LEVEL_INTELLIGENCE_ENABLED=true first
2. Observe for 24h: check level updates in verify script, monitor cron logs
3. If stable, enable SCENARIO_TRACKER_ENABLED=true
4. Observe for 24h: check scenario creation in verify script

**Daily Checks for 3-7 Days Post-Activation:**
- Run verify-intelligence-health.js daily
- Check cron logs for AiWorkflow errors
- Monitor Binance API error rate (should be <1%)
- Check DB row growth (levels/scenarios should increase steadily)
- Verify duplicate dedupeKeys = 0
- Check due pending outcomes < 100
- Check failed outcomes = 0

**Rollback Procedures:**
- Set LEVEL_INTELLIGENCE_ENABLED=false, SCENARIO_TRACKER_ENABLED=false
- Restart server to pick up env changes
- For non-flagged crons: edit server.ts to comment out registrations
- Verify deactivation: run verify script, confirm no new updates in 24h

**Healthy/Warning Thresholds:**
- Scenarios created per day: healthy 1-20, warning >50 (too aggressive)
- Levels detected per coin: healthy 5-50, warning >100 (too noisy)
- Interactions per day: healthy 10-200, warning >500 (performance impact)
- Pending due outcomes: healthy 0-10, warning >50 (processing backlog)
- Failed outcomes: healthy 0, warning >0 (investigate immediately)
- Binance errors: healthy <1%, warning >5% (API issues)

**Safe Monitoring Commands:**
- Health check: `node backend/scripts/verify-intelligence-health.js`
- Cron logs: Check server logs for "Cron started/failed" entries
- DB growth: Compare row counts daily
- API health: Monitor Binance response times

### T-5.5: Optional Monitoring Cron

**Status:** Implemented

**Files:** backend/src/crons/monitoringCron.ts, backend/src/server.ts

**Implementation:**
- MONITORING_CRON_ENABLED=false by default
- Read-only operations only (SELECT queries)
- No external notifications
- No heavy queries (lightweight row counts only)
- Registered in server.ts with conditional check
- Lightweight health summary logging
- Schedule: every 6 hours (0 */6 * * *)

## OPERATIONAL CONTROLS

### Environment Variables

**MONITORING_CRON_ENABLED** (default: false)
- Controls monitoring cron execution
- When false: cron not registered
- When true: runs lightweight health logging

### Safe Defaults

- All monitoring disabled by default
- No forced activation
- Read-only operations only
- No external alerting

### Rollback Plan

1. **Disable monitoring:**
   - MONITORING_CRON_ENABLED=false
   - Restart server

2. **Remove cron:**
   - Comment out monitoringCron registration in server.ts
   - Delete monitoringCron.ts file

3. **No data cleanup needed**

### Run Commands

**Enable Monitoring:**
```bash
# Set env var
MONITORING_CRON_ENABLED=true

# Restart server
# Cron runs automatically every 6 hours
```

**Run Health Check:**
```bash
node backend/scripts/verify-intelligence-health.js
```

## MONITORING

**Health Check Script:**
- Run daily during activation period
- Check for data integrity issues
- Monitor system health metrics

**Cron Monitoring:**
- Check server logs for cron execution
- Monitor error rates and processing times
- Alert on failed cron runs

**Performance:**
- Health script completes in <10 seconds
- Monitoring cron adds negligible load
- No impact on existing AI workflows

---

*Phase 5 completed: May 3, 2026*
*Enables: Safe production monitoring for intelligence systems*

---

---

# Phase 6A — Event Impact Analysis MVP

**Status:** PLANNED — Ready for immediate execution after Phase 1-5 completion
**Date:** May 3, 2026
**Priority:** P1 (Read-only MVP for event impact analysis)
**Scope:** 1 service, 1 script, 1 env flag, 1 policy-safe wording update, 1 documentation update, 1 QA prep
**Reviewed by:** Lead Architect — APPROVED FOR EXECUTION

## OBJECTIVE

Deliver a read-only MVP for event impact analysis that calculates basic historical statistics from existing coin_news_history data without any database writes, migrations, or UI changes. Phase 6A focuses on safe, deterministic calculations with policy-safe output wording.

## PHASE 6A SCOPE LIMITATIONS

**Phase 6A is strictly read-only and analytical only:**

- ✅ Read-only calculations using existing coin_news_history data
- ✅ Deterministic statistical analysis (averages, medians, rates)
- ✅ Console output for manual analysis
- ✅ Policy-safe terminology definitions
- ✅ Safe environment flag controls

**Phase 6A explicitly does NOT include:**
- ❌ Database migrations or schema changes
- ❌ Database writes or data persistence
- ❌ New tables or columns
- ❌ Public UI changes or displays
- ❌ Living Articles modifications
- ❌ Scorecard updates
- ❌ External API integrations
- ❌ Cron job automation
- ❌ AI workflow integration
- ❌ Public user-facing features

**Future Phase 6B (separate approval required):**
- Database persistence of analysis results
- UI integration for historical impact views
- Automated cron-based analysis updates
- Advanced statistical modeling
- AI-enhanced pattern recognition

## REQUIRED TASKS

### T-6A.1 — Verify coin_news_history Field Names

**Task ID:** T-6A.1
**Title:** Verify coin_news_history Field Names
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Document the exact field names and data types in coin_news_history table that contain the required data for impact analysis calculations.

**Files to inspect:**
- backend/src/models/market.model.ts — coinNewsHistory table definition
- SQL schema documentation if available

**Files allowed to modify:**
- Documentation files (e.g., agent_gedens/PROJECT_STATE.md or THE_NEXUS_HUB.md for findings)

**Forbidden files:**
- Any code files
- Migration files
- Schema files

**Constraints:**
- Read-only inspection only
- No code changes unless documenting findings in approved docs

**Step-by-step instructions:**
1. Review coinNewsHistory table definition in market.model.ts
2. Identify fields for: change1h, change4h, change24h, change3d, change7d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification
3. Document exact camelCase field names used in Drizzle model
4. Note any nullable fields or data type constraints

**Documented Field Mappings:**
From backend/src/models/market.model.ts (lines 209-248):

- change1h: real('change_1h').nullable() — 1-hour price change percentage
- change4h: real('change_4h').nullable() — 4-hour price change percentage
- change24h: real('change_24h').nullable() — 24-hour price change percentage
- change3d: real('change_3d').nullable() — 3-day price change percentage
- maxUpsideAfterEvent: real('max_upside_after_event').nullable() — Maximum upside percentage after event
- maxDrawdownAfterEvent: real('max_drawdown_after_event').nullable() — Maximum drawdown percentage after event
- timeToPeakHours: integer('time_to_peak_hours').nullable() — Hours to reach maximum upside
- timeToBottomHours: integer('time_to_bottom_hours').nullable() — Hours to reach maximum drawdown
- outcomeClassification: varchar('outcome_classification', { length: 30 }).nullable() — POSITIVE/NEGATIVE/NEUTRAL classification

All fields are nullable (no .notNull() constraint), allowing for partial data population.

**Acceptance criteria:**
- Documented field mapping from SQL to TypeScript
- Confirmed availability of required fields from Phase 1 schema

**QA checklist:**
- Fields exist and are populated in historical data
- Data types match calculation requirements

**Rollback notes:**
- No changes to revert

---

### T-6A.2 — Create Read-Only Event Impact Analysis Service

**Task ID:** T-6A.2
**Title:** Create Read-Only Event Impact Analysis Service
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Implement backend/src/services/eventImpactAnalysis.service.ts that performs read-only calculations of event impact statistics using existing coin_news_history data.

**Files to inspect:**
- backend/src/models/market.model.ts — coinNewsHistory schema
- Existing service patterns in backend/src/services/

**Files allowed to modify:**
- backend/src/services/eventImpactAnalysis.service.ts (new file)

**Forbidden files:**
- Migrations
- Models schema changes
- Crons
- Controllers
- Frontend files
- Living Articles files
- Scorecard files

**Constraints:**
- Zero any types — use explicit TypeScript types
- Read-only operations only (SELECT queries)
- No database writes
- Service must be stateless and deterministic

**Step-by-step instructions:**
1. Create new service file with proper imports
2. Define interfaces for input parameters and output statistics
3. Implement calculation functions for:
   - change percent per available horizon
   - sample size
   - average change
   - median change
   - positive/negative/neutral rate
   - average max upside
   - average max drawdown
   - average time to peak
   - average time to bottom
4. Use Drizzle queries to fetch historical data
5. Handle edge cases (no data, small samples) gracefully
6. Export main analysis function

**Acceptance criteria:**
- Service compiles without any types
- Calculations are deterministic and accurate
- No database modifications performed

**QA checklist:**
- Test with known historical data sets
- Verify calculation accuracy against manual checks
- Confirm no side effects on database

**Rollback notes:**
- Delete the service file
- No data cleanup needed

---

### T-6A.3 — Create Manual Read-Only Analysis Script

**Task ID:** T-6A.3
**Title:** Create Manual Read-Only Analysis Script
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Create backend/scripts/analyze-event-impact.js that uses the eventImpactAnalysis service to perform read-only analysis and print console summary.

**Files to inspect:**
- Existing script patterns in backend/scripts/
- backend/src/services/eventImpactAnalysis.service.ts (after T-6A.2)

**Files allowed to modify:**
- backend/scripts/analyze-event-impact.js (new file)

**Forbidden files:**
- Any files not listed in allowed

**Constraints:**
- Must use the service from T-6A.2
- Only print console summary (no file writes, no DB writes)
- Check EVENT_IMPACT_ENGINE_ENABLED flag
- Exit safely if flag is false or missing

**Step-by-step instructions:**
1. Create Node.js script file
2. Import required dependencies and service
3. Check EVENT_IMPACT_ENGINE_ENABLED environment variable
4. If false or missing, print message and exit cleanly
5. If enabled, call service with sample parameters
6. Format and print analysis results to console
7. Handle errors gracefully without crashing

**Acceptance criteria:**
- Script runs successfully when flag is true
- Exits safely when flag is false or missing
- Console output shows readable analysis summary

**QA checklist:**
- Test with flag enabled/disabled
- Verify no database modifications
- Check error handling

**Rollback notes:**
- Delete the script file
- No data cleanup needed

---

### T-6A.4 — Add EVENT_IMPACT_ENGINE_ENABLED Flag

**Task ID:** T-6A.4
**Title:** Add EVENT_IMPACT_ENGINE_ENABLED Flag
**Assigned Agent:** Senior Developer
**Status:** Pending

**Objective:**
Add EVENT_IMPACT_ENGINE_ENABLED environment variable configuration with safe defaults.

**Files to inspect:**
- backend/src/config/env.ts — existing env configuration

**Files allowed to modify:**
- backend/src/config/env.ts

**Forbidden files:**
- Any files not listed

**Constraints:**
- Default value must be false
- Missing env var must not cause startup crashes
- Configuration must be accessible by scripts and services

**Step-by-step instructions:**
1. Locate existing env configuration pattern
2. Add EVENT_IMPACT_ENGINE_ENABLED with default false
3. Ensure safe handling when env var is undefined
4. Export the configuration value

**Acceptance criteria:**
- Server starts normally with missing env var
- Configuration defaults to false
- Can be overridden by setting env var to true

**QA checklist:**
- Test server startup with env var unset
- Test with env var set to false/true
- Verify no crashes or errors

**Rollback notes:**
- Remove the env configuration
- No data changes

---

### T-6A.5 — Policy-Safe Output Wording

**Task ID:** T-6A.5
**Title:** Policy-Safe Output Wording
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Define and document policy-safe terminology for historical impact analysis output.

**Files to inspect:**
- Existing policy-safe mappings in documentation

**Files allowed to modify:**
- Documentation files (THE_NEXUS_HUB.md or agent_gedens/)

**Forbidden files:**
- No code changes
- No public UI changes
- No prompt integration changes

**Constraints:**
- Only define terminology mappings
- No implementation of mappings
- Focus on historical analysis context

**Step-by-step instructions:**
1. Define safe terms for output:
   - historical observed movement
   - historical pattern
   - reference price
2. Avoid prohibited terms:
   - buy/sell
   - take profit
   - stop loss
   - expected profit
   - guaranteed
3. Document the terminology guidelines
4. Note that this is for future implementation reference

**Policy-Safe Terminology Guidelines:**

For historical impact analysis output, use the following terminology to ensure AdSense compliance and avoid financial advice implications:

**Preferred Safe Terms:**
- Historical observed movement (instead of "price movement" with predictive context)
- Historical pattern (instead of "trend" implying future continuation)
- Reference price (instead of "entry price")
- Upside target zone (instead of "take profit level")
- Invalidation zone (instead of "stop loss")
- Risk zone (instead of "stop loss area")
- Bullish/Bearish bias (instead of "buy/sell signal")
- Observed outcome (instead of "successful trade")
- Historical summary (instead of "performance report")
- Data-driven market context (instead of "trading opportunity")
- Not financial advice (disclaimer)

**Prohibited Terms to Avoid:**
- Buy now / Sell now
- Enter trade / Take position
- Take profit / Stop loss (in direct terms)
- Expected profit / Guaranteed returns
- This will go up/down
- Recommended action
- Investment opportunity
- Trading strategy advice

**Guidelines:**
- Always frame analysis as historical observations, not predictions
- Use "historical observed movement" for price changes after events
- Reference "market scenarios" instead of "trading signals"
- Include "Not financial advice" disclaimer in any public output
- Focus on data patterns and statistical observations

**Acceptance criteria:**
- Terminology guidelines documented
- Clear mapping from internal to public-safe language

**QA checklist:**
- Review terminology for AdSense compliance
- Confirm no financial advice implications

**Rollback notes:**
- Remove documentation
- No code changes

---

### T-6A.6 — Documentation Update

**Task ID:** T-6A.6
**Title:** Documentation Update
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Update project documentation to clarify Phase 6A scope and future phases.

**Files to inspect:**
- THE_NEXUS_HUB.md — current phase documentation

**Files allowed to modify:**
- THE_NEXUS_HUB.md

**Forbidden files:**
- No code files

**Constraints:**
- Document Phase 6A as read-only
- Explain limitations (no migrations, no writes, no UI changes)
- Reference future Phase 6B for persistence

**Step-by-step instructions:**
1. Add documentation section for Phase 6A
2. Clearly state read-only nature
3. List what's NOT included in Phase 6A
4. Reference future phases for advanced features

**Acceptance criteria:**
- Documentation accurately reflects Phase 6A scope
- Clear distinction from future phases

**QA checklist:**
- Review for accuracy and completeness
- Ensure no conflicting information

**Rollback notes:**
- Remove the documentation section

---

### T-6A.7 — QA Checklist Preparation

**Task ID:** T-6A.7
**Title:** QA Checklist Preparation
**Assigned Agent:** Prompt Engineer
**Status:** Done

**Objective:**
Prepare comprehensive QA checklist for Phase 6A implementation.

**Files to inspect:**
- Existing QA patterns in previous phases

**Files allowed to modify:**
- Documentation files (THE_NEXUS_HUB.md)

**Forbidden files:**
- No code files

**Constraints:**
- Prepare checklist for QA & Security Hunter
- Cover all tasks T-6A.1 through T-6A.6
- Include testing scenarios and acceptance criteria

**Step-by-step instructions:**
1. Create QA checklist section
2. Include test cases for each task
3. Add verification steps for calculations
4. Include safety checks (no DB writes, flag behavior)
5. Prepare for handoff to QA team

**Comprehensive QA Checklist for Phase 6A:**

**Pre-Implementation Checks:**
- [ ] Review THE_NEXUS_HUB.md for Phase 6A scope limitations
- [ ] Confirm all assigned tasks (T-6A.1 through T-6A.7) are documented
- [ ] Verify no forbidden files are modified (no code, no migrations, no UI)

**T-6A.1 Verification (Field Names):**
- [ ] Inspect backend/src/models/market.model.ts coinNewsHistory table
- [ ] Verify all required fields exist: change1h, change4h, change24h, change3d, maxUpsideAfterEvent, maxDrawdownAfterEvent, timeToPeakHours, timeToBottomHours, outcomeClassification
- [ ] Confirm fields are nullable (real('field').nullable())
- [ ] Check exact camelCase naming matches Drizzle conventions
- [ ] Document any data type mismatches

**T-6A.2 Verification (Service Implementation):**
- [ ] Review backend/src/services/eventImpactAnalysis.service.ts
- [ ] Verify zero 'any' types used
- [ ] Check explicit TypeScript interfaces for inputs/outputs
- [ ] Confirm all queries are SELECT-only (no INSERT/UPDATE/DELETE)
- [ ] Test compilation with `cd backend && npx tsc --noEmit`
- [ ] Verify deterministic calculations (same input = same output)
- [ ] Check edge case handling (no data, small samples)

**T-6A.3 Verification (Manual Script):**
- [ ] Review backend/scripts/analyze-event-impact.js
- [ ] Confirm EVENT_IMPACT_ENGINE_ENABLED flag check
- [ ] Verify safe exit when flag is false/missing
- [ ] Test script execution prints console summary only
- [ ] Confirm no file writes or DB modifications
- [ ] Check error handling without crashes

**T-6A.4 Verification (Environment Flag):**
- [ ] Review backend/src/config/env.ts
- [ ] Confirm EVENT_IMPACT_ENGINE_ENABLED defaults to false
- [ ] Test server startup with missing env var (no crashes)
- [ ] Test with env var set to true/false
- [ ] Verify configuration is accessible by scripts/services

**T-6A.5 Verification (Policy-Safe Wording):**
- [ ] Review terminology guidelines in THE_NEXUS_HUB.md
- [ ] Check all prohibited terms are listed and avoided
- [ ] Verify safe term mappings are comprehensive
- [ ] Confirm focus on historical analysis context
- [ ] Audit for AdSense compliance

**T-6A.6 Verification (Documentation):**
- [ ] Check Phase 6A scope limitations section exists
- [ ] Verify read-only nature clearly stated
- [ ] Confirm list of excluded features is complete
- [ ] Review future Phase 6B reference
- [ ] Ensure no conflicting information with existing docs

**T-6A.7 Verification (This Checklist):**
- [ ] Self-review checklist completeness
- [ ] Verify alignment with all task requirements
- [ ] Confirm coverage of all Phase 6A tasks
- [ ] Check clear pass/fail criteria for each item
- [ ] Prepare for handoff to QA & Security Hunter

**Integration Testing:**
- [ ] Run analysis script with flag enabled (if service implemented)
- [ ] Verify console output uses policy-safe terminology
- [ ] Check no database writes occur during analysis
- [ ] Test with various data scenarios (empty, partial, full)
- [ ] Monitor for any unintended side effects

**Safety Checks:**
- [ ] Confirm no migrations run
- [ ] Verify no new tables/columns added
- [ ] Check no UI changes made
- [ ] Ensure no external APIs added
- [ ] Confirm no crons enabled
- [ ] Test server stability with new flag

**Edge Cases:**
- [ ] Analysis with zero historical events
- [ ] Partial data (some horizons missing)
- [ ] Invalid or extreme price values
- [ ] Network/API failures (though read-only)
- [ ] Large datasets performance

**Acceptance criteria:**
- Comprehensive checklist covering all aspects
- Clear pass/fail criteria
- Includes edge cases and error scenarios

**QA checklist:**
- Self-review checklist completeness
- Verify alignment with task requirements

**Rollback notes:**
- Remove the QA checklist section

---

## VALIDATION CHECKLIST

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Run field verification | Documented field names match schema |
| 2 | Service compilation | No TypeScript errors, zero any types |
| 3 | Sample calculations | Accurate statistics from historical data |
| 4 | Script execution with flag false | Exits safely without analysis |
| 5 | Script execution with flag true | Prints analysis summary |
| 6 | Server startup | No crashes with missing env var |
| 7 | QA checklist review | Complete coverage of Phase 6A |

---

## FILES SUMMARY

| File | Status | Change |
|------|--------|--------|
| backend/src/services/eventImpactAnalysis.service.ts | 🔴 TODO | New — read-only analysis service |
| backend/scripts/analyze-event-impact.js | 🔴 TODO | New — manual analysis script |
| backend/src/config/env.ts | 🔴 TODO | Add EVENT_IMPACT_ENGINE_ENABLED flag |
| THE_NEXUS_HUB.md | 🔴 TODO | Documentation updates |

**Total: 3 new files, 1 modified file**

---

## PRIORITY ORDER

```
1. T-6A.1 — Field verification (foundation)
2. T-6A.2 — Service implementation (core logic)
3. T-6A.4 — Env flag (enables safe control)
4. T-6A.3 — Manual script (depends on service + flag)
5. T-6A.5 — Policy wording (parallel)
6. T-6A.6 — Documentation (parallel)
7. T-6A.7 — QA prep (final)
```

---

## RISK NOTES

1. **Read-only constraint** — Must ensure no accidental DB writes in service
2. **Type safety** — Zero any types required, explicit interfaces needed
3. **Flag safety** — Missing env var must not crash, defaults to disabled
4. **Policy compliance** — Output wording must remain analysis-focused, not advice

---

*Phase 6A authored: May 3, 2026*
*Enables: Read-only event impact analysis MVP*

---

---

# Phase 5 — Level Intelligence Engine

**Status:** DEFERRED — No implementation until gating conditions pass  
**Date:** May 2, 2026  

## GATING CONDITIONS

**Must pass ALL before implementation:**

1. **Phase 1 Complete:** coin_news_history has outcome data for >1000 events  
2. **Phase 4 Complete:** price_snapshots has OHLCV data for >30 days  
3. **SQL Query:** `SELECT COUNT(*) FROM coin_news_history WHERE outcome7d IS NOT NULL` > 1000  
4. **SQL Query:** `SELECT COUNT(*) FROM price_snapshots WHERE interval = '1h'` > 10000  

## PREREQUISITES

- Historical price data available  
- Sufficient event-outcome correlations  
- Level detection algorithms defined  

## FUTURE DETERMINISTIC ALGORITHMS

### Pivot Detection
- Identify swing highs/lows using zigzag algorithm  
- Filter by volume and price movement significance  

### Swing High/Low Clustering
- Group nearby swing points  
- Calculate support/resistance strength  

### Level Clustering
- Merge overlapping levels  
- Weight by touch frequency and volume  

### Touch/Bounce/Break/Fakeout Detection
- Track price interaction with levels  
- Classify reaction types  

### Support/Resistance Flip Detection
- Monitor level breaches  
- Update level classifications  

## IMPLEMENTATION STATUS

**No implementation tasks created yet.**  
**Phase remains in planning until gates pass.**  
**Estimated gate pass date: 2-3 weeks after Phase 1 deployment.**

---

---

# Phase 5b — Smart Monitoring Cadence

**Status:** PLANNED  
**Date:** May 2, 2026  

## CADENCE PLAN

### Every 5 Minutes
**Jobs:** Real-time price monitoring, urgent alerts  
**Why:** Critical price movements, flash crashes  
**Cost/Freshness Tradeoff:** High cost, maximum freshness  
**Redis Lock:** Required (prevent overlap)  
**API Load:** High (multiple exchanges)  

### Every 15 Minutes
**Jobs:** News triage, sentiment analysis  
**Why:** News velocity requires frequent checking  
**Cost/Freshness Tradeoff:** Medium cost, good freshness  
**Redis Lock:** Required  
**API Load:** Medium  

### Every 30 Minutes
**Jobs:** Event outcome checking, signal updates  
**Why:** Balance between timeliness and resource usage  
**Cost/Freshness Tradeoff:** Low cost, acceptable freshness  
**Redis Lock:** Required  
**API Load:** Low  

### Hourly
**Jobs:** Price snapshots, technical analysis updates  
**Why:** Hourly candles are standard timeframe  
**Cost/Freshness Tradeoff:** Low cost, sufficient freshness  
**Redis Lock:** Required  
**API Load:** Low  

### Daily
**Jobs:** Deep analytics, strategic updates  
**Why:** Daily summaries, trend analysis  
**Cost/Freshness Tradeoff:** Very low cost, periodic freshness  
**Redis Lock:** Not critical (can run sequentially)  
**API Load:** Very low  

### Weekly
**Jobs:** Maintenance, cleanup, long-term analytics  
**Why:** Weekly cycles for cleanup and reporting  
**Cost/Freshness Tradeoff:** Minimal cost, maintenance-focused  
**Redis Lock:** Not required  
**API Load:** Minimal  

---

---

# Phase 6 — AI Cost Reduction

**Status:** PLANNED  
**Date:** May 2, 2026  

## DETERMINISTIC PARTS NEEDING NO AI

- Price movement calculations (arithmetic only)  
- Volume analysis (statistical formulas)  
- Time-based expiry (date math)  
- Simple classification rules (if-then logic)  

## DEEPSEEK DIRECT USAGE

- Primary analysis (already using deepseek-reasoner)  
- Cost-effective reasoning for complex decisions  

## Z.AI / GLM WEB_SEARCH USAGE

- Fallback for web search when Tavily fails  
- Cost comparison vs other providers  

## OPENROUTER USAGE REMAINING NECESSARY

- Specialty models (code, math, specific domains)  
- When DeepSeek doesn't fit requirements  

## CACHING OPPORTUNITIES

- Temporal pattern results (cache per event type + coin)  
- Level calculation results (cache per timeframe)  
- Workflow context (cache conversation state)  

## BATCHING OPPORTUNITIES

- Multiple similar analyses in single request  
- Bulk outcome classifications  

## AVOIDING HUGE JSON RE-SENDS

- Reference IDs instead of full objects  
- Delta updates for changing data  

---

---

# Phase 7 — Public Language / Google-Safe Presentation

**Status:** PLANNED  
**Date:** May 2, 2026  

## PHASE 0.5 COMPLETED WORK

- Scorecard terminology sanitized  
- Disclaimer language strengthened  
- Internal verdict values remain raw  

## REMAINING AUDIT TASKS

### Radar Terminology
- Replace "signals" with "insights" in public UI  
- Change "BUY/SELL" to "Bullish/Bearish Outlook"  

### Article Prompt Terminology
- Update AI prompts to use policy-safe language  
- Avoid financial advice framing  

### Meta Title/Description Rules
- Remove price predictions from SEO text  
- Focus on analysis and information  

### Internal vs Public Wording Mapping
| Internal | Public |
|----------|--------|
| BUY | Bullish |
| SELL | Bearish |
| Signal | Insight |
| Prediction | Analysis |

## RULE

**Backend/internal verdict values can remain raw.**  
**Public UI must be mapped to policy-safe labels.**

---

---

# Phase 8 — Migration Strategy

**Status:** PLANNED  
**Date:** May 2, 2026  

## PER-PHASE MIGRATION

### Phase 1
- **Parallel:** Yes (adds columns, doesn't change logic)  
- **Replace Old:** No (extends existing tables)  
- **Rollback:** Drop columns + index  
- **Backfill:** None (new data only)  
- **Testing:** 1 week smoke test  
- **Risks:** Large migration, monitor DB performance  
- **Safety:** Nullable columns, no breaking changes  

### Phase 2
- **Parallel:** Yes (expands interfaces, backward compatible)  
- **Replace Old:** Partial (enhanced temporal logic)  
- **Rollback:** Revert interface changes  
- **Backfill:** None  
- **Testing:** Unit tests for new calculations  
- **Risks:** AI prompt changes may affect analysis quality  
- **Safety:** Gradual rollout with monitoring  

### Phase 3
- **Parallel:** Yes (adds horizon routing)  
- **Replace Old:** No (extends signal system)  
- **Rollback:** Remove horizon logic  
- **Backfill:** Classify existing signals  
- **Testing:** Signal routing verification  
- **Risks:** UI changes require frontend deploy  
- **Safety:** Backward compatible schema changes  

### Phase 4
- **Parallel:** Yes (new snapshots don't affect existing)  
- **Replace Old:** No (price_snapshots is new feature)  
- **Rollback:** Drop OHLCV columns  
- **Backfill:** None  
- **Testing:** Cron execution monitoring  
- **Risks:** Binance rate limits  
- **Safety:** Independent feature  

### Phase 5
- **Parallel:** Yes (deterministic algorithms)  
- **Replace Old:** No (new analysis layer)  
- **Rollback:** Remove level detection  
- **Backfill:** None  
- **Testing:** Algorithm accuracy validation  
- **Risks:** False signals from level detection  
- **Safety:** Gating conditions prevent premature deployment  

---

---

# Top 10 Recommended Improvements

| Rank | Improvement | Phase | Impact | Difficulty | Risk | Expected Value | Why | Owner |
|------|-------------|-------|--------|------------|------|----------------|-----|-------|
| 1 | Multi-horizon temporal patterns | 2 | 9 | 6 | 3 | High | Enables data-rich analysis context | Prompt Engineer |
| 2 | Level intelligence engine | 5 | 10 | 8 | 5 | Very High | Automated support/resistance detection | Senior Developer |
| 3 | Investment vs speculation separation | 3 | 8 | 5 | 4 | High | Clear strategy differentiation | Senior Developer |
| 4 | OHLCV price snapshots | 4 | 7 | 4 | 2 | Medium | Technical analysis foundation | Senior Developer |
| 5 | AI cost optimization | 6 | 6 | 7 | 3 | Medium | Reduces operational costs | Prompt Engineer |
| 6 | Smart monitoring cadence | 5b | 5 | 3 | 1 | Low | Optimizes resource usage | Senior Developer |
| 7 | Event-price outcome foundation | 1 | 9 | 6 | 4 | High | Core data for all temporal intelligence | Senior Developer |
| 8 | Public language audit | 7 | 4 | 2 | 1 | Low | AdSense compliance | Prompt Engineer |
| 9 | Migration strategy documentation | 8 | 3 | 1 | 1 | Very Low | Operational safety | Senior Developer |
| 10 | Deferred phase gating | 5 | 2 | 1 | 1 | Very Low | Prevents premature implementation | Lead Architect |

---

---

# Top 10 Questions / Unknowns

| Rank | Question | Why Matters | Options | Recommendation | Cost/Risk | Product Owner Input |
|------|----------|-------------|---------|----------------|-----------|-------------------|
| 1 | Should Phase 5 algorithms be AI-assisted or purely deterministic? | Affects accuracy vs cost | Pure deterministic, Hybrid AI+deter, Full AI | Pure deterministic first | Low cost/low risk | Yes |
| 2 | Which coins for Phase 4 snapshots? | Coverage vs API limits | Top 50 market cap, Top 100, Custom watchlist | Top 50 market cap | Medium cost | Yes |
| 3 | How to handle conflicting signals in Phase 3? | User experience impact | Suppress conflicts, Show all with warnings, Merge into single | Show all with warnings | Low risk | Yes |
| 4 | Phase 2 fallback matching quality impact? | Analysis accuracy | Test on sample data, Monitor A/B, Rollback if quality drops | Test extensively first | Medium risk | No |
| 5 | Should Phase 1 outcomes be user-visible? | Transparency vs complexity | Hide internally, Show as analysis context, Full public disclosure | Show as analysis context | Low risk | Yes |
| 6 | Migration rollback procedures sufficient? | Operational safety | Add more rollback tests, Trust current plan, Add automated rollback | Trust current plan | Low risk | No |
| 7 | Phase 6 caching strategy effectiveness? | Cost reduction potential | Measure cache hit rates, Adjust TTLs, Abandon if <50% hit | Measure first | Low cost | No |
| 8 | Public language mapping completeness? | AdSense approval risk | Audit all UI text, Sample check, Full compliance review | Full compliance review | High cost | Yes |
| 9 | Phase 5b cadence optimization impact? | Resource savings | Monitor current usage, Implement gradually, Full optimization | Implement gradually | Low risk | No |
| 10 | Should Phase 3 investment theses have TP/SL? | Strategy completeness | No (ongoing), Yes (with wide targets), Optional | Optional | Medium complexity | Yes |