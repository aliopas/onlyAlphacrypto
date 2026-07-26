/**
 * DEC-043 B7 — Seed coin blog draft pages for TRACKED_COINS.
 *
 * Manual only (not boot/cron):
 *   cd backend && npx ts-node scripts/seed-coin-blog-pages.ts
 *
 * Prerequisites:
 *   - MARKET_CONTEXT_ENABLED=true
 *   - OPENROUTER_API_KEY (and optional DEEPSEEK_API_KEY)
 *   - hub_v1 migration applied (market_context_hub_v1)
 *
 * Behavior:
 *   1) Idempotent guard via migration_flags.flag_name = market_context_coin_seed_v1
 *      (use FORCE_COIN_SEED=true to re-run; still skips symbols that already have published coin pages)
 *   2) Backfill trusted news from coin_news + coin_news_history (last ~12 months) into market_news_items
 *   3) For each TRACKED_COIN without published kind=coin: generateCoinBlogSnapshot(autoPublish=false) → draft
 *   4) Delay 3–8s between coins for rate limits
 *
 * Publish is intentional/manual from Admin → Blog / Insights after editorial review (AdSense-safe).
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, pool } from '../src/config/db';
import { env } from '../src/config/env';
import { TRACKED_COINS } from '../src/config/coins';
import { coinNews, coinNewsHistory, migrationFlags } from '../src/models/market.model';
import {
    marketContextSnapshots,
    marketNewsItems,
} from '../src/models/marketContext.model';
import { normalizeAndUpsertNewsItem } from '../src/services/marketNews.service';
import { generateCoinBlogSnapshot } from '../src/services/coinBlogGenerator.service';
import { logger } from '../src/utils/logger';

const SEED_FLAG = 'market_context_coin_seed_v1';
const NEWS_DAYS_BACK = 365;
const DELAY_MS_MIN = 3000;
const DELAY_MS_MAX = 8000;

type CoinOutcome = 'generated' | 'skipped_published' | 'skipped_draft_exists' | 'failed';

interface CoinResult {
    symbol: string;
    outcome: CoinOutcome;
    detail?: string;
    snapshotId?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs(): number {
    return DELAY_MS_MIN + Math.floor(Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN + 1));
}

async function hasSeedFlag(): Promise<boolean> {
    const rows = await db
        .select({ id: migrationFlags.id })
        .from(migrationFlags)
        .where(eq(migrationFlags.flagName, SEED_FLAG))
        .limit(1);
    return rows.length > 0;
}

async function markSeedFlag(): Promise<void> {
    await db
        .insert(migrationFlags)
        .values({ flagName: SEED_FLAG, executedAt: new Date() })
        .onConflictDoNothing();
}

async function hasPublishedCoin(symbol: string): Promise<boolean> {
    const rows = await db
        .select({ id: marketContextSnapshots.id })
        .from(marketContextSnapshots)
        .where(
            and(
                eq(marketContextSnapshots.kind, 'coin'),
                eq(marketContextSnapshots.symbol, symbol),
                eq(marketContextSnapshots.status, 'published')
            )
        )
        .limit(1);
    return rows.length > 0;
}

async function hasAnyCoinSnapshot(symbol: string): Promise<boolean> {
    const rows = await db
        .select({ id: marketContextSnapshots.id })
        .from(marketContextSnapshots)
        .where(
            and(
                eq(marketContextSnapshots.kind, 'coin'),
                eq(marketContextSnapshots.symbol, symbol)
            )
        )
        .limit(1);
    return rows.length > 0;
}

/**
 * Link terminal history into market_news_items as trusted (SHA-256 dedupe via normalize).
 */
async function backfillTrustedNewsForSymbol(symbol: string): Promise<{
    coinNewsLinked: number;
    historyLinked: number;
}> {
    const since = new Date(Date.now() - NEWS_DAYS_BACK * 24 * 60 * 60 * 1000);
    let coinNewsLinked = 0;
    let historyLinked = 0;

    const liveRows = await db
        .select({
            id: coinNews.id,
            coinSymbol: coinNews.coinSymbol,
            headline: coinNews.headline,
            summary: coinNews.summary,
            sourceUrl: coinNews.sourceUrl,
            publishedAt: coinNews.publishedAt,
            impactScore: coinNews.impactScore,
            isBreaking: coinNews.isBreaking,
        })
        .from(coinNews)
        .where(
            and(
                sql`UPPER(${coinNews.coinSymbol}) = ${symbol}`,
                gte(coinNews.publishedAt, since)
            )
        )
        .orderBy(desc(coinNews.publishedAt))
        .limit(200);

    for (const row of liveRows) {
        const outcome = await normalizeAndUpsertNewsItem({
            sourceType: 'terminal',
            externalId: `seed-cn-${row.id}`,
            title: row.headline,
            body: row.summary ?? null,
            url: row.sourceUrl ?? null,
            sourceName: 'terminal',
            publishedAt: row.publishedAt ?? null,
            symbols: [symbol],
            rawRef: { coinNewsId: row.id, seed: 'b7' },
            trust: 'trusted',
            trustNote: 'seed-b7-backfill',
            runAutoTrust: false,
        });
        if (outcome === 'inserted') coinNewsLinked += 1;
    }

    const histRows = await db
        .select({
            id: coinNewsHistory.id,
            coinSymbol: coinNewsHistory.coinSymbol,
            title: coinNewsHistory.title,
            source: coinNewsHistory.source,
            publishedAt: coinNewsHistory.publishedAt,
            eventSeverity: coinNewsHistory.eventSeverity,
            eventType: coinNewsHistory.eventType,
        })
        .from(coinNewsHistory)
        .where(
            and(
                sql`UPPER(${coinNewsHistory.coinSymbol}) = ${symbol}`,
                gte(coinNewsHistory.publishedAt, since)
            )
        )
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(300);

    for (const row of histRows) {
        const severity =
            typeof row.eventSeverity === 'number'
                ? Math.max(1, Math.min(3, Math.round(row.eventSeverity)))
                : 1;
        const outcome = await normalizeAndUpsertNewsItem({
            sourceType: 'terminal',
            externalId: `seed-cnh-${row.id}`,
            title: row.title,
            body: row.eventType ? `Historical event type: ${row.eventType}` : null,
            url: null,
            sourceName: row.source ?? 'terminal-history',
            publishedAt: row.publishedAt ?? null,
            symbols: [symbol],
            rawRef: { coinNewsHistoryId: row.id, seed: 'b7' },
            trust: 'trusted',
            trustNote: 'seed-b7-history-backfill',
            classification: severity >= 3 ? 'MAJOR' : severity === 2 ? 'MINOR' : 'MINOR',
            eventSeverity: severity,
            relevanceScore: severity >= 3 ? 80 : 65,
            runAutoTrust: false,
        });
        if (outcome === 'inserted') historyLinked += 1;
    }

    // Touch count for observability (not required for generate)
    const trustedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketNewsItems)
        .where(
            and(
                eq(marketNewsItems.trust, 'trusted'),
                sql`${marketNewsItems.symbols} @> ${JSON.stringify([symbol])}::jsonb`
            )
        );

    logger.info(
        '[SeedCoinBlog] %s news backfill coin_news=%d history=%d trusted_total≈%s',
        symbol,
        coinNewsLinked,
        historyLinked,
        String(trustedCount[0]?.count ?? 0)
    );

    return { coinNewsLinked, historyLinked };
}

async function seedOneCoin(symbol: string): Promise<CoinResult> {
    if (await hasPublishedCoin(symbol)) {
        logger.info('[SeedCoinBlog] %s skip — published coin page exists', symbol);
        return { symbol, outcome: 'skipped_published' };
    }

    // Prefer not to re-generate if a draft already exists (idempotent partial runs)
    if (await hasAnyCoinSnapshot(symbol)) {
        logger.info('[SeedCoinBlog] %s skip — coin snapshot already exists (draft/archive)', symbol);
        return { symbol, outcome: 'skipped_draft_exists' };
    }

    try {
        await backfillTrustedNewsForSymbol(symbol);
    } catch (err) {
        logger.warn(
            '[SeedCoinBlog] %s news backfill error (continuing generate): %s',
            symbol,
            err instanceof Error ? err.message : String(err)
        );
    }

    try {
        const result = await generateCoinBlogSnapshot({
            symbol,
            createdBy: 'seed-b7',
            autoPublish: false,
        });
        logger.info(
            '[SeedCoinBlog] %s generated draft id=%d news=%d seo=%s',
            symbol,
            result.snapshot.id,
            result.newsCount,
            result.snapshot.seoScore
                ? JSON.stringify(
                      (result.snapshot.seoScore as { band?: string }).band ?? 'n/a'
                  )
                : 'n/a'
        );
        return {
            symbol,
            outcome: 'generated',
            snapshotId: result.snapshot.id,
        };
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger.error('[SeedCoinBlog] %s FAILED: %s', symbol, detail);
        return { symbol, outcome: 'failed', detail };
    }
}

async function main(): Promise<void> {
    logger.info('[SeedCoinBlog] DEC-043 B7 seed starting');

    if (!env.MARKET_CONTEXT_ENABLED) {
        logger.error(
            '[SeedCoinBlog] MARKET_CONTEXT_ENABLED=false — abort. Set true and re-run.'
        );
        process.exit(1);
    }

    if (!env.OPENROUTER_API_KEY) {
        logger.error('[SeedCoinBlog] OPENROUTER_API_KEY missing — abort.');
        process.exit(1);
    }

    const force = process.env.FORCE_COIN_SEED === 'true';
    if (!force && (await hasSeedFlag())) {
        logger.info(
            '[SeedCoinBlog] flag %s already set — skip full seed. Use FORCE_COIN_SEED=true to re-run (still skips published).',
            SEED_FLAG
        );
        process.exit(0);
    }

    const results: CoinResult[] = [];

    for (let i = 0; i < TRACKED_COINS.length; i++) {
        const symbol = TRACKED_COINS[i];
        logger.info(
            '[SeedCoinBlog] (%d/%d) processing %s',
            i + 1,
            TRACKED_COINS.length,
            symbol
        );
        const result = await seedOneCoin(symbol);
        results.push(result);

        if (i < TRACKED_COINS.length - 1) {
            const delay = randomDelayMs();
            logger.info('[SeedCoinBlog] rate-limit delay %dms', delay);
            await sleep(delay);
        }
    }

    const summary = {
        generated: results.filter((r) => r.outcome === 'generated').length,
        skippedPublished: results.filter((r) => r.outcome === 'skipped_published').length,
        skippedExisting: results.filter((r) => r.outcome === 'skipped_draft_exists').length,
        failed: results.filter((r) => r.outcome === 'failed').length,
        results,
    };

    logger.info('[SeedCoinBlog] summary %s', JSON.stringify(summary));

    // Only mark flag when zero hard failures (partial success still marks — ops can FORCE)
    if (summary.failed === 0) {
        await markSeedFlag();
        logger.info('[SeedCoinBlog] migration_flags set: %s', SEED_FLAG);
    } else {
        logger.warn(
            '[SeedCoinBlog] %d failures — flag NOT set. Fix and re-run (or FORCE_COIN_SEED=true).',
            summary.failed
        );
    }

    logger.info(
        '[SeedCoinBlog] DONE. Review drafts in Admin → Blog / Insights → Coins, then Publish manually. No auto-publish in seed.'
    );

    await pool.end();
    process.exit(summary.failed > 0 ? 2 : 0);
}

main().catch(async (err) => {
    logger.error(
        '[SeedCoinBlog] fatal: %s',
        err instanceof Error ? err.message : String(err)
    );
    try {
        await pool.end();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
