# TIMELINE — Project Journey Archive

**Status:** ACTIVE
**Last Updated:** May 13, 2026
**Governance:** Permanent archive. Append only. Max 500 lines.

Strategic milestones only. No bugs. No tasks. No commits. Narrative compression.

---

## Q1 2026 — Foundation & Launch

### March-April: Platform Build (Phases 1-8)
- Built core pipeline: RSS news → AI triage → AI analysis → signal generation → article writing
- Telegram notifications pipeline
- Signal P&L tracker + scorecard page
- AdSense-safe terminology (public language audit, 175 files)
- Airdrop pipeline with RSS hunter + Redis dedup
- Dynamic terminal pages for 11 coins
- Legal pages + footer + cookie banner for AdSense compliance

---

## Q2 2026 — Algorithmic Signal Engine (v2.1)

### May 7: Tranche 1 Kickoff — The Pivot
- **Major decision:** Algorithm produces numbers, AI explains why. Never the reverse.
- Built Coin Filter (11 tracked coins) + OHLCV Infrastructure (pre-computed indicators)
- Eliminated 21 hardcoded coin references across 3 crons
- QA: 3 rounds. 2 critical bugs found (Binance URL typo, N+1 batch performance)

### May 8: Phase 1 — Technical Analysis Engine
- **Major decision:** Full rewrite of technicalAnalysis.service.ts (not incremental patch)
- Built 8 sub-engines: Trend, S/R, Market Structure, Candle Patterns, Volume, Quality Score, Orchestrator, Starvation Monitor
- 771 lines, single file, zero live API calls
- QA: 3 rounds. Edge cases in S/R strength sorting, pattern detection else-if guards, candle ordering

### May 8: Phase 1.5 — Backtesting Framework
- Historical TA replay on 90 days of 4H data
- 5 pass criteria as exit gate for shadow mode
- Added getCandlesAtTime + getIndicatorsRange query helpers
- QA: 4 rounds — most thorough review in project history

### May 10: Tranche 2 — Shadow Mode + Classification + Regime + TP/SL
- **Round 1 FAIL:** Signal Classification had wrong columns, wrong function names, missing env checks
- **Round 2 PASS:** All 13 bugs from Round 1 fixed in single pass
- Phase 0.5: Shadow mode with admin auth (bcrypt + Redis sessions)
- Phase 2: Market regime detection (BTC 4H + Fear&Greed + RSS macro)
- Phase 3: Signal classification (TACTICAL/STRATEGIC with RR minimums)
- Phase 4: TP/SL engine overhaul (S/R → ATR priority chain + 7-check sanity gate)
- Phase 5: Signal lifecycle state machine
- Phase 7.1: Daily trend context (skip bearish coins)
- Phase 9: Airdrop quality gate (score < 60 = never inserted)

### May 11: Hotfix + Performance
- Coin filter enforcement across eventOutcomeChecker, eventImpactOutcomeChecker, scenarioOutcomeChecker
- N+1 elimination in shadowChecker (batch resolve, 500 fewer queries per run)
- Shadow signals index optimization
- getShadowStats reduced to single DB query

---

### May 14: Phase T-TR3-PA — Algorithm Verdict Rewire
- Replaced `mapTrendToVerdict` (simple EMA trend lookup) with `deriveAlgorithmVerdict` (full priority chain: Structure → Candle → EMA → Quality Gate)
- Replaced `trendToDirection` with `deriveAlgorithmDirection` (thin wrapper over verdict)
- Rewired shadow block (aiWorkflow.cron.ts lines 802-831) to use new functions
- Quality gate threshold corrected: 40 → 60 (constitution compliance)
- FAILED_BOS → NEUTRAL preserved (DEC-017)
- QA: 4 micro-tasks (PA-007 to PA-010), 3 corrections caught (orphaned references, threshold, return type)

---

## Key Architectural Pivots

| Date | Pivot | Why |
|---|---|---|
| May 7 | Algorithm-first, AI-second | AI TP/SL had 40%+ deviation from optimal |
| May 7 | 11 coins only | Quality > coverage; eliminate noise |
| May 7 | Pre-computed indicators | Live computation caused race conditions |
| May 8 | Full TA rewrite | Skeleton had fundamentally wrong architecture |
| May 10 | Shadow mode before live | Unvalidated algorithm = financial risk |
| May 10 | TP/SL from algorithm only | AI-generated had no consistency |
| May 13 | Cognitive Infrastructure | Agent governance framework (this system) |
| May 14 | Multi-source algorithm verdict | Simple trend lookup missed structure/candle signals |

---

## Current State (as of May 14, 2026)

- Tranche 1: COMPLETE
- Tranche 2: COMPLETE (all phases QA PASSED)
- Tranche 3 Phase A (PA): COMPLETE (T-TR3-PA-007 to PA-010)
- Tranche 3 Phase A (PA-001 to PA-006): PENDING
- SEO & Meta Tags Phase: PENDING (13 tasks queued)
- Awaiting: Tech Lead directive for next phase
