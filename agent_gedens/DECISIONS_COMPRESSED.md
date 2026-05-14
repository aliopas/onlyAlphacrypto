# DECISIONS COMPRESSED — Architecture Decision Record

**Status:** ACTIVE
**Last Updated:** May 13, 2026
**Governance:** Append only. Never delete. Max 300 lines.

Each decision is one block. No discussion. No reasoning chain. Result only.

---

## Decisions

[DEC-001]
Decision: 11 tracked coins only — BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON
Reason: Focus quality over coverage; eliminate noise from 2000+ altcoins
Impact: All coin references must import from config/coins.ts. Zero hardcoding.
Status: ACTIVE

[DEC-002]
Decision: All TA reads from pre-computed ohlcv_indicators — never compute at signal-generation time
Reason: Live computation caused inconsistent TP/SL and race conditions
Impact: No calculateEMA/calculateATR calls during signal flow. Only getLatestIndicator().
Status: ACTIVE

[DEC-003]
Decision: Algorithm produces numbers. AI explains the why. Never the reverse.
Reason: AI-generated TP/SL had 40%+ deviation from optimal; algorithm is deterministic
Impact: AI role reduced to catalyst validator only. Direction, entry, TP/SL from algorithm.
Status: ACTIVE

[DEC-004]
Decision: Shadow mode mandatory before any algorithm-goes-live switch
Reason: Unvalidated algorithm in production = financial risk
Impact: All signals dual-tracked in shadow_signals. Manual switch only after 2 weeks + 20 resolved.
Status: ACTIVE

[DEC-005]
Decision: Zero BUY/SELL terminology — use BULLISH/BEARISH only
Reason: Google AdSense policy; financial advice compliance
Impact: All labels, variables, and outputs use BULLISH/BEARISH. Search entire codebase.
Status: ACTIVE

[DEC-006]
Decision: All DB queries via Drizzle ORM — zero raw SQL in TypeScript
Reason: Type safety, migration compatibility, query consistency
Impact: No sql`...` template literals in service/cron files. SQL only in migration scripts.
Status: ACTIVE

[DEC-007]
Decision: All migrations guarded by migration_flags table
Reason: Prevent double-execution in serverless environment with cold starts
Impact: Every migrate-*.sql checks INSERT INTO migration_flags ON CONFLICT DO NOTHING first.
Status: ACTIVE

[DEC-008]
Decision: All new crons behind env flags defaulting to false
Reason: Prevent accidental activation before testing
Impact: Every cron checks process.env flag before executing. Documented in env.ts.
Status: ACTIVE

[DEC-009]
Decision: Quality score < 60 = signal rejected, never saved
Reason: Low-quality signals degrade platform credibility
Impact: isRejected flag in QualityScoreResult. Signal never reaches radar_signals table.
Status: ACTIVE

[DEC-010]
Decision: Full rewrite of technicalAnalysis.service.ts (not incremental patch)
Reason: Skeleton had wrong architecture: called analyzeTechnicals directly, created new DB tables, N+1 inserts
Impact: 771 lines rewritten. All sub-engines from scratch. 3 QA rounds.
Status: ACTIVE

[DEC-011]
Decision: Signal classification: TACTICAL (3d horizon) vs STRATEGIC (14d/21d horizon)
Reason: Different events have different market impact durations
Impact: Event type → signal type mapping. RR minimums differ (1:2 vs 1:3).
Status: ACTIVE

[DEC-012]
Decision: TP/SL from algorithm only — never from AI response
Reason: AI TP/SL had no consistency, ranged 2-40% from entry randomly
Impact: calculateTpslV2 uses S/R → ATR priority chain. Sanity gate validates 7 checks.
Status: ACTIVE

[DEC-013]
Decision: Market regime BTC-centric — BTC regime sets market-wide tone
Reason: BTC drives 60%+ of crypto market correlation
Impact: detectRegime runs on BTC first. All coins inherit regime unless coin-specific override.
Status: ACTIVE

[DEC-014]
Decision: VOLATILE regime pauses ALL signals with no exceptions
Reason: Extreme volatility = unreliable technicals, unpredictable slippage
Impact: VOLATILE check runs first in regime priority. Zero signals generated.
Status: ACTIVE

[DEC-015]
Decision: Signal lifecycle state machine — NEW → ACTIVE → PARTIAL_TP → BREAKEVEN → CLOSED
Reason: Binary signal model (open/closed) lost granular performance data
Impact: 5 states with deterministic transitions. Auto-close rules per signal type.
Status: ACTIVE

[DEC-016]
Decision: Airdrop quality gate — score < 60 never reaches database
Reason: Low-quality airdrops polluted the feed and damaged credibility
Impact: calculateAirdropQuality runs before INSERT. Rejected items logged but not stored.
Status: ACTIVE

[DEC-017]
Decision: Failed BOS = hard signal rejection regardless of quality score
Reason: Failed breakouts preceded 70%+ of losing signals in backtesting
Impact: isFailedBos check overrides quality score. Signal rejected even if score > 90.
Status: ACTIVE

[DEC-018]
Decision: CHOCH detected = -20 quality penalty (not rejection)
Reason: CHOCH is reversal signal, not invalidation — reduces confidence but doesn't kill
Impact: chochPenalty applied in calculateQualityScore. Score may still pass threshold.
Status: ACTIVE

[DEC-019]
Decision: EMA-200 null fallback → use EMA-20/50 only, return SIDEWAYS if both null
Reason: Insufficient daily history shouldn't crash signal generation
Impact: Trend detection degrades gracefully. SIDEWAYS = no signal bias.
Status: ACTIVE

[DEC-020]
Decision: Backtesting pass criteria must ALL be met before shadow mode activation
Reason: Single metric pass is meaningless — win rate without quality coverage = noise
Impact: 5 criteria: win rate >40%, quality >=60 on 20%+ days, diversity >10%, trend >55%, S/R >50%.
Status: ACTIVE

[DEC-021]
Decision: Fix TP/SL V2 RR fallback math — ATR TP×2.0/SL×1.0 for tactical, TP×3.0/SL×1.0 for strategic
Reason: Current ATR fallback RR=1.5 and percentage fallback RR=1.875, both below minimum 2.0 = guaranteed rejection
Impact: tpslCalculatorV2.service.ts fallback paths only. S/R priority unchanged.
Status: ACTIVE

[DEC-022]
Decision: Fix hardcoded direction in signalClassification.service.ts — derive from verdict
Reason: Direction hardcoded to 'bullish' breaks all BEARISH signal TP/SL and RR calculation
Impact: signalClassification.service.ts + aiWorkflow.cron.ts must pass verdict. Backward compatible optional param.
Status: ACTIVE

[DEC-023]
Decision: Lower S/R strengthScore filter from 60 to 40 for quality scoring; keep >=60 for TP/SL
Reason: Many valid S/R levels score 40-59 and are discarded, losing +25 nearSR quality bonus
Impact: technicalAnalysis.service.ts splits into strongLevels (>=60) and allLevels (>=40). tpslCalculatorV2 uses strong only.
Status: ACTIVE

[DEC-024]
Decision: Daily trend gate allows trend-aligned signals — SELL on bearish = ALLOWED
Reason: Blanket bearish rejection blocks valid SELL signals; `continue` aborts ALL item processing
Impact: aiWorkflow.cron.ts replaces `continue` with shouldSkipSignal flag. Directional alignment check.
Status: ACTIVE

[DEC-025]
Decision: Raise VOLATILE regime ATR trigger from 3% to 5%; VOLATILE check from 4% to 6%
Reason: 3% ATR is normal crypto volatility — VOLATILE triggered too often, blocking all signals
Impact: marketRegime.service.ts threshold constants only. Response logic unchanged.
Status: ACTIVE

[DEC-026]
Decision: Algorithm intelligence upgrades via strict sequential phases with shadow validation between each
Reason: Parallel development risks cascading failures; must measure before adding complexity
Impact: Phase A = bug fixes (DEC-021 to DEC-025). Phase B = single engine (TBD after A exits). Process governance.
Status: ACTIVE

[DEC-027]
Decision: SEO & Meta Tags Remediation — 13 tasks to fix platform-wide meta tag gaps
Reason: Audit revealed home page, airdrops, scorecard, and 6 static pages missing OG tags, JSON-LD, canonical URLs, and dynamic OG images
Impact: 13 files modified (frontend only). Zero backend, zero new deps. Priority: home page > airdrops > scorecard > static pages.
Status: ACTIVE

[DEC-028]
Decision: Fix algorithm verdict in shadow mode — replace single-factor EMA trend with composite direction logic
Reason: mapTrendToVerdict(taResult.trend) uses only 4H EMA alignment which returns SIDEWAYS 95%+ of the time (8 of 9 code paths). Structure, candle patterns, volume, and quality score are all computed but ignored.
Impact: aiWorkflow.cron.ts helper functions (lines 73-97) and shadow block (lines 769-797). Priority chain: structure → candle pattern → EMA trend. Quality < 40 override to NEUTRAL. Live signal pipeline UNTOUCHED.
Status: ACTIVE

[DEC-029]
Decision: Fix quality threshold discrepancy in shadow mode — change `< 60` to `< 40` per DEC-028 specification
Reason: Implementation of DEC-028 uses qualityScore < 60 instead of approved < 40, causing ALL algorithm verdicts forced to NEUTRAL. Typical scores 0-50 all below 60. DEC-009 (quality < 60 rejected) governs live pipeline only, NOT shadow mode.
Impact: aiWorkflow.cron.ts line 126 only. One-line change. Shadow mode produces directional verdicts for quality 40-59. Live pipeline untouched.
Status: ACTIVE
