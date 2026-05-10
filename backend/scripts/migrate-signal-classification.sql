-- Phase 3: Signal Classification System
-- Add classification fields to radar_signals and signal_performance

-- Guard: prevent re-runs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'signal_classification_schema') THEN
        RAISE NOTICE 'Migration already applied. Skipping.';
        RETURN;
    END IF;

    -- ============================================================
    -- radar_signals: add classification fields
    -- ============================================================
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS signal_type VARCHAR(20);
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS horizon_days INT;
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS quality_score INT;
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS trend_context VARCHAR(20);
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS entry_zone_low REAL;
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS entry_zone_high REAL;
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS invalidation_level REAL;
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS invalidation_reason TEXT;

    -- ============================================================
    -- signal_performance: add outcome tracking fields
    -- ============================================================
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS signal_state VARCHAR(30) DEFAULT 'NEW';
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS price72h REAL;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS pnl72h REAL;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS is_win72h BOOLEAN;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS partial_tp_hit_at TIMESTAMP;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS breakeven_moved_at TIMESTAMP;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS close_reason VARCHAR(50);

    -- Record migration flag
    INSERT INTO migration_flags (flag_name) VALUES ('signal_classification_schema');
END $$;

-- Rollback:
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS signal_type;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS horizon_days;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS quality_score;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS trend_context;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS entry_zone_low;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS entry_zone_high;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS invalidation_level;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS invalidation_reason;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS signal_state;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS price72h;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS pnl72h;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS is_win72h;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS partial_tp_hit_at;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS breakeven_moved_at;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS close_reason;
-- DELETE FROM migration_flags WHERE flag_name = 'signal_classification_schema';