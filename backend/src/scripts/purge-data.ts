import { db, pool } from '../config/db';
import { redis } from '../config/redis';
import { sql } from 'drizzle-orm';

const TABLES = [
    'coin_news',
    'raw_news_buffer',
    'radar_signals',
    'market_insights',
    'daily_alpha_focus',
    'daily_market_mood',
    'price_snapshots',
    'coin_memory',
    'coin_intelligence_cache',
    'coin_news_history',
    'coin_master_articles',
    'coin_timeline_updates',
    'coin_conviction_scores',
    'migration_flags',
    'airdrop_projects',
    'airdrop_tasks',
    'user_progress',
    'users',
    'user_wallets',
    'api_keys',
    'sessions',
    'user_preferences',
];

async function purge(): Promise<void> {
    console.log('🧹 Purging all data from database...\n');

    for (const table of TABLES) {
        try {
            await db.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} RESTART IDENTITY CASCADE`);
            console.log(`  ✅ ${table}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('does not exist')) {
                console.log(`  ⏭️  ${table} (does not exist)`);
            } else {
                console.log(`  ❌ ${table}: ${msg}`);
            }
        }
    }

    if (redis) {
        console.log('\n🧹 Flushing Redis cache...');
        await redis.flushall();
        console.log('  ✅ Redis flushed');
    } else {
        console.log('\n⏭️  Redis not configured, skipping');
    }

    console.log('\n✅ Purge complete. Database is clean.\n');
    process.exit(0);
}

purge().catch((err) => {
    console.error('❌ Purge failed:', err);
    process.exit(1);
});
