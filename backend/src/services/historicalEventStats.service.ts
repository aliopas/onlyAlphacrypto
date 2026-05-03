import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { eq, and, or, isNotNull, desc } from 'drizzle-orm';

interface HistoricalStatsInput {
  coinSymbol: string;
  eventType: string;
  eventScope: string;
  sentiment: string;
}

interface HorizonStats {
  sampleSize: number;
  medianReturn: number | null;
  bullishRate: number | null;
  available: boolean;
}

interface HistoricalStatsOutput {
  matchLevelUsed: string;
  sampleSize: number;
  horizonStats: {
    "1h": HorizonStats;
    "4h": HorizonStats;
    "24h": HorizonStats;
    "3d": HorizonStats;
    "7d": HorizonStats;
  };
  averageMaxUpside: number | null;
  averageMaxDrawdown: number | null;
  confidenceLevel: string;
  limitations: string[];
}

type MatchLevel = 'EXACT' | 'RELAXED_1' | 'RELAXED_2' | 'RELAXED_3' | 'MARKET_WIDE';

const MATCH_LEVELS: MatchLevel[] = ['EXACT', 'RELAXED_1', 'RELAXED_2', 'RELAXED_3', 'MARKET_WIDE'];

function getMatchConditions(level: MatchLevel, input: HistoricalStatsInput) {
  const { coinSymbol, eventType, eventScope, sentiment } = input;

  switch (level) {
    case 'EXACT':
      return and(
        eq(coinNewsHistory.coinSymbol, coinSymbol),
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventScope, eventScope),
        eq(coinNewsHistory.sentiment, sentiment)
      );
    case 'RELAXED_1':
      return and(
        eq(coinNewsHistory.coinSymbol, coinSymbol),
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventScope, eventScope)
      );
    case 'RELAXED_2':
      return and(
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventScope, eventScope),
        eq(coinNewsHistory.sentiment, sentiment)
      );
    case 'RELAXED_3':
      return and(
        eq(coinNewsHistory.eventType, eventType),
        eq(coinNewsHistory.eventScope, eventScope)
      );
    case 'MARKET_WIDE':
      return eq(coinNewsHistory.eventType, eventType);
  }
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function calculateBullishRate(values: number[]): number | null {
  if (values.length === 0) return null;
  const bullish = values.filter(v => v > 0).length;
  return (bullish / values.length) * 100;
}

async function getHistoricalEventStats(input: HistoricalStatsInput): Promise<HistoricalStatsOutput> {
  try {
    let bestRows: typeof coinNewsHistory.$inferSelect[] = [];
    let matchLevelUsed: MatchLevel = 'MARKET_WIDE';

    // Try each match level in order until we get >= 3 rows
    for (const level of MATCH_LEVELS) {
      const conditions = getMatchConditions(level, input);
      const eligibleCondition = or(
        isNotNull(coinNewsHistory.change1h),
        isNotNull(coinNewsHistory.change4h),
        isNotNull(coinNewsHistory.change24h),
        isNotNull(coinNewsHistory.change3d),
        isNotNull(coinNewsHistory.change7d)
      );

      const rows = await db
        .select()
        .from(coinNewsHistory)
        .where(and(conditions, eligibleCondition))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(100);

      if (rows.length >= 3) {
        bestRows = rows;
        matchLevelUsed = level;
        break;
      }

      if (rows.length > bestRows.length) {
        bestRows = rows;
        matchLevelUsed = level;
      }
    }

    const sampleSize = bestRows.length;

    // Calculate per-horizon stats
    const horizonStats: HistoricalStatsOutput['horizonStats'] = {
      '1h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
      '4h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
      '24h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
      '3d': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
      '7d': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
    };

    const horizons = ['1h', '4h', '24h', '3d', '7d'] as const;
    const changeFields = ['change1h', 'change4h', 'change24h', 'change3d', 'change7d'] as const;

    horizons.forEach((horizon, index) => {
      const field = changeFields[index];
      const values: number[] = [];
      for (const row of bestRows) {
        const value = row[field as keyof typeof row] as number | null;
        if (value !== null) {
          values.push(value);
        }
      }
      const size = values.length;
      const median = calculateMedian(values);
      const bullish = calculateBullishRate(values);
      horizonStats[horizon] = {
        sampleSize: size,
        medianReturn: median,
        bullishRate: bullish,
        available: size > 0,
      };
    });

    // Calculate aggregate stats
    const maxUpsides: number[] = [];
    const maxDrawdowns: number[] = [];

    for (const row of bestRows) {
      if (row.maxUpsideAfterEvent !== null) maxUpsides.push(row.maxUpsideAfterEvent);
      if (row.maxDrawdownAfterEvent !== null) maxDrawdowns.push(row.maxDrawdownAfterEvent);
    }

    const averageMaxUpside = maxUpsides.length > 0 ? maxUpsides.reduce((a, b) => a + b, 0) / maxUpsides.length : null;
    const averageMaxDrawdown = maxDrawdowns.length > 0 ? maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length : null;

    // Calculate confidence
    let baseTier = 0; // none

    if (sampleSize === 0) {
      baseTier = 0;
    } else if (sampleSize <= 2) {
      baseTier = 1;
    } else if (sampleSize <= 5) {
      baseTier = 2;
    } else if (sampleSize <= 15) {
      baseTier = 3;
    } else {
      baseTier = 4;
    }

    // Adjust down for relaxed match or incomplete 3d data
    if (matchLevelUsed === 'RELAXED_2' || matchLevelUsed === 'RELAXED_3' || matchLevelUsed === 'MARKET_WIDE') {
      baseTier = Math.max(0, baseTier - 1);
    }

    const threeDNonNull = horizonStats['3d'].sampleSize;
    const threeDTotal = sampleSize;
    if (threeDTotal > 0 && threeDNonNull / threeDTotal < 0.5) {
      baseTier = Math.max(0, baseTier - 1);
    }

    const tiers = ['none', 'very_low', 'low', 'medium', 'high'];
    const confidenceLevel = tiers[baseTier];

    // Build limitations
    const limitations: string[] = [];

    if (sampleSize === 0) {
      limitations.push('No historical data available');
    } else if (sampleSize < 16) {
      limitations.push(`Sample size is limited (${sampleSize} events)`);
    }

    if (sampleSize > 0) {
      const sevenDNonNull = horizonStats['7d'].sampleSize;
      if (sevenDNonNull / sampleSize < 0.5) {
        limitations.push(`7d outcome data incomplete (${sevenDNonNull}/${sampleSize} events)`);
      }

      if (matchLevelUsed !== 'EXACT') {
        limitations.push(`Used relaxed matching: ${matchLevelUsed.toLowerCase().replace('_', ' ')}`);
      }
    }

    return {
      matchLevelUsed,
      sampleSize,
      horizonStats,
      averageMaxUpside,
      averageMaxDrawdown,
      confidenceLevel,
      limitations,
    };
  } catch (error) {
    return {
      matchLevelUsed: 'NONE',
      sampleSize: 0,
      horizonStats: {
        '1h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
        '4h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
        '24h': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
        '3d': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
        '7d': { sampleSize: 0, medianReturn: null, bullishRate: null, available: false },
      },
      averageMaxUpside: null,
      averageMaxDrawdown: null,
      confidenceLevel: 'none',
      limitations: ['Stats service error'],
    };
  }
}

export { getHistoricalEventStats };
export type { HistoricalStatsInput, HistoricalStatsOutput, HorizonStats };