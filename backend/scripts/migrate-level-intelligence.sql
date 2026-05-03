-- Migration: Add Level Intelligence Tables
-- Phase 3: Level Intelligence Engine

-- Create enums
CREATE TYPE level_type AS ENUM ('support', 'resistance');
CREATE TYPE timeframe AS ENUM ('1h', '4h', '1d', '1w');
CREATE TYPE interaction_type AS ENUM ('touch', 'bounce', 'break', 'fakeout');

-- Create level_intelligence table
CREATE TABLE level_intelligence (
    id SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL,
    level_price NUMERIC(24,12) NOT NULL,
    level_type level_type NOT NULL,
    timeframe timeframe NOT NULL,
    touch_count INTEGER DEFAULT 0 NOT NULL,
    bounce_count INTEGER DEFAULT 0 NOT NULL,
    break_count INTEGER DEFAULT 0 NOT NULL,
    fakeout_count INTEGER DEFAULT 0 NOT NULL,
    avg_bounce_percent NUMERIC(24,12),
    avg_break_percent NUMERIC(24,12),
    volume_at_level NUMERIC(24,12),
    last_touched_at TIMESTAMP,
    confidence_score INTEGER DEFAULT 0 NOT NULL,
    flipped BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX level_intelligence_coin_symbol_timeframe_idx ON level_intelligence (coin_symbol, timeframe);
CREATE INDEX level_intelligence_level_price_coin_symbol_timeframe_idx ON level_intelligence (level_price, coin_symbol, timeframe);

-- Create level_interactions table
CREATE TABLE level_interactions (
    id SERIAL PRIMARY KEY,
    level_id INTEGER REFERENCES level_intelligence(id) NOT NULL,
    candle_timestamp TIMESTAMP NOT NULL,
    price_at_touch NUMERIC(24,12) NOT NULL,
    interaction_type interaction_type NOT NULL,
    magnitude_percent NUMERIC(24,12),
    volume_at_touch NUMERIC(24,12),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);