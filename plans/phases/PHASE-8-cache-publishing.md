# PHASE 8 — Cache & Publishing Layer

> **Depends on:** Phase 7 (workflow wired).
> **Goal:** Safe JSON parsing with Zod + targeted Redis invalidation + shared instances.
> **Modified:** `ai-gateway.ts`, `openai.service.ts`, `redis.ts`, `article-publisher.ts`

---

## Task 8-A: Add `chatRaw()` Method to AIGateway

**File:** `backend/src/services/ai/ai-gateway.ts`

### New Method:

```typescript
async chatRaw(params: {
    model: string;
    messages: OpenAI.ChatCompletionMessageParam[];
    temperature?: number;
    responseFormat?: { type: 'json_object' };
}): Promise<string> {
    const response = await this._client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        response_format: params.responseFormat,
    });

    const content = response.choices[0].message.content;
    if (!content) {
        throw new Error('Empty response from AI gateway');
    }

    return content;
}
```

This returns the raw string content instead of parsing it as JSON. Needed for Zod validation in Phase 8-B.

---

## Task 8-B: Zod Validation on callGptNanoWriter

**File:** `backend/src/services/openai.service.ts`

### Changes to `callGptNanoWriter()`:

Replace the existing `callGptNanoWriter` with a Zod-validated version that:
1. Uses `gateway.chatRaw()` instead of `gateway.chat()` (gets raw string)
2. Parses JSON manually
3. Validates with Zod `ArticleSchema`
4. Retries up to 3 times on parse or validation failure

### Zod Schema:

```typescript
import { z } from 'zod';

const ArticleSchema = z.object({
    headline: z.string().max(120),
    hook: z.string(),
    fullArticle: z.string().min(800),
    metaTitle: z.string().max(60),
    metaDescription: z.string().max(160),
    seoKeywords: z.array(z.string()).length(5),
});
```

### Updated Function:

```typescript
export async function callGptNanoWriter(analysisJson: string, attempt: number = 1): Promise<ArticleWriterResult> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleWriterMessages(analysisJson);
    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
        messages,
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[GPT-nano] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, attempt + 1);
        throw new Error('GPT-nano returned invalid JSON after 3 attempts');
    }

    const result = ArticleSchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[GPT-nano] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, attempt + 1);
        throw new Error('GPT-nano response failed schema validation after 3 attempts');
    }

    return result.data;
}
```

### Important:
- Add `import { z } from 'zod';` at the top
- The `ArticleSchema` should be defined at module level (not inside the function)
- The recursive retry calls itself with `attempt + 1`
- First check `npm install zod` — if not installed, add it

---

## Task 8-C: Add `deleteCachePattern()` to Redis

**File:** `backend/src/config/redis.ts`

### New Helper:

```typescript
export async function deleteCachePattern(pattern: string): Promise<void> {
    if (!redis) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}
```

This uses `KEYS` + `DEL` instead of `FLUSHALL`. Safe for targeted invalidation.

---

## Task 8-D: Fix article-publisher.ts — Use Shared Instances

**File:** `backend/src/services/ai/article-publisher.ts`

### Problem:
Currently creates its OWN instances of `PromptFactory`, `AIGateway`, and `CacheManager` (lines 19-29). This is wasteful and breaks the single-instance pattern.

### Fix:

1. **Remove** the local instantiation of `PromptFactory`, `AIGateway`, and `CacheManager`
2. **Import** the shared instances from `openai.service.ts`

### Required exports from openai.service.ts:

Add these exports at the bottom of `openai.service.ts`:
```typescript
export { gateway };
export { prompts };
export { cache as aiCache };
```

### Updated article-publisher.ts imports:

```typescript
import { db } from '../../config/db';
import { coinNews, radarSignals } from '../../models/market.model';
import { createHash } from 'crypto';
import { gateway, prompts } from './ai-gateway';
import { env } from '../../config/env';
import { eq } from 'drizzle-orm';
import type { DeepSynthesisResult } from '../openai.service';
```

Wait — `gateway` and `prompts` are not exported from ai-gateway.ts or prompt-factory.ts as instances. They are created in openai.service.ts as module-level `const`. So we need to export them FROM openai.service.ts:

```typescript
// At bottom of openai.service.ts:
export { gateway };
export { prompts };
```

### Updated article-publisher.ts:
```typescript
import { gateway, prompts } from './openai.service';
```

And remove lines 19-29 (the local `new PromptFactory()`, `new AIGateway()`, `new CacheManager()`).

---

### Prompt for Senior AI — Task 8:

```
You are the Senior Developer for OnlyAlpha. Make precise changes across 4 files.

=== FILE 1: backend/src/services/ai/ai-gateway.ts ===

ADD a new method `chatRaw()` after the existing `chat()` method:

```typescript
async chatRaw(params: {
    model: string;
    messages: OpenAI.ChatCompletionMessageParam[];
    temperature?: number;
    responseFormat?: { type: 'json_object' };
}): Promise<string> {
    const response = await this._client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        response_format: params.responseFormat,
    });

    const content = response.choices[0].message.content;
    if (!content) {
        throw new Error('Empty response from AI gateway');
    }

    return content;
}
```

This returns raw string content instead of parsing as JSON.

=== FILE 2: backend/src/services/openai.service.ts ===

STEP 1: Add zod import at the top:
```typescript
import { z } from 'zod';
```

STEP 2: Add Zod schema at module level (after interfaces, before the module instances):
```typescript
const ArticleSchema = z.object({
    headline: z.string().max(120),
    hook: z.string(),
    fullArticle: z.string().min(800),
    metaTitle: z.string().max(60),
    metaDescription: z.string().max(160),
    seoKeywords: z.array(z.string()).length(5),
});
```

STEP 3: REPLACE the existing callGptNanoWriter function with this Zod-validated version:

```typescript
export async function callGptNanoWriter(analysisJson: string, attempt: number = 1): Promise<ArticleWriterResult> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleWriterMessages(analysisJson);
    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
        messages,
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[GPT-nano] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, attempt + 1);
        throw new Error('GPT-nano returned invalid JSON after 3 attempts');
    }

    const result = ArticleSchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[GPT-nano] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, attempt + 1);
        throw new Error('GPT-nano response failed schema validation after 3 attempts');
    }

    return result.data;
}
```

STEP 4: Export the shared instances at the bottom of the file:
```typescript
export { gateway, prompts };
```

DO NOT modify any other existing functions.

=== FILE 3: backend/src/config/redis.ts ===

ADD a new helper function after the existing `deleteCache` function:

```typescript
export async function deleteCachePattern(pattern: string): Promise<void> {
    if (!redis) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}
```

=== FILE 4: backend/src/services/ai/article-publisher.ts ===

STEP 1: REPLACE the imports section. REMOVE:
- `import { PromptFactory } from './prompt-factory';`
- `import { AIGateway } from './ai-gateway';`
- `import { CacheManager } from './cache-manager';`

ADD:
- `import { gateway, prompts } from './openai.service';`

STEP 2: REMOVE lines 19-29 (the local instantiation block):
```typescript
const promptFactory = new PromptFactory();
const gateway = new AIGateway({ ... });
const cache = new CacheManager();
```

STEP 3: UPDATE line 31 to use the shared `prompts` instance:
FROM: `const seoMessages = promptFactory.buildArticleSEOMessages(...)`
TO: `const seoMessages = prompts.buildArticleSEOMessages(...)`

STEP 4: UPDATE line 32 to use the shared `gateway` instance:
FROM: `const seoResult = await gateway.chat<ArticleSEOResult>({ ... });`
TO: This stays the same since `gateway` is now imported from openai.service.ts

Rules: ZERO `any` types. Install zod if not present: `npm install zod`. Do NOT modify any other files.
```

---

## Phase 8 Completion Checklist

- [ ] `chatRaw()` method added to `ai-gateway.ts`
- [ ] `zod` installed as dependency
- [ ] `ArticleSchema` defined with Zod (min 800 chars, max title/meta limits)
- [ ] `callGptNanoWriter()` uses `chatRaw()` + Zod validation + 3-attempt retry
- [ ] `deleteCachePattern()` added to `redis.ts`
- [ ] `article-publisher.ts` uses shared `gateway` and `prompts` from `openai.service.ts`
- [ ] Local instantiation removed from `article-publisher.ts`
- [ ] Shared instances exported from `openai.service.ts`
- [ ] All existing functions unchanged
- [ ] Zero `any` types
