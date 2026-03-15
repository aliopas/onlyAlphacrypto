import {
    pgTable, serial, varchar, text, timestamp,
    integer, real, json
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
    volumeSurge: real('volume_surge'),                            // % change vs avg
    tvlChange: real('tvl_change'),
    socialMomentum: real('social_momentum'),
    priceAtAnalysis: real('price_at_analysis'),
    riskLevel: varchar('risk_level', { length: 20 }),             // 'LOW' | 'MEDIUM' | 'HIGH' - New field for AI analysis
    redFlags: json('red_flags'),                                  // [] strings - New field for AI analysis
    analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
});

// ─── COIN NEWS (LATEST WIRE feed) ────────────────────────────────────────────
export const coinNews = pgTable('coin_news', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }),           // can be null for macro news
    headline: text('headline').notNull(),
    summary: text('summary'),
    sourceUrl: varchar('source_url', { length: 500 }),
    sentiment: varchar('sentiment', { length: 20 }),              // 'bullish' | 'bearish' | 'neutral'
    impactScore: real('impact_score'),                            // 0-100
    isBreaking: integer('is_breaking').default(0),                // 0 | 1
    sourceHash: varchar('source_hash', { length: 64 }).unique(),  // SHA-256 of raw title
    aiProcessed: integer('ai_processed').default(1),               // 1 = processed, 0 = pending
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── RADAR SIGNALS (Home Live AI Radar) ──────────────────────────────────────
export const radarSignals = pgTable('radar_signals', {
    id: serial('id').primaryKey(),
    coinSymbol: varchar('coin_symbol', { length: 20 }),
    signalText: text('signal_text').notNull(),                    // 1-sentence AI signal
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
    validForDate: varchar('valid_for_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
});

// ─── DAILY MARKET MOOD ───────────────────────────────────────────────────────
export const dailyMarketMood = pgTable('daily_market_mood', {
    id: serial('id').primaryKey(),
    externalScore: real('external_score').notNull(),      // Alternative.me score (0-100)
    internalScore: real('internal_score').notNull(),       // Our AI sentiment avg
    finalScore: real('final_score').notNull(),             // 60% external + 40% internal
    label: varchar('label', { length: 30 }).notNull(),     // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
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
