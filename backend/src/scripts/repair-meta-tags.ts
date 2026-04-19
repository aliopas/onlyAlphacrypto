import { db } from '../config/db';
import { coinMasterArticles } from '../models/market.model';
import { eq } from 'drizzle-orm';
import { gateway } from '../services/openai.service';
import { migrationFlags } from '../models/market.model';
import { env } from '../config/env';

const DELAY_BETWEEN_COINS_MS = 3000;

// Bad meta tag patterns — known fallback/generic values AI produces when it fails
const BAD_TITLE_PATTERNS = [
    'Analysis | OnlyAlpha',        // generic fallback from buildFallbackArticle
    'Market Analysis Update',       // generic fallback headline
    'CRYPTO Market Analysis',       // placeholder coin name
];
const MIN_TITLE_LENGTH = 15;
const MIN_DESC_LENGTH = 50;

function isMetaTagPoor(title: string | null | undefined, description: string | null | undefined): boolean {
    // Missing entirely
    if (!title || title.trim().length < MIN_TITLE_LENGTH) return true;
    if (!description || description.trim().length < MIN_DESC_LENGTH) return true;
    // Known bad/generic fallback patterns
    if (BAD_TITLE_PATTERNS.some(p => title.includes(p))) return true;
    // Description is bad if it's only the generic ending with no meaningful content
    if (description.trim() === 'Read the analysis on OnlyAlpha.') return true;
    if (description.trim().startsWith('market analysis:')) return true;
    if (description.trim().startsWith('AI-powered analysis for')) return true;
    return false;
}

async function generateMetaForCoin(coin: typeof coinMasterArticles.$inferSelect): Promise<{ metaTitle: string; metaDescription: string } | null> {
    const headline = coin.headline || `${coin.coinSymbol} Market Analysis`;
    const hook = coin.hook || '';
    const coreCatalyst = coin.coreCatalyst || '';
    const sentiment = coin.sentiment || 'neutral';
    const verdict = coin.verdict || 'NEUTRAL';
    const confidenceScore = coin.confidenceScore || 50;

    const prompt = `Generate SEO-optimized meta tags for a crypto article about ${coin.coinSymbol}.

Article headline: ${headline}
Article hook: ${hook.slice(0, 200)}
Core catalyst: ${coreCatalyst.slice(0, 200)}
Sentiment: ${sentiment}
Verdict: ${verdict}
Confidence: ${confidenceScore}%

Output ONLY this JSON object (no markdown, no explanation):
{
  "metaTitle": "<STRICT MAX 60 chars. Format: 'SYMBOL Action | OnlyAlpha'. Example: 'ETH Breaks $3K Resistance | OnlyAlpha'>",
  "metaDescription": "<STRICT MAX 160 chars. Start with coin name + key event. Must end with: Read the analysis on OnlyAlpha.>"
}

CRITICAL: metaTitle MUST be under 60 chars total. metaDescription MUST be under 160 chars total. Count carefully.`;

    try {
        const response = await gateway.chat<{ metaTitle?: string; metaDescription?: string }>({
            model: env.SEO_MODEL,
            temperature: 0.3,
            responseFormat: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You are an SEO expert for crypto content. Output ONLY valid JSON.' },
                { role: 'user', content: prompt }
            ],
        });

        let metaTitle = typeof response.metaTitle === 'string' ? response.metaTitle.trim() : null;
        let metaDescription = typeof response.metaDescription === 'string' ? response.metaDescription.trim() : null;

        // Enforce hard limits
        if (metaTitle && metaTitle.length > 60) metaTitle = metaTitle.slice(0, 60).trim();
        if (metaDescription && metaDescription.length > 160) metaDescription = metaDescription.slice(0, 160).trim();

        if (!metaTitle || metaTitle.length < MIN_TITLE_LENGTH) return null;
        if (!metaDescription || metaDescription.length < MIN_DESC_LENGTH) return null;

        return { metaTitle, metaDescription };
    } catch (error) {
        console.error(`[Repair Meta Tags] AI call failed for ${coin.coinSymbol}:`, error);
        return null;
    }
}

export async function runMetaTagRepair(): Promise<{ repaired: number; failed: number }> {
    // v3 flag forces re-run on databases with buggy v2 logic
    const FLAG_NAME = 'repair_meta_tags_v3';

    const existingFlag = await db.select().from(migrationFlags).where(eq(migrationFlags.flagName, FLAG_NAME)).limit(1);
    if (existingFlag.length > 0) {
        console.log(`[Repair Meta Tags] Already completed (${FLAG_NAME}). Skipping.`);
        return { repaired: 0, failed: 0 };
    }

    const allArticles = await db.select().from(coinMasterArticles);
    const poorArticles = allArticles.filter(row => isMetaTagPoor(row.metaTitle, row.metaDescription));

    console.log(`[Repair Meta Tags] Found ${poorArticles.length} articles with poor/missing meta tags out of ${allArticles.length} total`);

    let repaired = 0;
    let failed = 0;

    for (const coin of poorArticles) {
        console.log(`[Repair Meta Tags] Processing ${coin.coinSymbol}... (title: "${coin.metaTitle?.slice(0, 40) || 'NULL'}")`);

        const meta = await generateMetaForCoin(coin);
        if (!meta) {
            console.warn(`[Repair Meta Tags] ✗ Failed to generate for ${coin.coinSymbol}`);
            failed++;
        } else {
            await db.update(coinMasterArticles)
                .set({
                    metaTitle: meta.metaTitle,
                    metaDescription: meta.metaDescription,
                    updatedAt: new Date(),
                })
                .where(eq(coinMasterArticles.id, coin.id));
            console.log(`[Repair Meta Tags] ✓ ${coin.coinSymbol}: "${meta.metaTitle}" (${meta.metaTitle.length} chars)`);
            repaired++;
        }

        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_COINS_MS));
    }

    await db.insert(migrationFlags).values({ flagName: FLAG_NAME, executedAt: new Date() });
    console.log(`[Repair Meta Tags] Done: repaired=${repaired}, failed=${failed}`);

    return { repaired, failed };
}

if (require.main === module) {
    runMetaTagRepair().then((result) => {
        console.log('Final result:', result);
        process.exit(0);
    }).catch(err => {
        console.error('Repair script failed:', err);
        process.exit(1);
    });
}