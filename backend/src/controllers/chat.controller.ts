import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/db';
import { coinNews, marketInsights } from '../models/index';
import { eq, desc } from 'drizzle-orm';
import { streamChatResponse } from '../services/openai.service';
import { getLivePrice } from '../services/binance.service';
import { AppError } from '../middleware/errorHandler';

// POST /api/chat/stream
// Body: { coinSlug: string, messages: [{role, content}] }
export async function chatStream(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { coinSlug, messages } = req.body as {
            coinSlug: string;
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        };

        if (!coinSlug || !messages?.length) {
            throw new AppError('coinSlug and messages are required', 400);
        }

        // Build coin context from DB + Binance
        const [insight] = await db
            .select()
            .from(marketInsights)
            .where(eq(marketInsights.coinSlug, coinSlug.toLowerCase()))
            .orderBy(desc(marketInsights.analyzedAt))
            .limit(1);

        const news = await db
            .select({ headline: coinNews.headline })
            .from(coinNews)
            .where(eq(coinNews.coinSymbol, insight?.coinSymbol || coinSlug.toUpperCase()))
            .orderBy(desc(coinNews.publishedAt))
            .limit(3);

        let currentPrice = insight?.priceAtAnalysis || 0;
        try {
            currentPrice = await getLivePrice(insight?.coinSymbol || coinSlug.toUpperCase());
        } catch { /* use DB price as fallback */ }

        const newsSummary = news.map((n) => n.headline).join(' | ') || 'No recent news';

        // Set SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await streamChatResponse(messages, {
            symbol: insight?.coinSymbol || coinSlug.toUpperCase(),
            price: currentPrice,
            newsSummary,
        });

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
