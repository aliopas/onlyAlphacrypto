import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { getCache, setCache } from '../config/redis';
import {
    marketInsights, dailyAlphaFocus, dailyMarketMood,
    coinNews, radarSignals, airdropProjects, priceSnapshots
} from '../models/index';
import { desc, eq, gte, and, asc, sql } from 'drizzle-orm';
import { getLivePrices, getTopMovers } from '../services/binance.service';
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
        const [focus] = await db
            .select()
            .from(dailyAlphaFocus)
            .where(eq(dailyAlphaFocus.validForDate, today))
            .orderBy(desc(dailyAlphaFocus.selectedAt))
            .limit(1);

        if (!focus) {
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

        let priceChange24h = 0;
        if (latestPrice) {
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
                priceChange24h = ((latestPrice.price - oldPrice.price) / oldPrice.price) * 100;
            }
        }

        const mappedFocus = {
            ...focus,
            coin: focus.coinSymbol,
            confidence: focus.confidenceScore,
            summary: focus.executiveSummary,
            price: latestPrice ? latestPrice.price : 0,
            priceChange24h: priceChange24h
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

        const [{ count }] = await db
            .select({ count: sql<number>`COUNT(DISTINCT ${coinNews.coinSymbol})` })
            .from(coinNews);

        const result = { count };
        const cacheTtl = count === 0 ? 30 : 300;
        await setCache(cacheKey, result, cacheTtl);
        res.json(result);
    } catch (err) { next(err); }
}

export async function getLatestWire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const coinParam = req.query.coin as string | undefined;
        const limitParam = req.query.limit as string | undefined;

        const coin = Array.isArray(coinParam) ? coinParam[0] : coinParam;
        const limitStr = Array.isArray(limitParam) ? limitParam[0] : limitParam || '20';
        const limit = Math.min(parseInt(limitStr, 10) || 20, 100);

        const cacheKey = `wire:${coin || 'all'}:${limit}:${(req as unknown as { userTimezone?: string }).userTimezone || 'UTC'}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        let query = db.select().from(coinNews).$dynamic();
        if (coin && coin.toUpperCase() !== 'ALL') {
            query = query.where(eq(coinNews.coinSymbol, coin.toUpperCase()));
        }

        const news = await query
            .orderBy(desc(coinNews.publishedAt))
            .limit(limit);

        const formatTime = (req as unknown as { formatTime?: (date: Date | string | number) => string }).formatTime;
        const mappedNews = news.map(n => ({
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

        const [article] = await db.select().from(coinNews).where(eq(coinNews.id, id)).limit(1);
        if (!article) throw new AppError('Article not found', 404);
        res.json(article);
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
