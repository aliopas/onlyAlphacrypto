-- Migration: Add Event Impact Tables
-- Phase 6B: Event Impact Persistence
-- Date: May 4, 2026

-- Create event_impacts table (parallel to coin_news_history)
CREATE TABLE IF NOT EXISTS event_impacts (
    id SERIAL PRIMARY KEY,
    source_table VARCHAR(50) NOT NULL DEFAULT 'coin_news_history',
    source_id INTEGER REFERENCES coin_news_history(id) ON DELETE SET NULL,
    coin_symbol VARCHAR(20) NOT NULL,
    event_type VARCHAR(50),
    event_severity INTEGER,
    event_scope VARCHAR(20),
    published_at TIMESTAMP NOT NULL,
    price_at_event REAL,
    price_source VARCHAR(20) NOT NULL DEFAULT 'binance',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique partial index on source_id (one impact per source event, null-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_impacts_source_id ON event_impacts (source_id) WHERE source_id IS NOT NULL;

-- Performance indexes for event_impacts
CREATE INDEX IF NOT EXISTS idx_event_impacts_coin_symbol ON event_impacts (coin_symbol);
CREATE INDEX IF NOT EXISTS idx_event_impacts_event_type ON event_impacts (event_type);
CREATE INDEX IF NOT EXISTS idx_event_impacts_status ON event_impacts (status);
CREATE INDEX IF NOT EXISTS idx_event_impacts_published_at ON event_impacts (published_at);

-- Create event_impact_outcomes table (5 rows per event_impact)
CREATE TABLE IF NOT EXISTS event_impact_outcomes (
    id SERIAL PRIMARY KEY,
    event_impact_id INTEGER NOT NULL REFERENCES event_impacts(id) ON DELETE CASCADE,
    horizon VARCHAR(10) NOT NULL,
    horizon_hours INTEGER NOT NULL,
    due_at TIMESTAMP NOT NULL,
    checked_at TIMESTAMP,
    price_at_horizon REAL,
    change_percent REAL,
    max_upside_percent REAL,
    max_drawdown_percent REAL,
    time_to_peak_hours INTEGER,
    time_to_bottom_hours INTEGER,
    outcome_classification VARCHAR(30),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique index: one outcome per horizon per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_impact_outcomes_unique ON event_impact_outcomes (event_impact_id, horizon);

-- Performance indexes for event_impact_outcomes
CREATE INDEX IF NOT EXISTS idx_event_impact_outcomes_status ON event_impact_outcomes (status);
CREATE INDEX IF NOT EXISTS idx_event_impact_outcomes_due_at ON event_impact_outcomes (due_at);
CREATE INDEX IF NOT EXISTS idx_event_impact_outcomes_event_impact_id ON event_impact_outcomes (event_impact_id);

-- ROLLBACK:
-- DROP TABLE IF EXISTS event_impact_outcomes;
-- DROP TABLE IF EXISTS event_impacts;
