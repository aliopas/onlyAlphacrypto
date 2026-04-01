import { Router } from 'express';
import {
    getProjects, getProjectById, triggerVerification,
    getProgress, getDeadlines, getStats, getActivity, getSidebarDeadlines
} from '../controllers/airdrop.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(apiLimiter);

router.get('/projects', getProjects);
router.get('/projects/:id', getProjectById);
router.get('/deadlines', getDeadlines);
router.get('/projects/:id/progress', authMiddleware, getProgress);
router.post('/verify/:taskId', authMiddleware, triggerVerification);
router.get('/stats', optionalAuth, getStats);
router.get('/activity', optionalAuth, getActivity);
router.get('/sidebar-deadlines', getSidebarDeadlines);

export default router;
