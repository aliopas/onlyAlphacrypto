import cron from 'node-cron';
import { db } from '../config/db';
import { dailyMarketMood, radarSignals } from '../models/index';
import { getFearAndGreed } from '../services/binance.service';
import { deleteCache } from '../config/redis';
import { gte } from 'drizzle-orm';
import { logger } from '../utils/logger';

const MOOD_LABELS: Array<{ max: number; label: string }> = [
    { max: 20, label: 'Extreme Fear' },
    { max: 40, label: 'Fear' },
    { max: 60, label: 'Neutral' },
    { max: 80, label: 'Greed' },
    { max: 100, label: 'Extreme Greed' },
];

function getMoodLabel(score: number): string {
    return MOOD_LABELS.find((m) => score <= m.max)?.label || 'Neutral';
}

export async function computeMarketMood(): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // External score from Alternative.me. Returns null on failure (not {value:0}) so we
        // don't corrupt the day's mood with a bogus Extreme-Fear reading.
        const external = await getFearAndGreed();
        if (external === null) {
            logger.warn('[MarketMood] External Fear & Greed unavailable — skipping today\'s mood row to avoid persisting bad data.');
            return;
        }

        // Internal score: average impact scores of our AI radar (bullish = higher, bearish = lower)
        const recentSignals = await db
            .select()
            .from(radarSignals)
            .where(gte(radarSignals.createdAt, past24h));

        let internalScore = 50; // neutral default
        if (recentSignals.length > 0) {
            const bullish = recentSignals.filter((s) => s.sentiment === 'bullish').length;
            const bearish = recentSignals.filter((s) => s.sentiment === 'bearish').length;
            const total = recentSignals.length;
            internalScore = 50 + ((bullish - bearish) / total) * 50;
        }

        // Hybrid: 60% external + 40% internal
        const finalScore = (external.value * 0.6) + (internalScore * 0.4);

        await db.insert(dailyMarketMood).values({
            externalScore: external.value,
            internalScore,
            finalScore,
            label: getMoodLabel(finalScore),
            validForDate: today,
        }).onConflictDoNothing();

        await deleteCache('mood:today');
        logger.info('[MarketMood] External: %d | Internal: %.1f | Final: %.1f (%s)', external.value, internalScore, finalScore, getMoodLabel(finalScore));
    } catch (err) {
        logger.error('[MarketMood] Failed: %s', err instanceof Error ? err.message : String(err));
    }
}

// ─── Schedule: 07:00 UTC daily ───────────────────────────────────────────────

export function startMarketMoodCron(): void {
    cron.schedule('0 7 * * *', () => { void computeMarketMood(); }, { timezone: 'UTC' });
    logger.info('[MarketMood] Cron scheduled — 07:00 UTC daily');
}
