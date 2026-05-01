export interface TpslInput {
    entryPrice: number;
    verdict: 'STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL';
    supportLevels?: ReadonlyArray<number> | null;
    resistanceLevels?: ReadonlyArray<number> | null;
}

export interface TpslOutput {
    stopLossPrice: number;
    takeProfitPrice: number;
}

export function calculateTpsl(input: TpslInput): TpslOutput {
    const { entryPrice, verdict, supportLevels, resistanceLevels } = input;

    if (entryPrice <= 0) {
        return { stopLossPrice: 0, takeProfitPrice: 0 };
    }

    const isBullish = verdict === 'BUY' || verdict === 'STRONG_BUY';
    const isBearish = verdict === 'SELL' || verdict === 'STRONG_SELL';

    let stopLossPrice: number;
    let takeProfitPrice: number;

    if (isBullish) {
        takeProfitPrice = findNearestLevelAbove(entryPrice, resistanceLevels) ?? entryPrice * 1.15;
        stopLossPrice = findNearestLevelBelow(entryPrice, supportLevels) ?? entryPrice * 0.92;
    } else if (isBearish) {
        takeProfitPrice = findNearestLevelBelow(entryPrice, supportLevels) ?? entryPrice * 0.85;
        stopLossPrice = findNearestLevelAbove(entryPrice, resistanceLevels) ?? entryPrice * 1.08;
    } else {
        takeProfitPrice = entryPrice * 1.15;
        stopLossPrice = entryPrice * 0.92;
    }

    const minDistance = entryPrice * 0.02;

    if (Math.abs(takeProfitPrice - entryPrice) < minDistance) {
        takeProfitPrice = isBullish ? entryPrice * 1.15 : entryPrice * 0.85;
    }

    if (Math.abs(stopLossPrice - entryPrice) < minDistance) {
        stopLossPrice = isBullish ? entryPrice * 0.92 : entryPrice * 1.08;
    }

    return { stopLossPrice, takeProfitPrice };
}

function findNearestLevelAbove(price: number, levels?: ReadonlyArray<number> | null): number | null {
    if (!levels || levels.length === 0) {
        return null;
    }

    const validLevels = levels.filter((level) => level > price);
    if (validLevels.length === 0) {
        return null;
    }

    return Math.min(...validLevels);
}

function findNearestLevelBelow(price: number, levels?: ReadonlyArray<number> | null): number | null {
    if (!levels || levels.length === 0) {
        return null;
    }

    const validLevels = levels.filter((level) => level < price);
    if (validLevels.length === 0) {
        return null;
    }

    return Math.max(...validLevels);
}
