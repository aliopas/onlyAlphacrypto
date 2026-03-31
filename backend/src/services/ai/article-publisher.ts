import { db } from '../../config/db';
import { coinNews, radarSignals } from '../../models/market.model';
import { createHash } from 'crypto';
import { PromptFactory } from './prompt-factory';
import { AIGateway } from './ai-gateway';
import { CacheManager } from './cache-manager';
import { env } from '../../config/env';
import { eq } from 'drizzle-orm';
import type { DeepSynthesisResult } from '../openai.service';

interface ArticleSEOResult {
    metaTitle: string;
    metaDescription: string;
    seoKeywords: string[];
    slug: string;
}

export async function publishArticle(coinSymbol: string, synthesis: DeepSynthesisResult, newsArticles: string[]): Promise<{ newsId: number; seo: ArticleSEOResult }> {
    const promptFactory = new PromptFactory();
    const gateway = new AIGateway({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        timeoutMs: 90000,
        defaultHeaders: {
            'HTTP-Referer': 'https://onlyalpha.app',
            'X-Title': 'OnlyAlpha',
        },
    });
    const cache = new CacheManager();

    const seoMessages = promptFactory.buildArticleSEOMessages(synthesis.fullArticle, coinSymbol);
    const seoResult = await gateway.chat<ArticleSEOResult>({
        model: env.SEO_MODEL,
        messages: seoMessages,
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
    });

    const sourceHash = createHash('sha256').update(synthesis.executiveSummary).digest('hex');

    let newsId: number;
    try {
        const insertResult = await db.insert(coinNews).values({
            coinSymbol,
            headline: synthesis.executiveSummary.slice(0, 200),
            summary: synthesis.fullArticle,
            hook: synthesis.executiveSummary.split('.')[0],
            metaTitle: seoResult.metaTitle,
            metaDescription: seoResult.metaDescription,
            seoKeywords: seoResult.seoKeywords,
            sentiment: synthesis.riskAssessment === 'LOW' ? 'bullish' : synthesis.riskAssessment === 'HIGH' ? 'bearish' : 'neutral',
            impactScore: synthesis.confidenceScore,
            aiProcessed: 1,
            sourceHash,
        }).onConflictDoNothing().returning();

        if (insertResult.length > 0) {
            newsId = insertResult[0].id;
        } else {
            const existing = await db.select().from(coinNews).where(eq(coinNews.sourceHash, sourceHash)).limit(1);
            if (existing.length === 0) {
                throw new Error('Failed to insert or find existing coinNews');
            }
            newsId = existing[0].id;
        }
    } catch (error) {
        throw new Error(`Failed to save coin news: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (synthesis.riskAssessment === 'HIGH') {
        try {
            await db.insert(radarSignals).values({
                coinSymbol,
                signalText: synthesis.executiveSummary.slice(0, 100),
            }).onConflictDoNothing();
        } catch (error) {
            // Log error but don't fail the whole operation
            console.error('Failed to save radar signal:', error);
        }
    }

    return { newsId, seo: seoResult };
}