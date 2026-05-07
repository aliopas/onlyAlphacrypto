import { db } from '../src/config/db';
import { ohlcvCandles, ohlcvIndicators } from '../src/models/market.model';
import { TRACKED_COINS } from '../src/config/coins';
import {
    detectTrend,
    detectSupportResistance,
    analyzeMarketStructure,
    analyzeVolumeConfirmation,
    detectCandlePattern,
    calculateQualityScore,
    priceDistancePercent,
} from '../src/services/technicalAnalysis.service';
import type {
    TrendLabel,
    SRLevel,
    MarketStructureResult,
    VolumeConfirmationResult,
    CandlePatternResult,
} from '../src/services/technicalAnalysis.service';
import { eq, and, gte, lte } from 'drizzle-orm';
import { env } from '../src/config/env';

type CandleRow = typeof ohlcvCandles.$inferSelect;
type IndicatorRow = typeof ohlcvIndicators.$inferSelect;

const WARMUP_CANDLES = 20;
const END_OFFSET_CANDLES = 18;
const MAX_TRADE_HOURS = 72;
const MIN_QUALITY_SCORE = 60;

interface BacktestSignal {
    date: Date;
    verdict: 'BULLISH' | 'BEARISH';
    entryPrice: number;
    tpPrice: number;
    slPrice: number;
    qualityScore: number;
    nearestSupport: SRLevel | null;
    nearestResistance: SRLevel | null;
}

interface BacktestResult {
    signal: BacktestSignal;
    exitPrice: number | null;
    exitDate: Date | null;
    pnlPercent: number | null;
    durationHours: number | null;
    win: boolean | null;
}

interface BacktestMetrics {
    winRate72h: number;
    qualityThreshold: number;
    directionalDiversity: boolean;
    trendAccuracy: number;
    sRHitRate: number;
}

function buildSignal(
    trend: TrendLabel,
    currentPrice: number,
    supportLevels: SRLevel[],
    resistanceLevels: SRLevel[],
    structure: MarketStructureResult,
    volume: VolumeConfirmationResult,
    pattern: CandlePatternResult,
    signalDate: Date,
): BacktestSignal | null {
    if (structure.isFailedBos) return null;

    const nearestSupport = supportLevels
        .filter(l => l.price < currentPrice)
        .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0] ?? null;

    const nearestResistance = resistanceLevels
        .filter(l => l.price > currentPrice)
        .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0] ?? null;

    const qualityResult = calculateQualityScore({
        trend,
        currentPrice,
        nearestSupport,
        nearestResistance,
        volumeConfirmed: volume.isAboveAverage,
        volumeSpike: volume.isSpike,
        patternAtSR: pattern.isValid,
        isChocho: structure.isChocho,
        isFailedBos: false,
        priceChange24h: null,
    });

    if (qualityResult.isRejected) return null;
    if (qualityResult.score < MIN_QUALITY_SCORE) return null;

    const isBullish = trend === 'STRONG_BULLISH' || trend === 'BULLISH';
    const isBearish = trend === 'STRONG_BEARISH' || trend === 'BEARISH';
    if (!isBullish && !isBearish) return null;

    const verdict: 'BULLISH' | 'BEARISH' = isBullish ? 'BULLISH' : 'BEARISH';

    let tpPrice: number;
    let slPrice: number;

    if (verdict === 'BULLISH') {
        tpPrice = nearestResistance?.price || currentPrice * 1.1;
        slPrice = nearestSupport?.price || currentPrice * 0.9;
    } else {
        tpPrice = nearestSupport?.price || currentPrice * 0.9;
        slPrice = nearestResistance?.price || currentPrice * 1.1;
    }

    return {
        date: signalDate,
        verdict,
        entryPrice: currentPrice,
        tpPrice,
        slPrice,
        qualityScore: qualityResult.score,
        nearestSupport,
        nearestResistance,
    };
}

function simulateTrade(signal: BacktestSignal, futureCandles: CandleRow[]): BacktestResult | null {
    let exitPrice: number | null = null;
    let exitDate: Date | null = null;

    for (const candle of futureCandles) {
        const hoursElapsed = (candle.openTime.getTime() - signal.date.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed > MAX_TRADE_HOURS) break;

        if (signal.verdict === 'BULLISH') {
            if (candle.high >= signal.tpPrice) {
                exitPrice = signal.tpPrice;
                exitDate = candle.openTime;
                break;
            }
            if (candle.low <= signal.slPrice) {
                exitPrice = signal.slPrice;
                exitDate = candle.openTime;
                break;
            }
        } else {
            if (candle.low <= signal.tpPrice) {
                exitPrice = signal.tpPrice;
                exitDate = candle.openTime;
                break;
            }
            if (candle.high >= signal.slPrice) {
                exitPrice = signal.slPrice;
                exitDate = candle.openTime;
                break;
            }
        }
    }

    if (!exitPrice && futureCandles.length > 0) {
        let exitCandle = futureCandles[futureCandles.length - 1];
        for (const candle of futureCandles) {
            const hoursElapsed = (candle.openTime.getTime() - signal.date.getTime()) / (1000 * 60 * 60);
            if (hoursElapsed >= MAX_TRADE_HOURS) {
                exitCandle = candle;
                break;
            }
        }
        exitPrice = exitCandle.close;
        exitDate = exitCandle.openTime;
    }

    if (!exitPrice) return null;

    const pnlPercent = signal.verdict === 'BULLISH'
        ? ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100
        : ((signal.entryPrice - exitPrice) / signal.entryPrice) * 100;

    const durationHours = exitDate
        ? (exitDate.getTime() - signal.date.getTime()) / (1000 * 60 * 60)
        : null;

    return {
        signal,
        exitPrice,
        exitDate,
        pnlPercent,
        durationHours,
        win: pnlPercent > 0,
    };
}

function calculateMetrics(results: BacktestResult[], allCandles: CandleRow[]): BacktestMetrics {
    if (results.length === 0) {
        return { winRate72h: 0, qualityThreshold: 0, directionalDiversity: false, trendAccuracy: 0, sRHitRate: 0 };
    }

    const qualitySignals = results.filter(r => r.signal.qualityScore >= MIN_QUALITY_SCORE);
    const winningSignals = qualitySignals.filter(r => r.win === true);
    const winRate72h = qualitySignals.length > 0
        ? (winningSignals.length / qualitySignals.length) * 100
        : 0;

    const dailyQuality = new Map<string, number[]>();
    for (const r of results) {
        const dateKey = r.signal.date.toISOString().slice(0, 10);
        const scores = dailyQuality.get(dateKey) ?? [];
        scores.push(r.signal.qualityScore);
        dailyQuality.set(dateKey, scores);
    }

    let daysAbove = 0;
    for (const scores of dailyQuality.values()) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg >= MIN_QUALITY_SCORE) daysAbove++;
    }
    const qualityThreshold = dailyQuality.size > 0 ? (daysAbove / dailyQuality.size) * 100 : 0;

    const bullishCount = results.filter(r => r.signal.verdict === 'BULLISH').length;
    const bearishCount = results.filter(r => r.signal.verdict === 'BEARISH').length;
    const directionalDiversity = bullishCount > 0 && bearishCount > 0;

    let correctPredictions = 0;
    let totalPredictions = 0;
    for (const result of results) {
        const signalTime = result.signal.date;
        const futureCandles = allCandles.filter(c =>
            c.openTime > signalTime &&
            c.openTime <= new Date(signalTime.getTime() + 24 * 60 * 60 * 1000)
        );
        if (futureCandles.length > 0) {
            const endPrice = futureCandles[futureCandles.length - 1].close;
            const priceMovedUp = endPrice > result.signal.entryPrice;
            if ((result.signal.verdict === 'BULLISH' && priceMovedUp) ||
                (result.signal.verdict === 'BEARISH' && !priceMovedUp)) {
                correctPredictions++;
            }
            totalPredictions++;
        }
    }
    const trendAccuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

    let srHits = 0;
    for (const result of results) {
        const signalTime = result.signal.date;
        const futureCandles = allCandles.filter(c =>
            c.openTime > signalTime &&
            c.openTime <= new Date(signalTime.getTime() + MAX_TRADE_HOURS * 60 * 60 * 1000)
        );

        const levelsToCheck: SRLevel[] = [];
        if (result.signal.nearestSupport) levelsToCheck.push(result.signal.nearestSupport);
        if (result.signal.nearestResistance) levelsToCheck.push(result.signal.nearestResistance);
        if (levelsToCheck.length === 0) continue;

        let levelHit = false;
        for (const level of levelsToCheck) {
            for (const candle of futureCandles) {
                if (priceDistancePercent(candle.low, level.price) <= 1 ||
                    priceDistancePercent(candle.high, level.price) <= 1) {
                    levelHit = true;
                    break;
                }
            }
            if (levelHit) break;
        }
        if (levelHit) srHits++;
    }
    const sRHitRate = results.length > 0 ? (srHits / results.length) * 100 : 0;

    return { winRate72h, qualityThreshold, directionalDiversity, trendAccuracy, sRHitRate };
}

function printQualityHistogram(qualityScores: number[]): void {
    console.log('QUALITY SCORE DISTRIBUTION:');
    const bins = [0, 20, 40, 60, 80, 100];
    const hist = new Array(bins.length - 1).fill(0) as number[];

    for (const score of qualityScores) {
        for (let i = 0; i < bins.length - 1; i++) {
            if (score >= bins[i] && score < bins[i + 1]) {
                hist[i]++;
                break;
            }
        }
        if (score >= 100) hist[hist.length - 1]++;
    }

    for (let i = 0; i < hist.length; i++) {
        const range = `${bins[i]}-${bins[i + 1]}`;
        const bar = '#'.repeat(Math.min(hist[i] * 2, 20));
        console.log(`  ${range.padEnd(7)}: ${bar} (${hist[i]})`);
    }
}

function printPassCriteria(metrics: BacktestMetrics): boolean {
    const checks: Array<{ label: string; pass: boolean }> = [
        { label: 'Win Rate', pass: metrics.winRate72h >= 40 },
        { label: 'Quality', pass: metrics.qualityThreshold >= 20 },
        { label: 'Diversity', pass: metrics.directionalDiversity },
        { label: 'Trend Acc', pass: metrics.trendAccuracy >= 55 },
        { label: 'S/R Hit', pass: metrics.sRHitRate >= 50 },
    ];

    console.log('PASS CHECK:');
    for (const check of checks) {
        console.log(`  ${check.label.padEnd(12)}: ${check.pass ? 'PASS' : 'FAIL'}`);
    }
    return checks.every(c => c.pass);
}

async function runBacktestForCoin(coinSymbol: string): Promise<{
    results: BacktestResult[];
    metrics: BacktestMetrics;
    qualityScores: number[];
} | null> {
    console.log(`[Backtest] Loading data for ${coinSymbol}...`);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const candleRows = await db.select()
        .from(ohlcvCandles)
        .where(and(
            eq(ohlcvCandles.coinSymbol, coinSymbol),
            eq(ohlcvCandles.timeframe, '4h'),
            gte(ohlcvCandles.openTime, startDate),
            lte(ohlcvCandles.openTime, endDate)
        ))
        .orderBy(ohlcvCandles.openTime);

    if (candleRows.length < 50) {
        console.log(`[Backtest] Insufficient data for ${coinSymbol}: ${candleRows.length} candles (need 50)`);
        return null;
    }

    const indicator4hRows = await db.select()
        .from(ohlcvIndicators)
        .where(and(
            eq(ohlcvIndicators.coinSymbol, coinSymbol),
            eq(ohlcvIndicators.timeframe, '4h'),
            gte(ohlcvIndicators.openTime, startDate),
            lte(ohlcvIndicators.openTime, endDate)
        ))
        .orderBy(ohlcvIndicators.openTime);

    const indicator1dRows = await db.select()
        .from(ohlcvIndicators)
        .where(and(
            eq(ohlcvIndicators.coinSymbol, coinSymbol),
            eq(ohlcvIndicators.timeframe, '1d'),
            gte(ohlcvIndicators.openTime, startDate),
            lte(ohlcvIndicators.openTime, endDate)
        ))
        .orderBy(ohlcvIndicators.openTime);

    const indicators4h = new Map<string, IndicatorRow>();
    for (const ind of indicator4hRows) {
        indicators4h.set(ind.openTime.toISOString(), ind);
    }

    console.log(`[Backtest] Analyzing ${candleRows.length} candles for ${coinSymbol}...`);

    const results: BacktestResult[] = [];
    const qualityScores: number[] = [];
    let skippedCount = 0;
    let ptr1d = 0;

    for (let i = WARMUP_CANDLES; i < candleRows.length - END_OFFSET_CANDLES; i++) {
        const currentCandle = candleRows[i];
        const currentPrice = currentCandle.close;

        const indicator4h = indicators4h.get(currentCandle.openTime.toISOString()) ?? null;
        if (!indicator4h) continue;

        while (ptr1d < indicator1dRows.length - 1 &&
               indicator1dRows[ptr1d + 1].openTime <= currentCandle.openTime) {
            ptr1d++;
        }
        const indicator1d = (ptr1d < indicator1dRows.length &&
                             indicator1dRows[ptr1d].openTime <= currentCandle.openTime)
            ? indicator1dRows[ptr1d]
            : null;

        const historicalCandlesDesc = candleRows.slice(0, i + 1).reverse();
        const latestCandleDesc = [currentCandle];
        const last100Desc = candleRows.slice(Math.max(0, i - 99), i + 1).reverse();
        const last5Desc = candleRows.slice(Math.max(0, i - 4), i + 1).reverse();

        try {
            const [trend, srResult, structure, volume] = await Promise.all([
                detectTrend(coinSymbol, indicator4h, indicator1d, latestCandleDesc),
                detectSupportResistance(coinSymbol, historicalCandlesDesc),
                analyzeMarketStructure(coinSymbol, last100Desc),
                analyzeVolumeConfirmation(coinSymbol, latestCandleDesc, indicator4h),
            ]);

            const { supportLevels, resistanceLevels } = srResult;

            const pattern = await detectCandlePattern(
                coinSymbol,
                supportLevels,
                resistanceLevels,
                last5Desc,
                indicator4h,
            );

            const signal = buildSignal(
                trend,
                currentPrice,
                supportLevels,
                resistanceLevels,
                structure,
                volume,
                pattern,
                currentCandle.openTime,
            );

            if (!signal) continue;

            const futureCandles = candleRows.slice(i + 1);
            const tradeResult = simulateTrade(signal, futureCandles);

            if (tradeResult) {
                results.push(tradeResult);
                qualityScores.push(signal.qualityScore);
            }
        } catch {
            skippedCount++;
            continue;
        }
    }

    if (skippedCount > 0) {
        console.log(`[Backtest] Skipped ${skippedCount} candles due to errors for ${coinSymbol}`);
    }

    if (results.length === 0) {
        console.log(`[Backtest] No valid signals generated for ${coinSymbol}`);
        return null;
    }

    const metrics = calculateMetrics(results, candleRows);

    console.log(`[Backtest] Generated ${results.length} signals for ${coinSymbol}`);
    console.log(`[Backtest] Win Rate 72h:     ${metrics.winRate72h.toFixed(1)}%`);
    console.log(`[Backtest] Quality Threshold: ${metrics.qualityThreshold.toFixed(1)}%`);
    console.log(`[Backtest] Diversity:        ${metrics.directionalDiversity ? 'YES' : 'NO'}`);
    console.log(`[Backtest] Trend Accuracy:   ${metrics.trendAccuracy.toFixed(1)}%`);
    console.log(`[Backtest] S/R Hit Rate:     ${metrics.sRHitRate.toFixed(1)}%`);

    return { results, metrics, qualityScores };
}

async function main(): Promise<void> {
    if (!env.BACKTEST_TECHNICAL_ENABLED) {
        console.error('BACKTEST_TECHNICAL_ENABLED is false. Enable in environment variables.');
        process.exit(2);
    }

    const args = process.argv.slice(2);
    const coinArg = args.find(arg => !arg.startsWith('--'));
    const batchMode = args.includes('--batch') || args.includes('--all');

    if (batchMode) {
        console.log('='.repeat(60));
        console.log('v2.Phase 1.5 -- Technical Analysis Engine Backtesting (Batch Mode)');
        console.log('='.repeat(60));
        console.log(`Testing all ${TRACKED_COINS.length} coins over last 90 days`);
        console.log('');

        const coinResults: Array<{ coin: string; metrics: BacktestMetrics; qualityScores: number[] }> = [];

        for (const coin of TRACKED_COINS) {
            const coinResult = await runBacktestForCoin(coin);
            if (coinResult) {
                coinResults.push({ coin, metrics: coinResult.metrics, qualityScores: coinResult.qualityScores });
            }
        }

        if (coinResults.length === 0) {
            console.log('NO DATA -- Cannot run backtest for any coin');
            process.exit(2);
            return;
        }

        const avgWinRate = coinResults.reduce((s, r) => s + r.metrics.winRate72h, 0) / coinResults.length;
        const avgQualityThreshold = coinResults.reduce((s, r) => s + r.metrics.qualityThreshold, 0) / coinResults.length;
        const allHaveDiversity = coinResults.every(r => r.metrics.directionalDiversity);
        const avgTrendAccuracy = coinResults.reduce((s, r) => s + r.metrics.trendAccuracy, 0) / coinResults.length;
        const avgSRHitRate = coinResults.reduce((s, r) => s + r.metrics.sRHitRate, 0) / coinResults.length;

        console.log('');
        console.log('AGGREGATE RESULTS ACROSS ALL COINS:');
        console.log('-'.repeat(50));
        console.log(`Average Win Rate (72h):     ${avgWinRate.toFixed(1)}% (req: >=40%)`);
        console.log(`Average Quality Threshold:  ${avgQualityThreshold.toFixed(1)}% (req: >=20%)`);
        console.log(`Directional Diversity:      ${allHaveDiversity ? 'YES' : 'NO'} (req: all true)`);
        console.log(`Average Trend Accuracy:     ${avgTrendAccuracy.toFixed(1)}% (req: >=55%)`);
        console.log(`Average S/R Hit Rate:       ${avgSRHitRate.toFixed(1)}% (req: >=50%)`);
        console.log('');

        const aggregateMetrics: BacktestMetrics = {
            winRate72h: avgWinRate,
            qualityThreshold: avgQualityThreshold,
            directionalDiversity: allHaveDiversity,
            trendAccuracy: avgTrendAccuracy,
            sRHitRate: avgSRHitRate,
        };

        const allPass = printPassCriteria(aggregateMetrics);
        console.log('');

        const allQualityScores = coinResults.flatMap(r => r.qualityScores);
        printQualityHistogram(allQualityScores);

        if (allPass) {
            console.log('');
            console.log('BACKTEST PASSED -- TA Engine ready for production');
            console.log('  Proceed to Tranche 2: Shadow Mode + Classification');
            process.exit(0);
        } else {
            console.log('');
            console.log('BACKTEST FAILED -- TA Engine needs tuning');
            console.log('  Review and improve algorithms before proceeding');
            process.exit(1);
        }
    } else {
        if (!coinArg || !(TRACKED_COINS as readonly string[]).includes(coinArg)) {
            console.error('Usage: npm run backtest-technical <coin> [--batch]');
            console.error(`Available coins: ${TRACKED_COINS.join(', ')}`);
            console.error('Use --batch to test all coins');
            process.exit(2);
            return;
        }

        console.log('='.repeat(60));
        console.log('v2.Phase 1.5 -- Technical Analysis Engine Backtesting');
        console.log('='.repeat(60));
        console.log(`Testing coin: ${coinArg}`);
        console.log('Date range: Last 90 days');
        console.log('');

        const backtestResult = await runBacktestForCoin(coinArg);

        if (!backtestResult) {
            console.log('INSUFFICIENT DATA -- Cannot run backtest');
            process.exit(2);
            return;
        }

        const { results, metrics, qualityScores } = backtestResult;

        console.log('');
        console.log('FINAL METRICS:');
        console.log('-'.repeat(40));
        console.log(`Win Rate (72h):       ${metrics.winRate72h.toFixed(1)}% (req: >=40%)`);
        console.log(`Quality Threshold:    ${metrics.qualityThreshold.toFixed(1)}% (req: >=20%)`);
        console.log(`Directional Diversity: ${metrics.directionalDiversity ? 'YES' : 'NO'} (req: true)`);
        console.log(`Trend Accuracy:       ${metrics.trendAccuracy.toFixed(1)}% (req: >=55%)`);
        console.log(`S/R Hit Rate:         ${metrics.sRHitRate.toFixed(1)}% (req: >=50%)`);
        console.log('');

        const allPass = printPassCriteria(metrics);
        console.log('');

        printQualityHistogram(qualityScores);

        if (allPass) {
            console.log('');
            console.log('BACKTEST PASSED -- TA Engine ready for production');
            console.log('  Proceed to Tranche 2: Shadow Mode + Classification');
            process.exit(0);
        } else {
            console.log('');
            console.log('BACKTEST FAILED -- TA Engine needs tuning');
            console.log('  Review and improve algorithms before proceeding');
            process.exit(1);
        }
    }
}

main().catch(error => {
    console.error('Backtest failed:', error);
    process.exit(2);
});
