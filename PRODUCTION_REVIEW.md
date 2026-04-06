# OnlyAlpha — Production Readiness Review

**Date:** 2026-04-06  
**Scope:** All active (non-Coming-Soon) code  
**Stack:** Next.js + Express + PostgreSQL (Drizzle ORM) + Redis (ioredis)  
**Verdict: NOT PRODUCTION READY** — 3 blocking security issues, 2 critical bugs fixed below.

---

## Summary of All Fixes Applied

### Files Modified (Backend)

| File | Changes |
|------|---------|
| `backend/src/utils/crypto.ts` | **NEW** — Shared `hashKey()`, `isValidEthereumAddress()`, `sanitizeString()` |
| `backend/src/controllers/apiKey.controller.ts` | Zod validation on all inputs, OG badge race condition fix (transaction with `FOR SHARE`), `parseInt` NaN guard, `upgradePlan` now blocks free upgrades without payment, `crypto` import moved to dynamic import, uses `hashKey` from shared util |
| `backend/src/controllers/user.controller.ts` | Zod schemas for register/login/wallet, email lowercasing, password min 10 chars, Ethereum address validation, `parseInt` NaN guard, `count(*)` instead of full row fetch for wallet limit |
| `backend/src/controllers/market.controller.ts` | **CRITICAL BUG FIX:** Drizzle `.where()` reassignment (`query = query.where(...)`), `getTopMovers` now cached (30s TTL), `parseInt` NaN guard on wire/:id, `limit` capped at 100 |
| `backend/src/middleware/apiKey.middleware.ts` | Single JOIN query (eliminates N+1), single error message (prevents key enumeration), atomic Lua script for rate limiting, proper error logging on `lastUsedAt` update |
| `backend/src/middleware/rateLimit.middleware.ts` | Atomic Lua script for `INCR+EXPIRE`, proper error handling with fallback |
| `backend/src/middleware/errorHandler.ts` | Production-safe logging via `logger`, no stack leak in production |
| `backend/src/config/redis.ts` | `getCache` with try-catch + auto-delete on corrupt data, `deleteCachePattern` uses `SCAN` instead of `KEYS`, retry strategy, proper error logging on all operations |
| `backend/src/server.ts` | Environment-aware CORS (no localhost in production), graceful shutdown closes pool + Redis, uses `logger` instead of `console.log` |

### Files Modified (Frontend)

| File | Changes |
|------|---------|
| `frontend/src/features/home/components/AlphaFocusCard.tsx` | Binance API call proxied through backend `/api/chart/klines/:symbol` instead of direct client-side call |
| `frontend/next.config.ts` | Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy), image remote patterns |

### Files Created

| File | Purpose |
|------|---------|
| `backend/drizzle/migrations/0003_production_indexes.sql` | Database performance indexes for all frequently queried columns |

---

## Detailed Findings

### 1. Security Vulnerabilities (BLOCKING)

#### 1.1 `upgradePlan` had zero payment verification
- **Before:** Any authenticated user could `PATCH /api/user/plan { plan: "institutional" }` for free
- **Fix:** `upgradePlan` now throws `403` for any non-free plan without a payment flow

#### 1.2 No password complexity enforcement
- **Before:** Users could register with password `"a"`
- **Fix:** Zod schema enforces min 10 characters, max 128

#### 1.3 No wallet address validation
- **Before:** Arbitrary strings accepted as wallet addresses
- **Fix:** EIP-55 regex validation (`0x` + 40 hex chars)

#### 1.4 API key auth leaked key existence
- **Before:** Different messages for "no key" vs "invalid key"
- **Fix:** Single message: "Authentication required"

#### 1.5 CORS allowed localhost in production
- **Before:** `localhost:3000` always in allowed origins
- **Fix:** Conditionally set based on `NODE_ENV`

#### 1.6 No `name` sanitization for API keys
- **Fix:** `sanitizeString()` strips HTML chars, max 100 chars

### 2. Bugs (CRITICAL)

#### 2.1 Drizzle `.where()` result discarded
- **File:** `market.controller.ts:144-151`
- **Before:** `query.where(...)` returned new builder but was not reassigned — coin filtering never worked
- **Fix:** `query = query.where(...)`

#### 2.2 OG badge race condition
- **File:** `apiKey.controller.ts:137-147`
- **Before:** `SELECT COUNT(*)` + `UPDATE` not atomic
- **Fix:** `db.transaction()` with `FOR SHARE` lock

#### 2.3 Rate limiter `INCR` + `EXPIRE` not atomic
- **Before:** Process crash between operations → permanent block
- **Fix:** Atomic Lua script

#### 2.4 `getCache` JSON.parse crash
- **Before:** Corrupted Redis data would crash entire request
- **Fix:** try-catch + auto-delete corrupt key

#### 2.5 `parseInt` without NaN guard
- **Before:** Non-numeric IDs caused unpredictable behavior
- **Fix:** `isNaN(id)` check with 400 response

#### 2.6 JWT `plan` goes stale after upgrade
- **Before:** JWT embeds plan, old JWT says "free" after upgrade
- **Fix:** Noted in review — requires either re-login flow or DB fetch in authMiddleware (left as documented TODO since it requires frontend login flow changes)

### 3. Performance Optimizations

#### 3.1 N+1 query in API key middleware
- **Before:** 2 sequential DB queries per API-key request
- **Fix:** Single `INNER JOIN` query

#### 3.2 `getTopMovers` had no caching
- **Before:** Hit Binance API on every request
- **Fix:** 30s Redis cache

#### 3.3 Missing database indexes
- **Fix:** 12 indexes created in migration `0003_production_indexes.sql`

#### 3.4 `KEYS` command in cache invalidation
- **Before:** O(N) blocking operation
- **Fix:** `SCAN` with cursor

#### 3.5 Client-side Binance API call
- **Before:** Direct `fetch('https://api.binance.com/...')` from browser
- **Fix:** Proxied through `/api/chart/klines/:symbol`

### 4. Code Health

#### 4.1 Duplicated `hashKey` function
- **Before:** Identical function in 2 files
- **Fix:** Single source in `utils/crypto.ts`

#### 4.2 Graceful shutdown
- **Before:** `process.exit(0)` without closing connections
- **Fix:** Closes PostgreSQL pool + Redis before exit

#### 4.3 No input validation
- **Before:** Raw `req.body as { ... }` everywhere
- **Fix:** Zod schemas on all endpoints

---

## Post-Deploy Checklist

- [ ] Run migration: `psql -d your_db -f backend/drizzle/migrations/0003_production_indexes.sql`
- [ ] Integrate payment gateway for `upgradePlan` (Stripe recommended)
- [ ] Add re-login prompt after plan upgrade (JWT staleness fix)
- [ ] Set `NODE_ENV=production` in deployment
- [ ] Configure `REDIS_URL` in production (rate limiting requires it)
- [ ] Remove `forceSeed` endpoint or protect with admin auth
- [ ] Set up structured logging (winston/pino) for production
- [ ] Add health check monitoring (ping `/api/health`)
