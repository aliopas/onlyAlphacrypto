import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const BINANCE_BASE = 'https://api.binance.com/api/v3';

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

export interface BinanceKline {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

// ─── Get Price ────────────────────────────────────────────────────────────────

export async function getLivePrice(symbol: string): Promise<number | null> {
    try {
        const pair = symbol.toUpperCase() + 'USDT';
        const { data } = await axios.get<BinanceTicker>(`${BINANCE_BASE}/ticker/price`, {
            params: { symbol: pair },
            timeout: 5000,
        });
        return parseFloat(data.price);
    } catch (error) {
        logger.error('[Binance] getLivePrice failed for %s: %s', symbol, error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ─── Get Multiple Prices ──────────────────────────────────────────────────────

export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
    try {
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
    } catch (error) {
        logger.error('[Binance] getLivePrices failed: %s', error instanceof Error ? error.message : String(error));
        return {};
    }
}

// ─── Get Top Movers (24h) ─────────────────────────────────────────────────────

export async function getTopMovers(limit = 10): Promise<BinanceMover[]> {
    try {
        const { data } = await axios.get<BinanceMover[]>(`${BINANCE_BASE}/ticker/24hr`, {
            timeout: 8000,
        });

        // Filter USDT pairs only, then sort by absolute change %
        return data
            .filter((t) => t.symbol.endsWith('USDT')
                && !t.symbol.includes('BEAR')
                && !t.symbol.includes('BULL')
                && !t.symbol.includes('DOWN')
                && !t.symbol.includes('UP'))
            .filter((t) => parseFloat(t.quoteVolume) > 10_000_000)
            .filter((t) => parseFloat(t.priceChangePercent) > 0)
            .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
            .slice(0, limit);
    } catch (error) {
        logger.error('[Binance] getTopMovers failed: %s', error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Get RSI (simple approximation via klines) ────────────────────────────────

export async function getCoinKlines(symbol: string, interval = '1h', limit = 15) {
    try {
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
    } catch (error) {
        logger.error('[Binance] getCoinKlines failed for %s: %s', symbol, error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Get Coin Klines Range ─────────────────────────────────────────────────────

export async function getCoinKlinesRange(symbol: string, interval: string, startTime: number, endTime: number): Promise<BinanceKline[]> {
    // Input validation
    if (startTime >= endTime) {
        return [];
    }
    if (!symbol || typeof symbol !== 'string') {
        return [];
    }

    const pair = symbol.toUpperCase() + 'USDT';
    const maxCandles = 1500;
    const limitPerRequest = 1000; // Binance max per request
    let allCandles: BinanceKline[] = [];
    let currentStartTime = startTime;

    try {
        while (allCandles.length < maxCandles && currentStartTime < endTime) {
            const { data } = await axios.get(`${BINANCE_BASE}/klines`, {
                params: {
                    symbol: pair,
                    interval,
                    startTime: currentStartTime,
                    endTime,
                    limit: limitPerRequest,
                },
                timeout: 5000,
            });

            if (!Array.isArray(data) || data.length === 0) {
                break; // No more data
            }

            const candles = data.map((k: unknown[]) => ({
                open: parseFloat(k[1] as string),
                high: parseFloat(k[2] as string),
                low: parseFloat(k[3] as string),
                close: parseFloat(k[4] as string),
                volume: parseFloat(k[5] as string),
                closeTime: k[6] as number,
            }));

            allCandles.push(...candles);

            // Update startTime for next request to avoid overlap
            const lastCandle = candles[candles.length - 1];
            if (lastCandle && lastCandle.closeTime < endTime) {
                currentStartTime = lastCandle.closeTime + 1;
            } else {
                break; // Reached endTime
            }

            // Cap at maxCandles
            if (allCandles.length >= maxCandles) {
                allCandles = allCandles.slice(0, maxCandles);
                break;
            }
        }

        return allCandles;
    } catch (error) {
        if (allCandles.length > 0) {
            logger.warn('[Binance] getCoinKlinesRange partial failure for %s: %s, returning %d candles', symbol, error instanceof Error ? error.message : String(error), allCandles.length);
            return allCandles;
        }
        logger.error('[Binance] getCoinKlinesRange failed for %s: %s', symbol, error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Alternative.me Fear & Greed ─────────────────────────────────────────────

export async function getFearAndGreed(): Promise<{ value: number; classification: string }> {
    try {
        const { data } = await axios.get(env.ALTERNATIVE_ME_URL, { timeout: 5000 });
        const item = data.data[0];
        return {
            value: parseInt(item.value, 10),
            classification: item.value_classification,
        };
    } catch (error) {
        logger.error('[Binance] getFearAndGreed failed: %s', error instanceof Error ? error.message : String(error));
        return { value: 0, classification: 'Unknown' };
    }
}
