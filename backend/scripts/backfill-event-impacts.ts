#!/usr/bin/env node

/**
 * Backfill Event Impacts
 *
 * Processes existing coin_news_history records and populates
 * the new event_impacts and event_impact_outcomes tables.
 *
 * Usage:
 *   npx ts-node backfill-event-impacts.ts              # Default: dry-run (safe preview)
 *   npx ts-node backfill-event-impacts.ts --dry-run    # Explicit dry-run
 *   npx ts-node backfill-event-impacts.ts --execute    # Actually write data
 *   npx ts-node backfill-event-impacts.ts --execute --force  # Override BACKFILL_DRY_RUN=true
 *
 * Safety:
 *   - Default mode is dry-run (reads only, logs what would be written)
 *   - Requires EVENT_IMPACT_BACKFILL_ENABLED=true to proceed
 *   - Idempotent: skips already-processed source_ids
 *   - Batch size: 100 records
 *   - Individual failures do not stop batch
 */

import { db } from '../src/config/db';
import { coinNewsHistory, eventImpacts, eventImpactOutcomes } from '../src/models/market.model';
import { eq, and, isNotNull, asc, sql, inArray } from 'drizzle-orm';
import { env } from '../src/config/env';

const BATCH_SIZE = 100;

async function getAlreadyProcessedSourceIds(): Promise<Set<number>> {
    const existing = await db
        .select({ sourceId: eventImpacts.sourceId })
        .from(eventImpacts)
        .where(sql`${eventImpacts.sourceId} IS NOT NULL`);

    const ids = new Set<number>();
    for (const row of existing) {
        if (row.sourceId !== null) {
            ids.add(row.sourceId);
        }
    }
    return ids;
}

async function getTotalEligibleCount(): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(coinNewsHistory)
        .where(isNotNull(coinNewsHistory.eventSeverity));

    return result[0]?.count ?? 0;
}

async function fetchBatch(offset: number): Promise<any[]> {
    return db
        .select()
        .from(coinNewsHistory)
        .where(isNotNull(coinNewsHistory.eventSeverity))
        .orderBy(asc(coinNewsHistory.publishedAt))
        .limit(BATCH_SIZE)
        .offset(offset);
}

function addHoursToDate(date: Date, hours: number): Date {
    const result = new Date(date.getTime());
    result.setTime(result.getTime() + hours * 60 * 60 * 1000);
    return result;
}

function buildOutcomeRows(eventImpactId: number, source: any): any[] {
    const HORIZONS = [
        { horizon: '1h', hours: 1, changeField: 'change1h', priceField: 'price1hAfter' },
        { horizon: '4h', hours: 4, changeField: 'change4h', priceField: 'price4hAfter' },
        { horizon: '24h', hours: 24, changeField: 'change24h', priceField: 'price24hAfter' },
        { horizon: '3d', hours: 72, changeField: 'change3d', priceField: 'price3dAfter' },
        { horizon: '7d', hours: 168, changeField: 'change7d', priceField: 'price7dAfter' },
    ];

    return HORIZONS.map(h => {
        const changePercent = source[h.changeField] ?? null;
        const priceAtHorizon = source[h.priceField] ?? null;
        const hasData = changePercent !== null;

        return {
            eventImpactId,
            horizon: h.horizon,
            horizonHours: h.hours,
            dueAt: addHoursToDate(source.publishedAt, h.hours),
            checkedAt: hasData ? new Date() : null,
            priceAtHorizon,
            changePercent,
            maxUpsidePercent: source.maxUpsideAfterEvent ?? null,
            maxDrawdownPercent: source.maxDrawdownAfterEvent ?? null,
            timeToPeakHours: source.timeToPeakHours ?? null,
            timeToBottomHours: source.timeToBottomHours ?? null,
            outcomeClassification: source.outcomeClassification ?? null,
            status: hasData ? 'completed' : 'pending',
        };
    });
}

function determineImpactStatus(source: any): string {
    const changeFields = ['change1h', 'change4h', 'change24h', 'change3d', 'change7d'];
    const allHaveChange = changeFields.every(f => source[f] !== null && source[f] !== undefined);
    return allHaveChange ? 'completed' : 'pending';
}

async function executeWrite(source: any, alreadyProcessed: Set<number>): Promise<'created' | 'skipped' | 'error'> {
    if (alreadyProcessed.has(source.id)) {
        return 'skipped';
    }

    if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
        return 'error';
    }

    try {
        const status = determineImpactStatus(source);

        const [inserted] = await db
            .insert(eventImpacts)
            .values({
                sourceTable: 'coin_news_history',
                sourceId: source.id,
                coinSymbol: source.coinSymbol,
                eventType: source.eventType ?? null,
                eventSeverity: source.eventSeverity ?? null,
                eventScope: source.eventScope ?? null,
                publishedAt: source.publishedAt,
                priceAtEvent: source.priceAtTime ?? null,
                priceSource: 'binance',
                status,
            })
            .returning({ id: eventImpacts.id });

        if (!inserted) {
            return 'error';
        }

        const outcomeValues = buildOutcomeRows(inserted.id, source);
        await db.insert(eventImpactOutcomes).values(outcomeValues);

        alreadyProcessed.add(source.id);
        return 'created';
    } catch (err: unknown) {
        console.error(`[Backfill] Error writing source_id=${source.id}:`, (err as Error).message || String(err));
        return 'error';
    }
}

async function main() {
    const args = process.argv.slice(2);
    const hasForce = args.includes('--force');
    const isExecute = args.includes('--execute');
    const isDryRun = !isExecute;

    console.log(`\n[Backfill] =========================================`);
    console.log(`[Backfill] Event Impact Backfill Script`);
    console.log(`[Backfill] =========================================\n`);

    // Check BACKFILL_ENABLED flag
    if (!env.EVENT_IMPACT_BACKFILL_ENABLED) {
        console.log(`[Backfill] EVENT_IMPACT_BACKFILL_ENABLED=${env.EVENT_IMPACT_BACKFILL_ENABLED} — exiting safely`);
        console.log(`[Backfill] Set EVENT_IMPACT_BACKFILL_ENABLED=true to enable backfill.\n`);
        process.exit(0);
    }

    // Dry-run vs execute determination
    let effectiveDryRun = isDryRun;

    if (isExecute && env.EVENT_IMPACT_BACKFILL_DRY_RUN && !hasForce) {
        console.log(`[Backfill] WARNING: --execute provided but EVENT_IMPACT_BACKFILL_DRY_RUN=true`);
        console.log(`[Backfill] Use --force to override, or set EVENT_IMPACT_BACKFILL_DRY_RUN=false`);
        console.log(`[Backfill] Defaulting to DRY RUN mode for safety.\n`);
        effectiveDryRun = true;
    }

    if (effectiveDryRun) {
        console.log(`[Backfill] Mode: DRY RUN (no writes will occur)\n`);
    } else {
        console.log(`[Backfill] Mode: EXECUTE (will write data)\n`);

        if (!env.EVENT_IMPACT_PERSISTENCE_ENABLED) {
            console.log(`[Backfill] EVENT_IMPACT_PERSISTENCE_ENABLED=false — cannot write data`);
            console.log(`[Backfill] Set EVENT_IMPACT_PERSISTENCE_ENABLED=true to enable writes.\n`);
            process.exit(0);
        }
    }

    // Get total count
    const totalCount = await getTotalEligibleCount();
    console.log(`[Backfill] Total eligible records (eventSeverity IS NOT NULL): ${totalCount}`);

    if (totalCount === 0) {
        console.log(`[Backfill] No records to process. Exiting.\n`);
        process.exit(0);
    }

    // Get already-processed source IDs for idempotency
    const alreadyProcessed = await getAlreadyProcessedSourceIds();
    console.log(`[Backfill] Already processed: ${alreadyProcessed.size} records\n`);

    let scanned = 0;
    let eligible = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    let batchNumber = 0;

    // Process in batches
    for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
        batchNumber++;
        const batch = await fetchBatch(offset);

        if (batch.length === 0) break;

        for (const record of batch) {
            scanned++;

            if (alreadyProcessed.has(record.id)) {
                skipped++;
                continue;
            }

            eligible++;

            if (effectiveDryRun) {
                created++;
            } else {
                const result = await executeWrite(record, alreadyProcessed);
                if (result === 'created') {
                    created++;
                } else if (result === 'skipped') {
                    skipped++;
                } else {
                    errors++;
                }
            }
        }

        console.log(`[Backfill] Batch ${batchNumber}: scanned=${scanned}, eligible=${eligible}, created=${created}, skipped=${skipped}, errors=${errors}`);
    }

    // Final summary
    console.log(`\n[Backfill] =========================================`);
    console.log(`[Backfill] SUMMARY`);
    console.log(`[Backfill] =========================================`);
    console.log(`  Total scanned:    ${scanned}`);
    console.log(`  Eligible:         ${eligible}`);
    console.log(`  ${effectiveDryRun ? 'Would create' : 'Created'}:     ${created}`);
    console.log(`  Skipped (exists): ${skipped}`);
    console.log(`  Errors:           ${errors}`);

    if (effectiveDryRun) {
        console.log(`\n[Backfill] DRY RUN complete. Use --execute to actually write data.`);
    } else {
        console.log(`\n[Backfill] EXECUTE complete.`);
    }
    console.log(`[Backfill] =========================================\n`);

    process.exit(0);
}

main().catch(err => {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
});