# 07 — API Reference

**Base URL:** `/api`  
**Auth:** JWT via `Authorization` header  
**Rate Limiting:** Redis Lua atomic scripts

---

## Rate Limits

| Tier | Requests / Hour |
|---|---|
| Free | 60 |
| Pro | 500 |
| Institutional | 5000 |

| Endpoint Category | Limiter |
|---|---|
| General API | 60 req/min |
| Chat | 20 req/min |
| Auth (login/register) | 10 req/15min |

### Chat Quotas (Daily)

| Tier | Messages / Day | Context Messages |
|---|---|---|
| Guest | 5 | — |
| Free | 15 | — |
| Pro | 999 | 30 |

---

## Market Endpoints (`/api/market`)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | System health check |
| GET | `/radar` | None | Alpha radar signals |
| GET | `/mood` | None | Market mood gauge (Fear & Greed) |
| GET | `/alpha-focus` | None | Daily alpha focus pick |
| GET | `/movers` | None | Top movers data |
| GET | `/asset-count` | None | Number of tracked assets |
| GET | `/insight/:symbol` | None | Coin intelligence data |
| GET | `/master/:symbol` | Optional | Living article (master article) |
| GET | `/master/coins` | None | List of coins with master articles |
| GET | `/timeline/:symbol` | Optional | Coin timeline events |
| GET | `/archive` | None | Published articles (paginated, year/month grouping) |
| GET | `/outlook/:symbol` | None | Strategic intelligence outlook |
| GET | `/scorecard` | None | Signal performance scorecard (P&L, win rates) |
| GET | `/wire` | None | Latest wire feed items |
| GET | `/wire/:id` | None | Single wire item by ID |
| GET | `/event-impact-stats` | **Required** | Event impact statistics (admin) |
| POST | `/force-seed` | **Required** | Force database seed (dev/admin) |

---

## Chat Endpoints (`/api/chat`)

| Method | Route | Auth | Middleware Stack | Description |
|---|---|---|---|---|
| POST | `/stream` | Optional | guestLimit → chatLimiter → chatQuota | General chat stream (SSE) |
| POST | `/stream/context` | **Required** | chatLimiter → chatQuota | Context-aware chat (injects article + memory) |
| POST | `/disclaimer-accept` | **Required** | — | Accept chat NFA disclaimer |
| GET | `/disclaimer-status` | Optional | — | Check if disclaimer was accepted |
| GET | `/context/:articleId/:articleType` | Optional | — | Get article context for chat |

---

## User Endpoints (`/api/user`)

### Auth

| Method | Route | Limiter | Description |
|---|---|---|---|
| POST | `/auth/register` | authLimiter | Register new account |
| POST | `/auth/login` | authLimiter | Login, returns JWT |

### Profile (auth required)

| Method | Route | Description |
|---|---|---|
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update preferences |
| PATCH | `/plan` | Upgrade plan tier |

### Wallets (auth + tiered limit)

| Method | Route | Description |
|---|---|---|
| GET | `/wallets` | List user wallets |
| POST | `/wallets` | Add wallet |
| DELETE | `/wallets/:id` | Remove wallet |

### API Keys (auth required, Pro/Institutional)

| Method | Route | Description |
|---|---|---|
| GET | `/api-keys` | List API keys |
| POST | `/api-keys` | Create new API key |
| DELETE | `/api-keys/:id` | Revoke API key |

---

## Airdrop Endpoints (`/api/airdrop`)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/projects` | Optional | List airdrop projects (paginated) |
| GET | `/projects/:id` | None | Single project detail |
| GET | `/urgent` | Optional | Urgent deadline airdrops |
| GET | `/deadlines` | None | Upcoming deadlines |
| GET | `/projects/:id/progress` | Optional | User progress on project tasks |
| POST | `/verify/:taskId` | **Required** | Trigger task verification |
| GET | `/stats` | Optional | Airdrop stats |
| GET | `/activity` | Optional | Recent airdrop activity |
| GET | `/sidebar-deadlines` | None | Sidebar deadline list |
| GET | `/pipeline-status` | None | Pipeline health status |

---

## Chart Endpoints (`/api/chart`)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/klines/:symbol` | None | Candlestick data for charts |

---

## Middleware Stack (Order Matters)

```
Request
   │
   ▼
Helmet (security headers: XSS, clickjacking, CSP, CORP, COOP)
   │
   ▼
CORS (onlyalphacrypto.com + www / localhost:3000)
   │
   ▼
JSON Parser (max 10KB)
   │
   ▼
URL-Encoded Parser (extended: true)
   │
   ▼
Time Middleware (X-Response-Time header)
   │
   ▼
Routes (/api/*)
   │
   ├── auth.middleware.ts       — JWT verification
   ├── optionalAuth             — JWT if present, no error if missing
   ├── rateLimit.middleware.ts   — Redis Lua atomic rate limiting
   ├── chat-quota.middleware.ts  — Daily message quotas per plan
   ├── guest-limit.middleware.ts — Guest restrictions
   ├── apiKey.middleware.ts      — API key authentication
   └── errorHandler.ts          — Centralized error responses
```

### Rate Limit Implementation (Redis Lua)

```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
```

Atomic INCR + EXPIRE prevents race conditions where expiry never gets set.

**Graceful degradation:** Redis down → development allows all requests; production returns 503.
