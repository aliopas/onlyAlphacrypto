# OnlyAlpha — Phase 6: Bug Fixes (Re-Processing, Meta Truncation, SEO Repair)

**Architect:** THE ARCHITECT (GLM-5-Turbo)
**Date:** April 18, 2026
**Status:** v2 — Pending Supreme Reviewer Re-Audit
**Issue Source:** `plans/THE SUPREME REVIEWER_plans/revio.md`
**Audit History:** v1 REJECTED — 3 corrections applied (edge-case exits, TS2571, Zod bypass)

---

## Scope

Three production bugs identified by the Supreme Reviewer:

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Article re-processing (same items queried every hour) | HIGH | Wasted AI cycles, noisy logs, embedding computation waste |
| 2 | `metaDescription` validation failures (>160 chars) | MEDIUM | Wasted tokens, retries, occasional article failure |
| 3 | SEO meta tags not showing on Google | LOW | Poor organic SEO, generic descriptions in SERPs |

---

## Fix 1: Stop Re-Processing Consumed Buffer Items

### Root Cause Analysis
- `rawNewsBuffer` already has a `consumed: boolean` column (`market.model.ts:79`) — but it is **never written to** by `aiWorkflow.cron.ts`.
- The two DB queries (lines 139-148 and 150-161) filter only by `processed = true`, `relevanceScore >= threshold`, and symbol conditions — they do **NOT** exclude `consumed = true`.
- Duplicate detection via embeddings catches the same item, but only after wasting cycles (embedding computation + similarity check).

### Architecture

**File:** `backend/src/crons/aiWorkflow.cron.ts`

#### 6.1 — Exclude consumed items from both queries
Add `eq(rawNewsBuffer.consumed, false)` to BOTH `.where()` clauses (lines 141-146 and 152-158).

**Before (line 141-146):**
```ts
.where(and(
    gte(rawNewsBuffer.relevanceScore, threshold),
    eq(rawNewsBuffer.processed, true),
    isNotNull(rawNewsBuffer.symbolMentions),
    ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
))
```

**After:**
```ts
.where(and(
    gte(rawNewsBuffer.relevanceScore, threshold),
    eq(rawNewsBuffer.processed, true),
    eq(rawNewsBuffer.consumed, false),
    isNotNull(rawNewsBuffer.symbolMentions),
    ne(rawNewsBuffer.symbolMentions, sql`'[]'::jsonb`)
))
```

Same for the `itemsWithoutSymbols` query.

#### 6.2 — Mark items as consumed at ALL exit points

Six exit points where an item should be marked consumed (failure to do so causes infinite re-processing loops):

1. **No symbol found** (line 180-183): `inferSymbolFromTitle` returns null, `continue` is hit. Must mark consumed.
2. **NOISE classification** (line 208-211): Item classified as noise, `continue` is hit. Must mark consumed.
3. **MINOR with no master article** (line 214-217): No existing master for MINOR, `continue` is hit. Must mark consumed.
4. **Duplicate skip** (line 201-203): `isDuplicateByEmbedding` returns true, `continue` is hit. Must mark consumed.
5. **MINOR path success** (after line 243): After `storeEmbedding`, mark consumed before `continue`.
6. **MAJOR path success** (after line 480): After the "Published" log line, mark consumed.

**Implementation — helper function:**
```ts
async function markBufferItemConsumed(bufferId: number): Promise<void> {
    await db.update(rawNewsBuffer)
        .set({ consumed: true })
        .where(eq(rawNewsBuffer.id, bufferId));
}
```

**Insert `markBufferItemConsumed(item.id)` at each of the 6 exit points above.**

#### 6.3 — NO schema changes needed
The `consumed` column already exists in `rawNewsBuffer`. No migration required.

---

## Fix 2: Truncate Meta Tags Before Zod Validation

### Root Cause Analysis
- `Stage2ASchema` (line 124-125) enforces `metaTitle.max(60)` and `metaDescription.max(160)`.
- `ArticleSchema` (line 116-117) has the same constraints.
- When AI generates longer strings, `safeParse` fails → retry loop (up to 3) → wasted tokens.
- `callWriterStage2A` and `callWriterStage2B` return `null` on failure (no retry), causing fallback to deprecated `callGptNanoWriter`.

### Architecture

**File:** `backend/src/services/openai.service.ts`

#### 6.4 — Add truncation helper function
Place near the top of the file (after imports, before the schemas):

```ts
function truncateMetaField(value: unknown, maxLength: number): unknown {
    if (typeof value === 'string') {
        return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
    }
    return value;
}
```

**Design note:** Returns `unknown` (not `string`) so that non-string values (objects, numbers) are passed through untouched to Zod, which will catch the type mismatch and trigger a retry. Coercing to `''` would silently bypass Zod's type validation.

#### 6.5 — Apply truncation before Zod validation in `callGptNanoWriter`
After `JSON.parse(raw)` (line 373) and before `ArticleSchema.safeParse(parsed)` (line 380):

```ts
if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    obj.metaTitle = truncateMetaField(obj.metaTitle, 60);
    obj.metaDescription = truncateMetaField(obj.metaDescription, 160);
}
```

**Design note:** `parsed` is declared as `let parsed: unknown` (line 371). Direct property access causes TS2571. The type guard `typeof parsed === 'object'` narrows it, then `as Record<string, unknown>` allows safe mutation without violating the strict type system.

#### 6.6 — Apply truncation before Zod validation in `callWriterStage2A`
After `JSON.parse(raw)` (line 458) and before `Stage2ASchema.safeParse(parsed)` (line 466):

```ts
if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    obj.metaTitle = truncateMetaField(obj.metaTitle, 60);
    obj.metaDescription = truncateMetaField(obj.metaDescription, 160);
}
```

#### 6.7 — Apply truncation before Zod validation in `callWriterStage2B`
`Stage2BSchema` does NOT contain metaTitle/metaDescription, so **no change needed** for this function.

#### 6.8 — Apply truncation in `callGptNanoMasterUpdate` (manual field filtering)
After the `ALLOWED_SECTIONS` filter loop (after line 647), before `return filtered`:

```ts
filtered.metaTitle = truncateMetaField(filtered.metaTitle, 60);
filtered.metaDescription = truncateMetaField(filtered.metaDescription, 160);
return filtered;
```

**Design note:** `filtered` is already typed as `Record<string, unknown>` (line 641), so no type guard is needed here. Direct property assignment is safe.

---

## Fix 3: Repair Existing Meta Tags (New Script)

### Root Cause Analysis
- Many `coinMasterArticles` rows have `null`, empty, or generic `metaTitle`/`metaDescription`.
- Generic patterns: `"BTC Analysis | OnlyAlpha"`, `"Read the analysis on OnlyAlpha."`, or strings shorter than 30 chars.
- No mechanism to retroactively fix these.

### Architecture

**File:** `backend/src/scripts/repair-meta-tags.ts` (NEW — follows kebab-case naming convention from existing scripts)

#### 6.9 — Create `repair-meta-tags.ts`

**Structure** (follows pattern of `repair-incomplete-articles.ts`):

```ts
// Imports
import { db } from '../config/db';
import { coinMasterArticles } from '../models/market.model';
import { eq } from 'drizzle-orm';
import { callGptNanoMasterUpdate } from '../services/openai.service';
import { migrationFlags } from '../models/market.model';
import { DeepAnalysisResult } from '../services/openai.service';

// Constants
const GENERIC_TITLE_PATTERNS = ['Analysis | OnlyAlpha', '| OnlyAlpha'];
const GENERIC_DESC_PATTERNS = ['Read the analysis on OnlyAlpha.', 'market analysis:'];
const MIN_TITLE_LENGTH = 20;
const MIN_DESC_LENGTH = 40;
const DELAY_BETWEEN_COINS_MS = 5000;

// Detection function
function isMetaTagPoor(title: string | null, description: string | null): boolean {
    if (!title || title.trim().length < MIN_TITLE_LENGTH) return true;
    if (GENERIC_TITLE_PATTERNS.some(p => title.includes(p))) return true;
    if (!description || description.trim().length < MIN_DESC_LENGTH) return true;
    if (GENERIC_DESC_PATTERNS.some(p => description.includes(p))) return true;
    return false;
}

// Find articles with poor meta tags
async function findPoorMetaArticles(): Promise<typeof coinMasterArticles.$inferSelect[]> {
    const allRows = await db.select().from(coinMasterArticles);
    return allRows.filter(row => isMetaTagPoor(row.metaTitle, row.metaDescription));
}

// Repair single coin — use callGptNanoMasterUpdate to regenerate meta tags
async function repairCoinMeta(coin: typeof coinMasterArticles.$inferSelect): Promise<boolean> {
    // Build a minimal DeepAnalysisResult stub from existing master article data
    // Call callGptNanoMasterUpdate() which returns updated metaTitle/metaDescription
    // Update the DB
    // Return success/failure
}

// Main runner (with migration flag pattern from repair-incomplete-articles.ts)
export async function runMetaTagRepair(): Promise<{ repaired: number; failed: number }> {
    // FLAG_NAME = 'repair_meta_tags_v1'
    // Follow same pattern: check flag → find poor articles → repair → set flag
}

// CLI entry point (if require.main === module)
```

**Key design decisions:**
- Reuse `callGptNanoMasterUpdate` to regenerate meta tags (it already handles `metaTitle`/`metaDescription` updates).
- Pass a minimal `DeepAnalysisResult` stub built from the existing `coinMasterArticles` row (verdict, sentiment, confidenceScore, etc. are already stored).
- Migration flag (`repair_meta_tags_v1`) ensures it only runs once.
- `CONCURRENCY_LIMIT = 2` with 5-second delay between coins (rate limiting).

---

## Task Summary

| Task ID | File | Action | Scope |
|---------|------|--------|-------|
| 6.1 | `aiWorkflow.cron.ts` | Add `eq(consumed, false)` to both queries | 1-line edit × 2 |
| 6.2 | `aiWorkflow.cron.ts` | Add `markBufferItemConsumed()` helper + 6 insert points (3 early-exit + duplicate + MINOR + MAJOR) | ~20 lines |
| 6.4 | `openai.service.ts` | Add `truncateMetaField()` helper (returns `unknown`, no coercion) | 5 lines |
| 6.5 | `openai.service.ts` | Type-guard + truncate before `ArticleSchema.safeParse` | 5 lines |
| 6.6 | `openai.service.ts` | Type-guard + truncate before `Stage2ASchema.safeParse` | 5 lines |
| 6.8 | `openai.service.ts` | Truncate in `callGptNanoMasterUpdate` filtered result | 2 lines |
| 6.9 | `scripts/repair-meta-tags.ts` | New file — meta tag repair script | ~120 lines (new file) |

**Total: 1 file edited (aiWorkflow.cron.ts), 1 file edited (openai.service.ts), 1 new file (repair-meta-tags.ts)**

**No route/controller changes. No schema/migration changes. No new dependencies.**

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `consumed` column might not exist in production DB | Already confirmed in `market.model.ts:79` with `default(false).notNull()` — safe. |
| Items looping forever due to missed exit points | All 6 exit points covered (no-symbol, NOISE, MINOR-no-master, duplicate, MINOR-done, MAJOR-done). |
| `parsed` is `unknown` — TS2571 on property access | Type guard `typeof parsed === 'object'` + `as Record<string, unknown>` before mutation. |
| Truncation silently bypassing Zod type validation | `truncateMetaField` returns `unknown` — non-strings pass through untouched, Zod catches them. |
| Truncation might cut important keywords from meta tags | 60/160 chars are SEO best practices; truncation is a safety net, not the primary control. Prompts already instruct MAX lengths. |
| Repair script might overwrite good meta tags | Detection function checks for generic patterns + minimum length thresholds before qualifying for repair. |
| Rate limiting on repair script | 5-second delay between coins, max 2 concurrent. Same pattern as `repair-incomplete-articles.ts`. |

---

## Verification Plan
- `npx tsc --noEmit` — zero TypeScript errors (both backend and frontend)
- Manual: check `rawNewsBuffer` after workflow run — consumed items should have `consumed = true`
- Manual: check `coinMasterArticles` after repair script — all rows should have meaningful meta tags
