import { db } from '../src/config/db';
import { TRACKED_COINS } from '../src/config/coins';
import {
    coinNews, radarSignals, signalPerformance, marketInsights,
    coinNewsHistory, coinMemory, coinIntelligenceCache,
    coinMasterArticles, coinTimelineUpdates, coinStrategicOutlook,
    ohlcvCandles, ohlcvIndicators, priceSnapshots, levelIntelligence,
    marketScenarios, smartEventResponses, dailyAlphaFocus,
    shadowSignals, eventImpacts, scenarioHorizonOutcomes,
    scenarioStatusHistory, levelInteractions, eventImpactOutcomes,
} from '../src/models/market.model';
import { sql, inArray } from 'drizzle-orm';

const TRACKED = [...TRACKED_COINS];

interface TableOp {
    name: string;
    count: () => Promise<number>;
    deleteRows: () => Promise<number>;
}

function makeOps(
    label: string,
    countFn: () => Promise<number>,
    deleteFn: () => Promise<number>,
): TableOp {
    return { name: label, count: countFn, deleteRows: deleteFn };
}

const tables: TableOp[] = [
    makeOps('coin_news',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinNews).where(sql`${coinNews.coinSymbol} IS NOT NULL AND ${coinNews.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinNews).where(sql`${coinNews.coinSymbol} IS NOT NULL AND ${coinNews.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('radar_signals',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(radarSignals).where(sql`${radarSignals.coinSymbol} IS NOT NULL AND ${radarSignals.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(radarSignals).where(sql`${radarSignals.coinSymbol} IS NOT NULL AND ${radarSignals.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('signal_performance',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(signalPerformance).where(sql`${signalPerformance.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(signalPerformance).where(sql`${signalPerformance.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('market_insights',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(marketInsights).where(sql`${marketInsights.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(marketInsights).where(sql`${marketInsights.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_news_history',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinNewsHistory).where(sql`${coinNewsHistory.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinNewsHistory).where(sql`${coinNewsHistory.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_memory',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinMemory).where(sql`${coinMemory.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinMemory).where(sql`${coinMemory.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_intelligence_cache',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinIntelligenceCache).where(sql`${coinIntelligenceCache.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinIntelligenceCache).where(sql`${coinIntelligenceCache.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_master_articles',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinMasterArticles).where(sql`${coinMasterArticles.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinMasterArticles).where(sql`${coinMasterArticles.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_timeline_updates',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinTimelineUpdates).where(sql`${coinTimelineUpdates.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinTimelineUpdates).where(sql`${coinTimelineUpdates.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('coin_strategic_outlook',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(coinStrategicOutlook).where(sql`${coinStrategicOutlook.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(coinStrategicOutlook).where(sql`${coinStrategicOutlook.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('ohlcv_candles',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(ohlcvCandles).where(sql`${ohlcvCandles.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(ohlcvCandles).where(sql`${ohlcvCandles.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('ohlcv_indicators',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(ohlcvIndicators).where(sql`${ohlcvIndicators.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(ohlcvIndicators).where(sql`${ohlcvIndicators.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('price_snapshots',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(priceSnapshots).where(sql`${priceSnapshots.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(priceSnapshots).where(sql`${priceSnapshots.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('level_intelligence',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(levelIntelligence).where(sql`${levelIntelligence.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(levelIntelligence).where(sql`${levelIntelligence.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('market_scenarios',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(marketScenarios).where(sql`${marketScenarios.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(marketScenarios).where(sql`${marketScenarios.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('smart_event_responses',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(smartEventResponses).where(sql`${smartEventResponses.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(smartEventResponses).where(sql`${smartEventResponses.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('daily_alpha_focus',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(dailyAlphaFocus).where(sql`${dailyAlphaFocus.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(dailyAlphaFocus).where(sql`${dailyAlphaFocus.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('shadow_signals',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(shadowSignals).where(sql`${shadowSignals.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(shadowSignals).where(sql`${shadowSignals.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
    makeOps('event_impacts',
        async () => { const [r] = await db.select({ c: sql<number>`count(*)` }).from(eventImpacts).where(sql`${eventImpacts.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return Number(r.c); },
        async () => { const r = await db.delete(eventImpacts).where(sql`${eventImpacts.coinSymbol} NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`); return (r as unknown as { rowCount: number }).rowCount ?? 0; },
    ),
];

async function cleanCascades(): Promise<void> {
    const notInList = sql`NOT IN (${sql.join(TRACKED.map(t => sql`${t}`), sql`, `)})`;

    const nonTrackedScenarios = await db.select({ id: marketScenarios.scenarioId })
        .from(marketScenarios)
        .where(sql`${marketScenarios.coinSymbol} ${notInList}`);
    if (nonTrackedScenarios.length > 0) {
        const ids = nonTrackedScenarios.map(r => r.id);
        await db.delete(scenarioStatusHistory).where(inArray(scenarioStatusHistory.scenarioId, ids));
        await db.delete(scenarioHorizonOutcomes).where(inArray(scenarioHorizonOutcomes.scenarioId, ids));
        console.log(`✅ scenario cascades: cleaned ${ids.length} scenarios`);
    }

    const nonTrackedLevels = await db.select({ id: levelIntelligence.id })
        .from(levelIntelligence)
        .where(sql`${levelIntelligence.coinSymbol} ${notInList}`);
    if (nonTrackedLevels.length > 0) {
        const ids = nonTrackedLevels.map(r => r.id);
        await db.delete(levelInteractions).where(inArray(levelInteractions.levelId, ids));
        console.log(`✅ level_interactions: cleaned ${ids.length} levels`);
    }

    const nonTrackedImpacts = await db.select({ id: eventImpacts.id })
        .from(eventImpacts)
        .where(sql`${eventImpacts.coinSymbol} ${notInList}`);
    if (nonTrackedImpacts.length > 0) {
        const ids = nonTrackedImpacts.map(r => r.id);
        await db.delete(eventImpactOutcomes).where(inArray(eventImpactOutcomes.eventImpactId, ids));
        console.log(`✅ event_impact_outcomes: cleaned ${ids.length} impacts`);
    }

    const nonTrackedRadarIds = await db.select({ id: radarSignals.id })
        .from(radarSignals)
        .where(sql`${radarSignals.coinSymbol} IS NOT NULL AND ${radarSignals.coinSymbol} ${notInList}`);
    if (nonTrackedRadarIds.length > 0) {
        const ids = nonTrackedRadarIds.map(r => r.id);
        await db.delete(signalPerformance).where(inArray(signalPerformance.signalId, ids));
        console.log(`✅ signal_performance (FK to radar): cleaned ${ids.length} references`);
    }

    const nonTrackedMasterIds = await db.select({ id: coinMasterArticles.id })
        .from(coinMasterArticles)
        .where(sql`${coinMasterArticles.coinSymbol} ${notInList}`);
    if (nonTrackedMasterIds.length > 0) {
        const ids = nonTrackedMasterIds.map(r => r.id);
        await db.delete(coinTimelineUpdates).where(inArray(coinTimelineUpdates.masterArticleId, ids));
        await db.delete(dailyAlphaFocus).where(inArray(dailyAlphaFocus.masterArticleId, ids));
        console.log(`✅ timeline_updates + alpha_focus (FK to masters): cleaned ${ids.length} references`);
    }
}

async function main(): Promise<void> {
    const mode = process.argv[2];

    console.log('============================================');
    console.log('OnlyAlpha — Non-Tracked Coin Cleanup');
    console.log('============================================');
    console.log(`Tracked (${TRACKED.length}): ${TRACKED.join(', ')}`);
    console.log(`Mode: ${mode || 'preview'}`);
    console.log('');

    if (mode === 'delete') {
        console.log('🗑️  DELETE MODE — removing non-tracked data...\n');

        await cleanCascades();

        for (const t of tables) {
            try {
                const n = await t.deleteRows();
                console.log(n > 0 ? `✅ ${t.name}: deleted ${n} rows` : `   ${t.name}: 0 (clean)`);
            } catch (err) {
                console.error(`❌ ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    } else {
        console.log('📋 PREVIEW — counts only (run with "delete" to remove)\n');
        let total = 0;
        for (const t of tables) {
            try {
                const n = await t.count();
                total += n;
                console.log(n > 0 ? `   ${t.name}: ${n} rows` : `   ${t.name}: 0 (clean)`);
            } catch (err) {
                console.error(`❌ ${t.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        console.log(`\nTotal: ${total} rows`);
        if (total > 0) console.log('\nRun: npx tsx scripts/cleanup-non-tracked-coins.ts delete');
    }

    console.log('\nDone.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
