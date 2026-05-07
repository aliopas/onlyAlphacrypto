INSERT INTO migration_flags (flag_name) VALUES ('ohlcv_tables') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ohlcv_candles (
    id                  SERIAL PRIMARY KEY,
    coin_symbol         VARCHAR(20)    NOT NULL,
    timeframe           VARCHAR(5)     NOT NULL,  -- '4h', '1d', '1w'
    open_time           TIMESTAMP      NOT NULL,
    open                REAL           NOT NULL,
    high                REAL           NOT NULL,
    low                 REAL           NOT NULL,
    close               REAL           NOT NULL,
    volume              REAL           NOT NULL,
    close_time          TIMESTAMP      NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ohlcv_candles_unique ON ohlcv_candles(coin_symbol, timeframe, open_time);
CREATE INDEX IF NOT EXISTS ohlcv_candles_range ON ohlcv_candles(coin_symbol, timeframe, open_time DESC);

CREATE TABLE IF NOT EXISTS ohlcv_indicators (
    id                  SERIAL PRIMARY KEY,
    coin_symbol         VARCHAR(20)    NOT NULL,
    timeframe           VARCHAR(5)     NOT NULL,
    open_time           TIMESTAMP      NOT NULL,
    ema_20              REAL,
    ema_50              REAL,
    ema_200             REAL,
    atr_14              REAL,
    volume_avg_20       REAL,
    computed_at         TIMESTAMP      DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ohlcv_indicators_unique ON ohlcv_indicators(coin_symbol, timeframe, open_time);

-- Mark migration as executed
INSERT INTO migration_flags (flag_name, executed_at) VALUES ('ohlcv_tables', NOW());