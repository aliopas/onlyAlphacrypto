-- Migration: T-V2-5A — Signal Lifecycle Columns
-- Adds migration guard only; columns already defined in market.model.ts (signalState, price72h, pnl72h, isWin72h, partialTpHitAt, breakevenMovedAt, closeReason)
-- Only adds columns if they don't already exist in signal_performance

INSERT INTO migration_flags VALUES ('signal_lifecycle_schema') ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'signal_state') THEN
        ALTER TABLE signal_performance ADD COLUMN signal_state VARCHAR(30) DEFAULT 'NEW';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'price_72h') THEN
        ALTER TABLE signal_performance ADD COLUMN price_72h REAL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'pnl_72h') THEN
        ALTER TABLE signal_performance ADD COLUMN pnl_72h REAL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'is_win_72h') THEN
        ALTER TABLE signal_performance ADD COLUMN is_win_72h BOOLEAN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'partial_tp_hit_at') THEN
        ALTER TABLE signal_performance ADD COLUMN partial_tp_hit_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'breakeven_moved_at') THEN
        ALTER TABLE signal_performance ADD COLUMN breakeven_moved_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'close_reason') THEN
        ALTER TABLE signal_performance ADD COLUMN close_reason VARCHAR(50);
    END IF;
END $$;