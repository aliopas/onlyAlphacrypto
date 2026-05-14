# ONLYALPHA — PROJECT STATE

**Last Updated:** May 14, 2026
**Current Focus:** Phase A Bug Fix Batch (7 fixes, 10 tasks — FIX-7 split into 4 sub-tasks)
**Active Plan Sources:** plans/ALGORITHM-INTELLIGENCE-UPGRADE.md, plans/SEO-META-TAGS-PHASE.md

---

## Architecture

- **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL
- **Frontend:** Next.js (App Router), Tailwind CSS
- **Data Sources:** Binance, Moralis, RSS feeds, Telegram
- **AI Routing:** AIGateway (OpenRouter) — DeepSeek-r1, Gemini 2.5 Flash, GPT-5-nano
- **Cache:** Redis (ioredis)

---

## Current Mission: Algorithm Intelligence Upgrade — Phase A

**Status:** Phase A IN PROGRESS — 7 bug fixes (10 tasks) to unblock algorithm signal generation + shadow mode
**Source Plan:** plans/ALGORITHM-INTELLIGENCE-UPGRADE.md
**Decisions:** DEC-021 to DEC-026, DEC-028

### Phase A: Bug Fix Batch (7 Fixes)

| Fix | File | Decision | Description |
|---|---|---|---|
| FIX-1 | tpslCalculatorV2.service.ts | DEC-021 | RR fallback math: ATR TP×2.0/SL×1.0 |
| FIX-2 | signalClassification.service.ts | DEC-022 | Direction derived from verdict, not hardcoded |
| FIX-3 | technicalAnalysis.service.ts | DEC-023 | S/R filter lowered 60→40 for quality scoring |
| FIX-4 | aiWorkflow.cron.ts | DEC-024 | Daily trend allows trend-aligned signals |
| FIX-5 | marketRegime.service.ts | DEC-025 | VOLATILE threshold raised 3%→5% |
| FIX-6 | signalClassification.service.ts | DEC-026 | Deduplicate triple RR check |
| FIX-7 | aiWorkflow.cron.ts | DEC-028 | Composite algorithm verdict (4 sub-tasks: 7A/7B/7C/7Q) |

### Phase A Exit Gate

- [ ] All 7 fixes deployed
- [ ] Shadow mode running minimum 1 week
- [ ] Algorithm produces >= 10 non-NEUTRAL signals per week
- [ ] Shadow mode shows >= 30% non-NEUTRAL algorithm verdicts
- [ ] Algorithm disagreement win rate measurable
- [ ] No regression in AI signal quality

### Phase B: TBD (blocked by Phase A exit gate)
Single intelligence engine (candidate: Momentum Layer RSI+MACD)

---

## Current Mission (Parallel Track): SEO & Meta Tags Remediation

**Status:** APPROVED — 13 tasks, frontend only
**Source Plan:** plans/SEO-META-TAGS-PHASE.md
**Decision:** DEC-027

### Execution Order

| Order | ID | Task | Priority |
|---|---|---|---|
| 1 | SEO-9 | SITE_URL hardcoded cleanup | Infrastructure |
| 2 | SEO-4 | Airdrop 404 noindex fix | Critical |
| 3 | SEO-10 | twitter:site in root layout | Infrastructure |
| 4 | SEO-1 | Home page full metadata + JSON-LD | Critical |
| 5 | SEO-6 | Terminal index metadata | Critical |
| 6 | SEO-2 | Airdrops listing OG image + JSON-LD | Critical |
| 7 | SEO-3 | Airdrop detail JSON-LD + OG image | Critical |
| 8 | SEO-5 | Scorecard JSON-LD + OG image | Important |
| 9 | SEO-7 | About page OG + JSON-LD | Important |
| 10 | SEO-8 | Static pages OG + canonical (4 pages) | Important |
| 11 | SEO-11 | Scorecard added to sitemap | Infrastructure |
| 12 | SEO-12 | Alpha page OG image | Polish |
| 13 | SEO-13 | Home sitemap verification | Polish |

### SEO Phase Exit Gate

- [ ] Lighthouse SEO >= 95 on `/`, `/airdrops`, `/terminal`
- [ ] All public pages: unique title + description + canonical + OG tags
- [ ] Zero hardcoded SITE_URL outside constants.ts
- [ ] Airdrop 404 = noindex
- [ ] JSON-LD on home, airdrops, scorecard, archive

---

## Completed Tranches (Master Plan v2.1)

### Tranche 1 + 2 COMPLETE

| Tranche | Phases | Status |
|---|---|---|
| Tranche 1 | Phase 0 + 0.1 + 1 + 1.5 | ✅ COMPLETE (QA PASSED) |
| Tranche 2 | Phase 0.5 + 2 + 3 + 4 + 5 + 7.1 + 9 | ✅ COMPLETE (QA PASSED) |

### Tranche 2 Exit Gate (PENDING)

- [ ] Shadow mode running minimum 2 weeks
- [ ] 20+ resolved shadow signals
- [ ] Algorithm disagreement win rate > 60%

### Blocked Tranches

| Tranche | Phases | Status | Blocked By |
|---|---|---|---|
| Tranche 3 | Phase 7.2 + 7.3 + 7.4 + 8 | ⬜ BLOCKED | Tranche 2 Exit Gate |

---

## Key Infrastructure (Active)

| Component | File | Purpose |
|---|---|---|
| Coin Constants | config/coins.ts | 11 tracked coins |
| OHLCV Candles + Indicators | ohlcvSnapshot.service.ts | Pre-computed EMA/ATR/volume |
| Technical Analysis | technicalAnalysis.service.ts | 8 sub-engines, 771 lines |
| Signal Classification | signalClassification.service.ts | TACTICAL vs STRATEGIC |
| Market Regime | marketRegime.service.ts | 5 regimes, BTC-centric |
| TP/SL V2 | tpslCalculatorV2.service.ts | S/R → ATR priority chain |
| TP/SL Sanity Gate | tpslSanityGate.service.ts | 7 validation checks |
| Shadow Signals | shadowSignals.service.ts | Algorithm vs AI comparison |
| Signal Lifecycle | signalLifecycle.service.ts | NEW → ACTIVE → CLOSED |
| Daily Trend | dailyTrend.service.ts | Trend-aware signal gating |
| Airdrop Quality | airdropQuality.service.ts | Score < 60 = reject |

---

## Development Rules

1. Zero `any` types — strict TypeScript
2. Modular boundaries: CacheManager, AIGateway, PromptFactory
3. Backward compatible — all existing exports unchanged
4. Zero BUY/SELL terminology — BULLISH/BEARISH only
5. All DB queries via Drizzle ORM
6. All migrations guarded by migration_flags
7. All new crons behind env flags (default false)

---

## Guiding Principle

The algorithm reads the market and produces the numbers. The AI explains the why. Never the reverse.

---

## Historical Reference

For completed phase details, see:
- TIMELINE.md — strategic narrative
- FEATURE_MAP.md — feature ownership + dependencies
- DECISIONS_COMPRESSED.md — architecture decisions
- AGENT_LOGS.md — QA review history
- archives/ — full historical documentation
