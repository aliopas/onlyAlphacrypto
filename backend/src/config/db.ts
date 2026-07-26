import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import * as schema from '../models/index';
import { env } from './env';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
    console.error('❌ Unexpected PostgreSQL pool error:', err);
});

export const db = drizzle(pool, { schema });

async function registerPgvector(): Promise<void> {
    try {
        const pg = await import('pg');
        const result = await pool.query(
            "SELECT typname, oid FROM pg_type WHERE typname IN ('vector', 'halfvec', 'sparsevec')"
        );

        for (const row of result.rows as { typname: string; oid: number }[]) {
            pg.types.setTypeParser(row.oid, 'text', (value: string) => value);
        }

        console.log('✅ pgvector types registered');
    } catch (err) {
        console.warn('⚠️ pgvector not available — vector features disabled:', err instanceof Error ? err.message : String(err));
    }
}

async function ensurePgvectorExtension(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ pgvector extension ensured');
    } catch (err) {
        console.warn('⚠️ Could not create pgvector extension:', err instanceof Error ? err.message : String(err));
    } finally {
        client.release();
    }
}

async function pushSchema(): Promise<void> {
    try {
        console.log('📦 Syncing database schema...');
        const output = execSync('node ./node_modules/drizzle-kit/bin.cjs push --force', {
            cwd: process.cwd(),
            timeout: 120000,
            stdio: 'pipe',
            env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
        });
        if (output.toString().trim()) {
            console.log(output.toString().trim());
        }
        console.log('✅ Database schema synced');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ Schema sync failed:', msg);
        throw new Error(`Schema push failed: ${msg}`);
    }
}

export async function testConnection(): Promise<void> {
    await registerPgvector();

    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('✅ PostgreSQL connected successfully');
    } finally {
        client.release();
    }
}

async function runMigrations(): Promise<void> {
    const client = await pool.connect();
    try {
        const check = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_alpha_focus' AND column_name = 'master_article_id'"
        );

        if (check.rows.length === 0) {
            console.log('📦 Running alpha_focus migration (insight_id → master_article_id)...');

            await client.query('ALTER TABLE "daily_alpha_focus" DROP CONSTRAINT IF EXISTS "daily_alpha_focus_insight_id_market_insights_id_fk"');
            await client.query('ALTER TABLE "daily_alpha_focus" DROP COLUMN IF EXISTS "insight_id"');
            await client.query('ALTER TABLE "daily_alpha_focus" ADD COLUMN "master_article_id" integer');
            await client.query(
                'ALTER TABLE "daily_alpha_focus" ADD CONSTRAINT "daily_alpha_focus_master_article_id_coin_master_articles_id_fk" FOREIGN KEY ("master_article_id") REFERENCES "public"."coin_master_articles"("id") ON DELETE no action ON UPDATE no action'
            );
            await client.query('DELETE FROM "daily_alpha_focus" WHERE "master_article_id" IS NULL');
            await client.query('ALTER TABLE "daily_alpha_focus" ALTER COLUMN "master_article_id" SET NOT NULL');

            console.log('✅ Alpha focus migration complete');
        }

        const tpslCheck = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'signal_performance' AND column_name = 'stop_loss_price'"
        );

        if (tpslCheck.rows.length > 0) {
            const emptyTpsl = await client.query(
                "SELECT COUNT(*) as cnt FROM signal_performance WHERE stop_loss_price IS NULL AND verdict IN ('BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL')"
            );

            if (Number(emptyTpsl.rows[0].cnt) > 0) {
                console.log(`📦 Backfilling TP/SL for ${emptyTpsl.rows[0].cnt} signals...`);

                await client.query(`
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
                    WHERE stop_loss_price IS NULL
                      AND verdict IN ('BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL')
                `);

                console.log('✅ TP/SL backfill complete');
            }
        }

        // ─── Admin Command Center migrations ───────────────────────────────────
        const adminMigrationFlag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'admin_command_center_v1'"
        );

        if (adminMigrationFlag.rows.length === 0) {
            console.log('📦 Running admin command center migrations...');

            // Add archived_at to signal_performance
            await client.query(`
                ALTER TABLE signal_performance
                ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_signal_performance_archived
                ON signal_performance(archived_at)
                WHERE archived_at IS NULL
            `);

            // Create admin_audit_log table
            await client.query(`
                CREATE TABLE IF NOT EXISTS admin_audit_log (
                    id SERIAL PRIMARY KEY,
                    admin_email VARCHAR(100) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    target_table VARCHAR(50),
                    target_id VARCHAR(50),
                    old_value JSONB,
                    new_value JSONB,
                    ip_address VARCHAR(45),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_admin_audit_action
                ON admin_audit_log(action, created_at)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_admin_audit_admin
                ON admin_audit_log(admin_email, created_at)
            `);

            // Register migration flag
            await client.query(
                "INSERT INTO migration_flags (flag_name) VALUES ('admin_command_center_v1')"
            );

            console.log('✅ Admin command center migrations complete');
        }

        // ─── Model Portfolio investment mode (T0) ─────────────────────────────
        const scorecardInvestmentFlag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'scorecard_investment_mode_v1'"
        );

        if (scorecardInvestmentFlag.rows.length === 0) {
            console.log('📦 Running scorecard investment mode migration...');

            await client.query(`
                ALTER TABLE portfolio_coins
                    ADD COLUMN IF NOT EXISTS direction varchar(10),
                    ADD COLUMN IF NOT EXISTS posted_entry_price numeric(20,8),
                    ADD COLUMN IF NOT EXISTS average_entry_price numeric(20,8),
                    ADD COLUMN IF NOT EXISTS initial_budget numeric(12,2),
                    ADD COLUMN IF NOT EXISTS dca_budget numeric(12,2) DEFAULT '0',
                    ADD COLUMN IF NOT EXISTS remaining_size_frac numeric(5,4) DEFAULT '1',
                    ADD COLUMN IF NOT EXISTS dca_filled boolean DEFAULT false,
                    ADD COLUMN IF NOT EXISTS tp1_hit boolean DEFAULT false,
                    ADD COLUMN IF NOT EXISTS tp2_hit boolean DEFAULT false,
                    ADD COLUMN IF NOT EXISTS tp3_hit boolean DEFAULT false,
                    ADD COLUMN IF NOT EXISTS realized_pnl numeric(12,2) DEFAULT '0',
                    ADD COLUMN IF NOT EXISTS exit_price numeric(20,8),
                    ADD COLUMN IF NOT EXISTS exited_at timestamp,
                    ADD COLUMN IF NOT EXISTS exit_reason varchar(30)
            `);

            await client.query(`
                UPDATE portfolio_coins
                SET
                    posted_entry_price = COALESCE(posted_entry_price, entry_price),
                    average_entry_price = COALESCE(average_entry_price, entry_price),
                    remaining_size_frac = COALESCE(remaining_size_frac, 1),
                    dca_filled = COALESCE(dca_filled, false),
                    tp1_hit = COALESCE(tp1_hit, false),
                    tp2_hit = COALESCE(tp2_hit, false),
                    tp3_hit = COALESCE(tp3_hit, false),
                    realized_pnl = COALESCE(realized_pnl, 0),
                    dca_budget = COALESCE(dca_budget, 0)
            `);

            await client.query(
                "INSERT INTO migration_flags (flag_name) VALUES ('scorecard_investment_mode_v1')"
            );

            console.log('✅ Scorecard investment mode migration complete');
        }

        // ─── Market Context news layer (DEC-040 MC-1) ─────────────────────────
        const marketContextV1Flag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_v1'"
        );

        if (marketContextV1Flag.rows.length === 0) {
            console.log('📦 Running market context v1 migration...');

            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_news_source_type') THEN
                        CREATE TYPE market_news_source_type AS ENUM ('terminal', 'rss', 'telegram', 'manual');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_news_trust') THEN
                        CREATE TYPE market_news_trust AS ENUM ('pending', 'trusted', 'rejected');
                    END IF;
                END $$;
            `);

            await client.query(`
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
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_trust
                    ON market_news_items (trust)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_published_at
                    ON market_news_items (published_at DESC NULLS LAST)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_source_type
                    ON market_news_items (source_type)
            `);

            await client.query(`
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
                )
            `);

            await client.query(
                "INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_v1', NOW())"
            );

            console.log('✅ Market context v1 migration complete');
        }

        // ─── Market Context snapshots (DEC-040 MC-3) ──────────────────────────
        const marketContextSnapshotsFlag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_snapshots_v1'"
        );

        if (marketContextSnapshotsFlag.rows.length === 0) {
            console.log('📦 Running market context snapshots migration...');

            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_context_snapshot_status') THEN
                        CREATE TYPE market_context_snapshot_status AS ENUM ('draft', 'published', 'archived');
                    END IF;
                END $$;
            `);

            await client.query(`
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
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_status
                    ON market_context_snapshots (status)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_kind
                    ON market_context_snapshots (kind)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_generated_at
                    ON market_context_snapshots (generated_at DESC NULLS LAST)
            `);

            await client.query(
                "INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_snapshots_v1', NOW())"
            );

            console.log('✅ Market context snapshots migration complete');
        }

        // ─── Market Context Hub (DEC-043 B1) ──────────────────────────────────
        const marketContextHubV1Flag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'market_context_hub_v1'"
        );

        if (marketContextHubV1Flag.rows.length === 0) {
            console.log('📦 Running market context hub v1 migration...');

            await client.query('CREATE EXTENSION IF NOT EXISTS vector');

            await client.query(`
                ALTER TABLE market_context_snapshots
                    ADD COLUMN IF NOT EXISTS symbol TEXT
            `);
            await client.query(`
                ALTER TABLE market_context_snapshots
                    ADD COLUMN IF NOT EXISTS seo_meta JSONB
            `);
            await client.query(`
                ALTER TABLE market_context_snapshots
                    ADD COLUMN IF NOT EXISTS auto_published BOOLEAN NOT NULL DEFAULT false
            `);
            await client.query(`
                ALTER TABLE market_context_snapshots
                    ADD COLUMN IF NOT EXISTS seo_score JSONB
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_context_snapshots_symbol
                    ON market_context_snapshots (symbol)
            `);
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS uq_market_context_snapshots_published_coin
                    ON market_context_snapshots (symbol)
                    WHERE status = 'published' AND kind = 'coin' AND symbol IS NOT NULL
            `);

            await client.query(`
                ALTER TABLE market_news_items
                    ADD COLUMN IF NOT EXISTS event_severity SMALLINT
            `);
            await client.query(`
                ALTER TABLE market_news_items
                    ADD COLUMN IF NOT EXISTS relevance_score SMALLINT
            `);
            await client.query(`
                ALTER TABLE market_news_items
                    ADD COLUMN IF NOT EXISTS classification TEXT
            `);
            await client.query(`
                ALTER TABLE market_news_items
                    ADD COLUMN IF NOT EXISTS embedding vector(1536)
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_trust_severity
                    ON market_news_items (trust, event_severity)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_classification
                    ON market_news_items (classification)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_market_news_items_symbols_gin
                    ON market_news_items USING GIN (symbols)
            `);

            await client.query(
                "INSERT INTO migration_flags (flag_name, executed_at) VALUES ('market_context_hub_v1', NOW())"
            );

            console.log('✅ Market context hub v1 migration complete');
        }

        // ─── Airdrop Intelligence schema (DEC-041 AD-0) ───────────────────────
        const airdropIntelV1Flag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'airdrop_intelligence_v1'"
        );

        if (airdropIntelV1Flag.rows.length === 0) {
            console.log('📦 Running airdrop intelligence v1 migration...');

            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_source_kind') THEN
                        CREATE TYPE content_source_kind AS ENUM ('telegram', 'rss', 'system');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_source_purpose') THEN
                        CREATE TYPE content_source_purpose AS ENUM (
                            'airdrop_alpha', 'airdrop_community', 'news', 'market_context'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_alias_source') THEN
                        CREATE TYPE airdrop_alias_source AS ENUM ('ingest', 'admin', 'ai');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_pipeline_status') THEN
                        CREATE TYPE airdrop_pipeline_status AS ENUM (
                            'discovering', 'hold_recheck',
                            'rejected', 'active', 'archived'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_publish_path') THEN
                        CREATE TYPE airdrop_publish_path AS ENUM (
                            'none', 'auto_publish', 'hold_recheck',
                            'reject', 'admin_force'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_evidence_fetch_status') THEN
                        CREATE TYPE airdrop_evidence_fetch_status AS ENUM (
                            'pending', 'ok', 'failed', 'skipped'
                        );
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_mood_window') THEN
                        CREATE TYPE airdrop_mood_window AS ENUM ('24h', '7d');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'airdrop_mood_label') THEN
                        CREATE TYPE airdrop_mood_label AS ENUM ('cold', 'warming', 'hot', 'toxic');
                    END IF;
                END $$;
            `);

            await client.query(`
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
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_content_sources_purpose
                    ON content_sources (purpose)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_content_sources_enabled
                    ON content_sources (enabled)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_content_sources_kind_purpose
                    ON content_sources (kind, purpose)
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS airdrop_entities (
                    id SERIAL PRIMARY KEY,
                    canonical_name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) NOT NULL,
                    defillama_slug VARCHAR(255),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT airdrop_entities_slug_unique UNIQUE (slug)
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_entities_defillama_slug
                    ON airdrop_entities (defillama_slug)
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS airdrop_entity_aliases (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL REFERENCES airdrop_entities(id) ON DELETE CASCADE,
                    alias VARCHAR(255) NOT NULL,
                    normalized_alias VARCHAR(255) NOT NULL,
                    source airdrop_alias_source NOT NULL DEFAULT 'ingest',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT airdrop_entity_aliases_normalized_unique UNIQUE (normalized_alias)
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_entity_aliases_entity_id
                    ON airdrop_entity_aliases (entity_id)
            `);

            await client.query(`
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
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_signals_entity_id
                    ON airdrop_signals (entity_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_signals_source_id
                    ON airdrop_signals (source_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_signals_published_at
                    ON airdrop_signals (published_at DESC NULLS LAST)
            `);

            await client.query(`
                DO $$
                BEGIN
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
                END $$;
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_projects_entity_id
                    ON airdrop_projects (entity_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_projects_pipeline_status
                    ON airdrop_projects (pipeline_status)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_projects_publish_path
                    ON airdrop_projects (publish_path)
            `);

            await client.query(`
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
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_entity_id
                    ON airdrop_evidence_artifacts (entity_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_project_id
                    ON airdrop_evidence_artifacts (project_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_fetch_status
                    ON airdrop_evidence_artifacts (fetch_status)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_evidence_source_hash
                    ON airdrop_evidence_artifacts (source_hash)
            `);

            await client.query(`
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
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_mood_entity_window
                    ON airdrop_mood_snapshots (entity_id, mood_window)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_airdrop_mood_computed_at
                    ON airdrop_mood_snapshots (computed_at DESC)
            `);

            await client.query(
                "INSERT INTO migration_flags (flag_name, executed_at) VALUES ('airdrop_intelligence_v1', NOW())"
            );

            console.log('✅ Airdrop intelligence v1 migration complete');
        }

        // ─── AD-0 enum fix: hold_recheck only (no pending_review trust queue) ─
        const airdropEnumsFixFlag = await client.query(
            "SELECT 1 FROM migration_flags WHERE flag_name = 'airdrop_intelligence_v1_enums_fix'"
        );

        if (airdropEnumsFixFlag.rows.length === 0) {
            const hasOldPipelineEnum = await client.query(`
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'airdrop_pipeline_status'
                  AND e.enumlabel IN ('pending_review', 'insufficient_evidence')
                LIMIT 1
            `);
            const hasOldPublishEnum = await client.query(`
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'airdrop_publish_path'
                  AND e.enumlabel IN ('pending_review', 'insufficient_evidence')
                LIMIT 1
            `);
            const hasPipelineType = await client.query(
                "SELECT 1 FROM pg_type WHERE typname = 'airdrop_pipeline_status'"
            );

            if (hasOldPipelineEnum.rows.length > 0 || hasOldPublishEnum.rows.length > 0) {
                console.log('📦 Fixing airdrop intelligence enums (hold_recheck lock)...');

                await client.query(`
                    ALTER TABLE airdrop_projects DROP COLUMN IF EXISTS pipeline_status
                `);
                await client.query(`
                    ALTER TABLE airdrop_projects DROP COLUMN IF EXISTS publish_path
                `);
                await client.query('DROP TYPE IF EXISTS airdrop_pipeline_status');
                await client.query('DROP TYPE IF EXISTS airdrop_publish_path');
                await client.query(`
                    CREATE TYPE airdrop_pipeline_status AS ENUM (
                        'discovering', 'hold_recheck', 'rejected', 'active', 'archived'
                    )
                `);
                await client.query(`
                    CREATE TYPE airdrop_publish_path AS ENUM (
                        'none', 'auto_publish', 'hold_recheck', 'reject', 'admin_force'
                    )
                `);
                await client.query(`
                    ALTER TABLE airdrop_projects
                        ADD COLUMN pipeline_status airdrop_pipeline_status NOT NULL DEFAULT 'discovering'
                `);
                await client.query(`
                    ALTER TABLE airdrop_projects
                        ADD COLUMN publish_path airdrop_publish_path NOT NULL DEFAULT 'none'
                `);
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_pipeline_status
                        ON airdrop_projects (pipeline_status)
                `);
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_publish_path
                        ON airdrop_projects (publish_path)
                `);

                console.log('✅ Airdrop intelligence enums fixed');
            } else if (hasPipelineType.rows.length > 0) {
                // Schema already correct (fresh AD-0) — still mark fix applied
                console.log('✅ Airdrop intelligence enums already locked (hold_recheck)');
            }

            await client.query(
                "INSERT INTO migration_flags (flag_name, executed_at) VALUES ('airdrop_intelligence_v1_enums_fix', NOW())"
            );
        }
    } catch (err) {
        console.error('⚠️ Alpha focus migration warning:', err instanceof Error ? err.message : String(err));
    } finally {
        client.release();
    }
}

export async function initDb(): Promise<void> {
    await ensurePgvectorExtension();
    await runMigrations();
    await pushSchema();
    await registerPgvector();
}

export { pool };
