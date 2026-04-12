import { db } from '../config/db';
import { coinMasterArticles } from '../models/index';
import { calculateAbsoluteConviction } from '../services/conviction.service';
import { eq } from 'drizzle-orm';

async function seedHistoricalConviction(): Promise<void> {
    console.log(' Seeding historical conviction scores for all coins...');

    const masters = await db
        .select({
            id: coinMasterArticles.id,
            coinSymbol: coinMasterArticles.coinSymbol,
            currentScore: coinMasterArticles.convictionScore,
        })
        .from(coinMasterArticles);

    console.log(`Found ${masters.length} master articles to process`);

    let updated = 0;
    let skipped = 0;

    for (const master of masters) {
        try {
            const result = await calculateAbsoluteConviction(master.id);

            if (result.score === master.currentScore) {
                skipped++;
                console.log(`  Skip (unchanged): ${master.coinSymbol} — score: ${result.score}`);
                continue;
            }

            await db
                .update(coinMasterArticles)
                .set({
                    convictionScore: result.score,
                    posture: result.posture,
                    updatedAt: new Date(),
                })
                .where(eq(coinMasterArticles.id, master.id));

            updated++;
            console.log(`  Updated: ${master.coinSymbol} — score: ${result.score}, posture: ${result.posture}, trend: ${result.trend}`);
        } catch (err) {
            console.error(`  Failed for ${master.coinSymbol}:`, err);
        }
    }

    console.log(` Done. Updated: ${updated}, Skipped: ${skipped}`);
}

seedHistoricalConviction()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Historical conviction seed failed:', err);
        process.exit(1);
    });
