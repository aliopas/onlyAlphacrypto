import cron from 'node-cron';
import { env } from '../config/env';
import { getUnresolvedShadowSignals, resolveShadowSignal72h, resolveShadowSignal7d } from '../services/shadowSignals.service';
import { getLivePrices } from '../services/binance.service';
import { logger } from '../config/logger';

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
        let processed72h = 0;
        let processed7d = 0;

        // Process each signal
        for (const signal of unresolvedSignals) {
            const ageHours = (now.getTime() - signal.createdAt.getTime()) / (1000 * 60 * 60);

            // Check if 72h resolution is due and not yet resolved
            if (ageHours >= 72 && signal.price72h === null) {
                const price72h = livePrices[signal.coinSymbol];
                if (price72h !== undefined) {
                    try {
                        await resolveShadowSignal72h(signal.id, price72h);
                        processed72h++;
                        console.log(`[ShadowChecker] Resolved 72h for signal ${signal.id} (${signal.coinSymbol})`);
                    } catch (error) {
                        logger.error('[ShadowChecker] Failed to resolve 72h for signal %d: %s', signal.id, error instanceof Error ? error.message : String(error));
                    }
                } else {
                    logger.warn('[ShadowChecker] No price available for %s at 72h check', signal.coinSymbol);
                }
            }

            // Check if 7d resolution is due and not yet resolved
            if (ageHours >= (7 * 24) && signal.price7d === null) {
                const price7d = livePrices[signal.coinSymbol];
                if (price7d !== undefined) {
                    try {
                        await resolveShadowSignal7d(signal.id, price7d);
                        processed7d++;
                        console.log(`[ShadowChecker] Resolved 7d for signal ${signal.id} (${signal.coinSymbol})`);
                    } catch (error) {
                        logger.error('[ShadowChecker] Failed to resolve 7d for signal %d: %s', signal.id, error instanceof Error ? error.message : String(error));
                    }
                } else {
                    logger.warn('[ShadowChecker] No price available for %s at 7d check', signal.coinSymbol);
                }
            }
        }

        console.log(`[ShadowChecker] Completed — ${processed72h} signals resolved at 72h, ${processed7d} signals resolved at 7d`);

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