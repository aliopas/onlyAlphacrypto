import cron from 'node-cron';
import { db } from '../config/db';
import { marketInsights, dailyAlphaFocus } from '../models/index';
import { deleteCache } from '../config/redis';
import { desc, eq, and, gte } from 'drizzle-orm';

// ─── Ranking algorithm: pick today's best STRONG_BUY ─────────────────────────

export async function selectDailyAlpha(): Promise<void> {
    console.log('⭐ [DailyAlpha] Running daily alpha selection...');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Hard filter: STRONG_BUY with >= 85% confidence in last 24h
    const candidates = await db
        .select()
        .from(marketInsights)
        .where(
            and(
                eq(marketInsights.verdict, 'STRONG_BUY'),
                gte(marketInsights.analyzedAt, yesterday)
            )
        )
        .orderBy(desc(marketInsights.confidenceScore));

    if (!candidates.length) {
        console.log('[DailyAlpha] No STRONG_BUY candidates today — will use best BUY or fallback');
        // Try BUY as fallback
        const fallback = await db
            .select()
            .from(marketInsights)
            .where(gte(marketInsights.analyzedAt, yesterday))
            .orderBy(desc(marketInsights.confidenceScore))
            .limit(1);

        if (!fallback.length) {
            console.log('[DailyAlpha] No candidates at all. Skipping.');
            return;
        }
        candidates.push(fallback[0]);
    }

    // Composite scoring: Confidence 40% + Volume 25% + TVL 20% + Social 15%
    const scored = candidates.map((c) => ({
        ...c,
        compositeScore:
            (c.confidenceScore * 0.4) +
            ((c.volumeSurge || 0) * 0.25) +
            ((c.tvlChange || 0) * 0.2) +
            ((c.socialMomentum || 0) * 0.15),
    }));

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const winner = scored[0];

    await db.insert(dailyAlphaFocus).values({
        insightId: winner.id,
        coinSymbol: winner.coinSymbol,
        coinName: winner.coinName,
        coinSlug: winner.coinSlug,
        verdict: winner.verdict,
        confidenceScore: winner.confidenceScore,
        executiveSummary: winner.executiveSummary,
        compositeScore: winner.compositeScore,
        validForDate: today,
    }).onConflictDoNothing();

    await deleteCache('alpha-focus:today');
    console.log(`✅ [DailyAlpha] Selected: ${winner.coinName} (${winner.coinSymbol}) | Score: ${winner.compositeScore.toFixed(1)}`);
}

// ─── Schedule: 06:00 UTC daily ───────────────────────────────────────────────

export function startDailyAlphaCron(): void {
    cron.schedule('0 6 * * *', selectDailyAlpha, { timezone: 'UTC' });
    console.log('⏰ Daily Alpha Selection cron scheduled — 06:00 UTC daily');
}
