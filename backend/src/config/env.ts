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

    // Admin Authentication
    ADMIN_EMAIL: z.string().email().default('admin@onlyalpha.io'),
    ADMIN_PASSWORD: z.string().min(12).default('change_me_in_prod'),
    ADMIN_SESSION_SECRET: z.string().length(32).default('00000000000000000000000000000000'),

    // Monitoring Cron
    MONITORING_CRON_ENABLED: z.boolean().default(false),

    // Embeddings (pgvector semantic dedup)
    EMBEDDING_PROVIDER: z.enum(['openrouter', 'ollama']).default('openrouter'),
    EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
    OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
    OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
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
