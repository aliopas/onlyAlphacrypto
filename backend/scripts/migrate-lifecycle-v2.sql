-- Phase C: Intelligent Signal Lifecycle Engine (DEC-031)
-- Adds multi-TP support (tp2_price, tp3_price, tp2_hit_at, tp3_hit_at)
-- and lifecycle_actions_log JSONB audit trail

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'lifecycle_v2_columns') THEN
        RAISE NOTICE 'migration_lifecycle_v2_columns already executed. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE signal_performance
        ADD COLUMN IF NOT EXISTS tp2_price REAL,
        ADD COLUMN IF NOT EXISTS tp3_price REAL,
        ADD COLUMN IF NOT EXISTS tp2_hit_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS tp3_hit_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS lifecycle_actions_log JSONB DEFAULT '[]'::jsonb;

    UPDATE signal_performance
    SET close_reason = 'THESIS_INVALIDATED'
    WHERE close_reason = 'THESIS_REVERSED';

    INSERT INTO migration_flags (flag_name, executed_at)
    VALUES ('lifecycle_v2_columns', NOW())
    ON CONFLICT (flag_name) DO NOTHING;
END
$$;

COMMIT;