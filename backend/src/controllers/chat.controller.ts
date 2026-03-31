import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/db';
import { coinNews, marketInsights, radarSignals, coinMemory } from '../models/index';
import { eq, desc, and, gt } from 'drizzle-orm';
import { streamChatResponse } from '../services/openai.service';
import { getLivePrice } from '../services/binance.service';
import { AppError } from '../middleware/errorHandler';

export async function chatStream(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { coin, messages, mode, articleId, articleType } = req.body as {
            coin: string;
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            mode?: 'general' | 'private';
            articleId?: number;
            articleType?: 'WIRE' | 'RADAR';
        };

        if (!coin || !messages?.length) {
            throw new AppError('coin and messages are required', 400);
        }

        const symbol = coin.toUpperCase();
        let contextText = '';
        let currentPrice = 0;
        
        try {
            currentPrice = await getLivePrice(symbol);
        } catch { /* ignore */ }

        if (mode === 'private' && articleId && articleType) {
            // Context Aware / Private Mode
            let baseArticleTime = new Date();
            
            if (articleType === 'WIRE') {
                const [newsItem] = await db.select().from(coinNews).where(eq(coinNews.id, articleId)).limit(1);
                if (newsItem) {
                    baseArticleTime = newsItem.publishedAt;
                    contextText = `[PRIMARY FOCUS - RECENT NEWS]: ${newsItem.headline}\nSummary: ${newsItem.summary}\n`;
                }
            } else if (articleType === 'RADAR') {
                const [radarItem] = await db.select().from(radarSignals).where(eq(radarSignals.id, articleId)).limit(1);
                if (radarItem) {
                    baseArticleTime = radarItem.createdAt;
                    contextText = `[PRIMARY FOCUS - AI SIGNAL]: ${radarItem.signalText}\nSentiment: ${radarItem.sentiment}\n`;
                    // Fetch source news if it exists
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

            // Add the general system prompt modification tailored for Private mode
            contextText += `\nINSTRUCTION: The user is asking about the PRIMARY FOCUS article. Analyze it and consider any LATEST UPDATES. Be concise.`;
            
        } else {
            const [insight] = await db.select().from(marketInsights).where(eq(marketInsights.coinSymbol, symbol)).orderBy(desc(marketInsights.analyzedAt)).limit(1);
            const news = await db.select({ headline: coinNews.headline }).from(coinNews).where(eq(coinNews.coinSymbol, symbol)).orderBy(desc(coinNews.publishedAt)).limit(3);
            const memory = await db.select({ eventSummary: coinMemory.eventSummary, eventType: coinMemory.eventType })
                .from(coinMemory)
                .where(eq(coinMemory.coinSymbol, symbol))
                .orderBy(desc(coinMemory.createdAt))
                .limit(3);
            
            const newsStr = news.map((n) => n.headline).join(' | ') || 'No recent news';
            const memoryStr = memory.length > 0 ? memory.map(m => `[${m.eventType}] ${m.eventSummary}`).join(' | ') : 'No recent memory';
            contextText = `[GENERAL MARKET CONTEXT] Latest Insight Verdict: ${insight?.verdict || 'None'}\nRecent News: ${newsStr}\nHistorical Memory: ${memoryStr}`;
            
            if (!currentPrice) currentPrice = insight?.priceAtAnalysis || 0;
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const chatMode = mode === 'private' ? 'context' : 'general';

        const stream = await streamChatResponse(messages, {
            symbol,
            price: currentPrice,
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
    } catch (err) { next(err); }
}
