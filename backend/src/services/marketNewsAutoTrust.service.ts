/**
 * DEC-043 B2 — Auto-trust + semantic dedup + triage reuse for market_news_items.
 * Does not replace admin manual trust PATCH.
 */
import { and, eq, lt, sql, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
    marketNewsItems,
    marketContextSnapshots,
    type MarketNewsClassification,
    type MarketNewsItem,
} from '../models/marketContext.model';
import { generateLightweightTriage } from './openai.service';
import {
    findMarketNewsSemanticDuplicate,
    storeMarketNewsEmbedding,
} from './embedding.service';
import { logger } from '../utils/logger';

export const AUTO_TRUST_TIMEOUT_TAG = 'auto-trusted-after-timeout';
export const AUTO_TRUST_SEMANTIC_DUP_TAG = 'semantic-duplicate';
export const AUTO_TRUST_NOISE_TAG = 'auto-rejected-noise';
export const AUTO_TRUST_MINOR_TAG = 'auto-trusted-minor';
export const AUTO_TRUST_MAJOR_TAG = 'auto-trusted-major';
export const AUTO_TRUST_SEVERITY3_PENDING_TAG = 'severity3-review-queue';
export const AUTO_TRUST_FULL_AUTO_TAG = 'full-auto-coin-intent';

export type MarketNewsAutoTrustAction =
    | 'skipped'
    | 'semantic_rejected'
    | 'triaged'
    | 'rejected_noise'
    | 'trusted'
    | 'pending_review'
    | 'full_auto_intent';

export interface MarketNewsAutoTrustResult {
    newsId: number;
    action: MarketNewsAutoTrustAction;
    trust?: MarketNewsItem['trust'];
    classification?: MarketNewsClassification | null;
    note?: string;
}

export interface ProcessPendingAutoTrustSummary {
    processed: number;
    trusted: number;
    rejected: number;
    pendingReview: number;
    fullAutoIntents: number;
    semanticRejected: number;
    timedOut: number;
    errors: number;
}

function classificationOf(value: string | null | undefined): MarketNewsClassification | null {
    if (value === 'MAJOR' || value === 'MINOR' || value === 'NOISE') return value;
    return null;
}

function embedTextForItem(item: Pick<MarketNewsItem, 'title' | 'body'>): string {
    const body = item.body?.trim() ? item.body.trim().slice(0, 800) : '';
    return body ? `${item.title}\n${body}` : item.title;
}

/**
 * Activity / intent log line (dashboard-only; no Telegram).
 * B5 can surface these from Winston / admin audit later.
 */
export function logMarketContextActivity(
    event: string,
    payload: Record<string, unknown>
): void {
    logger.info('[MarketContextActivity] %s %s', event, JSON.stringify(payload));
}

export async function hasPublishedCoinPage(symbol: string): Promise<boolean> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return false;

    const rows = await db
        .select({ id: marketContextSnapshots.id })
        .from(marketContextSnapshots)
        .where(
            and(
                eq(marketContextSnapshots.kind, 'coin'),
                eq(marketContextSnapshots.symbol, sym),
                eq(marketContextSnapshots.status, 'published')
            )
        )
        .limit(1);

    return rows.length > 0;
}

/**
 * Safe stub / hook for full-auto coin generation (B3 wires real generator).
 * Called when MAJOR + severity=3 and no published coin page exists.
 */
export type FullAutoCoinHandler = (input: {
    symbol: string;
    newsId: number;
    title: string;
}) => Promise<void>;

let fullAutoCoinHandler: FullAutoCoinHandler | null = null;

export function registerFullAutoCoinHandler(handler: FullAutoCoinHandler): void {
    fullAutoCoinHandler = handler;
}

async function ensureFullAutoHandlerRegistered(): Promise<void> {
    if (fullAutoCoinHandler) return;
    try {
        // Lazy boot path: ingest may run before/without admin controller load
        const mod = await import('./coinBlogGenerator.service');
        mod.wireFullAutoCoinHandler();
    } catch (err) {
        logger.warn(
            '[MarketNewsAutoTrust] failed to lazy-wire full-auto handler: %s',
            err instanceof Error ? err.message : String(err)
        );
    }
}

async function invokeFullAutoCoin(input: {
    symbol: string;
    newsId: number;
    title: string;
}): Promise<void> {
    logMarketContextActivity('full_auto_coin_intent', {
        symbol: input.symbol,
        newsId: input.newsId,
        title: input.title,
        handlerRegistered: Boolean(fullAutoCoinHandler),
    });

    if (!env.MARKET_CONTEXT_FULL_AUTO_COIN_ENABLED) {
        logger.info(
            '[MarketNewsAutoTrust] full-auto coin disabled — intent logged only symbol=%s newsId=%d',
            input.symbol,
            input.newsId
        );
        return;
    }

    await ensureFullAutoHandlerRegistered();

    if (!fullAutoCoinHandler) {
        logger.warn(
            '[MarketNewsAutoTrust] full-auto handler not registered — stub only symbol=%s newsId=%d',
            input.symbol,
            input.newsId
        );
        return;
    }

    try {
        await fullAutoCoinHandler(input);
    } catch (err) {
        logger.error(
            '[MarketNewsAutoTrust] full-auto coin failed symbol=%s newsId=%d: %s',
            input.symbol,
            input.newsId,
            err instanceof Error ? err.message : String(err)
        );
    }
}

async function applySemanticDedup(item: MarketNewsItem): Promise<'ok' | 'duplicate'> {
    const threshold = env.MARKET_CONTEXT_SEMANTIC_DEDUP_THRESHOLD;
    const text = embedTextForItem(item);

    const dup = await findMarketNewsSemanticDuplicate(text, item.id, threshold);
    if (dup.isDuplicate) {
        await db
            .update(marketNewsItems)
            .set({
                trust: 'rejected',
                trustNote: `${AUTO_TRUST_SEMANTIC_DUP_TAG}:id=${dup.duplicateId}:sim=${dup.similarity.toFixed(3)}`,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, item.id));

        logMarketContextActivity('semantic_duplicate_rejected', {
            newsId: item.id,
            duplicateId: dup.duplicateId,
            similarity: dup.similarity,
        });
        return 'duplicate';
    }

    await storeMarketNewsEmbedding(item.id, text);
    return 'ok';
}

async function triageIfNeeded(item: MarketNewsItem): Promise<MarketNewsItem> {
    if (classificationOf(item.classification)) {
        return item;
    }

    const batch = [
        {
            title: item.title,
            source: item.sourceName ?? item.sourceType,
        },
    ];
    const results = await generateLightweightTriage(batch);
    const t = results[0];
    if (!t) return item;

    const classification = classificationOf(t.classification) ?? 'MINOR';
    const eventSeverity = Math.max(1, Math.min(3, Math.round(t.eventSeverity || 1)));
    const relevanceScore = Math.max(0, Math.min(100, Math.round(t.relevanceScore || 50)));
    const symbolsFromTriage = Array.isArray(t.symbolMentions)
        ? t.symbolMentions.map((s) => s.toUpperCase())
        : [];
    const existingSymbols = Array.isArray(item.symbols) ? item.symbols : [];
    const mergedSymbols = Array.from(
        new Set([...existingSymbols.map((s) => s.toUpperCase()), ...symbolsFromTriage])
    );

    const updated = await db
        .update(marketNewsItems)
        .set({
            classification,
            eventSeverity,
            relevanceScore,
            symbols: mergedSymbols.length > 0 ? mergedSymbols : existingSymbols,
            updatedAt: new Date(),
        })
        .where(eq(marketNewsItems.id, item.id))
        .returning();

    return updated[0] ?? item;
}

/**
 * Auto-trust rules (DEC-043 §4). Manual admin trust remains authoritative afterward.
 */
export async function applyAutoTrustRules(
    item: MarketNewsItem
): Promise<MarketNewsAutoTrustResult> {
    const classification = classificationOf(item.classification);
    const relevance =
        typeof item.relevanceScore === 'number' ? item.relevanceScore : 50;
    const severity =
        typeof item.eventSeverity === 'number' ? item.eventSeverity : 1;
    const symbols = Array.isArray(item.symbols)
        ? item.symbols.map((s) => s.toUpperCase()).filter(Boolean)
        : [];

    const minorMin = env.MARKET_CONTEXT_AUTO_TRUST_MINOR_MIN_SCORE;
    const majorMin = env.MARKET_CONTEXT_AUTO_TRUST_MAJOR_MIN_SCORE;

    if (classification === 'NOISE') {
        await db
            .update(marketNewsItems)
            .set({
                trust: 'rejected',
                trustNote: item.trustNote ?? AUTO_TRUST_NOISE_TAG,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, item.id));
        return {
            newsId: item.id,
            action: 'rejected_noise',
            trust: 'rejected',
            classification,
            note: AUTO_TRUST_NOISE_TAG,
        };
    }

    if (classification === 'MINOR' && relevance >= minorMin) {
        await db
            .update(marketNewsItems)
            .set({
                trust: 'trusted',
                trustNote: item.trustNote ?? AUTO_TRUST_MINOR_TAG,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, item.id));
        return {
            newsId: item.id,
            action: 'trusted',
            trust: 'trusted',
            classification,
            note: AUTO_TRUST_MINOR_TAG,
        };
    }

    if (classification === 'MAJOR' && relevance >= majorMin && severity < 3) {
        await db
            .update(marketNewsItems)
            .set({
                trust: 'trusted',
                trustNote: item.trustNote ?? AUTO_TRUST_MAJOR_TAG,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, item.id));
        return {
            newsId: item.id,
            action: 'trusted',
            trust: 'trusted',
            classification,
            note: AUTO_TRUST_MAJOR_TAG,
        };
    }

    if (classification === 'MAJOR' && severity === 3) {
        const primarySymbol = symbols[0] ?? null;

        if (primarySymbol) {
            const published = await hasPublishedCoinPage(primarySymbol);
            if (published) {
                await db
                    .update(marketNewsItems)
                    .set({
                        trust: 'pending',
                        trustNote: item.trustNote ?? AUTO_TRUST_SEVERITY3_PENDING_TAG,
                        updatedAt: new Date(),
                    })
                    .where(eq(marketNewsItems.id, item.id));
                return {
                    newsId: item.id,
                    action: 'pending_review',
                    trust: 'pending',
                    classification,
                    note: AUTO_TRUST_SEVERITY3_PENDING_TAG,
                };
            }

            await db
                .update(marketNewsItems)
                .set({
                    trust: 'trusted',
                    trustNote: item.trustNote ?? AUTO_TRUST_FULL_AUTO_TAG,
                    updatedAt: new Date(),
                })
                .where(eq(marketNewsItems.id, item.id));

            await invokeFullAutoCoin({
                symbol: primarySymbol,
                newsId: item.id,
                title: item.title,
            });

            return {
                newsId: item.id,
                action: 'full_auto_intent',
                trust: 'trusted',
                classification,
                note: AUTO_TRUST_FULL_AUTO_TAG,
            };
        }

        // MAJOR severity 3 without symbol → leave pending for admin
        await db
            .update(marketNewsItems)
            .set({
                trust: 'pending',
                trustNote: item.trustNote ?? AUTO_TRUST_SEVERITY3_PENDING_TAG,
                updatedAt: new Date(),
            })
            .where(eq(marketNewsItems.id, item.id));
        return {
            newsId: item.id,
            action: 'pending_review',
            trust: 'pending',
            classification,
            note: AUTO_TRUST_SEVERITY3_PENDING_TAG,
        };
    }

    // Default: leave pending (does not override admin decisions later)
    return {
        newsId: item.id,
        action: 'skipped',
        trust: item.trust,
        classification,
    };
}

/**
 * Post-insert pipeline for a single news row:
 * semantic dedup → triage (if needed) → auto-trust rules.
 * Skips items already trusted/rejected by admin (trust !== pending) unless force.
 */
export async function processNewsItemAutoTrust(
    newsId: number,
    options?: { force?: boolean }
): Promise<MarketNewsAutoTrustResult> {
    if (!env.MARKET_CONTEXT_ENABLED || !env.MARKET_CONTEXT_AUTO_TRUST_ENABLED) {
        return { newsId, action: 'skipped', note: 'auto_trust_disabled' };
    }

    const rows = await db
        .select()
        .from(marketNewsItems)
        .where(eq(marketNewsItems.id, newsId))
        .limit(1);

    if (rows.length === 0) {
        return { newsId, action: 'skipped', note: 'not_found' };
    }

    let item = rows[0];

    if (!options?.force && item.trust !== 'pending') {
        return {
            newsId,
            action: 'skipped',
            trust: item.trust,
            note: 'already_resolved',
        };
    }

    try {
        const dedup = await applySemanticDedup(item);
        if (dedup === 'duplicate') {
            return {
                newsId,
                action: 'semantic_rejected',
                trust: 'rejected',
                note: AUTO_TRUST_SEMANTIC_DUP_TAG,
            };
        }

        // reload after possible embedding write
        const refreshed = await db
            .select()
            .from(marketNewsItems)
            .where(eq(marketNewsItems.id, newsId))
            .limit(1);
        item = refreshed[0] ?? item;

        item = await triageIfNeeded(item);
        return await applyAutoTrustRules(item);
    } catch (err) {
        logger.error(
            '[MarketNewsAutoTrust] process failed id=%d: %s',
            newsId,
            err instanceof Error ? err.message : String(err)
        );
        return {
            newsId,
            action: 'skipped',
            note: err instanceof Error ? err.message : String(err),
        };
    }
}

/**
 * Batch process recently inserted pending items missing classification / still pending.
 */
export async function processPendingMarketNewsAutoTrust(
    limit = 40
): Promise<ProcessPendingAutoTrustSummary> {
    const summary: ProcessPendingAutoTrustSummary = {
        processed: 0,
        trusted: 0,
        rejected: 0,
        pendingReview: 0,
        fullAutoIntents: 0,
        semanticRejected: 0,
        timedOut: 0,
        errors: 0,
    };

    if (!env.MARKET_CONTEXT_ENABLED || !env.MARKET_CONTEXT_AUTO_TRUST_ENABLED) {
        return summary;
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // Prefer unclassified pending; also re-check pending with classification already set
    const pending = await db
        .select()
        .from(marketNewsItems)
        .where(eq(marketNewsItems.trust, 'pending'))
        .orderBy(sql`${marketNewsItems.createdAt} DESC`)
        .limit(safeLimit);

    // Batch triage for items missing classification (reuse generateLightweightTriage)
    const needsTriage = pending.filter((p) => !classificationOf(p.classification));
    if (needsTriage.length > 0) {
        const BATCH = 10;
        for (let i = 0; i < needsTriage.length; i += BATCH) {
            const chunk = needsTriage.slice(i, i + BATCH);
            try {
                const triaged = await generateLightweightTriage(
                    chunk.map((c) => ({
                        title: c.title,
                        source: c.sourceName ?? c.sourceType,
                    }))
                );
                for (let j = 0; j < chunk.length; j++) {
                    const t = triaged[j];
                    if (!t) continue;
                    const classification = classificationOf(t.classification) ?? 'MINOR';
                    const eventSeverity = Math.max(
                        1,
                        Math.min(3, Math.round(t.eventSeverity || 1))
                    );
                    const relevanceScore = Math.max(
                        0,
                        Math.min(100, Math.round(t.relevanceScore || 50))
                    );
                    const symbolsFromTriage = Array.isArray(t.symbolMentions)
                        ? t.symbolMentions.map((s) => s.toUpperCase())
                        : [];
                    const rawSymbols = chunk[j].symbols;
                    const existing: string[] = Array.isArray(rawSymbols) ? rawSymbols : [];
                    const merged = Array.from(
                        new Set([
                            ...existing.map((s) => s.toUpperCase()),
                            ...symbolsFromTriage,
                        ])
                    );
                    await db
                        .update(marketNewsItems)
                        .set({
                            classification,
                            eventSeverity,
                            relevanceScore,
                            symbols: merged.length > 0 ? merged : existing,
                            updatedAt: new Date(),
                        })
                        .where(eq(marketNewsItems.id, chunk[j].id));
                }
            } catch (err) {
                summary.errors += 1;
                logger.error(
                    '[MarketNewsAutoTrust] batch triage failed: %s',
                    err instanceof Error ? err.message : String(err)
                );
            }
        }
    }

    const ids = pending.map((p) => p.id);
    const fresh =
        ids.length === 0
            ? []
            : await db
                  .select()
                  .from(marketNewsItems)
                  .where(inArray(marketNewsItems.id, ids));

    for (const item of fresh) {
        summary.processed += 1;
        try {
            // semantic dedup first if no embedding yet
            if (!item.embedding) {
                const dedup = await applySemanticDedup(item);
                if (dedup === 'duplicate') {
                    summary.semanticRejected += 1;
                    summary.rejected += 1;
                    continue;
                }
            }

            const reloaded = await db
                .select()
                .from(marketNewsItems)
                .where(eq(marketNewsItems.id, item.id))
                .limit(1);
            const current = reloaded[0] ?? item;
            if (current.trust !== 'pending') continue;

            const result = await applyAutoTrustRules(current);
            if (result.action === 'trusted' || result.action === 'full_auto_intent') {
                summary.trusted += 1;
            }
            if (result.action === 'rejected_noise' || result.action === 'semantic_rejected') {
                summary.rejected += 1;
            }
            if (result.action === 'pending_review') summary.pendingReview += 1;
            if (result.action === 'full_auto_intent') summary.fullAutoIntents += 1;
        } catch (err) {
            summary.errors += 1;
            logger.error(
                '[MarketNewsAutoTrust] item %d failed: %s',
                item.id,
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    const timed = await autoTrustSeverity3Timeouts();
    summary.timedOut = timed;

    return summary;
}

/**
 * Pending MAJOR severity=3 older than TIMEOUT_HOURS → trusted + auto tag.
 */
export async function autoTrustSeverity3Timeouts(): Promise<number> {
    if (!env.MARKET_CONTEXT_ENABLED || !env.MARKET_CONTEXT_AUTO_TRUST_ENABLED) {
        return 0;
    }

    const hours = Math.max(1, env.MARKET_CONTEXT_SEVERITY3_TIMEOUT_HOURS);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stale = await db
        .select({ id: marketNewsItems.id })
        .from(marketNewsItems)
        .where(
            and(
                eq(marketNewsItems.trust, 'pending'),
                eq(marketNewsItems.classification, 'MAJOR'),
                eq(marketNewsItems.eventSeverity, 3),
                lt(marketNewsItems.createdAt, cutoff)
            )
        )
        .limit(100);

    if (stale.length === 0) return 0;

    const ids = stale.map((s) => s.id);
    await db
        .update(marketNewsItems)
        .set({
            trust: 'trusted',
            trustNote: AUTO_TRUST_TIMEOUT_TAG,
            updatedAt: new Date(),
        })
        .where(inArray(marketNewsItems.id, ids));

    logMarketContextActivity('severity3_timeout_auto_trust', {
        count: ids.length,
        ids,
        hours,
        tag: AUTO_TRUST_TIMEOUT_TAG,
    });

    logger.info(
        '[MarketNewsAutoTrust] severity3 timeout auto-trusted count=%d hours=%d',
        ids.length,
        hours
    );

    return ids.length;
}

/**
 * Derive cheap classification from terminal impact signals (zero extra AI cost).
 */
export function deriveTerminalClassification(input: {
    impactScore?: number | null;
    isBreaking?: number | null;
}): {
    classification: MarketNewsClassification;
    eventSeverity: number;
    relevanceScore: number;
} | null {
    const impact =
        typeof input.impactScore === 'number' && !Number.isNaN(input.impactScore)
            ? input.impactScore
            : null;
    const breaking = input.isBreaking === 1;

    if (impact === null && !breaking) return null;

    const relevanceScore = impact !== null
        ? Math.max(0, Math.min(100, Math.round(impact > 1 ? impact : impact * 100)))
        : breaking
          ? 85
          : 50;

    if (breaking || relevanceScore >= 85) {
        return {
            classification: 'MAJOR',
            eventSeverity: breaking || relevanceScore >= 95 ? 3 : 2,
            relevanceScore,
        };
    }
    if (relevanceScore >= 50) {
        return {
            classification: 'MINOR',
            eventSeverity: 1,
            relevanceScore,
        };
    }
    return {
        classification: 'NOISE',
        eventSeverity: 1,
        relevanceScore,
    };
}
