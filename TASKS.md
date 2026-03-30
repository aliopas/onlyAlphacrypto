# OnlyAlpha Refactor — Task List
# Status Legend: ✅ Done | 🔄 In Progress | ⏳ Pending | 🔒 Blocked

---

## 🔴 Bug Fixes (Priority — Must Do First)

| ID | Status | Bug | File | Line |
|----|--------|-----|------|------|
| BF-1 | ✅ | `import { OpenAI }` should be `import OpenAI from` (default import) | `backend/src/services/ai/ai-gateway.ts` | L1 |
| BF-2 | ✅ | `any[]` on aggregatedDataList | `backend/src/crons/aiWorkflow.cron.ts` | L60 |
| BF-3 | ✅ | `any[]` on aiReports | `backend/src/crons/aiWorkflow.cron.ts` | L117 |
| BF-4 | ✅ | `err: any` catch block | `backend/src/crons/aiWorkflow.cron.ts` | L127 |
| BF-5 | ✅ | `err: any` catch block | `backend/src/crons/aiWorkflow.cron.ts` | L40 |
| BF-6 | ✅ | Missing return type on `streamChatResponse` | `backend/src/services/openai.service.ts` | L362 |
| BF-7 | ✅ | Formatting: two statements on one line in `RawAnalysis` interface | `backend/src/services/openai.service.ts` | L252 |
| BF-8 | ✅ | market.model.ts — 4 merged-column lines breaking Drizzle types (analyzedAt, publishedAt, sentiment on radar, finalScore) | `backend/src/models/market.model.ts` | L25,43,66,91 |
| BF-9 | ✅ | openai.service.ts — `rawAnalysis` used before assigned | `backend/src/services/openai.service.ts` | L275 |
| BF-10 | ✅ | aiWorkflow.cron.ts — TokenStats type mismatch with DexTokenInfo | `backend/src/crons/aiWorkflow.cron.ts` | L116 |
| BF-11 | ✅ | aiWorkflow.cron.ts — generateDeepIntelligenceReport arg type mismatch | `backend/src/crons/aiWorkflow.cron.ts` | L138 |
| BF-12 | ✅ | terminalEngine.cron.ts — db.execute wrong arguments, replaced with Drizzle insert | `backend/src/crons/terminalEngine.cron.ts` | L83 |
| BF-13 | ✅ | server.ts — stale log message removed | `backend/src/server.ts` | L66 |

---

## Phase 1: Data Infrastructure & Pipeline Optimization

### Phase 1A: Gathering Engine
| ID | Status | Task | Files |
|----|--------|------|-------|
| 1A-1 | ✅ | Create `raw_news_buffer` schema | `backend/src/models/market.model.ts` |
| 1A-2 | ✅ | Modify `terminalEngine.cron.ts` to buffer only (no AI) | `backend/src/crons/terminalEngine.cron.ts` |

### Phase 1B: Triage Engine
| ID | Status | Task | Files |
|----|--------|------|-------|
| 1B-1 | ✅ | Refactor `openai.service.ts` into CacheManager + PromptFactory + AIGateway | `backend/src/services/ai/*.ts`, `openai.service.ts` |
| 1B-2 | ✅ | Fix 4 bugs (any types + unstable imports) | `backend/src/services/ai/*.ts`, `openai.service.ts` |
| 1B-3 | ✅ | Create triageEngine cron | `backend/src/crons/triageEngine.cron.ts` |
| 1B-4 | ✅ | Register triageEngine in server startup + fix stale log message | `backend/src/server.ts` |
| 1B-5 | ✅ | Create buffer cleanup cron (delete expired processed items) | `backend/src/crons/bufferCleanup.cron.ts` |

### Phase 1C: Routing to Deep Analysis
| ID | Status | Task | Files |
|----|--------|------|-------|
| 1C-1 | ✅ | Create deep-analysis-router service | `backend/src/services/ai/deep-analysis-router.ts` |
| 1C-2 | ✅ | Modify aiWorkflow cron to use deep-analysis-router instead of hunter/aggregator | `backend/src/crons/aiWorkflow.cron.ts` |

---

## Phase 2: High-Quality Articles & Accumulative Memory

### Phase 2A: Coin Memory System
| ID | Status | Task | Files |
|----|--------|------|-------|
| 2A-1 | ⏳ | Create `coin_memory` table schema | `backend/src/models/market.model.ts` |
| 2A-2 | ⏳ | Re-export coin_memory in models index | `backend/src/models/index.ts` |
| 2A-3 | ⏳ | Create Drizzle migration for coin_memory | `backend/src/migrations/` (NEW) |
| 2A-4 | ⏳ | Create coin-memory.service.ts (saveMemory + getRecentMemory) | `backend/src/services/coin-memory.service.ts` (NEW) |

### Phase 2B: Deep Article Generation (Data Augmentation)
| ID | Status | Task | Files |
|----|--------|------|-------|
| 2B-1 | ⏳ | Create data-augmenter service (gather market + onchain + tavily + memory) | `backend/src/services/ai/data-augmenter.ts` (NEW) |
| 2B-2 | ⏳ | Add `buildDeepSynthesisMessages` to PromptFactory | `backend/src/services/ai/prompt-factory.ts` |
| 2B-3 | ⏳ | Implement `generateDeepSynthesis()` (replace stub) | `backend/src/services/openai.service.ts` |
| 2B-4 | ⏳ | Create article-generator service (orchestrates augmenter + DeepSeek + publisher) | `backend/src/services/ai/article-generator.ts` (NEW) |

### Phase 2C: Article Structure & SEO Finishing
| ID | Status | Task | Files |
|----|--------|------|-------|
| 2C-1 | ⏳ | Add `buildArticleSEOMessages` to PromptFactory (GPT-nano SEO step) | `backend/src/services/ai/prompt-factory.ts` |
| 2C-2 | ⏳ | Create article-publisher service (save to coin_news + coin_memory + radar) | `backend/src/services/ai/article-publisher.ts` (NEW) |

---

## Phase 3: Terminal Dual-Mode Chat System

### Phase 3A: GENERAL AI Mode
| ID | Status | Task | Files |
|----|--------|------|-------|
| 3A-1 | ⏳ | Update chat controller — General Mode: search coin_news + marketInsights + coin_memory | `backend/src/controllers/chat.controller.ts` |
| 3A-2 | ⏳ | Add `mode` parameter to `buildChatMessages` in PromptFactory (different system prompts per mode) | `backend/src/services/ai/prompt-factory.ts` |

### Phase 3B: CONTEXT AI Mode (Event-Triggered)
| ID | Status | Task | Files |
|----|--------|------|-------|
| 3B-1 | ⏳ | Update chat controller — Context Mode: fetch coin_memory + live chart + deep analysis | `backend/src/controllers/chat.controller.ts` |
| 3B-2 | ⏳ | Add `requireAuth` middleware to Context AI endpoint | `backend/src/routes/chat.routes.ts` |

### Phase 3C: Guest Limitation System
| ID | Status | Task | Files |
|----|--------|------|-------|
| 3C-1 | ⏳ | Create guest-limit middleware (Redis-based, max 3 prompts per guest IP/24h) | `backend/src/middleware/guestLimit.middleware.ts` (NEW) |
| 3C-2 | ⏳ | Apply guest-limit middleware to chat stream route | `backend/src/routes/chat.routes.ts` |

### Phase 3D: UI/UX Chat Enhancements (Backend Support)
| ID | Status | Task | Files |
|----|--------|------|-------|
| 3D-1 | ⏳ | Create GET `/chat/context/:articleId/:articleType` endpoint | `backend/src/routes/chat.routes.ts` + new controller function |

### Phase 3E: Terms & Conditions / Disclaimer
| ID | Status | Task | Files |
|----|--------|------|-------|
| 3E-1 | ⏳ | Create POST `/chat/disclaimer-accept` endpoint + store acceptance | `backend/src/routes/chat.routes.ts` + new controller function |
