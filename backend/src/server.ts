import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { testConnection, pool } from './config/db';
import { redis } from './config/redis';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { timeMiddleware } from './middleware/time.middleware';
import { startAiWorkflowCron } from './crons/aiWorkflow.cron';
import { startAirdropHunterCron } from './crons/airdropHunter.cron';
import { startDailyAlphaCron } from './crons/dailyAlpha.cron';
import { startMarketMoodCron } from './crons/marketMood.cron';
import { startTerminalEngineCron } from './crons/terminalEngine.cron';
import { startTriageEngineCron } from './crons/triageEngine.cron';
import { startBufferCleanupCron } from './crons/bufferCleanup.cron';
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

app.get('/api/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

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
        await testConnection();

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
            { name: 'DailyAlpha', fn: startDailyAlphaCron },
            { name: 'MarketMood', fn: startMarketMoodCron },
            { name: 'TerminalEngine', fn: startTerminalEngineCron },
            { name: 'TriageEngine', fn: startTriageEngineCron },
            { name: 'BufferCleanup', fn: startBufferCleanupCron },
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
    } catch (error) {
        logger.error('[Server] Failed to start: %s', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

bootstrap();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
