import { getCandles, getLatestIndicator } from './ohlcvSnapshot.service';
import { fetchAllRSSNews } from './rssNews.service';
import { env } from '../config/env';

export type MarketRegime =
    | 'RISK_ON'
    | 'RISK_OFF'
    | 'TRENDING'
    | 'SIDEWAYS'
    | 'VOLATILE';

export interface RegimeEffects {
    confidenceModifier: number;
    stopLossAdjustment: number;
    allowSignals: boolean;
}

const MACRO_RISK_KEYWORDS = [
    'war',
    'sanctions',
    'recession',
    'inflation',
    'rate hike',
    'fed rate',
    'conflict',
    'military',
    'crisis',
    'default',
    'bankruptcy',
    'emergency',
    'warfare',
    'attack',
    'terror',
];

const RISK_OFF_KEYWORDS = [
    'bank run',
    'contagion',
    'liquidity crisis',
    'hard landing',
    'crash',
    'collapse',
    'plunge',
];

function detectMacroRiskKeywords(news: { title: string; pubDate?: string }[]): boolean {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentNews = news.filter(n => {
        if (!n.pubDate) return true;
        return new Date(n.pubDate).getTime() > twentyFourHoursAgo;
    });
    const text = recentNews
        .slice(0, 20)
        .map(n => n.title.toLowerCase())
        .join(' ');
    for (const keyword of [...MACRO_RISK_KEYWORDS, ...RISK_OFF_KEYWORDS]) {
        if (text.includes(keyword)) {
            return true;
        }
    }
    return false;
}

async function fetchFearGreedIndex(): Promise<number | null> {
    try {
        const response = await fetch(env.ALTERNATIVE_ME_URL);
        if (response.ok) {
            const data = await response.json() as { data?: { value: string }[] };
            return data.data && data.data[0] ? parseInt(data.data[0].value, 10) : null;
        }
    } catch {}
    return null;
}

interface BTCAnalysis {
    atrPercent: number;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    recentChange: number;
    volatilityScore: number;
}

async function analyzeBTC4H(): Promise<BTCAnalysis | null> {
    const candles = await getCandles('BTC', '4h', 50);
    if (candles.length < 20) return null;

    const indicator = await getLatestIndicator('BTC', '4h');
    if (!indicator || indicator.atr14 === null) return null;

    const latestClose = candles[0].close;
    const ema20 = indicator.ema20;
    const ema50 = indicator.ema50;
    const ema200 = indicator.ema200;
    const atr = indicator.atr14;

    const recentChange = candles.length >= 6
        ? ((candles[0].close - candles[5].close) / candles[5].close) * 100
        : 0;

    const atrPercent = (atr / latestClose) * 100;

    const priceEma200 = ema200 !== null ? latestClose > ema200 : null;
    const priceEma50 = ema50 !== null ? latestClose > ema50 : null;
    const emaAlignment = ema20 !== null && ema50 !== null && ema200 !== null
        ? ema20 > ema50 && ema50 > ema200
        : false;

    const volatilityScore = atrPercent > 3 ? 1 : atrPercent > 1.5 ? 0.5 : 0;

    return {
        atrPercent,
        ema20,
        ema50,
        ema200,
        recentChange,
        volatilityScore,
    };
}

export async function detectMarketRegime(): Promise<MarketRegime> {
    const [btcAnalysis, fearGreed, news] = await Promise.all([
        analyzeBTC4H(),
        fetchFearGreedIndex(),
        fetchAllRSSNews().catch(() => []),
    ]);

    const hasMacroRisk = detectMacroRiskKeywords(news);

    const fgValue = fearGreed ?? 50;

    if (hasMacroRisk || fgValue < 25) {
        return 'RISK_OFF';
    }

    if (fgValue > 70) {
        return 'RISK_ON';
    }

    if (!btcAnalysis) {
        return fgValue > 50 ? 'RISK_ON' : fgValue < 40 ? 'RISK_OFF' : 'SIDEWAYS';
    }

    const { atrPercent, recentChange, volatilityScore } = btcAnalysis;

    if (atrPercent > 4 || volatilityScore >= 1) {
        return 'VOLATILE';
    }

    if (Math.abs(recentChange) < 3 && atrPercent < 1.5) {
        return 'SIDEWAYS';
    }

    if (Math.abs(recentChange) > 5 || (btcAnalysis.ema20 !== null && btcAnalysis.ema50 !== null && btcAnalysis.ema20 > btcAnalysis.ema50 * 1.02)) {
        return 'TRENDING';
    }

    return fgValue > 50 ? 'TRENDING' : 'SIDEWAYS';
}

export function getRegimeEffects(regime: MarketRegime): RegimeEffects {
    switch (regime) {
        case 'RISK_ON':
            return {
                confidenceModifier: 1.1,
                stopLossAdjustment: 0,
                allowSignals: true,
            };
        case 'RISK_OFF':
            return {
                confidenceModifier: 0.8,
                stopLossAdjustment: 0.15,
                allowSignals: true,
            };
        case 'TRENDING':
            return {
                confidenceModifier: 1.05,
                stopLossAdjustment: 0,
                allowSignals: true,
            };
        case 'SIDEWAYS':
            return {
                confidenceModifier: 0.9,
                stopLossAdjustment: 0,
                allowSignals: false,
            };
        case 'VOLATILE':
            return {
                confidenceModifier: 0.7,
                stopLossAdjustment: 0.2,
                allowSignals: false,
            };
        default: {
            const _exhaustive: never = regime;
            throw new Error(`[Regime] Unknown regime type: ${String(_exhaustive)}`);
        }
    }
}