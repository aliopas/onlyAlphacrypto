// backend/src/services/similarity.service.ts

import { db } from '../config/db';
import { coinNews } from '../models/market.model';
import { eq, and, gte, sql } from 'drizzle-orm';

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'crypto', 'blockchain', 'bitcoin', 'ethereum']);

function extractKeywords(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function keywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

export async function isDuplicateByKeywords(headline: string, symbol: string): Promise<boolean> {
    const keywords = extractKeywords(headline);
    if (keywords.length === 0) return false;

    // Fetch recent headlines for the symbol (last 24 hours)
    const recentHeadlines = await db.select({ headline: coinNews.headline })
        .from(coinNews)
        .where(and(
            eq(coinNews.coinSymbol, symbol),
            gte(coinNews.createdAt, sql`NOW() - INTERVAL '24 hours'`)
        ));

    for (const row of recentHeadlines) {
        const recentKeywords = extractKeywords(row.headline);
        if (recentKeywords.length === 0) continue;
        if (keywordOverlap(keywords, recentKeywords) >= 0.5) {
            return true;
        }
    }
    return false;
}