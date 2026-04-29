-- Phase 21: Multi-Timeframe Signal System
-- Add active/closed tracking to signal_performance

ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS exit_price REAL;
ALTER TABLE signal_performance ADD COLUMN IF NOT EXISTS realized_pnl REAL;

-- Index for finding active signals per coin (partial index — only WHERE is_active = true)
CREATE INDEX IF NOT EXISTS idx_signal_perf_active ON signal_performance(coin_symbol, is_active) WHERE is_active = true;

-- Backfill existing rows: mark all current rows as active
UPDATE signal_performance SET is_active = true WHERE is_active IS NULL;
