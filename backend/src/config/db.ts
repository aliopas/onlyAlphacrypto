import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import * as schema from '../models/index';
import { env } from './env';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
