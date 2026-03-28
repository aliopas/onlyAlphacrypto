import { Router } from 'express';
import { chatStream } from '../controllers/chat.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { chatLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// SSE streaming endpoint — rate limited to 5 req/min per user
router.post('/stream', optionalAuth, chatLimiter, chatStream);

export default router;
