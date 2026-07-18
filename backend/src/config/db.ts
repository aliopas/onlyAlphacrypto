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
