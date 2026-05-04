import {
    pgTable, serial, varchar, text, timestamp,
    integer, real, json, jsonb, boolean, pgEnum, unique,
    customType, numeric, index, uuid, primaryKey, uniqueIndex
} from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(1536)';
    },
    toDriver(value: number[]): string {
        return `[${value.join(',')}]`;
    },
    fromDriver(value: string | Buffer): number[] {
        const str = typeof value === 'string' ? value : value.toString('utf-8');
        return str.slice(1, -1).split(',').map(Number);
    },
});

// ─── LEVEL INTELLIGENCE ENUMS ──────────────────────────────────────────────────
export const levelTypeEnum = pgEnum('level_type', ['support', 'resistance']);
export const timeframeEnum = pgEnum('timeframe', ['1h', '4h', '1d', '1w']);
export const interactionTypeEnum = pgEnum('interaction_type', ['touch', 'bounce', 'break', 'fakeout']);

// ─── MARKET SCENARIOS ENUMS ────────────────────────────────────────────────────
export const sourceTypeEnum = pgEnum('source_type', ['signal', 'radar', 'manual', 'event']);
export const scenarioTypeEnum = pgEnum('scenario_type', ['speculation', 'swing', 'investment']);
export const biasEnum = pgEnum('bias_type', ['bullish', 'bearish', 'neutral']);
export const scenarioStatusEnum = pgEnum('scenario_status', ['pending', 'active', 'completed', 'expired', 'invalidated']);
export const horizonTypeEnum = pgEnum('horizon_type', ['1h','4h','24h','3d','7d','14d','30d','90d','180d','365d','730d']);
export const horizonGroupEnum = pgEnum('horizon_group', ['speculation', 'swing', 'investment']);
export const outcomeClassificationEnum = pgEnum('outcome_classification', ['favorable', 'unfavorable', 'neutral', 'invalidated', 'insufficient_data']);
export const outcomeStatusEnum = pgEnum('outcome_status', ['pending', 'captured', 'failed', 'skipped']);

// ─── MARKET INSIGHTS (AI Verdicts per Coin) ───────────────────────────────────
export const marketInsights = pgTable('market_insights', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(), // 'SOL', 'BTC'
    coinName: varchar('coin_name', { length: 100 }).notNull(),    // 'Solana'
    coinSlug: varchar('coin_slug', { length: 100 }).notNull(),    // 'solana' (for URL)
    verdict: varchar('verdict', { length: 20 }).notNull(),        // 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'
    confidenceScore: real('confidence_score').notNull(),          // 0-100
    executiveSummary: text('executive_summary'),
    supportLevels: json('support_levels'),                        // { level1: 140, level2: 135 }
    resistanceLevels: json('resistance_levels'),
    rsiValue: real('rsi_value'),
    volumeSurge: real('volume_surge'),
    tvlChange: real('tvl_change'),
    socialMomentum: real('social_momentum'),
    priceAtAnalysis: real('price_at_analysis'),
    riskLevel: varchar('risk_level', { length: 20 }),             // 'LOW' | 'MEDIUM' | 'HIGH' - New field for AI analysis
    redFlags: json('red_flags'),                                  // [] strings - New field for AI analysis
    keyDrivers: json('key_drivers'),                              // [] strings - Key reasons for the verdict
    marketContext: text('market_context'),
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
});

// ─── COIN NEWS (LATEST WIRE feed) ────────────────────────────────────────────
export const coinNews = pgTable('coin_news', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }),
    headline: text('headline').notNull(),
    summary: text('summary'),
    hook: text('hook'),
    metaTitle: varchar('meta_title', { length: 80 }),
    metaDescription: varchar('meta_description', { length: 200 }),
    seoKeywords: json('seo_keywords'),
    sourceUrl: varchar('source_url', { length: 500 }),
    sentiment: varchar('sentiment', { length: 20 }),
    impactScore: real('impact_score'),
    isBreaking: integer('is_breaking').default(0),
    sourceHash: varchar('source_hash', { length: 64 }).unique(),
    aiProcessed: integer('ai_processed').default(1),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── RAW NEWS BUFFER (Phase 1A: Gathering Engine) ───────────────────────────
export const rawNewsBuffer = pgTable('raw_news_buffer', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    source: varchar('source', { length: 100 }),
    retrievedAt: timestamp('retrieved_at').defaultNow().notNull(),
    sourceHash: varchar('source_hash', { length: 64 }).unique().notNull(),
    ttlExpiresAt: timestamp('ttl_expires_at'),
    processed: boolean('processed').default(false).notNull(),
    processingAttempts: integer('processing_attempts').default(0).notNull(),
    symbolMentions: jsonb('symbol_mentions'),
    sentimentHint: varchar('sentiment_hint', { length: 20 }),
    relevanceScore: integer('relevance_score'),
    eventType: varchar('event_type', { length: 50 }),
    eventSeverity: integer('event_severity'),
    classification: varchar('classification', { length: 10 }),
    consumed: boolean('consumed').default(false).notNull(),
    consumedAt: timestamp('consumed_at'),
    embedding: vector('embedding'),
});

// ─── RADAR SIGNALS (Home Live AI Radar) ──────────────────────────────────────
export const radarSignals = pgTable('radar_signals', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }),
    signalText: text('signal_text').notNull(),
    sentiment: varchar('sentiment', { length: 20 }),
    impactScore: real('impact_score'),
    newsId: integer('news_id').references(() => coinNews.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── SIGNAL PERFORMANCE (P&L Tracking) ───────────────────────────────────────
export const signalPerformance = pgTable('signal_performance', {
    id: serial('id').primaryKey(),
    signalId: integer('signal_id').references(() => radarSignals.id).notNull(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    verdict: varchar('verdict', { length: 20 }).notNull(),
    sentiment: varchar('sentiment', { length: 20 }),

    entryPrice: real('entry_price').notNull(),
    entryAt: timestamp('entry_at').notNull(),

    price24h: real('price_24h'),
    price7d: real('price_7d'),
    price30d: real('price_30d'),

    pnl24h: real('pnl_24h'),
    pnl7d: real('pnl_7d'),
    pnl30d: real('pnl_30d'),

    isWin7d: boolean('is_win_7d'),
    isWin30d: boolean('is_win_30d'),

    isActive:       boolean('is_active').default(true).notNull(),
    closedAt:       timestamp('closed_at'),
    exitPrice:      real('exit_price'),
    realizedPnl:    real('realized_pnl'),
    stopLossPrice:  real('stop_loss_price'),
    takeProfitPrice: real('take_profit_price'),
    autoClosedReason: varchar('auto_closed_reason', { length: 20 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── DAILY ALPHA FOCUS ───────────────────────────────────────────────────────
export const dailyAlphaFocus = pgTable('daily_alpha_focus', {
    id: serial('id').primaryKey(),
    masterArticleId: integer('master_article_id').references(() => coinMasterArticles.id).notNull(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    coinName: varchar('coin_name', { length: 100 }).notNull(),
    coinSlug: varchar('coin_slug', { length: 100 }).notNull(),
    verdict: varchar('verdict', { length: 20 }).notNull(),
    confidenceScore: real('confidence_score').notNull(),
    executiveSummary: text('executive_summary'),
    compositeScore: real('composite_score'),
    selectedAt: timestamp('selected_at').defaultNow().notNull(),
    validForDate: varchar('valid_for_date', { length: 10 }).notNull(),
});

// ─── DAILY MARKET MOOD ───────────────────────────────────────────────────────
export const dailyMarketMood = pgTable('daily_market_mood', {
    id: serial('id').primaryKey(),
    externalScore: real('external_score').notNull(),
    internalScore: real('internal_score').notNull(),
    finalScore: real('final_score').notNull(),
    label: varchar('label', { length: 30 }).notNull(),
    computedAt: timestamp('computed_at').defaultNow().notNull(),
    validForDate: varchar('valid_for_date', { length: 10 }).notNull(),
});

// ─── PRICE SNAPSHOTS (For Token Timelines) ───────────────────────────────────
export const priceSnapshots = pgTable('price_snapshots', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    price: real('price').notNull(),
    liquidity: real('liquidity'),
    volume24h: real('volume_24h'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ─── COIN MEMORY (AI Event Memory) ───────────────────────────────────────────
export const coinMemory = pgTable('coin_memory', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventSummary: text('event_summary').notNull(),
    priceAtEvent: real('price_at_event'),
    verdict: varchar('verdict', { length: 20 }),
    confidenceScore: real('confidence_score'),
    riskVerdict: varchar('risk_verdict', { length: 20 }),
    keyDrivers: json('key_drivers'),
    redFlags: json('red_flags'),
    sourceNewsHashes: json('source_news_hashes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const coinIntelligenceCache = pgTable('coin_intelligence_cache', {
    coinSymbol:     varchar('coin_symbol', { length: 20 }).primaryKey(),
    ath:            real('ath'),
    athDate:        varchar('ath_date', { length: 20 }),
    trend8w:        varchar('trend_8w', { length: 20 }),
    week52High:     real('week_52_high'),
    week52Low:      real('week_52_low'),
    priceChange30d: real('price_change_30d'),
    wikiBackground: text('wiki_background'),
    dexBoostActive: boolean('dex_boost_active').default(false).notNull(),
    dataSource:     varchar('data_source', { length: 20 }),
    cachedAt:       timestamp('cached_at').defaultNow().notNull(),
});

export const coinNewsHistory = pgTable('coin_news_history', {
    id:            serial('id').primaryKey(),
    coinSymbol:    varchar('coin_symbol', { length: 20 }).notNull(),
    title:         text('title').notNull(),
    source:        varchar('source', { length: 100 }),
    publishedAt:   timestamp('published_at').notNull(),
    sentiment:     varchar('sentiment', { length: 10 }),
    eventType:     varchar('event_type', { length: 50 }),
    eventSeverity: integer('event_severity').default(1),
    priceAtTime:   real('price_at_time'),
    isRugPull:     boolean('is_rug_pull').default(false).notNull(),
    fetchedAt:     timestamp('fetched_at').defaultNow().notNull(),

    // New columns for Phase 1 event-price outcome tracking
    sourceHash: varchar('source_hash', { length: 64 }),
    eventScope: varchar('event_scope', { length: 20 }),
    btcPriceAtEvent: real('btc_price_at_event'),
    ethPriceAtEvent: real('eth_price_at_event'),
    fearGreedAtEvent: integer('fear_greed_at_event'),
    price1hAfter: real('price_1h_after'),
    price4hAfter: real('price_4h_after'),
    price24hAfter: real('price_24h_after'),
    price3dAfter: real('price_3d_after'),
    change1h: real('change_1h'),
    change4h: real('change_4h'),
    change24h: real('change_24h'),
    change3d: real('change_3d'),
    price7dAfter: real('price_7d_after'),
    change7d: real('change_7d'),
    priceChange7d: real('price_change_7d'),
    maxUpsideAfterEvent: real('max_upside_after_event'),
    maxDrawdownAfterEvent: real('max_drawdown_after_event'),
    timeToPeakHours: integer('time_to_peak_hours'),
    timeToBottomHours: integer('time_to_bottom_hours'),
    outcomeClassification: varchar('outcome_classification', { length: 30 }),
}, (table) => {
    return {
        unq: unique('coin_news_history_unq').on(table.coinSymbol, table.title, table.publishedAt)
    };
});

// ─── COIN MASTER ARTICLES (Living Articles) ───────────────────────────────────
export const coinMasterArticles = pgTable('coin_master_articles', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull().unique(),
    coreCatalyst: text('core_catalyst'),
    marketContext: text('market_context'),
    strategicImpact: text('strategic_impact'),
    historicalContext: text('historical_context'),
    technicalLevels: text('technical_levels'),
    riskAssessment: text('risk_assessment'),
    bottomLine: text('bottom_line'),
    headline: text('headline').notNull(),
    hook: text('hook'),
    metaTitle: varchar('meta_title', { length: 80 }),
    metaDescription: varchar('meta_description', { length: 200 }),
    seoKeywords: json('seo_keywords'),
    sentiment: varchar('sentiment', { length: 20 }),
    verdict: varchar('verdict', { length: 20 }),
    confidenceScore: real('confidence_score'),
    convictionScore: real('conviction_score'),
    posture: varchar('posture', { length: 30 }),
    riskTags: json('risk_tags'),
    triggerType: varchar('trigger_type', { length: 20 }),
    majorUpdateCount: integer('major_update_count').default(0).notNull(),
    minorUpdateCount: integer('minor_update_count').default(0).notNull(),
    lastMajorUpdate: timestamp('last_major_update'),
    lastMinorUpdate: timestamp('last_minor_update'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── COIN TIMELINE UPDATES (Living Article Events) ───────────────────────────
// ─── MIGRATION FLAGS (One-time tasks tracker) ────────────────────────────────
export const migrationFlags = pgTable('migration_flags', {
    id: serial('id').primaryKey(),
    flagName: varchar('flag_name', { length: 100 }).notNull().unique(),
    executedAt: timestamp('executed_at').defaultNow().notNull(),
});

export const coinTimelineUpdates = pgTable('coin_timeline_updates', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    masterArticleId: integer('master_article_id').references(() => coinMasterArticles.id).notNull(),
    updateText: text('update_text').notNull(),
    triggerType: varchar('trigger_type', { length: 20 }),
    severity: varchar('severity', { length: 10 }).notNull(),
    sourceTitle: text('source_title'),
    sourceHash: varchar('source_hash', { length: 64 }),
    sentiment: varchar('sentiment', { length: 20 }),
    impactScore: real('impact_score'),
    convictionDelta: real('conviction_delta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── COIN STRATEGIC OUTLOOK (Forward-Looking Intelligence) ────────────────────
export const coinStrategicOutlook = pgTable('coin_strategic_outlook', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull().unique(),

    // Short-term (7 days)
    shortTermDirection: varchar('short_term_direction', { length: 10 }),
    shortTermTarget: real('short_term_target'),
    shortTermInvalidation: real('short_term_invalidation'),
    shortTermCatalysts: json('short_term_catalysts'),
    shortTermConfidence: integer('short_term_confidence'),

    // Long-term (3-6 months)
    marketPhase: varchar('market_phase', { length: 20 }),
    bullRunProbability: integer('bull_run_probability'),
    majorSupport: real('major_support'),
    majorResistance: real('major_resistance'),
    isBottomIn: boolean('is_bottom_in'),
    isTopIn: boolean('is_top_in'),
    longTermBullEvidence: json('long_term_bull_evidence'),
    longTermBearEvidence: json('long_term_bear_evidence'),

    // Recommended action
    recommendedAction: varchar('recommended_action', { length: 20 }),
    actionRationale: text('action_rationale'),
    riskManagement: text('risk_management'),

    // Meta
    lastUpdatedByEvent: text('last_updated_by_event'),
    validUntil: timestamp('valid_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── SMART EVENT RESPONSES (Action Plans for Major Events) ────────────────────
export const smartEventResponses = pgTable('smart_event_responses', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventTitle: text('event_title').notNull(),
    immediateImpact: text('immediate_impact'),
    historicalParallels: json('historical_parallels'),
    recommendedAction: text('recommended_action'),
    watchLevels: json('watch_levels'),
    timeHorizon: varchar('time_horizon', { length: 10 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── LEVEL INTELLIGENCE (Technical Support/Resistance Levels) ──────────────────
export const levelIntelligence = pgTable('level_intelligence', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    levelPrice: numeric('level_price', { precision: 24, scale: 12 }).notNull(),
    levelType: levelTypeEnum('level_type').notNull(),
    timeframe: timeframeEnum('timeframe').notNull(),
    touchCount: integer('touch_count').default(0).notNull(),
    bounceCount: integer('bounce_count').default(0).notNull(),
    breakCount: integer('break_count').default(0).notNull(),
    fakeoutCount: integer('fakeout_count').default(0).notNull(),
    avgBouncePercent: numeric('avg_bounce_percent', { precision: 24, scale: 12 }),
    avgBreakPercent: numeric('avg_break_percent', { precision: 24, scale: 12 }),
    volumeAtLevel: numeric('volume_at_level', { precision: 24, scale: 12 }),
    lastTouchedAt: timestamp('last_touched_at'),
    confidenceScore: integer('confidence_score').default(0).notNull(),
    flipped: boolean('flipped').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        coinSymbolTimeframeIdx: index('level_intelligence_coin_symbol_timeframe_idx').on(table.coinSymbol, table.timeframe),
        levelPriceCoinSymbolTimeframeIdx: index('level_intelligence_level_price_coin_symbol_timeframe_idx').on(table.levelPrice, table.coinSymbol, table.timeframe),
    };
});

// ─── LEVEL INTERACTIONS (Audit Trail for Level Touches) ────────────────────────
export const levelInteractions = pgTable('level_interactions', {
    id: serial('id').primaryKey(),
    levelId: integer('level_id').references(() => levelIntelligence.id).notNull(),
    candleTimestamp: timestamp('candle_timestamp').notNull(),
    priceAtTouch: numeric('price_at_touch', { precision: 24, scale: 12 }).notNull(),
    interactionType: interactionTypeEnum('interaction_type').notNull(),
    magnitudePercent: numeric('magnitude_percent', { precision: 24, scale: 12 }),
    volumeAtTouch: numeric('volume_at_touch', { precision: 24, scale: 12 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── MARKET SCENARIOS ──────────────────────────────────────────────────────────
export const marketScenarios = pgTable('market_scenarios', {
    scenarioId: uuid('scenarioid').primaryKey().defaultRandom(),
    dedupeKey: varchar('dedupekey', { length: 255 }).notNull(),
    sourceType: sourceTypeEnum('sourcetype').notNull(),
    sourceId: varchar('sourceid', { length: 128 }),
    coinSymbol: varchar('coinsymbol', { length: 32 }).notNull(),
    scenarioType: scenarioTypeEnum('scenariotype').notNull(),
    bias: biasEnum('bias').notNull(),
    eventType: varchar('eventtype', { length: 50 }),
    eventSeverity: varchar('eventseverity', { length: 20 }),
    eventScope: varchar('eventscope', { length: 20 }),
    referencePrice: numeric('referenceprice', { precision: 24, scale: 12 }).notNull(),
    referencePriceSource: varchar('referencepricesource', { length: 50 }).notNull(),
    referencePriceAt: timestamp('referencepriceat').notNull(),
    targetZoneLow: numeric('targetzonelow', { precision: 24, scale: 12 }),
    targetZoneHigh: numeric('targetzonehigh', { precision: 24, scale: 12 }),
    riskZoneLow: numeric('riskzonelow', { precision: 24, scale: 12 }),
    riskZoneHigh: numeric('riskzonehigh', { precision: 24, scale: 12 }),
    invalidationPrice: numeric('invalidationprice', { precision: 24, scale: 12 }),
    thesis: text('thesis'),
    dataContext: jsonb('datacontext'),
    historicalStatsSnapshot: jsonb('historicalstatssnapshot'),
    levelContextSnapshot: jsonb('levelcontextsnapshot'),
    status: scenarioStatusEnum('status').notNull().default('pending'),
    publicSafeSummary: text('publicsafesummary'),
    createdAt: timestamp('createdat').defaultNow().notNull(),
    updatedAt: timestamp('updatedat').defaultNow().notNull(),
}, (table) => ({
    sourceIdIdx: index('market_scenarios_sourceid_idx').on(table.sourceId),
    statusIdx: index('market_scenarios_status_idx').on(table.status),
    coinSymbolIdx: index('market_scenarios_coinsymbol_idx').on(table.coinSymbol),
    scenarioTypeIdx: index('market_scenarios_scenariotype_idx').on(table.scenarioType),
}));

export const scenarioHorizonOutcomes = pgTable('scenario_horizon_outcomes', {
    scenarioId: uuid('scenarioid').references(() => marketScenarios.scenarioId, { onDelete: 'cascade' }).notNull(),
    coinSymbol: varchar('coinsymbol', { length: 32 }).notNull(),
    horizon: horizonTypeEnum('horizon').notNull(),
    horizonGroup: horizonGroupEnum('horizongroup').notNull(),
    dueAt: timestamp('dueat').notNull(),
    priceAtStart: numeric('priceatstart', { precision: 24, scale: 12 }).notNull(),
    priceAtHorizon: numeric('priceathorizon', { precision: 24, scale: 12 }),
    changePercent: numeric('changepercent', { precision: 10, scale: 4 }),
    maxUpsidePercent: numeric('maxupsidepercent', { precision: 10, scale: 4 }),
    maxDrawdownPercent: numeric('maxdrawdownpercent', { precision: 10, scale: 4 }),
    timeToPeakMinutes: integer('timetopeakminutes'),
    timeToBottomMinutes: integer('timetobottomminutes'),
    outcomeClassification: outcomeClassificationEnum('outcomeclassification'),
    status: outcomeStatusEnum('status').notNull().default('pending'),
    capturedAt: timestamp('capturedat'),
    errorMessage: text('errormessage'),
    createdAt: timestamp('createdat').defaultNow().notNull(),
    updatedAt: timestamp('updatedat').defaultNow().notNull(),
}, (table) => ({
    primaryKey: primaryKey(table.scenarioId, table.horizon),
    dueAtIdx: index('scenario_horizon_outcomes_dueat_idx').on(table.dueAt),
    statusIdx: index('scenario_horizon_outcomes_status_idx').on(table.status),
    scenarioIdIdx: index('scenario_horizon_outcomes_scenarioid_idx').on(table.scenarioId),
}));

export const scenarioStatusHistory = pgTable('scenario_status_history', {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    scenarioId: uuid('scenarioid').references(() => marketScenarios.scenarioId, { onDelete: 'cascade' }),
    oldStatus: scenarioStatusEnum('oldstatus'),
    newStatus: scenarioStatusEnum('newstatus').notNull(),
    changedAt: timestamp('changedat').defaultNow().notNull(),
    reason: text('reason'),
}, (table) => ({
    scenarioIdIdx: index('scenario_status_history_scenarioid_idx').on(table.scenarioId),
}));

// ─── EVENT IMPACTS (Phase 6B — Persistent Event Impact Data) ────────────────────
export const eventImpacts = pgTable('event_impacts', {
    id: serial('id').primaryKey(),
    sourceTable: varchar('source_table', { length: 50 }).notNull().default('coin_news_history'),
    sourceId: integer('source_id').references(() => coinNewsHistory.id, { onDelete: 'set null' }),
    coinSymbol: varchar('coin_symbol', { length: 20 }).notNull(),
    eventType: varchar('event_type', { length: 50 }),
    eventSeverity: integer('event_severity'),
    eventScope: varchar('event_scope', { length: 20 }),
    publishedAt: timestamp('published_at').notNull(),
    priceAtEvent: real('price_at_event'),
    priceSource: varchar('price_source', { length: 20 }).notNull().default('binance'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    sourceIdIdx: uniqueIndex('idx_event_impacts_source_id').on(table.sourceId),
    coinSymbolIdx: index('idx_event_impacts_coin_symbol').on(table.coinSymbol),
    eventTypeIdx: index('idx_event_impacts_event_type').on(table.eventType),
    statusIdx: index('idx_event_impacts_status').on(table.status),
    publishedAtIdx: index('idx_event_impacts_published_at').on(table.publishedAt),
}));

// ─── EVENT IMPACT OUTCOMES (Phase 6B — Per-Horizon Outcome Data) ────────────────
export const eventImpactOutcomes = pgTable('event_impact_outcomes', {
    id: serial('id').primaryKey(),
    eventImpactId: integer('event_impact_id').references(() => eventImpacts.id, { onDelete: 'cascade' }).notNull(),
    horizon: varchar('horizon', { length: 10 }).notNull(),
    horizonHours: integer('horizon_hours').notNull(),
    dueAt: timestamp('due_at').notNull(),
    checkedAt: timestamp('checked_at'),
    priceAtHorizon: real('price_at_horizon'),
    changePercent: real('change_percent'),
    maxUpsidePercent: real('max_upside_percent'),
    maxDrawdownPercent: real('max_drawdown_percent'),
    timeToPeakHours: integer('time_to_peak_hours'),
    timeToBottomHours: integer('time_to_bottom_hours'),
    outcomeClassification: varchar('outcome_classification', { length: 30 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    uniqueHorizonIdx: uniqueIndex('idx_event_impact_outcomes_unique').on(table.eventImpactId, table.horizon),
    statusIdx: index('idx_event_impact_outcomes_status').on(table.status),
    dueAtIdx: index('idx_event_impact_outcomes_due_at').on(table.dueAt),
    eventImpactIdIdx: index('idx_event_impact_outcomes_event_impact_id').on(table.eventImpactId),
}));