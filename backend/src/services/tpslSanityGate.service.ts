export interface SanityValidationResult {
    isValid: boolean;
    failures: string[];
}

const TP_DISTANCE_MIN_PERCENT = 0.01;
const TP_DISTANCE_MAX_MULTIPLIER = 0.40;
const SL_DISTANCE_MIN_PERCENT = 0.01;
const SL_DISTANCE_MAX_MULTIPLIER = 0.40;

const MIN_RR_TACTICAL = 2;
const MIN_RR_STRATEGIC = 3;

function priceDistancePercent(price: number, level: number): number {
    return Math.abs((price - level) / level) * 100;
}

export function validateTpslSanity(params: {
    entryPrice: number;
    direction: 'bullish' | 'bearish';
    tpPrice: number;
    slPrice: number;
    rrRatio: number;
    signalType: 'tactical' | 'strategic';
}): SanityValidationResult {
    const { entryPrice, direction, tpPrice, slPrice, rrRatio, signalType } = params;
    const failures: string[] = [];

    if (direction === 'bullish') {
        if (tpPrice <= entryPrice) {
            failures.push(`Bullish TP (${tpPrice}) must be above entry price (${entryPrice})`);
        }
        if (slPrice >= entryPrice) {
            failures.push(`Bullish SL (${slPrice}) must be below entry price (${entryPrice})`);
        }
    } else if (direction === 'bearish') {
        if (tpPrice >= entryPrice) {
            failures.push(`Bearish TP (${tpPrice}) must be below entry price (${entryPrice})`);
        }
        if (slPrice <= entryPrice) {
            failures.push(`Bearish SL (${slPrice}) must be above entry price (${entryPrice})`);
        }
    }

    const tpDistance = Math.abs(tpPrice - entryPrice);
    const tpDistancePercent = priceDistancePercent(tpPrice, entryPrice);
    const tpMinDistance = entryPrice * TP_DISTANCE_MIN_PERCENT;
    const tpMaxDistance = entryPrice * TP_DISTANCE_MAX_MULTIPLIER;

    if (tpDistance < tpMinDistance) {
        failures.push(`TP distance (${tpDistancePercent.toFixed(2)}%) below minimum 1%`);
    }
    if (tpDistance > tpMaxDistance) {
        failures.push(`TP distance (${tpDistancePercent.toFixed(2)}%) exceeds maximum 40%`);
    }

    const slDistance = Math.abs(slPrice - entryPrice);
    const slDistancePercent = priceDistancePercent(slPrice, entryPrice);
    const slMinDistance = entryPrice * SL_DISTANCE_MIN_PERCENT;
    const slMaxDistance = entryPrice * SL_DISTANCE_MAX_MULTIPLIER;

    if (slDistance < slMinDistance) {
        failures.push(`SL distance (${slDistancePercent.toFixed(2)}%) below minimum 1%`);
    }
    if (slDistance > slMaxDistance) {
        failures.push(`SL distance (${slDistancePercent.toFixed(2)}%) exceeds maximum 40%`);
    }

    const minRR = signalType === 'tactical' ? MIN_RR_TACTICAL : MIN_RR_STRATEGIC;
    if (rrRatio < minRR) {
        failures.push(`RR ratio (${rrRatio.toFixed(2)}) below minimum ${minRR} for ${signalType}`);
    }

    return {
        isValid: failures.length === 0,
        failures,
    };
}