import { db } from '../config/db';
import { eventImpacts, eventImpactOutcomes } from '../models/market.model';
import { eq, and, lte, gte, sql, desc, asc } from 'drizzle-orm';

interface HistoricalComparisonInput {
    eventType: string;           // e.g. 'Hack', 'ETF', 'Regulatory'
    coinSymbol?: string;         // optional — filter to same coin
    eventSeverity?: number;      // optional — filter to same severity
    horizon?: string;            // optional — specific horizon ('1h','4h','24h','3d','7d')
    maxResults?: number;         // default 50
}

interface HistoricalComparisonResult {
    status: 'success' | 'insufficient_data' | 'no_data';
    sampleSize: number;
    filters: {
        eventType: string;
        coinSymbol: string | null;
        eventSeverityRange: [number | null, number | null];
    };
    summary: {
        totalEvents: number;
        distinctCoins: number;
        dateRange: { earliest: string | null; latest: string | null };
    } | null;
    horizonStats: {
        horizon: string;
        sampleSize: number;
        medianChange: number | null;
        avgChange: number | null;
        positiveRate: number | null;
        negativeRate: number | null;
        avgMaxUpside: number | null;
        avgMaxDrawdown: number | null;
        avgTimeToPeak: number | null;
        avgTimeToBottom: number | null;
    }[] | null;
    severityBreakdown: {
        severity: number;
        count: number;
        medianChange24h: number | null;
    }[] | null;
    topCoins: {
        coinSymbol: string;
        count: number;
        medianChange24h: number | null;
    }[] | null;
    contextString: string | null;
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

export async function compareWithHistoricalEvents(input: HistoricalComparisonInput): Promise<HistoricalComparisonResult> {
    const {
        eventType,
        coinSymbol,
        eventSeverity,
        horizon = '24h',
        maxResults = 50
    } = input;

    // Build WHERE conditions
    const whereConditions = [
        eq(eventImpacts.eventType, eventType),
        eq(eventImpactOutcomes.status, 'completed')
    ];

    if (coinSymbol) {
        whereConditions.push(eq(eventImpacts.coinSymbol, coinSymbol));
    }

    if (eventSeverity !== undefined) {
        // ±1 range
        whereConditions.push(gte(eventImpacts.eventSeverity, eventSeverity - 1));
        whereConditions.push(lte(eventImpacts.eventSeverity, eventSeverity + 1));
    }

    // Query with JOIN
    const query = await db
        .select({
            eventId: eventImpacts.id,
            coinSymbol: eventImpacts.coinSymbol,
            eventSeverity: eventImpacts.eventSeverity,
            publishedAt: eventImpacts.publishedAt,
            horizon: eventImpactOutcomes.horizon,
            changePercent: eventImpactOutcomes.changePercent,
            maxUpsidePercent: eventImpactOutcomes.maxUpsidePercent,
            maxDrawdownPercent: eventImpactOutcomes.maxDrawdownPercent,
            timeToPeakHours: eventImpactOutcomes.timeToPeakHours,
            timeToBottomHours: eventImpactOutcomes.timeToBottomHours,
        })
        .from(eventImpacts)
        .innerJoin(eventImpactOutcomes, eq(eventImpacts.id, eventImpactOutcomes.eventImpactId))
        .where(and(...whereConditions))
        .orderBy(desc(eventImpacts.publishedAt))
        .limit(maxResults);

    if (query.length === 0) {
        return {
            status: 'no_data',
            sampleSize: 0,
            filters: {
                eventType,
                coinSymbol: coinSymbol || null,
                eventSeverityRange: eventSeverity !== undefined ? [eventSeverity - 1, eventSeverity + 1] : [null, null],
            },
            summary: null,
            horizonStats: null,
            severityBreakdown: null,
            topCoins: null,
            contextString: null,
        };
    }

    // Group by horizon
    const horizonGroups: Record<string, typeof query> = {};
    query.forEach(row => {
        if (!horizonGroups[row.horizon]) {
            horizonGroups[row.horizon] = [];
        }
        horizonGroups[row.horizon].push(row);
    });

    // Calculate horizon stats
    const horizonStats = Object.entries(horizonGroups).map(([horizonKey, rows]) => {
        const changes = rows.map(r => r.changePercent).filter(Boolean) as number[];
        const upsides = rows.map(r => r.maxUpsidePercent).filter(Boolean) as number[];
        const drawdowns = rows.map(r => r.maxDrawdownPercent).filter(Boolean) as number[];
        const peaks = rows.map(r => r.timeToPeakHours).filter(Boolean) as number[];
        const bottoms = rows.map(r => r.timeToBottomHours).filter(Boolean) as number[];

        const rates = calculateRates(changes);

        return {
            horizon: horizonKey,
            sampleSize: changes.length,
            medianChange: calculateMedian(changes),
            avgChange: changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null,
            positiveRate: rates.positive,
            negativeRate: rates.negative,
            avgMaxUpside: upsides.length > 0 ? upsides.reduce((a, b) => a + b, 0) / upsides.length : null,
            avgMaxDrawdown: drawdowns.length > 0 ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : null,
            avgTimeToPeak: peaks.length > 0 ? peaks.reduce((a, b) => a + b, 0) / peaks.length : null,
            avgTimeToBottom: bottoms.length > 0 ? bottoms.reduce((a, b) => a + b, 0) / bottoms.length : null,
        };
    });

    // Calculate summary
    const totalEvents = new Set(query.map(r => r.eventId)).size;
    const distinctCoins = new Set(query.map(r => r.coinSymbol)).size;
    const dates = query.map(r => r.publishedAt).sort((a, b) => a.getTime() - b.getTime());
    const dateRange = dates.length > 0 ? {
        earliest: dates[0].toISOString().split('T')[0],
        latest: dates[dates.length - 1].toISOString().split('T')[0],
    } : { earliest: null, latest: null };

    // Severity breakdown
    const severityGroups: Record<number, typeof query> = {};
    query.forEach(row => {
        if (row.eventSeverity !== null) {
            if (!severityGroups[row.eventSeverity]) {
                severityGroups[row.eventSeverity] = [];
            }
            severityGroups[row.eventSeverity].push(row);
        }
    });

    const severityBreakdown = Object.entries(severityGroups).map(([severity, rows]) => {
        const changes24h = rows
            .filter(r => r.horizon === '24h')
            .map(r => r.changePercent)
            .filter(Boolean) as number[];
        return {
            severity: parseInt(severity),
            count: rows.length,
            medianChange24h: calculateMedian(changes24h),
        };
    });

    // Top coins
    const coinGroups: Record<string, typeof query> = {};
    query.forEach(row => {
        if (!coinGroups[row.coinSymbol]) {
            coinGroups[row.coinSymbol] = [];
        }
        coinGroups[row.coinSymbol].push(row);
    });

    const topCoins = Object.entries(coinGroups)
        .map(([coinSymbol, rows]) => {
            const changes24h = rows
                .filter(r => r.horizon === '24h')
                .map(r => r.changePercent)
                .filter(Boolean) as number[];
            return {
                coinSymbol,
                count: rows.length,
                medianChange24h: calculateMedian(changes24h),
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Check sample size for specified horizon
    const targetHorizonStats = horizonStats.find(h => h.horizon === horizon);
    const sampleSize = targetHorizonStats?.sampleSize || 0;

    if (sampleSize < 5) {
        return {
            status: 'insufficient_data',
            sampleSize,
            filters: {
                eventType,
                coinSymbol: coinSymbol || null,
                eventSeverityRange: eventSeverity !== undefined ? [eventSeverity - 1, eventSeverity + 1] : [null, null],
            },
            summary: {
                totalEvents,
                distinctCoins,
                dateRange,
            },
            horizonStats,
            severityBreakdown,
            topCoins,
            contextString: null,
        };
    }

    // Generate context string
    const h24Stats = horizonStats.find(h => h.horizon === '24h');
    let contextString = `Historical context for ${eventType} events (${sampleSize} similar events found):\n`;

    if (h24Stats && h24Stats.medianChange !== null) {
        contextString += `- Median 24h price movement: ${h24Stats.medianChange >= 0 ? '+' : ''}${h24Stats.medianChange.toFixed(2)}%\n`;
    }
    if (h24Stats && h24Stats.positiveRate !== null) {
        contextString += `- Positive outcome rate (24h): ${h24Stats.positiveRate.toFixed(1)}%\n`;
    }
    if (h24Stats && h24Stats.avgMaxUpside !== null) {
        contextString += `- Average max upside (24h): ${h24Stats.avgMaxUpside.toFixed(2)}%\n`;
    }
    if (h24Stats && h24Stats.avgMaxDrawdown !== null) {
        contextString += `- Average max drawdown (24h): ${h24Stats.avgMaxDrawdown.toFixed(2)}%\n`;
    }

    const topCoinsText = topCoins.slice(0, 3).map(c => `${c.coinSymbol} (${c.medianChange24h !== null ? `${c.medianChange24h >= 0 ? '+' : ''}${c.medianChange24h.toFixed(2)}%` : 'N/A'})`).join(', ');
    if (topCoinsText) {
        contextString += `- Most affected coins: ${topCoinsText}\n`;
    }

    contextString += 'Data sourced from OnlyAlpha event impact database. Not financial advice.';

    return {
        status: 'success',
        sampleSize,
        filters: {
            eventType,
            coinSymbol: coinSymbol || null,
            eventSeverityRange: eventSeverity !== undefined ? [eventSeverity - 1, eventSeverity + 1] : [null, null],
        },
        summary: {
            totalEvents,
            distinctCoins,
            dateRange,
        },
        horizonStats,
        severityBreakdown,
        topCoins,
        contextString,
    };
}

export async function buildHistoricalContextString(input: HistoricalComparisonInput): Promise<string> {
    const result = await compareWithHistoricalEvents(input);
    return result.contextString || 'No historical context available for this event type.';
}