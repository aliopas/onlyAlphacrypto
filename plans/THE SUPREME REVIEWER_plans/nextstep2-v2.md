OnlyAlpha — Master Implementation Plan v2.1
Tech Lead Final Approval Document — Revised

Tech Lead Review Status
Original v2.0: CONDITIONALLY REJECTED — 9 issues identified.
This revision (v2.1): Addresses all 9 issues.
Review Date: May 7, 2026

Changes from v2.0
IssueFixReference1: Missing OHLCV infraAdded v2.Phase 0.1 — OHLCV Data InfrastructureBelow2: Phase numbering collisionAll phases renamed to v2.Phase X throughoutThis document3: Admin dashboard securityRedis sessions, 401 responses, rate limiting, bcryptv2.Phase 0.5 Part C below4: No backtestingAdded v2.Phase 1.5 — Backtesting FrameworkBelow5: Signal starvation monitoringAdded starvation alert + reduced confidence modev2.Phase 5 + v2.Phase 1.6 below6: AdSense-safe terminologyAll BUY/SELL → BULLISH/BEARISH, API-layer mapping definedBelow7: ATR specificationATR-14 explicit in v2.Phase 1.7v2.Phase 1.7 below8: Tranche delivery gates3 tranches with explicit gatesImplementation Order below9: scope realisticSplit with backtesting gate before Tranche 2+3Implementation Order below

Guiding Principle
The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

Terminology Standard (Applies to ALL phases)
All internal verdict labels use AdSense-safe terminology. No BUY/SELL/STRONG_BUY/STRONG_SELL anywhere in the codebase — database, services, crons, or API responses.

Internal Label (DB + Services)DirectionMeaningSTRONG_BULLISHUpVery high conviction upwardBULLISHUpModerate conviction upwardSIDEWAYSFlatNo directional convictionBEARISHDownModerate conviction downwardSTRONG_BEARISHDownVery high conviction downward

API Layer Mapping (existing pattern from Phase 7B safe aliases):
Internal VerdictPublic AliasSTRONG_BULLISHStrongly BullishBULLISHBullishBEARISSH Bearish / NeutralSTRONG_BEARISHStrongly Bearish

Existing codebase already uses these labels in EMA trend detection (v2.Phase 1.1) and levelIntelligence.service.ts. This is the continuation of that pattern.

TRANCHE 1 — Foundation + Shadow Mode (Weeks 0-2)
Gate: v2.Phase 0.1 must be verified with at least 90 days of historical candle data per coin before v2.Phase 1 begins.
Gate: v2.Phase 1.5 backtesting must produce reasonable results (win rate > 40%, not all-reject, not all-pass) before shadow mode goes live.

v2.Phase 0 — Coin Filter + Market Filter
0.1 — Tracked Coins Constants
Create config/coins.ts as a single source of truth for all 11 tracked coins. Every service, cron, and controller imports from this file. Zero hardcoding anywhere else.
The 11 coins: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON
Filter wired into 3 entry points only:
Entry PointRuleTerminalEngineItems with no mention of the 11 coins never enter the bufferTriageEngineAfter triage — no match → force NOISE immediatelyAiWorkflowFirst line — coin not in list → return, no processing
One exception: Macro news (Fed, ETF, regulation) with no specific coin mention → tag as BTC by default.
Guard: Migration flagged in migration_flags table. Cannot run twice.

0.2 — Market Filter Layer (Pre-Signal Gate)
Before any signal is ever generated, the coin must pass a live health check. This runs once at server boot and refreshes every 6 hours via a new marketFilter.cron.ts.
Filter criteria pulled from Binance:
CriterionMinimum Threshold24h Volume> $50M USDSpread< 0.5%Price Change 24hNot > 25% (manipulation flag)
Any coin failing these checks gets flagged is_tradeable = false in coin_intelligence_cache. No signals generate for flagged coins regardless of news.

v2.Phase 0.1 — OHLCV Data Infrastructure (NEW — Addresses Issue #1)
This phase provides the candle data that ALL subsequent technical analysis depends on. Without this, nothing in v2.Phase 1 can function.

Part A — Database Schema
New Table: ohlcv_candles
id                  SERIAL PRIMARY KEY
coin_symbol         VARCHAR(20)    NOT NULL
timeframe           VARCHAR(5)     NOT NULL  -- '4h', '1d', '1w'
open_time           TIMESTAMP      NOT NULL
open                REAL           NOT NULL
high                REAL           NOT NULL
low                REAL           NOT NULL
close               REAL           NOT NULL
volume              REAL           NOT NULL
close_time          TIMESTAMP      NOT NULL

Indexes:
UNIQUE(coin_symbol, timeframe, open_time) — prevents duplicate candles
INDEX(coin_symbol, timeframe, open_time DESC) — fast range queries for EMA/ATR calculation

New Table: ohlcv_indicators (pre-computed, avoids recalculation on every signal)
id                  SERIAL PRIMARY KEY
coin_symbol         VARCHAR(20)    NOT NULL
timeframe           VARCHAR(5)     NOT NULL
open_time           TIMESTAMP      NOT NULL
ema_20              REAL
ema_50              REAL
ema_200             REAL
atr_14              REAL           -- ATR(14) for this timeframe
volume_avg_20       REAL           -- 20-candle average volume
computed_at         TIMESTAMP      DEFAULT NOW()

UNIQUE(coin_symbol, timeframe, open_time)

Storage Estimates: 11 coins x 3 timeframes x 500 candles = ~16,500 rows. Minimal DB impact.

Part B — OHLCV Snapshot Service
New file: services/ohlcvSnapshot.service.ts
Functions:
fetchAndStoreCandles(symbol, timeframe, limit): Fetches from Binance (existing getCoinKlinesRange), upserts into ohlcv_candles. Uses existing BinanceKline interface from binance.service.ts.
backfillHistoricalCandles(symbol, timeframe, daysBack): Fetches historical candles for backfill. Uses pagination (500 per request, Binance limit) to fetch up to 90 days of 4H, 180 days of Daily, 1 year of Weekly.
computeIndicators(symbol, timeframe): Calculates EMA-20/50/200, ATR-14, volume_avg_20 from ohlcv_candles. Upserts into ohlcv_indicators. This is the single source of computed values for v2.Phase 1.

EMA Calculation:
EMA_today = Price_today x multiplier + EMA_yesterday x (1 - multiplier)
multiplier = 2 / (period + 1)
Requires at least period candles of history. If insufficient data exists for EMA-200, return null — never guess.

ATR-14 Calculation:
TR = max(high - low, abs(high - prev_close), abs(low - prev_close))
ATR = SMA(TR, 14)
Uses Wilder's smoothing method (exponential, not simple).
Source timeframe for TP/SL: Daily ATR-14.
Source timeframe for entry timing: 4H ATR-14.

Part C — OHLCV Snapshot Cron
New file: crons/ohlcvSnapshot.cron.ts
Schedule: Every 4 hours (0 */4 * * *) — aligns with 4H candle close.
Logic per tick:
  → For each of the 11 coins:
      → Fetch latest 4H candles (last 5 to catch missed candles)
      → Upsert into ohlcv_candles
  → For each of the 11 coins:
      → Fetch latest Daily candle (1 candle, update if new day)
      → Upsert into ohlcv_candles
  → Weekly candle update: Check if new weekly candle started (Monday 00:00 UTC), fetch if so
  → After all upserts:
      → computeIndicators() for each coin x timeframe
      → Log: "[OHLCV] Updated {symbol} {timeframe}: {candles} candles, indicators computed"

Historical Backfill (one-time, manual trigger):
New script: scripts/backfill-ohlcv.ts
Runs with env flag: BACKFILL_OHLCV_ENABLED=true (default false)
For each coin: fetch 90 days 4H + 180 days Daily + 365 days Weekly
Upserts into ohlcv_candles, then runs computeIndicators()
Logs progress per coin. Estimated runtime: ~5 minutes per coin (rate limit aware).
Must complete before v2.Phase 1 begins.

Part D — Candle Query Helpers
New functions in ohlcvSnapshot.service.ts:
getCandles(symbol, timeframe, limit): Returns last N candles from ohlcv_candles, ordered by open_time DESC.
getLatestIndicator(symbol, timeframe): Returns latest row from ohlcv_indicators.
getIndicatorAtTime(symbol, timeframe, timestamp): Returns indicator row closest to given timestamp (for historical backtesting).

All queries use Drizzle ORM. Zero raw SQL. Zero any types.

v2.Phase 0.5 — Shadow Mode + Admin Dashboard
Objective
Run the algorithm silently alongside the current AI system for 2 weeks minimum. Compare results on real market data before switching. Never rely on server logs — all data persists in the database.
Prerequisite: v2.Phase 1.5 backtesting must pass validation before shadow mode goes live.

Part A — Shadow Mode Engine
New Table: shadow_signals
id                  SERIAL PRIMARY KEY
coin_symbol         VARCHAR(20)
algorithm_verdict   VARCHAR(20)    -- STRONG_BULLISH / BULLISH / BEARISH / STRONG_BEARISH
ai_verdict          VARCHAR(20)    -- from existing analysisResult
algorithm_entry     REAL           -- live price at generation time
ai_entry            REAL           -- live price at generation time
algorithm_tp        REAL           -- from v2.Phase 1 engine
algorithm_sl        REAL           -- from v2.Phase 1 engine
ai_tp               REAL           -- from existing system
ai_sl               REAL           -- from existing system
quality_score       INT            -- from v2.Phase 1 engine
trend_context       VARCHAR(20)    -- STRONG_BULLISH / BULLISH / SIDEWAYS / BEARISH / STRONG_BEARISH
agreement           BOOLEAN        -- did both systems agree on direction?
price_72h           REAL           -- filled by checker cron
price_7d            REAL           -- filled by checker cron
algorithm_pnl_72h   REAL           -- calculated after 72h
ai_pnl_72h          REAL           -- calculated after 72h
algorithm_win_72h   BOOLEAN        -- filled after 72h
ai_win_72h          BOOLEAN        -- filled after 72h
algorithm_pnl_7d    REAL           -- calculated after 7d
ai_pnl_7d           REAL           -- calculated after 7d
algorithm_win_7d    BOOLEAN        -- filled after 7d
ai_win_7d           BOOLEAN        -- filled after 7d
winner              VARCHAR(20)    -- ALGORITHM / AI / BOTH / NEITHER
created_at          TIMESTAMP
resolved_at         TIMESTAMP

Migration guarded by migration_flags. Backward compatible.

Part B — Shadow Checker Cron
New file: crons/shadowChecker.cron.ts
Runs every 15 minutes — same frequency as existing tpslMonitor.
Logic:
Every 15 minutes:
  -> Fetch all unresolved shadow_signals
  -> For each signal:
      if age >= 72h AND price_72h IS NULL:
          fetch live price
          fill price_72h
          calculate algorithm_pnl_72h + ai_pnl_72h
          set algorithm_win_72h + ai_win_72h
          set winner

      if age >= 7d AND price_7d IS NULL:
          fetch live price
          fill price_7d
          calculate algorithm_pnl_7d + ai_pnl_7d
          set algorithm_win_7d + ai_win_7d
          update winner if changed
          set resolved_at

Part C — Admin Dashboard (REVISED — Addresses Issue #3)
Security Architecture
ComponentImplementationSession StoreRedis (already in codebase via ioredis)express-session with connect-redis adapterSession TTL24 hours maxSession Keyadmin:session:{sid}CookiehttpOnly: true, secure: true (prod), sameSite: strictPassword Hashingbcrypt (hash on first login, compare on subsequent)Login Rate Limitingexpress-rate-limit (already in codebase): 5 attempts per 15 minutes per IPBrute Force LockoutAfter 5 failed attempts: lock IP for 30 minutes (stored in Redis: admin:lockout:{ip})Unauthenticated Response401 Unauthorized with { error: "Unauthorized" } JSON body — NOT 404

Environment Variables:
ADMIN_EMAIL_HASHED=bcrypt_hash_of_email      -- pre-hashed, compare at login
ADMIN_PASSWORD_HASHED=bcrypt_hash_of_password -- pre-hashed, compare at login
ADMIN_SESSION_SECRET=random_32_char_string
ADMIN_SESSION_TTL_HOURS=24                    -- configurable

New Files:
middleware/adminAuth.middleware.ts:
  -> Reads session from Redis via req.session.adminAuthenticated
  -> If not authenticated: return res.status(401).json({ error: "Unauthorized" })
  -> Zero DB queries per request — Redis O(1) lookup

routes/admin.routes.ts:
  -> Mounted on /api/admin (not /admin, to align with existing API pattern)
  -> POST /api/admin/login — rate limited, validates credentials, sets Redis session
  -> POST /api/admin/logout — destroys session
  -> GET  /api/admin/shadow/stats — requires adminAuth middleware
  -> GET  /api/admin/shadow/signals — requires adminAuth middleware, query params for filters
  -> GET  /api/admin/shadow/signals/:id — requires adminAuth middleware

Admin routes registered in server.ts behind adminAuth middleware. No public documentation references these routes.

Dashboard UI — Single Page
Header Stats (6 cards):
CardDataAlgorithm WIN Rate (72h)algorithm_win_72h count / resolved countAI WIN Rate (72h)ai_win_72h count / resolved countTotal Shadow SignalsCOUNT all shadow_signalsAgreeing Signalsagreement = true countDisagreeing Signalsagreement = false countAlgorithm vs AI on DisagreementsWIN rate when they disagreed only

The most important stat is the last one — when they disagree, who wins? That decides if the algorithm is ready to replace AI.

Signals Table:
ColumnSourceCoincoin_symbolAlgorithmalgorithm_verdict + algorithm_entryAIai_verdict + ai_entryQuality Scorequality_scoreTrendtrend_contextAgreementagreement badge72h Resultalgorithm_pnl_72h vs ai_pnl_72h7d Resultalgorithm_pnl_7d vs ai_pnl_7dWinnerwinner badgeAgecreated_at

Filters available:
Coin filter (dropdown — the 11 coins)
Agreement filter (Agreeing / Disagreeing / All)
Status filter (Pending / Resolved / All)
Date range

Decision Helper Banner:
Shows automatically when resolved signals >= 20:
┌─────────────────────────────────────────────────────┐
│  Based on 24 resolved signals:                      │
│                                                     │
│  Algorithm wins 71% when disagreeing with AI        │
│  AI wins 45% when disagreeing with Algorithm        │
│                                                     │
│  Recommendation: Algorithm is ready to replace AI  │
│  on signal direction decisions.                     │
└─────────────────────────────────────────────────────┘

Banner logic:
Algorithm disagreement win rate > 60% → Ready to switch to Tranche 3
Algorithm disagreement win rate 50-60% → Needs more data (extend shadow)
Algorithm disagreement win rate < 50% → Algorithm needs tuning (halt Tranche 3)

Part D — Integration Point in AiWorkflow
In aiWorkflow.cron.ts, after the existing signal generation logic, add a shadow record insertion:
Existing flow stays 100% untouched
        ↓
After signal saved to radar_signals:
        ↓
Run v2.Phase 1 algorithm on same coin + same news (reads from ohlcv_indicators)
        ↓
Insert into shadow_signals with both verdicts
        ↓
agreement = (algorithm_verdict direction == ai_verdict direction)
Zero impact on existing users. Zero change to existing signals.

Hard Rules:
shadow_signals table is read-only for users — never exposed via public API
Admin routes never appear in the public API documentation
Algorithm runs silently — never affects existing signal generation
Decision to switch is manual — the banner recommends, you decide
Minimum 20 resolved signals before the decision banner appears
All admin routes return 401 (not 404) for unauthenticated requests
Admin session stored in Redis — survives server restarts
Admin login rate limited: 5 attempts per 15 minutes
Admin password hashed with bcrypt — never stored in plaintext
Shadow mode does NOT go live until v2.Phase 1.5 backtesting passes

v2.Phase 1 — Technical Analysis Engine
This is the foundation every other phase depends on. Zero AI cost.
Data source: ohlcv_candles + ohlcv_indicators from v2.Phase 0.1. No live Binance calls during signal generation.
New file: services/technicalAnalysis.service.ts

1.1 — EMA Trend Calculator
Reads pre-computed EMA values from ohlcv_indicators. Zero recalculation at runtime.
EMA SourcePurposeTimeframeEMA 20Short-term trend4HEMA 50Medium-term trend4HEMA 200Macro trend / long-term biasDaily

Trend Detection Logic:
ConditionTrend LabelPrice > EMA20 > EMA50 > EMA200STRONG_BULLISHPrice > EMA50, EMA20 > EMA50BULLISHEMAs intertwined in tight range (all within 1% of each other)SIDEWAYSPrice < EMA50, EMA20 < EMA50BEARISHPrice < EMA20 < EMA50 < EMA200STRONG_BEARISH

If EMA-200 is null (insufficient Daily candle history): fall back to EMA-20/50 only. If EMA-50 also null: return SIDEWAYS. Never guess.

1.2 — Support & Resistance Engine
Extracted from stored 4H candles in ohlcv_candles. No AI involvement. No live API calls.
Analysis window: Last 200 4H candles (~33 days).

Support identified from:
Swing Lows — lowest point between two higher candles on each side
Repeated reaction zones — price bounced from same level 2+ times
High volume areas — volume spike at level = stronger support

Resistance identified from:
Swing Highs — highest point between two lower candles on each side
Rejection zones — long upper wicks at same level
Liquidity areas — clusters of equal highs

Level Strength Score (0-100):
FactorWeightNumber of touches30%Volume at level30%Rejection strength20%Timeframe10%Recency10%
Only levels with strength score >= 60 are used for TP/SL calculation.

1.3 — Market Structure Engine
Reads the real structure of price action from stored 4H candles — no AI.
Analysis window: Last 100 4H candles (~16 days).
PatternMeaningHigher Highs + Higher LowsUptrend confirmedLower Highs + Lower LowsDowntrend confirmedBreak of Structure (BOS)Trend continuation signalChange of Character (CHOCH)Potential reversal — reduce confidenceFailed BOSFake breakout — do not generate signal
CHOCH Rule: If CHOCH is detected, signal confidence automatically drops by 20 points regardless of other factors.

1.4 — Candle Pattern Recognition
Pattern alone is never enough. All three conditions must be true:
ConditionRulePattern presentHammer, Engulfing, Morning/Evening Star, Shooting StarVolume confirmationVolume > volume_avg_20 from ohlcv_indicatorsStructure alignmentPattern must form at identified S/R level from 1.2
If any condition fails — pattern is ignored entirely.

1.5 — Volume Confirmation Engine
Uses volume_avg_20 from ohlcv_indicators. Zero recalculation.
ConditionSignal WeightVolume > 20% above average+15 points to quality scoreVolume spike > 2x average+25 points to quality scoreMovement with no volumeSignal rejected entirely

1.6 — ATR-14 Calculator (NEW — Addresses Issue #7)
Reads pre-computed ATR-14 from ohlcv_indicators. Zero recalculation at runtime.
Source timeframes:
Daily ATR-14: Used for TP/SL distance calculation (v2.Phase 4)
4H ATR-14: Used for entry zone width estimation (v2.Phase 7.3)
If ATR-14 is null (insufficient candle history): signal rejected — never guess ATR.

ATR-14 Computation (in ohlcvSnapshot.service.ts computeIndicators):
TR = max(high - low, abs(high - prev_close), abs(low - prev_close))
ATR = Wilder's EMA(TR, 14)  -- first ATR = SMA(TR, 14), then exponential smoothing
Period: 14 (industry standard)
This is computed once per candle close and stored in ohlcv_indicators. Never computed at signal-generation time.

1.7 — Signal Quality Score (Zero AI Cost)
Algorithmic score 0-100. Signal only proceeds if score >= 60.
FactorPointsTrend confirmed — EMA alignment correct+25Price near S/R level — within 2%+25Volume confirmation+25Candle pattern present at S/R+25
Penalty modifiers:
CHOCH detected: -20
Low volume movement: -15
Price > 25% move in 24h: -20 (manipulation flag)

v2.Phase 1.5 — Backtesting Framework (NEW — Addresses Issue #4)
Runs BEFORE shadow mode. Validates the TA engine against historical data.
New file: scripts/backtest-technical.ts
Execution: Manual, behind env flag BACKTEST_TECHNICAL_ENABLED=true (default false).

Backtest Procedure:
1. Load 90 days of 4H candles for each of the 11 coins from ohlcv_candles
2. Walk through candle history day by day (sliding window)
3. For each day, for each coin:
   a. Run v2.Phase 1 engine (EMA, S/R, Structure, Volume, Quality Score)
   b. Record: coin, date, trend_context, quality_score, nearest_support, nearest_resistance, pattern_found
4. DO NOT generate actual signals — only record what the engine WOULD have produced
5. Cross-reference with historical prices to calculate hypothetical P&L if a signal had been generated at that point

Output Metrics (printed to console, not stored):
Per coin: Number of days with quality_score >= 60, average quality score, trend distribution
Across all coins: Quality score histogram, trend accuracy (did the trend label predict next 24h direction?), S/R hit rate (did price reach identified S/R levels?)
Critical: Win rate estimate — if quality_score >= 60 signals had been generated, what % would have been profitable at 72h?

Pass Criteria (ALL must be met):
Win rate estimate > 40% (not worse than random)
Quality score >= 60 achieved on at least 20% of coin-days
Not all signals same direction (engine must produce both BULLISH and BEARISH)
Trend accuracy > 55% (trend label predicts next 24h direction correctly)
S/R hit rate > 50% (price reaches identified levels)

If ANY criteria fails: Fix the TA engine before proceeding. Do NOT enter shadow mode.

v2.Phase 2 — Market Regime Detection
New file: services/marketRegime.service.ts
Determines the current state of the market before any signal is processed. This is infrastructure — not a feature.
Regime Types
RegimeConditionsEffect on SignalsRISK_ONLow volatility + strong volume + bullish structureBullish signals full confidenceRISK_OFFMacro fear event + declining volume + bearish structureBullish confidence -20%, SL widens 15%TRENDINGClear EMA alignment + BOS confirmedTrend-following signals prioritizedSIDEWAYSEMAs intertwined + low volume + no BOSNo signals generatedVOLATILEPrice change > 8% in 4h + volume spikeAll signals paused until stable
Regime Detection Sources
SourceData UsedBinanceBTC 4H candles from ohlcv_candlesAlternative.meFear & Greed Index (already integrated in aiWorkflow.cron.ts:685)RSS feeds (existing)Macro keywords: war, sanctions, fed rate, inflation, crisis, ban
Rule: Macro keywords trigger RISK_OFF regime automatically. No new AI calls — keyword matching only using existing RSS pipeline. Alternative.me Fear & Greed already fetched per workflow run — reuse that value.
Regime Storage
Stored in coin_intelligence_cache as currentRegime field. Refreshed every 4 hours by existing convictionUpdate.cron.ts.

v2.Phase 3 — Signal Classification System
DB Migration — radar_signals table additions
signal_type          VARCHAR(20)   -- tactical / strategic
horizon_days         INT           -- 3 for tactical, 14-21 for strategic
quality_score        INT           -- from v2.Phase 1 engine
trend_context        VARCHAR(20)   -- STRONG_BULLISH / BULLISH / SIDEWAYS / BEARISH / STRONG_BEARISH
entry_zone_low       REAL          -- algorithmic entry zone
entry_zone_high      REAL          -- algorithmic entry zone
invalidation_level   REAL          -- level that breaks the thesis
invalidation_reason  TEXT          -- why this level matters
confidence_score     INT           -- from analysisResult (existing)
Migration guarded by migration_flags. Backward compatible — all existing columns untouched.

Event to Signal Type Mapping
Signal TypeHorizonTriggered ByTACTICAL3 daysListing, whale movement, partnership, price action, volume spikeSTRATEGIC14 daysETF approval/rejection, regulation, hack, delistingSTRATEGIC21 daysMainnet launch, major funding, protocol upgrade

Risk/Reward Rules
TypeMinimum RRSL PlacementTACTICAL1:2Below/above nearest S/R from v2.Phase 1.2STRATEGIC1:3Below/above major S/R from v2.Phase 1.2
Hard rule: If RR cannot meet minimum — signal is rejected. Not downgraded. Rejected.

v2.Phase 4 — TP/SL Engine Overhaul
Replaces AI-generated support/resistance levels entirely.
TP Calculation
PrioritySource1stNext resistance level from v2.Phase 1.2 S/R engine (strength >= 60)2ndLiquidity target (equal highs zone)3rdATR extension (1.5x Daily ATR-14 from ohlcv_indicators) — only if no S/R found
SL Calculation
PrioritySource1stInvalidation level — structure break point from v2.Phase 1.32ndBelow nearest support with strength >= 603rdATR-based (1x Daily ATR-14 from ohlcv_indicators) — only if no S/R found
TP/SL Sanity Gate
Before any signal is saved, validate:
CheckRuleBullish TPMust be above entryBullish SLMust be below entryBearish TPMust be below entryBearish SLMust be above entryDistance from entryMust be between 1% and 40%RR ratioMust meet minimum for signal type
If any check fails: signal rejected + logged. Never saved.

v2.Phase 5 — Signal Lifecycle System
Replaces the current binary Active/Completed with a proper lifecycle.
New States
NEW
  ↓
WAITING_CONFIRMATION  (quality score >= 60 but not yet at entry zone)
  ↓
ACTIVE                (price entered the entry zone)
  ↓
PARTIAL_TP            (price hit 50% of TP distance)
  ↓
BREAKEVEN             (SL moved to entry after PARTIAL_TP)
  ↓
CLOSED                (TP hit / SL hit / Expired / Thesis reversed)

DB Migration — signal_performance additions
signal_state         VARCHAR(30)   -- current lifecycle state
price72h             REAL          -- 72h price snapshot
pnl72h               REAL          -- 72h P&L
is_win72h            BOOLEAN       -- tactical win decision point
partial_tp_hit_at    TIMESTAMP     -- when PARTIAL_TP was reached
breakeven_moved_at   TIMESTAMP     -- when SL moved to entry
close_reason         VARCHAR(50)   -- TP_HIT / SL_HIT / EXPIRED / THESIS_REVERSED / HTF_BREAK

Checkpoint Schedule
CheckpointApplies ToPurpose24hAll signalsUnrealized P&L snapshot72hTACTICAL onlyPrimary win/loss decision7dSTRATEGIC onlyMid-term check30dSTRATEGIC onlyFinal outcome

Auto-Close Rules
TACTICAL:
Auto-closes after 72h with realized P&L
Closes WIN if TP hit
Closes LOSS if SL hit
Closes THESIS_REVERSED if opposing MAJOR news event detected for same coin

STRATEGIC:
Auto-closes after 21 days
Closes WIN if TP hit
Closes LOSS if SL hit
Closes HTF_BREAK if Weekly structure breaks against signal direction

Signal Starvation Monitoring (NEW — Addresses Issue #5)
New function in technicalAnalysis.service.ts: checkSignalHealth()
Called by tpslMonitor.cron every 15 minutes (add to existing tick).
Logic:
  -> Count signals generated across all 11 coins in last 48 hours
  -> If count == 0: log [SIGNAL-HEALTH] WARNING: Zero signals in 48h. Check market conditions and filter gates.
  -> If count < 3: log [SIGNAL-HEALTH] CAUTION: Low signal rate ({count} in 48h).

Reduced Confidence Mode:
When starvation detected (0 signals in 48h):
  -> Quality score threshold temporarily lowered from 60 to 45 for next cycle
  -> Any signal generated under reduced mode gets reduced_confidence = true flag
  -> Public-facing display shows "Limited Data" badge instead of quality score
  -> Auto-resets after 3 signals generated at normal threshold
  -> NEVER affects shadow_signals — shadow mode always uses standard 60 threshold

v2.Phase 6 — AI Role Refinement
The most impactful cost reduction phase.
Before vs After
BeforeAfterAI generates full verdict + numbersAlgorithm generates all numbersAI decides directionAlgorithm decides directionLarge unstructured promptSmall structured prompt
New AI Prompt Structure
The AI receives the algorithmic output and adds only the human-readable layer:
Given:
trend         = {BULLISH}
quality_score = {78}
entry         = {94200}
support       = {91000}
resistance    = {97500}
regime        = {RISK_ON}
event         = {ETF approval rumor}
signal_type   = {TACTICAL}

Task:
1. Is this catalyst real or noise? (yes/no)
2. Write thesis in one sentence max
3. Confidence modifier: -20 to +20 (adjust quality score)

Reply in JSON only:
{ "valid": true, "thesis": "...", "modifier": 10 }
Result: Prompt is 80% smaller. One AI call per signal. Output is structured JSON only — no free text parsing.

Final Confidence Score Formula
base_quality_score (from algorithm)
+ AI modifier (-20 to +20)
+ regime_modifier (RISK_OFF: -20, RISK_ON: 0, VOLATILE: -30)
= final_confidence_score (0-100)

v2.Phase 7 — Multi-Timeframe Analysis (Incremental)
Built in 4 tasks — each task is independent and deployable alone.
All candle data sourced from ohlcv_candles (v2.Phase 0.1). No live API calls.

Task 7.1 — Daily Trend Context (Deploy First)
Add daily_trend field to coin_intelligence_cache. Calculated from Daily candles in ohlcv_candles using v2.Phase 1.1 EMA logic. Refreshed every 6 hours by ohlcvSnapshot.cron.
Immediate impact: Every signal now shows Daily trend context. Uptrend signals only generate when Daily trend is BULLISH or STRONG_BULLISH.

Task 7.2 — Weekly Bias Layer
Add weekly_bias field to coin_intelligence_cache. Calculated from Weekly candles in ohlcv_candles. Refreshed once daily at 04:00 UTC alongside historicalNews.cron.ts.
Rule added: If Weekly bias is STRONG_BEARISH — TACTICAL bullish signals are suppressed entirely.

Task 7.3 — 4H Entry Timing
New table coin_technical_levels stores 4H S/R levels only. Computed by v2.Phase 1.2 S/R engine. Refreshed every 6 hours by ohlcvSnapshot.cron.
Used for: Entry zone refinement. The 4H nearest support/resistance becomes the primary entry zone for TACTICAL signals. Entry zone width = 4H ATR-14 from ohlcv_indicators.

Task 7.4 — Multi-TF Signal Classification
Combines all timeframe data into a signal context label:
WeeklyDaily4HSignal LabelBullishBullishBullishTREND_FOLLOWING — full confidenceBearishBearishBullishCOUNTER_TREND — reduced confidence -20BullishSidewaysBullishPULLBACK_ENTRY — normal confidenceAnyAnySidewaysNO_SIGNAL

v2.Phase 8 — Scorecard Redesign
Header Stats (4 cards)
CardData SourceTactical Win Rateis_win72h from signal_performanceStrategic Win Rateis_win7d + is_win30d combinedBest TradeMax realizedPnl with coin + dateAvg RR AchievedAverage of actual RR across all closed signals

Active Signals Section
Split into two tabs: TACTICAL ACTIVE and STRATEGIC ACTIVE.
Each signal card shows:
Current price vs entry price + unrealized P&L%
Time remaining with progress bar
TP and SL in real numbers
Quality score badge (or "Limited Data" if reduced_confidence = true)
Signal lifecycle state
Trend context label

Performance by Coin
Table per coin showing: signal count, win rate, best trade, worst trade, average hold time. Only shows coins with 3+ closed signals.

Completed Signals Timeline
Sorted newest first
Capped at last 50 completed signals
Each entry shows: type, entry to exit price, P&L%, hold duration, close reason
Color coded: green TP_HIT, red SL_HIT, grey EXPIRED, orange THESIS_REVERSED

v2.Phase 9 — Airdrop System Redesign
What Gets Removed
RemovedReasonairdrop_tasks tableNo task tracking neededuser_progress tableNo per-user completion trackingWallet verification logicComplexity with zero intelligence valueAuto-verification systemSame reason

Migration: DROP TABLE commands guarded by migration_flags. Tables dropped only after new fields on airdrop_projects are confirmed working.

New Fields on airdrop_projects
FieldPurposeecosystemTagLinks to one of the 11 coinseffortLevelLOW / MEDIUM / HIGHrewardConfidenceHIGH / MEDIUM / LOW / UNVERIFIEDqualityScore0-100 composite at insertion time

New Quality Scoring
CriterionWeightEcosystem connection to the 11 coins30%Verified funding or backing25%Real community size20%Effort vs reward ratio15%Risk level10%
Hard rule: Score < 60 -> never reaches database. Score < 75 -> marked low confidence.

Ecosystem Scope per Coin
CoinAccepts Airdrops FromETHL2s, DeFi protocols, restaking projectsSOLDePIN, Gaming, consumer appsTONTelegram-native projects onlyBNBBSC DeFi, GameFiOthersDirect project airdrops only

Frontend Card Shows
Effort indicator, ecosystem badge, risk verdict, deadline urgency, reward confidence, quality score. No task lists. No progress bars. No wallet connection required.

Implementation Order — Strict (3 Tranches)
TRANCHE 1: Foundation + Validation (Weeks 0-2)
WeekPhaseDependencyWeek 0v2.Phase 0 (Coin Filter + Market Filter)NoneWeek 0v2.Phase 0.1 (OHLCV Infrastructure)None — but blocks everything afterWeek 1v2.Phase 0.1 backfill script (manual)Requires v2.Phase 0.1Week 1v2.Phase 1 (Technical Analysis Engine)Requires v2.Phase 0.1 + 90 days dataWeek 2v2.Phase 1.5 (Backtesting)Requires v2.Phase 1

TRANCHE 1 EXIT GATE:
[ ] 90 days of candle data stored for all 11 coins x 3 timeframes
[ ] Backtesting pass criteria ALL met (win rate > 40%, quality >= 60 on 20%+ of days, directional diversity, trend accuracy > 55%, S/R hit rate > 50%)
[ ] If gate fails: Fix TA engine, re-run backtesting. Do NOT proceed.

TRANCHE 2: Shadow Mode + Classification (Weeks 3-5)
WeekPhaseDependencyWeek 3v2.Phase 0.5 (Shadow Mode + Admin Dashboard)Requires v2.Phase 1.5 PASWeek 3v2.Phase 3 (Signal Classification DB)Parallel with v2.Phase 0.5Week 4v2.Phase 2 (Market Regime)Requires v2.Phase 1Week 4v2.Phase 4 (TP/SL Overhaul)Requires v2.Phase 1 + v2.Phase 1.6 (ATR)Week 5v2.Phase 6 (AI Role Refinement)Requires v2.Phase 1 + v2.Phase 2

TRANCHE 2 EXIT GATE:
[ ] Shadow mode running for minimum 2 weeks
[ ] 20+ resolved shadow signals
[ ] Algorithm disagreement win rate > 60%
[ ] If gate fails (rate < 50%): Halt. Algorithm needs fundamental tuning.
[ ] If gate fails (rate 50-60%): Extend shadow by 1 week. Re-evaluate.
[ ] v2.Phase 9 (Airdrop) can run independently during this tranche.

TRANCHE 3: Full Integration (Weeks 6+)
WeekPhaseDependencyWeek 6v2.Phase 5 (Signal Lifecycle)Requires v2.Phase 3 + v2.Phase 4Week 7v2.Phase 7 Task 7.1 (Daily Trend)Requires v2.Phase 1Week 7v2.Phase 7 Task 7.2 (Weekly Bias)Requires Task 7.1Week 8v2.Phase 7 Task 7.3 (4H Entry)Requires Task 7.2Week 8v2.Phase 7 Task 7.4 (Multi-TF Classification)Requires Task 7.3Week 9v2.Phase 8 (Scorecard)Requires v2.Phase 5 + v2.Phase 6

TRANCHE 3 EXIT GATE:
[ ] All phases deployed and stable for 1 week
[ ] Signal starvation monitoring active and functional
[ ] Scorecard shows accurate win rates

Independent Track
Phasev2.Phase 9 (Airdrop)Start anytime after v2.Phase 0 complete

Hard Rules for Every Implementing Agent
v2.Phase 0 must be complete and verified before any other phase starts
v2.Phase 0.1 must have 90 days of historical data before v2.Phase 1 begins
v2.Phase 1.5 backtesting must pass ALL criteria before shadow mode goes live
Never hardcode coin symbols — always import from config/coins.ts
All DB migrations guarded by migration_flags — run exactly once
Drop removed tables completely — never leave unused tables (with migration_flags guard)
TP/SL always from algorithm — never from AI response
Signal rejected if quality score < 60 — never downgraded (except starvation mode)
Signal rejected if RR does not meet minimum — never saved
AI prompt never exceeds the structure defined in v2.Phase 6
GLM discovery calls stay capped at 5 per run
Never increase cron frequency without explicit approval
Zero BUY/SELL/STRONG_BUY/STRONG_SELL in any file — use BULLISH/BEARISH terminology
All TA calculations read from ohlcv_indicators — never compute at signal-generation time
ATR always uses period 14 with Wilder's smoothing
Admin authentication uses Redis sessions + bcrypt + rate limiting — never memory-only or plaintext
All admin unauthenticated responses return 401, not 404

Expected Outcomes
MetricCurrentAfter PlanAI token costBaseline-60% to -70%Signal accuracyLow — AI-onlyHigh — algorithm + AI confirmationFalse signalsHigh — unfiltered coinsNear zero — 11 coins + quality gateTP/SL reliabilityPoor — AI hallucinatedHigh — real candle levels (ATR-14 + S/R)Scorecard valueMisleadingHonest win rates with full contextAirdrop qualityRandomEcosystem-filtered + scoredOHLCV data storageNone16,500+ rows, pre-computed indicatorsBacktest validationNoneMandatory before production release
