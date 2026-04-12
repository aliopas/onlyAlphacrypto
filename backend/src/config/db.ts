import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { execSync } from 'child_process';
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

async function pushSchema(): Promise<void> {
    try {
        console.log('📦 Syncing database schema...');
        const output = execSync('npx drizzle-kit push', {
            cwd: process.cwd(),
            timeout: 60000,
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

export async function initDb(): Promise<void> {
    await ensurePgvectorExtension();
    await pushSchema();
    await registerPgvector();
}

export { pool };
