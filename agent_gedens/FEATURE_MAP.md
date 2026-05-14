# FEATURE MAP — Ownership & Dependencies

**Status:** ACTIVE
**Last Updated:** May 14, 2026
**Governance:** Updated by Governance Agent after each phase closure.

---

## FEAT-COIN-FILTER
- Objective: Single source of truth for 11 tracked coins. Filter non-tracked coins from all pipelines.
- Owner: Senior Dev (Tranche 1)
- Primary Files: backend/src/config/coins.ts
- DB Tables: —
- Env Flag: —
- Data Sources: Hardcoded constants
- Dependent Features: ALL downstream features import TRACKED_COINS
- Dependencies: None (foundation)
- Risk Level: LOW
- Last Modified: May 7, 2026
- QA Status: PASSED

## FEAT-MARKET-FILTER
- Objective: Every 6h health check on tracked coins. Flag illiquid/manipulated coins as not tradeable.
- Owner: Senior Dev (Tranche 1)
- Primary Files: backend/src/crons/marketFilter.cron.ts, backend/scripts/migrate-market-filter.sql
- DB Tables: coin_intelligence_cache (is_tradeable column)
- Env Flag: MARKET_FILTER_ENABLED
- Data Sources: Binance 24h volume + price change
- Dependent Features: aiWorkflow (should skip non-tradeable coins)
- Dependencies: FEAT-COIN-FILTER
- Risk Level: LOW
- Last Modified: May 7, 2026
- QA Status: PASSED

## FEAT-OHLCV-INFRASTRUCTURE
- Objective: Store raw candles + pre-computed EMA/ATR/volume indicators for all 11 coins x 3 timeframes.
- Owner: Senior Dev (Tranche 1)
- Primary Files: backend/src/services/ohlcvSnapshot.service.ts, backend/src/crons/ohlcvSnapshot.cron.ts, backend/scripts/backfill-ohlcv.ts, backend/scripts/migrate-ohlcv.sql
- DB Tables: ohlcv_candles, ohlcv_indicators
- Env Flag: OHLCV_SNAPSHOT_ENABLED, BACKFILL_OHLCV_ENABLED
- Data Sources: Binance klines API (paginated, max 1500)
- Dependent Features: FEAT-TECHNICAL-ANALYSIS, FEAT-MARKET-REGIME, FEAT-DAILY-TREND, FEAT-BACKTESTING
- Dependencies: FEAT-COIN-FILTER
- Risk Level: HIGH (data quality affects all downstream)
- Last Modified: May 7, 2026
- QA Status: PASSED

## FEAT-TECHNICAL-ANALYSIS
- Objective: Pure algorithmic TA engine — trend, S/R, structure, patterns, volume, quality score.
- Owner: Senior Dev (Tranche 1)
- Primary Files: backend/src/services/technicalAnalysis.service.ts
- DB Tables: — (reads from ohlcv_candles + ohlcv_indicators)
- Env Flag: —
- Data Sources: ohlcvSnapshot.service.ts (getCandles, getLatestIndicator)
- Dependent Features: FEAT-SHADOW-MODE, FEAT-MARKET-REGIME, FEAT-SIGNAL-CLASSIFICATION, FEAT-TPSL-V2
- Dependencies: FEAT-OHLCV-INFRASTRUCTURE
- Risk Level: HIGH (core algorithm, 771 lines, 8 sub-engines)
- Last Modified: May 8, 2026
- QA Status: PASSED (Round 3)

## FEAT-BACKTESTING
- Objective: Validate TA engine on 90 days of historical data. 5 pass criteria gate.
- Owner: Senior Dev (Tranche 1)
- Primary Files: backend/scripts/backtest-technical.ts, backend/src/services/ohlcvSnapshot.service.ts (getCandlesAtTime, getIndicatorsRange)
- DB Tables: — (read-only)
- Env Flag: BACKTEST_TECHNICAL_ENABLED
- Data Sources: ohlcv_candles, ohlcv_indicators
- Dependent Features: None (validation gate only)
- Dependencies: FEAT-TECHNICAL-ANALYSIS, FEAT-OHLCV-INFRASTRUCTURE
- Risk Level: MEDIUM (exit gate for Tranche 1)
- Last Modified: May 8, 2026
- QA Status: PASSED (Round 4)

## FEAT-SHADOW-MODE
- Objective: Compare algorithm vs AI side-by-side. Shadow signals table + checker cron + admin dashboard.
- Owner: Senior Dev (Tranche 2)
- Primary Files: backend/src/services/shadowSignals.service.ts, backend/src/crons/shadowChecker.cron.ts, backend/src/middleware/adminAuth.middleware.ts, backend/src/routes/admin.routes.ts, frontend/src/app/admin/shadow/page.tsx, backend/scripts/migrate-shadow-signals.sql
- DB Tables: shadow_signals
- Env Flag: SHADOW_MODE_ENABLED, SHADOW_MODE_ADMIN_ENABLED, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET
- Data Sources: aiWorkflow (after signal save), Binance live prices
- Dependent Features: None (parallel observation)
- Dependencies: FEAT-TECHNICAL-ANALYSIS, FEAT-ALGO-VERDICT-REWIRe
- Risk Level: MEDIUM (admin auth, Redis sessions)
- Last Modified: May 14, 2026
- QA Status: PASSED

## FEAT-MARKET-REGIME
- Objective: Detect market state — RISK_ON/OFF, TRENDING, SIDEWAYS, VOLATILE. BTC 4H + Fear&Greed + RSS macro.
- Owner: Senior Dev (Tranche 2)
- Primary Files: backend/src/services/marketRegime.service.ts, backend/src/crons/regimeUpdate.cron.ts, backend/scripts/migrate-market-regime.sql
- DB Tables: coin_intelligence_cache (current_regime column)
- Env Flag: MARKET_REGIME_ENABLED
- Data Sources: BTC 4H TA, Fear&Greed API (Redis cached 4h), coin_news_history macro scan
- Dependent Features: aiWorkflow (reads regime before signal generation)
- Dependencies: FEAT-TECHNICAL-ANALYSIS
- Risk Level: HIGH (regime affects all signals)
- Last Modified: May 10, 2026
- QA Status: PASSED (Round 2)

## FEAT-SIGNAL-CLASSIFICATION
- Objective: Classify signals as TACTICAL (3d) or STRATEGIC (14d/21d). RR minimums enforced.
- Owner: Senior Dev (Tranche 2)
- Primary Files: backend/src/services/signalClassification.service.ts, backend/scripts/migrate-signal-classification.sql
- DB Tables: radar_signals (8 new columns), signal_performance (7 new columns)
- Env Flag: SIGNAL_CLASSIFICATION_ENABLED
- Data Sources: Event type from triage, currentPrice, taResult
- Dependent Features: FEAT-TPSL-V2 (uses signal type for RR minimums)
- Dependencies: FEAT-TECHNICAL-ANALYSIS
- Risk Level: MEDIUM
- Last Modified: May 10, 2026
- QA Status: PASSED (Round 3)

## FEAT-TPSL-V2
- Objective: Algorithm-based TP/SL replacing AI-generated. S/R → ATR priority chain. 7-check sanity gate.
- Owner: Senior Dev (Tranche 2)
- Primary Files: backend/src/services/tpslCalculatorV2.service.ts, backend/src/services/tpslSanityGate.service.ts
- DB Tables: —
- Env Flag: TPSL_V2_ENABLED
- Data Sources: S/R levels from FEAT-TECHNICAL-ANALYSIS, ATR from ohlcv_indicators
- Dependent Features: FEAT-SIGNAL-LIFECYCLE (uses TP/SL for auto-close)
- Dependencies: FEAT-TECHNICAL-ANALYSIS, FEAT-SIGNAL-CLASSIFICATION (for RR minimums)
- Risk Level: HIGH (directly affects signal quality)
- Last Modified: May 10, 2026
- QA Status: PASSED (Round 2)

## FEAT-SIGNAL-LIFECYCLE
- Objective: State machine for signals — NEW → ACTIVE → PARTIAL_TP → BREAKEVEN → CLOSED.
- Owner: Senior Dev (Tranche 2+)
- Primary Files: backend/src/services/signalLifecycle.service.ts, backend/src/crons/signalLifecycle.cron.ts, backend/scripts/migrate-signal-lifecycle.sql
- DB Tables: radar_signals (signal_state + 3 columns)
- Env Flag: SIGNAL_LIFECYCLE_ENABLED
- Data Sources: Binance live prices, signal TP/SL levels
- Dependent Features: Scorecard (Phase 8, not yet built)
- Dependencies: FEAT-SIGNAL-CLASSIFICATION, FEAT-TPSL-V2
- Risk Level: MEDIUM
- Last Modified: May 10, 2026
- QA Status: PASSED

## FEAT-DAILY-TREND
- Objective: Calculate daily trend for each coin. Skip BEARISH/STRONG_BEARISH coins in signal generation.
- Owner: Senior Dev (Tranche 2+)
- Primary Files: backend/src/services/dailyTrend.service.ts, backend/src/crons/dailyTrend.cron.ts, backend/scripts/migrate-daily-trend.sql
- DB Tables: coin_intelligence_cache (daily_trend column)
- Env Flag: DAILY_TREND_ENABLED
- Data Sources: ohlcv_indicators (EMA-20/50/200 from 1d timeframe)
- Dependent Features: aiWorkflow (skips bearish coins)
- Dependencies: FEAT-OHLCV-INFRASTRUCTURE
- Risk Level: LOW
- Last Modified: May 10, 2026
- QA Status: PASSED

## FEAT-AIRDROP-QUALITY
- Objective: Quality gate for airdrops. Score < 60 never inserted. Ecosystem + effort + risk scoring.
- Owner: Senior Dev (Tranche 2+)
- Primary Files: backend/src/services/airdropQuality.service.ts, backend/scripts/migrate-airdrop-redesign.sql
- DB Tables: airdrop_projects (4 new columns), dropped: airdrop_tasks, user_progress
- Env Flag: —
- Data Sources: Airdrop project metadata
- Dependent Features: airdropDiscovery.cron.ts, airdrop.controller.ts, frontend AirdropCard
- Dependencies: FEAT-COIN-FILTER (ecosystem mapping)
- Risk Level: LOW
- Last Modified: May 10, 2026
- QA Status: PASSED

## FEAT-ALGO-VERDICT-REWIRe
- Objective: Replace simple trend-to-verdict mapping with multi-source priority chain (Structure → Candle → EMA → Quality Gate). Used by shadow mode for algorithm verdict.
- Owner: Senior Dev (Tranche 3 Phase A)
- Primary Files: backend/src/crons/aiWorkflow.cron.ts (deriveAlgorithmVerdict, deriveAlgorithmDirection)
- DB Tables: —
- Env Flag: —
- Data Sources: TechnicalAnalysisFullResult (structure.pattern, candlePattern, trend, qualityScore)
- Dependent Features: FEAT-SHADOW-MODE (shadow block consumes algoVerdict + algoDirection)
- Dependencies: FEAT-TECHNICAL-ANALYSIS
- Risk Level: MEDIUM (shadow mode accuracy depends on verdict quality)
- Last Modified: May 14, 2026
- QA Status: PASSED (4 micro-tasks, 3 corrections caught)

## Dependency Graph (Simplified)

```
FEAT-COIN-FILTER (foundation)
  ├── FEAT-MARKET-FILTER
  ├── FEAT-OHLCV-INFRASTRUCTURE
  │   ├── FEAT-TECHNICAL-ANALYSIS
  │   │   ├── FEAT-BACKTESTING
  │   │   ├── FEAT-ALGO-VERDICT-REWIRe
  │   │   │   └── FEAT-SHADOW-MODE
  │   │   ├── FEAT-MARKET-REGIME
  │   │   └── FEAT-SIGNAL-CLASSIFICATION
  │   │       └── FEAT-TPSL-V2
  │   │           └── FEAT-SIGNAL-LIFECYCLE
  │   └── FEAT-DAILY-TREND
  └── FEAT-AIRDROP-QUALITY
```
