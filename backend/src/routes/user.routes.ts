import { Router } from 'express';
import { register, login, getWallets, addWallet, deleteWallet } from '../controllers/user.controller';
import { getMe, updatePreferences, upgradePlan, createApiKey, listApiKeys, revokeApiKey } from '../controllers/apiKey.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter, apiLimiter, tieredLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);

// ── Profile & Preferences ─────────────────────────────────────────────────
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updatePreferences);
router.patch('/plan', authMiddleware, upgradePlan);

// ── Wallets ────────────────────────────────────────────────────────────────
router.get('/wallets', authMiddleware, tieredLimiter(), getWallets);
router.post('/wallets', authMiddleware, tieredLimiter(), addWallet);
router.delete('/wallets/:id', authMiddleware, tieredLimiter(), deleteWallet);

// ── API Key Management (Pro/Institutional only) ───────────────────────────
router.get('/api-keys', authMiddleware, listApiKeys);
router.post('/api-keys', authMiddleware, createApiKey);
router.delete('/api-keys/:id', authMiddleware, revokeApiKey);

export default router;
