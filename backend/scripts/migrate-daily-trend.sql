-- Migration: T-V2-71A — Daily Trend Column
-- Adds daily_trend column to coin_intelligence_cache

INSERT INTO migration_flags VALUES ('daily_trend_column') ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_intelligence_cache' AND column_name = 'daily_trend') THEN
        ALTER TABLE coin_intelligence_cache ADD COLUMN daily_trend VARCHAR(20) DEFAULT 'SIDEWAYS';
    END IF;
END $$;