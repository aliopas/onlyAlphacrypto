import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/db';
import { redis } from '../config/redis';
import { coinNews, marketInsights, radarSignals, coinMemory, coinMasterArticles, coinTimelineUpdates } from '../models/index';
import { eq, desc, and, gt } from 'drizzle-orm';
import { streamChatResponse } from '../services/openai.service';
import { getLivePrice } from '../services/binance.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const chatBodySchema = z.object({
    coin: z.string().min(1),
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
    mode: z.enum(['general', 'private', 'context']).optional(),
    articleId: z.number().int().positive().optional(),
    articleType: z.enum(['WIRE', 'RADAR']).optional(),
});

export async function chatStream(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = chatBodySchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(`Invalid request: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
        }
        const { coin, messages, mode, articleId, articleType } = parsed.data;

        const isContextRoute = req.originalUrl?.includes('/context') ?? false;

        if (mode === 'context' && !req.userId && !isContextRoute) {
            throw new AppError('Authentication required for context mode', 401);
        }

        if (!coin || !messages?.length) {
            throw new AppError('coin and messages are required', 400);
        }

        const symbol = coin.toUpperCase();
        const resolvedMode = isContextRoute || mode === 'context' ? 'private' : (mode || 'general');
        let contextText = '';
        let currentPrice: number | null = null;

        try {
            currentPrice = await getLivePrice(symbol);
        } catch (err) {
            logger.warn(`[Chat] getLivePrice failed for ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (resolvedMode === 'private' && articleId && articleType) {
            // Context Aware / Private Mode
            let baseArticleTime = new Date();

            // Fetch master article
            const [master] = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
            // FIX 1: Removed 'let' to avoid variable shadowing bug, assigning to outer contextText
            contextText = `[MASTER ARTICLE]: ${master ? master.headline : 'No master article available'}\n`;
            // FIX 2: Context Enrichment - Adding additional fields from master article for Pro version
            if (master?.convictionScore !== undefined) contextText += `Conviction Score: ${master.convictionScore}\n`;
            if (master?.posture) contextText += `Posture: ${master.posture}\n`;
            if (master?.coreCatalyst) contextText += `Core Catalyst: ${master.coreCatalyst}\n`;
            if (master?.technicalLevels) contextText += `Technical Levels: ${master.technicalLevels}\n`;
            if (master?.riskAssessment) contextText += `Risk Assessment: ${master.riskAssessment}\n`;
            if (master?.bottomLine) contextText += `Bottom Line: ${master.bottomLine}\n`;
            if (master?.riskTags && Array.isArray(master.riskTags)) contextText += `Risk Tags: ${master.riskTags.join(', ')}\n`;
            if (master) {
                // FIX 2: Include severity field in timeline selection
                const timeline = await db.select({ updateText: coinTimelineUpdates.updateText, severity: coinTimelineUpdates.severity })
                    .from(coinTimelineUpdates)
                    .where(eq(coinTimelineUpdates.masterArticleId, master.id))
                    .orderBy(desc(coinTimelineUpdates.createdAt))
                    .limit(5);
                // FIX 2: Include severity in timeline context
                contextText += `[TIMELINE UPDATES]: ${timeline.length > 0 ? timeline.map(t => `[${t.severity}] ${t.updateText}`).join(' | ') : 'No recent updates'}\n`;
            }

            if (articleType === 'WIRE') {
                const [newsItem] = await db.select().from(coinNews).where(eq(coinNews.id, articleId)).limit(1);
                if (newsItem) {
                    baseArticleTime = newsItem.publishedAt ?? new Date();
                    contextText += `[PRIMARY FOCUS - RECENT NEWS]: ${newsItem.headline}\nSummary: ${newsItem.summary}\n`;
                }
            } else if (articleType === 'RADAR') {
                const [radarItem] = await db.select().from(radarSignals).where(eq(radarSignals.id, articleId)).limit(1);
                if (radarItem) {
                    baseArticleTime = radarItem.createdAt;
                    contextText += `[PRIMARY FOCUS - AI SCENARIO]: ${radarItem.signalText}\nSentiment: ${radarItem.sentiment}\n`;
                    if (radarItem.newsId) {
                        const [sourceNews] = await db.select().from(coinNews).where(eq(coinNews.id, radarItem.newsId)).limit(1);
                        if (sourceNews) {
                            contextText += `[SOURCE MATERIAL]: ${sourceNews.headline}\n`;
                        }
                    }
                }
            }

            // Fetch newer updates that appeared AFTER this article
            const newUpdates = await db.select({ headline: coinNews.headline })
                .from(coinNews)
                .where(and(eq(coinNews.coinSymbol, symbol), gt(coinNews.publishedAt, baseArticleTime)))
                .orderBy(desc(coinNews.publishedAt))
                .limit(3);

            if (newUpdates.length > 0) {
                contextText += `\n[LATEST UPDATES SINCE ARTICLE]: ${newUpdates.map(n => n.headline).join(' | ')}`;
            } else {
                contextText += `\n[LATEST UPDATES]: No newer updates found since this article was published.`;
            }

            const memory = await db.select({ eventSummary: coinMemory.eventSummary, eventType: coinMemory.eventType, riskVerdict: coinMemory.riskVerdict })
                .from(coinMemory)
                .where(eq(coinMemory.coinSymbol, symbol))
                .orderBy(desc(coinMemory.createdAt))
                .limit(5);
            if (memory.length > 0) {
                const memoryStr = memory.map(m => `[${m.eventType}] ${m.eventSummary} (Risk: ${m.riskVerdict || 'N/A'})`).join('\n');
                contextText += `\n[COIN MEMORY - Historical Events]:\n${memoryStr}`;
            }

            contextText += `\nINSTRUCTION: The user is asking about the PRIMARY FOCUS article. Analyze it and consider any LATEST UPDATES. Be concise.`;
            
        } else {
            const [insight] = await db.select().from(marketInsights).where(eq(marketInsights.coinSymbol, symbol)).orderBy(desc(marketInsights.analyzedAt)).limit(1);
            const news = await db.select({ headline: coinNews.headline }).from(coinNews).where(eq(coinNews.coinSymbol, symbol)).orderBy(desc(coinNews.publishedAt)).limit(3);
            const [master] = await db.select().from(coinMasterArticles).where(eq(coinMasterArticles.coinSymbol, symbol)).limit(1);
            const timeline = master ? await db.select({ updateText: coinTimelineUpdates.updateText })
                .from(coinTimelineUpdates)
                .where(eq(coinTimelineUpdates.masterArticleId, master.id))
                .orderBy(desc(coinTimelineUpdates.createdAt))
                .limit(3) : [];
            const memory = await db.select({ eventSummary: coinMemory.eventSummary, eventType: coinMemory.eventType })
                .from(coinMemory)
                .where(eq(coinMemory.coinSymbol, symbol))
                .orderBy(desc(coinMemory.createdAt))
                .limit(3);

            const newsStr = news.map((n) => n.headline).join(' | ') || 'No recent news';
            const timelineStr = timeline.length > 0 ? timeline.map(t => t.updateText).join(' | ') : 'No recent updates';
            const memoryStr = memory.length > 0 ? memory.map(m => `[${m.eventType}] ${m.eventSummary}`).join(' | ') : 'No recent memory';
            contextText = `[MASTER ARTICLE]: ${master ? master.headline : 'No master article available'}\n[TIMELINE UPDATES]: ${timelineStr}\n[HISTORICAL MEMORY]: ${memoryStr}\n[RECENT NEWS]: ${newsStr}\n[INSIGHT VERDICT]: ${insight?.verdict || 'None'}`;

            if (currentPrice === null) currentPrice = insight?.priceAtAnalysis ?? null;

            if (articleId && articleType) {
                try {
                    const table = articleType === 'WIRE' ? coinNews : radarSignals;
                    const [item] = await db.select().from(table).where(eq(table.id, articleId)).limit(1);
                    if (item) {
                        const headline = 'headline' in item ? item.headline : ('signalText' in item ? item.signalText : '');
                        contextText += `\n[ARTICLE CONTEXT]: The user is currently viewing: "${headline}". Reference this if relevant to their question.`;
                    }
                } catch { /* non-blocking */ }
            }
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const chatMode = resolvedMode === 'private' ? 'context' : 'general';

        const stream = await streamChatResponse(messages, {
            symbol,
            price: currentPrice ?? 0,
            newsSummary: contextText,
        }, chatMode);

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Stream error';
        try {
            res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
            res.end();
        } catch { /* headers may not be sent yet */ }
        if (!res.headersSent) {
            next(err);
        }
    }
}

export async function acceptDisclaimer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!req.userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (redis) {
            await redis.set(`disclaimer:${req.userId}`, 'accepted', 'EX', 31536000);
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

export async function checkDisclaimer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!redis) {
            res.json({ accepted: true });
            return;
        }

        if (!req.userId) {
            res.json({ accepted: false });
            return;
        }

        const status = await redis.get(`disclaimer:${req.userId}`);
        res.json({ accepted: status === 'accepted' });
    } catch {
        res.json({ accepted: true });
    }
}

export async function getContext(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const articleId = parseInt(String(req.params.articleId), 10);
        const articleType = String(req.params.articleType);

        if (articleType !== 'WIRE' && articleType !== 'RADAR') {
            res.status(400).json({ error: 'Invalid article type' });
            return;
        }

        if (isNaN(articleId)) {
            res.status(400).json({ error: 'Invalid article ID' });
            return;
        }

        if (articleType === 'WIRE') {
            const [newsItem] = await db.select({
                id: coinNews.id,
                coinSymbol: coinNews.coinSymbol,
                headline: coinNews.headline,
                summary: coinNews.summary,
                hook: coinNews.hook,
                sentiment: coinNews.sentiment,
                impactScore: coinNews.impactScore,
                publishedAt: coinNews.publishedAt,
            }).from(coinNews).where(eq(coinNews.id, articleId)).limit(1);

            if (!newsItem) {
                res.status(404).json({ error: 'Article not found' });
                return;
            }

            res.json({ type: 'WIRE', article: newsItem });
            return;
        }

        const [radarItem] = await db.select({
            id: radarSignals.id,
            coinSymbol: radarSignals.coinSymbol,
            signalText: radarSignals.signalText,
            sentiment: radarSignals.sentiment,
            impactScore: radarSignals.impactScore,
            newsId: radarSignals.newsId,
            createdAt: radarSignals.createdAt,
        }).from(radarSignals).where(eq(radarSignals.id, articleId)).limit(1);

        if (!radarItem) {
            res.status(404).json({ error: 'Article not found' });
            return;
        }

        let linkedNews: { id: number; headline: string } | null = null;
        if (radarItem.newsId) {
            const [news] = await db.select({ id: coinNews.id, headline: coinNews.headline })
                .from(coinNews)
                .where(eq(coinNews.id, radarItem.newsId))
                .limit(1);
            linkedNews = news ?? null;
        }

        res.json({ type: 'RADAR', article: { ...radarItem, linkedNews } });
    } catch (err) {
        next(err);
    }
}
