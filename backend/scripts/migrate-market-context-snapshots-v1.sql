-- Migration: MC-3 — Market Context Snapshots (DEC-040)
-- Table: market_context_snapshots
-- Guarded by migration_flags.flag_name = 'market_context_snapshots_v1'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_snapshots_v1') THEN
        RAISE NOTICE 'market_context_snapshots_v1 migration already executed. Skipping.';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_context_snapshot_status') THEN
        CREATE TYPE market_context_snapshot_status AS ENUM ('draft', 'published', 'archived');
    END IF;

    CREATE TABLE IF NOT EXISTS market_context_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_key VARCHAR(100) NOT NULL,
        kind VARCHAR(50) NOT NULL DEFAULT 'weekly',
        week_label VARCHAR(20),
        status market_context_snapshot_status NOT NULL DEFAULT 'draft',
        sections JSONB NOT NULL DEFAULT '{}'::jsonb,
        news_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        market_data_version VARCHAR(100),
        generator_version VARCHAR(50) NOT NULL DEFAULT 'MC-v1',
        generated_at TIMESTAMP,
        published_at TIMESTAMP,
        created_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT market_context_snapshots_key_unique UNIQUE (snapshot_key)
    );

    CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_status
        ON market_context_snapshots (status);

    CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_kind
        ON market_context_snapshots (kind);

    CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_generated_at
        ON market_context_snapshots (generated_at DESC NULLS LAST);

    INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_snapshots_v1', NOW());
END $$;
