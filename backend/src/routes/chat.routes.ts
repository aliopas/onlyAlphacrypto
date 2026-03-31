import { Router } from 'express';
import { chatStream, acceptDisclaimer, checkDisclaimer } from '../controllers/chat.controller';
import { optionalAuth, authMiddleware } from '../middleware/auth.middleware';
import { chatLimiter } from '../middleware/rateLimit.middleware';
import { guestLimit } from '../middleware/guest-limit.middleware';

const router = Router();

router.post('/stream', optionalAuth, guestLimit, chatLimiter, chatStream);
router.post('/stream/context', authMiddleware, chatLimiter, chatStream);
router.post('/disclaimer-accept', authMiddleware, acceptDisclaimer);
router.get('/disclaimer-status', optionalAuth, checkDisclaimer);

export default router;
