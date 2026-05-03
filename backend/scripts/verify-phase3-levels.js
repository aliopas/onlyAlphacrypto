#!/usr/bin/env node

/**
 * Phase 3 Level Intelligence Verification Script
 * Read-only verification of level data and calculations
 */

const { db } = require('../config/db');
const { levelIntelligence, levelInteractions } = require('../models/market.model');
const { desc, eq, sql } = require('drizzle-orm');

async function verifyLevels() {
    console.log('🔍 Phase 3 Level Intelligence Verification\n');

    try {
        // 1. Count total levels
        const totalLevels = await db.select({ count: sql`count(*)` }).from(levelIntelligence);
        console.log(`📊 Total Levels: ${totalLevels[0].count}`);

        // 2. Count by timeframe
        const levelsByTimeframe = await db.select({
            timeframe: levelIntelligence.timeframe,
            count: sql`count(*)`
        }).from(levelIntelligence).groupBy(levelIntelligence.timeframe);

        console.log('⏰ Levels by Timeframe:');
        levelsByTimeframe.forEach(row => {
            console.log(`  ${row.timeframe}: ${row.count}`);
        });

        // 3. Top coins by level count
        const topCoins = await db.select({
            coinSymbol: levelIntelligence.coinSymbol,
            count: sql`count(*)`
        }).from(levelIntelligence).groupBy(levelIntelligence.coinSymbol).orderBy(desc(sql`count(*)`)).limit(10);

        console.log('\n🏆 Top Coins by Level Count:');
        topCoins.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.coinSymbol}: ${row.count}`);
        });

        // 4. Highest confidence levels
        const highConfidence = await db.select({
            coinSymbol: levelIntelligence.coinSymbol,
            levelPrice: levelIntelligence.levelPrice,
            levelType: levelIntelligence.levelType,
            timeframe: levelIntelligence.timeframe,
            confidenceScore: levelIntelligence.confidenceScore,
            touchCount: levelIntelligence.touchCount,
            bounceCount: levelIntelligence.bounceCount
        }).from(levelIntelligence)
        .where(sql`${levelIntelligence.confidenceScore} > 80`)
        .orderBy(desc(levelIntelligence.confidenceScore))
        .limit(5);

        console.log('\n🎯 High Confidence Levels (>80%):');
        highConfidence.forEach(level => {
            console.log(`  ${level.coinSymbol} ${level.levelType} @ $${parseFloat(level.levelPrice).toFixed(4)} (${level.timeframe}) - ${level.confidenceScore}% confidence, ${level.touchCount} touches, ${level.bounceCount} bounces`);
        });

        // 5. Recent interactions
        const recentInteractions = await db.select({
            levelId: levelInteractions.levelId,
            coinSymbol: levelIntelligence.coinSymbol,
            interactionType: levelInteractions.interactionType,
            priceAtTouch: levelInteractions.priceAtTouch,
            createdAt: levelInteractions.createdAt
        }).from(levelInteractions)
        .innerJoin(levelIntelligence, eq(levelInteractions.levelId, levelIntelligence.id))
        .orderBy(desc(levelInteractions.createdAt))
        .limit(10);

        console.log('\n📅 Recent Level Interactions:');
        recentInteractions.forEach(interaction => {
            console.log(`  ${interaction.coinSymbol}: ${interaction.interactionType} @ $${parseFloat(interaction.priceAtTouch).toFixed(4)} - ${interaction.createdAt.toISOString()}`);
        });

        // 6. Level distribution stats
        const stats = await db.select({
            avgConfidence: sql`avg(${levelIntelligence.confidenceScore})`,
            avgTouchCount: sql`avg(${levelIntelligence.touchCount})`,
            totalTouches: sql`sum(${levelIntelligence.touchCount})`,
            totalBounces: sql`sum(${levelIntelligence.bounceCount})`,
            totalBreaks: sql`sum(${levelIntelligence.breakCount})`,
            totalFakeouts: sql`sum(${levelIntelligence.fakeoutCount})`
        }).from(levelIntelligence);

        console.log('\n📈 Overall Statistics:');
        console.log(`  Average Confidence: ${stats[0].avgConfidence ? parseFloat(stats[0].avgConfidence).toFixed(1) : 0}%`);
        console.log(`  Average Touch Count: ${stats[0].avgTouchCount ? parseFloat(stats[0].avgTouchCount).toFixed(1) : 0}`);
        console.log(`  Total Touches: ${stats[0].totalTouches || 0}`);
        console.log(`  Total Bounces: ${stats[0].totalBounces || 0}`);
        console.log(`  Total Breaks: ${stats[0].totalBreaks || 0}`);
        console.log(`  Total Fakeouts: ${stats[0].totalFakeouts || 0}`);

        // Phase 4.5: Activation checks
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Levels updated in last 24h
        const recentLevels = await db.select({ count: sql`count(*)` }).from(levelIntelligence).where(sql`${levelIntelligence.updatedAt} > ${oneDayAgo}`);
        console.log(`\n🔄 Levels updated in last 24h: ${recentLevels[0].count}`);

        // Interactions in last 24h
        const recentInteractions = await db.select({ count: sql`count(*)` }).from(levelInteractions).where(sql`${levelInteractions.createdAt} > ${oneDayAgo}`);
        console.log(`🔄 Interactions created in last 24h: ${recentInteractions[0].count}`);

        // Activation status
        if (recentLevels[0].count === 0 && recentInteractions[0].count === 0) {
            console.log('\n⚠️  WARNING: Level Intelligence appears INACTIVE (no updates in 24h)');
            console.log('   Check LEVEL_INTELLIGENCE_ENABLED and cron execution');
        } else {
            console.log('\n✅ Level Intelligence appears ACTIVE');
        }

        // Invalid confidence scores
        const invalidConfidences = await db.select({ count: sql`count(*)` }).from(levelIntelligence).where(sql`${levelIntelligence.confidenceScore} < 0 OR ${levelIntelligence.confidenceScore} > 100`);
        if (invalidConfidences[0].count > 0) {
            console.log(`❌ Invalid confidence scores: ${invalidConfidences[0].count}`);
        } else {
            console.log('✅ All confidence scores are valid (0-100)');
        }

        // Null/invalid level prices
        const invalidPrices = await db.select({ count: sql`count(*)` }).from(levelIntelligence).where(sql`${levelIntelligence.levelPrice} !~ '^[0-9]+(\.[0-9]+)?$' OR ${levelIntelligence.levelPrice}::numeric <= 0`);
        if (invalidPrices[0].count > 0) {
            console.log(`❌ Invalid level prices: ${invalidPrices[0].count}`);
        } else {
            console.log('✅ All level prices are valid positive numerics');
        }

        console.log('\n✅ Verification Complete');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    } finally {
        await db.$client.end();
    }
}

if (require.main === module) {
    verifyLevels();
}

module.exports = { verifyLevels };