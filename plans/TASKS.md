# OnlyAlpha — Execution Tasks

**Workflow:** Execute Task 1 → verify → Task 2 → verify → ... sequentially.
**Reference:** `MASTER_EXECUTION_PLAN.md` for full details.

---

## Tech Lead Architectural Review — 2026-04-09

### Current Progress
| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 0 (Hotfixes) | COMPLETE | 1-6 all done |
| Phase 1 (Cost Opt) | COMPLETE | 7-10 all done |
| Phase 2 (Living Articles) | COMPLETE | 11-14 all done |
| Phase 3 (Temporal Intel) | COMPLETE | 15 done |
| Phase 4 (Chat Rebuild) | COMPLETE | 16 done |
| Phase 5 (Frontend) | COMPLETE | 17-19 all done |
| Phase 6 (Embeddings) | COMPLETE | 20 done |

### Critical Architectural Gaps Found

**1. MISSING: Living Article API Endpoints (Phase 2 gap)**
Phase 2 creates `coin_master_articles` + `coin_timeline_updates` tables and cron logic, but NO API endpoints are planned. Phase 5 frontend (Tasks 18, 5.3, 5.4) needs these endpoints to fetch data.
-> Added as **Task 11b** (new task between 11 and 12)

**2. MISSING: Data Migration Script**
When we switch to Living Articles, existing `coin_news` articles with high quality should be migrated to `coin_master_articles` (one per coin). Without this, the system starts empty.
-> Added as **Task 11c** (new task)

**3. RISK: Triage Field Naming Conflict**
Plan adds `classification` (MAJOR/MINOR/NOISE) + `triggerType` (whale/regulation/technical) to triage. But `rawNewsBuffer` already has `eventType` (ETF/Hack/etc). The values of `eventType` and `triggerType` overlap conceptually. The existing `eventType` should be KEPT as-is (it's a useful field), and `classification` added separately. `triggerType` values should be a SUBSET derivation from `eventType`, not a parallel field.
-> Decision: Keep `eventType`, ADD `classification` only. Derive `triggerType` from `eventType` mapping in code (no AI needed).
-> Updated Task 12 scope below.

**4. WEAKNESS: Conviction Score Algorithm (Task 14)**
- No recency decay: events from 29 days ago = events from today
- Sentiment weighting ignores magnitude (score += 5 for any bullish, regardless of impactScore)
- Trend calculation is too simplistic
-> Added detailed improvements to Task 14 scope.

**5. BUG: Task 4.2 Chat Quotas Uses `any`**
The quota lookup code `(QUOTAS[plan as keyof QuotaConfig] as any)?.contextDaily` violates the zero-`any` rule.
-> Must be fixed during Task 16 implementation.

**6. RISK: Historical Cron Timeout (Task 9)**
`fetchHistoricalNewsForCoins(symbols)` runs for ALL coins from last 7 days. If 100+ coins, this will timeout.
-> Recommendation: Add batching (max 20 coins per batch with 2s delay). Low priority — only matters at scale.

**7. DEPENDENCY: Phase 4 depends on Phase 2**
Task 16 (Context AI prompt) references `coinMasterArticles` and `coinTimelineUpdates`. These don't exist until Tasks 11-13 complete. This is implicitly correct in ordering but should be explicit.

---

## Task 1: Fix Chat Context Mode Mismatch
**Phase:** 0 | **Priority:** CRITICAL
**Files:**
- `backend/src/controllers/chat.controller.ts`
- `frontend/src/features/terminal/hooks/useTerminalChat.ts`

**Scope:**
- 0.1.1: Accept `'context'` as valid mode in backend condition
- 0.1.2: Read mode from request body correctly
- 0.1.3: Frontend routes context requests to `/chat/stream/context`
- 0.1b: General AI injects lightweight article context
- F.3: Guard against guest sending `mode: 'context'` in body on general route — return 401 if `resolvedMode === 'context' && !req.userId`

**Verify:** Send a context mode chat message and confirm Context AI activates. Guest sending `mode: 'context'` on general route gets 401.

- [x] Implement
- [x] Verify

---

## Task 2: Fix SSE Stream Parsing Bug
**Phase:** 0 | **Priority:** CRITICAL
**Files:**
- `frontend/src/features/terminal/hooks/useTerminalChat.ts`

**Scope:**
- 0.2: Parse JSON chunks instead of appending raw strings

**Verify:** Chat response renders as plain text, not raw JSON.

- [x] Implement
- [x] Verify

---

## Task 3: Fix Buffer Cleanup (ttlExpiresAt)
**Phase:** 0 | **Priority:** CRITICAL
**Files:**
- `backend/src/crons/terminalEngine.cron.ts`

**Scope:**
- 0.3: Set `ttlExpiresAt` to 48 hours on insert

**Verify:** `raw_news_buffer` rows get cleaned up after 48h.

- [x] Implement
- [x] Verify

---

## Task 4: Fix Asset Count + Aggressive Caching
**Phase:** 0 | **Priority:** CRITICAL
**Files:**
- `backend/src/controllers/market.controller.ts`

**Scope:**
- 0.4: Count from `coinNews` instead of `marketInsights`
- 0.4.2: Short cache (30s) when count is 0
- 0.4.3: (Optional) Consider counting from `radarSignals` instead — reflects actual AI-processed tokens (see MASTER plan for alternative)

**Verify:** "Scanning X Assets" shows correct count > 0.

- [x] Implement
- [x] Verify

---

## Task 5: Protect force-seed + Fix Radar Duplication
**Phase:** 0 | **Priority:** HIGH
**Files:**
- `backend/src/routes/market.routes.ts`
- `backend/src/crons/aiWorkflow.cron.ts`

**Scope:**
- 0.5: Add `authMiddleware` to `/force-seed`
- 0.6: Link new radar signals to existing news via `newsId`

**Verify:** Unauthenticated `/force-seed` returns 401. No duplicate radar entries for same news.

- [x] Implement
- [x] Verify

---

## Task 6: Dead Code Cleanup
**Phase:** Cleanup | **Priority:** MEDIUM
**Files:** Multiple

**Scope:**
- Delete files: `deep-analysis-router.ts`, `data-augmenter.ts`
- Delete unused functions from `openai.service.ts`: `generateMarketVerdict`, `generateDeepIntelligenceReport`, `generateDualNewsOutput`
- Delete unused interfaces: `MarketVerdictResult`, `DeepIntelligenceReport`, `DualNewsOutput`, `RawAnalysis`
- Delete unused functions from `prompt-factory.ts`: `buildMarketVerdictMessages`, `buildDeepIntelligenceMessages`, `buildDualNewsStep1Messages`, `buildDualNewsStep2Messages`
- Delete unused `getAlphaStream()` from `terminal/api.ts` and `AnalysisStream` type from `terminal/types.ts`

**Verify:** App builds with no errors. All imports resolve.

- [x] Implement
- [x] Verify

---

## Task 7: Dual Gateway — DeepSeek Direct API
**Phase:** 1 | **Priority:** HIGH
**Files:**
- `backend/src/config/env.ts`
- `backend/.env`
- `backend/src/services/openai.service.ts`
- `backend/src/services/ai/quality-auditor.ts`

**Scope:**
- 1.1.1: Add DeepSeek env vars to schema
- 1.1.2: Add env vars to `.env`
- 1.1.3: Create dual gateways (openRouter + deepseek)
- 1.1.4: Route analysis calls through DeepSeek Direct — applies to all 3 sites: `callDeepSeekAnalysis`, `auditArticleQuality` (pass `deepseekGateway`), `generateLightweightTriage`
- 1.1.5: Update quality-auditor model constant to use DeepSeek Direct

**Verify:** DeepSeek analysis calls go to direct API when key is present. Fallback to OpenRouter when missing.

- [x] Implement
- [x] Verify

---

## Task 8: Move Triage to DeepSeek
**Phase:** 1 | **Priority:** HIGH
**Files:**
- `backend/src/services/openai.service.ts`

**Scope:**
- 1.2: `generateLightweightTriage` uses DeepSeek Direct gateway + model

**Verify:** Triage runs through DeepSeek API. Output format unchanged.

- [x] Implement
- [x] Verify

---

## Task 9: Historical News Daily Cron
**Phase:** 1 | **Priority:** HIGH
**Files:**
- `backend/src/crons/aiWorkflow.cron.ts` (remove historical fetch)
- `backend/src/crons/historicalNews.cron.ts` (new file)
- `backend/src/server.ts` (register cron)

**Scope:**
- 1.3.1: Remove `fetchHistoricalNewsForCoins` from per-hour aiWorkflow
- 1.3.2: Create daily cron (04:00 UTC) — must call BOTH `fetchHistoricalNewsForCoins(symbols)` AND `backfillPriceOutcomes()`
- 1.3.3: Register in server.ts

**Verify:** Historical fetch no longer runs every hour. Daily cron registered.

- [x] Implement
- [x] Verify

---

## Task 10: Conditional Audit + Feed coinMemory
**Phase:** 1 | **Priority:** HIGH
**Files:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Scope:**
- 1.4: Only audit articles with `impactScore >= 75` or `isBreaking`
- 1.5: Save to `coinMemory` after every published article

**Verify:** Audit skipped for low-impact articles. `coinMemory` populated after publish.

- [x] Implement
- [x] Verify

---

## Task 11: Living Article DB Schema
**Phase:** 2 | **Priority:** HIGH
**Files:**
- `backend/src/models/market.model.ts`
- `backend/src/models/index.ts`

**Scope:**
- 2.1.1: Add `coin_master_articles` table
- 2.1.2: Add `coin_timeline_updates` table
- 2.1.3: Export new models in index
- 2.1.4: Run Drizzle migration (dev: push, prod: generate + review + migrate)

**Verify:** Tables exist in DB. Models exported and importable.

- [x] Implement
- [x] Verify

---

## Task 11b: Living Article API Endpoints
**Phase:** 2 | **Priority:** HIGH | **DEPENDS ON:** Task 11
**Files:**
- `backend/src/controllers/market.controller.ts`
- `backend/src/routes/market.routes.ts`

**Scope:**
- `GET /api/market/master/:symbol` — Fetch master article by coin symbol (returns null if none exists)
  - Response: `{ masterArticle, timelineUpdates[], convictionScore, posture }`
  - Include latest 10 timeline updates ordered by createdAt DESC
  - Cache: 60s (articles update frequently)
- `GET /api/market/timeline/:symbol` — Fetch timeline only (for infinite scroll)
  - Query params: `offset` (default 0), `limit` (default 20, max 50)
  - Response: `{ updates[], total }`
  - Cache: 30s
- Both endpoints use `optionalAuth` (public read, no login required)

**Why Critical:** Without these, Phase 5 frontend (Task 18: LivingArticle.tsx, AlphaSnapshot.tsx) has no data source.

**Verify:** `GET /api/market/master/BTC` returns master article or 404. `GET /api/market/timeline/BTC?offset=0&limit=10` returns timeline array.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-10):** Endpoints `getMasterArticle` and `getTimeline` added to `market.controller.ts` and `market.routes.ts`. Caching: 60s master, 30s timeline.

---

## Task 11c: Seed Master Articles from Existing coin_news
**Phase:** 2 | **Priority:** MEDIUM | **DEPENDS ON:** Task 11
**Files:**
- `backend/src/scripts/seed-master-articles.ts` (new file, one-time script)

**Scope:**
One-time migration script (NOT a cron):
1. Fetch all unique coin symbols from `coin_news` that have published articles
2. For each symbol, pick the most recent article (highest impactScore if available)
3. Parse the article's `fullArticle` text using `extractSection()` to populate modular sections
4. Insert into `coin_master_articles` with available metadata (sentiment, verdict, etc.)
5. Create initial timeline entries from the last 3 articles per coin
6. Run: `npx tsx backend/src/scripts/seed-master-articles.ts`
7. Script should be idempotent — skip coins that already have master articles

**Why Needed:** Without this, Living Article system starts completely empty. Users won't see any master articles until new MAJOR events trigger creation.

**Verify:** After running script, `coin_master_articles` has rows for top coins. Timeline has historical entries.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-10):** Seed script at `backend/src/scripts/seed-master-articles.ts` (116 lines). Idempotent. Migrates top articles + seeds timeline.

---

## Task 12: Upgrade Triage — MAJOR/MINOR/NOISE Classification
**Phase:** 2 | **Priority:** HIGH | **DEPENDS ON:** Task 11 ✅
**Files:**
- `backend/src/services/ai/prompt-factory.ts`
- `backend/src/services/openai.service.ts` (TriageResult interface)
- `backend/src/models/market.model.ts` (rawNewsBuffer schema)
- `backend/src/crons/triageEngine.cron.ts`

**Scope:**
- 2.2.1: Add `classification` field to triage prompt output — values: `MAJOR`, `MINOR`, `NOISE`
  - MAJOR: ETF approvals, major hacks, SEC actions, top-10 listings, mainnet launches, $100M+ funding
  - MINOR: Price milestones, whale moves, partnerships, upgrades, small funding
  - NOISE: Rehashed/duplicate, promotional, opinion, old news rewritten
  - **DO NOT add `triggerType` as separate AI output** — derive it from existing `eventType` via mapping:
    ```typescript
    const TRIGGER_TYPE_MAP: Record<string, string> = {
      'Hack': 'security', 'Exploit': 'security',
      'ETF': 'regulation', 'Regulatory': 'regulation',
      'Listing': 'market', 'Delisting': 'market',
      'Funding': 'whale', 'Partnership': 'news',
      'Upgrade': 'technical', 'TokenLaunch': 'market',
    };
    ```
- 2.2.2: Update `TriageResult` interface — add `classification: 'MAJOR' | 'MINOR' | 'NOISE'` only
- 2.2.3: Add `classification` column to `rawNewsBuffer` schema (varchar 10). Do NOT add `triggerType` column.
- 2.2.4: Save classification in triageEngine. Derive triggerType in aiWorkflow from eventType mapping above.

**Verify:** Triage output includes `classification`. Saved to `rawNewsBuffer.classification`. `triggerType` derived in code, not from AI.

- [x] Implement
- [x] Verify

---

## Task 13: Refactor aiWorkflow for Living Articles
**Phase:** 2 | **Priority:** HIGH
**Files:**
- `backend/src/crons/aiWorkflow.cron.ts`
- `backend/src/services/openai.service.ts` (new helper functions)

**Scope:**
- 2.3: Full rewrite of `runAiWorkflow`
  - NOISE path: skip entirely
  - MINOR path: single GPT-nano call → timeline update
  - MAJOR path: full pipeline → master article update/create
- New helpers: `callGptNanoMinorUpdate`, `callGptNanoMasterUpdate`, `extractSection`
- Backward compatibility: still write to `coin_news`
- F.2: Add Redis-based mutex lock (`cron:aiworkflow:lock`, TTL 1h) to prevent duplicate runs when previous execution exceeds schedule interval. Apply same pattern to `TriageEngine` if needed.

**Verify:** NOISE items skipped. MINOR creates timeline updates only. MAJOR creates/updates master articles.

- [x] Implement
- [x] Verify

---

## Tech Lead Review — Post-Task 13 Audit (2026-04-09)

### Status Verified
| Task | Status | Notes |
|------|--------|-------|
| Task 11 | COMPLETE | `coinMasterArticles` + `coinTimelineUpdates` + `classification` column — all in schema |
| Task 11b | PENDING | No endpoints in `market.controller.ts` or `market.routes.ts` |
| Task 11c | PENDING | No seed script exists |
| Task 12 | COMPLETE | `classification` in TriageResult, prompt, triageEngine save — all correct |
| Task 13 | COMPLETE | NOISE/MINOR/MAJOR paths, Redis mutex, TRIGGER_TYPE_MAP, extractSection — all working |

---

### Bug #1: `saveMemory` — `riskVerdict` و `redFlags` متبادلين ومش صحيحين

**الملف:** `backend/src/crons/aiWorkflow.cron.ts` — MAJOR path، بعد `// 4h. Save to coinMemory`

**المشكلة:**
```typescript
await saveMemory({
    ...
    riskVerdict: analysisResult.analysis.riskNote,   // ← نص حر مثل "Volatility remains elevated"
    redFlags: analysisResult.keyFacts,               // ← ["BTC surged 15%", "Volume $2B"] — دول مش red flags!
    keyDrivers: [analysisResult.analysis.mainDriver], // ← ده بس الصح
    ...
});
```

**التفاصيل:**
- `analysisResult.analysis.riskNote` هو **نص حر** (جملة كاملة) من الـ AI مثلاً: `"Regulatory uncertainty could lead to a 20% pullback"`
- لكن `coinMemory.riskVerdict` هو `varchar(20)` — مصمم لقيم محددة: `'LOW'` / `'MEDIUM'` / `'HIGH'` / `'SCAM'`
- **النتيجة:** النص الحر هيتقطع عند 20 حرف (هيبقى `"Regulatory uncertaint"`) — بيانات مش مفيدة خالص
- `analysisResult.keyFacts` هو array من **حقائق رقمية** مثل `["BTC surged 15%", "Volume reached $2B"]` — **دي مش red flags، دول facts**
- الـ red flags الحقيقية لازم تكون التحذيرات والمخاطر من `analysisResult.analysis.riskNote`

**الحل المطلوب:**
```typescript
// Helper function — تتحط فوق في aiWorkflow.cron.ts
function deriveRiskLevel(impactScore: number, verdict: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM' {
    if (verdict === 'STRONG_SELL' || impactScore >= 85) return 'HIGH';
    if (verdict === 'SELL' || impactScore >= 65) return 'MEDIUM';
    return 'LOW';
}

// في saveMemory call:
await saveMemory({
    coinSymbol: symbol,
    eventType: eventType,
    eventSummary: article.headline,
    priceAtEvent: price?.price,
    verdict: analysisResult.verdict,
    confidenceScore: analysisResult.confidenceScore,
    riskVerdict: deriveRiskLevel(analysisResult.impactScore, analysisResult.verdict),
    keyDrivers: [analysisResult.analysis.mainDriver],
    redFlags: analysisResult.analysis.riskNote ? [analysisResult.analysis.riskNote] : [],
    sourceNewsHashes: [sourceHash],
});
```

**الأثر لو مش اتصلح:**
- `coinMemory.riskVerdict` = نص مقطوع مش مفيد → الـ chat context mode لما يقرأ من memory هيقول "Risk: Regulatory uncertaint" — شكل وحش
- `coinMemory.redFlags` = حقائق عادية بدل تحذيرات → المستخدم ممكن يشوف "Red Flag: BTC surged 15%" — مضلل
- الـ `conviction.service.ts` (Task 14) لو حسب الـ conviction بناءً على `riskVerdict` أو `redFlags` من memory، النتيجة هتبقى غلط

**الأولوية:** HIGH — لازم يتصلاح قبل Task 14

> ⚠️ **AUDIT (2026-04-10):** BUG NOT FIXED. `aiWorkflow.cron.ts` L358-361 still has `riskVerdict: analysisResult.analysis.riskNote` and `redFlags: analysisResult.keyFacts`. Must be corrected before Task 14.

---

### Bug #2: Task 11b — API Endpoints لسه مش موجودين

**الملفات:**
- `backend/src/controllers/market.controller.ts` — لا يوجد `getMasterArticle` أو `getTimeline`
- `backend/src/routes/market.routes.ts` — لا يوجد routes لـ `/master/:symbol` أو `/timeline/:symbol`

**المشكلة:**
Task 13 خلق البيانات (master articles + timeline updates) في الـ DB، لكن مفيش طريقة للـ frontend يوصلها. الـ endpoints الحالية هي:
- `GET /wire` → يجيب من `coin_news` (النظام القديم)
- `GET /wire/:id` → يجيب مقالة واحدة من `coin_news`
- مفيش endpoint ييجي من `coin_master_articles` أو `coin_timeline_updates`

Phase 5 (Task 18: `LivingArticle.tsx` + `AlphaSnapshot.tsx`) محتاجين:
- `GET /api/market/master/:symbol` → يجيب الـ master article + آخر 10 timeline updates
- `GET /api/market/timeline/:symbol` → يجيب timeline فقط (لـ infinite scroll)

من غير الـ endpoints دي، الـ frontend مش هيقدر يعرض أي Living Article — **Phase 5 كلها بلوكت**.

**الأولوية:** HIGH — بلوكر لـ Phase 5

---

### Bug #3: `getLatestWire` مش بيدعم `offset` parameter — FIXED

**الملف:** `backend/src/controllers/market.controller.ts:getLatestWire`

- [x] Implement — Added `offsetParam` parsing, included offset in `cacheKey`, added `.offset(offset)` to Drizzle query
- [x] Verify (frontend pagination)

---

### Bug #4: `callGptNanoMasterUpdate` — Return type بدون Validation

**الملف:** `backend/src/services/openai.service.ts:callGptNanoMasterUpdate`

**المشكلة:**
```typescript
export async function callGptNanoMasterUpdate(...): Promise<Partial<...>> {
    // ...
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return {}; }
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, unknown>;  // ← unchecked cast
}
```

الـ GPT-nano بيرجع JSON عشوائي — ممكن يرجع `{ "foo": "bar", "updated": true }` بدل الـ sections الصحيحة. الـ `as Record<string, unknown>` بيخبي المشكلة وبيمرر أي data للـ `db.update()`.

لما الـ data تتكتب في `coinMasterArticles`:
- Keys مش موجودة في Drizzle schema هتتنقل كـ `undefined` — Drizzle بيتجاهلها (safe)
- بس لو الـ AI رجع قيمة غلط لحقل موجود (مثلاً `confidenceScore: "very high"` بدل number) — هيحصل DB error

**الحل المطلوب (filter للـ allowed keys):**
```typescript
const ALLOWED_SECTIONS = [
    'coreCatalyst', 'marketContext', 'strategicImpact',
    'historicalContext', 'technicalLevels', 'riskAssessment', 'bottomLine',
    'headline', 'hook', 'metaTitle', 'metaDescription', 'seoKeywords',
    'sentiment', 'verdict', 'confidenceScore', 'riskTags'
];
const filtered: Record<string, unknown> = {};
const parsedObj = parsed as Record<string, unknown>;
for (const key of Object.keys(parsedObj)) {
    if (ALLOWED_SECTIONS.includes(key)) {
        filtered[key] = parsedObj[key];
    }
}
return filtered;
```

**الأولوية:** LOW — مش هيكسر حاجة دلوقتي (Drizzle safe)، بس المفروض يتصلح عشان production safety

---

### الترتيب المُوصَى بِه للمهام القادمة:

```
1. Bug #1 fix (saveMemory)         → DONE (already fixed)
2. Task 11b (API endpoints)        → DONE (already implemented)
3. Task 11c (Seed script)          → DONE (already implemented)
4. Bug #3 (wire offset)            → DONE
5. Task 14 (Conviction score)      → NEXT — HIGH PRIORITY
6. Bug #4 (master update filter)   → LOW — يتصلح لاحقاً
```

---

## Task 14: Conviction Score Service + Cron (Incremental Delta Architecture)
**Phase:** 2 | **Priority:** HIGH | **DEPENDS ON:** Task 13
**Files:**
- `backend/src/services/conviction.service.ts` (new file)
- `backend/src/crons/convictionUpdate.cron.ts` (new file)
- `backend/src/scripts/seed-historical-conviction.ts` (new file — one-time backfill)
- `backend/src/server.ts` (register cron)

**Architecture: Incremental Delta + Time Decay**

### 1. Core Formula (Incremental Update)
The 6-hour cron does NOT recalculate from scratch. It only queries `coinTimelineUpdates` created SINCE the last successful cron run per coin.

```
newScore = (currentScore * timeDecayFactor) + sum(weightedDeltasOfNewEventsOnly)
newScore = clamp(newScore, 0, 100)
```

This prevents the "Forever 100" bug (events accumulate indefinitely) and eliminates DB bottleneck (no full timeline scan).

### 2. Mean-Reversion (Time Decay)
Every cron run, regardless of new events, the current score drifts 1% toward 50 (neutral).

```
timeDecayFactor = 0.99  // pulls 1% closer to 50 each run
scoreAfterDecay = 50 + (currentScore - 50) * 0.99
```
- Score of 80 → after decay: 50 + 30 * 0.99 = 79.7
- Score of 20 → after decay: 50 + (-30) * 0.99 = 20.3
- Score of 50 → stays 50 (already neutral)

### 3. Weighted Delta per New Event
For each new timeline event since last cron:

| Factor | Logic |
|---|---|
| **Severity multiplier** | MAJOR = 3.0, MINOR = 1.0 |
| **Impact score** | Use `impactScore` from timeline (0-100 scale, normalize to 0-5 range: `impactScore / 20`) |
| **Direction** | Bullish sentiment → positive delta, Bearish → negative * 1.4 (risk penalty) |

```
normalizedImpact = (event.impactScore ?? 50) / 20  // 0-5 range
severityMultiplier = event.severity === 'MAJOR' ? 3.0 : 1.0

if isBearish(event.sentiment):
    delta = -normalizedImpact * severityMultiplier * 1.4
else if isBullish(event.sentiment):
    delta = +normalizedImpact * severityMultiplier
else:
    delta = 0  // skip neutral

if event.convictionDelta !== null:
    delta += event.convictionDelta
```

### 4. Posture Thresholds
| Score Range | Posture |
|---|---|
| >= 80 | `strong_accumulate` |
| >= 60 | `accumulate` |
| >= 40 | `neutral` |
| >= 20 | `distribute` |
| < 20 | `strong_distribute` |

### 5. Trend Calculation
- Fetch timeline updates from last 14 days
- Split into two 7-day windows
- Sum deltas per window (with severity multiplier)
- If recent > previous + 2 → `rising`
- If recent < previous - 2 → `falling`
- Else → `stable`

### 6. Cron Logic (`convictionUpdate.cron.ts`)
- Schedule: `0 */6 * * *` (every 6 hours)
- Store `lastCronRun` timestamp in Redis key `cron:last-conviction-run` (fallback: `now() - 6h`)
- For each coin in `coinMasterArticles`:
  1. Read current `convictionScore` (default 50 if null)
  2. Apply time decay: `scoreAfterDecay = 50 + (currentScore - 50) * 0.99`
  3. Query `coinTimelineUpdates` WHERE `masterArticleId = X AND createdAt > lastCronRun`
  4. Sum weighted deltas for new events
  5. `newScore = clamp(scoreAfterDecay + deltaSum, 0, 100)`
  6. Derive posture from newScore
  7. Calculate trend from last 14 days of timeline
  8. UPDATE `coinMasterArticles` SET `convictionScore`, `posture`, `updatedAt`
- Update Redis `cron:last-conviction-run` to `now()` on success
- If Redis unavailable, fallback to querying `MAX(createdAt)` from `coinTimelineUpdates` per coin

### 7. Historical Backfill (`seed-historical-conviction.ts`)
One-time script — NOT a cron. Processes the FULL historical timeline for all coins.

```
For each coin in coinMasterArticles:
  1. Fetch ALL timeline updates ordered by createdAt ASC
  2. Initialize score = 50
  3. For each event chronologically:
     - Apply weighted delta (same formula as cron)
     - score = clamp(score + delta, 0, 100)
  4. Save final score + posture to coinMasterArticles
```

Run: `npx tsx backend/src/scripts/seed-historical-conviction.ts`
Script is idempotent — safe to re-run.

### 8. Interfaces
```typescript
type Posture = 'strong_accumulate' | 'accumulate' | 'neutral' | 'distribute' | 'strong_distribute';
type Trend = 'rising' | 'falling' | 'stable';

interface ConvictionResult {
    score: number;       // 0-100
    posture: Posture;
    trend: Trend;
}

interface TimelineEvent {
    impactScore: number | null;
    severity: string;
    sentiment: string | null;
    convictionDelta: number | null;
    createdAt: Date;
}
```

### Constraints
- Zero `any` types
- No AI calls — pure algorithmic
- No new packages
- No route/controller changes — consumed via existing `getMasterArticle` endpoint

**Verify:**
- Score decays toward 50 when no new events
- New bullish MAJOR events push score up
- New bearish events pull score down harder (1.4x)
- Score never exceeds 0-100 bounds
- Historical backfill produces correct absolute scores
- Cron only processes NEW events since last run

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-10):** Incremental Delta Architecture implemented. Files:
> - `backend/src/services/conviction.service.ts` — Core logic: `computeEventDelta`, `applyTimeDecay`, `calculateIncrementalConviction`, `calculateAbsoluteConviction`, `calculateTrend`
> - `backend/src/crons/convictionUpdate.cron.ts` — 6-hour cron with Redis `lastCronRun` tracking
> - `backend/src/scripts/seed-historical-conviction.ts` — One-time backfill script
> - `backend/src/server.ts` — Cron registered as `ConvictionUpdate`
> - `tsc --noEmit` passed with zero errors

---

## Task 15: Local Similarity Check + Fix Temporal Pattern
**Phase:** 3 | **Priority:** MEDIUM
**Files:**
- `backend/src/services/similarity.service.ts` (new file)
- `backend/src/crons/aiWorkflow.cron.ts` (integrate similarity)
- `backend/src/services/temporalIntelligence.service.ts` (fuzzy matching)

**Scope:**
- 3.1: Keyword-based dedup service (no AI cost)
  - Create `similarity.service.ts` with `isDuplicateByKeywords()`
  - Integrate in `aiWorkflow.cron.ts`: import `isDuplicateByKeywords`, add pre-AI check at top of item loop — if duplicate, `continue` (skip before any AI calls)
- 3.2: Fix `buildTemporalPattern` — fuzzy matching instead of exact match

**Verify:** Duplicate headlines filtered before AI calls. Temporal pattern returns results with fuzzy matching.

- [x] Implement
- [x] Verify

---

## Task 16: Chat System Rebuild — Context AI + Quotas
**Phase:** 4 | **Priority:** MEDIUM | **DEPENDS ON:** Task 13
**Files:**
- `backend/src/controllers/chat.controller.ts`
- `backend/src/middleware/chat-quota.middleware.ts` (new file)
- `backend/src/routes/chat.routes.ts`

**Scope:**
- 4.1: Context AI prompt fed by Master Article + Timeline + Memory
- 4.2: Redis-based chat quotas (guest: 5, free: 15, pro: 999+30 context)
  - **CRITICAL: NO `any` types.** Use proper type narrowing for quota lookup:
    ```typescript
    type PlanTier = 'guest' | 'free' | 'pro';
    interface PlanQuota { daily: number; contextDaily: number }
    const QUOTAS: Record<PlanTier, PlanQuota> = { ... };
    const planQuota = QUOTAS[plan as PlanTier];
    ```
  - If Redis is unavailable, fall through (don't block users)

**Verify:** Context AI uses living article data. Rate limits enforced per plan. Zero `any` types.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-12):** Context AI prompt, Redis quotas (PlanTier union, zero `any`), chat-quota middleware wired.

---

## Task 17: Frontend Article Sections + Institutional Branding
**Phase:** 5 | **Priority:** MEDIUM
**Files:**
- `frontend/src/features/terminal/components/AlphaStream.tsx`
- `frontend/src/features/terminal/components/TerminalWire.tsx`
- `frontend/src/features/terminal/components/TerminalChat.tsx`

**Scope:**
- 5.1: Parse article sections into accordion UI
- 5.2: Rename all branding terms (see table in plan)

**Verify:** Articles render as expandable sections. All terms renamed.

- [x] Implement
- [x] Verify

---

## Task 18: Living Article UI + Alpha Snapshot Widget
**Phase:** 5 | **Priority:** MEDIUM
**Files:**
- `frontend/src/features/terminal/components/LivingArticle.tsx` (new file)
- `frontend/src/features/terminal/components/AlphaSnapshot.tsx` (new file)

**Scope:**
- 5.3: Living Article view (Alpha Snapshot header + Master Article accordion + Timeline feed)
- 5.4: Alpha Snapshot widget (conviction bar, posture badge, risk tags)

**Verify:** Living article displays with all sections. Alpha snapshot renders correctly.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-12):** LivingArticle, AlphaSnapshot, TimelineFeed components + alpha route page + types + API functions.

---

## Task 19: Fix Terminal Selection + Pagination + Sources
**Phase:** 5 | **Priority:** MEDIUM
**Files:**
- `frontend/src/features/terminal/components/TerminalWire.tsx`
- `frontend/src/features/terminal/components/TerminalPageClient.tsx`
- `backend/src/controllers/market.controller.ts`

**Scope:**
- 5.5.1: Fix non-unique selection highlighting
- 5.5.2: Deduplicate "Show More" results by ID
- 5.5.3: Add Wire tab pagination with offset support
- 5.6: Fix radar sources to use time-proximity matching

**Verify:** No duplicate highlights. Pagination works on both tabs. Sources match within 48h.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-12):** Wire pagination, time-proximity source matching (4h window), ID dedup, activeArticle fix (wireNews).

---

## Task 20: Text Embeddings & Semantic Dedup
**Phase:** 6 | **Priority:** OPTIONAL
**Files:**
- `backend/src/services/embedding.service.ts` (new file)
- `backend/src/services/similarity.service.ts` (extend)
- `backend/src/crons/terminalEngine.cron.ts` (generate on insert)
- `backend/src/models/market.model.ts` (add embedding column)

**Scope:**
- 6.1: Enable pgvector extension
- 6.2: Add embedding column to rawNewsBuffer
- 6.3: Embedding generation service (OpenAI or Ollama)
- 6.4: Semantic dedup function (cosine similarity >= 0.88)
- 6.5: Generate embeddings on news insert

**Verify:** Embeddings generated on insert. Semantic dedup filters 90%+ duplicates.

- [x] Implement
- [x] Verify

> **COMPLETED (2026-04-12):** pgvector extension, EmbeddingService (OpenRouter/Ollama), isDuplicateByEmbedding with keyword fallback, storeEmbedding in aiWorkflow. Requires manual DB migration (CREATE EXTENSION + ALTER TABLE + CREATE INDEX).

---

**ALL 20 TASKS COMPLETE. ALL PHASES DONE.**
