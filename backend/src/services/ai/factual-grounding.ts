export interface FactualGroundingResult {
    sanitizedSupport: number[];
    sanitizedResistance: number[];
    removedLevels: string[];
}

export function validateFactualGrounding(
    supportLevels: number[],
    resistanceLevels: number[],
    currentPrice: number,
    thresholdPercent: number = 50
): FactualGroundingResult {
    if (currentPrice <= 0) {
        return { sanitizedSupport: supportLevels, sanitizedResistance: resistanceLevels, removedLevels: [] };
    }

    const lowerBound = currentPrice * (1 - thresholdPercent / 100);
    const upperBound = currentPrice * (1 + thresholdPercent / 100);
    const removedLevels: string[] = [];

    const sanitizedSupport = supportLevels.filter(level => {
        const valid = level >= lowerBound && level <= upperBound;
        if (!valid) {
            removedLevels.push(`Support $${level} is outside ±${thresholdPercent}% of current price $${currentPrice}`);
        }
        return valid;
    });

    const sanitizedResistance = resistanceLevels.filter(level => {
        const valid = level >= lowerBound && level <= upperBound;
        if (!valid) {
            removedLevels.push(`Resistance $${level} is outside ±${thresholdPercent}% of current price $${currentPrice}`);
        }
        return valid;
    });

    return { sanitizedSupport, sanitizedResistance, removedLevels };
}
