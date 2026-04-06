import { db } from '../config/db';
import { rawNewsBuffer, coinNews } from '../models/market.model';
import { gte, and, sql, count } from 'drizzle-orm';

export async function getDynamicThreshold(): Promise<number> {
    const result = await db.select({ count: count() })
        .from(rawNewsBuffer)
        .where(and(
            gte(rawNewsBuffer.relevanceScore, 60),
            gte(rawNewsBuffer.retrievedAt, sql`NOW() - INTERVAL '2 hours'`)
        ));

    const itemCount = result[0].count;

    if (itemCount < 5) return 65;
    if (itemCount < 20) return 70;
    if (itemCount < 50) return 78;
    return 85;
}

export async function countPublishedLastHour(): Promise<number> {
    const result = await db.select({ count: count() })
        .from(coinNews)
        .where(gte(coinNews.createdAt, sql`NOW() - INTERVAL '1 hour'`));

    return result[0].count;
}