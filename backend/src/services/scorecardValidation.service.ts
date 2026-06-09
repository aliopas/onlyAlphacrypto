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
}

async function binanceVerifyTradable(symbol: string): Promise<{ price: number; cexListing: string } | null> {
    const cacheKey = `scorecard:binance:tradable:${symbol}`;
    const cached = await getCache<{ price: number; cexListing: string }>(cacheKey);
    if (cached) return cached;

    try {
        const pair = `${symbol.toUpperCase()}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        if (!res.ok) {
            console.warn(`[ScorecardValidation] Binance price ${pair} failed: HTTP ${res.status}`);
            return null;
        }

        const data = await res.json() as { price?: string };
        if (!data?.price) {
            console.warn(`[ScorecardValidation] Binance price ${pair}: empty response — coin not on Binance`);
            return null;
        }

        const price = parseFloat(data.price);
        if (price <= 0) return null;

        const result = { price, cexListing: 'Binance' };
        await setCache(cacheKey, result, 3600);
        return result;
    } catch (err) {
        console.error(`[ScorecardValidation] Binance verify ${symbol} error:`, err instanceof Error ? err.message : String(err));
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

    const tradable = await binanceVerifyTradable(symbol);
    if (!tradable) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — no Binance USDT pair (coin not verifiable)`);
        return null;
    }
    console.log(`[ScorecardValidation] ${symbol}: Verified on Binance @ $${tradable.price} (CEX: ${tradable.cexListing})`);

    const priceMovement = ((tradable.price - entryPrice) / entryPrice) * 100;
    if (Math.abs(priceMovement) > 20) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — price movement too high (${priceMovement.toFixed(2)}%)`);
        return null;
    }

    console.log(`[ScorecardValidation] ${symbol}: PASSED — price=$${tradable.price}, movement=${priceMovement.toFixed(2)}%`);
    return {
        symbol: symbol.toUpperCase(),
        entryPrice,
        currentPrice: tradable.price,
        priceMovement,
        cexListings: tradable.cexListing,
    };
}
