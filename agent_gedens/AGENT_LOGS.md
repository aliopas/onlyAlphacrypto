# Agent Logs — OnlyAlpha

---

## 2026-04-12 — Parallel Sprint: Tasks 18, 19, 20 (Phase 5/6) — DETAILED PLAN

**Event:** Architect Agent (GLM-5-Turbo) generated detailed multi-track architectural plan with exact file structures, TypeScript interfaces, and implementation boundaries for three parallel tasks.

### Status: DETAILED PLAN READY — Awaiting Supreme Reviewer APPROVAL

---

### TRACK 1: Task 18 — Living Article UI + Alpha Snapshot Widget

**Backend:** No changes. Consumes existing APIs:
- `GET /api/market/master/:symbol` → `{ masterArticle, timelineUpdates, convictionScore, posture }`
- `GET /api/market/timeline/:symbol?offset=0&limit=20` → `{ updates, total }`

**Frontend Files to CREATE:**

| File | Purpose |
|---|---|
| `frontend/src/features/terminal/types.ts` | ADD `MasterArticle`, `TimelineUpdate`, `MasterArticleResponse`, `TimelineResponse` types |
| `frontend/src/features/terminal/api.ts` | ADD `getMasterArticle(symbol)`, `getTimeline(symbol, offset, limit)` |
| `frontend/src/app/terminal/[coin]/alpha/page.tsx` | New route — SSR page, fetches master+timeline, renders `LivingArticle` |
| `frontend/src/features/terminal/components/AlphaSnapshot.tsx` | Conviction bar + posture badge + risk tags + verdict display |
| `frontend/src/features/terminal/components/LivingArticle.tsx` | Master layout: AlphaSnapshot header + article accordion + timeline feed |
| `frontend/src/features/terminal/components/TimelineFeed.tsx` | Scrollable event stream with severity badges, load-more pagination |

**TypeScript Interfaces (to add in `types.ts`):**

```typescript
export type MasterArticle = {
    id: number;
    coinSymbol: string;
    headline: string;
    hook: string | null;
    coreCatalyst: string | null;
    marketContext: string | null;
    strategicImpact: string | null;
    historicalContext: string | null;
    technicalLevels: string | null;
    riskAssessment: string | null;
    bottomLine: string | null;
    sentiment: string | null;
    verdict: string | null;
    confidenceScore: number | null;
    convictionScore: number | null;
    posture: string | null;
    riskTags: string[] | null;
    triggerType: string | null;
    majorUpdateCount: number;
    minorUpdateCount: number;
    lastMajorUpdate: string | null;
    lastMinorUpdate: string | null;
    createdAt: string;
    updatedAt: string;
};

export type TimelineUpdate = {
    id: number;
    coinSymbol: string;
    masterArticleId: number;
    updateText: string;
    triggerType: string | null;
    severity: string;
    sourceTitle: string | null;
    sourceHash: string | null;
    sentiment: string | null;
    impactScore: number | null;
    convictionDelta: number | null;
    createdAt: string;
};

export type MasterArticleResponse = {
    masterArticle: MasterArticle | null;
    timelineUpdates: TimelineUpdate[];
    convictionScore: number | null;
    posture: string | null;
};

export type TimelineResponse = {
    updates: TimelineUpdate[];
    total: number;
};
```

**AlphaSnapshot Component Spec:**
- Input: `{ article: MasterArticleResponse }` or `{ convictionScore, posture, riskTags, verdict, sentiment }` destructured
- Conviction bar: horizontal progress bar (0-100), color gradient red→amber→green
- Posture badge: text badge (`BULLISH` / `BEARISH` / `NEUTRAL` / `CAUTIOUS`)
- Risk tags: render `riskTags: string[]` as small pills
- Verdict: large text display with sentiment color
- Stats row: majorUpdateCount, minorUpdateCount

**LivingArticle Component Spec:**
- Fetches `MasterArticleResponse` via `terminalApi.getMasterArticle(symbol)`
- Layout: AlphaSnapshot header → Article accordion (same `parseArticleSections` pattern from AlphaStream) → TimelineFeed
- Article sections come from master article fields directly (NOT parsed from summary string)

**TimelineFeed Component Spec:**
- Input: `{ symbol: string; initialUpdates: TimelineUpdate[]; initialTotal: number }`
- Client component with pagination state (offset, hasMore)
- Calls `terminalApi.getTimeline(symbol, offset, 20)` on "Load More"
- Each entry: severity badge (MAJOR=amber, MINOR=blue), triggerType label, time, updateText
- Dedup by ID on append

---

### TRACK 2: Task 19 — UX & Terminal Fixes

**Fix 1: Wire Tab Pagination (TerminalPageClient.tsx)**
- Add state: `wireNews`, `wireOffset`, `hasMoreWire`, `isLoadingMoreWire` (mirrors radar pattern L39-63)
- Modify `handleLoadMoreWire`: calls `GET /market/wire?coin=SOL&offset={wireOffset}&limit=20`
- Dedup by ID on append: `setWireNews(prev => { const existing = new Set(prev.map(n => n.id)); const fresh = data.filter(n => !existing.has(n.id)); return [...prev, ...fresh]; })`
- Pass `onLoadMoreWire` + `hasMoreWire` + `isLoadingMoreWire` to TerminalWire
- TerminalWire: when `activeTab === 'WIRE'`, show "Show More" for wire at bottom; when `activeTab === 'RADAR'`, show radar "Show More" (existing)

**Fix 2: TerminalWire — Non-unique Selection Highlighting**
- Problem: `itemNews` match at L76 uses loose coin match (`n.coin === item.coin`), causing ALL coins' news to highlight
- Fix: Add time-proximity matching — only show news where `|news.createdAt - radar.createdAt| < 4 hours`
- Also fix: ensure `selectedNewsId` highlights correctly across radar items (currently only highlights within same radar card's sources)

**Fix 3: Radar Source Time-Proximity Matching (TerminalWire.tsx L76)**
```typescript
const RADAR_NEWS_TIME_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const radarTime = new Date(item.createdAt).getTime();
const itemNews = news.filter(n => {
    if ((n.coin || n.coinSymbol) !== item.coin) return false;
    const newsTime = new Date(n.createdAt).getTime();
    return Math.abs(newsTime - radarTime) < RADAR_NEWS_TIME_WINDOW_MS;
}).slice(0, 2);
```

**Fix 4: Dedup "Show More" Results**
- Both wire and radar load-more must dedup by ID before appending
- Extract to helper: `dedupById<T extends { id: number }>(existing: T[], incoming: T[]): T[]`

**Files Modified:**
| File | Changes |
|---|---|
| `frontend/src/features/terminal/components/TerminalPageClient.tsx` | Add wire pagination state + handler |
| `frontend/src/features/terminal/components/TerminalWire.tsx` | Time-proximity source matching, wire load-more button, dedup |

---

### TRACK 3: Task 20 — Semantic Intelligence (pgvector)

**Strategy:** Run embedding generation as a PRE-PROCESS before any AI calls in the workflow. This avoids AI cost for duplicate articles.

**Step 1: Database Migration**
- SQL: `CREATE EXTENSION IF NOT EXISTS vector;`
- Add column to `rawNewsBuffer`: `embedding vector(1536)` (nullable, indexed)
- Add HNSW index: `CREATE INDEX idx_raw_news_embedding ON raw_news_buffer USING hnsw (embedding vector_cosine_ops);`

**Step 2: New File — `backend/src/services/embedding.service.ts`**

```typescript
// Zero `any` types

// AI STRATEGY ROUTING AS PER DIRECTIVE:
// 1. DeepSeek Analysis (reasoning) -> DeepSeek Native Provider
// 2. GPT-nano (writing/triage) -> OpenRouter Provider
// 3. Embeddings (text-to-numbers) -> OpenRouter Provider

interface EmbeddingConfig {
    provider: 'openrouter' | 'ollama';
    embeddingModel: string;
    ollamaBaseUrl: string;
    similarityThreshold: number;  // 0.88
}

const DEFAULT_CONFIG: EmbeddingConfig = {
    provider: (process.env.EMBEDDING_PROVIDER as 'openrouter' | 'ollama') || 'openrouter',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    similarityThreshold: 0.88,
};

export async function generateEmbedding(text: string): Promise<number[]>
export async function findSemanticDuplicates(
    text: string,
    symbol: string,
    config?: Partial<EmbeddingConfig>
): Promise<{ isDuplicate: boolean; duplicateId: number | null; similarity: number }>
export async function storeEmbedding(id: number, embedding: number[]): Promise<void>
```

- `generateEmbedding`: Calls OpenRouter API (using text-embedding models) or Ollama local API based on config
- `findSemanticDuplicates`: Generates embedding for text, queries `rawNewsBuffer` WHERE `coinSymbol = symbol AND embedding IS NOT NULL`, uses pgvector cosine operator `<=>`, returns true if max similarity >= 0.88
- `storeEmbedding`: Updates `rawNewsBuffer` SET `embedding = $1` WHERE `id = $2`
- Uses raw `pg` pool query for vector operations (Drizzle doesn't natively support vector ops)

**Step 3: Upgrade `similarity.service.ts`**
- Add new export: `isDuplicateByEmbedding(title: string, symbol: string): Promise<boolean>`
- This calls `findSemanticDuplicates` from embedding.service
- If embedding service fails (network error, missing extension), falls back to keyword dedup silently

**Step 4: Integration in `aiWorkflow.cron.ts` (L117)**
```typescript
// REPLACE:
//   if (await isDuplicateByKeywords(item.title, symbol)) {
// WITH:
const { isDuplicate } = await isDuplicateByEmbedding(item.title, symbol);
if (isDuplicate) { ... skip }
```
- Keep `isDuplicateByKeywords` as fallback inside `isDuplicateByEmbedding`
- After successful processing (coinNews insert), call `storeEmbedding(item.id, embedding)` to persist for future comparisons

**Step 5: New npm package**
- `pgvector` — for TypeScript vector type support in raw queries

**Files:**
| File | Action |
|---|---|
| `backend/src/services/embedding.service.ts` | NEW — embedding generation + similarity search |
| `backend/src/services/similarity.service.ts` | MODIFY — add `isDuplicateByEmbedding` with keyword fallback |
| `backend/src/crons/aiWorkflow.cron.ts` | MODIFY — swap dedup call at L117, add storeEmbedding after insert |
| `backend/src/models/market.model.ts` | MODIFY — add `embedding` column to `rawNewsBuffer` |
| `backend/package.json` | MODIFY — add `pgvector` dependency |

---

### Cross-Track Constraints
- Zero `any` types across all 3 tracks
- No changes to routes, controllers (except Task 20 model change which triggers a migration)
- Task 18 and 19 are frontend-only
- Task 20 is backend-only
- Tasks 18+19 can be done in parallel by different agents
- Task 20 is independent and can run in parallel

---

## 2026-04-12 — Tasks 18 & 19: APPROVED & MERGED

**Event:** Architect reviewed and approved both tasks. Phase 5 COMPLETE.

### Task 18: Living Article UI + Alpha Snapshot Widget — COMPLETED
- **Files Created:**
  - `frontend/src/features/terminal/components/AlphaSnapshot.tsx`
  - `frontend/src/features/terminal/components/LivingArticle.tsx`
  - `frontend/src/features/terminal/components/TimelineFeed.tsx`
  - `frontend/src/app/terminal/[coin]/alpha/page.tsx`
- **Files Modified:**
  - `frontend/src/features/terminal/types.ts` — 4 new types
  - `frontend/src/features/terminal/api.ts` — 2 new API functions
- **Bug Fixed:** Sentiment color mapping (bullish/bearish/volatile)

### Task 19: UX & Terminal Fixes — COMPLETED
- **Files Modified:**
  - `frontend/src/features/terminal/components/TerminalWire.tsx` — Time-proximity source matching (4h), wire "Show More"
  - `frontend/src/features/terminal/components/TerminalPageClient.tsx` — Wire pagination state, ID dedup, props wired
- **Bug Fixed:** `activeArticle` lookup changed from `initialNews` to `wireNews` (L97)

### Phase Status After Merge
- Phase 0-4: COMPLETE
- Phase 5: COMPLETE (Tasks 17, 18, 19)
- Phase 6: IN PROGRESS (Task 20 — remaining)

---

## 2026-04-12 — Task 15 & 16 Approved & Merged

**Event:** Supreme Reviewer approved and merged both Task 15 (Similarity Service) and Task 16 (Chat System Rebuild).

### Task 15: Local Similarity Check + Fix Temporal Pattern
- **Phase:** 3 (Temporal Intelligence)
- **Status:** APPROVED → MERGED
- **Files:**
  - `backend/src/services/similarity.service.ts` (new)
  - `backend/src/crons/aiWorkflow.cron.ts` (modified — pre-AI dedup)
  - `backend/src/services/temporalIntelligence.service.ts` (modified — fuzzy matching fix)
- **Result:** Phase 3 COMPLETE. Keyword-based dedup now runs before AI calls, saving costs. Temporal pattern fuzzy matching fixed.

### Task 16: Chat System Rebuild — Context AI + Quotas
- **Phase:** 4 (Chat System Rebuild)
- **Status:** APPROVED → MERGED
- **Files:**
  - `backend/src/controllers/chat.controller.ts` (modified — Context AI prompt)
  - `backend/src/middleware/chat-quota.middleware.ts` (new — Redis quotas)
  - `backend/src/routes/chat.routes.ts` (modified — middleware wired)
- **Result:** Phase 4 COMPLETE. Context AI now uses Master Articles + Timeline + Memory. Redis-based quotas with `PlanTier` type narrowing (zero `any`). Fallback when Redis unavailable.

### Phase Status After Merge
- Phase 0: COMPLETE (Tasks 1-6)
- Phase 1: COMPLETE (Tasks 7-10)
- Phase 2: COMPLETE (Tasks 11-14)
- Phase 3: COMPLETE (Task 15)
- Phase 4: COMPLETE (Task 16)
- Phase 5: NOT STARTED (Tasks 17-19) — NEXT
- Phase 6: OPTIONAL (Task 20)

### Next Action
- Architect to plan **Task 17** (Frontend Article Sections + Institutional Branding) — Phase 5 kickoff.

### Discrepancy Noted
- `TASKS.md` Task 16 still shows `[ ] Implement / [ ] Verify` (unchecked). Supreme Reviewer may need to update checkboxes to reflect the approved/merged status.
