# OnlyAlpha Platform — Issues Analysis & Fix Plan

## Issue 1: Article Re-Processing (Same Article Appearing Multiple Times)

### Root Cause
The AI Workflow runs every hour and queries `rawNewsBuffer` for items with `relevanceScore >= threshold` and `processed = true`. The problem:

1. **`processed = true` means "triaged" not "consumed"** — The Triage Engine sets `processed = true` after scoring, but the AI Workflow never marks items as "consumed" after successfully publishing.
2. **Buffer items persist for 24+ hours** — The `bufferCleanup` cron only runs daily at midnight and only deletes items where `ttlExpiresAt < NOW()`.
3. **Duplicate detection catches exact re-posts** but the same buffered item (e.g., "US Government Moves Bitcoin...") keeps being selected every hourly cycle because it remains in the buffer with a high relevance score.
4. **Embedding similarity = 1.000** means it IS catching the duplicate, but the workflow still wastes cycles querying, computing embeddings, and logging it every hour.

The logs show the same 5 items being processed 10+ times:
```
[AI Workflow] Processing: BTC (MAJOR) — "US Government Moves Bitcoin Tied to $9 Billion Bitfinex Hack..."
[Similarity] Semantic duplicate found: id=29, similarity=1.000
[AI Workflow] Skipping duplicate: BTC
```

### Fix
After the AI Workflow successfully processes (publishes or skips as duplicate) a `rawNewsBuffer` item, we need to **mark it as consumed** so it's not re-selected in the next cycle.

---

## Issue 2: `metaDescription` Validation Failures (>160 chars)

### Root Cause
The `Stage2ASchema` requires `metaDescription.max(160)`, but the AI model often generates descriptions that exceed 160 characters. This causes:

```
[Stage2A] Schema validation failed (attempt 1): Too big: expected string to have <=160 characters
```

And then for the BTC ETF article, after 3 retries:
```
[AI Workflow] Failed for BTC: AI response truncated (finish_reason=length) for model "openai/gpt-5-nano"
```

### Fix
Add a **truncation safety net** — after parsing JSON, truncate `metaDescription` to 160 chars before Zod validation, rather than letting it fail and retry 3 times (wasting tokens and time).

---

## Issue 3: SEO Meta Tags Not Showing on Google

### Root Cause
From the Google screenshot, all pages show: `"Real-time AI market analysis, airdrop tracking and on-chain intelligence for serious traders."` — this is the **default description** from `layout.tsx`.

The per-coin pages (`/terminal/[coin]/page.tsx`) DO have `generateMetadata()` that fetches the master article's `metaTitle` and `metaDescription`. But the problem is:

1. **Many articles have poor/generic meta tags** — The fallback builder generates `"BTC Analysis | OnlyAlpha"` as metaTitle (too short) and generic descriptions.
2. **Some articles have null meta tags** — The `callGptNanoMasterUpdate` function IS allowed to update meta tags but doesn't always do so.
3. **Google caching** — Even if fixed now, Google may still show old descriptions until re-crawled.

### Fix
Create a **repair script** that:
1. Scans all `coinMasterArticles` for missing/poor meta tags
2. Regenerates proper SEO meta tags using the AI
3. Updates the database

---

## Implementation Plan

### Fix 1: Stop Re-Processing Consumed Items
**File**: `backend/src/crons/aiWorkflow.cron.ts`  
- Add a `consumed` column or use a new approach: after processing an item (published or skipped as duplicate), update the item in `rawNewsBuffer` to set its `relevanceScore` below threshold, or better — add a `consumed` boolean.
- Simpler approach: use a Set to track processed sourceHashes within the workflow, and filter them from the query.
- **Best approach**: Mark items with `processed = false` after consumption, or add a `consumed_at` timestamp column to `rawNewsBuffer` and exclude consumed items from the query.

### Fix 2: Truncate metaDescription Before Validation
**File**: `backend/src/services/openai.service.ts`  
- After JSON parse, before Zod validation: truncate `metaDescription` to 160 chars
- Also truncate `metaTitle` to 60 chars

### Fix 3: Repair Existing Meta Tags
**File**: `backend/src/scripts/repair-meta-tags.ts` (new)  
- Query all master articles
- For each: check if metaTitle/metaDescription are missing, too short, or generic
- Regenerate using AI and update the database
