# PHASE 9 — Testing & QA

> **Depends on:** All phases 0-8 complete.
> **Goal:** Verify every layer works end-to-end before deploy.

---

## Task 9-A: TypeScript Compilation Check

### Backend:
```bash
cd backend && npx tsc --noEmit
```

### Frontend:
```bash
cd frontend && npx tsc --noEmit
```

**Fix any errors** that appear. Common issues:
- Missing type imports
- Interface mismatches between files
- Unused imports after refactoring

---

## Task 9-B: Health Endpoint Check

```bash
curl http://localhost:5000/api/health
```

**Expected response:**
```json
{ "status": "ok", "db": "connected", "ts": "2026-04-04T..." }
```

---

## Task 9-C: Phase 0 Verification

### RSS News Fetch:
```bash
cd backend && npx ts-node -e "
const { fetchAllRSSNews } = require('./src/services/rssNews.service');
fetchAllRSSNews().then(r => console.log(r.length + ' RSS items fetched')).catch(console.error);
"
```

### Triage extracts symbolMentions:
After running the triage engine manually, check the `raw_news_buffer` table:
```sql
SELECT id, title, symbol_mentions, relevance_score
FROM raw_news_buffer
WHERE processed = true
LIMIT 10;
```
Expected: `symbol_mentions` should be arrays like `["BTC", "ETH"]`, NOT empty arrays or NULL.

---

## Task 9-D: Phase 2 Verification

### Price Service:
```bash
cd backend && npx ts-node -e "
const { getPriceWithFallback } = require('./src/services/priceService');
Promise.all([
    getPriceWithFallback('SOL'),
    getPriceWithFallback('PEPE')
]).then(([sol, pepe]) => {
    console.log('SOL:', sol?.source, sol?.price);
    console.log('PEPE:', pepe?.source, pepe?.price);
}).catch(console.error);
"
```

Expected: SOL returns `binance`, PEPE returns `dexscreener` (or Binance if listed).

---

## Task 9-E: Phase 3 Verification

### Coin Intelligence:
```bash
cd backend && npx ts-node -e "
const { getCoinIntelligence } = require('./src/services/coinIntelligence.service');
getCoinIntelligence('SOL').then(r => {
    console.log('ATH:', r.ath);
    console.log('Trend:', r.trend8w);
    console.log('Wiki:', r.wikiBackground?.slice(0, 100));
}).catch(console.error);
"
```

---

## Task 9-F: Phase 4 Verification

### Temporal Pattern:
```bash
cd backend && npx ts-node -e "
const { buildTemporalPattern } = require('./src/services/temporalIntelligence.service');
buildTemporalPattern('BTC', 'ETF', 3).then(p => {
    console.log(JSON.stringify(p, null, 2));
}).catch(console.error);
"
```

Expected: Either a `TemporalPattern` object with historical cases, or `null` if no data exists yet.

---

## Task 9-G: Phase 9 Verification — Full Pipeline

### Manual Pipeline Run:
```bash
cd backend && npx ts-node -e "
const { runAiWorkflow } = require('./src/crons/aiWorkflow.cron');
runAiWorkflow().then(() => console.log('Done')).catch(console.error);
"
```

**After running, verify:**
1. Check `coin_news` table for new articles:
   ```sql
   SELECT id, coin_symbol, headline, created_at
   FROM coin_news
   ORDER BY created_at DESC
   LIMIT 5;
   ```
2. Verify article length: `LENGTH(summary) > 800`
3. Verify language: article contains only English text (no Arabic/Chinese characters)
4. Check `radar_signals` for STRONG_BUY/STRONG_SELL entries:
   ```sql
   SELECT * FROM radar_signals ORDER BY created_at DESC LIMIT 5;
   ```

---

## Task 9-H: Frontend Verification

```bash
cd frontend && npm run build
```

Ensure no build errors. Check that:
- `TerminalWire.tsx` shows all radar signals
- `useTerminalChat.ts` uses `'context'` mode
- Chat SSE parsing works correctly

---

### Prompt for Senior AI — Task 9:

```
You are the Senior Developer for OnlyAlpha. Run all verification checks and fix any errors found.

STEP 1: TypeScript compilation
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```
Fix ALL type errors. Common fixes:
- Missing imports for new interfaces (CoinIntelligence, TemporalPattern, PriceResult)
- Type mismatches between function signatures and call sites
- Unused imports after refactoring

STEP 2: Health endpoint
```bash
cd backend && npx ts-node -e "
const app = require('./src/server').default;
// The server starts on its own — just verify /api/health works
"
```
Or start the server and test:
```bash
cd backend && npm run dev
# In another terminal:
curl http://localhost:5000/api/health
```

STEP 3: Fix any runtime errors found during testing
- If imports fail: check the import paths are correct (relative to file location)
- If DB queries fail: verify Drizzle column names match the schema
- If AI calls fail: verify model names and API key

STEP 4: Run `cd frontend && npm run build` and fix any build errors

Rules: Fix errors only. Do NOT add new features. Do NOT modify logic that works.
```

---

## Phase 9 Completion Checklist

- [ ] Backend TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Frontend TypeScript compiles without errors
- [ ] `GET /api/health` returns `{ status: 'ok', db: 'connected' }`
- [ ] RSS news fetch returns items from CoinDesk, Cointelegraph, etc.
- [ ] Price service returns data for SOL (Binance) and PEPE (DexScreener)
- [ ] Coin intelligence fetches ATH, trend, Wikipedia for major coins
- [ ] Triage engine saves `symbolMentions` to buffer (no more UNKNOWN)
- [ ] Deep analysis returns valid JSON with all required fields
- [ ] GPT-nano article writer returns 800+ word articles
- [ ] Zod validation catches malformed responses
- [ ] Circuit breakers trip after 5 failures and reset after cooldown
- [ ] Full pipeline (`runAiWorkflow`) completes without crashing
- [ ] New articles appear in `coin_news` table
- [ ] Frontend builds successfully
