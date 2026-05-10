import { Router } from 'express';
import {
    getProjects, getProjectById, triggerVerification,
    getProgress, getDeadlines, getStats, getActivity, getSidebarDeadlines,
    getUrgentAirdrops, getPipelineStatusHandler
} from '../controllers/airdrop.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(apiLimiter);

router.get('/projects', optionalAuth, getProjects);
router.get('/projects/:id', getProjectById);
router.get('/urgent', optionalAuth, getUrgentAirdrops);
router.get('/deadlines', getDeadlines);
router.get('/projects/:id/progress', optionalAuth, getProgress);
router.get('/stats', optionalAuth, getStats);
router.get('/activity', optionalAuth, getActivity);
router.get('/sidebar-deadlines', getSidebarDeadlines);
router.get('/pipeline-status', getPipelineStatusHandler);

export default router;
