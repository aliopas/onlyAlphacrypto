import {
    pgTable, serial, varchar, text, timestamp,
    integer, real, json, jsonb, boolean, pgEnum, unique,
    customType
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
    price7dAfter:  real('price_7d_after'),
    priceChange7d: real('price_change_7d'),
    isRugPull:     boolean('is_rug_pull').default(false).notNull(),
    fetchedAt:     timestamp('fetched_at').defaultNow().notNull(),
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