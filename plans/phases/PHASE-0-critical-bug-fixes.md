# PHASE 0 — Critical Bug Fixes

> **Depends on:** Nothing — do this first.
> **Goal:** Bring the broken pipeline back to life.
> **Files affected:** `terminalEngine.cron.ts`, `prompt-factory.ts`, `TerminalWire.tsx`, `useTerminalChat.ts`, `TerminalChat.tsx`, `triageEngine.cron.ts`, `openai.service.ts`, `env.ts`

---

## Task 0-A: Replace CryptoCompare with RSS

**File:** `backend/src/crons/terminalEngine.cron.ts`
**Problem:** Lines 16-47 call `min-api.cryptocompare.com` which returns auth errors every 10 minutes. The `fetchAllRSSNews()` function already exists in `rssNews.service.ts` and is fully functional.

### Changes Required:

1. **Remove** the `axios` import on line 2
2. **Remove** the `NEWS_SOURCES` array on lines 16-18
3. **Remove** the entire `fetchLatestNews()` function on lines 20-47
4. **Add** import: `import { fetchAllRSSNews } from '../services/rssNews.service';`
5. **Replace** line 53 (`const newsItems = await fetchLatestNews()`) with:
   ```typescript
   const rssItems = await fetchAllRSSNews();
   const newsItems = rssItems.map(item => ({ title: item.title, source: item.source }));
   ```
6. **Keep ALL** deduplication logic (lines 55-94) unchanged.
7. **Remove** unused import `generateDualNewsOutput` from line 6 and `deleteCache` from line 7 and `env` from line 8 (these are no longer used by this file).

---

### Prompt for Senior AI — Task 0-A:

```
You are the Senior Developer for OnlyAlpha. Execute this micro-task with precision.

=== FILE: backend/src/crons/terminalEngine.cron.ts ===

Do the following changes IN ORDER:

1. REMOVE these imports (lines 2, 6, 7, 8):
   - `import axios from 'axios';`
   - `import { generateDualNewsOutput } from '../services/openai.service';`
   - `import { deleteCache } from '../config/redis';`
   - `import { env } from '../config/env';`

2. ADD this import (after remaining imports):
   `import { fetchAllRSSNews } from '../services/rssNews.service';`

3. REMOVE the entire NEWS_SOURCES constant (lines 15-18) and its comment.

4. REMOVE the entire fetchLatestNews() async function (lines 20-47) and its comment.

5. REPLACE line 53:
   FROM: `const newsItems = await fetchLatestNews();`
   TO:
   ```typescript
   const rssItems = await fetchAllRSSNews();
   const newsItems = rssItems.map(item => ({ title: item.title, source: item.source }));
   ```

6. DO NOT change anything else. Keep all deduplication logic, the hashTitle function, runTerminalEngine(), and startTerminalEngineCron() exactly as they are.

Rules: ZERO `any` types. Do not modify any other files.
```

---

## Task 0-B: Language Mandate in All Prompts

**File:** `backend/src/services/ai/prompt-factory.ts`

### Changes Required:

1. Add `LANGUAGE_MANDATE` constant after the imports (after line 2, before the interfaces):

```typescript
export const LANGUAGE_MANDATE = `
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
Write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters.
Translate any non-English input to English before using it.
Violation makes the entire output invalid.
`.trim();
```

2. In ALL 9 prompt builder methods inside the `PromptFactory` class, prepend `${LANGUAGE_MANDATE}\n\n` to the FIRST system message `content` string. The methods are:

| # | Method | Line | What to prepend before |
|---|--------|------|----------------------|
| 1 | `buildMarketVerdictMessages` | 92 | `You are an elite crypto market analyst...` |
| 2 | `buildDeepIntelligenceMessages` | 115 | `You are an elite cryptocurrency intelligence analyst...` |
| 3 | `buildTriageMessages` | 146 | `You are a crypto news triage analyst...` |
| 4 | `buildDualNewsStep1Messages` | 169 | `You are an elite cryptocurrency news analyst...` |
| 5 | `buildDualNewsStep2Messages` | 193 | `You are an expert crypto SEO content editor...` |
| 6 | `buildAirdropValidationMessages` | 220 | `You are an expert at identifying legitimate...` |
| 7 | `buildChatMessages` | 248 | Both `systemPrompt` assignments (context mode and general mode) |
| 8 | `buildDeepSynthesisMessages` | 283 | `systemPrompt` array first element |
| 9 | `buildArticleSEOMessages` | 333 | `systemPrompt` array first element |

### Example:
```typescript
// BEFORE:
content: `You are an elite crypto market analyst...`
// AFTER:
content: `${LANGUAGE_MANDATE}\n\nYou are an elite crypto market analyst...`
```

---

### Prompt for Senior AI — Task 0-B:

```
You are the Senior Developer for OnlyAlpha. Execute this micro-task with precision.

=== FILE: backend/src/services/ai/prompt-factory.ts ===

STEP 1: After line 2 (the type alias), add this constant BEFORE the interfaces:

```typescript
export const LANGUAGE_MANDATE = `
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
Write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters.
Translate any non-English input to English before using it.
Violation makes the entire output invalid.
`.trim();
```

STEP 2: In the PromptFactory class, prepend `${LANGUAGE_MANDATE}\n\n` to the first content string of ALL 9 methods:

1. buildMarketVerdictMessages (line 92): add before "You are an elite crypto market analyst"
2. buildDeepIntelligenceMessages (line 115): add before "You are an elite cryptocurrency intelligence analyst"
3. buildTriageMessages (line 146): add before "You are a crypto news triage analyst"
4. buildDualNewsStep1Messages (line 169): add before "You are an elite cryptocurrency news analyst"
5. buildDualNewsStep2Messages (line 193): add before "You are an expert crypto SEO content editor"
6. buildAirdropValidationMessages (line 220): add before "You are an expert at identifying"
7. buildChatMessages (line 247-258): add before BOTH systemPrompt template strings (context mode AND general mode)
8. buildDeepSynthesisMessages (line 283): add before first array element "'You are an elite cryptocurrency deep analysis engine...'"
9. buildArticleSEOMessages (line 333): add before first array element "'You are an expert crypto SEO content editor...'"

STEP 3: Do NOT change any interfaces, return types, or logic. Only prepend the mandate.

Rules: ZERO `any` types. Do not modify any other files.
```

---

## Task 0-C: Fix UI Bugs (5 sub-tasks)

### 0-C-1: TerminalWire — Show ALL Signals, Highlight Only

**File:** `frontend/src/features/terminal/components/TerminalWire.tsx`

**Problem:** Lines 40-42 filter radar signals by `targetedCoin`, hiding non-matching signals entirely.

**Fix:** Remove the `filteredRadar` variable. Use `radarSignals` directly for display. Use `targetedCoin` ONLY for the amber border highlight.

**Changes:**
1. Remove lines 40-42 (the `filteredRadar` variable)
2. Replace ALL references to `filteredRadar` with `radarSignals` throughout the JSX (lines 68, 74, 125)
3. On line 83, update the border logic to ALSO highlight when `targetedCoin` matches:
   ```tsx
   className={`p-4 bg-black border cursor-pointer transition-all ${
       isSelectedRadar || (targetedCoin && item.coin?.toLowerCase() === targetedCoin.toLowerCase())
           ? 'border-amber-500 bg-amber-500/5'
           : 'border-[#333] hover:border-[#555]'
   }`}
   ```

### 0-C-2: ChatMode Type Fix

**File:** `frontend/src/features/terminal/hooks/useTerminalChat.ts`
- Line 4: Change `'private'` to `'context'`
  ```typescript
  export type ChatMode = 'general' | 'context';
  ```

### 0-C-3: TerminalChat Mode Setter Fix

**File:** `frontend/src/features/terminal/components/TerminalChat.tsx`
- Line 45: Change `setMode('private')` to `setMode('context')`
- Line 46: Change BOTH occurrences of `mode === 'private'` to `mode === 'context'`

### 0-C-4: Disclaimer Timeout Fallback

**File:** `frontend/src/features/terminal/hooks/useTerminalChat.ts`
**Problem:** The disclaimer check (lines 45-55) can deadlock if the API never responds, leaving `disclaimerAccepted` as `null` forever.

**Fix:** Replace the useEffect with a 3-second timeout fallback:

```typescript
useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    (async () => {
        try {
            const { data } = await apiClient.get('/chat/disclaimer-status', {
                signal: controller.signal
            });
            setDisclaimerAccepted(data.accepted ?? false);
        } catch {
            setDisclaimerAccepted(false);
        }
    })();

    return () => {
        clearTimeout(timeoutId);
        controller.abort();
    };
}, []);
```

### 0-C-5: SSE Parsing Fix

**File:** `frontend/src/features/terminal/hooks/useTerminalChat.ts`
- Line 102: Change `line.replace('data:', '')` to `line.slice(5).trim()`
  - `replace('data:', '')` only removes the FIRST occurrence if there are multiple "data:" in the line
  - `slice(5).trim()` always removes exactly the first 5 characters ("data:") which is correct SSE format

---

### Prompt for Senior AI — Task 0-C:

```
You are the Senior Developer for OnlyAlpha. Execute this micro-task with precision.

=== 5 UI bug fixes across 3 frontend files ===

--- FIX 1: TerminalWire.tsx ---
File: frontend/src/features/terminal/components/TerminalWire.tsx

1. REMOVE the `filteredRadar` variable (lines 40-42):
   ```typescript
   const filteredRadar = targetedCoin
       ? radarSignals.filter(r => r.coin?.toLowerCase() === targetedCoin.toLowerCase())
       : radarSignals;
   ```

2. REPLACE all occurrences of `filteredRadar` with `radarSignals` in the JSX (3 places: lines 68, 74, 125)

3. UPDATE the className on line 83 to add targetedCoin amber highlight:
   ```tsx
   className={`p-4 bg-black border cursor-pointer transition-all ${
       isSelectedRadar || (targetedCoin && item.coin?.toLowerCase() === targetedCoin.toLowerCase())
           ? 'border-amber-500 bg-amber-500/5'
           : 'border-[#333] hover:border-[#555]'
   }`}
   ```

--- FIX 2: useTerminalChat.ts ChatMode ---
File: frontend/src/features/terminal/hooks/useTerminalChat.ts

Line 4: Change `'private'` to `'context'`:
```typescript
export type ChatMode = 'general' | 'context';
```

--- FIX 3: TerminalChat.tsx Mode ---
File: frontend/src/features/terminal/components/TerminalChat.tsx

Line 45: Change `setMode('private')` to `setMode('context')`
Line 46: Change BOTH `mode === 'private'` to `mode === 'context'`

--- FIX 4: useTerminalChat.ts Disclaimer Timeout ---
File: frontend/src/features/terminal/hooks/useTerminalChat.ts

REPLACE the entire disclaimer useEffect (lines 45-55) with:
```typescript
useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    (async () => {
        try {
            const { data } = await apiClient.get('/chat/disclaimer-status', {
                signal: controller.signal
            });
            setDisclaimerAccepted(data.accepted ?? false);
        } catch {
            setDisclaimerAccepted(false);
        }
    })();

    return () => {
        clearTimeout(timeoutId);
        controller.abort();
    };
}, []);
```

--- FIX 5: useTerminalChat.ts SSE Parsing ---
File: frontend/src/features/terminal/hooks/useTerminalChat.ts

Line 102: Change `line.replace('data:', '')` to `line.slice(5).trim()`

Rules: Do not modify any other files. Do not change any logic outside of what is specified above.
```

---

## Task 0-D: Environment Cleanup

**Files:** `.env` (local + production)

### Changes Required:
1. **Remove** `CRYPTOCOMPARE_API_KEY=...` from `.env`
2. **Remove** `COINCAP_API_KEY=...` from `.env`
3. **Verify** `ANALYSIS_MODEL=deepseek/deepseek-r1` is set correctly
4. **Verify** `SEO_MODEL=openai/gpt-5-nano` is set correctly
5. **Keep** `TAVILY_API_KEY=...` (emergency fallback only)
6. **Remove** `COINCAP_API_KEY` from `backend/src/config/env.ts` if it exists

---

## Task 0-E: Fix Triage → Deep Analysis Link (CRITICAL)

**Problem:** The triage engine only saves `relevanceScore` and `sentimentHint` to the buffer. It does NOT save `symbolMentions`, `eventType`, or `eventSeverity`. This means `deep-analysis-router.ts` line 44 sees empty mentions → groups everything as `UNKNOWN` → `aiWorkflow.cron.ts` line 39 filters them all out → zero articles published.

### Changes Required across 3 files:

#### File 1: `backend/src/services/ai/prompt-factory.ts`

**Replace** the `buildTriageMessages()` system prompt (lines 146-155) with the new triage prompt that requests `symbolMentions`, `eventType`, and `eventSeverity`:

```
You are a crypto news triage analyst for OnlyAlpha.
For EACH headline in the input array, return one JSON object.
Return an array in the SAME ORDER as input, wrapped in { "results": [...] }.

Per item:
{
  "relevanceScore": <0-100>,
  "sentimentHint": "bullish|bearish|neutral",
  "symbolMentions": ["BTC", "ETH"],
  "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
  "eventSeverity": <1|2|3>
}

Scoring:
90-100  Exchange listings, hacks, SEC actions, ETF approvals, exploits, token launches
70-89   Price milestones, whale moves, mainnet upgrades, major funding (>$50M)
50-69   Minor updates, small partnerships, opinion pieces
0-49    Spam, rehashed news, promotional content

Severity:
3 = CRITICAL: Hack confirmed, SEC action, top-5 exchange listing, ETF approval, $100M+ funding
2 = MAJOR: Protocol upgrade, $10M-$100M funding, mid-tier listing, Fortune 500 partnership
1 = MINOR: Small partnership, minor update, community news
```

#### File 2: `backend/src/services/openai.service.ts`

**Modify** `generateLightweightTriage()` (lines 166-221):

1. **Expand** the return type to include new fields:
   ```typescript
   Promise<Array<{
       title: string;
       source?: string;
       relevanceScore: number;
       sentimentHint: string | null;
       symbolMentions: string[];
       eventType: string;
       eventSeverity: number;
   }>>
   ```

2. **Update** the `gateway.chat` generic type (line 178) to include the new fields:
   ```typescript
   const parsed = await gateway.chat<{
       results?: Array<{
           relevanceScore: number;
           sentimentHint: string | null;
           symbolMentions?: string[];
           eventType?: string;
           eventSeverity?: number;
       }>;
       triageScores?: Array<{
           relevanceScore: number;
           sentimentHint: string | null;
           symbolMentions?: string[];
           eventType?: string;
           eventSeverity?: number;
       }>;
   }>({ ... });
   ```

3. **Update** the triagedNews mapping (lines 192-199) to extract new fields:
   ```typescript
   symbolMentions: Array.isArray(scoreObj.symbolMentions)
       ? scoreObj.symbolMentions.map((s: string) => s.toUpperCase())
       : [],
   eventType: typeof scoreObj.eventType === 'string' ? scoreObj.eventType : 'Other',
   eventSeverity: typeof scoreObj.eventSeverity === 'number'
       ? Math.max(1, Math.min(3, Math.round(scoreObj.eventSeverity)))
       : 1,
   ```

4. **Update** the fallback results (lines 207-211) to include:
   ```typescript
   symbolMentions: [],
   eventType: 'Other',
   eventSeverity: 1,
   ```

5. **Update** ALL type annotations in the function to match the new return type (cache.get, cache.set, etc.)

#### File 3: `backend/src/crons/triageEngine.cron.ts`

**Modify** the `db.update().set()` call (lines 61-67) to save the new fields:
```typescript
await db.update(rawNewsBuffer)
    .set({
        relevanceScore: scoredItem.relevanceScore,
        sentimentHint: scoredItem.sentimentHint,
        symbolMentions: scoredItem.symbolMentions,
        processed: true
    })
    .where(eq(rawNewsBuffer.id, item.id));
```

---

### Prompt for Senior AI — Task 0-E:

```
You are the Senior Developer for OnlyAlpha. This is the CRITICAL bug fix — the pipeline is broken because triage doesn't extract coin symbols. Execute this micro-task with precision across 3 files.

=== FILE 1: backend/src/services/ai/prompt-factory.ts ===

In the buildTriageMessages() method, REPLACE the entire system message content (lines 146-155) with:

```
You are a crypto news triage analyst for OnlyAlpha.
For EACH headline in the input array, return one JSON object.
Return an array in the SAME ORDER as input, wrapped in { "results": [...] }.

Per item:
{
  "relevanceScore": <0-100>,
  "sentimentHint": "bullish|bearish|neutral",
  "symbolMentions": ["BTC", "ETH"],
  "eventType": "<ETF|Hack|Exploit|Listing|Delisting|Upgrade|TokenLaunch|Regulatory|Funding|Partnership|Other>",
  "eventSeverity": <1|2|3>
}

Scoring:
90-100  Exchange listings, hacks, SEC actions, ETF approvals, exploits, token launches
70-89   Price milestones, whale moves, mainnet upgrades, major funding (>$50M)
50-69   Minor updates, small partnerships, opinion pieces
0-49    Spam, rehashed news, promotional content

Severity:
3 = CRITICAL: Hack confirmed, SEC action, top-5 exchange listing, ETF approval, $100M+ funding
2 = MAJOR: Protocol upgrade, $10M-$100M funding, mid-tier listing, Fortune 500 partnership
1 = MINOR: Small partnership, minor update, community news
```

The ${LANGUAGE_MANDATE} should still be at the very beginning (from Task 0-B).

=== FILE 2: backend/src/services/openai.service.ts ===

Modify generateLightweightTriage() (starting at line 166):

1. Define a named interface BEFORE the function:
```typescript
interface TriageResult {
    title: string;
    source?: string;
    relevanceScore: number;
    sentimentHint: string | null;
    symbolMentions: string[];
    eventType: string;
    eventSeverity: number;
}
```

2. Change return type to `Promise<TriageResult[]>`

3. Update ALL cache.get<TriageResult[]>() calls to use the new type

4. Change the gateway.chat generic type to:
```typescript
const parsed = await gateway.chat<{
    results?: Array<{
        relevanceScore: number;
        sentimentHint: string | null;
        symbolMentions?: string[];
        eventType?: string;
        eventSeverity?: number;
    }>;
    triageScores?: Array<{
        relevanceScore: number;
        sentimentHint: string | null;
        symbolMentions?: string[];
        eventType?: string;
        eventSeverity?: number;
    }>;
}>({ ... });
```

5. Update the triagedNews mapping to include:
```typescript
symbolMentions: Array.isArray(scoreObj.symbolMentions)
    ? scoreObj.symbolMentions.map((s: string) => s.toUpperCase())
    : [],
eventType: typeof scoreObj.eventType === 'string' ? scoreObj.eventType : 'Other',
eventSeverity: typeof scoreObj.eventSeverity === 'number'
    ? Math.max(1, Math.min(3, Math.round(scoreObj.eventSeverity)))
    : 1,
```

6. Update the fallback results to include:
```typescript
symbolMentions: [],
eventType: 'Other',
eventSeverity: 1,
```

=== FILE 3: backend/src/crons/triageEngine.cron.ts ===

In the db.update().set() block (around line 61-67), ADD symbolMentions:
```typescript
await db.update(rawNewsBuffer)
    .set({
        relevanceScore: scoredItem.relevanceScore,
        sentimentHint: scoredItem.sentimentHint,
        symbolMentions: scoredItem.symbolMentions,
        processed: true
    })
    .where(eq(rawNewsBuffer.id, item.id));
```

Rules: ZERO `any` types. Keep ALL existing retry logic, fallback logic, and caching patterns. Do NOT change any other functions or files.
```

---

## Phase 0 Completion Checklist

- [ ] 0-A: `terminalEngine.cron.ts` uses RSS instead of CryptoCompare (axios removed, fetchAllRSSNews imported)
- [ ] 0-B: `LANGUAGE_MANDATE` added to all 9 prompt builder methods in `prompt-factory.ts`
- [ ] 0-C-1: `TerminalWire.tsx` shows ALL radar signals, uses `targetedCoin` for highlight only
- [ ] 0-C-2: `useTerminalChat.ts` ChatMode type uses `'context'` instead of `'private'`
- [ ] 0-C-3: `TerminalChat.tsx` mode setter uses `'context'`
- [ ] 0-C-4: Disclaimer useEffect has 3-second timeout fallback
- [ ] 0-C-5: SSE parsing uses `line.slice(5).trim()`
- [ ] 0-D: Dead env keys removed (CRYPTOCOMPARE_API_KEY, COINCAP_API_KEY)
- [ ] 0-E: Triage extracts `symbolMentions`, `eventType`, `eventSeverity` — saved to buffer
