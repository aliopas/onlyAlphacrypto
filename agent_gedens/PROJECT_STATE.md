# ONLYALPHA — PROJECT STATE

**Last Updated:** May 10, 2026
**Current Focus:** Tranche 2 — Phase 0.5/2/3 QA PASSED, Phase 4 remaining
**Active Plan Source:** plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md
**Next Step:** Continue Tranche 2 — Phase 4 (TP/SL Engine Overhaul) or Phase 0.5 (Shadow Mode)

## Global Architecture
1. **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL.
2. **Frontend:** Next.js (App Router), Tailwind CSS.
3. **Data Sources:** Binance, Moralis, RSS feeds, Telegram. (Neon Serverless & Reddit API: DELETED).
4. **AI Routing:** `AIGateway` (OpenRouter) & `PromptFactory`.
   - **Models:** DeepSeek-r1 (Deep Analysis), Gemini 2.5 Flash (Article Writing), GPT-5-nano (SEO/Minor).

## Key Development Rules
1. **Zero `any` Types:** Strict TypeScript enforcement.
2. **Modular Boundaries:** Cache logic → `CacheManager`. AI calls → `AIGateway`. Prompts → `PromptFactory`.
3. **Backward Compatibility:** All existing backend exports must remain unchanged unless explicitly authorized.
4. **Zero BUY/SELL Terminology:** All verdicts use BULLISH/BEARISH internally.

---

## Current Mission: Master Plan v2.1 — Algorithmic Signal Engine

**Status:** Tranche 1 COMPLETE. Tranche 2 Phase 0.5/2/3 COMPLETE. Phase 4 remaining.
**Plan Source:** `plans/THE SUPREME REVIEWER_plans/nextstep2-v2.md`
**Guiding Principle:** The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

### Tranche 1 — Foundation + Validation (COMPLETE ✅)
| Phase | Description | Status |
|---|---|---|
| v2.Phase 0 | Coin Filter + Market Filter | ✅ COMPLETE (QA PASSED) |
| v2.Phase 0.1 | OHLCV Data Infrastructure | ✅ COMPLETE (QA PASSED) |

### Tranche 1 — Remaining (Next Up)
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 1 | Technical Analysis Engine | ✅ COMPLETE (QA PASSED Round 3) | v2.Phase 0.1 |
| v2.Phase 1.5 | Backtesting Framework | ✅ COMPLETE (QA PASSED Round 4) | v2.Phase 1 |

**Tranche 1 Exit Gate:**
- [ ] 90 days of candle data stored for all 11 coins x 3 timeframes
- [ ] Backtesting pass criteria ALL met (win rate >40%, quality >=60 on 20%+ days, directional diversity, trend accuracy >55%, S/R hit rate >50%)

### Tranche 2 — Shadow Mode + Classification + Regime + TP/SL (PLANNED)
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 0.5 | Shadow Mode + Admin Dashboard | ⬜ PLANNED (T-V2-05A→05Q) | v2.Phase 1.5 PASSED |
| v2.Phase 3 | Signal Classification System | ✅ COMPLETE (QA PASSED Round 3) | v2.Phase 1 |
| v2.Phase 2 | Market Regime Detection | ✅ COMPLETE (QA PASSED Round 2) | v2.Phase 1 |
| v2.Phase 4 | TP/SL Engine Overhaul | ⬜ PLANNED (T-V2-4A→4Q) | v2.Phase 1 + v2.Phase 3 |

**Tranche 2 Exit Gate:**
- [ ] Shadow mode running minimum 2 weeks
- [ ] 20+ resolved shadow signals
- [ ] Algorithm disagreement win rate > 60%

### Tranche 3 — Full Integration (BLOCKED)
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 5 | Signal Lifecycle System | ⬜ BLOCKED | v2.Phase 3 + v2.Phase 4 |
| v2.Phase 7.1 | Daily Trend Context | ⬜ BLOCKED | v2.Phase 1 |
| v2.Phase 7.2 | Weekly Bias Layer | ⬜ BLOCKED | v2.Phase 7.1 |
| v2.Phase 7.3 | 4H Entry Timing | ⬜ BLOCKED | v2.Phase 7.2 |
| v2.Phase 7.4 | Multi-TF Classification | ⬜ BLOCKED | v2.Phase 7.3 |
| v2.Phase 8 | Scorecard Redesign | ⬜ BLOCKED | v2.Phase 5 + v2.Phase 6 |

### Independent Track
| Phase | Description | Status | Dependency |
|---|---|---|---|
| v2.Phase 9 | Airdrop System Redesign | ⬜ NOT STARTED | v2.Phase 0 only |

---

## Key New Infrastructure (v2.1)
| Component | File | Purpose |
|---|---|---|
| Coin Constants | `backend/src/config/coins.ts` | Single source of truth for 11 tracked coins |
| OHLCV Candles Table | `ohlcv_candles` in `market.model.ts` | Raw candle storage (11 coins x 3 TFs) |
| OHLCV Indicators Table | `ohlcv_indicators` in `market.model.ts` | Pre-computed EMA/ATR/volume_avg |
| OHLCV Snapshot Service | `backend/src/services/ohlcvSnapshot.service.ts` | Fetch, store, compute indicators |
| OHLCV Snapshot Cron | `backend/src/crons/ohlcvSnapshot.cron.ts` | Every 4H refresh |
| Historical Backfill | `backend/scripts/backfill-ohlcv.ts` | One-time 90-day backfill |
| Market Filter Cron | `backend/src/crons/marketFilter.cron.ts` | Every 6H, coin health check |
| Technical Analysis | `backend/src/services/technicalAnalysis.service.ts` | ✅ COMPLETE — Full rewrite per v2 spec (771 lines, 8 sub-engines, QA PASSED Round 3) |
| Backtesting Script | `backend/scripts/backtest-technical.ts` | ✅ COMPLETE — Historical TA replay, 5 exit gate metrics, QA PASSED Round 4 |
| Historical Query Helpers | `backend/src/services/ohlcvSnapshot.service.ts` | getCandlesAtTime + getIndicatorsRange (QA PASSED) |
| Backtest Env Flag | `backend/src/config/env.ts` | BACKTEST_TECHNICAL_ENABLED (default false) |
| Signal Classification | `backend/src/services/signalClassification.service.ts` | ✅ COMPLETE — classifySignalOutcome + getClassificationStats (QA PASSED Round 3) |
| Signal Classification Migration | `backend/scripts/migrate-signal-classification.sql` | ✅ COMPLETE — migration_flags guard, enum type for outcome_classification (QA PASSED) |
| Market Regime Detection | `backend/src/services/marketRegime.service.ts` | ✅ COMPLETE — 5 regimes (RISK_ON/OFF, TRENDING, SIDEWAYS, VOLATILE), BTC 4H + Fear&Greed + RSS macro scan (QA PASSED Round 2) |
| Market Regime Cron | `backend/src/crons/regimeUpdate.cron.ts` | ✅ COMPLETE — Every 4H, batch DB update, Redis cache (QA PASSED) |
| Market Regime Migration | `backend/scripts/migrate-market-regime.sql` | ✅ COMPLETE — migration_flags guard, current_regime VARCHAR(20) on coin_intelligence_cache (QA PASSED) |
| Regime Env Flag | `backend/src/config/env.ts` | MARKET_REGIME_ENABLED (default false) |

---

## Completed Phases (Legacy — Pre-v2.1)

| Phase | Description | Key Commits | Notes |
|---|---|---|---|
| Phase 7 | Public Language / Google-Safe | 3933f44→f1e6535 | 9 tasks, 175 files audited, 78 findings fixed |
| Phase 2 | Full Event Impact Engine | 4ae0af4 | 8 tasks, 68/68 QA pass. Stats injection behind flag. |
| Phase 1 | Event Impact Activation | f206e39, 886bea9 | 7 tasks, 2 new crons |
| Phase 8 | Migration Strategy | f5d0ec3 | Docs only, no migrations run |
| Phase 6B | Event Impact Persistence | — | 7 tasks, event_impacts + outcomes tables |
| Phase 6A | Event Impact Analysis | — | 7 tasks, read-only analysis service |
| Phase 0.5 | AdSense-Safe Presentation | — | 6 tasks, terminology cleanup |
| Phase 23 | TP/SL Auto-Close | — | 9 tasks, signalManager + tpslMonitor |
| Phase 22 | Airdrop Pipeline Resurrection | 110313b | 3 tasks, DeepSeek/GLM fix |
| Phase 21 | Multi-TF Signal System | — | 7 tasks, signalManager.service.ts |
| Phase 20 | AI Pipeline Quality | — | 8 tasks, memory injection + model fix |
| Phase 19 | AdSense Legal Pages | — | 12 tasks, 5 legal pages + footer + cookie banner |
| Phase 18 | Signal P&L Tracker | — | 8 tasks, scorecard page |
| Phase 17 | Telegram Pipeline | — | 7 tasks, telegram.service.ts |
| Phase 16 | Airdrop Pipeline Fix | — | 9 tasks, RSS + Redis dedup |
| Phase 15 | Strategic Intelligence | — | 5 tasks, strategicOutlook.service.ts |
| Phase 14 | Article Cache Fix | — | 2 tasks, cache invalidation |
| Phase 13 | 404 Dynamic Radar | — | 4 tasks, dynamic coin pages |
| Phase 12 | Airdrop UX Overhaul | — | 15 tasks |
| Phase 11 | Airdrop RSS Hunter | — | 7 tasks |
| Phase 10 | Top Movers Widget | — | 7 tasks |
| Phase 9 | Terminal Deep-Link | — | 7 tasks |
| Phase 3 | Level Intelligence | — | PARTIAL — needs reconciliation |
| Phase 4 | Scenario Tracker | — | PARTIAL — schema exists, integration stub |
| Phase 4.5 | Level Intelligence Activation | — | PARTIAL — cron stub, env flags |

### Phase Notes
- **Phase 2:** Runtime stats injection disabled by flag (`EVENT_IMPACT_STATS_IN_PROMPTS_ENABLED` default `false`). Classification confidence function exists but not fully wired. No blockers.
- **Phase 3:** `scenarioTracker.service.ts` exists from commit 58ecebd. Not confirmed complete. Needs reconciliation.
- **Phase 5:** `levelIntelligence.service.ts` exists. Not fully integrated into public scenario/article generation.
- **Phase 6:** `ai-gateway.ts`, `cache-manager.ts` exist. Full cost reduction plan not complete. Superseded by v2.Phase 6.
