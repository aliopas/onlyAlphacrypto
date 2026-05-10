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
    -- radar_signals: add classification + confidence
    -- ============================================================
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS classification VARCHAR(10);
    ALTER TABLE radar_signals ADD COLUMN IF NOT EXISTS confidence REAL;

    -- ============================================================
    -- signal_performance: add outcomeClassification + classificationConfidence
    -- ============================================================
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS outcome_classification outcome_classification;
    ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS classification_confidence REAL;

    -- Record migration flag
    INSERT INTO migration_flags (flag_name) VALUES ('signal_classification_schema');
END $$;

-- Rollback:
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS classification;
-- ALTER TABLE radar_signals DROP COLUMN IF EXISTS confidence;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS outcome_classification;
-- ALTER TABLE signal_performance DROP COLUMN IF EXISTS classification_confidence;
-- DELETE FROM migration_flags WHERE flag_name = 'signal_classification_schema';