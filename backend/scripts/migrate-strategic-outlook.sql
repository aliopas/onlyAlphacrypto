-- Phase 15: Strategic Intelligence Layer
-- Run this migration BEFORE deploying the new service code
-- NOTE: Drizzle pushSchema() auto-creates these tables on dev startup.

CREATE TABLE IF NOT EXISTS coin_strategic_outlook (
    id SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL UNIQUE,
    short_term_direction VARCHAR(10),
    short_term_target REAL,
    short_term_invalidation REAL,
    short_term_catalysts JSON,
    short_term_confidence INTEGER,
    market_phase VARCHAR(20),
    bull_run_probability INTEGER,
    major_support REAL,
    major_resistance REAL,
    is_bottom_in BOOLEAN,
    is_top_in BOOLEAN,
    long_term_bull_evidence JSON,
    long_term_bear_evidence JSON,
    recommended_action VARCHAR(20),
    action_rationale TEXT,
    risk_management TEXT,
    last_updated_by_event TEXT,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_event_responses (
    id SERIAL PRIMARY KEY,
    coin_symbol VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_title TEXT NOT NULL,
    immediate_impact TEXT,
    historical_parallels JSON,
    recommended_action TEXT,
    watch_levels JSON,
    time_horizon VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strategic_outlook_symbol ON coin_strategic_outlook(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_smart_event_responses_symbol ON smart_event_responses(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_smart_event_responses_active ON smart_event_responses(coin_symbol, is_active);
