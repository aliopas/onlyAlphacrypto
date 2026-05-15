import { env } from '../config/env';
import { getLatestIndicator } from './ohlcvSnapshot.service';

export type TrendLabel = 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';

export interface TimeframeData {
    timeframe: '15m' | '1h' | '4h' | '1d' | '1w';
    trend: TrendLabel;
    supportLevels: Array<{ price: number; strengthScore: number }>;
    resistanceLevels: Array<{ price: number; strengthScore: number }>;
    atr: number | null;
    volumeAvg: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
}

export type TrendAlignment = 'aligned' | 'mixed' | 'conflicting';

export interface ConfluenceResult {
    confluenceScore: number;
    trendAlignment: TrendAlignment;
    bullishCount: number;
    bearishCount: number;
    sidewaysCount: number;
    dominantDirection: 'bullish' | 'bearish' | 'neutral';
}

export interface MtfContext {
    symbol: string;
    timeframes: TimeframeData[];
    dominantTrend: TrendLabel;
    timestamp: Date;
    confluence: ConfluenceResult;
}

function detectTrendFromIndicators(
    ema20: number | null,
    ema50: number | null,
    ema200: number | null,
    timeframe: string
): TrendLabel {
    if (ema20 === null || ema50 === null) return 'NEUTRAL';
    if (timeframe === '15m') {
        if (ema20 > ema50) return 'BULLISH';
        if (ema20 < ema50) return 'BEARISH';
        return 'NEUTRAL';
    }
    if (ema200 === null) {
        if (ema20 > ema50) return 'BULLISH';
        if (ema20 < ema50) return 'BEARISH';
        return 'NEUTRAL';
    }
    const aboveEma200 = ema20 > ema200;
    const aligned = ema20 > ema50;
    if (aligned && aboveEma200) return 'STRONG_BULLISH';
    if (!aligned && !aboveEma200) return 'STRONG_BEARISH';
    if (aligned) return 'BULLISH';
    if (!aligned) return 'BEARISH';
    return 'NEUTRAL';
}

export function calculateConfluence(mtfContext: MtfContext): ConfluenceResult {
    let bullishCount = 0;
    let bearishCount = 0;
    let sidewaysCount = 0;

    for (const tf of mtfContext.timeframes) {
        if (tf.trend === 'STRONG_BULLISH' || tf.trend === 'BULLISH') bullishCount++;
        else if (tf.trend === 'STRONG_BEARISH' || tf.trend === 'BEARISH') bearishCount++;
        else sidewaysCount++;
    }

    const nonSideways = bullishCount + bearishCount;
    const alignedWithDominant = mtfContext.dominantTrend === 'STRONG_BULLISH' || mtfContext.dominantTrend === 'BULLISH'
        ? bullishCount
        : mtfContext.dominantTrend === 'STRONG_BEARISH' || mtfContext.dominantTrend === 'BEARISH'
            ? bearishCount
            : 0;

    const confluenceScore = nonSideways > 0 ? Math.round((alignedWithDominant / nonSideways) * 100) : 0;

    let trendAlignment: TrendAlignment;
    if (confluenceScore >= 80) trendAlignment = 'aligned';
    else if (confluenceScore >= 40) trendAlignment = 'mixed';
    else trendAlignment = 'conflicting';

    const dominantDirection: 'bullish' | 'bearish' | 'neutral' =
        mtfContext.dominantTrend === 'STRONG_BULLISH' || mtfContext.dominantTrend === 'BULLISH' ? 'bullish' :
        mtfContext.dominantTrend === 'STRONG_BEARISH' || mtfContext.dominantTrend === 'BEARISH' ? 'bearish' : 'neutral';

    return {
        confluenceScore,
        trendAlignment,
        bullishCount,
        bearishCount,
        sidewaysCount,
        dominantDirection,
    };
}

export async function buildMtfContext(symbol: string): Promise<MtfContext | null> {
    if (!env.MTF_CONTEXT_ENABLED) return null;

    const timeframes: Array<'15m' | '1h' | '4h' | '1d' | '1w'> = ['15m', '1h', '4h', '1d', '1w'];
    const tfData: TimeframeData[] = [];

    for (const tf of timeframes) {
        const indicator = await getLatestIndicator(symbol, tf);
        if (!indicator) {
            console.warn(`[MTF] No indicator data for ${symbol} ${tf} — skipping timeframe`);
            continue;
        }

        const trend = detectTrendFromIndicators(
            indicator.ema20 ?? null,
            indicator.ema50 ?? null,
            indicator.ema200 ?? null,
            tf
        );

        tfData.push({
            timeframe: tf,
            trend,
            supportLevels: [],
            resistanceLevels: [],
            atr: indicator.atr14 ?? null,
            volumeAvg: indicator.volumeAvg20 ?? null,
            ema20: indicator.ema20 ?? null,
            ema50: indicator.ema50 ?? null,
            ema200: indicator.ema200 ?? null,
        });
    }

    if (tfData.length === 0) {
        console.warn(`[MTF] No timeframe data available for ${symbol}`);
        return null;
    }

    const trendCounts: Record<TrendLabel, number> = {
        STRONG_BULLISH: 0,
        BULLISH: 0,
        NEUTRAL: 0,
        BEARISH: 0,
        STRONG_BEARISH: 0,
    };
    for (const tf of tfData) {
        trendCounts[tf.trend]++;
    }
    const dominantTrend = (Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'NEUTRAL') as TrendLabel;

    const baseContext: MtfContext = {
        symbol,
        timeframes: tfData,
        dominantTrend,
        timestamp: new Date(),
        confluence: {
            confluenceScore: 0,
            trendAlignment: 'conflicting',
            bullishCount: 0,
            bearishCount: 0,
            sidewaysCount: 0,
            dominantDirection: 'neutral',
        },
    };

    baseContext.confluence = calculateConfluence(baseContext);

    return baseContext;
}