-- Migration: Add partial index on shadow_signals for unresolved signals query
-- Guards against duplicate execution using migration_flags table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'shadow_signals_resolution_partial_idx') THEN

        CREATE INDEX IF NOT EXISTS idx_shadow_signals_unresolved_partial
            ON shadow_signals (coin_symbol, created_at)
            WHERE price_7d IS NULL;

        INSERT INTO migration_flags (flag_name) VALUES ('shadow_signals_resolution_partial_idx');
    END IF;
END $$;