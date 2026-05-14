# AGENT MEMORY — Distilled Intelligence

**Status:** ACTIVE
**Last Updated:** May 14, 2026
**Governance:** Max 300 lines. Compress quarterly.

High signal only. No storytelling. No logs. Short bullets.

---

## Rules

- Never compute EMA/ATR during signal execution — always read from ohlcv_indicators
- Never call Binance API during signal generation — use pre-fetched data only
- Never use `any` type — use `unknown` or specific interfaces
- Never hardcode coin symbols — import from config/coins.ts
- Never write raw SQL in TypeScript — use Drizzle ORM
- Never skip migration_flags guard in SQL scripts
- Never enable new crons by default — env flag must default false
- Never use BUY/SELL — use BULLISH/BEARISH
- Never let shadow insertion failure crash aiWorkflow — wrap in try/catch
- Never modify files outside execution boundary — escalate instead
- Signal quality < 60 = never save to DB
- Failed BOS = hard reject regardless of quality score
- VOLATILE regime = zero signals, no exceptions

## Lessons

- Binance API URL: `api.binance.com` NOT `api/binance.com` — caused production errors
- getCandles returns DESC order — always reverse to ASC before swing detection
- Pattern detection needs else-if guards between hammer/star and engulfing — without it, engulfing overwrites hammer
- S/R strength sorting by distance not strength — `allLevels.sort` was dead code, found in QA Round 1
- Duplicate declarations in same file cause build failure — always check for duplicates before appending
- `import { config }` is wrong — should be `import { env }` from env.ts
- `TRACKED_COINS.includes()` won't compile on readonly tuple — use `TRACKED_COIN_SET.has()` instead
- N+1 DB queries appear in loops processing signals — always batch fetch then process in memory
- `consumed` column existed but was never written to — caused infinite re-processing in aiWorkflow
- Truncate meta fields BEFORE Zod validation — otherwise safeParse fails on length, wasting AI tokens

## Patterns

- Preferred architecture: controller → orchestrator → service → adapter
- Service pattern: pure functions for computation, thin wrappers for DB access
- Cron pattern: env flag check → isRunning guard → process → update timestamp
- Migration pattern: migration_flags guard → IF NOT EXISTS → column/table creation
- Query pattern: batch fetch with inArray → process in memory → batch upsert
- TA pattern: read indicators → classify → return label (never compute at runtime)
- Shadow pattern: try/catch wrapper around shadow insertion in aiWorkflow
- TP/SL pattern: priority chain (S/R → Liquidity → ATR) → sanity gate → reject if fail
- Verdict derivation pattern: Structure (P1) → Candle (P2) → EMA Trend (P3) → Quality Gate override → NEUTRAL fallback
- Direction wrapper pattern: thin function over verdict, no logic duplication

## Warnings

- Cross-feature imports between regime + scoring = circular dependency risk — keep interfaces clean
- Any feature reading from ohlcv_indicators must handle null values (insufficient history)
- ATR always uses period 14 with Wilder's smoothing — never simple moving average
- S/R levels with strength < 60 must NOT be used for TP/SL placement
- Candle pattern requires ALL 3 conditions (pattern + volume + S/R alignment) — no partial valid
- CHOCH penalty (-20) is NOT rejection — signal may still pass quality threshold
- EMA-200 null fallback → SIDEWAYS → no directional signal → correct behavior, not error
- Backtesting look-ahead is ONLY for outcome measurement — analysis must use only past data
- `parsed` is `unknown` from JSON.parse — need type guard before property access (TS2571)
- adminAuth middleware uses Redis sessions with 24h TTL — never in-memory for production
- Shadow checker batch optimization: pre-filter signals by age, fetch prices once via getLivePrices
- When deleting a function, grep ALL call sites — deferred fix tickets create runtime crash windows
- Return type `string` on pure functions returning literals = type safety gap — always use union literals
- Quality gate thresholds must match constitution (60) — no ad-hoc values (40) in new code

## Architecture Notes

- Stack: Node.js/Express + Next.js App Router + Drizzle ORM + PostgreSQL + Redis
- 11 tracked coins: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON
- AI models: DeepSeek-r1 (deep), Gemini 2.5 Flash (articles), GPT-5-nano (SEO/minor)
- Module boundaries: CacheManager, AIGateway, PromptFactory — never cross boundaries
- OHLCV data: 11 coins × 3 timeframes (4h, 1d, 1w), ~16,500 rows steady state
- Signal flow: triage → aiWorkflow → signalManager → tpslMonitor → lifecycle
- Shadow flow: parallel to production, zero impact on live signals
