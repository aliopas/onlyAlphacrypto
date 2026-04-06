import { getRecentMemory } from '../coin-memory.service';
import { getTokenData } from '../dexscreener.service';
import { searchTavily } from '../tavily.service';

export interface CoinContext {
    coinSymbol: string;
    recentMemory: Array<{
        eventType: string;
        eventSummary: string;
        verdict?: string | null;
        confidenceScore?: number | null;
        riskVerdict?: string | null;
        keyDrivers?: string[] | null;
        redFlags?: string[] | null;
    }>;
    marketData: Record<string, unknown> | null;
    onchainData: Record<string, unknown> | null;
    tavilyContext: string;
}

export async function gatherCoinContext(coinSymbol: string): Promise<CoinContext> {
    console.log(`[DataAugmenter] Fetching all context for ${coinSymbol} in parallel...`);

    const [memoryResult, marketResult, tavilyResult] = await Promise.allSettled([
        getRecentMemory(coinSymbol),
        getTokenData(coinSymbol),
        searchTavily(`${coinSymbol} crypto news analysis`),
    ]);

    let recentMemory: CoinContext['recentMemory'] = [];
    if (memoryResult.status === 'fulfilled') {
        recentMemory = memoryResult.value.map(m => ({
            eventType: m.eventType,
            eventSummary: m.eventSummary,
            verdict: m.verdict,
            confidenceScore: m.confidenceScore,
            riskVerdict: m.riskVerdict,
            keyDrivers: m.keyDrivers as string[] | undefined,
            redFlags: m.redFlags as string[] | undefined,
        }));
    } else {
        console.error(`[DataAugmenter] Memory fetch failed for ${coinSymbol}:`, memoryResult.reason);
    }

    let marketData: CoinContext['marketData'] = null;
    if (marketResult.status === 'fulfilled') {
        marketData = marketResult.value as unknown as Record<string, unknown> ?? null;
    } else {
        console.error(`[DataAugmenter] Market data fetch failed for ${coinSymbol}:`, marketResult.reason);
    }

    let tavilyContext: CoinContext['tavilyContext'] = '';
    if (tavilyResult.status === 'fulfilled') {
        tavilyContext = tavilyResult.value;
    } else {
        console.error(`[DataAugmenter] Tavily fetch failed for ${coinSymbol}:`, tavilyResult.reason);
    }

    return {
        coinSymbol,
        recentMemory,
        marketData,
        onchainData: null,
        tavilyContext,
    };
}
