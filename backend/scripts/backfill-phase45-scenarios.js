#!/usr/bin/env node

/**
 * Backfill Phase 4.5 Scenarios
 *
 * Safe backfill script for creating Market Scenarios from recent eligible events.
 *
 * Usage:
 *   node backfill-phase45-scenarios.js --dry-run  # Default, safe preview
 *   node backfill-phase45-scenarios.js --execute  # Actually create scenarios
 *
 * Scope: Last 14 days, major/high-severity events, major coins only.
 */

const { db } = require('../dist/config/db');
const { ScenarioTrackerService } = require('../dist/services/scenarioTracker.service');
const { eq, and, gte, lte } = require('drizzle-orm');
const { coinNewsHistory } = require('../dist/models/market.model');

// Major coins for backfill
const MAJOR_COINS = ['BTC', 'ETH', 'SOL', 'ADA', 'LINK', 'DOT', 'AVAX', 'MATIC'];

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || args.length === 0;
    const isExecute = args.includes('--execute');

    if (!isDryRun && !isExecute) {
        console.log('Usage: node backfill-phase45-scenarios.js --dry-run (default) or --execute');
        process.exit(1);
    }

    console.log(`[Backfill] Starting ${isDryRun ? 'DRY RUN' : 'EXECUTE'} mode`);

    // Get recent events (last 14 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);

    const events = await db.select()
        .from(coinNewsHistory)
        .where(and(
            gte(coinNewsHistory.publishedAt, cutoffDate),
            eq(coinNewsHistory.eventScope, 'COIN') // Only coin-specific events
        ));

    console.log(`[Backfill] Found ${events.length} recent events`);

    let scanned = 0;
    let eligible = 0;
    let skipped = 0;
    let created = 0;
    let duplicates = 0;

    for (const event of events) {
        scanned++;

        // Eligibility checks
        if (!MAJOR_COINS.includes(event.coinSymbol)) {
            console.log(`[Backfill] Skip ${event.coinSymbol}: not major coin`);
            skipped++;
            continue;
        }

        const eligibleSeverities = ['high', 'major'];
        const eventSeverityStr = event.eventSeverity === 5 ? 'high' : event.eventSeverity === 3 ? 'major' : 'low';
        if (!eligibleSeverities.includes(eventSeverityStr)) {
            console.log(`[Backfill] Skip ${event.coinSymbol}: ineligible severity ${eventSeverityStr}`);
            skipped++;
            continue;
        }

        if (!event.priceAtTime) {
            console.log(`[Backfill] Skip ${event.coinSymbol}: no reference price`);
            skipped++;
            continue;
        }

        // Infer bias from sentiment (conservative mapping)
        let bias;
        if (event.sentiment === 'bullish' || event.sentiment === 'strong_bullish') {
            bias = 'bullish';
        } else if (event.sentiment === 'bearish' || event.sentiment === 'strong_bearish') {
            bias = 'bearish';
        } else {
            console.log(`[Backfill] Skip ${event.coinSymbol}: ineligible sentiment ${event.sentiment}`);
            skipped++;
            continue;
        }

        eligible++;

        // Generate dedupe key
        const dedupeKey = `event:${event.sourceHash || 'none'}:${event.coinSymbol}:speculation:${bias}`;

        if (isDryRun) {
            console.log(`[Backfill] DRY RUN: Would create scenario for ${event.coinSymbol} (${bias}) - ${event.title.slice(0, 50)}...`);
        } else {
            try {
                const scenarioId = await ScenarioTrackerService.createScenario({
                    sourceType: 'event',
                    sourceId: event.sourceHash || undefined,
                    coinSymbol: event.coinSymbol,
                    scenarioType: 'speculation',
                    bias,
                    eventType: event.eventType || undefined,
                    eventSeverity: eventSeverityStr,
                    eventScope: event.eventScope || undefined,
                    referencePrice: event.priceAtTime,
                    referencePriceSource: 'binance',
                    referencePriceAt: event.publishedAt,
                    thesis: event.title, // Use title as thesis
                    publicSafeSummary: `Market scenario based on ${event.eventType || 'event'}: ${event.title.slice(0, 100)}...`,
                    // No historical/level snapshots for backfill
                });

                if (scenarioId) {
                    created++;
                    console.log(`[Backfill] Created scenario ${scenarioId} for ${event.coinSymbol}`);
                } else {
                    console.log(`[Backfill] Scenario creation returned null for ${event.coinSymbol}`);
                }
            } catch (err) {
                if (err.message.includes('already exists')) {
                    duplicates++;
                    console.log(`[Backfill] Duplicate scenario for ${event.coinSymbol}: ${dedupeKey}`);
                } else {
                    console.error(`[Backfill] Failed to create scenario for ${event.coinSymbol}:`, err.message);
                }
            }
        }
    }

    console.log(`\n[Backfill] Summary:`);
    console.log(`  Scanned: ${scanned}`);
    console.log(`  Eligible: ${eligible}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Created: ${created}`);
    console.log(`  Duplicates: ${duplicates}`);

    if (isDryRun) {
        console.log(`\n[Backfill] DRY RUN complete. Use --execute to actually create scenarios.`);
    } else {
        console.log(`\n[Backfill] EXECUTE complete.`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
});