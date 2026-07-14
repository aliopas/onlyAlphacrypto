import { env } from '../config/env';
import { TRACKED_COIN_SET } from '../config/coins';
import { getLivePrice } from './binance.service';

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
    direction: 'LONG';
}

export async function validateScorecardCoin(
    extraction: { symbol: string; entryPrice: number; direction?: 'LONG' | 'SHORT' }
): Promise<ValidatedCoin | null> {
    const { symbol, entryPrice, direction } = extraction;

    if (direction && direction !== 'LONG') {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — direction is ${direction} (only LONG allowed)`);
        return null;
    }

    if (typeof entryPrice !== 'number' || entryPrice <= 0) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — invalid entryPrice (${entryPrice})`);
        return null;
    }

    const altcoinGate: ValidationGateResult = {
        passed: !TRACKED_COIN_SET.has(symbol.toUpperCase()),
        reason: 'Altcoin filter: symbol is a tracked major coin',
    };
    if (!altcoinGate.passed) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — tracked major coin`);
        return null;
    }

    const livePrice = await getLivePrice(symbol);
    if (!livePrice) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — no Binance USDT pair (coin not verifiable)`);
        return null;
    }
    console.log(`[ScorecardValidation] ${symbol}: Verified on Binance @ $${livePrice} (CEX: Binance)`);

    const priceMovementFrac = (livePrice - entryPrice) / entryPrice;
    if (priceMovementFrac > env.SCORECARD_ENTRY_MAX_UP_PCT) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — price moved up too much (${priceMovementFrac.toFixed(4)})`);
        return null;
    }
    if (priceMovementFrac < env.SCORECARD_ENTRY_MAX_DOWN_PCT) {
        console.log(`[ScorecardValidation] ${symbol}: REJECTED — price moved down too much (${priceMovementFrac.toFixed(4)})`);
        return null;
    }

    const priceMovement = priceMovementFrac * 100;
    console.log(`[ScorecardValidation] ${symbol}: PASSED — price=$${livePrice}, movement=${priceMovement.toFixed(2)}%`);
    return {
        symbol: symbol.toUpperCase(),
        entryPrice,
        currentPrice: livePrice,
        priceMovement,
        cexListings: 'Binance',
        direction: 'LONG',
    };
}
