-- Migration: HF-MODEL-PORTFOLIO-001 — Add manual_close to transaction_type_enum
-- Guarded by migration_flags

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'scorecard_manual_close_enum') THEN
        RAISE NOTICE 'scorecard_manual_close_enum migration already executed. Skipping.';
        RETURN;
    END IF;

    ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'manual_close';

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('scorecard_manual_close_enum', NOW());
END $$;
