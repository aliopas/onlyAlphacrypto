-- Hotfix: Cleanup Non-Tracked Coin Data
-- Date: May 2026
-- Idempotent: guarded by migration_flags
-- QA Fix: corrected column names (camelCase for scenario tables) + added market_scenarios + shadow_signals

BEGIN;

-- Guard: Check if already run
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'cleanup_non_tracked_coins') THEN
        RAISE NOTICE 'Cleanup already executed. Skipping.';
        ROLLBACK;
        RETURN;
    END IF;
END $$;

-- Step 1: Count rows to be deleted (for logging)
DO $$
DECLARE
    cnh_count BIGINT;
    ei_count BIGINT;
    ms_count BIGINT;
    sho_count BIGINT;
    ss_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO cnh_count FROM coin_news_history
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'coin_news_history rows to delete: %', cnh_count;

    SELECT COUNT(*) INTO ei_count FROM event_impacts
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'event_impacts rows to delete: %', ei_count;

    SELECT COUNT(*) INTO ms_count FROM market_scenarios
        WHERE "coinSymbol" NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'market_scenarios rows to delete: %', ms_count;

    SELECT COUNT(*) INTO sho_count FROM scenario_horizon_outcomes
        WHERE "coinSymbol" NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'scenario_horizon_outcomes rows to delete: %', sho_count;

    SELECT COUNT(*) INTO ss_count FROM shadow_signals
        WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');
    RAISE NOTICE 'shadow_signals rows to delete: %', ss_count;
END $$;

-- Step 2: Delete stale rows from coin_news_history (snake_case column)
DELETE FROM coin_news_history
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 3: Delete stale rows from event_impacts (snake_case column)
-- event_impact_outcomes rows are auto-deleted via ON DELETE CASCADE FK
DELETE FROM event_impacts
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 4: Delete stale rows from market_scenarios (camelCase column)
-- scenario_horizon_outcomes + scenario_status_history rows are auto-deleted via ON DELETE CASCADE FK
DELETE FROM market_scenarios
WHERE "coinSymbol" NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 5: Delete stale rows from scenario_horizon_outcomes (camelCase column)
-- Covers orphaned rows where parent scenario was already deleted
DELETE FROM scenario_horizon_outcomes
WHERE "coinSymbol" NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 6: Delete stale rows from shadow_signals (snake_case column)
DELETE FROM shadow_signals
WHERE coin_symbol NOT IN ('BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','SUI','TON');

-- Step 7: Record migration flag
INSERT INTO migration_flags (flag_name) VALUES ('cleanup_non_tracked_coins');

COMMIT;