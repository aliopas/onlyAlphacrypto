#!/usr/bin/env node

/**
 * Production Health Check Script for Intelligence Infrastructure
 * Read-only verification covering Phase 2/3/4/4.5 health
 * Checks env flags, data integrity, and operational status
 */

const { db } = require('../config/db');
const { env } = require('../config/env');
const { coinNewsHistory } = require('../models/market.model');
const { levelIntelligence, levelInteractions } = require('../models/market.model');
const { marketScenarios, scenarioHorizonOutcomes } = require('../models/market.model');
const { eq, sql, and, lt, isNotNull, isNull } = require('drizzle-orm');

async function verifyIntelligenceHealth() {
    console.log('🔍 Production Intelligence Health Check\n');

    try {
        const now = new Date();

        // === ENVIRONMENT FLAGS ===
        console.log('🔧 Environment Flags:');
        console.log(`  LEVEL_INTELLIGENCE_ENABLED: ${env.LEVEL_INTELLIGENCE_ENABLED}`);
        console.log(`  SCENARIO_TRACKER_ENABLED: ${env.SCENARIO_TRACKER_ENABLED}`);
        console.log('');

        // === PHASE 2: EVENT IMPACT HEALTH ===
        console.log('📈 Phase 2: Event Impact Health');
        const eventHistoryCount = await db.select({ count: sql`count(*)` }).from(coinNewsHistory);
        console.log(`  Total event records: ${eventHistoryCount[0].count}`);

        const recentEvents = await db.select({ count: sql`count(*)` }).from(coinNewsHistory)
            .where(sql`${coinNewsHistory.publishedAt} > NOW() - INTERVAL '24 hours'`);
        console.log(`  Events in last 24h: ${recentEvents[0].count}`);

        // Invalid priceAtTime
        const invalidPrices = await db.select({ count: sql`count(*)` }).from(coinNewsHistory)
            .where(and(isNotNull(coinNewsHistory.priceAtTime), sql`${coinNewsHistory.priceAtTime} <= 0`));
        if (invalidPrices[0].count > 0) {
            console.log(`  ❌ Invalid priceAtTime values: ${invalidPrices[0].count}`);
        } else {
            console.log('  ✅ All priceAtTime values are valid');
        }
        console.log('');

        // === PHASE 3: LEVEL INTELLIGENCE HEALTH ===
        console.log('📊 Phase 3: Level Intelligence Health');
        const levelsCount = await db.select({ count: sql`count(*)` }).from(levelIntelligence);
        console.log(`  Total levels: ${levelsCount[0].count}`);

        const interactionsCount = await db.select({ count: sql`count(*)` }).from(levelInteractions);
        console.log(`  Total interactions: ${interactionsCount[0].count}`);

        // Invalid confidence scores
        const invalidConfidences = await db.select({ count: sql`count(*)` }).from(levelIntelligence)
            .where(sql`${levelIntelligence.confidenceScore} < 0 OR ${levelIntelligence.confidenceScore} > 100`);
        if (invalidConfidences[0].count > 0) {
            console.log(`  ❌ Invalid confidence scores: ${invalidConfidences[0].count}`);
        } else {
            console.log('  ✅ All confidence scores are valid (0-100)');
        }

        // Invalid level prices
        const invalidLevelPrices = await db.select({ count: sql`count(*)` }).from(levelIntelligence)
            .where(sql`${levelIntelligence.levelPrice}::numeric <= 0`);
        if (invalidLevelPrices[0].count > 0) {
            console.log(`  ❌ Invalid level prices: ${invalidLevelPrices[0].count}`);
        } else {
            console.log('  ✅ All level prices are valid');
        }

        // Activation check
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentLevels = await db.select({ count: sql`count(*)` }).from(levelIntelligence)
            .where(sql`${levelIntelligence.updatedAt} > ${oneDayAgo}`);
        const recentInteractions = await db.select({ count: sql`count(*)` }).from(levelInteractions)
            .where(sql`${levelInteractions.createdAt} > ${oneDayAgo}`);
        if (env.LEVEL_INTELLIGENCE_ENABLED) {
            if (recentLevels[0].count === 0 && recentInteractions[0].count === 0) {
                console.log('  ⚠️  WARNING: Level Intelligence enabled but no activity in 24h');
            } else {
                console.log('  ✅ Level Intelligence appears active');
            }
        } else {
            console.log('  ⏸️  Level Intelligence disabled');
        }
        console.log('');

        // === PHASE 4: SCENARIO TRACKER HEALTH ===
        console.log('🎯 Phase 4: Scenario Tracker Health');
        const scenariosCount = await db.select({ count: sql`count(*)` }).from(marketScenarios);
        console.log(`  Total scenarios: ${scenariosCount[0].count}`);

        const outcomesCount = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes);
        console.log(`  Total horizon outcomes: ${outcomesCount[0].count}`);

        // Duplicate dedupeKeys
        const dedupeCheck = await db.select({
            dedupeKey: marketScenarios.dedupeKey,
            count: sql`count(*)`
        }).from(marketScenarios)
        .where(isNotNull(marketScenarios.dedupeKey))
        .groupBy(marketScenarios.dedupeKey)
        .having(sql`count(*) > 1`);
        if (dedupeCheck.length > 0) {
            console.log(`  ❌ Duplicate dedupeKeys: ${dedupeCheck.length} groups`);
        } else {
            console.log('  ✅ No duplicate dedupeKeys');
        }

        // Due pending outcomes
        const duePending = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes)
            .where(and(eq(scenarioHorizonOutcomes.status, 'pending'), lt(scenarioHorizonOutcomes.dueAt, now)));
        if (duePending[0].count > 0) {
            console.log(`  ⚠️  Due pending outcomes: ${duePending[0].count}`);
        } else {
            console.log('  ✅ No due pending outcomes');
        }

        // Failed outcomes
        const failedOutcomes = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes)
            .where(sql`${scenarioHorizonOutcomes.status} = 'failed' OR ${scenarioHorizonOutcomes.errorMessage} IS NOT NULL`);
        if (failedOutcomes[0].count > 0) {
            console.log(`  ❌ Failed outcomes: ${failedOutcomes[0].count}`);
        } else {
            console.log('  ✅ No failed outcomes');
        }

        // Stale active scenarios (no outcomes updated in 7 days)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const staleActive = await db.select({ count: sql`count(*)` }).from(marketScenarios)
            .where(and(
                eq(marketScenarios.isActive, true),
                lt(marketScenarios.updatedAt, sevenDaysAgo)
            ));
        if (staleActive[0].count > 0) {
            console.log(`  ⚠️  Stale active scenarios: ${staleActive[0].count}`);
        } else {
            console.log('  ✅ No stale active scenarios');
        }

        // Invalid confidence/price values in scenarios
        const invalidScenarioPrices = await db.select({ count: sql`count(*)` }).from(marketScenarios)
            .where(sql`${marketScenarios.referencePrice}::numeric <= 0`);
        if (invalidScenarioPrices[0].count > 0) {
            console.log(`  ❌ Invalid reference prices: ${invalidScenarioPrices[0].count}`);
        } else {
            console.log('  ✅ All reference prices are valid');
        }

        // Activation check
        const recentScenarios = await db.select({ count: sql`count(*)` }).from(marketScenarios)
            .where(sql`${marketScenarios.createdAt} > ${oneDayAgo}`);
        if (env.SCENARIO_TRACKER_ENABLED) {
            if (recentScenarios[0].count === 0) {
                console.log('  ⚠️  Scenario Tracker enabled but no new scenarios in 24h');
            } else {
                console.log('  ✅ Scenario Tracker appears active');
            }
        } else {
            console.log('  ⏸️  Scenario Tracker disabled');
        }
        console.log('');

        // === PHASE 4.5: ACTIVATION HEALTH ===
        console.log('🚀 Phase 4.5: Activation Health');
        console.log('  Intelligence systems status:');
        console.log(`    Level Intelligence: ${env.LEVEL_INTELLIGENCE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
        console.log(`    Scenario Tracker: ${env.SCENARIO_TRACKER_ENABLED ? 'ENABLED' : 'DISABLED'}`);

        if (env.LEVEL_INTELLIGENCE_ENABLED || env.SCENARIO_TRACKER_ENABLED) {
            console.log('  ✅ At least one intelligence system is enabled');
        } else {
            console.log('  ⏸️  All intelligence systems are disabled');
        }
        console.log('');

        // === OVERALL SUMMARY ===
        console.log('📋 Overall Summary:');
        console.log(`  Event Records: ${eventHistoryCount[0].count}`);
        console.log(`  Levels: ${levelsCount[0].count}`);
        console.log(`  Interactions: ${interactionsCount[0].count}`);
        console.log(`  Scenarios: ${scenariosCount[0].count}`);
        console.log(`  Horizon Outcomes: ${outcomesCount[0].count}`);
        console.log('');

        console.log('✅ Health Check Complete');

    } catch (error) {
        console.error('❌ Health Check Failed:', error);
        process.exit(1);
    } finally {
        await db.$client.end();
    }
}

if (require.main === module) {
    verifyIntelligenceHealth();
}

module.exports = { verifyIntelligenceHealth };