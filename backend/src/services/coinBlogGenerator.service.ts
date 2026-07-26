/**
 * DEC-043 B3 — Coin blog article generator (two-step AI).
 * Does NOT modify generateMarketContextSnapshot / market weekly path.
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { isTrackedCoin } from '../config/coins';
import {
    marketNewsItems,
    marketContextSnapshots,
    type CoinBlogSectionKey,
    type CoinBlogSections,
    type MarketContextSection,
    type MarketContextSeoMeta,
    type MarketContextSnapshot,
} from '../models/marketContext.model';
import { PromptFactory } from './ai/prompt-factory';
import { AIGateway, LONG_RESPONSE_MAX_TOKENS } from './ai/ai-gateway';
import { validateFactualGrounding } from './ai/factual-grounding';
import { auditArticleQuality } from './ai/quality-auditor';
import { deepseekGateway, gateway, type ArticleWriterResult } from './openai.service';
import { getCoinIntelligence } from './coinIntelligence.service';
import { getCandles, getLatestIndicator } from './ohlcvSnapshot.service';
import { getPriceWithFallback } from './priceService';
import {
    publishMarketContextSnapshot,
} from './marketContextGenerator.service';
import {
    logMarketContextActivity,
    registerFullAutoCoinHandler,
} from './marketNewsAutoTrust.service';
import { computeCoinBlogSeoScore } from './blogSeoScore.service';
import { TRACKED_COINS } from '../config/coins';
import { logger } from '../utils/logger';

export const COIN_BLOG_GENERATOR_VERSION = 'MC-coin-v1';

export const COIN_BLOG_SECTION_KEYS: CoinBlogSectionKey[] = [
    'heroWhatIs',
    'historicalStructure',
    'eventTimeline',
    'newsImpact',
    'structuralOutlook',
    'relatedCoins',
    'faq',
];

const SECTION_PUBLIC_H2: Record<CoinBlogSectionKey, string> = {
    heroWhatIs: 'What is this asset?',
    historicalStructure: 'Historical market structure',
    eventTimeline: 'Key events timeline',
    newsImpact: 'How recent news shapes the narrative',
    structuralOutlook: 'Structural outlook (NFA)',
    relatedCoins: 'Related assets and correlations',
    faq: 'People also ask',
};

const sectionContentSchema = z.object({
    content: z.string().min(40).max(12000),
    sourceNewsIds: z.array(z.number().int().positive()).optional(),
});

const coinBlogAiSchema = z.object({
    sections: z.object({
        heroWhatIs: sectionContentSchema,
        historicalStructure: sectionContentSchema,
        eventTimeline: sectionContentSchema,
        newsImpact: sectionContentSchema,
        structuralOutlook: sectionContentSchema,
        relatedCoins: sectionContentSchema,
        faq: sectionContentSchema,
    }),
    seo_meta: z.object({
        metaTitle: z.string().min(10).max(60),
        metaDescription: z.string().min(40).max(160),
        seoKeywords: z.array(z.string().min(2).max(80)).min(3).max(12),
    }),
    numericClaims: z
        .object({
            supportLevels: z.array(z.number()).optional(),
            resistanceLevels: z.array(z.number()).optional(),
            currentPrice: z.number().nullable().optional(),
        })
        .optional(),
});

export interface GenerateCoinBlogOptions {
    symbol: string;
    createdBy?: string | null;
    newsLimit?: number;
    newsDaysBack?: number;
    /** When true: status published + auto_published (full-auto path) */
    autoPublish?: boolean;
}

export interface GenerateCoinBlogResult {
    snapshot: MarketContextSnapshot;
    newsCount: number;
    sectionKeys: CoinBlogSectionKey[];
    seoMeta: MarketContextSeoMeta;
    qualityScore: number | null;
    autoPublished: boolean;
}

const prompts = new PromptFactory();

const polishGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 120000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripBuySellLanguage(text: string): string {
    return text.replace(/\b(buy|sell|long now|short now)\b/gi, (m) => {
        const lower = m.toLowerCase();
        if (lower === 'buy') return 'accumulate (educational)';
        if (lower === 'sell') return 'reduce exposure (educational)';
        return 'reposition (educational)';
    });
}

function parseSourceNewsIds(raw: unknown, allowed: Set<number>): number[] {
    if (!Array.isArray(raw)) return [];
    const out: number[] = [];
    for (const v of raw) {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
        if (!Number.isNaN(n) && allowed.has(n) && !out.includes(n)) out.push(n);
    }
    return out;
}

function clampMeta(meta: MarketContextSeoMeta, symbol: string): MarketContextSeoMeta {
    let metaTitle = meta.metaTitle.trim().slice(0, 60);
    let metaDescription = meta.metaDescription.trim().slice(0, 160);
    if (metaTitle.length < 10) {
        metaTitle = `${symbol} price analysis | OnlyAlpha Insights`.slice(0, 60);
    }
    if (metaDescription.length < 40) {
        metaDescription =
            `Educational ${symbol} market context: structure, news impact, and historical performance. Not financial advice.`.slice(
                0,
                160
            );
    }
    const seoKeywords = meta.seoKeywords
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .filter((k) => !/price\s*prediction/i.test(k))
        .slice(0, 12);
    if (seoKeywords.length < 3) {
        seoKeywords.push(
            `${symbol} price analysis`,
            `${symbol} news today`,
            `is ${symbol} a good investment`
        );
    }
    return { metaTitle, metaDescription, seoKeywords: seoKeywords.slice(0, 12) };
}

function buildPrimaryKeywords(symbol: string): string[] {
    return [
        `${symbol} price analysis`,
        `${symbol} news today`,
        `${symbol} historical performance`,
        `is ${symbol} a good investment`,
    ];
}

function parseJsonLoose(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        return JSON.parse(fenced);
    }
}

/** Ensure ≥2 internal /blog links for SEO (index + related coin). */
function ensureInternalBlogLinks(
    sections: CoinBlogSections,
    symbol: string
): CoinBlogSections {
    const related = TRACKED_COINS.filter((c) => c !== symbol).slice(0, 3);
    const relatedLinks = related
        .map((c) => `- [${c} insights](/blog/${c.toLowerCase()})`)
        .join('\n');
    const indexLink = `[OnlyAlpha Insights hub](/blog)`;

    const relatedContent = sections.relatedCoins.content;
    const hasBlogLinks = (relatedContent.match(/\]\(\/blog/gi) ?? []).length;
    if (hasBlogLinks < 2) {
        sections.relatedCoins = {
            ...sections.relatedCoins,
            content: `${relatedContent.trim()}\n\n### Related reading\n\n${indexLink}\n${relatedLinks}\n`,
        };
    }

    const hero = sections.heroWhatIs.content;
    if (!/\]\(\/blog/i.test(hero)) {
        sections.heroWhatIs = {
            ...sections.heroWhatIs,
            content: `${hero.trim()}\n\nFor the broader market edition, see ${indexLink}.\n`,
        };
    }

    return sections;
}

function normalizeSections(
    rawSections: unknown,
    allowedNewsIds: Set<number>,
    nowIso: string,
    symbol: string
): CoinBlogSections {
    const node = isRecord(rawSections) ? rawSections : {};
    const result = {} as CoinBlogSections;

    for (const key of COIN_BLOG_SECTION_KEYS) {
        const sectionNode = node[key];
        let content = '';
        let sourceNewsIds: number[] = [];

        if (typeof sectionNode === 'string') {
            content = sectionNode.trim();
        } else if (isRecord(sectionNode)) {
            content = typeof sectionNode.content === 'string' ? sectionNode.content.trim() : '';
            sourceNewsIds = parseSourceNewsIds(sectionNode.sourceNewsIds, allowedNewsIds);
        }

        if (!content || content.length < 40) {
            content = `## ${SECTION_PUBLIC_H2[key].replace('this asset', symbol)}\n\n_Content unavailable for this draft. Not financial advice._`;
        } else {
            content = stripBuySellLanguage(content);
            if (!content.trimStart().startsWith('#')) {
                const h2 = SECTION_PUBLIC_H2[key].replace('this asset', symbol);
                content = `## ${h2}\n\n${content}`;
            }
        }

        // Soft length cap
        if (content.length > 12000) {
            content = content.slice(0, 12000);
        }

        const section: MarketContextSection = {
            content,
            updatedAt: nowIso,
            sourceNewsIds,
        };
        result[key] = section;
    }

    return result;
}

export async function loadTrustedNewsForSymbol(
    symbol: string,
    options?: { limit?: number; daysBack?: number }
): Promise<
    Array<{
        id: number;
        title: string;
        body: string | null;
        sourceName: string | null;
        publishedAt: string | null;
    }>
> {
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 80);
    const daysBack = Math.min(Math.max(options?.daysBack ?? 30, 1), 180);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const sym = symbol.toUpperCase();

    const rows = await db
        .select({
            id: marketNewsItems.id,
            title: marketNewsItems.title,
            body: marketNewsItems.body,
            sourceName: marketNewsItems.sourceName,
            publishedAt: marketNewsItems.publishedAt,
            symbols: marketNewsItems.symbols,
        })
        .from(marketNewsItems)
        .where(
            and(
                eq(marketNewsItems.trust, 'trusted'),
                gte(marketNewsItems.publishedAt, since),
                sql`${marketNewsItems.symbols} @> ${JSON.stringify([sym])}::jsonb`
            )
        )
        .orderBy(desc(marketNewsItems.publishedAt))
        .limit(limit);

    return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        sourceName: r.sourceName,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    }));
}

async function buildOhlcvSummary(symbol: string): Promise<{
    summary: string;
    currentPrice: number | null;
    supportHints: number[];
    resistanceHints: number[];
}> {
    try {
        const [daily, weekly, indicator, priceResult] = await Promise.all([
            getCandles(symbol, '1d', 30).catch(() => []),
            getCandles(symbol, '1w', 12).catch(() => []),
            getLatestIndicator(symbol, '1d').catch(() => null),
            getPriceWithFallback(symbol).catch(() => null),
        ]);

        const currentPrice =
            priceResult && typeof priceResult.price === 'number'
                ? priceResult.price
                : daily[0]?.close != null
                  ? Number(daily[0].close)
                  : null;

        const closes = daily
            .map((c) => (c.close != null ? Number(c.close) : NaN))
            .filter((n) => !Number.isNaN(n));
        const highs = daily
            .map((c) => (c.high != null ? Number(c.high) : NaN))
            .filter((n) => !Number.isNaN(n));
        const lows = daily
            .map((c) => (c.low != null ? Number(c.low) : NaN))
            .filter((n) => !Number.isNaN(n));

        const rangeHigh = highs.length ? Math.max(...highs) : null;
        const rangeLow = lows.length ? Math.min(...lows) : null;
        const latestClose = closes[0] ?? null;

        const supportHints =
            rangeLow != null && latestClose != null
                ? [rangeLow, latestClose * 0.95].filter((n) => n > 0)
                : [];
        const resistanceHints =
            rangeHigh != null && latestClose != null
                ? [rangeHigh, latestClose * 1.05].filter((n) => n > 0)
                : [];

        const lines = [
            `Daily candles loaded: ${daily.length}; weekly: ${weekly.length}`,
            `Latest daily close: ${latestClose ?? 'n/a'}`,
            `30d range high/low: ${rangeHigh ?? 'n/a'} / ${rangeLow ?? 'n/a'}`,
            `EMA20/50/200 (1d): ${indicator?.ema20 ?? 'n/a'} / ${indicator?.ema50 ?? 'n/a'} / ${indicator?.ema200 ?? 'n/a'}`,
            `ATR14 (1d): ${indicator?.atr14 ?? 'n/a'}`,
            `Live ref price: ${currentPrice ?? 'n/a'}`,
        ];

        return {
            summary: lines.join('\n'),
            currentPrice,
            supportHints,
            resistanceHints,
        };
    } catch (err) {
        logger.warn(
            '[CoinBlogGenerator] OHLCV summary unavailable for %s: %s',
            symbol,
            err instanceof Error ? err.message : String(err)
        );
        return {
            summary: `(No OHLCV data available for ${symbol})`,
            currentPrice: null,
            supportHints: [],
            resistanceHints: [],
        };
    }
}

function emptyIntel(symbol: string): Awaited<ReturnType<typeof getCoinIntelligence>> {
    return {
        coinSymbol: symbol,
        ath: null,
        athDate: null,
        trend8w: null,
        week52High: null,
        week52Low: null,
        priceChange30d: null,
        wikiBackground: null,
        dexBoostActive: false,
        dataSource: 'unknown',
    };
}

async function bustCoinPublicCaches(symbol: string): Promise<void> {
    try {
        const { deleteCache } = await import('../config/redis');
        await deleteCache('market-context:public:latest');
        await deleteCache(`market-context:public:coin:${symbol.toUpperCase()}`);
    } catch {
        /* non-blocking */
    }
}

/**
 * Full coin article pipeline:
 * context pack → DeepSeek draft → factual grounding → GPT polish → Zod → quality audit → insert.
 */
export async function generateCoinBlogSnapshot(
    options: GenerateCoinBlogOptions
): Promise<GenerateCoinBlogResult> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        throw new Error('MARKET_CONTEXT_DISABLED');
    }

    const symbol = options.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9]{2,15}$/.test(symbol)) {
        throw new Error('INVALID_SYMBOL');
    }
    // Full-auto (D13 newsjacking) may generate outside TRACKED_COINS; admin manual stays tracked-only
    const allowUntracked = Boolean(options.autoPublish);
    if (!allowUntracked && !isTrackedCoin(symbol)) {
        throw new Error('SYMBOL_NOT_TRACKED');
    }

    logger.info(
        '[CoinBlogGenerator] start symbol=%s autoPublish=%s tracked=%s',
        symbol,
        String(!!options.autoPublish),
        String(isTrackedCoin(symbol))
    );

    const [intel, trustedNews, ohlcv] = await Promise.all([
        getCoinIntelligence(symbol).catch((err) => {
            logger.warn(
                '[CoinBlogGenerator] intelligence unavailable for %s: %s',
                symbol,
                err instanceof Error ? err.message : String(err)
            );
            return emptyIntel(symbol);
        }),
        loadTrustedNewsForSymbol(symbol, {
            limit: options.newsLimit,
            daysBack: options.newsDaysBack,
        }).catch(() => []),
        buildOhlcvSummary(symbol),
    ]);

    const allowedNewsIds = new Set(trustedNews.map((n) => n.id));
    const primaryKeywords = buildPrimaryKeywords(symbol);
    const supportingKeywords = [
        `${symbol} market structure`,
        `${symbol} crypto news`,
        `${symbol} long term outlook`,
        'crypto market correlation',
    ];
    const peopleAlsoAsk = [
        `What is ${symbol}?`,
        `How has ${symbol} performed historically?`,
        `What news moves ${symbol}?`,
        `Is ${symbol} a good investment?`,
        `How does ${symbol} correlate with Bitcoin?`,
    ];

    const draftMessages = prompts.buildCoinBlogArticleMessages({
        symbol,
        mode: 'draft',
        primaryKeywords,
        supportingKeywords,
        peopleAlsoAsk,
        trustedNews,
        intelligence: {
            ath: intel.ath,
            athDate: intel.athDate,
            trend8w: intel.trend8w,
            week52High: intel.week52High,
            week52Low: intel.week52Low,
            priceChange30d: intel.priceChange30d,
            wikiBackground: intel.wikiBackground,
            currentPrice: ohlcv.currentPrice,
        },
        ohlcvSummary: ohlcv.summary,
        sectionKeys: [...COIN_BLOG_SECTION_KEYS],
        generatorVersion: COIN_BLOG_GENERATOR_VERSION,
    });

    const draftGateway = deepseekGateway || gateway;
    const draftModel = deepseekGateway
        ? env.DEEPSEEK_MODEL_DIRECT
        : env.DEEPSEEK_MODEL;

    const draftRaw = await draftGateway.chatRaw({
        model: draftModel,
        messages: draftMessages,
        temperature: 0.35,
        responseFormat: { type: 'json_object' },
        maxTokens: LONG_RESPONSE_MAX_TOKENS,
    });

    let draftParsed: unknown;
    try {
        draftParsed = parseJsonLoose(draftRaw);
    } catch (err) {
        logger.error(
            '[CoinBlogGenerator] draft JSON parse failed: %s',
            err instanceof Error ? err.message : String(err)
        );
        throw new Error('COIN_DRAFT_PARSE_FAILED');
    }

    // Factual grounding on numeric claims
    const draftRecord = isRecord(draftParsed) ? draftParsed : {};
    const numericNode = isRecord(draftRecord.numericClaims) ? draftRecord.numericClaims : {};
    const supportRaw = Array.isArray(numericNode.supportLevels)
        ? numericNode.supportLevels.filter((n): n is number => typeof n === 'number')
        : ohlcv.supportHints;
    const resistanceRaw = Array.isArray(numericNode.resistanceLevels)
        ? numericNode.resistanceLevels.filter((n): n is number => typeof n === 'number')
        : ohlcv.resistanceHints;
    const claimPrice =
        typeof numericNode.currentPrice === 'number'
            ? numericNode.currentPrice
            : ohlcv.currentPrice ?? 0;

    const grounding = validateFactualGrounding(supportRaw, resistanceRaw, claimPrice, 50);
    if (grounding.removedLevels.length > 0) {
        logger.info(
            '[CoinBlogGenerator] factual grounding removed %d levels for %s',
            grounding.removedLevels.length,
            symbol
        );
    }

    // Polish step — GPT-4.1-mini (CHAT_MODEL)
    const polishMessages = prompts.buildCoinBlogArticleMessages({
        symbol,
        mode: 'polish',
        primaryKeywords,
        supportingKeywords,
        peopleAlsoAsk,
        trustedNews,
        intelligence: {
            ath: intel.ath,
            athDate: intel.athDate,
            trend8w: intel.trend8w,
            week52High: intel.week52High,
            week52Low: intel.week52Low,
            priceChange30d: intel.priceChange30d,
            wikiBackground: intel.wikiBackground,
            currentPrice: ohlcv.currentPrice,
        },
        ohlcvSummary: ohlcv.summary,
        sectionKeys: [...COIN_BLOG_SECTION_KEYS],
        generatorVersion: COIN_BLOG_GENERATOR_VERSION,
        draftJson: JSON.stringify({
            ...draftRecord,
            numericClaims: {
                supportLevels: grounding.sanitizedSupport,
                resistanceLevels: grounding.sanitizedResistance,
                currentPrice: claimPrice || null,
            },
        }),
    });

    const polishRaw = await polishGateway.chatRaw({
        model: env.CHAT_MODEL,
        messages: polishMessages,
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
        maxTokens: LONG_RESPONSE_MAX_TOKENS,
    });

    let polishParsed: unknown;
    try {
        polishParsed = parseJsonLoose(polishRaw);
    } catch {
        // Fallback to draft if polish parse fails
        logger.warn('[CoinBlogGenerator] polish parse failed — using draft for %s', symbol);
        polishParsed = draftParsed;
    }

    const nowIso = new Date().toISOString();
    const polishRecord = isRecord(polishParsed) ? polishParsed : {};
    let sections = normalizeSections(
        polishRecord.sections ?? draftRecord.sections,
        allowedNewsIds,
        nowIso,
        symbol
    );
    sections = ensureInternalBlogLinks(sections, symbol);

    let seoMeta: MarketContextSeoMeta = {
        metaTitle: `${symbol} price analysis | OnlyAlpha Insights`.slice(0, 60),
        metaDescription:
            `Educational ${symbol} market context: structure, news, and historical performance. Not financial advice.`.slice(
                0,
                160
            ),
        seoKeywords: primaryKeywords,
    };

    if (isRecord(polishRecord.seo_meta)) {
        const sm = polishRecord.seo_meta;
        seoMeta = clampMeta(
            {
                metaTitle: typeof sm.metaTitle === 'string' ? sm.metaTitle : seoMeta.metaTitle,
                metaDescription:
                    typeof sm.metaDescription === 'string'
                        ? sm.metaDescription
                        : seoMeta.metaDescription,
                seoKeywords: Array.isArray(sm.seoKeywords)
                    ? sm.seoKeywords.filter((k): k is string => typeof k === 'string')
                    : seoMeta.seoKeywords,
            },
            symbol
        );
    } else if (isRecord(draftRecord.seo_meta)) {
        const sm = draftRecord.seo_meta;
        seoMeta = clampMeta(
            {
                metaTitle: typeof sm.metaTitle === 'string' ? sm.metaTitle : seoMeta.metaTitle,
                metaDescription:
                    typeof sm.metaDescription === 'string'
                        ? sm.metaDescription
                        : seoMeta.metaDescription,
                seoKeywords: Array.isArray(sm.seoKeywords)
                    ? sm.seoKeywords.filter((k): k is string => typeof k === 'string')
                    : seoMeta.seoKeywords,
            },
            symbol
        );
    }

    // Zod validation (lengths + shape)
    const zodInput = {
        sections: Object.fromEntries(
            COIN_BLOG_SECTION_KEYS.map((k) => [
                k,
                {
                    content: sections[k].content,
                    sourceNewsIds: sections[k].sourceNewsIds,
                },
            ])
        ),
        seo_meta: seoMeta,
    };

    const validated = coinBlogAiSchema.safeParse(zodInput);
    if (!validated.success) {
        logger.warn(
            '[CoinBlogGenerator] zod validation issues for %s: %s',
            symbol,
            validated.error.message.slice(0, 300)
        );
        // Soft-repair: clamp meta; keep sections already normalized with min content
        seoMeta = clampMeta(seoMeta, symbol);
    } else {
        seoMeta = clampMeta(validated.data.seo_meta, symbol);
    }

    // Quality auditor (every run) — adapt to ArticleWriterResult shape
    const fullArticle = COIN_BLOG_SECTION_KEYS.map((k) => sections[k].content).join('\n\n');
    const articleForAudit: ArticleWriterResult = {
        headline: seoMeta.metaTitle,
        hook: sections.heroWhatIs.content.slice(0, 280),
        fullArticle,
        metaTitle: seoMeta.metaTitle,
        metaDescription: seoMeta.metaDescription,
        seoKeywords: seoMeta.seoKeywords,
    };

    let qualityScore: number | null = null;
    try {
        const auditGw = deepseekGateway || polishGateway;
        const audit = await auditArticleQuality(
            auditGw,
            JSON.stringify({
                symbol,
                intelligence: intel,
                trustedNewsIds: trustedNews.map((n) => n.id),
                groundingRemoved: grounding.removedLevels,
            }),
            articleForAudit
        );
        qualityScore = audit.score;
        if (!audit.passed) {
            logger.warn(
                '[CoinBlogGenerator] quality audit score=%d issues=%s',
                audit.score,
                audit.issues.slice(0, 3).join('; ')
            );
        }
    } catch (err) {
        logger.warn(
            '[CoinBlogGenerator] quality audit error: %s',
            err instanceof Error ? err.message : String(err)
        );
    }

    const now = new Date();
    const snapshotKey = `mc_coin_${symbol.toLowerCase()}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const newsIds = trustedNews.map((n) => n.id);
    const autoPublish = Boolean(options.autoPublish);
    const day = now.toISOString().slice(0, 10);

    const seoScore = computeCoinBlogSeoScore({
        symbol,
        seoMeta,
        sections,
    });

    // Unique partial index: at most one published coin page per symbol — archive first
    if (autoPublish) {
        await db
            .update(marketContextSnapshots)
            .set({ status: 'archived', updatedAt: now })
            .where(
                and(
                    eq(marketContextSnapshots.kind, 'coin'),
                    eq(marketContextSnapshots.symbol, symbol),
                    eq(marketContextSnapshots.status, 'published')
                )
            );
    }

    // Insert as draft first; publish path handles status + cache bust when autoPublish
    const inserted = await db
        .insert(marketContextSnapshots)
        .values({
            snapshotKey,
            kind: 'coin',
            weekLabel: null,
            status: 'draft',
            sections,
            newsIds,
            marketDataVersion: `mc-coin-md-${day}`,
            generatorVersion: COIN_BLOG_GENERATOR_VERSION,
            generatedAt: now,
            publishedAt: null,
            createdBy: options.createdBy ?? (autoPublish ? 'full-auto' : null),
            symbol,
            seoMeta,
            autoPublished: false,
            seoScore,
            updatedAt: now,
        })
        .returning();

    const snapshot = inserted[0];

    if (autoPublish) {
        try {
            await publishMarketContextSnapshot(snapshot.id, options.createdBy ?? 'full-auto');
            await db
                .update(marketContextSnapshots)
                .set({ autoPublished: true, updatedAt: new Date() })
                .where(eq(marketContextSnapshots.id, snapshot.id));
        } catch (pubErr) {
            const msg = pubErr instanceof Error ? pubErr.message : String(pubErr);
            if (msg !== 'SNAPSHOT_NOT_FOUND') {
                logger.warn('[CoinBlogGenerator] publish step: %s', msg);
            }
        }
        await bustCoinPublicCaches(symbol);
        logMarketContextActivity('coin_full_auto_published', {
            symbol,
            snapshotId: snapshot.id,
            snapshotKey: snapshot.snapshotKey,
            newsCount: newsIds.length,
            qualityScore,
        });
    }

    logger.info(
        '[CoinBlogGenerator] done symbol=%s id=%d status=%s news=%d quality=%s',
        symbol,
        snapshot.id,
        autoPublish ? 'published' : 'draft',
        newsIds.length,
        qualityScore ?? 'n/a'
    );

    const finalRows = await db
        .select()
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.id, snapshot.id))
        .limit(1);

    return {
        snapshot: finalRows[0] ?? snapshot,
        newsCount: newsIds.length,
        sectionKeys: [...COIN_BLOG_SECTION_KEYS],
        seoMeta,
        qualityScore,
        autoPublished: autoPublish,
    };
}

/**
 * Wire full-auto path from B2 severity=3 without published coin page.
 * Must be called at boot (server.ts) so ingest cron path has a live handler — not admin-only load.
 */
export function wireFullAutoCoinHandler(): void {
    registerFullAutoCoinHandler(async ({ symbol, newsId, title }) => {
        logMarketContextActivity('full_auto_coin_generate_start', {
            symbol,
            newsId,
            title,
        });
        await generateCoinBlogSnapshot({
            symbol,
            createdBy: 'full-auto',
            autoPublish: true,
        });
    });
    logger.info('[CoinBlogGenerator] full-auto coin handler registered');
}
