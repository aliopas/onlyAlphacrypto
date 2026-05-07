# 09 — Environment Variables

**File:** `backend/src/config/env.ts`  
**Validation:** Zod schema — process exits if validation fails

---

## Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 characters |
| `OPENROUTER_API_KEY` | Primary AI gateway key (min 10 chars) |
| `MORALIS_API_KEY` | On-chain data API key |
| `GLM_API_KEY` | Zhipu AI key for web search |

---

## Server Config

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment: development/production/test |
| `PORT` | `5000` | Backend server port |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiry |

---

## Database & Cache

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | — (optional) | Redis connection string |

---

## AI Models

| Variable | Default | Description |
|---|---|---|
| `SEO_MODEL` | `openai/gpt-5-nano` | SEO formatting model |
| `WRITER_MODEL` | `google/gemini-2.5-flash` | Article writing model |
| `CHAT_MODEL` | `openai/gpt-4.1-mini` | Chat model |
| `DEEPSEEK_MODEL` | `deepseek/deepseek-r1` | Analysis model (via OpenRouter) |

---

## DeepSeek Direct API

| Variable | Default | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | — (optional) | Direct DeepSeek API key (bypasses OpenRouter) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | DeepSeek API base |
| `DEEPSEEK_MODEL_DIRECT` | `deepseek-reasoner` | Model for direct calls |

---

## External APIs

| Variable | Default | Description |
|---|---|---|
| `BINANCE_API_KEY` | — (optional) | Binance market data |
| `BINANCE_SECRET` | — (optional) | Binance secret |
| `ALTERNATIVE_ME_URL` | `https://api.alternative.me/fng/` | Fear & Greed API |
| `COINCAP_API_KEY` | — (optional) | CoinCap price fallback |
| `TAVILY_API_KEY` | — (optional) | Emergency web search |
| `BIRDEYE_API_KEY` | — (optional) | DEX chart candles |

---

## GLM / Zhipu AI

| Variable | Default | Description |
|---|---|---|
| `GLM_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | GLM API base |
| `GLM_PLANNER_MODEL` | `glm-4-plus` | Planner agent model |
| `GLM_QA_MODEL` | `glm-4-plus` | QA agent model |

---

## Telegram

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_API_ID` | `""` | MTProto API ID |
| `TELEGRAM_API_HASH` | `""` | MTProto API hash |
| `TELEGRAM_SESSION_STRING` | `""` | MTProto session string |

---

## Next.js Integration

| Variable | Default | Description |
|---|---|---|
| `NEXTJS_REVALIDATE_SECRET` | — (optional) | Revalidation webhook secret |
| `NEXTJS_BASE_URL` | — (optional) | Frontend base URL |

---

## Feature Flags

| Variable | Default | Description |
|---|---|---|
| `MONITORING_CRON_ENABLED` | `false` | Enable monitoring cron |
| `LEVEL_INTELLIGENCE_ENABLED` | `false` | Enable S/R level detection |
| `LEVEL_INTELLIGENCE_MAX_COINS` | `8` | Max coins for level detection |
| `LEVEL_INTELLIGENCE_TIMEFRAMES` | `1h,4h,1d,1w` | Timeframes for level detection |
| `SCENARIO_TRACKER_ENABLED` | `false` | Enable scenario tracking |
| `EVENT_IMPACT_ENGINE_ENABLED` | `false` | Enable event impact analysis |
| `EVENT_IMPACT_PERSISTENCE_ENABLED` | `false` | Enable event impact persistence |
| `EVENT_IMPACT_BACKFILL_ENABLED` | `false` | Enable event impact backfill |
| `EVENT_IMPACT_BACKFILL_DRY_RUN` | `true` | Dry-run mode for backfill |
| `EVENT_IMPACT_SYNC_ENABLED` | `false` | Enable event impact sync cron |
| `EVENT_IMPACT_OUTCOME_CHECKER_ENABLED` | `false` | Enable outcome checker cron |
| `EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` | `false` | Inject stats into AI prompts |

---

## Embeddings

| Variable | Default | Description |
|---|---|---|
| `EMBEDDING_PROVIDER` | `openrouter` | Provider: openrouter / ollama |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` | OpenRouter embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Ollama embedding model |

---

## Agent Workflow

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_CODER_MODEL` | `meta-llama/llama-3-8b-instruct:free` | Coder agent model |
