interface BinanceTickerResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

interface DexScreenerPriceChange {
    h24?: number;
}

interface DexScreenerVolume {
    h24?: number | null;
}

interface DexScreenerLiquidity {
    usd?: number | null;
}

interface DexScreenerPair {
    chainId?: string;
    dexId?: string;
    url?: string;
    pairAddress?: string;
    baseToken?: { symbol?: string; name?: string; address?: string };
    quoteToken?: { symbol?: string; name?: string; address?: string };
    priceNative?: string;
    priceUsd?: string;
    txns?: { h24?: { buys?: number; sells?: number } };
    volume?: DexScreenerVolume;
    priceChange?: DexScreenerPriceChange;
    liquidity?: DexScreenerLiquidity;
    fdv?: number;
    pairCreatedAt?: number;
}

interface DexScreenerTokenResponse {
    schemaVersion?: string;
    pairs?: DexScreenerPair[] | null;
}

interface DexScreenerSearchResponse {
    schemaVersion?: string;
    pairs?: DexScreenerPair[] | null;
}

export interface PriceResult {
    source: 'binance' | 'dexscreener';
    price: number;
    change24h: number | null;
    volume24h: number | null;
    high24h?: number | null;
    low24h?: number | null;
    liquidity?: number | null;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function getPriceWithFallback(symbol: string, tokenAddress?: string): Promise<PriceResult | null> {
    try {
        const binanceResult = await tryBinance(symbol);
        if (binanceResult !== null) {
            return binanceResult;
        }
    } catch (error) {
        console.warn('[priceService] Binance fetch failed:', error instanceof Error ? error.message : String(error));
    }

    await sleep(300);

    try {
        const dexResult = await tryDexScreener(symbol, tokenAddress);
        if (dexResult !== null) {
            return dexResult;
        }
    } catch (error) {
        console.warn('[priceService] DexScreener fetch failed:', error instanceof Error ? error.message : String(error));
    }

    return null;
}

async function tryBinance(symbol: string): Promise<PriceResult | null> {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
        return null;
    }

    const data: BinanceTickerResponse = await res.json() as BinanceTickerResponse;
    const price = parseFloat(data.lastPrice);

    if (isNaN(price) || price <= 0) {
        return null;
    }

    const changePercent = parseFloat(data.priceChangePercent);
    const volume = parseFloat(data.volume);
    const high = parseFloat(data.highPrice);
    const low = parseFloat(data.lowPrice);

    return {
        source: 'binance',
        price,
        change24h: isNaN(changePercent) ? null : changePercent,
        volume24h: isNaN(volume) ? null : volume,
        high24h: isNaN(high) ? null : high,
        low24h: isNaN(low) ? null : low,
    };
}

async function tryDexScreener(symbol: string, tokenAddress?: string): Promise<PriceResult | null> {
    let url: string;

    if (tokenAddress) {
        url = `https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`;
    } else {
        url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
        return null;
    }

    const data: DexScreenerTokenResponse | DexScreenerSearchResponse = await res.json() as DexScreenerTokenResponse | DexScreenerSearchResponse;
    const pairs = data.pairs;

    if (!pairs || pairs.length === 0) {
        return null;
    }

    const sorted = [...pairs].sort((a, b) => {
        const liqA = a.liquidity?.usd ?? 0;
        const liqB = b.liquidity?.usd ?? 0;
        return (liqB as number) - (liqA as number);
    });

    const best = sorted[0];

    if (!best.priceUsd) {
        return null;
    }

    const price = parseFloat(best.priceUsd);

    if (isNaN(price) || price <= 0) {
        return null;
    }

    const change24h = best.priceChange?.h24 ?? null;
    const volume24h = best.volume?.h24 ?? null;
    const liquidity = best.liquidity?.usd ?? null;

    return {
        source: 'dexscreener',
        price,
        change24h: typeof change24h === 'number' ? change24h : null,
        volume24h: typeof volume24h === 'number' ? volume24h : null,
        liquidity: typeof liquidity === 'number' ? liquidity : null,
    };
}

interface BinanceKlineAtDate {
    0: number;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: number;
    7: string;
    8: number;
    9: string;
    10: string;
    11: string;
}

export async function getBinancePriceAtDate(pair: string, date: Date): Promise<number | null> {
    try {
        const start = date.getTime();
        const end = start + 3_600_000;
        const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&startTime=${start}&endTime=${end}&limit=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (!res.ok) {
            return null;
        }

        const data: BinanceKlineAtDate[] = await res.json() as BinanceKlineAtDate[];

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const closePrice = parseFloat(data[0][4]);

        if (isNaN(closePrice)) {
            return null;
        }

        return closePrice;
    } catch (error) {
        console.warn('[priceService] getBinancePriceAtDate failed:', error instanceof Error ? error.message : String(error));
        return null;
    }
}
