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