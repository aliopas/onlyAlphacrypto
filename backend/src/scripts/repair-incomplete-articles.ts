import { db } from '../config/db';
import { coinMasterArticles, coinTimelineUpdates, coinNews, rawNewsBuffer } from '../models/market.model';
import { eq, desc, sql } from 'drizzle-orm';
import { migrationFlags } from '../models/market.model';
import { getCoinIntelligence } from '../services/coinIntelligence.service';
import { buildTemporalPattern } from '../services/temporalIntelligence.service';
import { getPriceWithFallback } from '../services/priceService';
import { callDeepSeekAnalysis, callGptNanoWriter, extractSection } from '../services/openai.service';
import type { DeepAnalysisResult, ArticleWriterResult } from '../services/openai.service';

const SECTION_COLUMNS = [
    'coreCatalyst',
    'marketContext',
    'strategicImpact',
    'historicalContext',
    'technicalLevels',
    'riskAssessment',
    'bottomLine',
] as const;

type SectionKey = typeof SECTION_COLUMNS[number];

const SECTION_TAG_MAP: Record<SectionKey, string> = {
    coreCatalyst: 'HOOK',
    marketContext: 'WHAT HAPPENED',
    strategicImpact: 'WHY IT MATTERS',
    historicalContext: 'HISTORY REPEATS?',
    technicalLevels: 'PRICE PICTURE',
    riskAssessment: 'RISK CHECK',
    bottomLine: 'BOTTOM LINE',
};

const CONCURRENCY_LIMIT = 2;
const DELAY_BETWEEN_COINS_MS = 5000;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const PLACEHOLDER_PATTERNS = [
    'Additional analysis pending',
    'Risk assessment pending',
    'Analysis pending',
    'Additional price analysis pending',
];

function isSectionIncomplete(value: string | null): boolean {
    if (value === null || value.trim().length < 50) return true;
    return PLACEHOLDER_PATTERNS.some(p => value.includes(p));
}

async function fetchLatestHeadline(symbol: string): Promise<string | null> {
    const timeline = await db.select({ sourceTitle: coinTimelineUpdates.sourceTitle })
        .from(coinTimelineUpdates)
        .where(eq(coinTimelineUpdates.coinSymbol, symbol))
        .orderBy(desc(coinTimelineUpdates.createdAt))
        .limit(1);

    if (timeline.length > 0 && timeline[0].sourceTitle) {
        return timeline[0].sourceTitle;
    }

    const news = await db.select({ headline: coinNews.headline })
        .from(coinNews)
        .where(eq(coinNews.coinSymbol, symbol))
        .orderBy(desc(coinNews.publishedAt))
        .limit(1);

    if (news.length > 0 && news[0].headline) {
        return news[0].headline;
    }

    const raw = await db.select({ title: rawNewsBuffer.title })
        .from(rawNewsBuffer)
        .where(
            sql`${rawNewsBuffer.symbolMentions}::jsonb @> ${JSON.stringify([symbol])}::jsonb`
        )
        .orderBy(desc(rawNewsBuffer.retrievedAt))
        .limit(1);

    if (raw.length > 0 && raw[0].title) {
        return raw[0].title;
    }

    return null;
}

async function findIncompleteArticles(): Promise<typeof coinMasterArticles.$inferSelect[]> {
    const allRows = await db.select().from(coinMasterArticles);

    return allRows.filter(row => {
        return SECTION_COLUMNS.some(sectionKey => {
            const value = row[sectionKey as keyof typeof row] as string | null;
            return isSectionIncomplete(value);
        });
    });
}

async function repairCoin(coin: typeof coinMasterArticles.$inferSelect): Promise<boolean> {
    const symbol = coin.coinSymbol;
    console.log(`\n━━━ Repairing: ${symbol} (id: ${coin.id}) ━━━`);

    const incompleteSections = SECTION_COLUMNS.filter(sectionKey => {
        const value = coin[sectionKey as keyof typeof coin] as string | null;
        return isSectionIncomplete(value);
    });
    console.log(`  Missing/incomplete sections: ${incompleteSections.join(', ')}`);

    const headline = await fetchLatestHeadline(symbol);
    if (!headline) {
        console.error(`  ✘ No headline found for ${symbol} — skipping`);
        return false;
    }
    console.log(`  Headline: "${headline.slice(0, 80)}..."`);

    try {
        const intelligence = await getCoinIntelligence(symbol);
        console.log(`  ✓ Coin intelligence gathered (${intelligence.dataSource})`);

        const pattern = await buildTemporalPattern(symbol, 'Other', 1);
        if (pattern) {
            console.log(`  ✓ Temporal pattern: ${pattern.sampleSize} samples, bullish ${pattern.bullishRate}`);
        } else {
            console.log(`  ⚠ No temporal pattern available`);
        }

        const price = await getPriceWithFallback(symbol);
        if (price) {
            console.log(`  ✓ Price: $${price.price} (${price.source})`);
        }

        let analysisResult: DeepAnalysisResult;
        try {
            analysisResult = await callDeepSeekAnalysis({
                headline,
                intelligence,
                pattern,
                price: price ?? null,
                coinSymbol: symbol,
            });
            console.log(`  ✓ DeepSeek analysis: verdict=${analysisResult.verdict}, confidence=${analysisResult.confidenceScore}`);
        } catch (err) {
            console.error(`  ✘ DeepSeek analysis failed:`, err instanceof Error ? err.message : String(err));
            return false;
        }

        let article: ArticleWriterResult;
        try {
            article = await callGptNanoWriter(JSON.stringify(analysisResult), 'professional');
            console.log(`  ✓ Article generated: ${article.fullArticle.length} chars`);
        } catch (err) {
            console.error(`  ✘ GPT-nano writer failed:`, err instanceof Error ? err.message : String(err));
            return false;
        }

        const extractedSections: Partial<Record<SectionKey, string | null>> = {};
        for (const sectionKey of SECTION_COLUMNS) {
            const tag = SECTION_TAG_MAP[sectionKey];
            extractedSections[sectionKey] = extractSection(article.fullArticle, tag);
        }

        const stillMissing = Object.entries(extractedSections)
            .filter(([, v]) => !v)
            .map(([k]) => k);

        if (stillMissing.length > 0) {
            console.warn(`  ⚠ Sections still missing after extraction: ${stillMissing.join(', ')}`);
        }

        const updatePayload: Record<string, unknown> = {
            ...extractedSections,
            headline: article.headline,
            hook: article.hook,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
            seoKeywords: article.seoKeywords,
            sentiment: analysisResult.sentiment,
            verdict: analysisResult.verdict,
            confidenceScore: analysisResult.confidenceScore,
            updatedAt: sql`NOW()`,
        };

        await db.update(coinMasterArticles)
            .set(updatePayload)
            .where(eq(coinMasterArticles.id, coin.id));

        console.log(`  ✓ DB updated for ${symbol}`);
        return true;
    } catch (err) {
        console.error(`  ✘ Repair failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
        return false;
    }
}

export async function runArticleRepair(): Promise<{ repaired: number; failed: number }> {
    const FLAG_NAME = 'repair_incomplete_articles_v1';
    
    try {
        const [existing] = await db.select({ id: migrationFlags.id })
            .from(migrationFlags)
            .where(eq(migrationFlags.flagName, FLAG_NAME))
            .limit(1);

        if (existing) {
            return { repaired: 0, failed: 0 };
        }
    } catch {
        // Table might not exist yet during first boot
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('  REPAIR INCOMPLETE MASTER ARTICLES');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Started at: ${new Date().toISOString()}`);

    const incompleteArticles = await findIncompleteArticles();

    if (incompleteArticles.length === 0) {
        console.log('\n✓ All master articles are complete. No repairs needed.');
        return { repaired: 0, failed: 0 };
    }

    console.log(`\nFound ${incompleteArticles.length} incomplete article(s).`);
    console.log('─────────────────────────────────────────────────────');

    let repaired = 0;
    let failed = 0;

    for (let i = 0; i < incompleteArticles.length; i++) {
        const success = await repairCoin(incompleteArticles[i]);
        if (success) {
            repaired++;
        } else {
            failed++;
        }

        if (i < incompleteArticles.length - 1) {
            console.log(`  Waiting ${DELAY_BETWEEN_COINS_MS / 1000}s before next coin...`);
            await sleep(DELAY_BETWEEN_COINS_MS);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  SUMMARY: ${repaired} repaired, ${failed} failed, ${incompleteArticles.length} total`);
    console.log(`  Finished at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');
    
    try {
        await db.insert(migrationFlags).values({ flagName: FLAG_NAME }).onConflictDoNothing();
    } catch {}

    return { repaired, failed };
}

if (require.main === module) {
    import('../config/db').then(({ pool }) => {
        runArticleRepair()
            .then(() => {
                pool.end();
                process.exit(0);
            })
            .catch((err) => {
                console.error('Fatal error:', err);
                process.exit(1);
            });
    });
}
