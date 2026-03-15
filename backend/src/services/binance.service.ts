import axios from 'axios';
import { env } from '../config/env';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BinanceTicker {
    symbol: string;
    price: string;
}

export interface BinanceMover {
    symbol: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
}

// ─── Get Price ────────────────────────────────────────────────────────────────

export async function getLivePrice(symbol: string): Promise<number> {
    const pair = symbol.toUpperCase() + 'USDT';
    const { data } = await axios.get<BinanceTicker>(`${BINANCE_BASE}/ticker/price`, {
        params: { symbol: pair },
        timeout: 5000,
    });
    return parseFloat(data.price);
}

// ─── Get Multiple Prices ──────────────────────────────────────────────────────

export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
    const pairs = symbols.map((s) => `"${s.toUpperCase()}USDT"`).join(',');
    const { data } = await axios.get<BinanceTicker[]>(`${BINANCE_BASE}/ticker/price`, {
        params: { symbols: `[${pairs}]` },
        timeout: 5000,
    });

    const result: Record<string, number> = {};
    for (const ticker of data) {
        const sym = ticker.symbol.replace('USDT', '');
        result[sym] = parseFloat(ticker.price);
    }
    return result;
}

// ─── Get Top Movers (24h) ─────────────────────────────────────────────────────

export async function getTopMovers(limit = 10): Promise<BinanceMover[]> {
    const { data } = await axios.get<BinanceMover[]>(`${BINANCE_BASE}/ticker/24hr`, {
        timeout: 8000,
    });

    // Filter USDT pairs only, then sort by absolute change %
    return data
        .filter((t) => t.symbol.endsWith('USDT') && !t.symbol.includes('BEAR') && !t.symbol.includes('BULL'))
        .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent)) - Math.abs(parseFloat(a.priceChangePercent)))
        .slice(0, limit);
}

// ─── Get RSI (simple approximation via klines) ────────────────────────────────

export async function getCoinKlines(symbol: string, interval = '1h', limit = 15) {
    const pair = symbol.toUpperCase() + 'USDT';
    const { data } = await axios.get(`${BINANCE_BASE}/klines`, {
        params: { symbol: pair, interval, limit },
        timeout: 5000,
    });

    return data.map((k: unknown[]) => ({
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
        closeTime: k[6],
    }));
}

// ─── Alternative.me Fear & Greed ─────────────────────────────────────────────

export async function getFearAndGreed(): Promise<{ value: number; label: string }> {
    const { data } = await axios.get(env.ALTERNATIVE_ME_URL, { timeout: 5000 });
    const item = data.data[0];
    return {
        value: parseInt(item.value, 10),
        label: item.value_classification,
    };
}
