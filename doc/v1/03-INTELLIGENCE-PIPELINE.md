# 03 — Intelligence Pipeline

The pipeline transforms raw news into actionable intelligence through 6 stages.

## Stage 1: Gathering (TerminalEngine)

**Schedule:** Every 10 minutes  
**File:** `crons/terminalEngine.cron.ts`  
**Service:** `services/rssNews.service.ts`

### RSS Feeds (4 sources)
- CoinDesk
- CoinTelegraph
- Decrypt
- The Block

### Process
```
Fetch RSS → Parse headlines → SHA-256 hash per headline
    → Dedup check (against coin_news + raw_news_buffer)
    → New items → INSERT into raw_news_buffer (TTL: 48h)
    → Existing → SKIP
```

### Supplementary: Telegram Monitoring

**Schedule:** Every 30 min (news), every 4h (airdrops)  
**File:** `crons/telegramMonitor.cron.ts`  
**Service:** `services/telegram.service.ts`

Uses **Telegram MTProto** (gram.js) for direct channel scraping. Monitors 7 channels:
- **News:** whale_alert_io, OKXAnnouncements, WuBlockchainReal, CryptoQuantOfficial
- **Airdrops:** AirdropAlpha, earndrop, AirdropAlert

Built-in spam filter blocks 8 patterns (pump signals, guaranteed profit scams, etc.).

### Supplementary: Airdrop RSS Discovery

**Schedule:** Every 6h  
**File:** `crons/airdropRssHunter.cron.ts`  
**Service:** `services/airdropRss.service.ts`

5 RSS sources filtered by airdrop keywords → SHA-256 dedup (Redis SET + 7d TTL) → AI validation (max 5 calls/run) → `airdrop_projects` table.

---

## Stage 2: Triage (TriageEngine)

**Schedule:** Every 2h  
**File:** `crons/triageEngine.cron.ts`  
**Service:** `openai.service.ts → generateLightweightTriage()`

Takes up to **50 unclassified** items per run, processes in **batches of 10** (one AI call per batch).

### AI Output per Item
```json
{
  "relevanceScore": 0-100,
  "sentimentHint": "bullish | bearish | neutral",
  "symbolMentions": ["BTC", "ETH"],
  "eventType": "ETF | Hack | Listing | Partnership | ...",
  "eventSeverity": 1 | 2 | 3,
  "classification": "MAJOR | MINOR | NOISE"
}
```

### Classification Rules

| Label | Triggers |
|---|---|
| **MAJOR** | ETF approval, security breach, SEC action, major listing, mainnet launch, funding >$100M |
| **MINOR** | Price levels, whale movements, partnerships, minor updates |
| **NOISE** | Repetitive content, promotional articles, opinion pieces, meme coins without catalyst |

After triage, items are marked `processed = true` in `raw_news_buffer`.

---

## Stage 3: AI Workflow (AiWorkflow)

**Schedule:** Hourly  
**File:** `crons/aiWorkflow.cron.ts`  
**Core Services:** `openai.service.ts`, `prompt-factory.ts`, `ai-gateway.ts`

This is the main intelligence engine. It processes triaged news through the full pipeline.

### Flow

```
raw_news_buffer (processed=true, relevanceScore >= dynamic threshold)
    │
    ▼
Hourly cap check (max 5 articles/hour)
    │
    ▼
Dynamic threshold check (adjusts based on news volume)
    │
    ▼
Embedding dedup check (pgvector cosine similarity)
    │  YES → SKIP (already covered)
    ▼  NO
    │
Classification?
┌──────┬──────┬──────┐
▼      ▼      ▼
NOISE  MINOR  MAJOR
│      │      │
SKIP   Deep   Deep Analysis (DeepSeek)
       Seek   │
       Direct ├─ Factual Grounding (±50% price sanity check)
       or     ├─ Writer Stage 2A+2B (Gemini 2.5 Flash)
       Open   ├─ Quality Audit (if impactScore >= 75)
       Router ├─ Save to coin_news
       │      ├─ Radar Signal (if actionable verdict)
       Minor  ├─ Update Master Article
       Update ├─ Strategic Outlook (if MAJOR + impact >= 70)
       │      ├─ Save to coin_memory
       │      ├─ Store Embedding (pgvector)
       │      └─ Invalidate Redis Cache
       │
       └─ callGptNanoMinorUpdate()
          1-2 paragraph update → coin_timeline_updates (MINOR)
          → coin_news (backward compat)
          → store embedding
```

### Deep Analysis (`callDeepSeekAnalysis`)

**Input:** `DeepAnalysisInput` — current price, 24h change, ATH, 52-week range, 8-week trend, 30-day change, Wikipedia background, historical event patterns, coin memory.

**Output:** `DeepAnalysisResult` — verdict, sentiment, impactScore, confidenceScore, support/resistance levels, riskTags, keyDrivers, marketScenario.

**Retry:** 3 attempts with automatic retry on failure.

### Article Writing

Two-stage pipeline for MAJOR events:

1. **Stage 2A** (`callWriterStage2A`): Generates article sections with DeepSeek
2. **Stage 2B** (`callWriterStage2B`): SEO formatting (meta title, description, keywords) with GPT-5-nano
3. **Merge** (`mergeArticleStages`): Combines both stages into final article

**Fallback:** If AI writer fails schema validation, the system relaxes constraints to salvage partial articles. If all attempts fail, renders from analysis JSON directly.

### Bootstrap Logic

If a MINOR event arrives for a coin with no Master Article yet, the system **auto-promotes** it to MAJOR to create the first Living Article.

---

## Stage 4: Conviction Score (Zero AI Cost)

**File:** `services/conviction.service.ts`  
**Cron:** `crons/convictionUpdate.cron.ts` (every 6h)

Pure algorithmic system.

### Formula
```
Score starts at 50 (neutral)

For each timeline event:
    normalizedImpact = impactScore / 20
    severityMult     = MAJOR: 3.0 | MINOR: 1.0
    
    if bearish:
        delta = -normalizedImpact × severityMult × 1.4  (bearish penalty)
    if bullish:
        delta = +normalizedImpact × severityMult
    
    if convictionDelta is set:
        delta += convictionDelta
    
    score = clamp(score + delta, 0, 100)

Every 6 hours (Time Decay):
    score = 50 + (score - 50) × 0.99
    // Drifts toward 50 (neutral) over time
```

### Posture Mapping

| Score | Posture |
|---|---|
| 80–100 | `strong_accumulate` |
| 60–79 | `accumulate` |
| 40–59 | `neutral` |
| 20–39 | `distribute` |
| 0–19 | `strong_distribute` |

### Trend Calculation
Compares last 7 days vs previous 7 days: `rising`, `falling`, or `stable`.

---

## Stage 5: Signal Management

**File:** `services/signalManager.service.ts`

### Signal Decision Logic (`decideSignalAction`)
For each coin, the system decides whether to:
- **CREATE** a new signal (no active signal exists)
- **UPGRADE** existing signal (same direction, stronger conviction)
- **REPLACE** existing signal (opposite direction)
- **SKIP** (no actionable verdict)

### TP/SL Calculation (`tpslCalculator.service.ts`)
Algorithmic TP/SL based on ATR and signal direction.

### TP/SL Monitoring (`tpslMonitor.cron.ts`)
Checks active signals every time it runs — closes signals when TP or SL is hit.

### Signal Performance Tracking (`signalPerformance.cron.ts`)
Every 6h, tracks P&L:
- **24h:** `price24h`, `pnl24h`
- **7d:** `price7d`, `pnl7d`, `isWin7d`
- **30d:** `price30d`, `pnl30d`, `isWin30d`

---

## Stage 6: Strategic Outlook

**File:** `services/strategicOutlook.service.ts`  
**Table:** `coin_strategic_outlook` (22 columns)

Forward-looking intelligence generated during AiWorkflow when:
- Classification is `MAJOR`
- `impactScore >= 70`
- Event is structural OR price moved >10% in 24h

**Output includes:** short-term direction/target/invalidation, long-term phase/bull probability/support/resistance, recommended action with rationale and risk management.

---

## Data Deduplication

### Exact Dedup (SHA-256)
Every headline gets a SHA-256 hash. Checked against `coin_news` and `raw_news_buffer` before any database write.

### Semantic Dedup (pgvector)
During AiWorkflow, new articles are embedded and compared against existing embeddings using cosine similarity. If similarity exceeds threshold → SKIP (already covered).

### Airdrop Dedup (Redis)
Airdrop RSS hunter uses Redis SET with SHA-256 hashes and 7-day TTL. Falls back to in-memory Set if Redis is unavailable.
