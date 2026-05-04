import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

interface EventImpactAnalysisInput {
  coinSymbol?: string;
  eventType?: string;
  eventSeverity?: number;
}

interface HorizonImpactStats {
  sampleSize: number;
  averageChange: number | null;
  medianChange: number | null;
  positiveRate: number | null;
  negativeRate: number | null;
  neutralRate: number | null;
}

interface EventImpactAnalysisOutput {
  totalEvents: number;
  horizonsAvailable: string[];
  horizonStats: {
    "1h": HorizonImpactStats;
    "4h": HorizonImpactStats;
    "24h": HorizonImpactStats;
    "3d": HorizonImpactStats;
    "7d": HorizonImpactStats;
  };
  averageMaxUpside: number | null;
  averageMaxDrawdown: number | null;
  averageTimeToPeak: number | null;
  averageTimeToBottom: number | null;
  outcomeRates: {
    positive: number | null;
    negative: number | null;
    neutral: number | null;
  };
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateRates(values: number[]): { positive: number | null; negative: number | null; neutral: number | null } {
  if (values.length === 0) return { positive: null, negative: null, neutral: null };
  const positive = values.filter(v => v > 0).length;
  const negative = values.filter(v => v < 0).length;
  const neutral = values.filter(v => v === 0).length;
  const total = values.length;
  return {
    positive: (positive / total) * 100,
    negative: (negative / total) * 100,
    neutral: (neutral / total) * 100,
  };
}

async function getEventImpactAnalysis(input: EventImpactAnalysisInput = {}): Promise<EventImpactAnalysisOutput> {
  try {
    // Build filter conditions
    const conditions = [];
    if (input.coinSymbol) {
      conditions.push(eq(coinNewsHistory.coinSymbol, input.coinSymbol));
    }
    if (input.eventType) {
      conditions.push(eq(coinNewsHistory.eventType, input.eventType));
    }
    if (input.eventSeverity) {
      conditions.push(eq(coinNewsHistory.eventSeverity, input.eventSeverity));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all relevant events with outcome data
    const rows = await db
      .select({
        change1h: coinNewsHistory.change1h,
        change4h: coinNewsHistory.change4h,
        change24h: coinNewsHistory.change24h,
        change3d: coinNewsHistory.change3d,
        change7d: coinNewsHistory.change7d,
        maxUpsideAfterEvent: coinNewsHistory.maxUpsideAfterEvent,
        maxDrawdownAfterEvent: coinNewsHistory.maxDrawdownAfterEvent,
        timeToPeakHours: coinNewsHistory.timeToPeakHours,
        timeToBottomHours: coinNewsHistory.timeToBottomHours,
        outcomeClassification: coinNewsHistory.outcomeClassification,
      })
      .from(coinNewsHistory)
      .where(whereClause)
      .orderBy(desc(coinNewsHistory.publishedAt));

    const totalEvents = rows.length;

    // Collect available horizons
    const horizonsAvailable: string[] = [];
    if (rows.some(r => r.change1h !== null)) horizonsAvailable.push('1h');
    if (rows.some(r => r.change4h !== null)) horizonsAvailable.push('4h');
    if (rows.some(r => r.change24h !== null)) horizonsAvailable.push('24h');
    if (rows.some(r => r.change3d !== null)) horizonsAvailable.push('3d');
    if (rows.some(r => r.change7d !== null)) horizonsAvailable.push('7d');

    // Calculate per-horizon stats
    const horizonStats: EventImpactAnalysisOutput['horizonStats'] = {
      '1h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
      '4h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
      '24h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
      '3d': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
      '7d': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
    };

    const horizons = ['1h', '4h', '24h', '3d', '7d'] as const;
    const changeFields = ['change1h', 'change4h', 'change24h', 'change3d', 'change7d'] as const;

    horizons.forEach((horizon, index) => {
      const field = changeFields[index];
      const values: number[] = [];
      for (const row of rows) {
        const value = row[field as keyof typeof row] as number | null;
        if (value !== null) {
          values.push(value);
        }
      }
      const size = values.length;
      const average = size > 0 ? values.reduce((a, b) => a + b, 0) / size : null;
      const median = calculateMedian(values);
      const rates = calculateRates(values);
      horizonStats[horizon] = {
        sampleSize: size,
        averageChange: average,
        medianChange: median,
        positiveRate: rates.positive,
        negativeRate: rates.negative,
        neutralRate: rates.neutral,
      };
    });

    // Calculate aggregate stats
    const maxUpsides: number[] = [];
    const maxDrawdowns: number[] = [];
    const timesToPeak: number[] = [];
    const timesToBottom: number[] = [];
    const outcomeClassifications: string[] = [];

    for (const row of rows) {
      if (row.maxUpsideAfterEvent !== null) maxUpsides.push(row.maxUpsideAfterEvent);
      if (row.maxDrawdownAfterEvent !== null) maxDrawdowns.push(row.maxDrawdownAfterEvent);
      if (row.timeToPeakHours !== null) timesToPeak.push(row.timeToPeakHours);
      if (row.timeToBottomHours !== null) timesToBottom.push(row.timeToBottomHours);
      if (row.outcomeClassification) outcomeClassifications.push(row.outcomeClassification);
    }

    const averageMaxUpside = maxUpsides.length > 0 ? maxUpsides.reduce((a, b) => a + b, 0) / maxUpsides.length : null;
    const averageMaxDrawdown = maxDrawdowns.length > 0 ? maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length : null;
    const averageTimeToPeak = timesToPeak.length > 0 ? timesToPeak.reduce((a, b) => a + b, 0) / timesToPeak.length : null;
    const averageTimeToBottom = timesToBottom.length > 0 ? timesToBottom.reduce((a, b) => a + b, 0) / timesToBottom.length : null;

    const outcomeRates = calculateRates(outcomeClassifications.map(oc => {
      if (oc === 'POSITIVE') return 1;
      if (oc === 'NEGATIVE') return -1;
      return 0;
    }));

    return {
      totalEvents,
      horizonsAvailable,
      horizonStats,
      averageMaxUpside,
      averageMaxDrawdown,
      averageTimeToPeak,
      averageTimeToBottom,
      outcomeRates,
    };
  } catch (error) {
    // Return empty result on error
    return {
      totalEvents: 0,
      horizonsAvailable: [],
      horizonStats: {
        '1h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
        '4h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
        '24h': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
        '3d': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
        '7d': { sampleSize: 0, averageChange: null, medianChange: null, positiveRate: null, negativeRate: null, neutralRate: null },
      },
      averageMaxUpside: null,
      averageMaxDrawdown: null,
      averageTimeToPeak: null,
      averageTimeToBottom: null,
      outcomeRates: { positive: null, negative: null, neutral: null },
    };
  }
}

export { getEventImpactAnalysis };
export type { EventImpactAnalysisInput, EventImpactAnalysisOutput, HorizonImpactStats };