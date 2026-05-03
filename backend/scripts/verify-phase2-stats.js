#!/usr/bin/env node

/**
 * Phase 2 Historical Stats Verification Script
 *
 * This script performs read-only verification of Phase 2 temporal stats behavior.
 * It does NOT execute migrations, update/insert/delete any data, or run destructive operations.
 *
 * Run with: node scripts/verify-phase2-stats.js
 *
 * WARNINGS:
 * - Do not run against production without read-only credentials.
 * - Do not run migrations from this script.
 * - Script is for verification only.
 */

const { db } = require('../config/db');
const { coinNewsHistory } = require('../models/market.model');
const { eq, sql, desc, count } = require('drizzle-orm');

async function verifySchema() {
    console.log('=== SCHEMA VERIFICATION ===');

    try {
        // Check if price_7d_after column exists
        const price7dCheck = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'coin_news_history' AND column_name = 'price_7d_after'`);
        if (price7dCheck.rows.length > 0) {
            console.log('✅ price_7d_after column exists');
        } else {
            console.log('❌ price_7d_after column missing');
        }

        // Check if change_7d column exists
        const change7dCheck = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'coin_news_history' AND column_name = 'change_7d'`);
        if (change7dCheck.rows.length > 0) {
            console.log('✅ change_7d column exists');
        } else {
            console.log('❌ change_7d column missing');
        }

        // Check if max_upside_after_event column exists
        const maxUpslopeCheck = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'coin_news_history' AND column_name = 'max_upside_after_event'`);
        if (maxUpslopeCheck.rows.length > 0) {
            console.log('✅ max_upside_after_event column exists');
        } else {
            console.log('❌ max_upside_after_event column missing');
        }

        // Check if max_drawdown_after_event column exists
        const maxDrawdownCheck = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'coin_news_history' AND column_name = 'max_drawdown_after_event'`);
        if (maxDrawdownCheck.rows.length > 0) {
            console.log('✅ max_drawdown_after_event column exists');
        } else {
            console.log('❌ max_drawdown_after_event column missing');
        }

    } catch (err) {
        console.error('Schema check failed:', err.message);
        console.log('Manual SQL check queries:');
        console.log("SELECT column_name FROM information_schema.columns WHERE table_name = 'coin_news_history' AND column_name IN ('price_7d_after', 'change_7d', 'max_upside_after_event', 'max_drawdown_after_event');");
    }
}

async function verifyHistoricalData() {
    console.log('\n=== HISTORICAL DATA AVAILABILITY ===');

    try {
        // Total historical events
        const totalEvents = await db.select({ count: count() }).from(coinNewsHistory);
        console.log(`Total historical events: ${totalEvents[0].count}`);

        // Events with price_7d_after
        const eventsWith7dPrice = await db.select({ count: count() }).from(coinNewsHistory).where(sql`price_7d_after IS NOT NULL`);
        console.log(`Events with 7d price data: ${eventsWith7dPrice[0].count}`);

        // Events with change_7d
        const eventsWith7dChange = await db.select({ count: count() }).from(coinNewsHistory).where(sql`change_7d IS NOT NULL`);
        console.log(`Events with 7d change data: ${eventsWith7dChange[0].count}`);

        // Events with max_upside_after_event
        const eventsWithMaxUpslope = await db.select({ count: count() }).from(coinNewsHistory).where(sql`max_upside_after_event IS NOT NULL`);
        console.log(`Events with max upside data: ${eventsWithMaxUpslope[0].count}`);

        // Events with max_drawdown_after_event
        const eventsWithMaxDrawdown = await db.select({ count: count() }).from(coinNewsHistory).where(sql`max_drawdown_after_event IS NOT NULL`);
        console.log(`Events with max drawdown data: ${eventsWithMaxDrawdown[0].count}`);

    } catch (err) {
        console.error('Data availability check failed:', err.message);
        console.log('Manual SQL queries:');
        console.log('SELECT COUNT(*) FROM coin_news_history;');
        console.log('SELECT COUNT(*) FROM coin_news_history WHERE price_7d_after IS NOT NULL;');
        console.log('SELECT COUNT(*) FROM coin_news_history WHERE change_7d IS NOT NULL;');
        console.log('SELECT COUNT(*) FROM coin_news_history WHERE max_upside_after_event IS NOT NULL;');
        console.log('SELECT COUNT(*) FROM coin_news_history WHERE max_drawdown_after_event IS NOT NULL;');
    }
}

async function verifyPerHorizonSampleSizes() {
    console.log('\n=== PER-HORIZON SAMPLE SIZES ===');

    try {
        // Group by event_type and count samples per horizon
        const eventTypes = await db.select({ eventType: coinNewsHistory.eventType }).from(coinNewsHistory).groupBy(coinNewsHistory.eventType);

        for (const { eventType } of eventTypes) {
            console.log(`\nEvent Type: ${eventType}`);

            const total = await db.select({ count: count() }).from(coinNewsHistory).where(eq(coinNewsHistory.eventType, eventType));
            console.log(`  Total events: ${total[0].count}`);

            // Assuming horizons are checked via change1h, change4h, etc.
            const horizons = ['change1h', 'change4h', 'change24h', 'change3d', 'change7d'];
            for (const horizon of horizons) {
                const countQuery = await db.select({ count: count() }).from(coinNewsHistory).where(sql`${sql.identifier(horizon)} IS NOT NULL AND ${sql.identifier('eventType')} = ${eventType}`);
                console.log(`  ${horizon}: ${countQuery[0].count} samples`);
            }
        }

    } catch (err) {
        console.error('Per-horizon sample sizes check failed:', err.message);
        console.log('Manual SQL query example:');
        console.log('SELECT event_type, COUNT(*) as total, COUNT(change1h) as h1, COUNT(change4h) as h4, COUNT(change24h) as h24, COUNT(change3d) as d3, COUNT(change7d) as d7 FROM coin_news_history GROUP BY event_type;');
    }
}

async function verifyStatsBehavior() {
    console.log('\n=== STATS BEHAVIOR VERIFICATION ===');

    try {
        // Check no-data behavior: events with no change data
        const noDataEvents = await db.select({ count: count() }).from(coinNewsHistory).where(sql`change1h IS NULL AND change4h IS NULL AND change24h IS NULL AND change3d IS NULL AND change7d IS NULL`);
        console.log(`Events with no change data (should trigger no-data behavior): ${noDataEvents[0].count}`);

        // Check low-confidence: small sample sizes per type
        const smallSampleTypes = await db.select({ eventType: coinNewsHistory.eventType, count: count() }).from(coinNewsHistory).groupBy(coinNewsHistory.eventType).having(sql`COUNT(*) < 5`);
        if (smallSampleTypes.length > 0) {
            console.log('Event types with sample size < 5 (potential low-confidence):');
            smallSampleTypes.forEach(row => console.log(`  ${row.eventType}: ${row.count}`));
        } else {
            console.log('All event types have sample size >= 5');
        }

        // Check unavailable horizons
        const totalEvents = await db.select({ count: count() }).from(coinNewsHistory);
        const eventsWith7d = await db.select({ count: count() }).from(coinNewsHistory).where(sql`change7d IS NOT NULL`);
        const unavailable7d = totalEvents[0].count - eventsWith7d[0].count;
        console.log(`Events missing 7d horizon data: ${unavailable7d}`);

    } catch (err) {
        console.error('Stats behavior check failed:', err.message);
        console.log('Manual SQL queries for behavior checks:');
        console.log('SELECT COUNT(*) FROM coin_news_history WHERE change1h IS NULL AND change4h IS NULL AND change24h IS NULL AND change3d IS NULL AND change7d IS NULL;');
        console.log('SELECT event_type, COUNT(*) FROM coin_news_history GROUP BY event_type HAVING COUNT(*) < 5;');
        console.log('SELECT (SELECT COUNT(*) FROM coin_news_history) - (SELECT COUNT(*) FROM coin_news_history WHERE change7d IS NOT NULL) as missing_7d;');
    }
}

async function verifyPromptSafety() {
    console.log('\n=== PROMPT SAFETY CHECKS ===');

    console.log('Manual verification required for prompt safety:');
    console.log('1. Check that AI prompts include anti-hallucination rules:');
    console.log('   - "These statistics come from OnlyAlpha database records."');
    console.log('   - "AI must use only the provided statistics."');
    console.log('   - "AI must not invent historical returns, outcome rates, sample sizes, price levels, or performance claims."');
    console.log('2. Check policy-safe terminology in prompts:');
    console.log('   - Market Scenario (not Signal)');
    console.log('   - Reference Price (not Entry)');
    console.log('   - Target Zone (not Take Profit / TP)');
    console.log('   - Risk Zone or Invalidation Zone (not Stop Loss / SL)');
    console.log('   - Historical Outcome (not P&L)');
    console.log('   - Outcome Rate (not Win Rate)');
    console.log('   - Bullish/Bearish Bias (not Buy/Sell)');
    console.log('3. Verify no-data behavior: If sampleSize = 0, omit historical comparison claims.');
    console.log('4. Verify low-confidence behavior: If confidenceLevel is "very_low" or "low", mention limited historical sample.');
    console.log('5. Verify unavailable horizon: If a horizon is unavailable, do not mention it.');
    console.log('6. Check aiWorkflow.cron.ts integration: Historical stats are fetched after classification and injected into AI prompt.');
}

async function verifyAiWorkflowIntegration() {
    console.log('\n=== AI WORKFLOW INTEGRATION SMOKE CHECK ===');

    try {
        // Check if there are recent events that should have triggered stats lookup
        const recentEvents = await db.select().from(coinNewsHistory).orderBy(desc(coinNewsHistory.publishedAt)).limit(5);
        if (recentEvents.length > 0) {
            console.log('Recent events found - integration appears active');
            recentEvents.forEach(event => {
                console.log(`  ${event.coinSymbol} ${event.eventType} at ${event.publishedAt}`);
            });
        } else {
            console.log('No recent events found - check if aiWorkflow is running');
        }

    } catch (err) {
        console.error('AI workflow integration check failed:', err.message);
        console.log('Manual check: Verify aiWorkflow.cron.ts imports getHistoricalEventStats and PromptFactory.buildHistoricalStatsContext');
        console.log('Check logs for "[AI Workflow] Failed to fetch historical stats" warnings');
    }
}

async function main() {
    console.log('🔍 Starting Phase 2 Historical Stats Verification\n');

    await verifySchema();
    await verifyHistoricalData();
    await verifyPerHorizonSampleSizes();
    await verifyStatsBehavior();
    await verifyPromptSafety();
    await verifyAiWorkflowIntegration();

    console.log('\n✅ Verification complete. Review output above for any issues.');
    console.log('If DB connection failed, run manual SQL queries provided in the output.');

    process.exit(0);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Verification script failed:', err);
        process.exit(1);
    });
}

module.exports = { main };