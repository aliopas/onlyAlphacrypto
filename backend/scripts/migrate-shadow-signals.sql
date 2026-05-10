-- Migration: Add shadow_signals table for Phase 0.5 Shadow Mode
-- Guard against duplicate execution using migration_flags table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'shadow_signals_table') THEN
        CREATE TABLE shadow_signals (
            id                  SERIAL PRIMARY KEY,
            coin_symbol         VARCHAR(20) NOT NULL,
            algorithm_verdict   VARCHAR(20) NOT NULL,
            ai_verdict          VARCHAR(20) NOT NULL,
            algorithm_entry     REAL NOT NULL,
            ai_entry            REAL NOT NULL,
            algorithm_tp       REAL,
            algorithm_sl       REAL,
            ai_tp              REAL,
            ai_sl              REAL,
            quality_score      INT,
            trend_context      VARCHAR(20),
            agreement          BOOLEAN NOT NULL DEFAULT false,
            price_72h          REAL,
            price_7d           REAL,
            algorithm_pnl_72h  REAL,
            ai_pnl_72h         REAL,
            algorithm_win_72h  BOOLEAN,
            ai_win_72h         BOOLEAN,
            algorithm_pnl_7d   REAL,
            ai_pnl_7d          REAL,
            algorithm_win_7d   BOOLEAN,
            ai_win_7d          BOOLEAN,
            winner             VARCHAR(20),
            created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
            resolved_at        TIMESTAMP
        );

        CREATE INDEX idx_shadow_signals_coin ON shadow_signals(coin_symbol);
        CREATE INDEX idx_shadow_signals_created ON shadow_signals(created_at);
        CREATE INDEX idx_shadow_signals_unresolved ON shadow_signals(resolved_at);

        INSERT INTO migration_flags (flag_name) VALUES ('shadow_signals_table');
    END IF;
END $$;