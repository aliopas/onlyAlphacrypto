import { db } from '../config/db';
import { coinMasterArticles } from '../models/market.model';
import { eq } from 'drizzle-orm';
import { callGptNanoMasterUpdate } from '../services/openai.service';
import { migrationFlags } from '../models/market.model';
import { DeepAnalysisResult } from '../services/openai.service';

const GENERIC_TITLE_PATTERNS = ['Analysis | OnlyAlpha', '| OnlyAlpha'];
const GENERIC_DESC_PATTERNS = ['Read the analysis on OnlyAlpha.', 'market analysis:'];
const MIN_TITLE_LENGTH = 20;
const MIN_DESC_LENGTH = 40;
const DELAY_BETWEEN_COINS_MS = 5000;

function isMetaTagPoor(title: string | null, description: string | null): boolean {
    if (!title || title.trim().length < MIN_TITLE_LENGTH) return true;
    if (GENERIC_TITLE_PATTERNS.some(p => title.includes(p))) return true;
    if (!description || description.trim().length < MIN_DESC_LENGTH) return true;
    if (GENERIC_DESC_PATTERNS.some(p => description.includes(p))) return true;
    return false;
}

async function findPoorMetaArticles(): Promise<typeof coinMasterArticles.$inferSelect[]> {
    const allRows = await db.select().from(coinMasterArticles);
    return allRows.filter(row => isMetaTagPoor(row.metaTitle, row.metaDescription));
}

async function repairCoinMeta(coin: typeof coinMasterArticles.$inferSelect): Promise<boolean> {
    const VALID_SENTIMENTS = ['bullish', 'bearish', 'neutral'] as const;
    const sentimentValue = coin.sentiment && VALID_SENTIMENTS.includes(coin.sentiment as typeof VALID_SENTIMENTS[number])
        ? (coin.sentiment as 'bullish' | 'bearish' | 'neutral')
        : 'neutral';

    const VALID_VERDICTS = ['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'] as const;
    const verdictValue = coin.verdict && VALID_VERDICTS.includes(coin.verdict as typeof VALID_VERDICTS[number])
        ? (coin.verdict as 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL')
        : 'NEUTRAL';

    const stubAnalysis: DeepAnalysisResult = {
        sentiment: sentimentValue,
        impactScore: 50,
        isBreaking: false,
        coinSymbol: coin.coinSymbol,
        eventType: 'Other',
        eventSeverity: 1,
        analysis: {
            mainDriver: 'Market analysis update',
            priceImplication: 'Standard market conditions',
            temporalContext: null,
            riskNote: 'Standard risks apply',
        },
        keyFacts: ['Ongoing market analysis'],
        supportLevels: [],
        resistanceLevels: [],
        signalText: 'Market signal',
        verdict: verdictValue,
        confidenceScore: coin.confidenceScore || 50,
    };

    try {
        const updatedFields = await callGptNanoMasterUpdate(stubAnalysis, coin as Record<string, unknown>);
        if (updatedFields.metaTitle || updatedFields.metaDescription) {
            await db.update(coinMasterArticles)
                .set({
                    metaTitle: updatedFields.metaTitle || coin.metaTitle,
                    metaDescription: updatedFields.metaDescription || coin.metaDescription,
                    updatedAt: new Date(),
                })
                .where(eq(coinMasterArticles.id, coin.id));
            console.log(`[Repair Meta Tags] Updated ${coin.coinSymbol}: title="${updatedFields.metaTitle}", desc="${updatedFields.metaDescription}"`);
            return true;
        } else {
            console.log(`[Repair Meta Tags] No updates needed for ${coin.coinSymbol}`);
            return false;
        }
    } catch (error) {
        console.error(`[Repair Meta Tags] Failed to repair ${coin.coinSymbol}:`, error);
        return false;
    }
}

export async function runMetaTagRepair(): Promise<{ repaired: number; failed: number }> {
    const FLAG_NAME = 'repair_meta_tags_v2';

    const existingFlag = await db.select().from(migrationFlags).where(eq(migrationFlags.flagName, FLAG_NAME)).limit(1);
    if (existingFlag.length > 0) {
        console.log(`[Repair Meta Tags] Already completed (${FLAG_NAME}). Skipping.`);
        return { repaired: 0, failed: 0 };
    }

    const poorArticles = await findPoorMetaArticles();
    console.log(`[Repair Meta Tags] Found ${poorArticles.length} articles with poor meta tags`);

    let repaired = 0;
    let failed = 0;
    const CONCURRENCY_LIMIT = 2;
    const batches: typeof poorArticles[] = [];

    for (let i = 0; i < poorArticles.length; i += CONCURRENCY_LIMIT) {
        batches.push(poorArticles.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const batch of batches) {
        const promises = batch.map(async (coin) => {
            const success = await repairCoinMeta(coin);
            if (success) repaired++;
            else failed++;
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_COINS_MS));
        });
        await Promise.all(promises);
    }

    await db.insert(migrationFlags).values({ flagName: FLAG_NAME, executedAt: new Date() });
    console.log(`[Repair Meta Tags] Completed: repaired=${repaired}, failed=${failed}`);

    return { repaired, failed };
}

if (require.main === module) {
    runMetaTagRepair().then(() => process.exit(0)).catch(err => {
        console.error('Repair script failed:', err);
        process.exit(1);
    });
}