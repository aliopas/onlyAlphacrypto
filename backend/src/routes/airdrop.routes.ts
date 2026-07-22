import { Router } from 'express';
import {
    getProjects, getProjectById, triggerVerification,
    getProgress, getDeadlines, getStats, getActivity, getSidebarDeadlines,
    getUrgentAirdrops, getPipelineStatusHandler,
    getPublicStatsHandler, listResearchHandler, getResearchBySlugHandler,
    listResearchSeoSlugsHandler,
} from '../controllers/airdrop.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(apiLimiter);

// DEC-042 AR-1: static paths BEFORE /projects/:id so params do not swallow them
router.get('/public-stats', getPublicStatsHandler);
router.get('/research/seo-slugs', listResearchSeoSlugsHandler);
router.get('/research', listResearchHandler);
router.get('/research/:slug', getResearchBySlugHandler);

router.get('/projects', optionalAuth, getProjects);
router.get('/projects/:id', getProjectById);
router.get('/urgent', optionalAuth, getUrgentAirdrops);
router.get('/deadlines', getDeadlines);
router.get('/projects/:id/progress', optionalAuth, getProgress);
// Legacy farm-value stats (sidebar). Public trust stats = /public-stats (DEC-042).
router.get('/stats', optionalAuth, getStats);
router.get('/activity', optionalAuth, getActivity);
router.get('/sidebar-deadlines', getSidebarDeadlines);
router.get('/pipeline-status', getPipelineStatusHandler);

export default router;
