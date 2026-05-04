import { db } from '../config/db';
import { coinNewsHistory, eventImpacts, eventImpactOutcomes } from '../models/market.model';
import { eq, and, isNotNull, sql, asc, isNull } from 'drizzle-orm';
import { env } from '../config/env';

interface CoinNewsHistoryRecord {
    id: number;
    coinSymbol: string;
    title: string;
    source: string | null;
    publishedAt: Date;
    sentiment: string | null;
    eventType: string | null;
    eventSeverity: number | null;
    priceAtTime: number | null;
    isRugPull: boolean;
    fetchedAt: Date;
    sourceHash: string | null;
    eventScope: string | null;
    btcPriceAtEvent: number | null;
    ethPriceAtEvent: number | null;
    fearGreedAtEvent: number | null;
    price1hAfter: number | null;
    price4hAfter: number | null;
    price24hAfter: number | null;
    price3dAfter: number | null;
    price7dAfter: number | null;
    change1h: number | null;
    change4h: number | null;
    change24h: number | null;
    change3d: number | null;
    change7d: number | null;
    priceChange7d: number | null;
    maxUpsideAfterEvent: number | null;
    maxDrawdownAfterEvent: number | null;
    timeToPeakHours: number | null;
    timeToBottomHours: number | null;
    outcomeClassification: string | null;
}

interface EventImpactRecord {
    id: number;
    sourceTable: string;
    sourceId: number | null;
    coinSymbol: string;
    eventType: string | null;
    eventSeverity: number | null;
    eventScope: string | null;
    publishedAt: Date;
    priceAtEvent: number | null;
    priceSource: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

interface EventImpactOutcomeRecord {
    id: number;
    eventImpactId: number;
    horizon: string;
    horizonHours: number;
    dueAt: Date;
    checkedAt: Date | null;
    priceAtHorizon: number | null;
    changePercent: number | null;
    maxUpsidePercent: number | null;
    maxDrawdownPercent: number | null;
    timeToPeakHours: number | null;
    timeToBottomHours: number | null;
    outcomeClassification: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface HorizonMapping {
    horizon: string;
    hours: number;
    changeField: keyof Pick<CoinNewsHistoryRecord, 'change1h' | 'change4h' | 'change24h' | 'change3d' | 'change7d'>;
    priceField: keyof Pick<CoinNewsHistoryRecord, 'price1hAfter' | 'price4hAfter' | 'price24hAfter' | 'price3dAfter' | 'price7dAfter'>;
}

interface BatchSummary {
    processed: number;
    created: number;
    skipped: number;
    errors: number;
}

const HORIZONS: HorizonMapping[] = [
    { horizon: '1h', hours: 1, changeField: 'change1h', priceField: 'price1hAfter' },
    { horizon: '4h', hours: 4, changeField: 'change4h', priceField: 'price4hAfter' },
    { horizon: '24h', hours: 24, changeField: 'change24h', priceField: 'price24hAfter' },
    { horizon: '3d', hours: 72, changeField: 'change3d', priceField: 'price3dAfter' },
    { horizon: '7d', hours: 168, changeField: 'change7d', priceField: 'price7dAfter' },
];

function determineImpactStatus(source: CoinNewsHistoryRecord): string {
    const allHorizonsHaveChange = HORIZONS.every(h => {
        const val = source[h.changeField];
        return val !== null && val !== undefined;
    });
    return allHorizonsHaveChange ? 'completed' : 'pending';
}

function addHoursToDate(date: Date, hours: number): Date {
    const result = new Date(date.getTime());
    result.setTime(result.getTime() + hours * 60 * 60 * 1000);
    return result;
}

async function persistEventImpact(source: CoinNewsHistoryRecord): Promise<number | null> {
    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        return null;
    }

    try {
        const existing = await db
            .select({ id: eventImpacts.id })
            .from(eventImpacts)
            .where(eq(eventImpacts.sourceId, source.id))
            .limit(1);

        if (existing.length > 0) {
            return null;
        }

        const status = determineImpactStatus(source);

        const [inserted] = await db
            .insert(eventImpacts)
            .values({
                sourceTable: 'coin_news_history',
                sourceId: source.id,
                coinSymbol: source.coinSymbol,
                eventType: source.eventType,
                eventSeverity: source.eventSeverity,
                eventScope: source.eventScope,
                publishedAt: source.publishedAt,
                priceAtEvent: source.priceAtTime,
                priceSource: 'binance',
                status,
            })
            .returning({ id: eventImpacts.id });

        return inserted.id;
    } catch (error) {
        console.error(`[EventImpactPersistence] Failed to persist impact for source_id=${source.id}:`, error instanceof Error ? error.message : String(error));
        return null;
    }
}

async function persistEventImpactOutcomes(eventImpactId: number, source: CoinNewsHistoryRecord): Promise<number> {
    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        return 0;
    }

    try {
        const outcomeValues = HORIZONS.map((h): {
            eventImpactId: number;
            horizon: string;
            horizonHours: number;
            dueAt: Date;
            checkedAt: Date | null;
            priceAtHorizon: number | null;
            changePercent: number | null;
            maxUpsidePercent: number | null;
            maxDrawdownPercent: number | null;
            timeToPeakHours: number | null;
            timeToBottomHours: number | null;
            outcomeClassification: string | null;
            status: string;
        } => {
            const changePercent = source[h.changeField];
            const priceAtHorizon = source[h.priceField];
            const hasData = changePercent !== null && changePercent !== undefined;

            return {
                eventImpactId,
                horizon: h.horizon,
                horizonHours: h.hours,
                dueAt: addHoursToDate(source.publishedAt, h.hours),
                checkedAt: hasData ? new Date() : null,
                priceAtHorizon,
                changePercent,
                maxUpsidePercent: source.maxUpsideAfterEvent,
                maxDrawdownPercent: source.maxDrawdownAfterEvent,
                timeToPeakHours: source.timeToPeakHours,
                timeToBottomHours: source.timeToBottomHours,
                outcomeClassification: source.outcomeClassification,
                status: hasData ? 'completed' : 'pending',
            };
        });

        await db.insert(eventImpactOutcomes).values(outcomeValues);
        return outcomeValues.length;
    } catch (error) {
        console.error(`[EventImpactPersistence] Failed to persist outcomes for event_impact_id=${eventImpactId}:`, error instanceof Error ? error.message : String(error));
        return 0;
    }
}

async function persistBatchFromCoinNewsHistory(limit: number, offset: number): Promise<BatchSummary> {
    const summary: BatchSummary = { processed: 0, created: 0, skipped: 0, errors: 0 };

    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        return summary;
    }

    try {
        const rows = await db
            .select()
            .from(coinNewsHistory)
            .where(isNotNull(coinNewsHistory.eventSeverity))
            .orderBy(asc(coinNewsHistory.publishedAt))
            .limit(limit)
            .offset(offset);

        for (const row of rows) {
            summary.processed++;

            try {
                const eventImpactId = await persistEventImpact(row as unknown as CoinNewsHistoryRecord);

                if (eventImpactId === null) {
                    summary.skipped++;
                    continue;
                }

                const outcomeCount = await persistEventImpactOutcomes(eventImpactId, row as unknown as CoinNewsHistoryRecord);

                if (outcomeCount > 0) {
                    summary.created++;
                } else {
                    summary.errors++;
                }
            } catch (error) {
                summary.errors++;
                console.error(`[EventImpactPersistence] Error processing source_id=${row.id}:`, error instanceof Error ? error.message : String(error));
            }
        }
    } catch (error) {
        console.error('[EventImpactPersistence] Batch query failed:', error instanceof Error ? error.message : String(error));
    }

    return summary;
}

async function getEventImpactBySourceId(sourceId: number): Promise<EventImpactRecord | null> {
    try {
        const rows = await db
            .select()
            .from(eventImpacts)
            .where(eq(eventImpacts.sourceId, sourceId))
            .limit(1);

        return rows.length > 0 ? (rows[0] as unknown as EventImpactRecord) : null;
    } catch (error) {
        console.error(`[EventImpactPersistence] Failed to query event_impact for source_id=${sourceId}:`, error instanceof Error ? error.message : String(error));
        return null;
    }
}

async function getOutcomesForEventImpact(eventImpactId: number): Promise<EventImpactOutcomeRecord[]> {
    try {
        const rows = await db
            .select()
            .from(eventImpactOutcomes)
            .where(eq(eventImpactOutcomes.eventImpactId, eventImpactId));

        return rows as unknown as EventImpactOutcomeRecord[];
    } catch (error) {
        console.error(`[EventImpactPersistence] Failed to query outcomes for event_impact_id=${eventImpactId}:`, error instanceof Error ? error.message : String(error));
        return [];
    }
}

export {
    persistEventImpact,
    persistEventImpactOutcomes,
    persistBatchFromCoinNewsHistory,
    getEventImpactBySourceId,
    getOutcomesForEventImpact,
};

export type {
    CoinNewsHistoryRecord,
    EventImpactRecord,
    EventImpactOutcomeRecord,
    BatchSummary,
    HorizonMapping,
};
