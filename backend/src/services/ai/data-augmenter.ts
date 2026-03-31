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
    console.log(`[DataAugmenter] Fetching memory for ${coinSymbol}...`);
    let recentMemory: CoinContext['recentMemory'] = [];
    try {
        const memoryResult = await getRecentMemory(coinSymbol);
        recentMemory = memoryResult.map(m => ({
            eventType: m.eventType,
            eventSummary: m.eventSummary,
            verdict: m.verdict,
            confidenceScore: m.confidenceScore,
            riskVerdict: m.riskVerdict,
            keyDrivers: m.keyDrivers as string[] | undefined,
            redFlags: m.redFlags as string[] | undefined,
        }));
    } catch (error) {
        console.error(`[DataAugmenter] Error fetching memory for ${coinSymbol}:`, error);
        recentMemory = [];
    }

    console.log(`[DataAugmenter] Fetching market data for ${coinSymbol}...`);
    
    let marketData: CoinContext['marketData'] = null;
    try {
        const tokenData = await getTokenData("");
        marketData = tokenData as unknown as Record<string, unknown> ?? null;
    } catch (error) {
        console.error(`[DataAugmenter] Error fetching market data for ${coinSymbol}:`, error);
        marketData = null;
    }

    console.log(`[DataAugmenter] Fetching on-chain data for ${coinSymbol}...`);
    let onchainData: CoinContext['onchainData'] = null;
    // Skipping Moralis for now as it only supports wallet transactions, not token stats
    // Token-level on-chain data will be added in a future phase

    console.log(`[DataAugmenter] Fetching Tavily context for ${coinSymbol}...`);
    let tavilyContext: CoinContext['tavilyContext'] = '';
    try {
        const query = `${coinSymbol} crypto news analysis`;
        tavilyContext = await searchTavily(query);
    } catch (error) {
        console.error(`[DataAugmenter] Error fetching Tavily context for ${coinSymbol}:`, error);
        tavilyContext = '';
    }

    return {
        coinSymbol,
        recentMemory,
        marketData,
        onchainData,
        tavilyContext
    };
}