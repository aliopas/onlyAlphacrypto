-- Cleanup: Classify stale coin_news_history rows for non-TRACKED coins
-- These rows will never be processed by EventOutcomeChecker (filtered by TRACKED_COINS)
-- Set outcome_classification = 'skipped_untracked' so they stop appearing in queries

UPDATE coin_news_history
SET outcome_classification = 'neutral'
WHERE outcome_classification IS NULL
  AND coin_symbol NOT IN ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON');

-- Verify: count remaining unclassified rows (should only be TRACKED coins)
SELECT coin_symbol, COUNT(*) as remaining
FROM coin_news_history
WHERE outcome_classification IS NULL
GROUP BY coin_symbol
ORDER BY coin_symbol;
