import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { getCache, setCache } from '../config/redis';
import {
    marketInsights, dailyAlphaFocus, dailyMarketMood,
    coinNews, radarSignals, airdropProjects, priceSnapshots
} from '../models/index';
import { desc, eq, gte, and } from 'drizzle-orm';
import { getLivePrices, getTopMovers } from '../services/binance.service';
import { AppError } from '../middleware/errorHandler';

// GET /api/market/insights/:coin
export async function getCoinInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const coin = String(req.params['coin']);
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

        await setCache(cacheKey, insight, 300); // 5 min
        res.json(insight);
    } catch (err) { next(err); }
}

// GET /api/market/alpha-focus
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

        // Fetch latest price from priceSnapshots
        const [latestPrice] = await db
            .select()
            .from(priceSnapshots)
            .where(eq(priceSnapshots.coinSymbol, focus.coinSymbol))
            .orderBy(desc(priceSnapshots.timestamp))
            .limit(1);

        // Calculate real 24h price change
        let priceChange24h = 0;
        if (latestPrice) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const [oldPrice] = await db
                .select()
                .from(priceSnapshots)
                .where(
                    and(
                        eq(priceSnapshots.coinSymbol, focus.coinSymbol),
                        gte(priceSnapshots.timestamp, twentyFourHoursAgo)
                    )
                )
                .orderBy(priceSnapshots.timestamp)
                .limit(1);

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

        await setCache(cacheKey, mappedFocus, 600); // 10 min
        res.json(mappedFocus);
    } catch (err) { next(err); }
}

// GET /api/market/radar?limit=20&offset=0
export async function getRadarSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const limitParam = req.query.limit as string | undefined;
        const offsetParam = req.query.offset as string | undefined;
        const limit = parseInt(limitParam || '20', 10);
        const offset = parseInt(offsetParam || '0', 10);

        const cacheKey = `radar:latest:${limit}:${offset}:${req.userTimezone || 'UTC'}`;
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
            formattedTime: req.formatTime(s.createdAt)
        }));

        await setCache(cacheKey, mappedSignals, 60); // 1 min
        res.json(mappedSignals);
    } catch (err) { next(err); }
}

// GET /api/market/wire?coin=SOL&limit=20
export async function getLatestWire(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const coinParam = req.query.coin as string | undefined;
        const limitParam = req.query.limit as string | undefined;

        const coin = Array.isArray(coinParam) ? coinParam[0] : coinParam;
        const limit = Array.isArray(limitParam) ? limitParam[0] : limitParam || '20';

        const cacheKey = `wire:${coin || 'all'}:${limit}:${req.userTimezone || 'UTC'}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        let query = db.select().from(coinNews);
        if (coin && coin.toUpperCase() !== 'ALL') {
            query.where(eq(coinNews.coinSymbol, coin.toUpperCase()));
        }

        const news = await query
            .orderBy(desc(coinNews.publishedAt))
            .limit(parseInt(limit, 10));

        const mappedNews = news.map(n => ({
            ...n,
            formattedTime: req.formatTime(n.publishedAt)
        }));

        await setCache(cacheKey, mappedNews, 120);
        res.json(mappedNews);
    } catch (err) { next(err); }
}

// GET /api/market/wire/:id
export async function getWireById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idParam = req.params.id;
        const idString = Array.isArray(idParam) ? idParam[0] : idParam;
        const id = parseInt(idString as string);

        const [article] = await db.select().from(coinNews).where(eq(coinNews.id, id)).limit(1);
        if (!article) throw new AppError('Article not found', 404);
        res.json(article);
    } catch (err) { next(err); }
}

// GET /api/market/mood
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

// GET /api/market/movers
export async function getTopMoversController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const movers = await getTopMovers(10);
        res.json(movers);
    } catch (err) { next(err); }
}

import { runAiWorkflow } from '../crons/aiWorkflow.cron';
import { runDiscovery, runRoutineSync } from '../crons/airdropHunter.cron';
import { computeMarketMood } from '../crons/marketMood.cron';
import { selectDailyAlpha } from '../crons/dailyAlpha.cron';

// POST /api/market/force-seed
export async function forceSeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const phaseParam = req.query.phase as string | undefined;
        const targetedPhase = phaseParam || 'all';

        console.log(`--- Force Seed Triggered (Phase: ${targetedPhase}) ---`);

        // 1. AI Intelligence Workflow
        await runAiWorkflow(targetedPhase);

        if (targetedPhase === 'all' || targetedPhase === '4') {
            // 2. Select today's Alpha Focus based on the insights just generated
            await selectDailyAlpha();

            // 3. Compute Market Mood
            await computeMarketMood();

            // 4. Optionally run Airdrop Hunter (might be slow due to AI, but let's try)
            // Only run discovery if DB has no active projects, or if forced
            const [aCount] = await db.select({ id: airdropProjects.id }).from(airdropProjects).limit(1);
            if (!aCount) {
                await runDiscovery();
            } else {
                await runRoutineSync();
            }
        }

        console.log('--- Force Seed Complete ---');
        res.json({ success: true, message: `All crons executed successfully for phase: ${targetedPhase}.` });
    } catch (err) {
        next(err);
    }
}
