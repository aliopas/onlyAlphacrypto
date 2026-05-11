-- ============================================================
-- OnlyAlpha — Comprehensive Cleanup: Non-Tracked Coin Data
-- Run ONCE on production database after deploy.
-- This removes ALL data for coins NOT in the 11 TRACKED_COINS:
--   BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, SUI, TON
-- ============================================================

-- Preview: count rows to be affected per table (run this first to review)
SELECT 'coin_news' AS table_name, COUNT(*) AS rows_to_clean FROM coin_news WHERE coin_symbol IS NOT NULL AND coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'radar_signals', COUNT(*) FROM radar_signals WHERE coin_symbol IS NOT NULL AND coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'signal_performance', COUNT(*) FROM signal_performance WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'market_insights', COUNT(*) FROM market_insights WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_news_history', COUNT(*) FROM coin_news_history WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_memory', COUNT(*) FROM coin_memory WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_intelligence_cache', COUNT(*) FROM coin_intelligence_cache WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_master_articles', COUNT(*) FROM coin_master_articles WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_timeline_updates', COUNT(*) FROM coin_timeline_updates WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'coin_strategic_outlook', COUNT(*) FROM coin_strategic_outlook WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'ohlcv_candles', COUNT(*) FROM ohlcv_candles WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'ohlcv_indicators', COUNT(*) FROM ohlcv_indicators WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'price_snapshots', COUNT(*) FROM price_snapshots WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'level_intelligence', COUNT(*) FROM level_intelligence WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'market_scenarios', COUNT(*) FROM market_scenarios WHERE coinsymbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'smart_event_responses', COUNT(*) FROM smart_event_responses WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'daily_alpha_focus', COUNT(*) FROM daily_alpha_focus WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'shadow_signals', COUNT(*) FROM shadow_signals WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON')
UNION ALL
SELECT 'event_impacts', COUNT(*) FROM event_impacts WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');

-- ============================================================
-- UNCOMMENT THE SECTION BELOW TO ACTUALLY DELETE DATA
-- ============================================================

-- BEGIN;

-- -- Tables with FK dependencies (delete children first)
-- DELETE FROM coin_timeline_updates WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM scenario_horizon_outcomes WHERE scenario_id IN (SELECT id FROM market_scenarios WHERE coinsymbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON'));
-- DELETE FROM level_interactions WHERE level_id IN (SELECT id FROM level_intelligence WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON'));
-- DELETE FROM event_impact_outcomes WHERE event_impact_id IN (SELECT id FROM event_impacts WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON'));

-- -- Main tables
-- DELETE FROM coin_news WHERE coin_symbol IS NOT NULL AND coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM radar_signals WHERE coin_symbol IS NOT NULL AND coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM signal_performance WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM market_insights WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM coin_news_history WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM coin_memory WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM coin_master_articles WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM coin_strategic_outlook WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM ohlcv_candles WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM ohlcv_indicators WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM price_snapshots WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM level_intelligence WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM market_scenarios WHERE coinsymbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM scenario_status_history WHERE scenario_id IN (SELECT id FROM market_scenarios WHERE coinsymbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON'));
-- DELETE FROM smart_event_responses WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM daily_alpha_focus WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM shadow_signals WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM event_impacts WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');
-- DELETE FROM coin_intelligence_cache WHERE coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');

-- COMMIT;
