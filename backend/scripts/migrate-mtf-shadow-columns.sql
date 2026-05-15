-- Migration: Add MTF context columns to shadow_signals for Phase B
-- Guard against duplicate execution using migration_flags table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'mtf_shadow_columns') THEN
        ALTER TABLE shadow_signals ADD COLUMN IF NOT EXISTS mtf_confluence_score INTEGER;
        ALTER TABLE shadow_signals ADD COLUMN IF NOT EXISTS mtf_trend_alignment VARCHAR(20);
        ALTER TABLE shadow_signals ADD COLUMN IF NOT EXISTS mtf_dominant_trend VARCHAR(20);

        INSERT INTO migration_flags (flag_name) VALUES ('mtf_shadow_columns')
        ON CONFLICT (flag_name) DO NOTHING;
    END IF;
END $$;