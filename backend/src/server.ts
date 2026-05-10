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
import { startShadowChecker } from './crons/shadowChecker.cron';
import { runRadarCleanup } from './scripts/clean-duplicate-radars';
import { runArticleRepair } from './scripts/repair-incomplete-articles';
import { runMetaTagRepair } from './scripts/repair-meta-tags';
import { logger } from './utils/logger';

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

        // Auto-repair poor/missing meta tags on boot (only runs once via DB flag v3)
        runMetaTagRepair().catch(err =>
            logger.error('[Server] runMetaTagRepair failed (non-blocking): %s', err instanceof Error ? err.message : String(err))
        );

        const PORT = parseInt(env.PORT, 10);
        app.listen(PORT, () => {
            logger.info('OnlyAlpha Backend running at http://localhost:%d', PORT);
            logger.info('Environment: %s', env.NODE_ENV);
            logger.info('Database: Connected');
            logger.info('AI Engines: Starting...');
        });

        const cronStartDelay = 5000;
        const crons = [
            { name: 'AiWorkflow', fn: startAiWorkflowCron },
            { name: 'AirdropHunter', fn: startAirdropHunterCron },
            { name: 'AirdropRSSHunter', fn: startAirdropRSSCron },
            { name: 'AirdropDiscovery', fn: startAirdropDiscoveryCron },
            { name: 'DailyAlpha', fn: startDailyAlphaCron },
            { name: 'HistoricalNews', fn: startHistoricalNewsCron },
            { name: 'MarketMood', fn: startMarketMoodCron },
            { name: 'TerminalEngine', fn: startTerminalEngineCron },
            { name: 'TriageEngine', fn: startTriageEngineCron },
            { name: 'BufferCleanup', fn: startBufferCleanupCron },
            { name: 'ConvictionUpdate', fn: startConvictionUpdateCron },
            { name: 'TelegramMonitor', fn: startTelegramMonitorCron },
            { name: 'SignalPerformance', fn: startSignalPerformanceCron },
            { name: 'TpslMonitor', fn: startTpslMonitorCron },
            { name: 'EventOutcomeChecker', fn: startEventOutcomeCheckerCron },
            { name: 'LevelIntelligence', fn: startLevelIntelligenceCron },
            { name: 'ScenarioOutcomeChecker', fn: startScenarioOutcomeCheckerCron },
        ];

        crons.forEach((cron, index) => {
            setTimeout(() => {
                try {
                    cron.fn();
                    logger.info('[Server] Cron started: %s', cron.name);
                } catch (error) {
                    logger.error('[Server] Failed to start cron %s: %s', cron.name, error instanceof Error ? error.message : String(error));
                }
            }, index * cronStartDelay);
        });

        // Optional monitoring cron
        if (env.MONITORING_CRON_ENABLED) {
            setTimeout(() => {
                try {
                    startMonitoringCron();
                    logger.info('[Server] Optional cron started: MonitoringCron');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron MonitoringCron: %s', error instanceof Error ? error.message : String(error));
                }
            }, crons.length * cronStartDelay);
        }

        // Optional Event Impact Sync cron
        if (env.EVENT_IMPACT_SYNC_ENABLED) {
            setTimeout(() => {
                try {
                    startEventImpactSyncCron();
                    logger.info('[Server] Optional cron started: EventImpactSync');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron EventImpactSync: %s', error instanceof Error ? error.message : String(error));
                }
            }, (crons.length + 1) * cronStartDelay);
        }

        // Optional Event Impact Outcome Checker cron
        if (env.EVENT_IMPACT_OUTCOME_CHECKER_ENABLED) {
            setTimeout(() => {
                try {
                    startEventImpactOutcomeCheckerCron();
                    logger.info('[Server] Optional cron started: EventImpactOutcomeChecker');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron EventImpactOutcomeChecker: %s', error instanceof Error ? error.message : String(error));
                }
            }, (crons.length + 2) * cronStartDelay);
        }

        // Optional Market Filter cron
        if (env.MARKET_FILTER_ENABLED) {
            setTimeout(() => {
                try {
                    startMarketFilterCron();
                    logger.info('[Server] Optional cron started: MarketFilter');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron MarketFilter: %s', error instanceof Error ? error.message : String(error));
                }
            }, (crons.length + 3) * cronStartDelay);
        }

        // Optional OHLCV Snapshot cron
        if (env.OHLCV_SNAPSHOT_ENABLED) {
            setTimeout(() => {
                try {
                    startOhlcvSnapshotCron();
                    logger.info('[Server] Optional cron started: OhlcvSnapshot');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron OhlcvSnapshot: %s', error instanceof Error ? error.message : String(error));
                }
            }, (crons.length + 4) * cronStartDelay);
        }

        // Optional Shadow Checker cron
        if (env.SHADOW_MODE_ENABLED) {
            setTimeout(() => {
                try {
                    startShadowChecker();
                    logger.info('[Server] Optional cron started: ShadowChecker');
                } catch (error) {
                    logger.error('[Server] Failed to start optional cron ShadowChecker: %s', error instanceof Error ? error.message : String(error));
                }
            }, (crons.length + 5) * cronStartDelay);
        }
    } catch (error) {
        logger.error('[Server] Failed to start: %s', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

bootstrap();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
