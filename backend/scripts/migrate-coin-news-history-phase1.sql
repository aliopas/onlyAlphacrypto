-- Migration: Phase 1A - Expand coin_news_history schema with 18 new nullable columns
-- UP migration
ALTER TABLE coin_news_history ADD COLUMN source_hash varchar(64) NULL;
ALTER TABLE coin_news_history ADD COLUMN event_scope varchar(20) NULL;
ALTER TABLE coin_news_history ADD COLUMN btc_price_at_event real NULL;
ALTER TABLE coin_news_history ADD COLUMN eth_price_at_event real NULL;
ALTER TABLE coin_news_history ADD COLUMN fear_greed_at_event integer NULL;
ALTER TABLE coin_news_history ADD COLUMN price_1h_after real NULL;
ALTER TABLE coin_news_history ADD COLUMN price_4h_after real NULL;
ALTER TABLE coin_news_history ADD COLUMN price_24h_after real NULL;
ALTER TABLE coin_news_history ADD COLUMN price_3d_after real NULL;
ALTER TABLE coin_news_history ADD COLUMN change_1h real NULL;
ALTER TABLE coin_news_history ADD COLUMN change_4h real NULL;
ALTER TABLE coin_news_history ADD COLUMN change_24h real NULL;
ALTER TABLE coin_news_history ADD COLUMN change_3d real NULL;
ALTER TABLE coin_news_history ADD COLUMN max_upside_after_event real NULL;
ALTER TABLE coin_news_history ADD COLUMN max_drawdown_after_event real NULL;
ALTER TABLE coin_news_history ADD COLUMN time_to_peak_hours integer NULL;
ALTER TABLE coin_news_history ADD COLUMN time_to_bottom_hours integer NULL;
ALTER TABLE coin_news_history ADD COLUMN outcome_classification varchar(30) NULL;
CREATE UNIQUE INDEX idx_cnh_sourcehash ON coin_news_history (source_hash) WHERE source_hash IS NOT NULL;

-- Rollback migration
-- DROP INDEX IF EXISTS idx_cnh_sourcehash;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS source_hash;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS event_scope;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS btc_price_at_event;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS eth_price_at_event;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS fear_greed_at_event;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_1h_after;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_4h_after;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_24h_after;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_3d_after;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_1h;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_4h;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_24h;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_3d;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_upside_after_event;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS max_drawdown_after_event;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_peak_hours;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS time_to_bottom_hours;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS outcome_classification;