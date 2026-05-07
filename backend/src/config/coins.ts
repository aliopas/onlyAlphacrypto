export const TRACKED_COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
    'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON',
] as const;

export type TrackedCoin = typeof TRACKED_COINS[number];

export const TRACKED_COIN_SET: ReadonlySet<string> = new Set(TRACKED_COINS);

export function isTrackedCoin(symbol: string): boolean {
    return TRACKED_COIN_SET.has(symbol.toUpperCase());
}

export function isMacroEvent(eventType: string): boolean {
    const MACRO_TYPES = ['Fed_Rate', 'CPI', 'Geopolitical', 'ETF', 'Regulatory'];
    return MACRO_TYPES.includes(eventType);
}