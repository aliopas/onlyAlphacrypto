import { db } from '../config/db';
import { coinNews, coinMasterArticles, coinTimelineUpdates } from '../models/market.model';
import { eq, desc, sql, notInArray } from 'drizzle-orm';
import { extractSection } from '../services/openai.service';

async function seedMasterArticles(): Promise<void> {
    console.log(' Seeding master articles from existing coin_news...');

    const existingMasters = await db
        .select({ coinSymbol: coinMasterArticles.coinSymbol })
        .from(coinMasterArticles);

    const skipSymbols = existingMasters.map(m => m.coinSymbol);
    console.log(`Skipping ${skipSymbols.length} coins that already have master articles`);

    let query = db
        .selectDistinct({ coinSymbol: coinNews.coinSymbol })
        .from(coinNews)
        .where(eq(coinNews.aiProcessed, 1))
        .$dynamic();

    if (skipSymbols.length > 0) {
        query = query.where(notInArray(coinNews.coinSymbol, skipSymbols));
    }

    const rows = await query;
    const symbols = rows.map(r => r.coinSymbol).filter((s): s is string => s !== null);

    await processSymbols(symbols);

    console.log(' Seed complete.');
}

async function processSymbols(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
        try {
            const articles = await db
                .select()
                .from(coinNews)
                .where(eq(coinNews.coinSymbol, symbol))
                .orderBy(desc(coinNews.impactScore), desc(coinNews.publishedAt))
                .limit(3);

            if (articles.length === 0) continue;

            const best = articles[0];
            const fullText = best.summary || best.headline || '';

            const newMaster = {
                coinSymbol: symbol,
                headline: best.headline,
                hook: best.hook || null,
                metaTitle: best.metaTitle || null,
                metaDescription: best.metaDescription || null,
                seoKeywords: (best.seoKeywords as string[] | null) ?? null,
                sentiment: best.sentiment || null,
                verdict: null,
                confidenceScore: best.impactScore ?? null,
                convictionScore: 0,
                posture: 'neutral' as const,
                riskTags: [] as string[],
                triggerType: null,
                coreCatalyst: extractSection(fullText, 'HOOK') || null,
                marketContext: extractSection(fullText, 'WHAT HAPPENED') || null,
                strategicImpact: extractSection(fullText, 'WHY IT MATTERS') || null,
                historicalContext: extractSection(fullText, 'HISTORY REPEATS?') || null,
                technicalLevels: extractSection(fullText, 'PRICE PICTURE') || null,
                riskAssessment: extractSection(fullText, 'RISK CHECK') || null,
                bottomLine: extractSection(fullText, 'BOTTOM LINE') || null,
                majorUpdateCount: 1,
                minorUpdateCount: 0,
            };

            const inserted = await db
                .insert(coinMasterArticles)
                .values(newMaster)
                .onConflictDoNothing()
                .returning({ id: coinMasterArticles.id });

            if (inserted.length === 0) {
                console.log(`  Skip (already exists): ${symbol}`);
                continue;
            }

            const masterId = inserted[0].id;

            const timelineValues = articles.map((a) => ({
                coinSymbol: symbol,
                masterArticleId: masterId,
                updateText: (a.summary || a.headline || '').slice(0, 1000),
                triggerType: null as string | null,
                severity: 'MAJOR' as const,
                sourceTitle: a.headline,
                sourceHash: a.sourceHash ?? undefined,
                sentiment: a.sentiment ?? null,
                impactScore: a.impactScore ?? null,
                convictionDelta: null,
            }));

            for (const tv of timelineValues) {
                await db.insert(coinTimelineUpdates).values(tv).onConflictDoNothing();
            }

            console.log(`  Seeded: ${symbol} (master + ${timelineValues.length} timeline entries)`);
        } catch (err) {
            console.error(`  Failed for ${symbol}:`, err);
        }
    }
}

seedMasterArticles()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    });
