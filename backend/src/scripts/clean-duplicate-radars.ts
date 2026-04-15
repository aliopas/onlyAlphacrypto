import { db, pool } from '../config/db';
import { sql } from 'drizzle-orm';

async function cleanDuplicateRadars(): Promise<void> {
    console.log('🧹 Cleaning duplicate radar signals...\n');

    const countResult = await db.execute(
        sql`SELECT COUNT(*) AS total FROM radar_signals`
    );
    const totalBefore = Number(countResult.rows[0].total);
    console.log(`  📊 Total radar signals before cleanup: ${totalBefore}`);

    const deleteResult = await db.execute(
        sql`
            DELETE FROM radar_signals
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM radar_signals
                GROUP BY coin_symbol, signal_text, DATE(created_at)
            )
        `
    );
    const deleted = Number(deleteResult.rowCount);
    console.log(`  🗑️  Removed ${deleted} duplicate(s)`);

    const afterResult = await db.execute(
        sql`SELECT COUNT(*) AS total FROM radar_signals`
    );
    const totalAfter = Number(afterResult.rows[0].total);
    console.log(`  ✅ Remaining radar signals: ${totalAfter}\n`);

    console.log('✅ Cleanup complete.\n');

    await pool.end();
    process.exit(0);
}

cleanDuplicateRadars().catch((err) => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
