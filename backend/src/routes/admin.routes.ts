import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { adminAuth, adminLogin, adminLogout } from '../middleware/adminAuth.middleware';
import {
    getShadowStatsHandler,
    getShadowSignalsHandler,
    getShadowSignalByIdHandler,
    getScoreRecordsHandler,
    archiveScoreRecordsHandler,
    archiveOldScoreRecordsHandler,
    reactivateScoreRecordHandler,
    restoreScoreRecordHandler,
    closeScoreRecordHandler,
    pauseSignalGenerationHandler,
    resumeSignalGenerationHandler,
    raiseTpHandler,
    getMaintenanceStatusHandler,
    toggleMaintenanceHandler,
    getAllMaintenanceStatusHandler,
    getTelemetryHandler,
    getPortfolioCoinsHandler,
    createPortfolioCoinHandler,
    updatePortfolioCoinHandler,
    closePortfolioCoinHandler,
    getPortfolioPostsHandler,
    processPortfolioPostHandler,
    resetModelPortfolioHandler,
    getMarketContextNewsHandler,
    patchMarketContextNewsTrustHandler,
    postMarketContextNewsManualHandler,
    getMarketContextTelegramChannelsHandler,
    postMarketContextTelegramChannelHandler,
    patchMarketContextTelegramChannelHandler,
    postMarketContextSnapshotGenerateHandler,
    postMarketContextCoinGenerateHandler,
    getMarketContextSnapshotsHandler,
    getMarketContextActivityHandler,
    getMarketContextSnapshotByIdHandler,
    patchMarketContextSnapshotPublishHandler,
    patchMarketContextSnapshotArchiveHandler,
    patchMarketContextSnapshotUnpublishHandler,
    getContentSourcesHandler,
    postContentSourceHandler,
    patchContentSourceHandler,
    deleteContentSourceHandler,
    getAirdropOpsMetricsHandler,
    getAirdropOpsProjectsHandler,
    postAirdropOpsKillSwitchHandler,
    getAirdropOpsEntitiesHandler,
    getAirdropOpsEntityByIdHandler,
    postAirdropOpsEntityAliasHandler,
    postAirdropOpsEntityMergeHandler,
    postAirdropOpsEntitySplitHandler,
} from '../controllers/admin.controller';

const router = Router();

function featureFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!env.ADMIN_COMMAND_CENTER_ENABLED) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    next();
}

function signalOpsFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!env.ADMIN_SIGNAL_OPS_ENABLED) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    next();
}

function marketContextFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!env.ADMIN_COMMAND_CENTER_ENABLED || !env.MARKET_CONTEXT_ENABLED) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    next();
}

function airdropIntelligenceFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!env.ADMIN_COMMAND_CENTER_ENABLED || !env.AIRDROP_INTELLIGENCE_ENABLED) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    next();
}

// Public routes (no auth required)
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

// Protected routes (require admin auth)
router.get('/shadow/stats', adminAuth, getShadowStatsHandler);
router.get('/shadow/signals', adminAuth, getShadowSignalsHandler);
router.get('/shadow/signals/:id', adminAuth, getShadowSignalByIdHandler);

// Admin Command Center — Score Records (behind feature flag)
router.get('/score-records', featureFlagMiddleware, adminAuth, getScoreRecordsHandler);
router.delete('/score-records', featureFlagMiddleware, adminAuth, archiveScoreRecordsHandler);
router.post('/score-records/archive-old', featureFlagMiddleware, adminAuth, archiveOldScoreRecordsHandler);
router.post('/score-records/:id/reactivate', featureFlagMiddleware, adminAuth, reactivateScoreRecordHandler);
router.post('/score-records/:id/restore', featureFlagMiddleware, adminAuth, restoreScoreRecordHandler);
router.post('/signals/:id/close', featureFlagMiddleware, adminAuth, closeScoreRecordHandler);

// Admin Signal Operations (behind separate feature flag)
router.post('/signals/pause-generation', signalOpsFlagMiddleware, adminAuth, pauseSignalGenerationHandler);
router.post('/signals/resume-generation', signalOpsFlagMiddleware, adminAuth, resumeSignalGenerationHandler);
router.patch('/signals/:id/targets', signalOpsFlagMiddleware, adminAuth, raiseTpHandler);

// Maintenance Mode — Public status check (no auth)
router.get('/maintenance/status', getMaintenanceStatusHandler);

// Maintenance Mode — Admin toggle (behind feature flag)
router.post('/maintenance/toggle', featureFlagMiddleware, adminAuth, toggleMaintenanceHandler);
router.get('/maintenance', featureFlagMiddleware, adminAuth, getAllMaintenanceStatusHandler);

// System Telemetry Dashboard (behind feature flag)
router.get('/telemetry', featureFlagMiddleware, adminAuth, getTelemetryHandler);

// Portfolio Management (behind feature flag)
router.get('/portfolio/coins', featureFlagMiddleware, adminAuth, getPortfolioCoinsHandler);
router.post('/portfolio/coins', featureFlagMiddleware, adminAuth, createPortfolioCoinHandler);
router.patch('/portfolio/coins/:id', featureFlagMiddleware, adminAuth, updatePortfolioCoinHandler);
router.patch('/portfolio/coins/:id/close', featureFlagMiddleware, adminAuth, closePortfolioCoinHandler);

// Portfolio Posts Manual Intake + Hard Reset (MP-ADMIN-OPS)
router.get('/portfolio/posts', featureFlagMiddleware, adminAuth, getPortfolioPostsHandler);
router.post('/portfolio/posts/:id/process', featureFlagMiddleware, adminAuth, processPortfolioPostHandler);
router.post('/portfolio/reset', featureFlagMiddleware, adminAuth, resetModelPortfolioHandler);

// Market Context Admin (MC-2 / DEC-040)
router.get(
    '/market-context/news',
    marketContextFlagMiddleware,
    adminAuth,
    getMarketContextNewsHandler
);
router.patch(
    '/market-context/news/:id/trust',
    marketContextFlagMiddleware,
    adminAuth,
    patchMarketContextNewsTrustHandler
);
router.post(
    '/market-context/news/manual',
    marketContextFlagMiddleware,
    adminAuth,
    postMarketContextNewsManualHandler
);
router.get(
    '/market-context/telegram-channels',
    marketContextFlagMiddleware,
    adminAuth,
    getMarketContextTelegramChannelsHandler
);
router.post(
    '/market-context/telegram-channels',
    marketContextFlagMiddleware,
    adminAuth,
    postMarketContextTelegramChannelHandler
);
router.patch(
    '/market-context/telegram-channels/:id',
    marketContextFlagMiddleware,
    adminAuth,
    patchMarketContextTelegramChannelHandler
);

// Market Context Snapshots (MC-3)
router.post(
    '/market-context/snapshots/generate',
    marketContextFlagMiddleware,
    adminAuth,
    postMarketContextSnapshotGenerateHandler
);
// DEC-043 B3 — coin blog generate
router.post(
    '/market-context/snapshots/generate-coin',
    marketContextFlagMiddleware,
    adminAuth,
    postMarketContextCoinGenerateHandler
);
router.get(
    '/market-context/activity',
    marketContextFlagMiddleware,
    adminAuth,
    getMarketContextActivityHandler
);
router.get(
    '/market-context/snapshots',
    marketContextFlagMiddleware,
    adminAuth,
    getMarketContextSnapshotsHandler
);
router.get(
    '/market-context/snapshots/:id',
    marketContextFlagMiddleware,
    adminAuth,
    getMarketContextSnapshotByIdHandler
);
router.patch(
    '/market-context/snapshots/:id/publish',
    marketContextFlagMiddleware,
    adminAuth,
    patchMarketContextSnapshotPublishHandler
);
router.patch(
    '/market-context/snapshots/:id/archive',
    marketContextFlagMiddleware,
    adminAuth,
    patchMarketContextSnapshotArchiveHandler
);
router.patch(
    '/market-context/snapshots/:id/unpublish',
    marketContextFlagMiddleware,
    adminAuth,
    patchMarketContextSnapshotUnpublishHandler
);

// Content Sources Admin (AD-1 / DEC-041)
router.get(
    '/sources',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    getContentSourcesHandler
);
router.post(
    '/sources',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    postContentSourceHandler
);
router.patch(
    '/sources/:id',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    patchContentSourceHandler
);
router.delete(
    '/sources/:id',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    deleteContentSourceHandler
);

// Airdrop Ops (AD-5 / DEC-041) — metrics, kill-switch, entity merge/split — NO trust queue
router.get(
    '/airdrop-ops/metrics',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    getAirdropOpsMetricsHandler
);
router.get(
    '/airdrop-ops/projects',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    getAirdropOpsProjectsHandler
);
router.post(
    '/airdrop-ops/projects/:id/kill-switch',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    postAirdropOpsKillSwitchHandler
);
router.get(
    '/airdrop-ops/entities',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    getAirdropOpsEntitiesHandler
);
router.get(
    '/airdrop-ops/entities/:id',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    getAirdropOpsEntityByIdHandler
);
router.post(
    '/airdrop-ops/entities/:id/aliases',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    postAirdropOpsEntityAliasHandler
);
router.post(
    '/airdrop-ops/entities/merge',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    postAirdropOpsEntityMergeHandler
);
router.post(
    '/airdrop-ops/entities/split',
    airdropIntelligenceFlagMiddleware,
    adminAuth,
    postAirdropOpsEntitySplitHandler
);

export default router;
