import cron from 'node-cron';
import { db } from '../config/db';
import { coinMasterArticles, dailyAlphaFocus } from '../models/index';
import { deleteCache } from '../config/redis';
import { desc, sql, lt } from 'drizzle-orm';

export async function selectDailyAlpha(): Promise<void> {
    console.log('⭐ [DailyAlpha] Running alpha selection...');

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const candidateFields = {
        id: coinMasterArticles.id,
        coinSymbol: coinMasterArticles.coinSymbol,
        verdict: coinMasterArticles.verdict,
        confidenceScore: coinMasterArticles.confidenceScore,
        convictionScore: coinMasterArticles.convictionScore,
        majorUpdateCount: coinMasterArticles.majorUpdateCount,
        minorUpdateCount: coinMasterArticles.minorUpdateCount,
        bottomLine: coinMasterArticles.bottomLine,
        hook: coinMasterArticles.hook,
        headline: coinMasterArticles.headline,
        updatedAt: coinMasterArticles.updatedAt,
        posture: coinMasterArticles.posture,
    };

    const candidates = await db
        .select(candidateFields)
        .from(coinMasterArticles)
        .where(
            sql`${coinMasterArticles.verdict} IN ('STRONG_BUY', 'BUY') AND ${coinMasterArticles.confidenceScore} >= 60`
        );

    if (!candidates.length) {
        console.log('[DailyAlpha] No STRONG_BUY/BUY candidates — using fallback');
        const fallback = await db
            .select(candidateFields)
            .from(coinMasterArticles)
            .where(sql`${coinMasterArticles.confidenceScore} IS NOT NULL`)
            .orderBy(desc(coinMasterArticles.confidenceScore))
            .limit(1);

        if (!fallback.length) {
            console.log('[DailyAlpha] No candidates at all. Skipping.');
            return;
        }
        candidates.push(...fallback);
    }

    const scored = candidates.map((c) => {
        const confidence = c.confidenceScore ?? 50;
        const conviction = c.convictionScore ?? 50;
        const activity = Math.min((c.majorUpdateCount * 15) + (c.minorUpdateCount * 3), 100);
        const hoursSinceUpdate = c.updatedAt
            ? (now.getTime() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60)
            : 48;
        const recency = Math.max(0, 100 - (hoursSinceUpdate * 2.08));

        const compositeScore =
            (confidence * 0.35) +
            (conviction * 0.35) +
            (activity * 0.15) +
            (recency * 0.15);

        return { ...c, compositeScore };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const winner = scored[0];

    const coinSlug = winner.coinSymbol.toLowerCase();
    const executiveSummary = winner.bottomLine || winner.hook || winner.headline || '';

    await db.insert(dailyAlphaFocus).values({
        masterArticleId: winner.id,
        coinSymbol: winner.coinSymbol,
        coinName: winner.coinSymbol,
        coinSlug,
        verdict: winner.verdict || 'NEUTRAL',
        confidenceScore: winner.confidenceScore ?? 50,
        executiveSummary,
        compositeScore: winner.compositeScore,
        validForDate: today,
    }).onConflictDoNothing();

    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await db.delete(dailyAlphaFocus).where(lt(dailyAlphaFocus.validForDate, cutoff)).catch(() => {});

    await deleteCache('alpha-focus:today');

    console.log(
        `✅ [DailyAlpha] Selected: ${winner.coinSymbol} (${winner.posture}) | Composite: ${winner.compositeScore.toFixed(1)}`
    );
}

export function startDailyAlphaCron(): void {
    cron.schedule('0 */8 * * *', selectDailyAlpha, { timezone: 'UTC' });
    console.log('⏰ Alpha Selection cron scheduled — every 8 hours (00:00, 08:00, 16:00 UTC)');
}
