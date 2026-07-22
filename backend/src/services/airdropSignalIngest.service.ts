import { createHash } from 'crypto';
import Parser from 'rss-parser';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { LogLevel } from 'telegram/extensions/Logger';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
    airdropPipelineRuns,
    airdropSignals,
    contentSources,
    type ContentSource,
    type ContentSourcePurpose,
} from '../models/airdrop.model';
import { listEnabledAirdropSources } from './contentSources.service';
import { extractCandidateNames, resolveOrCreateEntity } from './entityResolve.service';
import { recomputeMoodSnapshots, type DateSignalEntry } from './airdropMood.service';
import { logger } from '../utils/logger';

export interface SignalIngestChannelResult {
    source: 'telegram_alpha' | 'telegram_community' | 'rss_alpha';
    attempted: number;
    inserted: number;
    skipped: number;
    errors: number;
}

export interface AirdropSignalIngestResult {
    enabled: boolean;
    telegramAlpha: SignalIngestChannelResult;
    telegramCommunity: SignalIngestChannelResult;
    rssAlpha: SignalIngestChannelResult;
    entitiesCreated: number;
    mood: { entitiesTouched: number; snapshotsWritten: number };
    durationMs: number;
}

interface NormalizedIngestItem {
    sourceId: number;
    purpose: ContentSourcePurpose;
    sourceKind: 'telegram' | 'rss';
    externalId: string | null;
    title: string;
    body: string;
    url: string | null;
    publishedAt: Date | null;
    sourceHash: string;
}

const SPAM_PATTERNS: RegExp[] = [
    /join.*group/i,
    /click.*link/i,
    /send.*dm/i,
    /guaranteed.*profit/i,
    /t\.me\/joinchat/i,
];

const AIRDROP_KEYWORDS: string[] = [
    'airdrop',
    'airdrops',
    'snapshot',
    'tge',
    'token generation',
    'claim',
    'retrodrop',
    'retroactive',
    'testnet reward',
    'incentivized testnet',
    'token claim',
    'eligibility',
    'token distribution',
];

const parser = new Parser({
    requestOptions: {
        timeout: 20000,
        family: 4,
    },
});

function emptyChannel(
    source: SignalIngestChannelResult['source']
): SignalIngestChannelResult {
    return { source, attempted: 0, inserted: 0, skipped: 0, errors: 0 };
}

function isSpam(text: string): boolean {
    return SPAM_PATTERNS.some((p) => p.test(text));
}

function isAirdropRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    return AIRDROP_KEYWORDS.some((kw) => lower.includes(kw));
}

export function computeAirdropSignalSourceHash(input: {
    sourceKind: string;
    externalId?: string | null;
    url?: string | null;
    title: string;
    body?: string;
    publishedAt?: Date | null;
}): string {
    const externalId = input.externalId?.trim();
    let raw: string;
    if (externalId) {
        raw = `${input.sourceKind}|id:${externalId}`;
    } else {
        const url = (input.url ?? '').trim().toLowerCase();
        const title = input.title.trim().toLowerCase();
        const day =
            input.publishedAt && !Number.isNaN(input.publishedAt.getTime())
                ? input.publishedAt.toISOString().slice(0, 10)
                : 'unknown';
        const bodySlice = (input.body ?? '').trim().slice(0, 120).toLowerCase();
        raw = `${input.sourceKind}|url:${url}|title:${title}|day:${day}|b:${bodySlice}`;
    }
    return createHash('sha256').update(raw).digest('hex');
}

export function extractUrls(text: string): string[] {
    const re = /https?:\/\/[^\s<>"')\]]+/gi;
    const found = text.match(re) ?? [];
    const cleaned = found.map((u) => u.replace(/[.,;:]+$/, '')).filter((u) => u.length < 1000);
    return Array.from(new Set(cleaned)).slice(0, 20);
}

export function extractDateSignals(text: string): DateSignalEntry[] {
    const out: DateSignalEntry[] = [];
    const lower = text.toLowerCase();

    const pushKind = (kind: DateSignalEntry['kind'], raw: string, iso: string | null): void => {
        out.push({ kind, raw: raw.slice(0, 120), isoDate: iso });
    };

    // ISO-like dates near keywords
    const isoRe =
        /\b(20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/g;
    let m: RegExpExecArray | null;
    while ((m = isoRe.exec(text)) !== null) {
        const isoRaw = m[1].replace(/\//g, '-');
        const idx = m.index;
        const window = lower.slice(Math.max(0, idx - 40), idx + 40);
        let kind: DateSignalEntry['kind'] = 'unclear';
        if (/snapshot/.test(window)) kind = 'snapshot';
        else if (/\btge\b|token generation/.test(window)) kind = 'tge';
        else if (/claim/.test(window)) kind = 'claim';
        pushKind(kind, m[1], isoRaw);
    }

    if (/snapshot/i.test(text) && !out.some((d) => d.kind === 'snapshot')) {
        pushKind('snapshot', 'snapshot mentioned', null);
    }
    if (/\btge\b|token generation/i.test(text) && !out.some((d) => d.kind === 'tge')) {
        pushKind('tge', 'tge mentioned', null);
    }
    if (/\bclaim\b/i.test(text) && !out.some((d) => d.kind === 'claim')) {
        pushKind('claim', 'claim mentioned', null);
    }

    return out.slice(0, 15);
}

async function createTelegramClient(): Promise<TelegramClient | null> {
    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionStr) {
        logger.warn('[AirdropSignalIngest] Missing Telegram credentials');
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
            '[AirdropSignalIngest] Telegram connect failed: %s',
            err instanceof Error ? err.message : String(err)
        );
        return null;
    }
}

async function collectTelegramItems(
    sources: ContentSource[],
    hoursBack: number
): Promise<NormalizedIngestItem[]> {
    if (sources.length === 0) return [];

    const client = await createTelegramClient();
    if (!client) return [];

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const items: NormalizedIngestItem[] = [];

    try {
        for (const src of sources) {
            const channel = src.identifier.trim().replace(/^@/, '');
            if (!channel) continue;

            try {
                const messages = await client.getMessages(channel, { limit: 20 });
                let maxId = 0;

                for (const msg of messages) {
                    if (!msg.message || msg.message.length < 20) continue;
                    const msgDate = new Date((msg.date ?? 0) * 1000);
                    if (msgDate < cutoff) continue;
                    if (isSpam(msg.message)) continue;

                    // Community: all non-spam; alpha: prefer airdrop-relevant
                    if (src.purpose === 'airdrop_alpha' && !isAirdropRelevant(msg.message)) {
                        continue;
                    }

                    const externalId = `tg:${channel}:${msg.id}`;
                    const link = `https://t.me/${channel}/${msg.id}`;
                    const title = msg.message.slice(0, 200);
                    const body = msg.message;

                    items.push({
                        sourceId: src.id,
                        purpose: src.purpose,
                        sourceKind: 'telegram',
                        externalId,
                        title,
                        body,
                        url: link,
                        publishedAt: msgDate,
                        sourceHash: computeAirdropSignalSourceHash({
                            sourceKind: 'telegram',
                            externalId,
                            url: link,
                            title,
                            body,
                            publishedAt: msgDate,
                        }),
                    });

                    if (typeof msg.id === 'number' && msg.id > maxId) maxId = msg.id;
                }

                if (maxId > 0) {
                    await db
                        .update(contentSources)
                        .set({
                            lastCursor: String(maxId),
                            updatedAt: new Date(),
                        })
                        .where(eq(contentSources.id, src.id));
                }
            } catch (err) {
                logger.error(
                    '[AirdropSignalIngest] TG channel %s: %s',
                    channel,
                    err instanceof Error ? err.message : String(err)
                );
            }
        }
    } finally {
        try {
            await client.disconnect();
        } catch {
            // ignore
        }
    }

    return items;
}

async function collectRssItems(sources: ContentSource[]): Promise<NormalizedIngestItem[]> {
    const items: NormalizedIngestItem[] = [];

    await Promise.all(
        sources.map(async (src) => {
            const url = src.identifier.trim();
            if (!url) return;

            try {
                const feed = await parser.parseURL(url);
                for (const item of feed.items.slice(0, 20)) {
                    const title = item.title || '';
                    const link = item.link || '';
                    const contentSnippet = item.contentSnippet || '';
                    const contentEncoded = (item as { 'content:encoded'?: unknown })[
                        'content:encoded'
                    ];
                    const content =
                        (typeof contentEncoded === 'string' ? contentEncoded : '') ||
                        (typeof item.content === 'string' ? item.content : '') ||
                        contentSnippet;
                    const combined = `${title} ${contentSnippet} ${content}`;
                    if (!isAirdropRelevant(combined)) continue;
                    if (isSpam(combined)) continue;

                    const pubDate = item.pubDate ? new Date(item.pubDate) : null;
                    const publishedAt =
                        pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null;
                    const guid =
                        typeof item.guid === 'string'
                            ? item.guid
                            : typeof item.id === 'string'
                              ? item.id
                              : null;
                    const externalId = guid ? `rss:${src.id}:${guid}` : null;

                    items.push({
                        sourceId: src.id,
                        purpose: src.purpose,
                        sourceKind: 'rss',
                        externalId,
                        title: title.slice(0, 500) || link.slice(0, 200) || 'untitled',
                        body: content.slice(0, 8000),
                        url: link || null,
                        publishedAt,
                        sourceHash: computeAirdropSignalSourceHash({
                            sourceKind: 'rss',
                            externalId,
                            url: link,
                            title,
                            body: content,
                            publishedAt,
                        }),
                    });
                }
            } catch (err) {
                logger.error(
                    '[AirdropSignalIngest] RSS %s: %s',
                    url,
                    err instanceof Error ? err.message : String(err)
                );
            }
        })
    );

    return items;
}

async function upsertSignal(
    item: NormalizedIngestItem
): Promise<{ outcome: 'inserted' | 'skipped'; entityCreated: boolean }> {
    const text = `${item.title}\n${item.body}`;
    const urls = extractUrls(text);
    const dateSignals = extractDateSignals(text);

    let entityId: number | null = null;
    let entityCreated = false;

    const candidates = extractCandidateNames(text);
    // Prefer matching existing aliases first
    for (const name of candidates) {
        const resolved = await resolveOrCreateEntity(name, 'ingest');
        if (resolved) {
            entityId = resolved.entity.id;
            entityCreated = resolved.created;
            break;
        }
    }

    const signalKind =
        item.purpose === 'airdrop_community'
            ? 'community_mention'
            : item.sourceKind === 'rss'
              ? 'rss_mention'
              : 'alpha_mention';

    const claims: unknown[] = [];
    if (item.purpose === 'airdrop_alpha' || item.sourceKind === 'rss') {
        claims.push({
            type: 'source_claim',
            purpose: item.purpose,
            title: item.title.slice(0, 200),
        });
    }

    try {
        const inserted = await db
            .insert(airdropSignals)
            .values({
                entityId,
                sourceId: item.sourceId,
                sourceHash: item.sourceHash,
                externalId: item.externalId,
                title: item.title,
                body: item.body.slice(0, 12000),
                url: item.url,
                publishedAt: item.publishedAt,
                signalKind,
                extractedDates: dateSignals,
                extractedUrls: urls,
                claims,
                rawRef: {
                    purpose: item.purpose,
                    sourceKind: item.sourceKind,
                    candidateNames: candidates,
                },
                updatedAt: new Date(),
            })
            .onConflictDoNothing({ target: airdropSignals.sourceHash })
            .returning({ id: airdropSignals.id });

        return {
            outcome: inserted.length > 0 ? 'inserted' : 'skipped',
            entityCreated,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unique') || msg.includes('duplicate')) {
            return { outcome: 'skipped', entityCreated: false };
        }
        throw err;
    }
}

async function ingestItemBatch(
    items: NormalizedIngestItem[],
    channelSource: SignalIngestChannelResult['source']
): Promise<{ result: SignalIngestChannelResult; entitiesCreated: number }> {
    const result = emptyChannel(channelSource);
    result.attempted = items.length;
    let entitiesCreated = 0;

    for (const item of items) {
        try {
            const { outcome, entityCreated } = await upsertSignal(item);
            if (outcome === 'inserted') {
                result.inserted += 1;
                if (entityCreated) entitiesCreated += 1;
            } else {
                result.skipped += 1;
            }
        } catch (err) {
            result.errors += 1;
            logger.error(
                '[AirdropSignalIngest] upsert failed: %s',
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    return { result, entitiesCreated };
}

/**
 * Unified AD-2 ingest: TG alpha + TG community + RSS → airdrop_signals + entity resolve + mood.
 * No Gate-2, no publish, no GLM.
 */
export async function runAirdropSignalIngest(): Promise<AirdropSignalIngestResult> {
    const start = Date.now();

    if (!env.AIRDROP_INTELLIGENCE_ENABLED || !env.AIRDROP_INTELLIGENCE_INGEST_ENABLED) {
        logger.info(
            '[AirdropSignalIngest] disabled (AIRDROP_INTELLIGENCE_ENABLED=%s INGEST=%s)',
            String(env.AIRDROP_INTELLIGENCE_ENABLED),
            String(env.AIRDROP_INTELLIGENCE_INGEST_ENABLED)
        );
        return {
            enabled: false,
            telegramAlpha: emptyChannel('telegram_alpha'),
            telegramCommunity: emptyChannel('telegram_community'),
            rssAlpha: emptyChannel('rss_alpha'),
            entitiesCreated: 0,
            mood: { entitiesTouched: 0, snapshotsWritten: 0 },
            durationMs: Date.now() - start,
        };
    }

    const tgAlphaSources = await listEnabledAirdropSources({
        kind: 'telegram',
        purposes: ['airdrop_alpha'],
    });
    const tgCommunitySources = await listEnabledAirdropSources({
        kind: 'telegram',
        purposes: ['airdrop_community'],
    });
    const rssSources = await listEnabledAirdropSources({
        kind: 'rss',
        purposes: ['airdrop_alpha'],
    });

    const [tgAlphaItems, tgCommunityItems, rssItems] = await Promise.all([
        collectTelegramItems(tgAlphaSources, 12),
        collectTelegramItems(tgCommunitySources, 12),
        collectRssItems(rssSources),
    ]);

    let entitiesCreated = 0;

    const alphaBatch = await ingestItemBatch(tgAlphaItems, 'telegram_alpha');
    entitiesCreated += alphaBatch.entitiesCreated;

    const communityBatch = await ingestItemBatch(tgCommunityItems, 'telegram_community');
    entitiesCreated += communityBatch.entitiesCreated;

    const rssBatch = await ingestItemBatch(rssItems, 'rss_alpha');
    entitiesCreated += rssBatch.entitiesCreated;

    let mood = { entitiesTouched: 0, snapshotsWritten: 0 };
    try {
        mood = await recomputeMoodSnapshots();
    } catch (err) {
        logger.error(
            '[AirdropSignalIngest] mood recompute failed: %s',
            err instanceof Error ? err.message : String(err)
        );
    }

    const durationMs = Date.now() - start;
    const insertedTotal =
        alphaBatch.result.inserted + communityBatch.result.inserted + rssBatch.result.inserted;
    const rejectedTotal =
        alphaBatch.result.skipped + communityBatch.result.skipped + rssBatch.result.skipped;
    const errorsTotal =
        alphaBatch.result.errors + communityBatch.result.errors + rssBatch.result.errors;

    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'signal_ingest',
            articlesFound: tgAlphaItems.length + tgCommunityItems.length + rssItems.length,
            articlesProcessed: insertedTotal + rejectedTotal,
            projectsInserted: entitiesCreated,
            projectsRejected: rejectedTotal,
            errors: errorsTotal,
            durationMs,
            notes: JSON.stringify({
                telegramAlpha: alphaBatch.result,
                telegramCommunity: communityBatch.result,
                rssAlpha: rssBatch.result,
                mood,
            }),
        });
    } catch (err) {
        logger.error(
            '[AirdropSignalIngest] pipeline run log failed: %s',
            err instanceof Error ? err.message : String(err)
        );
    }

    logger.info(
        '[AirdropSignalIngest] done inserted=%d skipped=%d entities=%d moodEntities=%d %dms',
        insertedTotal,
        rejectedTotal,
        entitiesCreated,
        mood.entitiesTouched,
        durationMs
    );

    return {
        enabled: true,
        telegramAlpha: alphaBatch.result,
        telegramCommunity: communityBatch.result,
        rssAlpha: rssBatch.result,
        entitiesCreated,
        mood,
        durationMs,
    };
}
