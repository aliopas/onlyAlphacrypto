import { Router } from 'express';
import marketRoutes from './market.routes';
import airdropRoutes from './airdrop.routes';
import chatRoutes from './chat.routes';
import userRoutes from './user.routes';
import chartRoutes from './chart.routes';
import { systemHealthCheck } from '../controllers/health.controller';

const router = Router();

router.use('/market', marketRoutes);
router.use('/airdrop', airdropRoutes);
router.use('/chat', chatRoutes);
router.use('/user', userRoutes);
router.use('/chart', chartRoutes);

// Health check
router.get('/health', systemHealthCheck);

export default router;
