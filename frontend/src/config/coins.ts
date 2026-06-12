export const TRACKED_COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
    'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON',
] as const;

export type TrackedCoin = typeof TRACKED_COINS[number];

export const TRACKED_COIN_SET: ReadonlySet<string> = new Set(TRACKED_COINS);

export function isTrackedCoin(symbol: string): boolean {
    return TRACKED_COIN_SET.has(symbol.toUpperCase());
}
