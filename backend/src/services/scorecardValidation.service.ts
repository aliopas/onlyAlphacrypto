import { env } from '../config/env';
import { redis, getCache, setCache } from '../config/redis';
import { TRACKED_COIN_SET } from '../config/coins';

export interface ValidationGateResult {
    passed: boolean;
    reason?: string;
}

export interface ValidatedCoin {
    symbol: string;
    entryPrice: number;
    currentPrice: number;
    priceMovement: number;
    cexListings: string;
    coinGeckoId: string;
}

async function coinGeckoSearch(symbol: string): Promise<string | null> {
    const cacheKey = `scorecard:coingecko:search:${symbol}`;
    const cached = await getCache<string>(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${env.COINGECKO_BASE_URL}/search?query=${encodeURIComponent(symbol)}`);
        if (!res.ok) {
            console.warn(`[ScorecardValidation] CoinGecko search ${symbol} failed: HTTP ${res.status}`);
            return null;
        }

        const data = await res.json() as {
            coins?: Array<{ id: string; symbol: string; name: string }>;
        };

        const coin = data?.coins?.find(
            c => c.symbol.toLowerCase() === symbol.toLowerCase()
        );
        if (coin?.id) {
            await setCache(cacheKey, coin.id, 3600);
            return coin.id;
        }
        console.warn(`[ScorecardValidation] CoinGecko search ${symbol}: no match found`);
        return null;
    } catch (err) {
        console.error(`[ScorecardValidation] CoinGecko search ${symbol} error:`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

async function coinGeckoCheckCex(coinGeckoId: string): Promise<string | null> {
    const cacheKey = `scorecard:coingecko:${coinGeckoId}`;
    const cached = await getCache<string>(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${env.COINGECKO_BASE_URL}/coins/${coinGeckoId}/tickers?order=volume_desc&per_page=100`);
        if (!res.ok) {
            console.warn(`[ScorecardValidation] CoinGecko CEX check ${coinGeckoId} failed: HTTP ${res.status}`);
            return null;
        }

        const data = await res.json() as {
            tickers?: Array<{ exchange: { name?: string; market?: { name?: string } }; is_stale?: boolean; is_anomaly?: boolean }>;
        };

        const cexNames = new Set<string>();
        for (const ticker of data?.tickers ?? []) {
            const name = ticker.exchange?.name ?? ticker.exchange?.market?.name;
            if (name && !ticker.is_stale && !ticker.is_anomaly) {
                cexNames.add(name);
            }
        }

        if (cexNames.size === 0) {
            console.warn(`[ScorecardValidation] ${coinGeckoId}: No valid CEX listings found`);
            return null;
        }

        const listingStr = Array.from(cexNames).slice(0, 10).join(',');
        await setCache(cacheKey, listingStr, 3600);
        return listingStr;
    } catch (err) {
        console.error(`[ScorecardValidation] CoinGecko CEX check ${coinGeckoId} error:`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

async function binanceGetPrice(symbol: string): Promise<number | null> {
    try {
        const pair = `${symbol.toUpperCase()}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        if (!res.ok) {
            console.warn(`[ScorecardValidation] Binance price ${pair} failed: HTTP ${res.status}`);
            return null;
        }

        const data = await res.json() as { price?: string };
        if (!data?.price) return null;

        return parseFloat(data.price);
    } catch (err) {
        console.error(`[ScorecardValidation] Binance price ${symbol} error:`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

export async function validateScorecardCoin(
    extraction: { symbol: string; entryPrice: number }
): Promise<ValidatedCoin | null> {
    const { symbol, entryPrice } = extraction;

    const altcoinGate: ValidationGateResult = {
        passed: !TRACKED_COIN_SET.has(symbol.toUpperCase()),
        reason: 'Altcoin filter: symbol is a tracked major coin',
    };
    if (!altcoinGate.passed) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — tracked major coin`);
        return null;
    }

    const coinGeckoId = await coinGeckoSearch(symbol);
    if (!coinGeckoId) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — CoinGecko ID not found`);
        return null;
    }
    console.log(`[ScorecardValidation] ${symbol}: CoinGecko ID = ${coinGeckoId}`);

    const cexListings = await coinGeckoCheckCex(coinGeckoId);
    if (!cexListings) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — no CEX listings`);
        return null;
    }

    const currentPrice = await binanceGetPrice(symbol);
    if (currentPrice === null) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — no Binance price`);
        return null;
    }

    const priceMovement = ((currentPrice - entryPrice) / entryPrice) * 100;
    if (Math.abs(priceMovement) > 20) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — price movement too high (${priceMovement.toFixed(2)}%)`);
        return null;
    }

    console.log(`[ScorecardValidation] ${symbol}: PASSED — price=$${currentPrice}, movement=${priceMovement.toFixed(2)}%`);
    return {
        symbol: symbol.toUpperCase(),
        entryPrice,
        currentPrice,
        priceMovement,
        cexListings,
        coinGeckoId,
    };
}