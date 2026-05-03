#!/usr/bin/env node

/**
 * Phase 4 Scenario Tracker Verification Script
 * Read-only verification of scenario and outcome data
 */

const { db } = require('../config/db');
const { marketScenarios, scenarioHorizonOutcomes } = require('../models/market.model');
const { eq, sql, count, lte, and } = require('drizzle-orm');

async function verifyScenarios() {
    console.log('🔍 Phase 4 Scenario Tracker Verification\n');

    try {
        // 1. Count total scenarios
        const totalScenarios = await db.select({ count: sql`count(*)` }).from(marketScenarios);
        console.log(`📊 Total Scenarios: ${totalScenarios[0].count}`);

        // 2. Scenarios by status
        const scenariosByStatus = await db.select({
            status: marketScenarios.status,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.status);

        console.log('📈 Scenarios by Status:');
        scenariosByStatus.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
        });

        // 3. Scenarios by type
        const scenariosByType = await db.select({
            scenarioType: marketScenarios.scenarioType,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.scenarioType);

        console.log('\n🎯 Scenarios by Type:');
        scenariosByType.forEach(row => {
            console.log(`  ${row.scenarioType}: ${row.count}`);
        });

        // 4. Scenarios by bias
        const scenariosByBias = await db.select({
            bias: marketScenarios.bias,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.bias);

        console.log('\n⚖️ Scenarios by Bias:');
        scenariosByBias.forEach(row => {
            console.log(`  ${row.bias}: ${row.count}`);
        });

        // 5. Top coins by scenario count
        const topCoins = await db.select({
            coinSymbol: marketScenarios.coinSymbol,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.coinSymbol).orderBy(sql`count(*) desc`).limit(10);

        console.log('\n🏆 Top Coins by Scenario Count:');
        topCoins.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.coinSymbol}: ${row.count}`);
        });

        // 6. Outcomes stats
        const totalOutcomes = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes);
        console.log(`\n📈 Total Outcomes: ${totalOutcomes[0].count}`);

        // Outcomes by status
        const outcomesByStatus = await db.select({
            status: scenarioHorizonOutcomes.status,
            count: sql`count(*)`
        }).from(scenarioHorizonOutcomes).groupBy(scenarioHorizonOutcomes.status);

        console.log('📊 Outcomes by Status:');
        outcomesByStatus.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
        });

        // Outcomes by classification
        const outcomesByClassification = await db.select({
            outcomeClassification: scenarioHorizonOutcomes.outcomeClassification,
            count: sql`count(*)`
        }).from(scenarioHorizonOutcomes).groupBy(scenarioHorizonOutcomes.outcomeClassification);

        console.log('\n🎯 Outcomes by Classification:');
        outcomesByClassification.forEach(row => {
            console.log(`  ${row.outcomeClassification || 'null'}: ${row.count}`);
        });

        // 7. Duplicate check
        const duplicates = await db.select({
            sourceId: marketScenarios.sourceId,
            coinSymbol: marketScenarios.coinSymbol,
            scenarioType: marketScenarios.scenarioType,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.sourceId, marketScenarios.coinSymbol, marketScenarios.scenarioType).having(sql`count(*) > 1`);

        if (duplicates.length > 0) {
            console.log('\n❌ Duplicates Found:');
            duplicates.forEach(row => {
                console.log(`  sourceId: ${row.sourceId}, coin: ${row.coinSymbol}, type: ${row.scenarioType}, count: ${row.count}`);
            });
        } else {
            console.log('\n✅ No duplicates found');
        }

        // 8. Schema validation (basic)
        const invalidPrices = await db.select({ count: sql`count(*)` }).from(marketScenarios).where(sql`referenceprice !~ '^[0-9]+(\.[0-9]+)?$'`);
        if (invalidPrices[0].count > 0) {
            console.log(`\n❌ Invalid reference prices: ${invalidPrices[0].count}`);
        } else {
            console.log('\n✅ All reference prices are valid numerics');
        }

        // 7. Duplicate dedupeKeys
        const duplicateDedupes = await db.select({
            dedupeKey: marketScenarios.dedupeKey,
            count: sql`count(*)`
        }).from(marketScenarios).groupBy(marketScenarios.dedupeKey).having(sql`count(*) > 1`);

        if (duplicateDedupes.length > 0) {
            console.log('\n❌ Duplicate dedupeKeys Found:');
            duplicateDedupes.forEach(row => {
                console.log(`  ${row.dedupeKey}: ${row.count} scenarios`);
            });
        } else {
            console.log('\n✅ No duplicate dedupeKeys');
        }

        // 8. Overdue pending outcomes
        const now = new Date();
        const overdueOutcomes = await db.select({ count: sql`count(*)` }).from(scenarioHorizonOutcomes).where(and(
            eq(scenarioHorizonOutcomes.status, 'pending'),
            lte(scenarioHorizonOutcomes.dueAt, now)
        ));

        console.log(`\n📊 Overdue Pending Outcomes: ${overdueOutcomes[0].count}`);

        // 9. Stale active scenarios (older than 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const staleScenarios = await db.select({ count: sql`count(*)` }).from(marketScenarios).where(and(
            eq(marketScenarios.status, 'active'),
            lte(marketScenarios.updatedAt, thirtyDaysAgo)
        ));

        console.log(`📊 Stale Active Scenarios (>30 days): ${staleScenarios[0].count}`);

        console.log('\n✨ Verification complete');
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    } finally {
        await db.$client.end();
    }
}

if (require.main === module) {
    verifyScenarios();
}

module.exports = { verifyScenarios };