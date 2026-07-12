-- Migrate tracked coin symbol TON -> GRAM (Toncoin rebrand)
-- Safe to re-run: only updates rows still labeled TON.

BEGIN;

UPDATE coin_news SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE radar_signals SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE signal_performance SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE market_insights SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_news_history SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_memory SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_intelligence_cache SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_master_articles SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_timeline_updates SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE coin_strategic_outlook SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE ohlcv_candles SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE ohlcv_indicators SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE price_snapshots SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE level_intelligence SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE market_scenarios SET coinsymbol = 'GRAM' WHERE coinsymbol = 'TON';
UPDATE smart_event_responses SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE daily_alpha_focus SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE shadow_signals SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';
UPDATE event_impacts SET coin_symbol = 'GRAM' WHERE coin_symbol = 'TON';

COMMIT;
