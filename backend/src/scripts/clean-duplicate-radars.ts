import { db } from '../config/db';
import { migrationFlags } from '../models/market.model';
import { eq, sql } from 'drizzle-orm';

const FLAG_NAME = 'radar_duplicate_cleanup_v3';

export async function runRadarCleanup(): Promise<{ cleaned: boolean; deleted: number }> {
    const [existing] = await db.select({ id: migrationFlags.id })
        .from(migrationFlags)
        .where(eq(migrationFlags.flagName, FLAG_NAME))
        .limit(1);

    if (existing) {
        return { cleaned: false, deleted: 0 };
    }

    console.log('[Migration] 🧹 Cleaning duplicate radar signals...');

    const countResult = await db.execute(
        sql`SELECT COUNT(*) AS total FROM radar_signals`
    );
    const totalBefore = Number(countResult.rows[0].total);

    const deleteResult = await db.execute(
        sql`
            DELETE FROM radar_signals
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM radar_signals
                GROUP BY coin_symbol, DATE(created_at)
            )
        `
    );
    const deleted = Number(deleteResult.rowCount);

    const afterResult = await db.execute(
        sql`SELECT COUNT(*) AS total FROM radar_signals`
    );
    const totalAfter = Number(afterResult.rows[0].total);

    await db.insert(migrationFlags).values({ flagName: FLAG_NAME });

    console.log(`[Migration] ✅ Radar cleanup done: ${totalBefore} → ${totalAfter} (${deleted} duplicates removed)`);
    return { cleaned: true, deleted };
}

if (require.main === module) {
    import('../config/db').then(({ pool }) => {
        runRadarCleanup()
            .then((result) => {
                if (!result.cleaned) {
                    console.log('⏭️  Radar cleanup already executed — skipping.');
                }
                pool.end();
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ Cleanup failed:', err);
                process.exit(1);
            });
    });
}
