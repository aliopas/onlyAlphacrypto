interface BinanceKline {
    0: number;
    1: string;
    2: string;
    3: string;
    4: string;
}

export interface BinanceHistoryResult {
    source: 'binance';
    ath: number;
    athDate: string;
    week52High: number;
    week52Low: number;
    trend8w: 'uptrend' | 'downtrend' | 'sideways';
    priceChange30d: string;
}

function calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (closes.length < 2) {
        return 'sideways';
    }

    const first = closes[0];
    const last = closes[closes.length - 1];

    if (first === 0) {
        return 'sideways';
    }

    const change = ((last - first) / first) * 100;

    if (change > 5) {
        return 'uptrend';
    }

    if (change < -5) {
        return 'downtrend';
    }

    return 'sideways';
}

function pctChange(from: number, to: number): string {
    if (from === 0) {
        return '0.0';
    }

    return ((to - from) / from * 100).toFixed(1);
}

export async function getBinanceHistory(symbol: string): Promise<BinanceHistoryResult | null> {
    try {
        const pair = symbol.toUpperCase() + 'USDT';
        const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=200`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

        if (!res.ok) {
            return null;
        }

        const rawData = await res.json() as (string | number)[][];

        if (!Array.isArray(rawData) || rawData.length < 5) {
            return null;
        }

        const data: BinanceKline[] = rawData.map((kline: (string | number)[]): BinanceKline => ({
            0: Number(kline[0]),
            1: String(kline[1]),
            2: String(kline[2]),
            3: String(kline[3]),
            4: String(kline[4]),
        }));

        const highs = data.map(k => parseFloat(k[2]));
        const lows = data.map(k => parseFloat(k[3]));
        const closes = data.map(k => parseFloat(k[4]));

        const ath = Math.max(...highs);
        const athIdx = highs.indexOf(ath);
        const athDate = new Date(data[athIdx][0]).toISOString().split('T')[0];
        const week52High = Math.max(...highs.slice(-52));
        const week52Low = Math.min(...lows.slice(-52));
        const trend8w = calcTrend(closes.slice(-8));

        const closesFor30d = closes.length >= 5
            ? { from: closes[closes.length - 5], to: closes[closes.length - 1] }
            : { from: closes[0], to: closes[closes.length - 1] };

        const priceChange30d = pctChange(closesFor30d.from, closesFor30d.to);

        return {
            source: 'binance',
            ath,
            athDate,
            week52High,
            week52Low,
            trend8w,
            priceChange30d,
        };
    } catch (error) {
        console.warn('[binanceHistory] getBinanceHistory failed:', error instanceof Error ? error.message : String(error));
        return null;
    }
}
