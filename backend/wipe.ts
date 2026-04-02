import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

// Load environment variables from .env
dotenv.config();

async function wipeDatabase() {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.error("❌ Error: DATABASE_URL is not defined in your .env file!");
        process.exit(1);
    }

    // Connect securely to the Private Database
    const pool = new Pool({ connectionString: dbUrl });
    const db = drizzle(pool);

    console.log("⏳ Connecting to Production Server...");
    
    try {
        // Warning: This explicitly wipes the structural payload tables representing insights and AI analysis
        await db.execute(sql`TRUNCATE TABLE 
            coin_news, 
            raw_news_buffer, 
            radar_signals, 
            market_insights, 
            daily_alpha_focus, 
            daily_market_mood, 
            coin_memory 
        CASCADE;`);

        console.log("✅ All experimental data wiped from Production successfully!");
    } catch (err: any) {
        console.error("❌ Failed to wipe database:", err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

wipeDatabase().catch(console.error);
