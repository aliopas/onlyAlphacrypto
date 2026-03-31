import {
    pgTable, serial, varchar, text, timestamp,
    integer, real, json, boolean, pgEnum
} from 'drizzle-orm/pg-core';

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
    symbolMentions: json('symbol_mentions'),
    sentimentHint: varchar('sentiment_hint', { length: 20 }),
    relevanceScore: integer('relevance_score'),
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

// ─── DAILY ALPHA FOCUS ───────────────────────────────────────────────────────
export const dailyAlphaFocus = pgTable('daily_alpha_focus', {
    id: serial('id').primaryKey(),
    insightId: integer('insight_id').references(() => marketInsights.id).notNull(),
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
    eventTitle: text('event_title').notNull(),
    eventSummary: text('event_summary'),
    verdict: varchar('verdict', { length: 20 }),
    confidenceScore: real('confidence_score'),
    riskLevel: varchar('risk_level', { length: 20 }),
    priceAtEvent: real('price_at_event'),
    sourceHash: varchar('source_hash', { length: 64 }).unique(),
    relatedNewsIds: json('related_news_ids'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});