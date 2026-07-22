import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Redis
    REDIS_URL: z.string().optional(),

    // Auth
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // OpenRouter (OpenAI-compatible API)
    // Pipeline:
    //   SEO_MODEL = GPT-5-nano → final SEO formatting, hooks, meta tags (dual news step 2, article writing)
    OPENROUTER_API_KEY: z.string().min(10, 'OPENROUTER_API_KEY is required'),
    SEO_MODEL: z.string().default('openai/gpt-5-nano'),
    WRITER_MODEL: z.string().default('google/gemini-2.5-flash'),

    // Chat model — separate from SEO model for cost/speed optimization
    CHAT_MODEL: z.string().default('openai/gpt-4.1-mini'),

    // DeepSeek (via OpenRouter — thinking model for analysis)
    DEEPSEEK_MODEL: z.string().default('deepseek/deepseek-r1'),

    // DeepSeek Direct API (for production analysis)
    DEEPSEEK_API_KEY: z.string().optional(),
    DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com/v1'),
    DEEPSEEK_MODEL_DIRECT: z.string().default('deepseek-reasoner'),

    // Binance
    BINANCE_API_KEY: z.string().optional(),
    BINANCE_SECRET: z.string().optional(),
    BINANCE_TIMEOUT_MS: z.coerce.number().default(30000),
    BINANCE_MAX_SOCKETS: z.coerce.number().default(20),
    BINANCE_MAX_FREE_SOCKETS: z.coerce.number().default(10),
    BINANCE_MAX_CONCURRENT: z.coerce.number().default(10),
    BINANCE_CACHE_TTL_PRICE_MS: z.coerce.number().default(10000),
    BINANCE_CACHE_TTL_TICKER_24H_MS: z.coerce.number().default(60000),

    // Price Source Authority (DEC-038)
    PRICE_BINANCE_RETRIES: z.coerce.number().positive().default(3),
    PRICE_BINANCE_RETRY_BACKOFF_MS: z.coerce.number().positive().default(500),

    // TP/SL Confirmed-Price Closure (HF-SIGNAL-CLOSE-001)
    // WARNING: 'samples' averages recent candle closes and is NOT a real traded price.
    // It may cause false TP/SL triggers. Default 'candle' uses a single confirmed close.
    TP_SL_CONFIRMED_PRICE_MODE: z.enum(['candle', 'samples']).default('candle'),
    TP_SL_CONFIRMED_TIMEFRAME: z.enum(['1h', '4h']).default('4h'),
    TP_SL_CONFIRMED_SAMPLES: z.coerce.number().positive().default(2),
    TP_SL_PRICE_DEVIATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.05),

    // Moralis
    MORALIS_API_KEY: z.string().min(1, 'MORALIS_API_KEY is required'),

    // Alternative.me (no key needed, public API)
    ALTERNATIVE_ME_URL: z.string().url().default('https://api.alternative.me/fng/'),

    // CoinCap
    COINCAP_API_KEY: z.string().optional(),

    // Tavily (emergency fallback only)
    TAVILY_API_KEY: z.string().min(1).optional(),

    // Birdeye (DEX chart candles)
    BIRDEYE_API_KEY: z.string().optional(),

    // Next.js revalidation
    NEXTJS_REVALIDATE_SECRET: z.string().optional(),
    NEXTJS_BASE_URL: z.string().url().optional(),

    // Telegram (MTProto — public channel scraping)
    TELEGRAM_API_ID: z.string().default(''),
    TELEGRAM_API_HASH: z.string().default(''),
    TELEGRAM_SESSION_STRING: z.string().default(''),

    // GLM / Zhipu AI (Planner + QA agents)
    GLM_API_KEY: z.string().min(1, 'GLM_API_KEY is required'),
    GLM_BASE_URL: z.string().default('https://open.bigmodel.cn/api/paas/v4'),
    GLM_PLANNER_MODEL: z.string().default('glm-4-plus'),
    GLM_QA_MODEL: z.string().default('glm-4-plus'),

    // Agent Workflow — Coder model via OpenRouter
    OPENROUTER_CODER_MODEL: z.string().default('meta-llama/llama-3-8b-instruct:free'),

    // BINNS (AI News Verification)
    BINNS_SECRET_KEY: z.string().min(10, 'BINNS_SECRET_KEY is required'),
    BINNS_API_KEY: z.string().min(10, 'BINNS_API_KEY is required'),

    // Level Intelligence Cron
    LEVEL_INTELLIGENCE_ENABLED: z.coerce.boolean().default(false),
    LEVEL_INTELLIGENCE_MAX_COINS: z.coerce.number().default(8),
    LEVEL_INTELLIGENCE_TIMEFRAMES: z.string().default('1h,4h,1d,1w'),

    // Scenario Tracker
    SCENARIO_TRACKER_ENABLED: z.coerce.boolean().default(false),

    // Event Impact Engine
    EVENT_IMPACT_ENGINE_ENABLED: z.coerce.boolean().default(false),
    EVENT_IMPACT_PERSISTENCE_ENABLED: z.coerce.boolean().default(false),
    EVENT_IMPACT_BACKFILL_ENABLED: z.coerce.boolean().default(false),
    EVENT_IMPACT_BACKFILL_DRY_RUN: z.coerce.boolean().default(true),
    EVENT_IMPACT_SYNC_ENABLED: z.coerce.boolean().default(false),
    EVENT_IMPACT_OUTCOME_CHECKER_ENABLED: z.coerce.boolean().default(false),
    EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 0 — Market Filter
    MARKET_FILTER_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 0.1 — OHLCV Data Infrastructure
    OHLCV_SNAPSHOT_ENABLED: z.coerce.boolean().default(false),
    BACKFILL_OHLCV_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 2 — Market Regime Detection
    MARKET_REGIME_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 1.5 — Backtesting Framework
    BACKTEST_TECHNICAL_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 0.5 — Shadow Mode
    SHADOW_MODE_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 3 — Signal Classification
    SIGNAL_CLASSIFICATION_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 4 — TP/SL V2
    TPSL_V2_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 5 — Signal Lifecycle
    SIGNAL_LIFECYCLE_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase 7.1 — Daily Trend
    DAILY_TREND_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase B — Multi-Timeframe Context Engine
    MTF_CONTEXT_ENABLED: z.coerce.boolean().default(false),

    // v2.Phase C — Intelligent Signal Lifecycle Engine V2
    LIFECYCLE_V2_ENABLED: z.coerce.boolean().default(false),

    // Scorecard — Educational Portfolio Simulation
    SCORECARD_SCRAPER_ENABLED: z.coerce.boolean().default(false),
    SCORECARD_MONITOR_ENABLED: z.coerce.boolean().default(false),
    SCORECARD_SNAPSHOT_ENABLED: z.coerce.boolean().default(false),
    SCORECARD_TELEGRAM_CHANNEL: z.string().default(''),
    SCORECARD_MAX_COINS: z.coerce.number().default(30),
    SCORECARD_MAX_DRAWDOWN_PERCENT: z.coerce.number().default(30),
    SCORECARD_TACTICAL_BUDGET: z.coerce.number().default(200),
    SCORECARD_STRATEGIC_BUDGET: z.coerce.number().default(300),
    SCORECARD_TOTAL_BUDGET: z.coerce.number().default(10000),

    // Model Portfolio Rebuild T0 — additive only, old keys preserved
    SCORECARD_MAX_ACTIVE: z.coerce.number().default(50),
    SCORECARD_POSITION_PCT: z.coerce.number().default(0.02),
    SCORECARD_INITIAL_ENTRY_PCT: z.coerce.number().default(0.01),
    SCORECARD_DCA_ENTRY_PCT: z.coerce.number().default(0.01),
    SCORECARD_DCA_TRIGGER_PCT: z.coerce.number().default(-0.10),
    SCORECARD_TP1_PCT: z.coerce.number().default(0.30),
    SCORECARD_TP2_PCT: z.coerce.number().default(0.50),
    SCORECARD_TP3_PCT: z.coerce.number().default(1.00),
    SCORECARD_TP4_PCT: z.coerce.number().default(2.00),
    SCORECARD_TP1_SELL_FRAC: z.coerce.number().default(0.30),
    SCORECARD_TP2_SELL_FRAC: z.coerce.number().default(0.50),
    SCORECARD_SL_PCT: z.coerce.number().default(-0.35),
    SCORECARD_ENTRY_SOFT_BAND_PCT: z.coerce.number().default(0.10),
    SCORECARD_ENTRY_MAX_UP_PCT: z.coerce.number().default(0.15),
    SCORECARD_ENTRY_MAX_DOWN_PCT: z.coerce.number().default(-0.35),
    SCORECARD_BACKFILL_POSTS: z.coerce.number().default(30),
    SCORECARD_VISION_MODEL: z.string().default(''),

    // Admin Authentication
    ADMIN_EMAIL: z.string().email().default('admin@onlyalpha.io'),
    ADMIN_PASSWORD: z.string().min(12).default('change_me_in_prod'),
    ADMIN_SESSION_SECRET: z.string().length(32).default('00000000000000000000000000000000'),

    // Admin Command Center
    ADMIN_COMMAND_CENTER_ENABLED: z.coerce.boolean().default(false),
    ADMIN_SIGNAL_OPS_ENABLED: z.coerce.boolean().default(false),

    // Market Context (DEC-040) — news data layer; all default off
    MARKET_CONTEXT_ENABLED: z.coerce.boolean().default(false),
    MARKET_CONTEXT_INGEST_ENABLED: z.coerce.boolean().default(false),
    MARKET_CONTEXT_TELEGRAM_POLL_LIMIT: z.coerce.number().default(50),

    // Airdrop Intelligence (DEC-041) — schema/flags only in AD-0; all default off
    AIRDROP_INTELLIGENCE_ENABLED: z.coerce.boolean().default(false),
    AIRDROP_INTELLIGENCE_INGEST_ENABLED: z.coerce.boolean().default(false),

    // Monitoring Cron
    MONITORING_CRON_ENABLED: z.boolean().default(false),

    // Embeddings (pgvector semantic dedup)
    EMBEDDING_PROVIDER: z.enum(['openrouter', 'ollama']).default('openrouter'),
    EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
    OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
    OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

    // ─── Flow Isolation Layer ────────────────────────────────────────────────
    // Master on/off switches for each of the 5 independent flows. Default true so existing
    // deployments keep all flows running. Set FLOW_<NAME>_ENABLED=false to disable an entire
    // flow (its crons won't start, regardless of their sub-feature flags below).
    FLOW_NEWS_ENABLED: z.coerce.boolean().default(true),
    FLOW_SIGNALS_ENABLED: z.coerce.boolean().default(true),
    FLOW_MARKET_ENABLED: z.coerce.boolean().default(true),
    FLOW_PORTFOLIO_ENABLED: z.coerce.boolean().default(true),
    FLOW_AIRDROP_ENABLED: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    parsed.error.issues.forEach((issue) => {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
