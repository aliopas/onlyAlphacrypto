import { Router } from 'express';
import { adminAuth, adminLogin, adminLogout } from '../middleware/adminAuth.middleware';
import {
    getShadowStatsHandler,
    getShadowSignalsHandler,
    getShadowSignalByIdHandler,
} from '../controllers/admin.controller';

const router = Router();

// Public routes (no auth required)
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

// Protected routes (require admin auth)
router.get('/shadow/stats', adminAuth, getShadowStatsHandler);
router.get('/shadow/signals', adminAuth, getShadowSignalsHandler);
router.get('/shadow/signals/:id', adminAuth, getShadowSignalByIdHandler);

export default router;