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

        // Start all AI cron engines
        startAiWorkflowCron();
        startAirdropHunterCron();
        startDailyAlphaCron();
        startMarketMoodCron();
        startTerminalEngineCron();
        console.log('⏰ Terminal Engine cron scheduled — every 5 mins');

        const PORT = parseInt(env.PORT, 10);
        app.listen(PORT, () => {
            console.log(`\n🚀 OnlyAlpha Backend running at http://localhost:${PORT}`);
            console.log(`📡 Environment: ${env.NODE_ENV}`);
            console.log(`🗄️  Database: Connected`);
            console.log(`⏰ AI Engines: All crons started\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();

export default app;
