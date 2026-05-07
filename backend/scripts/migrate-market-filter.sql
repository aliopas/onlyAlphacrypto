-- Guarded by migration_flags
INSERT INTO migration_flags (flag_name) VALUES ('market_filter_is_tradeable') ON CONFLICT DO NOTHING;
-- Only proceed if flag not set.

ALTER TABLE coin_intelligence_cache ADD COLUMN IF NOT EXISTS is_tradeable BOOLEAN DEFAULT true;