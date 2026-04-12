import { Router } from 'express';
import { chatStream, acceptDisclaimer, checkDisclaimer, getContext } from '../controllers/chat.controller';
import { optionalAuth, authMiddleware } from '../middleware/auth.middleware';
import { chatLimiter } from '../middleware/rateLimit.middleware';
import { guestLimit } from '../middleware/guest-limit.middleware';
import { chatQuota } from '../middleware/chat-quota.middleware';

const router = Router();

router.post('/stream', optionalAuth, guestLimit, chatLimiter, chatQuota, chatStream);
router.post('/stream/context', authMiddleware, chatLimiter, chatQuota, chatStream);
router.post('/disclaimer-accept', authMiddleware, acceptDisclaimer);
router.get('/disclaimer-status', optionalAuth, checkDisclaimer);
router.get('/context/:articleId/:articleType', optionalAuth, getContext);

export default router;
