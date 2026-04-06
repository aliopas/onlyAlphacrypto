# PHASE 6 — Resilience Layer

> **Depends on:** Phase 2 (data services) + Phase 5 (AI prompts).
> **Goal:** Protect the pipeline from external failures.
> **New files:** `circuitBreaker.service.ts`, `dynamicThreshold.service.ts`

---

## Task 6-A: Circuit Breaker

**New file:** `backend/src/services/circuitBreaker.service.ts`

### Class: `CircuitBreaker`

| Method | Returns | Description |
|--------|---------|-------------|
| `isOpen()` | `boolean` | Returns `true` if circuit is open (too many failures). Auto-resets after cooldown. |
| `recordFailure(service: string)` | `void` | Increments failure counter. Opens circuit at max failures. |
| `recordSuccess()` | `void` | Resets failure counter to 0. |

### Constructor Config:

```typescript
interface CircuitBreakerConfig {
    maxFailures?: number;   // Default: 5
    cooldownMs?: number;    // Default: 30 * 60 * 1000 (30 minutes)
}
```

### Logic:

**`isOpen()`:**
1. If `openUntil` is `null` → return `false` (circuit closed, healthy)
2. If `new Date() > openUntil` → cooldown expired, reset (`failures = 0`, `openUntil = null`), return `false`
3. Otherwise → return `true` (circuit still open)

**`recordFailure(service)`:**
1. Increment `failures`
2. `console.error(\`[CircuitBreaker] ${service} failure ${failures}/${maxFailures}\`)`
3. If `failures >= maxFailures`:
   - Set `openUntil = new Date(Date.now() + cooldownMs)`
   - `console.error(\`[CircuitBreaker] ${service} OPEN until ${openUntil.toISOString()}\`)`

**`recordSuccess()`:**
1. Set `failures = 0`

### Exported Singletons:

```typescript
export const binanceBreaker = new CircuitBreaker();
export const dexscreenerBreaker = new CircuitBreaker();
export const deepseekBreaker = new CircuitBreaker();
export const gptNanoBreaker = new CircuitBreaker();
```

---

## Task 6-B: Dynamic Triage Threshold

**New file:** `backend/src/services/dynamicThreshold.service.ts`

### Function 1: `getDynamicThreshold(): Promise<number>`

**Logic:**
1. Query `rawNewsBuffer` using Drizzle ORM:
   - Count rows where `relevanceScore >= 60` AND `retrievedAt > NOW() - INTERVAL '2 hours'`
2. Return threshold based on volume:
   - `< 5` items → `65` (quiet market, lower the bar)
   - `< 20` items → `70` (normal market)
   - `< 50` items → `78` (hot market, protect budget)
   - `>= 50` items → `85` (extreme, only the best)

### Drizzle ORM Query:
```typescript
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { gte, and, sql, count } from 'drizzle-orm';

const result = await db.select({ count: count() })
    .from(rawNewsBuffer)
    .where(and(
        gte(rawNewsBuffer.relevanceScore, 60),
        gte(rawNewsBuffer.retrievedAt, sql`NOW() - INTERVAL '2 hours'`)
    }));

const count = result[0].count;
```

### Function 2: `countPublishedLastHour(): Promise<number>`

**Logic:**
1. Query `coinNews` using Drizzle ORM:
   - Count rows where `createdAt > NOW() - INTERVAL '1 hour'`
2. Return the count as `number`

### Drizzle ORM Query:
```typescript
const result = await db.select({ count: count() })
    .from(coinNews)
    .where(gte(coinNews.createdAt, sql`NOW() - INTERVAL '1 hour'`));

return result[0].count;
```

---

### Prompt for Senior AI — Task 6-A:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/circuitBreaker.service.ts ===

CLASS: CircuitBreaker

Private fields:
- failures: number = 0
- openUntil: Date | null = null
- readonly maxFailures: number
- readonly cooldownMs: number

CONSTRUCTOR:
```typescript
constructor(config: { maxFailures?: number; cooldownMs?: number } = {}) {
    this.maxFailures = config.maxFailures ?? 5;
    this.cooldownMs = config.cooldownMs ?? 30 * 60 * 1000;
}
```

METHOD: isOpen(): boolean
```typescript
isOpen(): boolean {
    if (!this.openUntil) return false;
    if (new Date() > this.openUntil) {
        this.failures = 0;
        this.openUntil = null;
        return false;
    }
    return true;
}
```

METHOD: recordFailure(service: string): void
```typescript
recordFailure(service: string): void {
    this.failures++;
    console.error(`[CircuitBreaker] ${service} failure ${this.failures}/${this.maxFailures}`);
    if (this.failures >= this.maxFailures) {
        this.openUntil = new Date(Date.now() + this.cooldownMs);
        console.error(`[CircuitBreaker] ${service} OPEN until ${this.openUntil.toISOString()}`);
    }
}
```

METHOD: recordSuccess(): void
```typescript
recordSuccess(): void {
    this.failures = 0;
}
```

EXPORT 4 singletons at the bottom:
```typescript
export const binanceBreaker = new CircuitBreaker();
export const dexscreenerBreaker = new CircuitBreaker();
export const deepseekBreaker = new CircuitBreaker();
export const gptNanoBreaker = new CircuitBreaker();
```

Rules: ZERO `any` types. Clean OOP. No external dependencies.
```

### Prompt for Senior AI — Task 6-B:

```
You are the Senior Developer for OnlyAlpha. Create a new file.

=== NEW FILE: backend/src/services/dynamicThreshold.service.ts ===

IMPORTS:
```typescript
import { db } from '../config/db';
import { rawNewsBuffer, coinNews } from '../models/market.model';
import { gte, and, sql, count } from 'drizzle-orm';
```

FUNCTION 1: getDynamicThreshold(): Promise<number>

```typescript
export async function getDynamicThreshold(): Promise<number> {
    const result = await db.select({ count: count() })
        .from(rawNewsBuffer)
        .where(and(
            gte(rawNewsBuffer.relevanceScore, 60),
            gte(rawNewsBuffer.retrievedAt, sql`NOW() - INTERVAL '2 hours'`)
        }));

    const itemCount = result[0].count;

    if (itemCount < 5) return 65;
    if (itemCount < 20) return 70;
    if (itemCount < 50) return 78;
    return 85;
}
```

FUNCTION 2: countPublishedLastHour(): Promise<number>

```typescript
export async function countPublishedLastHour(): Promise<number> {
    const result = await db.select({ count: count() })
        .from(coinNews)
        .where(gte(coinNews.createdAt, sql`NOW() - INTERVAL '1 hour'`));

    return result[0].count;
}
```

Rules: ZERO `any` types. Use Drizzle ORM only (no raw SQL queries). `count()` from drizzle-orm handles the aggregation.
```

---

## Phase 6 Completion Checklist

- [ ] `circuitBreaker.service.ts` created with `CircuitBreaker` class
- [ ] 4 singleton breakers exported: `binanceBreaker`, `dexscreenerBreaker`, `deepseekBreaker`, `gptNanoBreaker`
- [ ] `dynamicThreshold.service.ts` created with `getDynamicThreshold()` and `countPublishedLastHour()`
- [ ] `getDynamicThreshold()` returns 65/70/78/85 based on volume
- [ ] Both files use Drizzle ORM with proper imports
- [ ] Zero `any` types
