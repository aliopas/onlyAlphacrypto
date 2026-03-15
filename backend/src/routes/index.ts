import { Router, Request, Response } from 'express';
import marketRoutes from './market.routes';
import airdropRoutes from './airdrop.routes';
import chatRoutes from './chat.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/market', marketRoutes);
router.use('/airdrop', airdropRoutes);
router.use('/chat', chatRoutes);
router.use('/user', userRoutes);

// Health check
router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
