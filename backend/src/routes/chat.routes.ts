import { Router } from 'express';
import { chatStream } from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { chatLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// SSE streaming endpoint — rate limited to 5 req/min per user
router.post('/stream', authMiddleware, chatLimiter, chatStream);

export default router;
