-- Phase 2: Market Regime Detection System
-- Add currentRegime field to coinIntelligenceCache

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'market_regime_schema') THEN
        RAISE NOTICE 'Migration already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE coin_intelligence_cache ADD COLUMN IF NOT EXISTS current_regime VARCHAR(20);

    INSERT INTO migration_flags (flag_name) VALUES ('market_regime_schema');
END $$;

-- Rollback:
-- ALTER TABLE coin_intelligence_cache DROP COLUMN IF EXISTS current_regime;
-- DELETE FROM migration_flags WHERE flag_name = 'market_regime_schema';