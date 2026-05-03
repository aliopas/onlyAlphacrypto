-- Migration: Phase 2A - Add 7d temporal outcome support to coin_news_history
-- UP migration
ALTER TABLE coin_news_history ADD COLUMN IF NOT EXISTS price_7d_after real NULL;
ALTER TABLE coin_news_history ADD COLUMN IF NOT EXISTS change_7d real NULL;

-- Rollback migration
-- WARNING: price_7d_after may be legacy/pre-existing. Only drop it if verified safe.
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS change_7d;
-- ALTER TABLE coin_news_history DROP COLUMN IF EXISTS price_7d_after;