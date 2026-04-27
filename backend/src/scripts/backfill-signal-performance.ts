import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, and, isNull, lte, sql, desc } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';
import { deleteCache } from '../config/redis';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function backfillSignalPerformance(): Promise<void> {
    console.log('=== Signal Performance Backfill Script ===');
    console.log('Fetching all signal performance rows...');

    const allSignals = await db.select()
        .from(signalPerformance)
        .orderBy(desc(signalPerformance.entryAt));

    console.log(`Found ${allSignals.length} total signals`);

    const now = new Date();
    let updated24h = 0;
    let updated7d = 0;
    let updated30d = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of allSignals) {
        const ageMs = now.getTime() - new Date(row.entryAt).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        const updates: Record<string, number | boolean | null> = {};
        let needsUpdate = false;

        const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
        const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);

        if (row.price24h === null && ageHours >= 24) {
            needsUpdate = true;
        }
        if (row.price7d === null && ageDays >= 7) {
            needsUpdate = true;
        }
        if (row.price30d === null && ageDays >= 30) {
            needsUpdate = true;
        }

        if (!needsUpdate) {
            skipped++;
            continue;
        }

        console.log(`[${row.id}] ${row.coinSymbol} (${row.verdict}) entry=$${row.entryPrice} age=${ageDays.toFixed(1)}d`);

        let currentPrice: number | null = null;
        try {
            const priceResult = await getPriceWithFallback(row.coinSymbol);
            if (priceResult && priceResult.price > 0) {
                currentPrice = priceResult.price;
            } else {
                console.warn(`  ⚠ No price found for ${row.coinSymbol}`);
                failed++;
                continue;
            }
        } catch (err) {
            console.error(`  ✘ Price fetch failed for ${row.coinSymbol}:`, err instanceof Error ? err.message : String(err));
            failed++;
            continue;
        }

        const pricePnl = ((currentPrice - row.entryPrice) / row.entryPrice) * 100;
        const tradePnl = isBearish ? -pricePnl : pricePnl;

        if (row.price24h === null && ageHours >= 24) {
            updates.price24h = currentPrice;
            updates.pnl24h = parseFloat(tradePnl.toFixed(2));
            updated24h++;
            console.log(`  ✓ 24h P&L: ${tradePnl > 0 ? '+' : ''}${tradePnl.toFixed(2)}% (price: $${currentPrice})`);
        }

        if (row.price7d === null && ageDays >= 7) {
            const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;
            updates.price7d = currentPrice;
            updates.pnl7d = parseFloat(tradePnl.toFixed(2));
            updates.isWin7d = isWin;
            updated7d++;
            console.log(`  ✓ 7d P&L: ${tradePnl > 0 ? '+' : ''}${tradePnl.toFixed(2)}% (win: ${isWin})`);
        }

        if (row.price30d === null && ageDays >= 30) {
            const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;
            updates.price30d = currentPrice;
            updates.pnl30d = parseFloat(tradePnl.toFixed(2));
            updates.isWin30d = isWin;
            updated30d++;
            console.log(`  ✓ 30d P&L: ${tradePnl > 0 ? '+' : ''}${tradePnl.toFixed(2)}% (win: ${isWin})`);
        }

        if (Object.keys(updates).length > 0) {
            try {
                await db.update(signalPerformance)
                    .set(updates)
                    .where(eq(signalPerformance.id, row.id));
            } catch (err) {
                console.error(`  ✘ DB update failed for signal ${row.id}:`, err instanceof Error ? err.message : String(err));
                failed++;
            }
        }

        await sleep(500);
    }

    console.log('\n=== Backfill Summary ===');
    console.log(`Total signals:     ${allSignals.length}`);
    console.log(`Updated (24h):     ${updated24h}`);
    console.log(`Updated (7d):      ${updated7d}`);
    console.log(`Updated (30d):     ${updated30d}`);
    console.log(`Skipped:           ${skipped}`);
    console.log(`Failed:            ${failed}`);

    try {
        await deleteCache('scorecard:latest');
        console.log('\n✓ Scorecard cache cleared');
    } catch {
        console.warn('\n⚠ Could not clear scorecard cache (Redis may be unavailable)');
    }

    console.log('\n=== Done ===');
}

backfillSignalPerformance().catch((err) => {
    console.error('Backfill script failed:', err);
    process.exit(1);
});
