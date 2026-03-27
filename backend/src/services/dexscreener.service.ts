import axios from 'axios';

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';
const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/tokens/v1';

export interface DexTokenInfo {
    address: string;
    symbol: string;
    name: string;
    priceUsd: string;
    priceChange24h: number; // Added for volatility tracking
    liquidityUsd: number;
    volume24h: number;
    fdv: number;
    pairCreatedAt: number;
}

// Phase 1 (Hunter): Get tokens from DexScreener (we use token profiles endpoint or general search for trending,
// but Dexscreener doesn't have a direct "trending" endpoint without authentication for the API.
// Alternatively, we can search for popular keywords if "trending" is not available publicly.)
export async function getTopBoostedTokens(): Promise<Array<{ symbol: string; address: string }>> {
    try {
        const resProfiles = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 10000 });
        if (!resProfiles.data || !Array.isArray(resProfiles.data)) return [];

        const addresses = resProfiles.data
            .map((t: any) => t.tokenAddress)
            .filter(Boolean)
            .slice(0, 30);

        if (addresses.length === 0) return [];

        const addressesString = addresses.join(',');
        const resPairs = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${addressesString}`, { timeout: 10000 });

        if (!resPairs.data || !resPairs.data.pairs) return [];

        const validTokens: Array<{ symbol: string; address: string }> = [];
        const seenAddresses = new Set<string>();

        resPairs.data.pairs.forEach((pair: any) => {
            const symbol = pair.baseToken.symbol;
            const address = pair.baseToken.address;

            const liquidityUsd = pair.liquidity?.usd || 0;
            const volume24h = pair.volume?.h24 || 0;
            const pairCreatedAtMsg = pair.pairCreatedAt || Date.now();
            const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

            if (
                symbol && symbol.trim() !== '' && symbol.toUpperCase() !== 'UNKNOWN' &&
                !seenAddresses.has(address) &&
                liquidityUsd >= 5000 &&
                volume24h >= 1000 &&
                pairCreatedAtMsg < twentyFourHoursAgo
            ) {
                seenAddresses.add(address);
                validTokens.push({ symbol, address });
            }
        });

        return validTokens.slice(0, 10);
    } catch (err) {
        console.error('[DexScreener] Error fetching boosted tokens:', err);
        return [];
    }
}

// Phase 2 (Aggregator): Get specific token data
export async function getTokenData(address: string): Promise<DexTokenInfo | null> {
    try {
        // Find best pair for token address
        const res = await axios.get(`${DEXSCREENER_BASE}/tokens/${address}`, { timeout: 8000 });

        if (!res.data || !res.data.pairs || res.data.pairs.length === 0) {
            return null;
        }

        // The first pair is usually the most liquid on DexScreener
        const pair = res.data.pairs[0];

        return {
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            priceUsd: pair.priceUsd,
            priceChange24h: pair.priceChange?.h24 || 0, // Populate from h24 price change
            liquidityUsd: pair.liquidity?.usd || 0,
            volume24h: pair.volume?.h24 || 0,
            fdv: pair.fdv || 0,
            pairCreatedAt: pair.pairCreatedAt || 0,
        };
    } catch (err) {
        console.error(`[DexScreener] Error fetching token data for ${address}:`, err);
        return null;
    }
}
