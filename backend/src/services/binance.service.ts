import axios, { AxiosRequestConfig, AxiosResponse, RawAxiosResponseHeaders, AxiosResponseHeaders } from 'axios';
import http from 'http';
import https from 'https';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getCache, setCache } from '../config/redis';

export const BINANCE_BASE = 'https://api.binance.com/api/v3';

// ─── HTTP Agents ────────────────────────────────────────────────────────────

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: env.BINANCE_MAX_SOCKETS,
    maxFreeSockets: env.BINANCE_MAX_FREE_SOCKETS,
    timeout: env.BINANCE_TIMEOUT_MS,
    freeSocketTimeout: 5000,
    scheduling: 'lifo',
} as http.AgentOptions);
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: env.BINANCE_MAX_SOCKETS,
    maxFreeSockets: env.BINANCE_MAX_FREE_SOCKETS,
    timeout: env.BINANCE_TIMEOUT_MS,
    freeSocketTimeout: 5000,
    scheduling: 'lifo',
} as https.AgentOptions);

export const binanceClient = axios.create({
    timeout: env.BINANCE_TIMEOUT_MS,
    httpAgent,
    httpsAgent,
});

// ─── Resilience Types & Config ──────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

// ─── Simple In-Memory Cache ─────────────────────────────────────────────────

class SimpleCache {
    private readonly store = new Map<string, CacheEntry<unknown>>();
    private readonly l2Enabled: boolean;

    constructor() {
        this.l2Enabled = Boolean(env.REDIS_URL);
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    async getWithL2<T>(key: string, ttlMs: number): Promise<T | undefined> {
        const l1 = this.get<T>(key);
        if (l1 !== undefined) return l1;
        if (!this.l2Enabled) return undefined;
        const l2 = await getCache<T>(key);
        if (l2 !== null) {
            this.set(key, l2, ttlMs);
            return l2;
        }
        return undefined;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    async setWithL2<T>(key: string, value: T, ttlMs: number): Promise<void> {
        this.set(key, value, ttlMs);
        if (!this.l2Enabled) return;
        await setCache(key, value, Math.ceil(ttlMs / 1000));
    }

    delete(key: string): void {
        this.store.delete(key);
    }
}

const cache = new SimpleCache();

// ─── Concurrency Limiter ────────────────────────────────────────────────────

class BinanceConcurrencyLimiter {
    private active = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) {}

    async acquire(): Promise<void> {
        if (this.active < this.maxConcurrent) {
            this.active++;
            return;
        }
        await new Promise<void>((resolve) => this.queue.push(resolve));
        this.active++;
    }

    release(): void {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) next();
    }

    getActive(): number {
        return this.active;
    }
}

const concurrencyLimiter = new BinanceConcurrencyLimiter(env.BINANCE_MAX_CONCURRENT);

// ─── Rate Limiter ───────────────────────────────────────────────────────────

class BinanceRateLimiter {
    private readonly maxWeightPerMinute = 6000;
    private readonly safetyThreshold = 0.75;
    private currentWeight = 0;
    private windowResetAt = Date.now() + 60_000;

    recordHeaders(headers: AxiosResponseHeaders | RawAxiosResponseHeaders): void {
        const raw = headers['x-mbx-used-weight-1m'];
        const weight = typeof raw === 'string' ? parseInt(raw, 10) : 0;
        if (!Number.isNaN(weight)) {
            this.currentWeight = weight;
            // The header is a rolling 1-minute window; refresh our local window.
            this.windowResetAt = Date.now() + 60_000;
        }
    }

    getCurrentWeight(): number {
        return this.currentWeight;
    }

    async throttle(): Promise<void> {
        const now = Date.now();
        if (now > this.windowResetAt) {
            this.currentWeight = 0;
            this.windowResetAt = now + 60_000;
        }

        const ratio = this.currentWeight / this.maxWeightPerMinute;
        if (ratio < this.safetyThreshold) return;

        // Linear throttle from 0ms at threshold up to 2500ms at 100%.
        const delayMs = Math.min(2500, Math.round(((ratio - this.safetyThreshold) / (1 - this.safetyThreshold)) * 2500));
        if (delayMs > 0) {
            logger.debug('[Binance] Throttling %dms (weight %d/%d)', delayMs, this.currentWeight, this.maxWeightPerMinute);
            await sleep(delayMs);
        }
    }
}

const rateLimiter = new BinanceRateLimiter();

// ─── Retry / Dedupe Helpers ─────────────────────────────────────────────────

const inFlightRequests = new Map<string, Promise<AxiosResponse<unknown>>>();

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequestKey(url: string, params?: Record<string, unknown>): string {
    if (!params || Object.keys(params).length === 0) return url;
    const sorted = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join('&');
    return `${url}?${sorted}`;
}

function isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'];
    if (error.code && retryableCodes.includes(error.code)) return true;
    if (!error.response) return true; // Timeouts / network failures

    const status = error.response.status;
    return status >= 500 || status === 429;
}

async function executeOnce<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await rateLimiter.throttle();

    const start = Date.now();
    const controller = new AbortController();
    const requestTimeoutMs = Math.max(1000, (config.timeout ?? env.BINANCE_TIMEOUT_MS) - 500);
    const timer = setTimeout(() => controller.abort('request timeout'), requestTimeoutMs);

    try {
        const requestConfig: AxiosRequestConfig<T> = {
            ...config,
            timeout: env.BINANCE_TIMEOUT_MS,
            signal: controller.signal,
            family: 4,
        } as AxiosRequestConfig<T>;

        const response = await binanceClient.request<T>(requestConfig);
        const duration = Date.now() - start;
        const weight = response.headers['x-mbx-used-weight-1m'];
        logger.info('[Binance] %s duration=%dms weight=%s', config.url ?? 'unknown', duration, String(weight ?? 'n/a'));
        rateLimiter.recordHeaders(response.headers);
        return response;
    } finally {
        clearTimeout(timer);
    }
}

async function executeWithRetry<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await concurrencyLimiter.acquire();
    try {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await executeOnce<T>(config);
            } catch (error) {
                if (attempt >= MAX_RETRIES || !isRetryableError(error)) {
                    throw error;
                }

                const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
                const jitter = Math.floor(Math.random() * 200);
                const totalBackoff = backoff + jitter;

                logger.warn(
                    '[Binance] Retryable error on %s (attempt %d/%d), backing off %dms: %s',
                    config.url ?? 'unknown',
                    attempt,
                    MAX_RETRIES,
                    totalBackoff,
                    error instanceof Error ? error.message : String(error)
                );

                await sleep(totalBackoff);
            }
        }
        throw new Error('[Binance] Unexpected retry exhaustion');
    } finally {
        concurrencyLimiter.release();
    }
}

export async function binanceRequest<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const url = typeof config.url === 'string' ? config.url : '';
    const params = config.params as Record<string, unknown> | undefined;
    const key = getRequestKey(url, params);

    const existing = inFlightRequests.get(key);
    if (existing) {
        return existing as Promise<AxiosResponse<T>>;
    }

    const promise = executeWithRetry<T>(config).finally(() => {
        inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, promise as Promise<AxiosResponse<unknown>>);
    return promise;
}

export async function binanceGet<T>(url: string, params?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return binanceRequest<T>({ method: 'GET', url, params });
}

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
    const cacheKey = `binance:livePrice:${symbol.toUpperCase()}`;
    const cached = await cache.getWithL2<number>(cacheKey, env.BINANCE_CACHE_TTL_PRICE_MS);
    if (cached !== undefined) return cached;

    try {
        const pair = symbol.toUpperCase() + 'USDT';
        const { data } = await binanceGet<BinanceTicker>(`${BINANCE_BASE}/ticker/price`, { symbol: pair });
        const price = parseFloat(data.price);
        if (!Number.isNaN(price)) {
            await cache.setWithL2(cacheKey, price, env.BINANCE_CACHE_TTL_PRICE_MS);
        }
        return price;
    } catch (error) {
        logger.error('[Binance] getLivePrice failed for %s: %s', symbol, error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ─── Get Multiple Prices ──────────────────────────────────────────────────────

export async function getLivePrices(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {};

    const cacheKey = `binance:livePrices:${symbols.map((s) => s.toUpperCase()).sort().join(',')}`;
    const cached = await cache.getWithL2<Record<string, number>>(cacheKey, env.BINANCE_CACHE_TTL_PRICE_MS);
    if (cached !== undefined) return cached;

    try {
        const pairs = symbols.map((s) => `"${s.toUpperCase()}USDT"`).join(',');
        const { data } = await binanceGet<BinanceTicker[]>(`${BINANCE_BASE}/ticker/price`, { symbols: `[${pairs}]` });

        const result: Record<string, number> = {};
        for (const ticker of data) {
            const sym = ticker.symbol.replace('USDT', '');
            result[sym] = parseFloat(ticker.price);
        }
        await cache.setWithL2(cacheKey, result, env.BINANCE_CACHE_TTL_PRICE_MS);
        return result;
    } catch (error) {
        logger.error('[Binance] getLivePrices failed: %s', error instanceof Error ? error.message : String(error));
        return {};
    }
}

// ─── Get 24hr Tickers ─────────────────────────────────────────────────────────

export async function get24hrTickers(symbols?: readonly string[]): Promise<BinanceMover[]> {
    const cacheKey = `binance:24hrTickers:${symbols?.map((s) => s.toUpperCase()).sort().join(',') ?? 'all'}`;
    const cached = await cache.getWithL2<BinanceMover[]>(cacheKey, env.BINANCE_CACHE_TTL_TICKER_24H_MS);
    if (cached !== undefined) return cached;

    try {
        let data: BinanceMover[];

        if (symbols && symbols.length > 0) {
            const pairs = symbols.map((s) => `"${s.toUpperCase()}USDT"`).join(',');
            const { data: responseData } = await binanceGet<BinanceMover[]>(`${BINANCE_BASE}/ticker/24hr`, {
                symbols: `[${pairs}]`,
            });
            data = responseData;
        } else {
            const { data: responseData } = await binanceGet<BinanceMover[]>(`${BINANCE_BASE}/ticker/24hr`);
            data = responseData;
        }

        await cache.setWithL2(cacheKey, data, env.BINANCE_CACHE_TTL_TICKER_24H_MS);
        return data;
    } catch (error) {
        logger.error('[Binance] get24hrTickers failed: %s', error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Get Top Movers (24h) ─────────────────────────────────────────────────────

export async function getTopMovers(limit = 10, symbols?: readonly string[]): Promise<BinanceMover[]> {
    const cacheKey = `binance:topMovers:${symbols?.map((s) => s.toUpperCase()).sort().join(',') ?? 'all'}`;
    const cached = await cache.getWithL2<BinanceMover[]>(cacheKey, env.BINANCE_CACHE_TTL_TICKER_24H_MS);
    if (cached !== undefined) return cached;

    try {
        const data = await get24hrTickers(symbols);

        const result = data
            .filter((t) => t.symbol.endsWith('USDT')
                && !t.symbol.includes('BEAR')
                && !t.symbol.includes('BULL')
                && !t.symbol.includes('DOWN')
                && !t.symbol.includes('UP'))
            .filter((t) => parseFloat(t.quoteVolume) > 10_000_000)
            .filter((t) => parseFloat(t.priceChangePercent) > 0)
            .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
            .slice(0, limit);

        await cache.setWithL2(cacheKey, result, env.BINANCE_CACHE_TTL_TICKER_24H_MS);
        return result;
    } catch (error) {
        logger.error('[Binance] getTopMovers failed: %s', error instanceof Error ? error.message : String(error));
        return [];
    }
}

// ─── Get RSI (simple approximation via klines) ────────────────────────────────

export async function getCoinKlines(symbol: string, interval = '1h', limit = 15) {
    try {
        const pair = symbol.toUpperCase() + 'USDT';
        const { data } = await binanceGet<unknown[][]>(`${BINANCE_BASE}/klines`, { symbol: pair, interval, limit });

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
            const { data } = await binanceGet<unknown[][]>(`${BINANCE_BASE}/klines`, {
                symbol: pair,
                interval,
                startTime: currentStartTime,
                endTime,
                limit: limitPerRequest,
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

export async function getFearAndGreed(): Promise<{ value: number; classification: string } | null> {
    try {
        const { data } = await binanceRequest<{ data: Array<{ value: string; value_classification: string }> }>({
            method: 'GET',
            url: env.ALTERNATIVE_ME_URL,
        });
        const item = data.data[0];
        if (!item || item.value == null) {
            logger.warn('[Binance] getFearAndGreed: empty payload from Alternative.me');
            return null;
        }
        const parsed = parseInt(item.value, 10);
        if (Number.isNaN(parsed)) {
            logger.warn('[Binance] getFearAndGreed: non-numeric value %j', item.value);
            return null;
        }
        return {
            value: parsed,
            classification: item.value_classification,
        };
    } catch (error) {
        // Return null (not {value: 0}) on failure so callers can distinguish a real
        // "Extreme Fear" reading (value=0-20) from a fetch failure. Previously returning
        // {value: 0} caused marketMood to persist a bogus Extreme-Fear row on any outage.
        logger.error('[Binance] getFearAndGreed failed: %s', error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ─── Resilience Telemetry ───────────────────────────────────────────────────

export function getBinanceResilienceStatus(): { weight: number; maxConcurrent: number; active: number } {
    return {
        weight: rateLimiter.getCurrentWeight(),
        maxConcurrent: env.BINANCE_MAX_CONCURRENT,
        active: concurrencyLimiter.getActive(),
    };
}
