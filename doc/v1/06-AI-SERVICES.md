# 06 — AI Services

---

## AIGateway (`services/ai/ai-gateway.ts`)

Wraps the OpenAI SDK with independent provider instances. Five factory functions:

| Gateway | Purpose | Base URL |
|---|---|---|
| `AIGateway` (OpenRouter) | Primary for all tasks | openrouter.ai/api/v1 |
| `AIGateway` (DeepSeek Direct) | Analysis + triage when key is set | api.deepseek.com/v1 |
| Writer Gateway | Long-form article writing | openrouter.ai/api/v1 |
| `createGLMGateway` | Web search + airdrop enrichment | open.bigmodel.cn/api/paas/v4 |

### Three Invocation Modes

| Method | Return | Use Case |
|---|---|---|
| `chat<T>()` | Parsed JSON with auto-retry on parse failure | Analysis, triage (structured output) |
| `chatRaw()` | Raw string | Article text generation |
| `chatStream()` | AsyncIterable (SSE) | Real-time chat streaming |

### Built-in Protections

- **JSON auto-retry** — re-sends with correction message on malformed JSON
- **Rate limit detection** — HTTP 429 → `AIRateLimitError` with `retryAfterMs` (capped 60s)
- **Thinking block stripping** — removes `</think...>` blocks from DeepSeek-R1
- **Response truncation** — `AITruncationError` when response exceeds 8192 tokens
- **Stream timeout** — 30 seconds per chunk
- **Default timeout** — 90 seconds

---

## Model Routing (Production)

| Task | Gateway | Model |
|---|---|---|
| Triage | DeepSeek Direct → OpenRouter | `deepseek-chat` → `gpt-5-nano` |
| Deep Analysis | DeepSeek Direct → OpenRouter | `deepseek-reasoner` → `deepseek/deepseek-r1` |
| Article Writing | Writer Gateway (OpenRouter) | `gemini-2.5-flash` |
| SEO Formatting | OpenRouter | `gpt-5-nano` |
| Minor Updates | OpenRouter | `gpt-5-nano` |
| Chat | OpenRouter | `gpt-4.1-mini` |
| Quality Audit | DeepSeek Direct | `deepseek-chat` |
| Airdrop Validation | OpenRouter | `gpt-5-nano` |
| Embeddings | OpenRouter or Ollama | `text-embedding-3-small` / `nomic-embed-text` |
| Web Search | GLM/Zhipu | `glm-4.5-air` (web_search tool) |

---

## PromptFactory (`services/ai/prompt-factory.ts`)

All prompts live in one file. Key methods:

| Method | Purpose |
|---|---|
| `buildTriageMessages()` | Batch classification of 10 news items in one call |
| `buildDeepAnalysisMessages()` | Full context feed to DeepSeek — strict JSON output |
| `buildArticleWriterMessages()` | Writer rules: no new analysis, no verdict changes, policy-safe terminology |
| `buildMinorUpdateMessages()` | 1-2 paragraph update for MINOR events |
| `buildMasterUpdateMessages()` | Section-level updates to existing Master Article |
| `buildChatMessages()` | Two modes: general + context-aware (Master Article + Timeline + Memory) |
| `buildAirdropValidationMessages()` | Airdrop legitimacy + risk assessment |

### Prompt Safety Rules
- Forbidden words: buy, sell, invest, recommend, should, must
- Required phrases: "data suggests", "metrics indicate"
- Auto-appended NFA disclaimer
- Policy-safe terminology: Market Scenario, Reference Price, Target Zone, Risk Zone, Historical Outcome

---

## CacheManager (`services/ai/cache-manager.ts`)

LRU in-memory cache:

```
TTL:      1 hour default
Max Size: 1000 entries
Cleanup:  Every 5 minutes
Eviction: Oldest 20% when maxSize reached
Keys:     SHA-256 hashes
```

Primary use: caching triage responses to prevent duplicate AI calls on same news batch.

---

## QualityAuditor (`services/ai/quality-auditor.ts`)

Cross-model review: DeepSeek audits articles written by Gemini.

**Triggers only if:** `impactScore >= 75` OR `isBreaking === true`

**Checks:**
- Verdict in article matches analysis verdict
- Numbers are accurate
- Article is 800+ words
- `metaTitle` <= 60 characters
- `metaDescription` <= 160 characters
- Exactly 5 SEO keywords
- Professional tone (no financial advice)

If audit service is unavailable → article auto-passed with warning.

---

## FactualGrounding (`services/ai/factual-grounding.ts`)

Validates AI-generated support/resistance levels against current price:

```
If DeepSeek says Support = $1 and BTC = $90,000
→ Filtered out (outside ±50% of current price)
```

Only keeps logically plausible levels.

---

## CircuitBreaker (`services/circuitBreaker.service.ts`)

Runaway cost prevention:

```
Max Failures:   5 consecutive
Cooldown:       30 minutes
```

Separate breakers: `deepseekBreaker`, `gptNanoBreaker`, `binanceBreaker`, `dexscreenerBreaker`.

---

## openai.service.ts — Main AI Orchestrator (12 exported functions)

| Function | Purpose |
|---|---|
| `generateLightweightTriage()` | Batch triage of 10 news items |
| `callDeepSeekAnalysis()` | Full deep analysis with 3-attempt retry |
| `callGptNanoWriter()` | Article writing |
| `callWriterStage2A()` | Article stage 1 (content) |
| `callWriterStage2B()` | Article stage 2 (SEO formatting) |
| `mergeArticleStages()` | Combines stage 2A + 2B |
| `callGptNanoMinorUpdate()` | 1-2 paragraph MINOR event update |
| `callGptNanoMasterUpdate()` | Section-level Master Article update |
| `streamChatResponse()` | SSE chat streaming |
| `validateAirdrop()` | Airdrop project validation |
| `validateAirdropFromArticle()` | Airdrop validation from RSS articles |
| `extractSection()` | Extract article section by tag |
