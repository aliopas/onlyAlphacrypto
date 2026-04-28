import { db } from '../config/db';
import { coinMasterArticles, radarSignals } from '../models/market.model';
import { sql, isNotNull, notInArray } from 'drizzle-orm';
import { deleteCachePattern } from '../config/redis';

async function main(): Promise<void> {
    console.log('=== Backfill Radar Signals from Master Articles ===\n');

    const existingSymbols = await db.select({ coinSymbol: radarSignals.coinSymbol })
        .from(radarSignals)
        .where(isNotNull(radarSignals.coinSymbol));

    const symbolsWithRadar = new Set(existingSymbols.map(r => r.coinSymbol).filter(Boolean) as string[]);
    console.log(`Radar signals already exist for: ${symbolsWithRadar.size} coins`);

    const actionableSentiments = ['bullish', 'bearish', 'strong_bullish', 'strong_bearish'];

    const masters = await db.select({
        id: coinMasterArticles.id,
        coinSymbol: coinMasterArticles.coinSymbol,
        headline: coinMasterArticles.headline,
        hook: coinMasterArticles.hook,
        sentiment: coinMasterArticles.sentiment,
        confidenceScore: coinMasterArticles.confidenceScore,
    }).from(coinMasterArticles)
        .where(isNotNull(coinMasterArticles.sentiment));

    console.log(`Found ${masters.length} master articles with sentiment.\n`);

    let created = 0;
    let skipped = 0;
    for (const article of masters) {
        if (symbolsWithRadar.has(article.coinSymbol)) {
            skipped++;
            continue;
        }
        if (!actionableSentiments.includes(article.sentiment ?? '')) {
            skipped++;
            continue;
        }

        const signalText = article.hook || article.headline;

        await db.insert(radarSignals).values({
            coinSymbol: article.coinSymbol,
            signalText,
            sentiment: article.sentiment,
            impactScore: article.confidenceScore ?? 50,
        }).onConflictDoNothing();

        symbolsWithRadar.add(article.coinSymbol);
        created++;
        console.log(`  + ${article.coinSymbol}: ${signalText?.slice(0, 80)}...`);
    }

    console.log(`\nSkipped: ${skipped} (already have radar or non-actionable sentiment)`);
    console.log(`Created: ${created} new radar signals`);

    try {
        await deleteCachePattern('radar:latest:*');
        console.log('Redis radar cache cleared.');
    } catch {
        console.warn('Could not clear Redis cache.');
    }

    const totalRadar = await db.select({ total: sql<number>`count(*)::int` }).from(radarSignals);
    console.log(`\nTotal radar_signals now: ${totalRadar[0].total}`);

    process.exit(0);
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
