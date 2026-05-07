# 04 — Database Schema

**ORM:** Drizzle ORM  
**Database:** PostgreSQL 16+ with pgvector extension  
**Total Tables:** 32 (23 market + 5 user + 4 airdrop)

---

## Enums (11)

| Enum | Values |
|---|---|
| `level_type` | support, resistance |
| `timeframe` | 1h, 4h, 1d, 1w |
| `interaction_type` | touch, bounce, break, fakeout |
| `source_type` | signal, radar, manual, event |
| `scenario_type` | speculation, swing, investment |
| `bias_type` | bullish, bearish, neutral |
| `scenario_status` | pending, active, completed, expired, invalidated |
| `horizon_type` | 1h, 4h, 24h, 3d, 7d, 14d, 30d, 90d, 180d, 365d, 730d |
| `horizon_group` | speculation, swing, investment |
| `outcome_classification` | favorable, unfavorable, neutral, invalidated, insufficient_data |
| `outcome_status` | pending, captured, failed, skipped |

---

## Market Tables (23 tables)

File: `models/market.model.ts`

### Core Intelligence

| Table | Purpose | Key Columns |
|---|---|---|
| `market_insights` | AI verdicts per coin | coinSymbol, verdict, confidenceScore, executiveSummary, supportLevels, resistanceLevels, rsiValue, volumeSurge, riskLevel, redFlags, keyDrivers |
| `coin_master_articles` | Living Article per coin | headline, hook, coreCatalyst, marketContext, strategicImpact, historicalContext, technicalLevels, riskAssessment, bottomLine, convictionScore (0-100), posture, verdict, confidenceScore, metaTitle, metaDescription, seoKeywords |
| `coin_timeline_updates` | Events on Living Articles | masterArticleId (FK), updateText, triggerType, severity (MAJOR/MINOR), sourceTitle, sourceHash, sentiment, impactScore, convictionDelta |
| `coin_news` | Published articles | headline, summary, hook, metaTitle, metaDescription, seoKeywords, sentiment, impactScore, isBreaking, sourceHash (unique), aiProcessed |

### News Pipeline

| Table | Purpose | Key Columns |
|---|---|---|
| `raw_news_buffer` | Staging area | title, source, sourceHash (SHA-256, unique), processed, relevanceScore, classification, symbolMentions (JSONB), embedding (vector 1536), ttlExpiresAt, processingAttempts |

### Signals & Performance

| Table | Purpose | Key Columns |
|---|---|---|
| `radar_signals` | Actionable verdicts | coinSymbol, signalText, sentiment, impactScore, newsId (FK to coin_news) |
| `signal_performance` | P&L tracking | signalId, coinSymbol, verdict, sentiment, entryPrice, entryAt, is_active, closedAt, exitPrice, realizedPnl, price24h/7d/30d, pnl24h/7d/30d, isWin7d/30d |

### Market Widgets

| Table | Purpose | Key Columns |
|---|---|---|
| `daily_alpha_focus` | Daily top pick | coinSymbol, verdict, confidenceScore, executiveSummary, compositeScore, validForDate |
| `daily_market_mood` | Fear & Greed | externalScore, internalScore, finalScore (60% ext + 40% int), label, validForDate |
| `price_snapshots` | Price history | coinSymbol, price, liquidity, volume24h, timestamp |

### Coin Data

| Table | Purpose | Key Columns |
|---|---|---|
| `coin_memory` | AI event memory | coinSymbol, eventType, eventSummary, priceAtEvent, verdict, confidenceScore, riskVerdict, keyDrivers (JSON), redFlags (JSON) |
| `coin_intelligence_cache` | Cached fundamentals | coinSymbol (PK), ath, athDate, week52High, week52Low, trend8w, priceChange30d, wikiBackground, dexBoostActive, cachedAt |
| `coin_news_history` | Historical news + price impact | coinSymbol, title, source, publishedAt, sentiment, eventType, eventSeverity, priceAtTime, price7dAfter, priceChange7d, isRugPull |
| `coin_strategic_outlook` | Forward-looking intelligence | shortTermDirection/target/invalidation/catalysts/confidence, longTermPhase/bullProbability/support/resistance, recommendedAction/rationale/riskManagement |
| `smart_event_responses` | Action plans for events | coinSymbol, eventType, eventTitle, immediateImpact, historicalParallels, recommendedAction, watchLevels, timeHorizon, isActive |

### Level Intelligence

| Table | Purpose | Key Columns |
|---|---|---|
| `level_intelligence` | S/R levels per coin/timeframe | coinSymbol, levelType (support/resistance), timeframe, priceLevel, strengthScore, touchCount, volumeAtLevel |
| `level_interactions` | Price interactions with levels | levelId (FK), interactionType (touch/bounce/break/fakeout), priceAtInteraction, volumeAtInteraction |

### Market Scenarios

| Table | Purpose | Key Columns |
|---|---|---|
| `market_scenarios` | Multi-horizon scenarios | coinSymbol, sourceType, scenarioType, bias, status, referencePrice, targetPrice, stopLoss, invalidationLevel, qualityScore, dedupKey |
| `scenario_horizon_outcomes` | Per-horizon outcomes | scenarioId (FK), horizon, targetPriceAtHorizon, actualPriceAtHorizon, outcomeClassification, outcomeStatus, capturedAt |
| `scenario_status_history` | Scenario state changes | scenarioId (FK), fromStatus, toStatus, reason |

### Event Impact

| Table | Purpose | Key Columns |
|---|---|---|
| `event_impacts` | Normalized events from coin_news_history | sourceHash, coinSymbol, eventType, eventSeverity, priceAtTime, sentiment, classificationConfidence |
| `event_impact_outcomes` | 5 outcomes per event (1h/4h/24h/3d/7d) | eventImpactId (FK), horizon, priceAtHorizon, returnPct, maxUpside, maxDrawdown, outcomeClassification |

### System

| Table | Purpose | Key Columns |
|---|---|---|
| `migration_flags` | One-time task tracker | flagName (unique), executedAt |

---

## User Tables (5 tables)

File: `models/user.model.ts`

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Accounts | email, passwordHash, plan (free/pro/institutional), isOgGenesis |
| `user_wallets` | Web3 wallets | userId (FK), address, chain, chains (text array) |
| `api_keys` | API key management | userId (FK), keyHash, name, rateLimit, lastUsedAt |
| `sessions` | JWT sessions | userId (FK), token, ip, userAgent |
| `user_preferences` | Settings | userId (FK), emailBreakingNews, emailAirdropDeadlines, preferredCoins (JSONB) |

---

## Airdrop Tables (4 tables)

File: `models/airdrop.model.ts`

| Table | Purpose | Key Columns |
|---|---|---|
| `airdrop_projects` | Project registry | name, network, logo, estimatedValue, riskVerdict (LOW/MEDIUM/HIGH/SCAM), fundingRound, socialLinks, snapshotDate, tgeDate |
| `airdrop_tasks` | Per-project tasks | projectId (FK), description, contractAddress, minAmount, chain, isAutoVerifiable |
| `user_progress` | Per-user completion | userId (FK), taskId (FK), completed, verifiedBy, txHash |
| `airdrop_pipeline_runs` | Pipeline health | runType, articlesFound, projectsInserted, errors, durationMs |

---

## Relationships

```
coin_master_articles ←─── coin_timeline_updates (masterArticleId)
coin_news ←─── radar_signals (newsId)
radar_signals ←─── signal_performance (signalId)
coin_news_history → event_impacts → event_impact_outcomes (eventImpactId)
market_scenarios → scenario_horizon_outcomes (scenarioId)
market_scenarios → scenario_status_history (scenarioId)
level_intelligence → level_interactions (levelId)
users ←─── user_wallets (userId)
users ←─── api_keys (userId)
users ←─── sessions (userId)
users ←─── user_preferences (userId)
airdrop_projects ←─── airdrop_tasks (projectId)
airdrop_tasks ←─── user_progress (taskId)
```
