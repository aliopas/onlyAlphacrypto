-- Migration: MC-1 — Market Context News Data Layer (DEC-040)
-- Tables: market_news_items, market_telegram_channels
-- Guarded by migration_flags.flag_name = 'market_context_v1'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_v1') THEN
        RAISE NOTICE 'market_context_v1 migration already executed. Skipping.';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_news_source_type') THEN
        CREATE TYPE market_news_source_type AS ENUM ('terminal', 'rss', 'telegram', 'manual');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_news_trust') THEN
        CREATE TYPE market_news_trust AS ENUM ('pending', 'trusted', 'rejected');
    END IF;

    CREATE TABLE IF NOT EXISTS market_news_items (
        id SERIAL PRIMARY KEY,
        source_type market_news_source_type NOT NULL,
        external_id VARCHAR(255),
        source_hash VARCHAR(64) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        url VARCHAR(1000),
        source_name VARCHAR(255),
        published_at TIMESTAMP,
        symbols JSONB DEFAULT '[]'::jsonb,
        trust market_news_trust NOT NULL DEFAULT 'pending',
        trust_note TEXT,
        raw_ref JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT market_news_items_source_hash_unique UNIQUE (source_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_market_news_items_trust
        ON market_news_items (trust);

    CREATE INDEX IF NOT EXISTS idx_market_news_items_published_at
        ON market_news_items (published_at DESC NULLS LAST);

    CREATE INDEX IF NOT EXISTS idx_market_news_items_source_type
        ON market_news_items (source_type);

    CREATE TABLE IF NOT EXISTS market_telegram_channels (
        id SERIAL PRIMARY KEY,
        username_or_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_cursor VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT market_telegram_channels_username_unique UNIQUE (username_or_id)
    );

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_v1', NOW());
END $$;
