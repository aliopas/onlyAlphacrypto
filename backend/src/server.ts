import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { testConnection, pool, initDb } from './config/db';
import { redis } from './config/redis';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { timeMiddleware } from './middleware/time.middleware';
import { startAiWorkflowCron } from './crons/aiWorkflow.cron';
import { startAirdropHunterCron } from './crons/airdropHunter.cron';
import { startAirdropRSSCron } from './crons/airdropRssHunter.cron';
import { startDailyAlphaCron } from './crons/dailyAlpha.cron';
import { startHistoricalNewsCron } from './crons/historicalNews.cron';
import { startMarketMoodCron } from './crons/marketMood.cron';
import { startTerminalEngineCron } from './crons/terminalEngine.cron';
import { startTriageEngineCron } from './crons/triageEngine.cron';
import { startBufferCleanupCron } from './crons/bufferCleanup.cron';
import { startConvictionUpdateCron } from './crons/convictionUpdate.cron';
import { startTelegramMonitorCron } from './crons/telegramMonitor.cron';
import { startAirdropDiscoveryCron } from './crons/airdropDiscovery.cron';
import { startSignalPerformanceCron } from './crons/signalPerformance.cron';
import { startTpslMonitorCron } from './crons/tpslMonitor.cron';
import { startEventOutcomeCheckerCron } from './crons/eventOutcomeChecker.cron';
import { startLevelIntelligenceCron } from './crons/levelIntelligenceCron';
import { startScenarioOutcomeCheckerCron } from './crons/scenarioOutcomeChecker.cron';
import { startMonitoringCron } from './crons/monitoringCron';
import { startEventImpactSyncCron } from './crons/eventImpactSync.cron';
import { startEventImpactOutcomeCheckerCron } from './crons/eventImpactOutcomeChecker.cron';
import { startMarketFilterCron } from './crons/marketFilter.cron';
import { startOhlcvSnapshotCron } from './crons/ohlcvSnapshot.cron';
import { startRegimeUpdateCron } from './crons/regimeUpdate.cron';
import { startShadowChecker } from './crons/shadowChecker.cron';
import { startSignalLifecycleCron } from './crons/signalLifecycle.cron';
import { startDailyTrendCron } from './crons/dailyTrend.cron';
import { startTelegramPortfolioScraperCron } from './crons/telegramPortfolioScraper.cron';
import { startPortfolioSnapshotCron } from './crons/portfolioSnapshot.cron';
import { startPortfolioMonitorCron } from './crons/portfolioMonitor.cron';
import { runRadarCleanup } from './scripts/clean-duplicate-radars';
import { runArticleRepair } from './scripts/repair-incomplete-articles';
import { runMetaTagRepair } from './scripts/repair-meta-tags';
import { runScorecardInvestmentModeRepair } from './scripts/repair-scorecard-investment-mode';
import { logger } from './utils/logger';
import { startCrons } from './crons/registry';
import { logFlowStatus } from './config/flows';

const app = express();

const allowedOrigins = env.NODE_ENV === 'production'
    ? ['https://onlyalphacrypto.com', 'https://www.onlyalphacrypto.com']
    : ['http://localhost:3000'];

app.set('trust proxy', true);
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
}));
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(timeMiddleware);

app.use('/api', routes);

app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

async function gracefulShutdown(signal: string): Promise<void> {
    logger.info('[Server] %s received — shutting down gracefully', signal);
    try { pool.end(); } catch {}
    try { redis?.disconnect(); } catch {}
    process.exit(0);
}

async function bootstrap(): Promise<void> {
    try {
        await initDb();
        await testConnection();

        await runRadarCleanup();
        
        // Auto-repair any incomplete master articles on boot (only runs once via DB flag)
        await runArticleRepair();

        // Model Portfolio investment mode data repair (once via migration_flags)
        await runScorecardInvestmentModeRepair();

        // Auto-repair poor/missing meta tags on boot (only runs once via DB flag v3)
        runMetaTagRepair().catch(err =>
            logger.error('[Server] runMetaTagRepair failed (non-blocking): %s', err instanceof Error ? err.message : String(err))
        );

        const PORT = parseInt(env.PORT, 10);

        logger.info('┌─────────────────────────────────────────────┐');
        logger.info('│           [BOOT CONFIG] OnlyAlpha           │');
        logger.info('├─────────────────────────────────────────────┤');
        logger.info('│ SHADOW_MODE_ENABLED         : %s', String(env.SHADOW_MODE_ENABLED));
        logger.info('│ SIGNAL_CLASSIFICATION_ENABLED: %s', String(env.SIGNAL_CLASSIFICATION_ENABLED));
        logger.info('│ TPSL_V2_ENABLED              : %s', String(env.TPSL_V2_ENABLED));
        logger.info('│ SIGNAL_LIFECYCLE_ENABLED     : %s', String(env.SIGNAL_LIFECYCLE_ENABLED));
        logger.info('│ DAILY_TREND_ENABLED          : %s', String(env.DAILY_TREND_ENABLED));
        logger.info('│ MTF_CONTEXT_ENABLED          : %s', String(env.MTF_CONTEXT_ENABLED));
        logger.info('│ LIFECYCLE_V2_ENABLED         : %s', String(env.LIFECYCLE_V2_ENABLED));
        logger.info('│ SCORECARD_SCRAPER_ENABLED    : %s', String(env.SCORECARD_SCRAPER_ENABLED));
        logger.info('│ SCORECARD_SNAPSHOT_ENABLED    : %s', String(env.SCORECARD_SNAPSHOT_ENABLED));
        logger.info('│ SCORECARD_MONITOR_ENABLED    : %s', String(env.SCORECARD_MONITOR_ENABLED));
        logger.info('│ MARKET_REGIME_ENABLED        : %s', String(env.MARKET_REGIME_ENABLED));
        logger.info('│ LEVEL_INTELLIGENCE_ENABLED   : %s', String(env.LEVEL_INTELLIGENCE_ENABLED));
        logger.info('│ SCENARIO_TRACKER_ENABLED     : %s', String(env.SCENARIO_TRACKER_ENABLED));
        logger.info('│ OHLCV_SNAPSHOT_ENABLED       : %s', String(env.OHLCV_SNAPSHOT_ENABLED));
        logger.info('│ MARKET_FILTER_ENABLED        : %s', String(env.MARKET_FILTER_ENABLED));
        logger.info('└─────────────────────────────────────────────┘');

        app.listen(PORT, () => {
            logger.info('OnlyAlpha Backend running at http://localhost:%d', PORT);
            logger.info('Environment: %s', env.NODE_ENV);
            logger.info('Database: Connected');
            logger.info('AI Engines: Starting...');
        });

        // ─── Flow-based Cron Registration ─────────────────────────────────────
        // All crons are declared here grouped by their owning flow. The registry consults
        // FLOWS[flow].enabled (master switch) AND any sub-flag to decide whether to start
        // each cron. This is the single source of truth — to disable an entire flow, set
        // FLOW_<NAME>_ENABLED=false; to toggle a sub-feature, use its specific flag.
        const cronStartDelay = 5000;
        logFlowStatus();

        startCrons([
            // ── NEWS flow ──────────────────────────────────────────────────────
            { name: 'TerminalEngine',      start: startTerminalEngineCron,      flow: 'news' },
            { name: 'TelegramMonitor',     start: startTelegramMonitorCron,     flow: 'news' },
            { name: 'TriageEngine',        start: startTriageEngineCron,        flow: 'news' },
            { name: 'AiWorkflow',          start: startAiWorkflowCron,          flow: 'news', alsoRequiresFlow: 'signals' },
            { name: 'HistoricalNews',      start: startHistoricalNewsCron,      flow: 'news' },
            { name: 'BufferCleanup',       start: startBufferCleanupCron,       flow: 'news' },
            { name: 'ConvictionUpdate',    start: startConvictionUpdateCron,    flow: 'news' },

            // ── SIGNALS flow ───────────────────────────────────────────────────
            { name: 'SignalPerformance',     start: startSignalPerformanceCron,        flow: 'signals' },
            { name: 'TpslMonitor',           start: startTpslMonitorCron,              flow: 'signals' },
            { name: 'SignalLifecycle',       start: startSignalLifecycleCron,          flow: 'signals', subFlag: env.SIGNAL_LIFECYCLE_ENABLED, subFlagName: 'SIGNAL_LIFECYCLE_ENABLED' },
            { name: 'ShadowChecker',         start: startShadowChecker,                flow: 'signals', subFlag: env.SHADOW_MODE_ENABLED, subFlagName: 'SHADOW_MODE_ENABLED' },
            { name: 'ScenarioOutcomeChecker', start: startScenarioOutcomeCheckerCron,  flow: 'signals', subFlag: env.SCENARIO_TRACKER_ENABLED, subFlagName: 'SCENARIO_TRACKER_ENABLED' },
            { name: 'EventOutcomeChecker',   start: startEventOutcomeCheckerCron,      flow: 'signals' },
            { name: 'EventImpactSync',       start: startEventImpactSyncCron,          flow: 'signals', subFlag: env.EVENT_IMPACT_SYNC_ENABLED, subFlagName: 'EVENT_IMPACT_SYNC_ENABLED' },
            { name: 'EventImpactOutcomeChecker', start: startEventImpactOutcomeCheckerCron, flow: 'signals', subFlag: env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED, subFlagName: 'EVENT_IMPACT_OUTCOME_CHECKER_ENABLED' },
            { name: 'LevelIntelligence',     start: startLevelIntelligenceCron,        flow: 'signals', subFlag: env.LEVEL_INTELLIGENCE_ENABLED, subFlagName: 'LEVEL_INTELLIGENCE_ENABLED' },

            // ── MARKET flow ────────────────────────────────────────────────────
            { name: 'DailyAlpha',          start: startDailyAlphaCron,          flow: 'market' },
            { name: 'MarketMood',          start: startMarketMoodCron,          flow: 'market' },
            { name: 'MarketFilter',        start: startMarketFilterCron,        flow: 'market', subFlag: env.MARKET_FILTER_ENABLED, subFlagName: 'MARKET_FILTER_ENABLED' },
            { name: 'RegimeUpdate',        start: startRegimeUpdateCron,        flow: 'market', subFlag: env.MARKET_REGIME_ENABLED, subFlagName: 'MARKET_REGIME_ENABLED' },
            { name: 'DailyTrend',          start: startDailyTrendCron,          flow: 'market', subFlag: env.DAILY_TREND_ENABLED, subFlagName: 'DAILY_TREND_ENABLED' },
            { name: 'OhlcvSnapshot',       start: startOhlcvSnapshotCron,       flow: 'market', subFlag: env.OHLCV_SNAPSHOT_ENABLED, subFlagName: 'OHLCV_SNAPSHOT_ENABLED' },
            { name: 'Monitoring',          start: startMonitoringCron,          flow: 'market', subFlag: env.MONITORING_CRON_ENABLED, subFlagName: 'MONITORING_CRON_ENABLED' },

            // ── PORTFOLIO flow ─────────────────────────────────────────────────
            { name: 'TelegramPortfolioScraper', start: startTelegramPortfolioScraperCron, flow: 'portfolio', subFlag: env.SCORECARD_SCRAPER_ENABLED, subFlagName: 'SCORECARD_SCRAPER_ENABLED' },
            { name: 'PortfolioSnapshot',       start: startPortfolioSnapshotCron,         flow: 'portfolio', subFlag: env.SCORECARD_SNAPSHOT_ENABLED, subFlagName: 'SCORECARD_SNAPSHOT_ENABLED' },
            { name: 'PortfolioMonitor',        start: startPortfolioMonitorCron,          flow: 'portfolio', subFlag: env.SCORECARD_MONITOR_ENABLED, subFlagName: 'SCORECARD_MONITOR_ENABLED' },

            // ── AIRDROP flow ───────────────────────────────────────────────────
            { name: 'AirdropHunter',      start: startAirdropHunterCron,      flow: 'airdrop' },
            { name: 'AirdropRSSHunter',   start: startAirdropRSSCron,         flow: 'airdrop' },
            { name: 'AirdropDiscovery',   start: startAirdropDiscoveryCron,   flow: 'airdrop' },
        ], cronStartDelay);

    } catch (error) {
        logger.error('[Server] Failed to start: %s', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

bootstrap();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

function isGramJsTimeout(args: unknown[]): boolean {
    if (args.length === 0) return false;
    const first = args[0];
    if (first instanceof Error && first.message === 'TIMEOUT') {
        const stack = first.stack ?? '';
        if (stack.includes('telegram/client/updates.js')) return true;
    }
    if (typeof first === 'string' && first.includes('TIMEOUT') && first.includes('telegram/client/updates.js')) {
        return true;
    }
    for (const a of args) {
        if (a instanceof Error) {
            const stack = a.stack ?? '';
            if (a.message === 'TIMEOUT' && stack.includes('telegram/client/updates.js')) return true;
            if (stack.includes('telegram/client/updates.js') && stack.includes('_updateLoop')) return true;
        }
    }
    return false;
}

console.error = (...args: unknown[]) => {
    if (isGramJsTimeout(args)) return;
    originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
    if (isGramJsTimeout(args)) return;
    originalConsoleWarn(...args);
};

process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    if (message === 'TIMEOUT' && stack?.includes('telegram/client/updates.js')) {
        return;
    }
    const cause = reason instanceof Error && (reason as unknown as { cause?: Error }).cause instanceof Error ? ` | cause: ${(reason as unknown as { cause?: Error }).cause!.message}` : '';
    originalConsoleError('[Server] Unhandled Rejection:', reason, cause);
});

process.on('uncaughtException', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    if (message === 'TIMEOUT' && stack?.includes('telegram/client/updates.js')) {
        return;
    }
    const cause = (err as unknown as { cause?: Error }).cause instanceof Error ? ` | cause: ${(err as unknown as { cause?: Error }).cause!.message}` : '';
    originalConsoleError('[Server] Uncaught Exception:', err, cause);
});

export default app;
