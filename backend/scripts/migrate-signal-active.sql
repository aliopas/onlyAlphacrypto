-- Phase 21: Multi-Timeframe Signal System
-- Add active/closed tracking to signal_performance

ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS exit_price REAL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS realized_pnl REAL;

-- Index for finding active signals per coin (partial index — only WHERE is_active = true)
CREATE INDEX IF NOT EXISTS idx_signal_perf_active ON signal_performance(coin_symbol, is_active) WHERE is_active = true;

-- Backfill existing rows: mark all current rows as active first
UPDATE signal_performance SET is_active = true WHERE is_active IS NULL;

-- ============================================================
-- DATA RECONCILIATION: Fix duplicate signals per coin
-- Logic: For each coin with multiple signals, keep the LATEST
-- as active. Close older signals with exit_price = next signal's
-- entry_price and realized_pnl calculated.
--
-- Example: BTC has 8 signals. After this:
--   Signal 1-7: is_active=false, exit_price=next signal's entry, realized_pnl=calculated
--   Signal 8:   is_active=true (the latest stays active)
--
-- P&L direction logic:
--   BUY/STRONG_BUY: pnl = (exit - entry) / entry * 100
--   SELL/STRONG_SELL: pnl = (entry - exit) / entry * 100
-- ============================================================

UPDATE signal_performance sp
SET
    is_active = false,
    exit_price = next_sp.entry_price,
    closed_at = next_sp.entry_at,
    realized_pnl = CASE
        WHEN sp.verdict IN ('BUY', 'STRONG_BUY') THEN
            ROUND(CAST(((next_sp.entry_price - sp.entry_price) / sp.entry_price) * 100 AS numeric), 2)
        WHEN sp.verdict IN ('SELL', 'STRONG_SELL') THEN
            ROUND(CAST(((sp.entry_price - next_sp.entry_price) / sp.entry_price) * 100 AS numeric), 2)
        ELSE 0
    END
FROM (
    SELECT
        sp1.id AS current_id,
        MIN(sp2.id) AS next_id
    FROM signal_performance sp1
    INNER JOIN signal_performance sp2
        ON sp1.coin_symbol = sp2.coin_symbol
        AND sp2.id > sp1.id
    GROUP BY sp1.id
) AS chain
INNER JOIN signal_performance next_sp
    ON next_sp.id = chain.next_id
WHERE sp.id = chain.current_id;

-- VERIFY: Should return 0 rows (no duplicates remaining)
-- SELECT coin_symbol, COUNT(*) FROM signal_performance WHERE is_active = true GROUP BY coin_symbol HAVING COUNT(*) > 1;
