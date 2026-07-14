-- migrate-scorecard-investment-mode.sql
-- Guarded migration for Model Portfolio Rebuild (T0)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM migration_flags WHERE flag_name = 'scorecard_investment_mode_v1'
    ) THEN
        -- Add all investment-mode columns (idempotent)
        ALTER TABLE portfolio_coins
            ADD COLUMN IF NOT EXISTS direction varchar(10),
            ADD COLUMN IF NOT EXISTS posted_entry_price numeric(20,8),
            ADD COLUMN IF NOT EXISTS average_entry_price numeric(20,8),
            ADD COLUMN IF NOT EXISTS initial_budget numeric(12,2),
            ADD COLUMN IF NOT EXISTS dca_budget numeric(12,2) DEFAULT '0',
            ADD COLUMN IF NOT EXISTS remaining_size_frac numeric(5,4) DEFAULT '1',
            ADD COLUMN IF NOT EXISTS dca_filled boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS tp1_hit boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS tp2_hit boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS tp3_hit boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS realized_pnl numeric(12,2) DEFAULT '0',
            ADD COLUMN IF NOT EXISTS exit_price numeric(20,8),
            ADD COLUMN IF NOT EXISTS exited_at timestamp,
            ADD COLUMN IF NOT EXISTS exit_reason varchar(30);

        -- Backfill defaults for existing rows
        UPDATE portfolio_coins
        SET
            posted_entry_price = COALESCE(posted_entry_price, entry_price),
            average_entry_price = COALESCE(average_entry_price, entry_price),
            remaining_size_frac = COALESCE(remaining_size_frac, 1),
            dca_filled = COALESCE(dca_filled, false),
            tp1_hit = COALESCE(tp1_hit, false),
            tp2_hit = COALESCE(tp2_hit, false),
            tp3_hit = COALESCE(tp3_hit, false),
            realized_pnl = COALESCE(realized_pnl, 0),
            dca_budget = COALESCE(dca_budget, 0);

        -- Record migration flag
        INSERT INTO migration_flags (flag_name, executed_at)
        VALUES ('scorecard_investment_mode_v1', NOW());
    END IF;
END $$;