import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../config/redis';
import { env } from '../config/env';

interface BinanceKline {
    0: number;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
}

interface DexScreenerPair {
    chainId: string;
    pairAddress: string;
    baseToken: { address: string; symbol: string };
    quoteToken: { address: string; symbol: string };
    priceUsd: string | null;
    volume: { h24: number };
}

interface BirdeyeSearchResult {
    address: string;
    chain: string;
    symbol: string;
}

interface BirdeyeOhlcvItem {
    unixTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface BirdeyeOhlcvResponse {
    success: boolean;
    data: {
        items: BirdeyeOhlcvItem[];
        updatedAt: number;
    };
}

interface ChartCandle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface ChartResponse {
    source: 'binance' | 'dex';
    candles: ChartCandle[];
    price: string;
    symbol: string;
}

async function fetchBinanceKlines(symbol: string): Promise<ChartCandle[] | null> {
    try {
        const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=100`,
            { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return null;
        const data: unknown = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        return (data as BinanceKline[]).map((d) => ({
            time: d[0] / 1000,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
        }));
    } catch {
        return null;
    }
}

async function searchTokenOnBirdeye(symbol: string): Promise<{ address: string; chain: string } | null> {
    try {
        const url = `https://public-api.birdeye.so/defi/v3/search?keyword=${encodeURIComponent(symbol)}&limit=5`;
        const headers: Record<string, string> = {};
        if (env.BIRDEYE_API_KEY) {
            headers['X-API-KEY'] = env.BIRDEYE_API_KEY;
        }
        const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json: unknown = await res.json();
        const result = json as { data?: BirdeyeSearchResult[] };
        if (!Array.isArray(result.data) || result.data.length === 0) return null;

        const match = result.data.find(
            (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
        );
        return match
            ? { address: match.address, chain: match.chain }
            : { address: result.data[0].address, chain: result.data[0].chain };
    } catch {
        return null;
    }
}

async function fetchBirdeyeOhlcv(address: string, chain: string): Promise<{ candles: ChartCandle[]; price: string } | null> {
    try {
        const url = `https://public-api.birdeye.so/defi/ohlcv?address=${address}&chain=${chain}&timeframe=1H&type=1&limit=100`;
        const headers: Record<string, string> = {};
        if (env.BIRDEYE_API_KEY) {
            headers['X-API-KEY'] = env.BIRDEYE_API_KEY;
        }
        const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json: unknown = await res.json();
        const body = json as BirdeyeOhlcvResponse;
        if (!body.success || !Array.isArray(body.data?.items) || body.data.items.length === 0) {
            return null;
        }

        const candles: ChartCandle[] = body.data.items.map((item) => ({
            time: Math.floor(item.unixTime / 1000),
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        }));

        candles.sort((a, b) => a.time - b.time);
        const lastClose = candles[candles.length - 1].close;
        return { candles, price: lastClose.toPrecision(8) };
    } catch {
        return null;
    }
}

async function fetchDexChart(symbol: string): Promise<{ candles: ChartCandle[]; price: string } | null> {
    const birdeyeSearch = await searchTokenOnBirdeye(symbol);
    if (!birdeyeSearch) {
        const dexRes = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
            { signal: AbortSignal.timeout(8000) }
        );
        if (!dexRes.ok) return null;
        const dexJson: unknown = await dexRes.json();
        const pairs: DexScreenerPair[] = (dexJson as { pairs?: DexScreenerPair[] }).pairs ?? [];
        if (pairs.length === 0) return null;
        const best = pairs.reduce<DexScreenerPair | null>((a, b) =>
            (a?.volume?.h24 ?? 0) >= (b?.volume?.h24 ?? 0) ? a : b, null
        );
        const usd = best?.priceUsd;
        return usd ? { candles: [], price: parseFloat(usd).toPrecision(8) } : null;
    }

    const ohlcv = await fetchBirdeyeOhlcv(birdeyeSearch.address, birdeyeSearch.chain);
    if (ohlcv) return ohlcv;

    const dexRes = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
        { signal: AbortSignal.timeout(8000) }
    );
    if (!dexRes.ok) return null;
    const dexJson: unknown = await dexRes.json();
    const pairs: DexScreenerPair[] = (dexJson as { pairs?: DexScreenerPair[] }).pairs ?? [];
    if (pairs.length === 0) return null;
    const best = pairs.reduce<DexScreenerPair | null>((a, b) =>
        (a?.volume?.h24 ?? 0) >= (b?.volume?.h24 ?? 0) ? a : b, null
    );
    const usd = best?.priceUsd;
    return usd ? { candles: [], price: parseFloat(usd).toPrecision(8) } : null;
}

function formatPrice(p: number): string {
    if (p === 0) return '...';
    if (p < 0.001) return p.toPrecision(4);
    if (p < 1) return p.toFixed(6);
    if (p < 100) return p.toFixed(4);
    return p.toFixed(2);
}

export async function getChartKlines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const symbol = String(req.params['symbol'] ?? '').toUpperCase().trim();
        if (!symbol || symbol.length > 20) {
            res.status(400).json({ error: 'Invalid symbol' });
            return;
        }

        const cacheKey = `chart:klines:${symbol}:1h`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.json(cached as ChartResponse);
            return;
        }

        const binanceData = await fetchBinanceKlines(symbol);

        if (binanceData && binanceData.length > 0) {
            const response: ChartResponse = {
                source: 'binance',
                candles: binanceData,
                price: formatPrice(binanceData[binanceData.length - 1].close),
                symbol,
            };
            await setCache(cacheKey, response, 120);
            res.json(response);
            return;
        }

        const dexResult = await fetchDexChart(symbol);

        if (dexResult) {
            const response: ChartResponse = {
                source: 'dex',
                candles: dexResult.candles,
                price: dexResult.price,
                symbol,
            };
            await setCache(cacheKey, response, 120);
            res.json(response);
            return;
        }

        res.json({ source: 'none', candles: [], price: '...', symbol });
    } catch (err) {
        next(err);
    }
}
