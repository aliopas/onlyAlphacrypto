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
            'ALTER TABLE coin_news ADD COLUMN IF NOT EXISTS seo_keywords jsonb;'
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
