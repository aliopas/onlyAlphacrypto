import { Router } from 'express';
import { getCoinInsight, getAlphaFocus, getRadarSignals, getMarketMood, getLatestWire, getWireById, getTopMoversController, getAssetCount, forceSeed } from '../controllers/market.controller';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/insight/:symbol', apiLimiter, getCoinInsight);
router.get('/alpha-focus', apiLimiter, getAlphaFocus);
router.get('/radar', apiLimiter, getRadarSignals);
router.get('/mood', apiLimiter, getMarketMood);
router.get('/wire', apiLimiter, getLatestWire);
router.get('/wire/:id', apiLimiter, getWireById);
router.get('/movers', apiLimiter, getTopMoversController);
router.get('/asset-count', apiLimiter, getAssetCount);

// Dev/Admin tool to force-seed the database
router.post('/force-seed', authMiddleware, forceSeed);

export default router;
