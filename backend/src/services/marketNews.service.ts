import { createHash } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { LogLevel } from 'telegram/extensions/Logger';
import { db } from '../config/db';
import { env } from '../config/env';
import { coinNews } from '../models/market.model';
import {
    marketNewsItems,
    marketTelegramChannels,
    type MarketNewsSourceType,
    type MarketNewsClassification,
    type NewMarketNewsItem,
} from '../models/marketContext.model';
import { fetchAllRSSNews } from './rssNews.service';
import { logger } from '../utils/logger';
import {
    processNewsItemAutoTrust,
    processPendingMarketNewsAutoTrust,
    deriveTerminalClassification,
    type ProcessPendingAutoTrustSummary,
} from './marketNewsAutoTrust.service';

export interface NormalizeNewsInput {
    sourceType: MarketNewsSourceType;
    externalId?: string | null;
    title: string;
    body?: string | null;
    url?: string | null;
    sourceName?: string | null;
    publishedAt?: Date | null;
    symbols?: string[];
    rawRef?: Record<string, unknown> | null;
    trust?: 'pending' | 'trusted' | 'rejected';
    trustNote?: string | null;
    /** Optional pre-known triage (e.g. terminal) — zero extra AI cost */
    classification?: MarketNewsClassification | null;
    eventSeverity?: number | null;
    relevanceScore?: number | null;
    /** When false, skip post-insert auto-trust (batch path runs later) */
    runAutoTrust?: boolean;
}

export interface SourceIngestResult {
    source: 'terminal' | 'rss' | 'telegram';
    attempted: number;
    inserted: number;
    skipped: number;
    error?: string;
}

export interface MarketNewsIngestResult {
    enabled: boolean;
    terminal: SourceIngestResult;
    rss: SourceIngestResult;
    telegram: SourceIngestResult;
    autoTrust?: ProcessPendingAutoTrustSummary;
}

function publishedDayKey(publishedAt: Date | null | undefined): string {
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
        return 'unknown';
    }
    return publishedAt.toISOString().slice(0, 10);
}

/**
 * Stable hash: sourceType + externalId, OR sourceType + url + title + published day.
 */
export function computeMarketNewsSourceHash(input: {
    sourceType: MarketNewsSourceType;
    externalId?: string | null;
    url?: string | null;
    title: string;
    publishedAt?: Date | null;
}): string {
    const externalId = input.externalId?.trim();
    let raw: string;
    if (externalId) {
        raw = `${input.sourceType}|id:${externalId}`;
    } else {
        const url = (input.url ?? '').trim().toLowerCase();
        const title = input.title.trim().toLowerCase();
        const day = publishedDayKey(input.publishedAt ?? null);
        raw = `${input.sourceType}|url:${url}|title:${title}|day:${day}`;
    }
    return createHash('sha256').update(raw).digest('hex');
}

export async function normalizeAndUpsertNewsItem(
    input: NormalizeNewsInput
): Promise<'inserted' | 'skipped'> {
    const title = input.title?.trim();
    if (!title) {
        return 'skipped';
    }

    const sourceHash = computeMarketNewsSourceHash({
        sourceType: input.sourceType,
        externalId: input.externalId,
        url: input.url,
        title,
        publishedAt: input.publishedAt ?? null,
    });

    const classification =
        input.classification === 'MAJOR' ||
        input.classification === 'MINOR' ||
        input.classification === 'NOISE'
            ? input.classification
            : null;

    const eventSeverity =
        typeof input.eventSeverity === 'number' && !Number.isNaN(input.eventSeverity)
            ? Math.max(1, Math.min(3, Math.round(input.eventSeverity)))
            : null;

    const relevanceScore =
        typeof input.relevanceScore === 'number' && !Number.isNaN(input.relevanceScore)
            ? Math.max(0, Math.min(100, Math.round(input.relevanceScore)))
            : null;

    const row: NewMarketNewsItem = {
        sourceType: input.sourceType,
        externalId: input.externalId ?? null,
        sourceHash,
        title,
        body: input.body ?? null,
        url: input.url ?? null,
        sourceName: input.sourceName ?? null,
        publishedAt: input.publishedAt ?? null,
        symbols: input.symbols ?? [],
        trust: input.trust ?? 'pending',
        trustNote: input.trustNote ?? null,
        rawRef: input.rawRef ?? null,
        classification,
        eventSeverity,
        relevanceScore,
        updatedAt: new Date(),
    };

    try {
        const result = await db
            .insert(marketNewsItems)
            .values(row)
            .onConflictDoNothing({ target: marketNewsItems.sourceHash })
            .returning({ id: marketNewsItems.id });

        if (result.length === 0) {
            return 'skipped';
        }

        const insertedId = result[0].id;
        const shouldAutoTrust = input.runAutoTrust !== false;
        if (
            shouldAutoTrust &&
            env.MARKET_CONTEXT_AUTO_TRUST_ENABLED &&
            (input.trust ?? 'pending') === 'pending'
        ) {
            // Fire-and-await per item is OK at modest ingest volume; batch path also runs at end
            await processNewsItemAutoTrust(insertedId);
        }

        return 'inserted';
    } catch (err) {
        logger.error(
            '[MarketNews] upsert failed for hash=%s: %s',
            sourceHash,
            err instanceof Error ? err.message : String(err)
        );
        return 'skipped';
    }
}

export async function ingestFromTerminalNews(limit = 100): Promise<SourceIngestResult> {
    const result: SourceIngestResult = {
        source: 'terminal',
        attempted: 0,
        inserted: 0,
        skipped: 0,
    };

    try {
        const safeLimit = Math.min(Math.max(limit, 1), 500);
        const rows = await db
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
            .orderBy(desc(coinNews.publishedAt))
            .limit(safeLimit);

        result.attempted = rows.length;

        for (const row of rows) {
            // Reuse terminal impact signals as classification when available (zero AI cost)
            const derived = deriveTerminalClassification({
                impactScore: row.impactScore,
                isBreaking: row.isBreaking,
            });

            const outcome = await normalizeAndUpsertNewsItem({
                sourceType: 'terminal',
                externalId: String(row.id),
                title: row.headline,
                body: row.summary ?? null,
                url: row.sourceUrl ?? null,
                sourceName: 'terminal',
                publishedAt: row.publishedAt ?? null,
                symbols: row.coinSymbol ? [row.coinSymbol.toUpperCase()] : [],
                rawRef: { coinNewsId: row.id },
                trust: 'pending',
                classification: derived?.classification ?? null,
                eventSeverity: derived?.eventSeverity ?? null,
                relevanceScore: derived?.relevanceScore ?? null,
                // Defer auto-trust to end-of-ingest batch for efficiency
                runAutoTrust: false,
            });
            if (outcome === 'inserted') result.inserted += 1;
            else result.skipped += 1;
        }

        logger.info(
            '[MarketNews] terminal ingest attempted=%d inserted=%d skipped=%d',
            result.attempted,
            result.inserted,
            result.skipped
        );
    } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('[MarketNews] terminal ingest error: %s', result.error);
    }

    return result;
}

export async function ingestFromRss(): Promise<SourceIngestResult> {
    const result: SourceIngestResult = {
        source: 'rss',
        attempted: 0,
        inserted: 0,
        skipped: 0,
    };

    try {
        const items = await fetchAllRSSNews();
        result.attempted = items.length;

        for (const item of items) {
            const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
            const safePublished =
                publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null;

            const outcome = await normalizeAndUpsertNewsItem({
                sourceType: 'rss',
                externalId: item.link || null,
                title: item.title,
                body: item.contentSnippet ?? null,
                url: item.link || null,
                sourceName: item.source,
                publishedAt: safePublished,
                symbols: [],
                rawRef: { rssSource: item.source },
                trust: 'pending',
                runAutoTrust: false,
            });
            if (outcome === 'inserted') result.inserted += 1;
            else result.skipped += 1;
        }

        logger.info(
            '[MarketNews] rss ingest attempted=%d inserted=%d skipped=%d',
            result.attempted,
            result.inserted,
            result.skipped
        );
    } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('[MarketNews] rss ingest error: %s', result.error);
    }

    return result;
}

async function createMarketTelegramClient(): Promise<TelegramClient | null> {
    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionStr) {
        logger.warn('[MarketNews] Telegram credentials missing — telegram ingest skipped');
        return null;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 3,
        });
        client.setLogLevel(LogLevel.NONE);
        await client.connect();
        return client;
    } catch (err) {
        logger.error(
            '[MarketNews] Telegram connect failed: %s',
            err instanceof Error ? err.message : String(err)
        );
        return null;
    }
}

function normalizeChannelUsername(usernameOrId: string): string {
    const trimmed = usernameOrId.trim();
    if (trimmed.startsWith('@')) return trimmed.slice(1);
    return trimmed;
}

export async function ingestFromTelegramChannels(): Promise<SourceIngestResult> {
    const result: SourceIngestResult = {
        source: 'telegram',
        attempted: 0,
        inserted: 0,
        skipped: 0,
    };

    try {
        const channels = await db
            .select()
            .from(marketTelegramChannels)
            .where(eq(marketTelegramChannels.enabled, true));

        if (channels.length === 0) {
            logger.info('[MarketNews] no enabled market_telegram_channels — skip');
            return result;
        }

        const client = await createMarketTelegramClient();
        if (!client) {
            result.error = 'telegram_client_unavailable';
            return result;
        }

        const pollLimit = Math.min(
            Math.max(env.MARKET_CONTEXT_TELEGRAM_POLL_LIMIT || 50, 1),
            100
        );

        try {
            for (const channel of channels) {
                const entity = normalizeChannelUsername(channel.usernameOrId);
                try {
                    const messages = await client.getMessages(entity, { limit: pollLimit });
                    let maxMsgId = channel.lastCursor
                        ? parseInt(channel.lastCursor, 10)
                        : 0;
                    if (Number.isNaN(maxMsgId)) maxMsgId = 0;

                    for (const msg of messages) {
                        if (!msg.id) continue;
                        const text = msg.message?.trim() ?? '';
                        if (text.length < 20) {
                            result.skipped += 1;
                            continue;
                        }

                        result.attempted += 1;
                        const msgDate = new Date((msg.date ?? 0) * 1000);
                        const link = entity.match(/^\d+$/)
                            ? null
                            : `https://t.me/${entity}/${msg.id}`;

                        const outcome = await normalizeAndUpsertNewsItem({
                            sourceType: 'telegram',
                            externalId: `${channel.id}:${msg.id}`,
                            title: text.slice(0, 200),
                            body: text,
                            url: link,
                            sourceName: channel.title || channel.usernameOrId,
                            publishedAt: msgDate,
                            symbols: [],
                            rawRef: {
                                channelId: channel.id,
                                messageId: msg.id,
                                usernameOrId: channel.usernameOrId,
                            },
                            trust: 'pending',
                            runAutoTrust: false,
                        });

                        if (outcome === 'inserted') result.inserted += 1;
                        else result.skipped += 1;

                        if (msg.id > maxMsgId) maxMsgId = msg.id;
                    }

                    if (maxMsgId > 0) {
                        await db
                            .update(marketTelegramChannels)
                            .set({
                                lastCursor: String(maxMsgId),
                                updatedAt: new Date(),
                            })
                            .where(eq(marketTelegramChannels.id, channel.id));
                    }
                } catch (chErr) {
                    logger.error(
                        '[MarketNews] telegram channel %s error: %s',
                        channel.usernameOrId,
                        chErr instanceof Error ? chErr.message : String(chErr)
                    );
                }
            }
        } finally {
            try {
                await client.disconnect();
            } catch {
                /* ignore */
            }
        }

        logger.info(
            '[MarketNews] telegram ingest attempted=%d inserted=%d skipped=%d',
            result.attempted,
            result.inserted,
            result.skipped
        );
    } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        logger.error('[MarketNews] telegram ingest error: %s', result.error);
    }

    return result;
}

export async function runMarketNewsIngest(): Promise<MarketNewsIngestResult> {
    if (!env.MARKET_CONTEXT_ENABLED || !env.MARKET_CONTEXT_INGEST_ENABLED) {
        logger.info(
            '[MarketNews] ingest disabled (MARKET_CONTEXT_ENABLED=%s MARKET_CONTEXT_INGEST_ENABLED=%s)',
            String(env.MARKET_CONTEXT_ENABLED),
            String(env.MARKET_CONTEXT_INGEST_ENABLED)
        );
        return {
            enabled: false,
            terminal: { source: 'terminal', attempted: 0, inserted: 0, skipped: 0 },
            rss: { source: 'rss', attempted: 0, inserted: 0, skipped: 0 },
            telegram: { source: 'telegram', attempted: 0, inserted: 0, skipped: 0 },
        };
    }

    logger.info('[MarketNews] runMarketNewsIngest start');

    const terminal = await ingestFromTerminalNews(100);
    const rss = await ingestFromRss();
    const telegram = await ingestFromTelegramChannels();

    let autoTrust: ProcessPendingAutoTrustSummary | undefined;
    if (env.MARKET_CONTEXT_AUTO_TRUST_ENABLED) {
        try {
            autoTrust = await processPendingMarketNewsAutoTrust(50);
            logger.info(
                '[MarketNews] auto-trust processed=%d trusted=%d rejected=%d pendingReview=%d fullAuto=%d timeout=%d',
                autoTrust.processed,
                autoTrust.trusted,
                autoTrust.rejected,
                autoTrust.pendingReview,
                autoTrust.fullAutoIntents,
                autoTrust.timedOut
            );
        } catch (err) {
            logger.error(
                '[MarketNews] auto-trust batch failed: %s',
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    logger.info(
        '[MarketNews] runMarketNewsIngest done terminal=%d/%d rss=%d/%d telegram=%d/%d',
        terminal.inserted,
        terminal.attempted,
        rss.inserted,
        rss.attempted,
        telegram.inserted,
        telegram.attempted
    );

    return { enabled: true, terminal, rss, telegram, autoTrust };
}
