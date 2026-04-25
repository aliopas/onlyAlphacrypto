-- Phase 18: Signal P&L Tracker
CREATE TABLE IF NOT EXISTS signal_performance (
    id SERIAL PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES radar_signals(id),
    coin_symbol VARCHAR(20) NOT NULL,
    verdict VARCHAR(20) NOT NULL,
    sentiment VARCHAR(20),
    entry_price REAL NOT NULL,
    entry_at TIMESTAMP NOT NULL,
    price_24h REAL,
    price_7d REAL,
    price_30d REAL,
    pnl_24h REAL,
    pnl_7d REAL,
    pnl_30d REAL,
    is_win_7d BOOLEAN,
    is_win_30d BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signal_perf_symbol ON signal_performance(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_signal_perf_entry ON signal_performance(entry_at);
