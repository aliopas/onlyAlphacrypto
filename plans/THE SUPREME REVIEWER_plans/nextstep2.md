OnlyAlpha — Master Implementation Plan v2.0
Tech Lead Final Approval Document

Guiding Principle
The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

PHASE 0 — Foundation (Do This First, Everything Depends On It)
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

PHASE 0.5 — Shadow Mode + Admin Dashboard

Objective
Run the algorithm silently alongside the current AI system for 2 weeks minimum. Compare results on real market data before switching. Never rely on server logs — all data persists in the database.

Part A — Shadow Mode Engine
New Table: shadow_signals
id                  SERIAL PRIMARY KEY
coin_symbol         VARCHAR(20)
algorithm_verdict   VARCHAR(20)    -- BUY / SELL / STRONG_BUY / STRONG_SELL
ai_verdict          VARCHAR(20)    -- from existing analysisResult
algorithm_entry     REAL           -- live price at generation time
ai_entry            REAL           -- live price at generation time
algorithm_tp        REAL           -- from Phase 1 engine
algorithm_sl        REAL           -- from Phase 1 engine
ai_tp               REAL           -- from existing system
ai_sl               REAL           -- from existing system
quality_score       INT            -- from Phase 1 engine
trend_context       VARCHAR(20)    -- STRONG_BULLISH / BULLISH / etc
agreement           BOOLEAN        -- did both systems agree?
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
Runs every 15 minutes — same frequency as tpslMonitor.
Logic:
Every 15 minutes:
  → Fetch all unresolved shadow_signals
  → For each signal:
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

Part C — Admin Dashboard
Security
No DB users. No JWT. Simple session stored in memory.
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your_strong_password
ADMIN_SESSION_SECRET=random_32_char_string
Login endpoint: POST /admin/login
Session expires: 24 hours
All admin routes protected by adminAuth.middleware.ts

New Routes
POST /admin/login
GET  /admin/shadow/stats
GET  /admin/shadow/signals
GET  /admin/shadow/signals/:id

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

Algorithm disagreement win rate > 60% → Ready to switch
Algorithm disagreement win rate 50-60% → Needs more data
Algorithm disagreement win rate < 50% → Algorithm needs tuning

Part D — Integration Point in AiWorkflow
In aiWorkflow.cron.ts, after the existing signal generation logic, add a shadow record insertion:
Existing flow stays 100% untouched
        ↓
After signal saved to radar_signals:
        ↓
Run Phase 1 algorithm on same coin + same news
        ↓
Insert into shadow_signals with both verdicts
        ↓
agreement = (algorithm_verdict direction == ai_verdict direction)
Zero impact on existing users. Zero change to existing signals.

Hard Rules

shadow_signals table is read-only for users — never exposed via public API
Admin routes never appear in the public API documentation
Algorithm runs silently — never affects existing signal generation
Decision to switch is manual — the banner recommends, you decide
Minimum 20 resolved signals before the decision banner appears
Admin session never stored in DB — memory only with 24h expiry
All admin routes return 404 (not 401) for unauthenticated requests — security by obscurity

PHASE 1 — Technical Analysis Engine
This is the foundation every other phase depends on. Zero AI cost.
New file: services/technicalAnalysis.service.ts
1.1 — EMA Calculator
EMAPurposeEMA 20Short-term trendEMA 50Medium-term trendEMA 200Macro trend / long-term bias
Trend Detection Logic:
ConditionTrend LabelPrice > EMA20 > EMA50 > EMA200STRONG_BULLISHPrice > EMA50, EMA20 > EMA50BULLISHEMAs intertwined in tight rangeSIDEWAYSPrice < EMA50, EMA20 < EMA50BEARISHPrice < EMA20 < EMA50 < EMA200STRONG_BEARISH

1.2 — Support & Resistance Engine
Extracted from real candles only — no AI involvement.
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
Reads the real structure of price action — no AI.
PatternMeaningHigher Highs + Higher LowsUptrend confirmedLower Highs + Lower LowsDowntrend confirmedBreak of Structure (BOS)Trend continuation signalChange of Character (CHOCH)Potential reversal — reduce confidenceFailed BOSFake breakout — do not generate signal
CHOCH Rule: If CHOCH is detected, signal confidence automatically drops by 20 points regardless of other factors.

1.4 — Candle Pattern Recognition
Pattern alone is never enough. All three conditions must be true:
ConditionRulePattern presentHammer, Engulfing, Morning/Evening Star, Shooting StarVolume confirmationVolume > 20% above 20-day averageStructure alignmentPattern must form at identified S/R level
If any condition fails — pattern is ignored entirely.

1.5 — Volume Confirmation Engine
ConditionSignal WeightVolume > 20% above average+15 points to quality scoreVolume spike > 2x average+25 points to quality scoreMovement with no volumeSignal rejected entirely

1.6 — Signal Quality Score (Zero AI Cost)
Algorithmic score 0-100. Signal only proceeds if score >= 60.
FactorPointsTrend confirmed — EMA alignment correct+25Price near S/R level — within 2%+25Volume confirmation+25Candle pattern present at S/R+25
Penalty modifiers:

CHOCH detected: -20
Low volume movement: -15
Price > 25% move in 24h: -20 (manipulation flag)


PHASE 2 — Market Regime Detection
New file: services/marketRegime.service.ts
Determines the current state of the market before any signal is processed. This is infrastructure — not a feature.
Regime Types
RegimeConditionsEffect on SignalsRISK_ONLow volatility + strong volume + bullish structureBullish signals full confidenceRISK_OFFMacro fear event + declining volume + bearish structureBullish confidence -20%, SL widens 15%TRENDINGClear EMA alignment + BOS confirmedTrend-following signals prioritizedSIDEWAYSEMAs intertwined + low volume + no BOSNo signals generatedVOLATILEPrice change > 8% in 4h + volume spikeAll signals paused until stable
Regime Detection Sources
SourceData UsedBinanceBTC 4h price action + volumeAlternative.meFear & Greed IndexRSS feeds (existing)Macro keywords: war, sanctions, fed rate, inflation, crisis, ban
Rule: Macro keywords trigger RISK_OFF regime automatically. No new AI calls — keyword matching only using existing RSS pipeline.
Regime Storage
Stored in coin_intelligence_cache as currentRegime field. Refreshed every 4 hours by existing convictionUpdate.cron.ts.

PHASE 3 — Signal Classification System
DB Migration — radar_signals table additions
signal_type          VARCHAR(20)   -- tactical / strategic
horizon_days         INT           -- 3 for tactical, 14-21 for strategic
quality_score        INT           -- from Phase 1 engine
trend_context        VARCHAR(20)   -- STRONG_BULLISH / BULLISH / etc
entry_zone_low       REAL          -- algorithmic entry zone
entry_zone_high      REAL          -- algorithmic entry zone
invalidation_level   REAL          -- level that breaks the thesis
invalidation_reason  TEXT          -- why this level matters
confidence_score     INT           -- from analysisResult (existing)
Migration guarded by migration_flags. Backward compatible — all existing columns untouched.
Event → Signal Type Mapping
Signal TypeHorizonTriggered ByTACTICAL3 daysListing, whale movement, partnership, price action, volume spikeSTRATEGIC14 daysETF approval/rejection, regulation, hack, delistingSTRATEGIC21 daysMainnet launch, major funding, protocol upgrade
Risk/Reward Rules
TypeMinimum RRSL PlacementTACTICAL1:2Below/above nearest S/R from Phase 1STRATEGIC1:3Below/above major S/R from Phase 1
Hard rule: If RR cannot meet minimum — signal is rejected. Not downgraded. Rejected.

PHASE 4 — TP/SL Engine Overhaul
Replaces AI-generated support/resistance levels entirely.
TP Calculation
PrioritySource1stNext resistance level from Phase 1 S/R engine2ndLiquidity target (equal highs zone)3rdATR extension (1.5x ATR from entry) — only if no S/R found
SL Calculation
PrioritySource1stInvalidation level — structure break point from Phase 12ndBelow nearest support with strength >= 603rdATR-based (1x ATR below entry) — only if no S/R found
TP/SL Sanity Gate
Before any signal is saved, validate:
CheckRuleBullish TPMust be above entryBullish SLMust be below entryBearish TPMust be below entryBearish SLMust be above entryDistance from entryMust be between 1% and 40%RR ratioMust meet minimum for signal type
If any check fails → signal rejected + logged. Never saved.

PHASE 5 — Signal Lifecycle System
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


PHASE 6 — AI Role Refinement
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

PHASE 7 — Multi-Timeframe Analysis (Incremental)
Built in 4 tasks — each task is independent and deployable alone.
Task 7.1 — Daily Trend Context (Deploy First)
Add daily_trend field to coin_intelligence_cache. Calculated from Daily candles using Phase 1 EMA logic. Refreshed every 6 hours.
Immediate impact: Every signal now shows Daily trend context. Uptrend signals only generate when Daily trend is BULLISH or STRONG_BULLISH.
Task 7.2 — Weekly Bias Layer
Add weekly_bias field to coin_intelligence_cache. Calculated from Weekly candles. Refreshed once daily at 04:00 UTC alongside historicalNews.cron.ts.
Rule added: If Weekly bias is STRONG_BEARISH — TACTICAL bullish signals are suppressed entirely.
Task 7.3 — 4H Entry Timing
New table coin_technical_levels stores 4H S/R levels only. Refreshed every 6 hours.
Used for: Entry zone refinement. The 4H nearest support/resistance becomes the primary entry zone for TACTICAL signals.
Task 7.4 — Multi-TF Signal Classification
Combines all timeframe data into a signal context label:
WeeklyDaily4HSignal LabelBullishBullishBullishTREND_FOLLOWING — full confidenceBearishBearishBullishCOUNTER_TREND — reduced confidence -20BullishSidewaysBullishPULLBACK_ENTRY — normal confidenceAnyAnySidewaysNO_SIGNAL

PHASE 8 — Scorecard Redesign
Header Stats (4 cards)
CardData SourceTactical Win Rateis_win72h from signal_performanceStrategic Win Rateis_win7d + is_win30d combinedBest TradeMax realizedPnl with coin + dateAvg RR AchievedAverage of actual RR across all closed signals
Active Signals Section
Split into two tabs: TACTICAL ACTIVE and STRATEGIC ACTIVE.
Each signal card shows:

Current price vs entry price + unrealized P&L%
Time remaining with progress bar
TP and SL in real numbers
Quality score badge
Signal lifecycle state
Trend context label

Performance by Coin
Table per coin showing: signal count, win rate, best trade, worst trade, average hold time. Only shows coins with 3+ closed signals.
Completed Signals Timeline

Sorted newest first
Capped at last 50 completed signals
Each entry shows: type, entry → exit price, P&L%, hold duration, close reason
Color coded: green TP_HIT, red SL_HIT, grey EXPIRED, orange THESIS_REVERSED


PHASE 9 — Airdrop System Redesign
What Gets Removed
RemovedReasonairdrop_tasks tableNo task tracking neededuser_progress tableNo per-user completion trackingWallet verification logicComplexity with zero intelligence valueAuto-verification systemSame reason
New Fields on airdrop_projects
FieldPurposeecosystemTagLinks to one of the 11 coinseffortLevelLOW / MEDIUM / HIGHrewardConfidenceHIGH / MEDIUM / LOW / UNVERIFIEDqualityScore0-100 composite at insertion time
New Quality Scoring
CriterionWeightEcosystem connection to the 11 coins30%Verified funding or backing25%Real community size20%Effort vs reward ratio15%Risk level10%
Hard rule: Score < 60 → never reaches database. Score < 75 → marked low confidence.
Ecosystem Scope per Coin
CoinAccepts Airdrops FromETHL2s, DeFi protocols, restaking projectsSOLDePIN, Gaming, consumer appsTONTelegram-native projects onlyBNBBSC DeFi, GameFiOthersDirect project airdrops only
Frontend Card Shows
Effort indicator, ecosystem badge, risk verdict, deadline urgency, reward confidence, quality score. No task lists. No progress bars. No wallet connection required.

Implementation Order — Strict
WeekPhasesDependencyWeek 0Phase 0 (Coin Filter + Market Filter)None — do this firstWeek 1Phase 1 (Technical Engine)Requires Phase 0Week 1Phase 3 (Signal Classification DB)Can run parallel with Phase 1Week 2Phase 2 (Market Regime)Requires Phase 1Week 2Phase 4 (TP/SL Overhaul)Requires Phase 1Week 3Phase 5 (Signal Lifecycle)Requires Phase 3 + Phase 4Week 3Phase 6 (AI Role Refinement)Requires Phase 1 + Phase 2Week 4Phase 7 Task 7.1 (Daily Trend)Requires Phase 1Week 4Phase 7 Task 7.2 (Weekly Bias)Requires Task 7.1Week 5Phase 7 Task 7.3 (4H Entry)Requires Task 7.2Week 5Phase 7 Task 7.4 (Multi-TF Classification)Requires Task 7.3Week 5Phase 8 (Scorecard)Requires Phase 5 + Phase 6Week 6Phase 9 (Airdrop)Independent — can start anytime after Week 0

Hard Rules for Every Implementing Agent

Phase 0 must be complete and verified before any other phase starts
Never hardcode coin symbols — always import from config/coins.ts
All DB migrations guarded by migration_flags — run exactly once
Drop removed tables completely — never leave unused tables
TP/SL always from algorithm — never from AI response
Signal rejected if quality score < 60 — never downgraded
Signal rejected if RR does not meet minimum — never saved
AI prompt never exceeds the structure defined in Phase 6
GLM discovery calls stay capped at 5 per run
Never increase cron frequency without explicit approval


Expected Outcomes
MetricCurrentAfter PlanAI token costBaseline-60% to -70%Signal accuracyLow — AI-onlyHigh — algorithm + AI confirmationFalse signalsHigh — unfiltered coinsNear zero — 11 coins + quality gateTP/SL reliabilityPoor — AI hallucinatedHigh — real candle levelsScorecard valueMisleadingHonest win rates with full contextAirdrop qualityRandomEcosystem-filtered + scored