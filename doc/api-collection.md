# 📡 OnlyAlpha — API Collection & Documentation

This document lists all available endpoints in the OnlyAlpha backend.
**Base URL:** `http://localhost:5000/api`

---

## 🏥 System
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | `GET` | No | Check server status and timestamp |

---

## 🔐 Authentication & User
| Endpoint | Method | Auth | Body / Params | Description |
|---|---|---|---|---|
| `/user/me` | `GET` | Yes | - | Get current user profile & plan |
| `/user/me` | `PATCH` | Yes | `{ preferences }` | Update user notification settings |
| `/user/wallets` | `GET` | Yes | - | Get all wallets for current user |
| `/user/wallets` | `POST` | Yes | `{ address, label?, chains? }` | Add a new tracking wallet |
| `/user/wallets/:id` | `DELETE` | Yes | `id` (param) | Remove a wallet |
| `/user/api-keys` | `GET` | Yes | - | List all active API keys (Pro only) |
| `/user/api-keys` | `POST` | Yes | `{ label }` | Create a new API key |
| `/user/api-keys/:id` | `DELETE` | Yes | `id` | Revoke an API key |

---

## 📈 Market Intelligence
| Endpoint | Method | Auth | Params | Description |
|---|---|---|---|---|
| `/market/insights/:coin` | `GET` | No | `coin` (slug) | Get AI verdict & technicals for a coin |
| `/market/alpha-focus` | `GET` | No | - | Get today's top-ranked AI pick |
| `/market/radar` | `GET` | No | - | Get latest 6 AI radar signals (Home) |
| `/market/wire` | `GET` | No | `limit?`, `coin?` | Get news feed (Terminal/Home) |
| `/market/mood` | `GET` | No | - | Get current Fear & Greed hybrid score |
| `/market/movers` | `GET` | No | - | Get top 10 gainers/losers from Binance |

---

## 🪂 Airdrop Hub
| Endpoint | Method | Auth | Params / Body | Description |
|---|---|---|---|---|
| `/airdrop/projects` | `GET` | No | - | Get all active airdrop projects |
| `/airdrop/projects/:id` | `GET` | No | `id` | Get project details + task list |
| `/airdrop/deadlines` | `GET` | No | - | Get projects with upcoming snapshots/TGEs |
| `/airdrop/projects/:id/progress` | `GET` | Yes | `id` | Get user's % progress for a project |
| `/airdrop/verify/:taskId` | `POST` | Yes | `taskId` | Trigger auto-verification for a task |

---

## 🤖 AI Chat (Ask OnlyAlpha)
| Endpoint | Method | Auth | Body | Description |
|---|---|---|---|---|
| `/chat/stream` | `POST` | Yes | `{ coinSlug, messages }` | Stream AI response via SSE |

### SSE Chunk Format:
```text
data: {"content": "Hello"}
data: {"content": " world"}
data: [DONE]
```

---

## 🛠️ Headers
For protected routes, include the JWT token:
`Authorization: Bearer <your_token>`

## ⏱️ Rate Limits
- **General APIs:** 60 requests / minute
- **Auth Routes:** 10 requests / 15 minutes
- **AI Chat:** 5 requests / minute
