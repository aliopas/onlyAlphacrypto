import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { getCache, setCache } from '../config/redis';
import {
    marketInsights, dailyAlphaFocus, dailyMarketMood,
    radarSignals, airdropProjects, priceSnapshots,
    coinMasterArticles, coinTimelineUpdates, coinIntelligenceCache
} from '../models/index';
import { desc, eq, gte, and, asc, sql } from 'drizzle-orm';
import { getLivePrices, getTopMovers } from '../services/binance.service';
import { getPriceWithFallback } from '../services/priceService';
import { AppError } from '../middleware/errorHandler';

export async function getCoinInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const coin = String(req.params['coin'] || '');
        const cacheKey = `insight:${coin}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const [insight] = await db
            .select()
            .from(marketInsights)
            .where(eq(marketInsights.coinSlug, coin.toLowerCase()))
            .orderBy(desc(marketInsights.analyzedAt))
            .limit(1);

        if (!insight) {
            res.json(null);
            return;
        }

        await setCache(cacheKey, insight, 300);
        res.json(insight);
    } catch (err) { next(err); }
}

export async function getAlphaFocus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'alpha-focus:today';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const today = new Date().toISOString().split('T')[0];

        let focus;
        try {
            const rows = await db
                .select()
                .from(dailyAlphaFocus)
                .where(eq(dailyAlphaFocus.validForDate, today))
                .orderBy(desc(dailyAlphaFocus.selectedAt))
                .limit(1);
            focus = rows[0] ?? null;
        } catch (dbErr) {
            console.error('[AlphaFocus] Query failed — stale schema or orphaned rows:', dbErr);
            await db.delete(dailyAlphaFocus).catch(() => {});
            res.json(null);
            return;
        }

        if (!focus || !focus.masterArticleId) {
            res.json(null);
            return;
        }

        const latestPriceRows = await db
            .select()
            .from(priceSnapshots)
            .where(eq(priceSnapshots.coinSymbol, focus.coinSymbol))
            .orderBy(desc(priceSnapshots.timestamp))
            .limit(1);

        const latestPrice = latestPriceRows[0];

        let finalPrice = latestPrice?.price || 0;
        let finalChange24h = 0;

        if (latestPrice && latestPrice.price > 0) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const oldPriceRows = await db
                .select()
                .from(priceSnapshots)
                .where(
                    and(
                        eq(priceSnapshots.coinSymbol, focus.coinSymbol),
                        gte(priceSnapshots.timestamp, twentyFourHoursAgo)
                    )
                )
                .orderBy(asc(priceSnapshots.timestamp))
                .limit(1);

            const oldPrice = oldPriceRows[0];
            if (oldPrice && oldPrice.price > 0) {
                finalChange24h = ((latestPrice.price - oldPrice.price) / oldPrice.price) * 100;
            }
        } else {
            // Fallback to live price
            const livePrice = await getPriceWithFallback(focus.coinSymbol);
            if (livePrice) {
                finalPrice = livePrice.price;
                finalChange24h = livePrice.change24h || 0;
            }
        }

        const mappedFocus = {
            ...focus,
            coin: focus.coinSymbol,
            confidence: focus.confidenceScore,
            summary: focus.executiveSummary,
            price: finalPrice,
            priceChange24h: finalChange24h
        };

        await setCache(cacheKey, mappedFocus, 600);
        res.json(mappedFocus);
    } catch (err) { next(err); }
}

export async function getRadarSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const limitParam = req.query.limit as string | undefined;
        const offsetParam = req.query.offset as string | undefined;
        const limit = Math.min(parseInt(limitParam || '20', 10) || 20, 100);
        const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

        const cacheKey = `radar:latest:${limit}:${offset}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const signals = await db
            .select()
            .from(radarSignals)
            .orderBy(desc(radarSignals.createdAt))
            .limit(limit)
            .offset(offset);

        const mappedSignals = signals.map(s => ({
            ...s,
            coin: s.coinSymbol,
            signal: s.signalText,
            formattedTime: (req as unknown as { formatTime?: (date: Date | string | number) => string }).formatTime?.(s.createdAt) ?? null
        }));

        await setCache(cacheKey, mappedSignals, 60);
        res.json(mappedSignals);
    } catch (err) { next(err); }
}

export async function getAssetCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'stats:asset-count';
        const cached = await getCache(cacheKey);
        if (cached !== null) { res.json(cached); return; }

        const result = await db.execute(sql`
            SELECT COUNT(DISTINCT sym)::int AS count FROM (
                SELECT DISTINCT coin_symbol AS sym FROM coin_master_articles WHERE coin_symbol IS NOT NULL
                UNION
                SELECT DISTINCT coin_symbol AS sym FROM coin_timeline_updates WHERE coin_symbol IS NOT NULL
                UNION
                SELECT DISTINCT coin_symbol AS sym FROM price_snapshots WHERE coin_symbol IS NOT NULL
            ) sub
        `);

        const count = Number((result.rows[0] as Record<string, unknown>)?.count ?? 0);
        const output = { count };
        const cacheTtl = count === 0 ? 30 : 300;
        await setCache(cacheKey, output, cacheTtl);
        res.json(output);
    } catch (err) { next(err); }
}

export async function getLatestWire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const coinParam = req.query.coin as string | undefined;
        const limitParam = req.query.limit as string | undefined;
        const offsetParam = req.query.offset as string | undefined;

        const coin = Array.isArray(coinParam) ? coinParam[0] : coinParam;
        const limitStr = Array.isArray(limitParam) ? limitParam[0] : limitParam || '20';
        const offsetStr = Array.isArray(offsetParam) ? offsetParam[0] : offsetParam || '0';
        const limit = Math.min(parseInt(limitStr, 10) || 20, 100);
        const offset = Math.max(parseInt(offsetStr, 10) || 0, 0);

        const cacheKey = `wire:${coin || 'all'}:${limit}:${offset}:${(req as unknown as { userTimezone?: string }).userTimezone || 'UTC'}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        type TimelineWireRow = {
            id: number;
            coinSymbol: string | null;
            headline: string | null;
            summary: unknown;
            hook: unknown;
            metaTitle: unknown;
            metaDescription: unknown;
            seoKeywords: unknown;
            sourceUrl: string | null;
            sentiment: string | null;
            impactScore: number | null;
            isBreaking: unknown;
            publishedAt: Date;
            createdAt: Date;
        };

        const timelineQuery = db.select({
            id: coinTimelineUpdates.id,
            coinSymbol: coinTimelineUpdates.coinSymbol,
            headline: sql`'Update'`,
            summary: coinTimelineUpdates.updateText,
            hook: sql`null`,
            metaTitle: sql`null`,
            metaDescription: sql`null`,
            seoKeywords: sql`null`,
            sourceUrl: sql`null`,
            sentiment: coinTimelineUpdates.sentiment,
            impactScore: coinTimelineUpdates.impactScore,
            isBreaking: sql`0`,
            publishedAt: coinTimelineUpdates.createdAt,
            createdAt: coinTimelineUpdates.createdAt
        }).from(coinTimelineUpdates);

        const masterQuery = db.select({
            id: coinMasterArticles.id,
            coinSymbol: coinMasterArticles.coinSymbol,
            headline: coinMasterArticles.headline,
            summary: coinMasterArticles.coreCatalyst,
            hook: coinMasterArticles.hook,
            metaTitle: coinMasterArticles.metaTitle,
            metaDescription: coinMasterArticles.metaDescription,
            seoKeywords: coinMasterArticles.seoKeywords,
            sourceUrl: sql`null`,
            sentiment: coinMasterArticles.sentiment,
            impactScore: coinMasterArticles.confidenceScore,
            isBreaking: sql`1`,
            publishedAt: coinMasterArticles.createdAt,
            createdAt: coinMasterArticles.createdAt
        }).from(coinMasterArticles);

        const filteredTimeline = coin && coin.toUpperCase() !== 'ALL'
            ? timelineQuery.where(eq(coinTimelineUpdates.coinSymbol, coin.toUpperCase()))
            : timelineQuery;

        const filteredMaster = coin && coin.toUpperCase() !== 'ALL'
            ? masterQuery.where(eq(coinMasterArticles.coinSymbol, coin.toUpperCase()))
            : masterQuery;

        const newsQuery = (filteredTimeline as any).union(filteredMaster as any);

        const news = await newsQuery
            .orderBy(desc(coinTimelineUpdates.createdAt))
            .limit(limit)
            .offset(offset);

        const formatTime = (req as unknown as { formatTime?: (date: Date | string | number) => string }).formatTime;
        const mappedNews = news.map((n: any) => ({
            ...n,
            formattedTime: formatTime?.(n.publishedAt) ?? null
        }));

        await setCache(cacheKey, mappedNews, 120);
        res.json(mappedNews);
    } catch (err) { next(err); }
}

export async function getWireById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idParam = req.params.id;
        const idString = Array.isArray(idParam) ? idParam[0] : idParam;
        const id = parseInt(idString as string, 10);
        if (isNaN(id)) throw new AppError('Invalid article ID', 400);

        // Try timeline first
        const [itemTimeline] = await db.select().from(coinTimelineUpdates).where(eq(coinTimelineUpdates.id, id)).limit(1);
        if (itemTimeline) {
            const mapped = {
                id: itemTimeline.id,
                coinSymbol: itemTimeline.coinSymbol,
                headline: 'Update',
                summary: itemTimeline.updateText,
                hook: null,
                metaTitle: null,
                metaDescription: null,
                seoKeywords: null,
                sourceUrl: null,
                sentiment: itemTimeline.sentiment,
                impactScore: itemTimeline.impactScore,
                isBreaking: 0,
                publishedAt: itemTimeline.createdAt,
                createdAt: itemTimeline.createdAt,
            };
            res.json(mapped);
            return;
        }

        // Try master
        const [itemMaster] = await db.select({
            id: coinMasterArticles.id,
            coinSymbol: coinMasterArticles.coinSymbol,
            headline: coinMasterArticles.headline,
            coreCatalyst: coinMasterArticles.coreCatalyst,
            hook: coinMasterArticles.hook,
            metaTitle: coinMasterArticles.metaTitle,
            metaDescription: coinMasterArticles.metaDescription,
            seoKeywords: coinMasterArticles.seoKeywords,
            sentiment: coinMasterArticles.sentiment,
            confidenceScore: coinMasterArticles.confidenceScore,
            createdAt: coinMasterArticles.createdAt
        }).from(coinMasterArticles).where(eq(coinMasterArticles.id, id)).limit(1);
        if (!itemMaster) throw new AppError('Article not found', 404);

        const mapped = {
            id: itemMaster.id,
            coinSymbol: itemMaster.coinSymbol,
            headline: itemMaster.headline,
            summary: itemMaster.coreCatalyst,
            hook: itemMaster.hook,
            metaTitle: itemMaster.metaTitle,
            metaDescription: itemMaster.metaDescription,
            seoKeywords: itemMaster.seoKeywords,
            sourceUrl: null,
            sentiment: itemMaster.sentiment,
            impactScore: itemMaster.confidenceScore,
            isBreaking: 1,
            publishedAt: itemMaster.createdAt,
            createdAt: itemMaster.createdAt,
        };
        res.json(mapped);
    } catch (err) { next(err); }
}

export async function getMasterArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const symbol = String(req.params['symbol'] || '').toUpperCase();
        if (!symbol) throw new AppError('Symbol is required', 400);

        const cacheKey = `master:${symbol}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const [master] = await db
            .select()
            .from(coinMasterArticles)
            .where(eq(coinMasterArticles.coinSymbol, symbol))
            .limit(1);

        if (!master) {
            res.json(null);
            return;
        }

        const timeline = await db
            .select()
            .from(coinTimelineUpdates)
            .where(eq(coinTimelineUpdates.masterArticleId, master.id))
            .orderBy(desc(coinTimelineUpdates.createdAt))
            .limit(10);

        const result = {
            masterArticle: master,
            timelineUpdates: timeline,
            convictionScore: master.convictionScore,
            posture: master.posture,
        };

        await setCache(cacheKey, result, 60);
        res.json(result);
    } catch (err) { next(err); }
}

export async function getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const symbol = String(req.params['symbol'] || '').toUpperCase();
        if (!symbol) throw new AppError('Symbol is required', 400);

        const offsetParam = req.query.offset as string | undefined;
        const limitParam = req.query.limit as string | undefined;
        const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);
        const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

        const cacheKey = `timeline:${symbol}:${offset}:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const [master] = await db
            .select({ id: coinMasterArticles.id })
            .from(coinMasterArticles)
            .where(eq(coinMasterArticles.coinSymbol, symbol))
            .limit(1);

        if (!master) {
            res.json({ updates: [], total: 0 });
            return;
        }

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(coinTimelineUpdates)
            .where(eq(coinTimelineUpdates.masterArticleId, master.id));

        const updates = await db
            .select()
            .from(coinTimelineUpdates)
            .where(eq(coinTimelineUpdates.masterArticleId, master.id))
            .orderBy(desc(coinTimelineUpdates.createdAt))
            .limit(limit)
            .offset(offset);

        const result = { updates, total: count };
        await setCache(cacheKey, result, 30);
        res.json(result);
    } catch (err) { next(err); }
}

export async function getMarketMood(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'mood:today';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const today = new Date().toISOString().split('T')[0];
        const [mood] = await db
            .select()
            .from(dailyMarketMood)
            .where(eq(dailyMarketMood.validForDate, today))
            .limit(1);

        if (!mood) {
            res.json(null);
            return;
        }
        await setCache(cacheKey, mood, 600);
        res.json(mood);
    } catch (err) { next(err); }
}

export async function getTopMoversController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'top-movers:10';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const movers = await getTopMovers(10);
        await setCache(cacheKey, movers, 30);
        res.json(movers);
    } catch (err) { next(err); }
}

import { runAiWorkflow, backfillRadarSignals } from '../crons/aiWorkflow.cron';
import { runDiscovery, runRoutineSync } from '../crons/airdropHunter.cron';
import { computeMarketMood } from '../crons/marketMood.cron';
import { selectDailyAlpha } from '../crons/dailyAlpha.cron';

export async function forceSeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        console.log('--- Force Seed Triggered ---');

        await runAiWorkflow();
        const backfillResult = await backfillRadarSignals();

        await selectDailyAlpha();
        await computeMarketMood();

        const [aCount] = await db.select({ id: airdropProjects.id }).from(airdropProjects).limit(1);
        if (!aCount) {
            await runDiscovery();
        } else {
            await runRoutineSync();
        }

        console.log('--- Force Seed Complete ---');
        res.json({ success: true, message: 'All crons executed successfully.' });
    } catch (err) {
        next(err);
    }
}
