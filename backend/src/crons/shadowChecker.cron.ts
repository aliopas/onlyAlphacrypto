import cron from 'node-cron';
import { env } from '../config/env';
import { getUnresolvedShadowSignals, resolveShadowSignals72hBatch, resolveShadowSignals7dBatch } from '../services/shadowSignals.service';
import { getLivePrices } from '../services/binance.service';
import { logger } from '../utils/logger';

// Lock to prevent concurrent runs
let isShadowCheckerRunning = false;

export async function runShadowChecker(): Promise<void> {
    // Check if shadow mode is enabled
    if (!env.SHADOW_MODE_ENABLED) {
        return;
    }

    // Prevent concurrent runs
    if (isShadowCheckerRunning) {
        console.log('⏳ [ShadowChecker] Already running, skipping...');
        return;
    }

    isShadowCheckerRunning = true;
    console.log('👥 [ShadowChecker] Running — resolving shadow signals...');

    try {
        // Get all unresolved shadow signals
        const unresolvedSignals = await getUnresolvedShadowSignals();

        if (unresolvedSignals.length === 0) {
            console.log('[ShadowChecker] No unresolved signals to check.');
            return;
        }

        console.log(`[ShadowChecker] Found ${unresolvedSignals.length} unresolved signals`);

        // Group signals by coin for efficient price fetching
        const coinSymbols = [...new Set(unresolvedSignals.map(s => s.coinSymbol))];

        // Fetch live prices for all relevant coins
        let livePrices: Record<string, number> = {};
        try {
            livePrices = await getLivePrices(coinSymbols);
        } catch (error) {
            logger.error('[ShadowChecker] Failed to fetch live prices: %s', error instanceof Error ? error.message : String(error));
            return; // Cannot proceed without prices
        }

        const now = new Date();

        // Collect signals ready for 72h and 7d resolution
        const signals72h = unresolvedSignals
            .filter(s => {
                const ageHours = (now.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
                return ageHours >= 72 && s.price72h === null && livePrices[s.coinSymbol] !== undefined;
            })
            .map(s => ({
                id: s.id,
                coinSymbol: s.coinSymbol,
                algorithmVerdict: s.algorithmVerdict,
                algorithmEntry: s.algorithmEntry,
                aiVerdict: s.aiVerdict,
                aiEntry: s.aiEntry,
            }));

        const signals7d = unresolvedSignals
            .filter(s => {
                const ageHours = (now.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
                return ageHours >= (7 * 24) && s.price7d === null && livePrices[s.coinSymbol] !== undefined;
            })
            .map(s => ({
                id: s.id,
                coinSymbol: s.coinSymbol,
                algorithmVerdict: s.algorithmVerdict,
                algorithmEntry: s.algorithmEntry,
                aiVerdict: s.aiVerdict,
                aiEntry: s.aiEntry,
            }));

        // Batch resolve 72h signals — no redundant SELECTs
        if (signals72h.length > 0) {
            try {
                await resolveShadowSignals72hBatch(signals72h, livePrices);
                console.log(`[ShadowChecker] Resolved ${signals72h.length} signals at 72h`);
            } catch (error) {
                logger.error('[ShadowChecker] Failed to resolve 72h batch: %s', error instanceof Error ? error.message : String(error));
            }
        }

        // Batch resolve 7d signals — no redundant SELECTs
        if (signals7d.length > 0) {
            try {
                await resolveShadowSignals7dBatch(signals7d, livePrices);
                console.log(`[ShadowChecker] Resolved ${signals7d.length} signals at 7d`);
            } catch (error) {
                logger.error('[ShadowChecker] Failed to resolve 7d batch: %s', error instanceof Error ? error.message : String(error));
            }
        }

        console.log(`[ShadowChecker] Completed — ${signals72h.length} signals resolved at 72h, ${signals7d.length} signals resolved at 7d`);

    } catch (error) {
        logger.error('[ShadowChecker] Unexpected error: %s', error instanceof Error ? error.message : String(error));
    } finally {
        isShadowCheckerRunning = false;
    }
}

// Schedule to run every 15 minutes
export function startShadowChecker(): void {
    cron.schedule('*/15 * * * *', async () => {
        try {
            await runShadowChecker();
        } catch (error) {
            logger.error('[ShadowChecker] Cron job failed: %s', error instanceof Error ? error.message : String(error));
        }
    });

    console.log('🕒 [ShadowChecker] Scheduled to run every 15 minutes');
}