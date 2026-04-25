import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { getCache, setCache } from '../config/redis';
import {
    marketInsights, dailyAlphaFocus, dailyMarketMood,
    radarSignals, airdropProjects, priceSnapshots,
    coinMasterArticles, coinTimelineUpdates, coinIntelligenceCache,
    signalPerformance
} from '../models/index';
import { getStrategicOutlook, getActiveEventResponses } from '../services/strategicOutlook.service';
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

        // Use DISTINCT ON to get only the LATEST signal per coin_symbol.
        // This prevents duplicate coin cards in the radar feed when a coin
        // has had multiple signals generated over time.
        const rawSignals = await db.execute(sql`
            SELECT DISTINCT ON (coin_symbol)
                id, coin_symbol, signal_text, sentiment, impact_score, news_id, created_at
            FROM radar_signals
            WHERE coin_symbol IS NOT NULL
            ORDER BY coin_symbol, created_at DESC
        `);

        const formatTime = (req as unknown as { formatTime?: (date: Date | string | number) => string }).formatTime;

        let mappedSignals = (rawSignals.rows as Array<Record<string, unknown>>).map(s => ({
            id: s.id as number,
            coinSymbol: s.coin_symbol as string,
            coin: s.coin_symbol as string,
            signalText: s.signal_text as string,
            signal: s.signal_text as string,
            sentiment: s.sentiment as string | null,
            impactScore: s.impact_score as number | null,
            newsId: s.news_id as number | null,
            createdAt: s.created_at as Date,
            formattedTime: formatTime?.(s.created_at as Date | string | number) ?? null
        }));

        // Sort by recency after per-coin deduplication, then apply pagination
        mappedSignals.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        mappedSignals = mappedSignals.slice(offset, offset + limit);

        await setCache(cacheKey, mappedSignals, 60);
        res.json(mappedSignals);
    } catch (err) { next(err); }
}

export async function getMasterArticleCoins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'master:coins:list';
        const cached = await getCache(cacheKey);
        if (cached !== null) { res.json(cached); return; }

        const result = await db.execute(sql`
            SELECT DISTINCT coin_symbol FROM coin_master_articles WHERE coin_symbol IS NOT NULL
        `);

        const coins = (result.rows as Array<Record<string, unknown>>).map(
            (row) => String(row.coin_symbol).toUpperCase()
        );
        const output = { coins };
        await setCache(cacheKey, output, 300);
        res.json(output);
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

        const fetchLimit = limit + offset;

        const buildTimeline = () => {
            const q = db.select({
                id: coinTimelineUpdates.id,
                coinSymbol: coinTimelineUpdates.coinSymbol,
                headline: sql<string>`'Update'`,
                summary: coinTimelineUpdates.updateText,
                hook: sql<null>`null`,
                metaTitle: sql<null>`null`,
                metaDescription: sql<null>`null`,
                seoKeywords: sql<null>`null`,
                sourceUrl: sql<null>`null`,
                sentiment: coinTimelineUpdates.sentiment,
                impactScore: coinTimelineUpdates.impactScore,
                isBreaking: sql<number>`0`,
                publishedAt: coinTimelineUpdates.createdAt,
                createdAt: coinTimelineUpdates.createdAt
            }).from(coinTimelineUpdates);
            return coin && coin.toUpperCase() !== 'ALL'
                ? q.where(eq(coinTimelineUpdates.coinSymbol, coin.toUpperCase())).orderBy(desc(coinTimelineUpdates.createdAt)).limit(fetchLimit)
                : q.orderBy(desc(coinTimelineUpdates.createdAt)).limit(fetchLimit);
        };

        const buildMaster = () => {
            const q = db.select({
                id: coinMasterArticles.id,
                coinSymbol: coinMasterArticles.coinSymbol,
                headline: coinMasterArticles.headline,
                summary: coinMasterArticles.coreCatalyst,
                hook: coinMasterArticles.hook,
                metaTitle: coinMasterArticles.metaTitle,
                metaDescription: coinMasterArticles.metaDescription,
                seoKeywords: coinMasterArticles.seoKeywords,
                sourceUrl: sql<null>`null`,
                sentiment: coinMasterArticles.sentiment,
                impactScore: coinMasterArticles.confidenceScore,
                isBreaking: sql<number>`1`,
                publishedAt: sql<Date>`GREATEST(${coinMasterArticles.updatedAt}, COALESCE(${coinMasterArticles.lastMajorUpdate}, '1970-01-01'), COALESCE(${coinMasterArticles.lastMinorUpdate}, '1970-01-01'))`,
                createdAt: coinMasterArticles.createdAt
            }).from(coinMasterArticles);
            return coin && coin.toUpperCase() !== 'ALL'
                ? q.where(eq(coinMasterArticles.coinSymbol, coin.toUpperCase())).orderBy(desc(sql`GREATEST(${coinMasterArticles.updatedAt}, COALESCE(${coinMasterArticles.lastMajorUpdate}, '1970-01-01'), COALESCE(${coinMasterArticles.lastMinorUpdate}, '1970-01-01'))`)).limit(fetchLimit)
                : q.orderBy(desc(sql`GREATEST(${coinMasterArticles.updatedAt}, COALESCE(${coinMasterArticles.lastMajorUpdate}, '1970-01-01'), COALESCE(${coinMasterArticles.lastMinorUpdate}, '1970-01-01'))`)).limit(fetchLimit);
        };

        const [timelineRows, masterRows] = await Promise.all([buildTimeline(), buildMaster()]);

        const combined = [...timelineRows, ...masterRows].sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        ).slice(offset, offset + limit);

        const formatTime = (req as unknown as { formatTime?: (date: Date | string | number) => string }).formatTime;
        const mappedNews = combined.map((n) => ({
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

export async function getArchiveArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'archive:all';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const articles = await db
            .select({
                id: coinMasterArticles.id,
                coinSymbol: coinMasterArticles.coinSymbol,
                headline: coinMasterArticles.headline,
                hook: coinMasterArticles.hook,
                metaTitle: coinMasterArticles.metaTitle,
                metaDescription: coinMasterArticles.metaDescription,
                sentiment: coinMasterArticles.sentiment,
                verdict: coinMasterArticles.verdict,
                convictionScore: coinMasterArticles.convictionScore,
                posture: coinMasterArticles.posture,
                riskTags: coinMasterArticles.riskTags,
                majorUpdateCount: coinMasterArticles.majorUpdateCount,
                minorUpdateCount: coinMasterArticles.minorUpdateCount,
                createdAt: coinMasterArticles.createdAt,
                updatedAt: coinMasterArticles.updatedAt,
            })
            .from(coinMasterArticles)
            .orderBy(desc(coinMasterArticles.updatedAt));

        await setCache(cacheKey, articles, 3600);
        res.json(articles);
    } catch (err) { next(err); }
}

export async function getStrategicOutlookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const symbol = String(req.params['symbol'] || '').toUpperCase();
        if (!symbol) throw new AppError('Symbol is required', 400);

        const cacheKey = `outlook:${symbol}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const [outlook, eventResponses] = await Promise.all([
            getStrategicOutlook(symbol),
            getActiveEventResponses(symbol),
        ]);

        const response = {
            outlook,
            activeEvents: eventResponses,
        };

        await setCache(cacheKey, response, 300);
        res.json(response);
    } catch (err) { next(err); }
}

export async function getScorecardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'scorecard:latest';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const signals = await db.select()
            .from(signalPerformance)
            .orderBy(desc(signalPerformance.entryAt))
            .limit(100);

        const withPnl7d = signals.filter(s => s.pnl7d !== null);
        const wins7d = withPnl7d.filter(s => s.isWin7d === true);
        const totalSignals = signals.length;
        const winRate7d = withPnl7d.length > 0
            ? Math.round((wins7d.length / withPnl7d.length) * 100) : null;
        const avgReturn7d = withPnl7d.length > 0
            ? withPnl7d.reduce((sum, s) => sum + (s.pnl7d ?? 0), 0) / withPnl7d.length : null;

        const coinMap = new Map<string, { signals: number; wins: number; totalPnl: number }>();
        for (const s of withPnl7d) {
            const existing = coinMap.get(s.coinSymbol) ?? { signals: 0, wins: 0, totalPnl: 0 };
            existing.signals++;
            if (s.isWin7d) existing.wins++;
            existing.totalPnl += s.pnl7d ?? 0;
            coinMap.set(s.coinSymbol, existing);
        }

        const bestCall = withPnl7d.length > 0
            ? withPnl7d.reduce((best, s) => (s.pnl7d ?? 0) > (best.pnl7d ?? -Infinity) ? s : best, withPnl7d[0])
            : null;

        const response = {
            overall: {
                totalSignals,
                winRate7d,
                avgReturn7d: avgReturn7d !== null ? parseFloat(avgReturn7d.toFixed(1)) : null,
                bestCall
            },
            recent: signals.slice(0, 20),
            perCoin: Object.fromEntries(coinMap),
        };

        await setCache(cacheKey, response, 300);
        res.json(response);
    } catch (err) { next(err); }
}

import { runAiWorkflow, backfillRadarSignals } from '../crons/aiWorkflow.cron';
import { runRoutineSync } from '../crons/airdropHunter.cron';
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
            console.log('[ForceSeed] No airdrop projects found — waiting for RSS hunter cron to populate.');
        } else {
            await runRoutineSync();
        }

        console.log('--- Force Seed Complete ---');
        res.json({ success: true, message: 'All crons executed successfully.' });
    } catch (err) {
        next(err);
    }
}
