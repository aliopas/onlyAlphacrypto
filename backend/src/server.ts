import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { testConnection } from './config/db';
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

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(helmet());
app.set('trust proxy', true); // Essential for request-ip to work correctly
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://onlyalphacrypto.com',
        'https://www.onlyalphacrypto.com'
    ],
    credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// IP-based Time Formatting Middleware
app.use(timeMiddleware);

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', db: 'disconnected' });
    }
});

app.use('/api', routes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
    try {
        // Test DB connection
        await testConnection();

        const PORT = parseInt(env.PORT, 10);
        app.listen(PORT, () => {
            console.log(`\n🚀 OnlyAlpha Backend running at http://localhost:${PORT}`);
            console.log(`📡 Environment: ${env.NODE_ENV}`);
            console.log(`🗄️  Database: Connected`);
            console.log(`⏰ AI Engines: Starting...\n`);
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
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();

process.on('SIGTERM', () => {
    logger.info('[Server] SIGTERM received — shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('[Server] SIGINT received — shutting down gracefully');
    process.exit(0);
});

export default app;
