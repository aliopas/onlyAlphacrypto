import { Router } from 'express';
import { chatStream } from '../controllers/chat.controller';
import { optionalAuth, authMiddleware } from '../middleware/auth.middleware';
import { chatLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/stream', optionalAuth, chatLimiter, chatStream);
router.post('/stream/context', authMiddleware, chatLimiter, chatStream);

export default router;
