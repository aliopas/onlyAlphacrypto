require('dotenv').config();
const { Client } = require('pg');

async function fixSchema() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        console.log('Connected to database. Applying schema updates...');

        // Add missing columns one by one if they don't exist
        const queries = [
            'ALTER TABLE coin_news ADD COLUMN IF NOT EXISTS hook text;',
            'ALTER TABLE coin_news ADD COLUMN IF NOT EXISTS meta_title varchar(80);',
            'ALTER TABLE coin_news ADD COLUMN IF NOT EXISTS meta_description varchar(200);',
            'ALTER TABLE coin_news ADD COLUMN IF NOT EXISTS seo_keywords jsonb;',
            // Create raw_news_buffer table for Phase 1A Gathering Engine
            `CREATE TABLE IF NOT EXISTS raw_news_buffer (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                source VARCHAR(100),
                retrieved_at TIMESTAMP DEFAULT NOW(),
                source_hash VARCHAR(64) UNIQUE,
                ttl_expires_at TIMESTAMP,
                processed BOOLEAN DEFAULT FALSE,
                processing_attempts INTEGER DEFAULT 0,
                symbol_mentions TEXT[],
                sentiment_hint VARCHAR(20),
                relevance_score INTEGER
            )`
        ];

        for (const q of queries) {
            await client.query(q);
            console.log(`Executed: ${q}`);
        }

        console.log('✅ Schema updated successfully!');
    } catch (e) {
        console.error('❌ Error fixing schema:', e.message);
    } finally {
        await client.end();
    }
}

fixSchema();