-- Phase 23: TP/SL Auto-Close & Signal Lifecycle
-- Add stop-loss, take-profit, and auto-close reason columns to signal_performance

-- Add new columns
ALTER TABLE signal_performance
    ADD COLUMN IF NOT EXISTS stop_loss_price REAL,
    ADD COLUMN IF NOT EXISTS take_profit_price REAL,
    ADD COLUMN IF NOT EXISTS auto_closed_reason VARCHAR(20);

-- Create partial index for active signals with TP/SL set (optimizes TP/SL monitor queries)
CREATE INDEX IF NOT EXISTS idx_signal_perf_tpsl
    ON signal_performance (is_active, take_profit_price, stop_loss_price)
    WHERE is_active = true AND (take_profit_price IS NOT NULL OR stop_loss_price IS NOT NULL);

-- Backfill existing rows with default TP/SL values
-- BUY/STRONG_BUY: TP = entry_price * 1.15, SL = entry_price * 0.92
-- SELL/STRONG_SELL: TP = entry_price * 0.85, SL = entry_price * 1.08
UPDATE signal_performance
SET
    stop_loss_price = CASE
        WHEN verdict IN ('BUY', 'STRONG_BUY') THEN entry_price * 0.92
        WHEN verdict IN ('SELL', 'STRONG_SELL') THEN entry_price * 1.08
        ELSE NULL
    END,
    take_profit_price = CASE
        WHEN verdict IN ('BUY', 'STRONG_BUY') THEN entry_price * 1.15
        WHEN verdict IN ('SELL', 'STRONG_SELL') THEN entry_price * 0.85
        ELSE NULL
    END
WHERE (stop_loss_price IS NULL OR take_profit_price IS NULL)
  AND verdict IN ('BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL');
