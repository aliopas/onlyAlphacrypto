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

// Admin Signal Operations (behind separate feature flag)
router.post('/signals/pause-generation', signalOpsFlagMiddleware, adminAuth, pauseSignalGenerationHandler);
router.post('/signals/resume-generation', signalOpsFlagMiddleware, adminAuth, resumeSignalGenerationHandler);
router.patch('/signals/:id/targets', signalOpsFlagMiddleware, adminAuth, raiseTpHandler);
router.post('/signals/:id/close', signalOpsFlagMiddleware, adminAuth, closeScoreRecordHandler);

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

export default router;
