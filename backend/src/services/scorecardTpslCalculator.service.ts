import { env } from '../config/env';

export interface ScorecardTpslResult {
    tp1: number;
    tp2: number;
    tp3: number;
    stopLoss: number;
    tpSource: 'support' | 'resistance' | 'atr';
    slSource: 'support' | 'resistance' | 'atr';
    rr: number;
    isRejected: boolean;
    rejectionReason?: string;
    allocatedBudget: number;
    classification: 'TACTICAL' | 'STRATEGIC';
}

interface Candle {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

async function fetchBinanceCandles(symbol: string): Promise<Candle[] | null> {
    try {
        const pair = `${symbol.toUpperCase()}USDT`;
        const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=4h&limit=100`
        );
        if (!res.ok) {
            console.warn(`[ScorecardTpsl] Binance klines ${pair} failed: HTTP ${res.status}`);
            return null;
        }

        const data = await res.json() as Array<[
            number, string, string, string, string, string, number, string, number, string, string, string
        ]>;

        const candles: Candle[] = data.map(d => ({
            openTime: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));

        return candles;
    } catch (err) {
        console.error(`[ScorecardTpsl] Binance klines ${symbol} error:`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

function calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
    }

    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trueRanges[i];
    }
    atr /= period;

    for (let i = period; i < trueRanges.length; i++) {
        atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    }

    return atr;
}

interface SwingLevel {
    price: number;
    type: 'support' | 'resistance';
    strength: number;
}

function detectSwingLevels(candles: Candle[]): SwingLevel[] {
    const levels: SwingLevel[] = [];
    const lookback = 5;

    for (let i = lookback; i < candles.length - lookback; i++) {
        const window = candles.slice(i - lookback, i + lookback + 1);
        const current = candles[i];

        const isSwingHigh = window.every(c => c.high <= current.high);
        const isSwingLow = window.every(c => c.low >= current.low);

        if (isSwingHigh) {
            let touches = 1;
            let strength = 40;

            for (let j = i + 1; j < candles.length && j < i + 20; j++) {
                if (Math.abs(candles[j].high - current.high) / current.high < 0.002) {
                    touches++;
                }
            }
            strength = Math.min(40 + (touches * 10), 95);

            levels.push({
                price: current.high,
                type: 'resistance',
                strength,
            });
        }

        if (isSwingLow) {
            let touches = 1;
            let strength = 40;

            for (let j = i + 1; j < candles.length && j < i + 20; j++) {
                if (Math.abs(candles[j].low - current.low) / current.low < 0.002) {
                    touches++;
                }
            }
            strength = Math.min(40 + (touches * 10), 95);

            levels.push({
                price: current.low,
                type: 'support',
                strength,
            });
        }
    }

    return levels;
}

export async function calculateScorecardTpsl(params: {
    symbol: string;
    entryPrice: number;
    classification: 'TACTICAL' | 'STRATEGIC';
}): Promise<ScorecardTpslResult> {
    const { symbol, entryPrice, classification } = params;

    const candles = await fetchBinanceCandles(symbol);
    if (!candles || candles.length === 0) {
        console.warn(`[ScorecardTpsl] ${symbol}: No candles — rejecting`);
        return {
            tp1: 0, tp2: 0, tp3: 0, stopLoss: 0,
            tpSource: 'atr', slSource: 'atr',
            rr: 0, isRejected: true,
            rejectionReason: 'no_binance_pair',
            allocatedBudget: 0, classification,
        };
    }

    const atrValue = calculateATR(candles, 14) || (entryPrice * 0.05);

    const recentCandles = candles.slice(-20);
    const avgClose = recentCandles.reduce((s, c) => s + c.close, 0) / recentCandles.length;
    const direction: 'BULLISH' | 'BEARISH' = candles[candles.length - 1].close > avgClose ? 'BULLISH' : 'BEARISH';
    console.log(`[ScorecardTpsl] ${symbol}: ${candles.length} candles, ATR=${atrValue.toFixed(4)}, direction=${direction}, lastClose=${candles[candles.length - 1].close}, avgClose20=${avgClose.toFixed(4)}`);

    const levels = detectSwingLevels(candles);
    const supportLevels = levels.filter(l => l.type === 'support').sort((a, b) => b.strength - a.strength);
    const resistanceLevels = levels.filter(l => l.type === 'resistance').sort((a, b) => b.strength - a.strength);

    let tp1 = 0, tp2 = 0, tp3 = 0, stopLoss = 0;
    let tpSource: 'support' | 'resistance' | 'atr' = 'atr';
    let slSource: 'support' | 'resistance' | 'atr' = 'atr';

    if (direction === 'BULLISH') {
        const usableResistances = resistanceLevels.filter(l => l.strength >= 40);
        const usableSupports = supportLevels.filter(l => l.strength >= 60);

        if (usableResistances.length >= 1) {
            tp1 = usableResistances[0].price;
            tpSource = 'resistance';
        } else {
            tp1 = entryPrice + 1.5 * atrValue;
            tpSource = 'atr';
        }

        if (usableResistances.length >= 2) {
            tp2 = usableResistances[1].price;
        } else {
            tp2 = entryPrice + 2.5 * atrValue;
        }

        if (usableResistances.length >= 3) {
            tp3 = usableResistances[2].price;
        } else {
            tp3 = entryPrice + 3.5 * atrValue;
        }

        if (usableSupports.length >= 1) {
            stopLoss = usableSupports[0].price;
            slSource = 'support';
        } else {
            stopLoss = entryPrice - 1.0 * atrValue;
            slSource = 'atr';
        }
    } else {
        const usableSupports = supportLevels.filter(l => l.strength >= 40);
        const usableResistances = resistanceLevels.filter(l => l.strength >= 60);

        if (usableSupports.length >= 1) {
            tp1 = usableSupports[0].price;
            tpSource = 'support';
        } else {
            tp1 = entryPrice - 1.5 * atrValue;
            tpSource = 'atr';
        }

        if (usableSupports.length >= 2) {
            tp2 = usableSupports[1].price;
        } else {
            tp2 = entryPrice - 2.5 * atrValue;
        }

        if (usableSupports.length >= 3) {
            tp3 = usableSupports[2].price;
        } else {
            tp3 = entryPrice - 3.5 * atrValue;
        }

        if (usableResistances.length >= 1) {
            stopLoss = usableResistances[0].price;
            slSource = 'resistance';
        } else {
            stopLoss = entryPrice + 1.0 * atrValue;
            slSource = 'atr';
        }
    }

    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(tp1 - entryPrice);
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;

    const minRR = classification === 'STRATEGIC' ? 3.0 : 2.0;
    if (rr < minRR) {
        console.log(`[ScorecardTpsl] ${symbol}: REJECTED — RR=${rr.toFixed(2)} < minRR=${minRR} (${classification})`);
        return {
            tp1, tp2, tp3, stopLoss, tpSource, slSource, rr,
            isRejected: true,
            rejectionReason: `rr_too_low`,
            allocatedBudget: 0,
            classification,
        };
    }

    const allocatedBudget = classification === 'STRATEGIC'
        ? env.SCORECARD_STRATEGIC_BUDGET
        : env.SCORECARD_TACTICAL_BUDGET;

    console.log(`[ScorecardTpsl] ${symbol}: ACCEPTED — RR=${rr.toFixed(2)}, TP1=${tp1} TP2=${tp2} TP3=${tp3} SL=${stopLoss}, budget=$${allocatedBudget}`);
    return {
        tp1, tp2, tp3, stopLoss, tpSource, slSource, rr,
        isRejected: false,
        allocatedBudget,
        classification,
    };
}