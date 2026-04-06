# PHASE 10 — Deployment

> **Depends on:** Phase 9 all tests passing.
> **Goal:** Ship to production safely.
> **Files affected:** `.env`, `server.ts`, new cron file

---

## Task 10-A: Pre-Deploy Checklist

### Environment Variables (`.env` — production):

```bash
# REQUIRED — verify these are set correctly
ANALYSIS_MODEL=deepseek/deepseek-r1
SEO_MODEL=openai/gpt-5-nano
OPENROUTER_API_KEY=<valid-key>
DATABASE_URL=<valid-postgres-url>
REDIS_URL=<valid-redis-url>
MORALIS_API_KEY=<valid-key>
JWT_SECRET=<min-32-chars>

# REMOVE these if still present
CRYPTOCOMPARE_API_KEY=...    # DELETE
COINCAP_API_KEY=...          # DELETE

# KEEP these
TAVILY_API_KEY=...           # Emergency fallback only
```

### Dependencies:

```bash
# Ensure zod is installed (Phase 8 requirement)
cd backend && npm install zod

# Verify rss-parser is present (already used)
cd backend && npm ls rss-parser
```

### Database Migration:

```bash
cd backend && npx drizzle-kit push
```

Verify tables exist:
```bash
cd backend && npx drizzle-kit studio
# Check: coin_intelligence_cache, coin_news_history
```

---

## Task 10-B: Wire Backfill Cron

### New File: `backend/src/crons/backfillCron.ts`

Follow the standard cron pattern used by all other crons in the codebase:

```typescript
import cron from 'node-cron';
import { backfillPriceOutcomes } from '../services/temporalIntelligence.service';

let isBackfillRunning = false;

export async function runBackfill(): Promise<void> {
    if (isBackfillRunning) return;
    isBackfillRunning = true;
    console.log('[BackfillCron] Running — filling 7d price outcomes...');

    try {
        await backfillPriceOutcomes();
    } catch (error) {
        console.error('[BackfillCron] Fatal error:', error);
    } finally {
        isBackfillRunning = false;
    }
}

export function startBackfillCron(): void {
    cron.schedule('0 3 * * *', runBackfill); // Daily at 3am UTC
    console.log('Backfill cron scheduled — daily at 3am UTC');
}
```

### Modify: `backend/src/server.ts`

Add the backfill cron to the crons array:

```typescript
import { startBackfillCron } from './crons/backfillCron';

// Add to crons array:
const crons = [
    { name: 'AiWorkflow', fn: startAiWorkflowCron },
    { name: 'AirdropHunter', fn: startAirdropHunterCron },
    { name: 'DailyAlpha', fn: startDailyAlphaCron },
    { name: 'MarketMood', fn: startMarketMoodCron },
    { name: 'TerminalEngine', fn: startTerminalEngineCron },
    { name: 'TriageEngine', fn: startTriageEngineCron },
    { name: 'BufferCleanup', fn: startBufferCleanupCron },
    { name: 'Backfill', fn: startBackfillCron },  // NEW
];
```

---

## Task 10-C: Production Deploy

### Deploy Steps:

```bash
# 1. Push all changes
git add . && git commit -m "feat: complete pipeline rewrite — phases 0-10"
git push origin main

# 2. On production server:
git pull origin main
cd backend && npm install
npx drizzle-kit push

# 3. Restart the server
pm2 restart onlyalpha  # or your process manager
```

---

## Post-Deploy Monitoring (First 24 Hours)

### Watch for these log patterns:

| Log Pattern | Phase | Status |
|-------------|-------|--------|
| `[TerminalEngine] Buffered X new news items` | Phase 0 | Working |
| `[TriageEngine] Completed: X items triaged` | Phase 0 | Working |
| `[AI Workflow] Dynamic threshold: XX` | Phase 6 | Working |
| `[CircuitBreaker] NO "OPEN" messages` | Phase 6 | APIs healthy |
| `[AI Workflow] Published: SOL — "..."` | Phase 7 | Pipeline working |
| `[Publish] Invalidated: news:SOL, ...` | Phase 8 | Cache working |
| `[GPT-nano] NO "JSON parse failed"` | Phase 8 | Zod working |
| `[Temporal] Google News blocked` | Phase 4 | Acceptable (rate limit) |

### Check article quality (first 3 articles):

```sql
SELECT coin_symbol, headline, LENGTH(summary) as word_count, created_at
FROM coin_news
ORDER BY created_at DESC
LIMIT 5;
```

Verify:
- [ ] Length > 800 words (check `LENGTH(summary)`)
- [ ] English only (no Arabic/Chinese/Korean characters)
- [ ] References historical patterns (if temporal data exists)
- [ ] Has specific numbers in the content

---

### Prompt for Senior AI — Task 10:

```
You are the Senior Developer for OnlyAlpha. Create the backfill cron and wire it.

=== NEW FILE: backend/src/crons/backfillCron.ts ===

```typescript
import cron from 'node-cron';
import { backfillPriceOutcomes } from '../services/temporalIntelligence.service';

let isBackfillRunning = false;

export async function runBackfill(): Promise<void> {
    if (isBackfillRunning) return;
    isBackfillRunning = true;
    console.log('[BackfillCron] Running — filling 7d price outcomes...');

    try {
        await backfillPriceOutcomes();
    } catch (error) {
        console.error('[BackfillCron] Fatal error:', error);
    } finally {
        isBackfillRunning = false;
    }
}

export function startBackfillCron(): void {
    cron.schedule('0 3 * * *', runBackfill);
    console.log('Backfill cron scheduled — daily at 3am UTC');
}
```

=== FILE: backend/src/server.ts ===

1. ADD import at the top (with other cron imports):
   `import { startBackfillCron } from './crons/backfillCron';`

2. ADD to the crons array (after BufferCleanup):
   `{ name: 'Backfill', fn: startBackfillCron },`

Rules: ZERO `any` types. Follow the exact same cron pattern as all other crons in the project.
```

---

## Phase 10 Completion Checklist

- [ ] Production `.env` cleaned (dead keys removed, correct model vars)
- [ ] `zod` installed as dependency
- [ ] `npx drizzle-kit push` succeeded on production DB
- [ ] `backfillCron.ts` created with `runBackfill()` and `startBackfillCron()`
- [ ] Backfill cron wired in `server.ts` crons array
- [ ] All 8 crons registered: AiWorkflow, AirdropHunter, DailyAlpha, MarketMood, TerminalEngine, TriageEngine, BufferCleanup, Backfill
- [ ] `GET /api/health` returns `{ status: 'ok' }` on production
- [ ] First 24h monitoring shows no critical errors
- [ ] Article quality verified (800+ words, English only, specific numbers)
