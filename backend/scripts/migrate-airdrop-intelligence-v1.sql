-- Migration: AD-0 — Airdrop Intelligence schema (DEC-041)
-- Tables: content_sources, airdrop_entities, airdrop_entity_aliases,
--         airdrop_signals, airdrop_evidence_artifacts, airdrop_mood_snapshots
-- Extends: airdrop_projects (entity_id, pipeline_status, publish_path, provenance_summary)
-- Guarded by migration_flags.flag_name = 'airdrop_intelligence_v1'

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_flags WHERE flag_name = 'airdrop_intelligence_v1') THEN
        RAISE NOTICE 'airdrop_intelligence_v1 migration already executed. Skipping.';
        RETURN;
    END IF;

    -- ─── Enums ───────────────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_source_kind') THEN
        CREATE TYPE content_source_kind AS ENUM ('telegram', 'rss', 'system');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_source_purpose') THEN
        CREATE TYPE content_source_purpose AS ENUM (
            'airdrop_alpha',
            'airdrop_community',
            'news',
            'market_context'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_alias_source') THEN
        CREATE TYPE airdrop_alias_source AS ENUM ('ingest', 'admin', 'ai');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_pipeline_status') THEN
        CREATE TYPE airdrop_pipeline_status AS ENUM (
            'discovering',
            'hold_recheck',
            'rejected',
            'active',
            'archived'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_publish_path') THEN
        CREATE TYPE airdrop_publish_path AS ENUM (
            'none',
            'auto_publish',
            'hold_recheck',
            'reject',
            'admin_force'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_evidence_fetch_status') THEN
        CREATE TYPE airdrop_evidence_fetch_status AS ENUM (
            'pending',
            'ok',
            'failed',
            'skipped'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_mood_window') THEN
        CREATE TYPE airdrop_mood_window AS ENUM ('24h', '7d');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_mood_label') THEN
        CREATE TYPE airdrop_mood_label AS ENUM ('cold', 'warming', 'hot', 'toxic');
    END IF;

    -- ─── content_sources ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS content_sources (
        id SERIAL PRIMARY KEY,
        kind content_source_kind NOT NULL,
        purpose content_source_purpose NOT NULL,
        identifier VARCHAR(500) NOT NULL,
        title VARCHAR(255),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_cursor VARCHAR(100),
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT content_sources_kind_identifier_unique UNIQUE (kind, identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_content_sources_purpose
        ON content_sources (purpose);
    CREATE INDEX IF NOT EXISTS idx_content_sources_enabled
        ON content_sources (enabled);
    CREATE INDEX IF NOT EXISTS idx_content_sources_kind_purpose
        ON content_sources (kind, purpose);

    -- ─── airdrop_entities ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS airdrop_entities (
        id SERIAL PRIMARY KEY,
        canonical_name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        defillama_slug VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT airdrop_entities_slug_unique UNIQUE (slug)
    );

    CREATE INDEX IF NOT EXISTS idx_airdrop_entities_defillama_slug
        ON airdrop_entities (defillama_slug);

    -- ─── airdrop_entity_aliases ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS airdrop_entity_aliases (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES airdrop_entities(id) ON DELETE CASCADE,
        alias VARCHAR(255) NOT NULL,
        normalized_alias VARCHAR(255) NOT NULL,
        source airdrop_alias_source NOT NULL DEFAULT 'ingest',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT airdrop_entity_aliases_normalized_unique UNIQUE (normalized_alias)
    );

    CREATE INDEX IF NOT EXISTS idx_airdrop_entity_aliases_entity_id
        ON airdrop_entity_aliases (entity_id);

    -- ─── airdrop_signals ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS airdrop_signals (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER REFERENCES airdrop_entities(id) ON DELETE SET NULL,
        source_id INTEGER REFERENCES content_sources(id) ON DELETE SET NULL,
        source_hash VARCHAR(64) NOT NULL,
        external_id VARCHAR(255),
        title TEXT,
        body TEXT,
        url VARCHAR(1000),
        published_at TIMESTAMP,
        signal_kind VARCHAR(50),
        extracted_dates JSONB DEFAULT '[]'::jsonb,
        extracted_urls JSONB DEFAULT '[]'::jsonb,
        claims JSONB DEFAULT '[]'::jsonb,
        raw_ref JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT airdrop_signals_source_hash_unique UNIQUE (source_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_airdrop_signals_entity_id
        ON airdrop_signals (entity_id);
    CREATE INDEX IF NOT EXISTS idx_airdrop_signals_source_id
        ON airdrop_signals (source_id);
    CREATE INDEX IF NOT EXISTS idx_airdrop_signals_published_at
        ON airdrop_signals (published_at DESC NULLS LAST);

    -- ─── airdrop_evidence_artifacts ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS airdrop_evidence_artifacts (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER REFERENCES airdrop_entities(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES airdrop_projects(id) ON DELETE SET NULL,
        signal_id INTEGER REFERENCES airdrop_signals(id) ON DELETE SET NULL,
        artifact_type VARCHAR(50) NOT NULL,
        url VARCHAR(1000),
        title TEXT,
        content_text TEXT,
        fetch_status airdrop_evidence_fetch_status NOT NULL DEFAULT 'pending',
        source_hash VARCHAR(64),
        provenance JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_entity_id
        ON airdrop_evidence_artifacts (entity_id);
    CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_project_id
        ON airdrop_evidence_artifacts (project_id);
    CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_fetch_status
        ON airdrop_evidence_artifacts (fetch_status);
    CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_source_hash
        ON airdrop_evidence_artifacts (source_hash);

    -- ─── airdrop_mood_snapshots ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS airdrop_mood_snapshots (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES airdrop_entities(id) ON DELETE CASCADE,
        mood_window airdrop_mood_window NOT NULL,
        mention_count INTEGER NOT NULL DEFAULT 0,
        unique_source_count INTEGER NOT NULL DEFAULT 0,
        hype_score REAL NOT NULL DEFAULT 0,
        fud_score REAL NOT NULL DEFAULT 0,
        date_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
        controversy_flag BOOLEAN NOT NULL DEFAULT FALSE,
        mood_label airdrop_mood_label NOT NULL DEFAULT 'cold',
        computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_airdrop_mood_entity_window
        ON airdrop_mood_snapshots (entity_id, mood_window);
    CREATE INDEX IF NOT EXISTS idx_airdrop_mood_computed_at
        ON airdrop_mood_snapshots (computed_at DESC);

    -- ─── Extend airdrop_projects ─────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'entity_id'
    ) THEN
        ALTER TABLE airdrop_projects
            ADD COLUMN entity_id INTEGER REFERENCES airdrop_entities(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'pipeline_status'
    ) THEN
        ALTER TABLE airdrop_projects
            ADD COLUMN pipeline_status airdrop_pipeline_status NOT NULL DEFAULT 'discovering';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'publish_path'
    ) THEN
        ALTER TABLE airdrop_projects
            ADD COLUMN publish_path airdrop_publish_path NOT NULL DEFAULT 'none';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'provenance_summary'
    ) THEN
        ALTER TABLE airdrop_projects
            ADD COLUMN provenance_summary JSONB DEFAULT '{}'::jsonb;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_entity_id
        ON airdrop_projects (entity_id);
    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_pipeline_status
        ON airdrop_projects (pipeline_status);
    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_publish_path
        ON airdrop_projects (publish_path);

    INSERT INTO migration_flags (flag_name, executed_at)
    VALUES ('airdrop_intelligence_v1', NOW());
END $$;
