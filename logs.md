
> backend@1.0.0 start
> node dist/server.js

[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }
✅ PostgreSQL connected successfully

🚀 OnlyAlpha Backend running at http://localhost:5000
📡 Environment: development
🗄️  Database: Connected
⏰ AI Engines: Starting...

⏰ AI Intelligence Workflow scheduled — hourly
2026-04-02T09:51:10.115Z [info]: [Server] Cron started: %s
⏰ Airdrop Hunter cron scheduled — Discovery: daily 00:00 UTC | Sync: every 12h
2026-04-02T09:51:15.093Z [info]: [Server] Cron started: %s
⏰ Daily Alpha Selection cron scheduled — 06:00 UTC daily
2026-04-02T09:51:20.089Z [info]: [Server] Cron started: %s
✅ Redis connected
⏰ Market Mood cron scheduled — 07:00 UTC daily
2026-04-02T09:51:25.090Z [info]: [Server] Cron started: %s
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
⏰ Terminal Intelligence Engine cron scheduled — every 10 minutes (Phase 1A: Gathering Engine)
2026-04-02T09:51:30.086Z [info]: [Server] Cron started: %s
⏰ Triage Engine cron scheduled — every 2 hours (Phase 1B)
2026-04-02T09:51:35.088Z [info]: [Server] Cron started: %s
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
🧹 [BufferCleanup] Cron scheduled — running daily at midnight.
2026-04-02T09:51:40.087Z [info]: [Server] Cron started: %s
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
[GET] /api/market/wire → 500: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
Error: Failed query: select "id", "coin_symbol", "headline", "summary", "hook", "meta_title", "meta_description", "seo_keywords", "source_url", "sentiment", "impact_score", "is_breaking", "source_hash", "ai_processed", "published_at", "created_at" from "coin_news" order by "coin_news"."published_at" desc limit $1
params: 20
    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/pg-core/session.cjs:66:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async /app/node_modules/drizzle-orm/node-postgres/session.cjs:152:22
    at async getLatestWire (/app/dist/controllers/market.controller.js:149:22)
npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/server.js
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-02T09_51_08_826Z-debug-0.log

> backend@1.0.0 start
> node dist/server.js

[dotenv@17.3.1] injecting env (0) from .env -- tip: 🔐 prevent committing .env to code: https://dotenvx.com/precommit
✅ PostgreSQL connected successfully

🚀 OnlyAlpha Backend running at http://localhost:5000
📡 Environment: development
🗄️  Database: Connected
⏰ AI Engines: Starting...

⏰ AI Intelligence Workflow scheduled — hourly
2026-04-02T10:10:04.033Z [info]: [Server] Cron started: %s
⏰ Airdrop Hunter cron scheduled — Discovery: daily 00:00 UTC | Sync: every 12h
2026-04-02T10:10:09.003Z [info]: [Server] Cron started: %s
⏰ Daily Alpha Selection cron scheduled — 06:00 UTC daily
2026-04-02T10:10:13.999Z [info]: [Server] Cron started: %s
⏰ Market Mood cron scheduled — 07:00 UTC daily
2026-04-02T10:10:19.003Z [info]: [Server] Cron started: %s
⏰ Terminal Intelligence Engine cron scheduled — every 10 minutes (Phase 1A: Gathering Engine)
2026-04-02T10:10:24.002Z [info]: [Server] Cron started: %s
⏰ Triage Engine cron scheduled — every 2 hours (Phase 1B)
2026-04-02T10:10:28.998Z [info]: [Server] Cron started: %s
✅ Redis connected
🧹 [BufferCleanup] Cron scheduled — running daily at midnight.
2026-04-02T10:10:33.999Z [info]: [Server] Cron started: %s
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.

> backend@1.0.0 start
> node dist/server.js

[dotenv@17.3.1] injecting env (0) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
✅ PostgreSQL connected successfully

🚀 OnlyAlpha Backend running at http://localhost:5000
📡 Environment: development
🗄️  Database: Connected
⏰ AI Engines: Starting...

⏰ AI Intelligence Workflow scheduled — hourly
2026-04-02T10:31:28.692Z [info]: [Server] Cron started: %s
npm error path /app
npm error command failed
npm error signal SIGTERM
npm error command sh -c node dist/server.js
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-02T10_10_02_727Z-debug-0.log
✅ Redis connected
⏰ Airdrop Hunter cron scheduled — Discovery: daily 00:00 UTC | Sync: every 12h
2026-04-02T10:31:33.667Z [info]: [Server] Cron started: %s
⏰ Daily Alpha Selection cron scheduled — 06:00 UTC daily
2026-04-02T10:31:38.664Z [info]: [Server] Cron started: %s
⏰ Market Mood cron scheduled — 07:00 UTC daily
2026-04-02T10:31:43.668Z [info]: [Server] Cron started: %s
⏰ Terminal Intelligence Engine cron scheduled — every 10 minutes (Phase 1A: Gathering Engine)
2026-04-02T10:31:48.666Z [info]: [Server] Cron started: %s
⏰ Triage Engine cron scheduled — every 2 hours (Phase 1B)
2026-04-02T10:31:53.665Z [info]: [Server] Cron started: %s
🧹 [BufferCleanup] Cron scheduled — running daily at midnight.
2026-04-02T10:31:58.665Z [info]: [Server] Cron started: %s
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [AI Workflow] Started. Mode: all
--- Phase 1: Deep Analysis Router ---
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[AI Workflow] No high-scoring items to analyze.
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [AI Workflow] Started. Mode: all
--- Phase 1: Deep Analysis Router ---
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
🔄 [AirdropHunter] Routine sync of active projects...
🤖 [TriageEngine] Running — scoring buffered news (Phase 1B)...
[AI Workflow] No high-scoring items to analyze.
[TriageEngine] No items to process.
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
🤖 [TerminalEngine] Running — gathering crypto news (Phase 1A)...
[TerminalEngine] Fetching from: https://min-api.cryptocompare.com/data/v2/news/?lang=EN
[TerminalEngine] Invalid API structure. Response snippet: {"Response":"Error","Message":"You need a valid auth key or api key to access this endpoint","HasWarning":false,"Type":1,"RateLimit":{},"Data":{}}
[TerminalEngine] No news to process.
