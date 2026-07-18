import { createHash, randomUUID } from 'crypto';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
    marketNewsItems,
    marketContextSnapshots,
    type MarketContextSectionKey,
    type MarketContextSections,
    type MarketContextSection,
    type MarketContextSnapshot,
} from '../models/marketContext.model';
import { PromptFactory } from './ai/prompt-factory';
import { AIGateway, LONG_RESPONSE_MAX_TOKENS } from './ai/ai-gateway';
import { logger } from '../utils/logger';

export const MARKET_CONTEXT_GENERATOR_VERSION = 'MC-v1';

export interface SearchIntentPack {
    primaryIntent: 'Informational' | 'Educational' | 'Mixed';
    primaryKeyword: string;
    supportingKeywords: string[];
    peopleAlsoAsk: string[];
    writingConstraints: string[];
}

export interface TrustedNewsForGeneration {
    id: number;
    title: string;
    body: string | null;
    sourceName: string | null;
    publishedAt: string | null;
    symbols: string[];
}

export interface GenerateSnapshotOptions {
    kind?: string;
    weekLabel?: string | null;
    createdBy?: string | null;
    newsLimit?: number;
    newsDaysBack?: number;
    marketDataVersion?: string;
}

export interface GenerateSnapshotResult {
    snapshot: MarketContextSnapshot;
    newsCount: number;
    sectionKeys: MarketContextSectionKey[];
}

const SECTION_KEYS: MarketContextSectionKey[] = [
    'overview',
    'btcCorrelation',
    'liquidity',
    'newsSensitivity',
    'geopolitics',
    'thisWeek',
    'outlook',
    'faq',
];

const SECTION_PUBLIC_H2: Record<MarketContextSectionKey, string> = {
    overview: 'Why is the crypto market moving today?',
    btcCorrelation: 'How Bitcoin moves altcoins (dominance explained)',
    liquidity: 'How liquidity affects crypto prices',
    newsSensitivity: 'How news moves crypto markets',
    geopolitics: 'How macro events and geopolitics affect crypto',
    thisWeek: 'Crypto market this week: what moved and why',
    outlook: 'Is crypto going to recover? Structural scenarios (NFA)',
    faq: 'People also ask',
};

const DEFAULT_WRITING_CONSTRAINTS: string[] = [
    'English only for all copy',
    'No BUY or SELL language; use BULLISH/BEARISH/NEUTRAL frameworks only',
    'No price targets or entry/exit instructions',
    'Include Not Financial Advice (NFA) framing where markets are discussed',
    'No keyword stuffing; natural search-intent language',
    'Do not compete with Terminal live per-coin analysis',
    'Do not invent news events not present in trusted news list',
    'Every section must satisfy a search intent (G17); no empty template padding',
];

/**
 * DEC-040 Search Intent Map seed → SearchIntentPack (no seo_keywords table yet).
 */
export function buildDefaultSearchIntentPack(): SearchIntentPack {
    return {
        primaryIntent: 'Informational',
        primaryKeyword: 'crypto market today',
        supportingKeywords: [
            'why is crypto crashing today',
            'why is crypto going down',
            'why is bitcoin going down',
            'crypto market analysis',
            'bitcoin price analysis today',
            'is crypto crashing',
            'crypto news today',
            'crypto market news',
            'bitcoin dominance explained',
            'why are altcoins falling',
            'how liquidity affects crypto prices',
            'crypto market sentiment',
            'does the fed affect crypto',
            'is crypto going to recover',
            'crypto market this week',
        ],
        peopleAlsoAsk: [
            'Why is Bitcoin falling today?',
            'Is crypto crashing?',
            'Why are altcoins down when BTC is flat?',
            'What affects Bitcoin price beyond charts?',
            'Is crypto going to recover?',
            'Does the Fed affect crypto?',
            'How does liquidity affect crypto prices?',
        ],
        writingConstraints: DEFAULT_WRITING_CONSTRAINTS,
    };
}

function isoWeekLabel(d = new Date()): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function stripBuySellLanguage(text: string): string {
    return text
        .replace(/\b(buy|sell|long now|short now)\b/gi, (m) => {
            const lower = m.toLowerCase();
            if (lower === 'buy') return 'accumulate (educational)';
            if (lower === 'sell') return 'reduce exposure (educational)';
            return 'reposition (educational)';
        });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseSectionsFromAi(
    raw: unknown,
    allowedNewsIds: Set<number>,
    nowIso: string
): MarketContextSections {
    if (!isRecord(raw)) {
        throw new Error('AI response is not an object');
    }
    const sectionsNode = isRecord(raw.sections) ? raw.sections : raw;
    const result = {} as MarketContextSections;

    for (const key of SECTION_KEYS) {
        const node = sectionsNode[key];
        let content = '';
        let sourceNewsIds: number[] = [];

        if (typeof node === 'string') {
            content = node.trim();
        } else if (isRecord(node)) {
            content = typeof node.content === 'string' ? node.content.trim() : '';
            sourceNewsIds = parseSourceNewsIds(node.sourceNewsIds, allowedNewsIds);
        }

        if (!content) {
            content = `## ${SECTION_PUBLIC_H2[key]}\n\n_Content unavailable for this draft. Not financial advice._`;
        } else {
            content = stripBuySellLanguage(content);
            if (!content.trimStart().startsWith('#')) {
                content = `## ${SECTION_PUBLIC_H2[key]}\n\n${content}`;
            }
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

const writerGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 120000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

const prompts = new PromptFactory();

export async function loadTrustedNewsWindow(options?: {
    limit?: number;
    daysBack?: number;
}): Promise<TrustedNewsForGeneration[]> {
    const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
    const daysBack = Math.min(Math.max(options?.daysBack ?? 14, 1), 90);
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

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
                gte(marketNewsItems.publishedAt, since)
            )
        )
        .orderBy(desc(marketNewsItems.publishedAt))
        .limit(limit);

    // Fallback: if no recent trusted, take latest trusted regardless of date
    const effective =
        rows.length > 0
            ? rows
            : await db
                  .select({
                      id: marketNewsItems.id,
                      title: marketNewsItems.title,
                      body: marketNewsItems.body,
                      sourceName: marketNewsItems.sourceName,
                      publishedAt: marketNewsItems.publishedAt,
                      symbols: marketNewsItems.symbols,
                  })
                  .from(marketNewsItems)
                  .where(eq(marketNewsItems.trust, 'trusted'))
                  .orderBy(desc(marketNewsItems.publishedAt))
                  .limit(limit);

    return effective.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        sourceName: r.sourceName,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        symbols: Array.isArray(r.symbols) ? r.symbols : [],
    }));
}

function resolveMarketDataVersion(explicit?: string): string {
    if (explicit && explicit.trim()) return explicit.trim();
    const day = new Date().toISOString().slice(0, 10);
    return `mc-md-${day}`;
}

export async function generateMarketContextSnapshot(
    options: GenerateSnapshotOptions = {}
): Promise<GenerateSnapshotResult> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        throw new Error('MARKET_CONTEXT_DISABLED');
    }

    const trustedNews = await loadTrustedNewsWindow({
        limit: options.newsLimit,
        daysBack: options.newsDaysBack,
    });

    const pack = buildDefaultSearchIntentPack();
    const marketDataVersion = resolveMarketDataVersion(options.marketDataVersion);
    const weekLabel = options.weekLabel ?? isoWeekLabel();
    const kind = options.kind?.trim() || 'weekly';
    const generatedAt = new Date();
    const nowIso = generatedAt.toISOString();

    const messages = prompts.buildMarketContextSnapshotMessages({
        searchIntentPack: pack,
        trustedNews: trustedNews.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            sourceName: n.sourceName,
            publishedAt: n.publishedAt,
            symbols: n.symbols,
        })),
        marketDataVersion,
        generatorVersion: MARKET_CONTEXT_GENERATOR_VERSION,
        weekLabel,
        sectionKeys: SECTION_KEYS,
        sectionPublicH2: SECTION_PUBLIC_H2,
    });

    logger.info(
        '[MarketContextGenerator] generating draft news=%d marketDataVersion=%s',
        trustedNews.length,
        marketDataVersion
    );

    const raw = await writerGateway.chatRaw({
        model: env.WRITER_MODEL,
        messages,
        temperature: 0.4,
        responseFormat: { type: 'json_object' },
        maxTokens: LONG_RESPONSE_MAX_TOKENS,
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned) as unknown;
    }

    const allowed = new Set(trustedNews.map((n) => n.id));
    const sections = parseSectionsFromAi(parsed, allowed, nowIso);
    const newsIds = trustedNews.map((n) => n.id);

    const snapshotKey = `mc_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const inserted = await db
        .insert(marketContextSnapshots)
        .values({
            snapshotKey,
            kind,
            weekLabel,
            status: 'draft',
            sections,
            newsIds,
            marketDataVersion,
            generatorVersion: MARKET_CONTEXT_GENERATOR_VERSION,
            generatedAt,
            publishedAt: null,
            createdBy: options.createdBy ?? 'system',
            updatedAt: generatedAt,
        })
        .returning();

    const snapshot = inserted[0];
    logger.info(
        '[MarketContextGenerator] draft saved id=%d key=%s sections=%d',
        snapshot.id,
        snapshot.snapshotKey,
        SECTION_KEYS.length
    );

    return {
        snapshot,
        newsCount: newsIds.length,
        sectionKeys: SECTION_KEYS,
    };
}

export async function listMarketContextSnapshots(options?: {
    status?: 'draft' | 'published' | 'archived';
    page?: number;
    limit?: number;
}): Promise<{
    snapshots: Array<{
        id: number;
        snapshotKey: string;
        kind: string;
        weekLabel: string | null;
        status: string;
        newsIds: number[];
        marketDataVersion: string | null;
        generatorVersion: string;
        generatedAt: string | null;
        publishedAt: string | null;
        createdBy: string | null;
        createdAt: string;
        sectionCount: number;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
    const page = Math.max(options?.page ?? 1, 1);
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const offset = (page - 1) * limit;

    const whereClause = options?.status
        ? eq(marketContextSnapshots.status, options.status)
        : undefined;

    const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketContextSnapshots)
        .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);

    const rows = await db
        .select({
            id: marketContextSnapshots.id,
            snapshotKey: marketContextSnapshots.snapshotKey,
            kind: marketContextSnapshots.kind,
            weekLabel: marketContextSnapshots.weekLabel,
            status: marketContextSnapshots.status,
            sections: marketContextSnapshots.sections,
            newsIds: marketContextSnapshots.newsIds,
            marketDataVersion: marketContextSnapshots.marketDataVersion,
            generatorVersion: marketContextSnapshots.generatorVersion,
            generatedAt: marketContextSnapshots.generatedAt,
            publishedAt: marketContextSnapshots.publishedAt,
            createdBy: marketContextSnapshots.createdBy,
            createdAt: marketContextSnapshots.createdAt,
        })
        .from(marketContextSnapshots)
        .where(whereClause)
        .orderBy(desc(marketContextSnapshots.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        snapshots: rows.map((r) => {
            const sections = r.sections && typeof r.sections === 'object' ? r.sections : {};
            return {
                id: r.id,
                snapshotKey: r.snapshotKey,
                kind: r.kind,
                weekLabel: r.weekLabel,
                status: r.status,
                newsIds: Array.isArray(r.newsIds) ? r.newsIds : [],
                marketDataVersion: r.marketDataVersion,
                generatorVersion: r.generatorVersion,
                generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
                publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
                createdBy: r.createdBy,
                createdAt: r.createdAt ? r.createdAt.toISOString() : '',
                sectionCount: Object.keys(sections).length,
            };
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
    };
}

/**
 * Full snapshot including sections — admin review/preview (draft or published).
 */
export async function getMarketContextSnapshotById(id: number): Promise<{
    id: number;
    snapshotKey: string;
    kind: string;
    weekLabel: string | null;
    status: string;
    sections: Partial<MarketContextSections>;
    newsIds: number[];
    marketDataVersion: string | null;
    generatorVersion: string;
    generatedAt: string | null;
    publishedAt: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string | null;
} | null> {
    const rows = await db
        .select()
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.id, id))
        .limit(1);

    if (rows.length === 0) return null;

    const s = rows[0];
    const sections =
        s.sections && typeof s.sections === 'object'
            ? (s.sections as Partial<MarketContextSections>)
            : {};

    return {
        id: s.id,
        snapshotKey: s.snapshotKey,
        kind: s.kind,
        weekLabel: s.weekLabel,
        status: s.status,
        sections,
        newsIds: Array.isArray(s.newsIds) ? s.newsIds : [],
        marketDataVersion: s.marketDataVersion,
        generatorVersion: s.generatorVersion,
        generatedAt: s.generatedAt ? s.generatedAt.toISOString() : null,
        publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
        createdBy: s.createdBy,
        createdAt: s.createdAt ? s.createdAt.toISOString() : '',
        updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null,
    };
}

/** Exposed for tests / admin preview of hash stability */
export function hashMarketDataVersionSeed(seed: string): string {
    return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export interface PublicMarketContextPayload {
    available: boolean;
    snapshot: {
        id: number;
        snapshotKey: string;
        kind: string;
        weekLabel: string | null;
        status: 'published';
        sections: Partial<MarketContextSections>;
        marketDataVersion: string | null;
        generatorVersion: string;
        generatedAt: string | null;
        publishedAt: string | null;
        updatedAt: string | null;
    } | null;
}

/**
 * Latest published snapshot for public hub (no drafts).
 */
export async function getLatestPublishedMarketContext(): Promise<PublicMarketContextPayload> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        return { available: false, snapshot: null };
    }

    const rows = await db
        .select()
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.status, 'published'))
        .orderBy(desc(marketContextSnapshots.publishedAt), desc(marketContextSnapshots.id))
        .limit(1);

    if (rows.length === 0) {
        return { available: false, snapshot: null };
    }

    const s = rows[0];
    const sections =
        s.sections && typeof s.sections === 'object'
            ? (s.sections as Partial<MarketContextSections>)
            : {};

    return {
        available: true,
        snapshot: {
            id: s.id,
            snapshotKey: s.snapshotKey,
            kind: s.kind,
            weekLabel: s.weekLabel,
            status: 'published',
            sections,
            marketDataVersion: s.marketDataVersion,
            generatorVersion: s.generatorVersion,
            generatedAt: s.generatedAt ? s.generatedAt.toISOString() : null,
            publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
            updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null,
        },
    };
}

async function bustPublicMarketContextCache(): Promise<void> {
    try {
        const { deleteCache } = await import('../config/redis');
        await deleteCache('market-context:public:latest');
    } catch {
        /* non-blocking */
    }
}

export async function publishMarketContextSnapshot(
    id: number,
    actor: string
): Promise<MarketContextSnapshot> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        throw new Error('MARKET_CONTEXT_DISABLED');
    }

    const existing = await db
        .select()
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.id, id))
        .limit(1);

    if (existing.length === 0) {
        throw new Error('SNAPSHOT_NOT_FOUND');
    }

    const row = existing[0];
    if (row.status === 'archived') {
        throw new Error('SNAPSHOT_ARCHIVED');
    }

    const now = new Date();
    const updated = await db
        .update(marketContextSnapshots)
        .set({
            status: 'published',
            publishedAt: row.publishedAt ?? now,
            updatedAt: now,
            createdBy: row.createdBy ?? actor,
        })
        .where(eq(marketContextSnapshots.id, id))
        .returning();

    await bustPublicMarketContextCache();
    return updated[0];
}

export async function archiveMarketContextSnapshot(
    id: number
): Promise<MarketContextSnapshot> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        throw new Error('MARKET_CONTEXT_DISABLED');
    }

    const existing = await db
        .select({ id: marketContextSnapshots.id })
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.id, id))
        .limit(1);

    if (existing.length === 0) {
        throw new Error('SNAPSHOT_NOT_FOUND');
    }

    const now = new Date();
    const updated = await db
        .update(marketContextSnapshots)
        .set({
            status: 'archived',
            updatedAt: now,
        })
        .where(eq(marketContextSnapshots.id, id))
        .returning();

    await bustPublicMarketContextCache();
    return updated[0];
}

export async function unpublishMarketContextSnapshot(
    id: number
): Promise<MarketContextSnapshot> {
    if (!env.MARKET_CONTEXT_ENABLED) {
        throw new Error('MARKET_CONTEXT_DISABLED');
    }

    const existing = await db
        .select()
        .from(marketContextSnapshots)
        .where(eq(marketContextSnapshots.id, id))
        .limit(1);

    if (existing.length === 0) {
        throw new Error('SNAPSHOT_NOT_FOUND');
    }

    if (existing[0].status !== 'published') {
        throw new Error('SNAPSHOT_NOT_PUBLISHED');
    }

    const now = new Date();
    const updated = await db
        .update(marketContextSnapshots)
        .set({
            status: 'draft',
            updatedAt: now,
        })
        .where(eq(marketContextSnapshots.id, id))
        .returning();

    await bustPublicMarketContextCache();
    return updated[0];
}
