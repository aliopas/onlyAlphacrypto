import { Router } from 'express';
import { getChartKlines } from '../controllers/chart.controller';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.get('/klines/:symbol', apiLimiter, getChartKlines);

export default router;
