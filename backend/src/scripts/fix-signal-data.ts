import { db } from '../config/db';
import { signalPerformance, radarSignals } from '../models/market.model';
import { eq, sql, and, isNull, not } from 'drizzle-orm';
import { deleteCache } from '../config/redis';

type Verdict = 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL';

const ACTIONABLE: ReadonlyArray<string> = ['STRONG_BUY', 'BUY', 'SELL', 'STRONG_SELL'];

function isValidVerdict(v: string | null): v is Verdict {
    return v !== null && ACTIONABLE.includes(v);
}

async function diagnose(): Promise<{
    totalRadar: number;
    totalPerf: number;
    activePerf: number;
    closedPerf: number;
    nullVerdict: number;
    nullEntry: number;
    zeroEntry: number;
    nullTpsl: number;
    duplicates: { coinSymbol: string; count: number }[];
    orphanPerf: number;
    negativeEntry: number;
}> {
    const [radarTotal] = await db.select({ total: sql<number>`count(*)::int` }).from(radarSignals);
    const [perfTotal] = await db.select({ total: sql<number>`count(*)::int` }).from(signalPerformance);
    const [activeTotal] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(eq(signalPerformance.isActive, true));
    const [closedTotal] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(eq(signalPerformance.isActive, false));

    const [nullVerdict] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(sql`verdict IS NULL OR verdict NOT IN ('STRONG_BUY','BUY','SELL','STRONG_SELL','NEUTRAL')`);
    const [nullEntry] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(isNull(signalPerformance.entryPrice));
    const [zeroEntry] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(eq(signalPerformance.entryPrice, 0));
    const [nullTpsl] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance)
        .where(and(
            eq(signalPerformance.isActive, true),
            sql`verdict IN ('STRONG_BUY','BUY','SELL','STRONG_SELL')`,
            sql`(stop_loss_price IS NULL OR take_profit_price IS NULL)`
        ));
    const [orphanPerf] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance)
        .where(sql`signal_id NOT IN (SELECT id FROM radar_signals)`);
    const [negativeEntry] = await db.select({ total: sql<number>`count(*)::int` })
        .from(signalPerformance).where(sql`entry_price < 0`);

    const dupes = await db.execute(sql`
        SELECT coin_symbol, count(*)::int as cnt
        FROM signal_performance
        WHERE is_active = true
        GROUP BY coin_symbol
        HAVING count(*) > 1
        ORDER BY cnt DESC
    `);

    return {
        totalRadar: radarTotal.total,
        totalPerf: perfTotal.total,
        activePerf: activeTotal.total,
        closedPerf: closedTotal.total,
        nullVerdict: nullVerdict.total,
        nullEntry: nullEntry.total,
        zeroEntry: zeroEntry.total,
        nullTpsl: nullTpsl.total,
        duplicates: dupes.rows.map((r: Record<string, unknown>) => ({
            coinSymbol: String(r.coin_symbol),
            count: Number(r.cnt),
        })),
        orphanPerf: orphanPerf.total,
        negativeEntry: negativeEntry.total,
    };
}

async function fixDuplicateActives(): Promise<number> {
    const result = await db.execute(sql`
        UPDATE signal_performance
        SET is_active = false, closed_at = NOW(), auto_closed_reason = 'dedup_cleanup'
        WHERE id IN (
            SELECT sp.id
            FROM signal_performance sp
            INNER JOIN (
                SELECT coin_symbol, MAX(id) as max_id
                FROM signal_performance
                WHERE is_active = true
                GROUP BY coin_symbol
                HAVING count(*) > 1
            ) keep ON sp.coin_symbol = keep.coin_symbol AND sp.id != keep.max_id
            WHERE sp.is_active = true
        )
    `);
    return Number(result.rowCount);
}

async function fixNullTpsl(): Promise<number> {
    const result = await db.execute(sql`
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
        WHERE (stop_loss_price IS NULL OR take_profit_price IS NULL)
          AND is_active = true
          AND entry_price > 0
          AND verdict IN ('BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL')
    `);
    return Number(result.rowCount);
}

async function fixClosedWithNullPnl(): Promise<number> {
    const result = await db.execute(sql`
        UPDATE signal_performance
        SET realized_pnl = 0
        WHERE is_active = false AND realized_pnl IS NULL AND exit_price IS NOT NULL
    `);
    return Number(result.rowCount);
}

async function deleteGarbageRows(): Promise<{ badVerdict: number; badEntry: number; orphans: number }> {
    const badVerdictResult = await db.execute(sql`
        DELETE FROM signal_performance
        WHERE verdict IS NULL OR verdict NOT IN ('STRONG_BUY','BUY','SELL','STRONG_SELL','NEUTRAL')
    `);
    const badEntryResult = await db.execute(sql`
        DELETE FROM signal_performance
        WHERE entry_price IS NULL OR entry_price <= 0
    `);
    const orphanResult = await db.execute(sql`
        DELETE FROM signal_performance
        WHERE signal_id NOT IN (SELECT id FROM radar_signals)
    `);
    return {
        badVerdict: Number(badVerdictResult.rowCount),
        badEntry: Number(badEntryResult.rowCount),
        orphans: Number(orphanResult.rowCount),
    };
}

async function nuclearReset(): Promise<void> {
    console.log('\n[NUCLEAR] Deleting ALL signal_performance rows...');
    await db.delete(signalPerformance);
    console.log('[NUCLEAR] signal_performance wiped.');

    console.log('[NUCLEAR] Deleting ALL radar_signals rows...');
    await db.delete(radarSignals);
    console.log('[NUCLEAR] radar_signals wiped.');

    try {
        await deleteCache('scorecard:latest');
        console.log('[NUCLEAR] Scorecard cache cleared.');
    } catch {
        console.warn('[NUCLEAR] Could not clear Redis cache.');
    }

    console.log('[NUCLEAR] Done. Fresh start.');
}

async function smartFix(): Promise<void> {
    console.log('\n[SMART FIX] Running diagnostics...\n');
    const before = await diagnose();

    console.log('=== BEFORE ===');
    console.log(`  radar_signals:       ${before.totalRadar}`);
    console.log(`  signal_performance:  ${before.totalPerf} (${before.activePerf} active, ${before.closedPerf} closed)`);
    console.log(`  Bad verdicts:        ${before.nullVerdict}`);
    console.log(`  Null entry_price:    ${before.nullEntry}`);
    console.log(`  Zero entry_price:    ${before.zeroEntry}`);
    console.log(`  Orphan perf rows:    ${before.orphanPerf}`);
    console.log(`  Negative entry:      ${before.negativeEntry}`);
    console.log(`  Active w/o TP/SL:    ${before.nullTpsl}`);
    console.log(`  Duplicate actives:   ${before.duplicates.length} coins`);
    before.duplicates.forEach(d => console.log(`    - ${d.coinSymbol}: ${d.count} active signals`));

    let totalChanges = 0;

    console.log('\n[STEP 1] Deleting garbage rows (bad verdict, bad entry, orphans)...');
    const deleted = await deleteGarbageRows();
    console.log(`  Bad verdicts deleted: ${deleted.badVerdict}`);
    console.log(`  Bad entries deleted:  ${deleted.badEntry}`);
    console.log(`  Orphans deleted:      ${deleted.orphans}`);
    totalChanges += deleted.badVerdict + deleted.badEntry + deleted.orphans;

    console.log('\n[STEP 2] Fixing duplicate active signals (keep latest per coin)...');
    const deduped = await fixDuplicateActives();
    console.log(`  Closed ${deduped} duplicate active signals.`);
    totalChanges += deduped;

    console.log('\n[STEP 3] Backfilling TP/SL for active signals...');
    const tpslFixed = await fixNullTpsl();
    console.log(`  Fixed ${tpslFixed} signals.`);
    totalChanges += tpslFixed;

    console.log('\n[STEP 4] Fixing closed signals with null realized_pnl...');
    const pnlFixed = await fixClosedWithNullPnl();
    console.log(`  Fixed ${pnlFixed} signals.`);
    totalChanges += pnlFixed;

    try {
        await deleteCache('scorecard:latest');
        console.log('\n  Scorecard Redis cache cleared.');
    } catch {
        console.warn('\n  Could not clear Redis cache.');
    }

    const after = await diagnose();
    console.log('\n=== AFTER ===');
    console.log(`  radar_signals:       ${after.totalRadar}`);
    console.log(`  signal_performance:  ${after.totalPerf} (${after.activePerf} active, ${after.closedPerf} closed)`);
    console.log(`  Bad verdicts:        ${after.nullVerdict}`);
    console.log(`  Orphan perf rows:    ${after.orphanPerf}`);
    console.log(`  Active w/o TP/SL:    ${after.nullTpsl}`);
    console.log(`  Duplicate actives:   ${after.duplicates.length} coins`);
    console.log(`\n  Total changes: ${totalChanges}`);
}

async function main(): Promise<void> {
    const mode = process.argv[2];

    console.log('=== OnlyAlpha Signal Data Repair ===');
    console.log(`Mode: ${mode || 'fix'}\n`);

    if (mode === 'nuclear') {
        await nuclearReset();
        return;
    }

    if (mode === 'diagnose') {
        const d = await diagnose();
        console.log('=== DIAGNOSIS ===');
        console.log(`  radar_signals:       ${d.totalRadar}`);
        console.log(`  signal_performance:  ${d.totalPerf} (${d.activePerf} active, ${d.closedPerf} closed)`);
        console.log(`  Bad verdicts:        ${d.nullVerdict}`);
        console.log(`  Null entry_price:    ${d.nullEntry}`);
        console.log(`  Zero entry_price:    ${d.zeroEntry}`);
        console.log(`  Orphan perf rows:    ${d.orphanPerf}`);
        console.log(`  Negative entry:      ${d.negativeEntry}`);
        console.log(`  Active w/o TP/SL:    ${d.nullTpsl}`);
        console.log(`  Duplicate actives:   ${d.duplicates.length} coins`);
        d.duplicates.forEach(x => console.log(`    - ${x.coinSymbol}: ${x.count} active signals`));
        return;
    }

    await smartFix();
}

main()
    .then(() => { process.exit(0); })
    .catch((err) => { console.error('Failed:', err); process.exit(1); });
