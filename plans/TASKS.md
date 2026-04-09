# OnlyAlpha — Execution Tasks

**Workflow:** Execute Task 1 → verify → Task 2 → verify → ... sequentially.
**Reference:** `MASTER_EXECUTION_PLAN.md` for full details.

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

- [ ] Implement
- [ ] Verify

---

## Task 10: Conditional Audit + Feed coinMemory
**Phase:** 1 | **Priority:** HIGH
**Files:**
- `backend/src/crons/aiWorkflow.cron.ts`

**Scope:**
- 1.4: Only audit articles with `impactScore >= 75` or `isBreaking`
- 1.5: Save to `coinMemory` after every published article

**Verify:** Audit skipped for low-impact articles. `coinMemory` populated after publish.

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

---

## Task 12: Upgrade Triage — MAJOR/MINOR/NOISE
**Phase:** 2 | **Priority:** HIGH
**Files:**
- `backend/src/services/ai/prompt-factory.ts`
- `backend/src/services/openai.service.ts` (TriageResult interface)
- `backend/src/models/market.model.ts` (rawNewsBuffer schema)
- `backend/src/crons/triageEngine.cron.ts`

**Scope:**
- 2.2.1: Add classification + triggerType to triage prompt
- 2.2.2: Update TriageResult interface
- 2.2.3: Add columns to rawNewsBuffer
- 2.2.4: Save classification in triageEngine

**Verify:** Triage output includes `classification` and `triggerType`. Saved to DB.

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

---

## Task 14: Conviction Score Service + Cron
**Phase:** 2 | **Priority:** HIGH
**Files:**
- `backend/src/services/conviction.service.ts` (new file)
- `backend/src/crons/convictionUpdate.cron.ts` (new file)
- `backend/src/server.ts` (register cron)

**Scope:**
- 2.4: Algorithmic conviction calculation (no AI calls)
- 2.5: Cron every 6 hours to recalculate for all active coins

**Verify:** `calculateConviction` returns score/posture/trend. Cron updates master articles.

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

---

## Task 16: Chat System Rebuild — Context AI + Quotas
**Phase:** 4 | **Priority:** MEDIUM
**Files:**
- `backend/src/controllers/chat.controller.ts`
- `backend/src/middleware/chat-quota.middleware.ts` (new file)
- `backend/src/routes/chat.routes.ts`

**Scope:**
- 4.1: Context AI prompt fed by Master Article + Timeline + Memory
- 4.2: Redis-based chat quotas (guest: 5, free: 15, pro: 999+30 context)

**Verify:** Context AI uses living article data. Rate limits enforced per plan.

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify

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

- [ ] Implement
- [ ] Verify
