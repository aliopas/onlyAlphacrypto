# 10 — Development Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector extension
- Redis (optional, recommended for production)
- npm or pnpm

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in required env vars (see 09-ENVIRONMENT-VARIABLES.md)
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3. Database

```bash
# PostgreSQL must be running with pgvector extension
# Drizzle ORM handles schema push:
cd backend
npx drizzle-kit push
```

## Running

### Development (Backend)
```bash
cd backend
npm run dev
# Starts on http://localhost:5000
# All crons start with 5-second stagger
```

### Development (Frontend)
```bash
cd frontend
npm run dev
# Starts on http://localhost:3000
```

## TypeScript

Both projects use strict TypeScript with zero `any` types.

```bash
# Backend typecheck
cd backend && npx tsc --noEmit

# Frontend typecheck
cd frontend && npx tsc --noEmit
```

## Project Conventions

### Code Quality
- **Zero `any` types** — use `unknown`, generics, or specific interfaces
- **Modular boundaries** — Cache logic in `CacheManager`, AI calls in `AIGateway`, Prompts in `PromptFactory`
- **Backward compatibility** — All existing exports must remain unchanged unless explicitly authorized

### File Naming
- Services: `camelCase.service.ts`
- Crons: `camelCase.cron.ts`
- Controllers: `camelCase.controller.ts`
- Models: `camelCase.model.ts`
- Components: `PascalCase.tsx`
- Types: `types.ts` per feature

### Feature Flags
All new features must be behind an env flag (default `false`). This ensures safe deployment without affecting production until explicitly enabled.

### Database Migrations
All migrations must be guarded by `migration_flags` table — run exactly once. SQL migrations go in `backend/scripts/`.

### Safe Public Language
All user-facing text uses AdSense-safe terminology:
- "Market Scenario" not "Signal"
- "Target Zone" not "Take Profit"
- "Risk Zone" not "Stop Loss"
- "Reference Price" not "Entry Price"
- "Historical Outcome" not "P&L"
- "Bullish/Bearish" not "BUY/SELL"

---

## Agent System

The project uses a multi-agent development workflow. Agents are documented in `agent_gedens/`:

| File | Purpose |
|---|---|
| `AGENTS_PROTOCOL.md` | Role definitions for all 8 agents |
| `PROJECT_STATE.md` | Current project state, phase tracking |
| `AGENT_LOGS.md` | Verdict log for all tasks |
| `THE_NEXUS_HUB.md` | Active task assignments |

### Active Plan
`plans/THE SUPREME REVIEWER_plans/nextstep2.md` — Master Implementation Plan v2.0

### Agent Roles

| Role | Responsibility |
|---|---|
| Product Visionary | UX/UI conceptualization (non-technical) |
| Tech Lead | Approve/reject features, provide guardrails |
| System Architect | Technical blueprints, DB schemas, data flows |
| Strategic Planner | Break blueprints into micro-tasks |
| Senior Developer | Write production code |
| Prompt Engineer | AI prompt optimization |
| QA Hunter | Test and audit code |
| Release Manager | Git operations and deployment |

---

## Deployment

### Production URLs
- Frontend: `https://onlyalphacrypto.com`
- Backend: Same server, port 5000 (internal)

### CORS Origins (Production)
- `https://onlyalphacrypto.com`
- `https://www.onlyalphacrypto.com`

### Graceful Shutdown
SIGTERM/SIGINT handlers close PostgreSQL pool and disconnect Redis before exit.

---

## Key Gotchas

1. **AiWorkflow Redis Lock** — If the server crashes mid-workflow, the Redis lock (`SET NX EX 900`) may persist for up to 15 minutes. The 10-minute timeout force-releases it.

2. **Telegram MTProto** — Requires `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION_STRING`. Session strings are generated once and must be stored securely.

3. **DeepSeek Direct vs OpenRouter** — When `DEEPSEEK_API_KEY` is set, analysis and triage bypass OpenRouter entirely. If the key is invalid, the system falls back to OpenRouter.

4. **pgvector Extension** — Must be installed in PostgreSQL before running schema push. Required for semantic dedup.

5. **Redis Optional** — The system works without Redis (falls back to in-memory for caching and dedup), but rate limiting will allow all requests in production mode if Redis is down (503 would be returned).

6. **Feature Flags Default False** — Many features (event impact, level intelligence, scenario tracker) are behind feature flags that default to `false`. They must be explicitly enabled in production.

7. **Migration Flags** — Bootstrap scripts (article repair, meta tag repair, radar cleanup) use the `migration_flags` table to ensure they only run once.

8. **30 Frontend Coins** — The frontend `COINS` constant has 30 entries, but the v2 plan will reduce this to 11 tracked coins. Backend processing is not restricted to these 30 coins.
