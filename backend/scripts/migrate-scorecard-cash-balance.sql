-- Migration: HF-MODEL-PORTFOLIO-001 — Cash balance column on portfolio_snapshots
-- Guarded by migration_flags

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'scorecard_cash_balance_column') THEN
        RAISE NOTICE 'scorecard_cash_balance_column migration already executed. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE portfolio_snapshots
        ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(12, 2) DEFAULT 0;

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('scorecard_cash_balance_column', NOW());
END $$;
