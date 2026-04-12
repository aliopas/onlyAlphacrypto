-- Production Performance Indexes
-- Run this after existing migrations: psql -d your_db -f production_indexes.sql

-- coin_news: filtered by coin + ordered by published_at
CREATE INDEX IF NOT EXISTS idx_coin_news_symbol_published
    ON coin_news (coin_symbol, published_at DESC);

-- coin_news: ordered by published_at (wire endpoint)
CREATE INDEX IF NOT EXISTS idx_coin_news_published
    ON coin_news (published_at DESC);

-- radar_signals: ordered by created_at (radar endpoint)
CREATE INDEX IF NOT EXISTS idx_radar_signals_created
    ON radar_signals (created_at DESC);

-- price_snapshots: alpha focus price lookups
CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol_timestamp
    ON price_snapshots (coin_symbol, timestamp DESC);

-- user_wallets: user lookups
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id
    ON user_wallets (user_id);

-- api_keys: user lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
    ON api_keys (user_id);

-- user_preferences: user lookups (unique constraint already creates index, this is defensive)
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
    ON user_preferences (user_id);

-- daily_alpha_focus: date lookups
CREATE INDEX IF NOT EXISTS idx_daily_alpha_focus_date
    ON daily_alpha_focus (valid_for_date DESC, selected_at DESC);

-- daily_market_mood: date lookups
CREATE INDEX IF NOT EXISTS idx_daily_market_mood_date
    ON daily_market_mood (valid_for_date);

-- market_insights: slug lookups
CREATE INDEX IF NOT EXISTS idx_market_insights_slug
    ON market_insights (coin_slug, analyzed_at DESC);

-- sessions: user + expiry lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions (expires_at);
