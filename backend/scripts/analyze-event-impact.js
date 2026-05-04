#!/usr/bin/env node

/**
 * Event Impact Analysis Manual Script
 *
 * This script performs read-only event impact analysis using historical coin_news_history data.
 * It checks EVENT_IMPACT_ENGINE_ENABLED flag and exits safely if disabled.
 *
 * Run with: node scripts/analyze-event-impact.js
 *
 * WARNINGS:
 * - Do not run against production without read-only credentials.
 * - Script performs NO database writes.
 * - Script is for analysis only.
 */

const { getEventImpactAnalysis } = require('../src/services/eventImpactAnalysis.service');
const { env } = require('../src/config/env');

async function main() {
    console.log('=== EVENT IMPACT ANALYSIS ===');
    console.log(`EVENT_IMPACT_ENGINE_ENABLED: ${env.EVENT_IMPACT_ENGINE_ENABLED}`);

    if (!env.EVENT_IMPACT_ENGINE_ENABLED) {
        console.log('❌ EVENT_IMPACT_ENGINE_ENABLED is false or missing.');
        console.log('Analysis disabled. Set EVENT_IMPACT_ENGINE_ENABLED=true to enable.');
        process.exit(0);
    }

    console.log('✅ Analysis enabled. Running impact analysis...');

    try {
        // Run analysis with no filters (all events)
        const analysis = await getEventImpactAnalysis();

        console.log('\n--- ANALYSIS RESULTS ---');
        console.log(`Total Events Analyzed: ${analysis.totalEvents}`);
        console.log(`Horizons Available: ${analysis.horizonsAvailable.join(', ') || 'None'}`);

        console.log('\n--- HORIZON-BY-HORIZON STATS ---');
        const horizons = ['1h', '4h', '24h', '3d', '7d'];
        horizons.forEach(horizon => {
            const stats = analysis.horizonStats[horizon];
            console.log(`\n${horizon.toUpperCase()} Horizon:`);
            console.log(`  Sample Size: ${stats.sampleSize}`);
            console.log(`  Average Change: ${stats.averageChange !== null ? stats.averageChange.toFixed(2) + '%' : 'N/A'}`);
            console.log(`  Median Change: ${stats.medianChange !== null ? stats.medianChange.toFixed(2) + '%' : 'N/A'}`);
            console.log(`  Positive Rate: ${stats.positiveRate !== null ? stats.positiveRate.toFixed(1) + '%' : 'N/A'}`);
            console.log(`  Negative Rate: ${stats.negativeRate !== null ? stats.negativeRate.toFixed(1) + '%' : 'N/A'}`);
            console.log(`  Neutral Rate: ${stats.neutralRate !== null ? stats.neutralRate.toFixed(1) + '%' : 'N/A'}`);
        });

        console.log('\n--- AGGREGATE STATS ---');
        console.log(`Average Max Upside: ${analysis.averageMaxUpside !== null ? analysis.averageMaxUpside.toFixed(2) + '%' : 'N/A'}`);
        console.log(`Average Max Drawdown: ${analysis.averageMaxDrawdown !== null ? analysis.averageMaxDrawdown.toFixed(2) + '%' : 'N/A'}`);
        console.log(`Average Time to Peak: ${analysis.averageTimeToPeak !== null ? analysis.averageTimeToPeak.toFixed(1) + ' hours' : 'N/A'}`);
        console.log(`Average Time to Bottom: ${analysis.averageTimeToBottom !== null ? analysis.averageTimeToBottom.toFixed(1) + ' hours' : 'N/A'}`);

        console.log('\n--- OUTCOME CLASSIFICATION RATES ---');
        console.log(`Positive Outcomes: ${analysis.outcomeRates.positive !== null ? analysis.outcomeRates.positive.toFixed(1) + '%' : 'N/A'}`);
        console.log(`Negative Outcomes: ${analysis.outcomeRates.negative !== null ? analysis.outcomeRates.negative.toFixed(1) + '%' : 'N/A'}`);
        console.log(`Neutral Outcomes: ${analysis.outcomeRates.neutral !== null ? analysis.outcomeRates.neutral.toFixed(1) + '%' : 'N/A'}`);

        console.log('\n✅ Analysis completed successfully.');
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});