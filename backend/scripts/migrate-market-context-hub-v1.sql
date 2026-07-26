-- Migration: DEC-043 B1 — Market Context Hub v1 (Blog/Content Hub schema extend)
-- Extends market_context_snapshots + market_news_items only (no blog_* tables)
-- Guarded by migration_flags.flag_name = 'market_context_hub_v1'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_hub_v1') THEN
        RAISE NOTICE 'market_context_hub_v1 migration already executed. Skipping.';
        RETURN;
    END IF;

    -- Ensure pgvector available for embedding column
    CREATE EXTENSION IF NOT EXISTS vector;

    -- ── market_context_snapshots hub columns ────────────────────────────────
    ALTER TABLE market_context_snapshots
        ADD COLUMN IF NOT EXISTS symbol TEXT;

    ALTER TABLE market_context_snapshots
        ADD COLUMN IF NOT EXISTS seo_meta JSONB;

    ALTER TABLE market_context_snapshots
        ADD COLUMN IF NOT EXISTS auto_published BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE market_context_snapshots
        ADD COLUMN IF NOT EXISTS seo_score JSONB;

    CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_symbol
        ON market_context_snapshots (symbol);

    -- At most one published coin page per symbol
    CREATE UNIQUE INDEX IF NOT EXISTS uq_market_context_snapshots_published_coin
        ON market_context_snapshots (symbol)
        WHERE status = 'published' AND kind = 'coin' AND symbol IS NOT NULL;

    -- ── market_news_items triage + embedding (symbols already exists) ───────
    ALTER TABLE market_news_items
        ADD COLUMN IF NOT EXISTS event_severity SMALLINT;

    ALTER TABLE market_news_items
        ADD COLUMN IF NOT EXISTS relevance_score SMALLINT;

    ALTER TABLE market_news_items
        ADD COLUMN IF NOT EXISTS classification TEXT;

    ALTER TABLE market_news_items
        ADD COLUMN IF NOT EXISTS embedding vector(1536);

    CREATE INDEX IF NOT EXISTS idx_market_news_items_trust_severity
        ON market_news_items (trust, event_severity);

    CREATE INDEX IF NOT EXISTS idx_market_news_items_classification
        ON market_news_items (classification);

    -- JSONB containment for coin symbol lookups (e.g. symbols @> '["BTC"]')
    CREATE INDEX IF NOT EXISTS idx_market_news_items_symbols_gin
        ON market_news_items USING GIN (symbols);

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_hub_v1', NOW());

    RAISE NOTICE 'market_context_hub_v1 migration complete.';
END $$;
