import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { fetchCandles, calculateLevelsAndInteractions, saveLevels, saveInteractions, LevelData, InteractionData } from '../services/levelIntelligence.service';
import { db } from '../config/db';
import { levelIntelligence } from '../models/market.model';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const MAJOR_COINS = ['BTC', 'ETH', 'SOL', 'ADA', 'LINK', 'DOT', 'AVAX', 'MATIC'];

export async function runLevelIntelligenceCron(): Promise<void> {
    logger.info('[LevelIntelligenceCron] Starting run...');

    if (!env.LEVEL_INTELLIGENCE_ENABLED) {
        logger.info('[LevelIntelligenceCron] Disabled by LEVEL_INTELLIGENCE_ENABLED=false');
        return;
    }

    const timeframes = env.LEVEL_INTELLIGENCE_TIMEFRAMES.split(',').map(t => t.trim() as '1h' | '4h' | '1d' | '1w');
    const maxCoins = env.LEVEL_INTELLIGENCE_MAX_COINS;
    const selectedCoins = MAJOR_COINS.slice(0, maxCoins);

    logger.info('[LevelIntelligenceCron] Processing %d coins across %d timeframes', selectedCoins.length, timeframes.length);

    let totalLevelsUpdated = 0;
    const timeframeSummary: Record<string, { success: number; failure: number }> = {};

    for (const timeframe of timeframes) {
        timeframeSummary[timeframe] = { success: 0, failure: 0 };
    }

    for (const coinSymbol of selectedCoins) {
        for (const timeframe of timeframes) {
            try {
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                logger.debug('[LevelIntelligenceCron] Processing %s %s', coinSymbol, timeframe);

                const candles = await fetchCandles(coinSymbol, timeframe);
                if (candles.length < 10) {
                    logger.warn('[LevelIntelligenceCron] Insufficient candles for %s %s: %d', coinSymbol, timeframe, candles.length);
                    timeframeSummary[timeframe].failure++;
                    continue;
                }

                const { levels, interactionsByPrice } = calculateLevelsAndInteractions(candles, timeframe, coinSymbol);
                if (levels.length === 0) {
                    logger.debug('[LevelIntelligenceCron] No levels found for %s %s', coinSymbol, timeframe);
                    timeframeSummary[timeframe].success++;
                    continue;
                }

                // Save levels and get their IDs
                await saveLevels(levels);

                // Get the saved level IDs by querying with tolerance
                const savedLevelIds = new Map<number, number>();
                for (const level of levels) {
                    const tolerance = 0.01;
                    const minPrice = level.levelPrice * (1 - tolerance);
                    const maxPrice = level.levelPrice * (1 + tolerance);

                    const existing = await db.select({ id: levelIntelligence.id, levelPrice: levelIntelligence.levelPrice })
                        .from(levelIntelligence)
                        .where(and(
                            eq(levelIntelligence.coinSymbol, level.coinSymbol),
                            eq(levelIntelligence.timeframe, level.timeframe),
                            eq(levelIntelligence.levelType, level.levelType),
                            gte(sql`${levelIntelligence.levelPrice}::numeric`, minPrice),
                            lte(sql`${levelIntelligence.levelPrice}::numeric`, maxPrice)
                        ))
                        .limit(1);

                    if (existing.length > 0) {
                        savedLevelIds.set(level.levelPrice, existing[0].id);
                    }
                }

                // Save interactions
                const allInteractions: InteractionData[] = [];
                for (const level of levels) {
                    const levelId = savedLevelIds.get(level.levelPrice);
                    if (levelId) {
                        const interactions = interactionsByPrice.get(level.levelPrice) || [];
                        interactions.forEach(interaction => {
                            interaction.levelId = levelId;
                            allInteractions.push(interaction);
                        });
                    }
                }

                if (allInteractions.length > 0) {
                    await saveInteractions(allInteractions);
                }

                totalLevelsUpdated += levels.length;
                timeframeSummary[timeframe].success++;

                logger.debug('[LevelIntelligenceCron] Processed %s %s: %d levels, %d interactions', coinSymbol, timeframe, levels.length, allInteractions.length);

            } catch (error) {
                logger.error('[LevelIntelligenceCron] Failed to process %s %s: %s', coinSymbol, timeframe, error instanceof Error ? error.message : String(error));
                timeframeSummary[timeframe].failure++;
            }
        }
    }

    logger.info('[LevelIntelligenceCron] Run complete. Total levels updated: %d', totalLevelsUpdated);
    for (const [timeframe, summary] of Object.entries(timeframeSummary)) {
        logger.info('[LevelIntelligenceCron] %s: %d success, %d failure', timeframe, summary.success, summary.failure);
    }
}

export function startLevelIntelligenceCron(): void {
    cron.schedule('0 */6 * * *', () => runLevelIntelligenceCron()); // Every 6 hours
    console.log('⏰ LevelIntelligence scheduled — every 6 hours');
}