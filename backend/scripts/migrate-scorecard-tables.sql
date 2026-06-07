-- Migration: T-TR5-SC0-003 — Scorecard Tables (DEC-033)
-- Creates 4 tables + 2 enums for Educational Portfolio Simulation

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'scorecard_tables') THEN
        RAISE NOTICE 'scorecard_tables migration already executed. Skipping.';
        RETURN;
    END IF;

    -- Enums
    CREATE TYPE portfolio_status_enum AS ENUM ('active', 'watchlist', 'exited');
    CREATE TYPE transaction_type_enum AS ENUM ('entry', 'tp1_hit', 'tp2_hit', 'tp3_hit', 'sl_hit', 'dca', 'rebalance');

    -- portfolio_coins
    CREATE TABLE IF NOT EXISTS portfolio_coins (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL UNIQUE,
        entry_price NUMERIC(20, 8) NOT NULL,
        current_price NUMERIC(20, 8),
        price_movement_at_entry NUMERIC(8, 4),
        status portfolio_status_enum DEFAULT 'watchlist',
        signal_classification VARCHAR(20) DEFAULT 'TACTICAL',
        cex_listings TEXT,
        allocated_budget NUMERIC(12, 2) DEFAULT 0,
        tp1 NUMERIC(20, 8),
        tp2 NUMERIC(20, 8),
        tp3 NUMERIC(20, 8),
        stop_loss NUMERIC(20, 8),
        quality_score INTEGER DEFAULT 0,
        project_profile JSONB,
        technical_analysis JSONB,
        telegram_post_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    -- telegram_portfolio_posts
    CREATE TABLE IF NOT EXISTS telegram_portfolio_posts (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(50) NOT NULL UNIQUE,
        content TEXT,
        image_url TEXT,
        is_analyzed BOOLEAN DEFAULT FALSE,
        extracted_symbols TEXT,
        analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- portfolio_transactions
    CREATE TABLE IF NOT EXISTS portfolio_transactions (
        id SERIAL PRIMARY KEY,
        coin_id INTEGER NOT NULL REFERENCES portfolio_coins(id) ON DELETE CASCADE,
        type transaction_type_enum NOT NULL,
        price NUMERIC(20, 8) NOT NULL,
        amount NUMERIC(12, 2),
        pnl NUMERIC(12, 2),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- portfolio_snapshots
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id SERIAL PRIMARY KEY,
        total_budget NUMERIC(12, 2) NOT NULL,
        current_value NUMERIC(12, 2) NOT NULL,
        total_pnl NUMERIC(12, 2) NOT NULL,
        total_pnl_percent NUMERIC(8, 4) NOT NULL,
        active_coins INTEGER DEFAULT 0,
        watchlist_coins INTEGER DEFAULT 0,
        max_drawdown_percent NUMERIC(8, 4) DEFAULT 0,
        snapshot_at TIMESTAMP DEFAULT NOW()
    );

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('scorecard_tables', NOW());
END $$;