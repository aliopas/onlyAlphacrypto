import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
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
        const { registerTypes } = await import('pgvector/pg');
        await registerTypes(pool);
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

async function runMigrations(): Promise<void> {
    try {
        console.log('📦 Applying database migrations...');
        const migrationsPath = path.resolve(process.cwd(), 'drizzle/migrations');
        await migrate(db, { migrationsFolder: migrationsPath });
        console.log('✅ Database migrations applied');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ Migration failed:', msg);
        throw new Error(`Migration failed: ${msg}`);
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

export async function initDb(): Promise<void> {
    await ensurePgvectorExtension();
    await runMigrations();
    await registerPgvector();
}

export { pool };
