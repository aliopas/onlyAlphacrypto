import { db } from '../../config/db';
import { rawNewsBuffer } from '../../models/market.model';
import { eq, desc, and, gte } from 'drizzle-orm';

/**
 * Interface representing grouped coin data for deep analysis
 */
export interface GroupedCoinData {
    coinSymbol: string;
    newsTitles: string[];
    sources: string[];
    avgRelevanceScore: number;
}

/**
 * Fetches top items for deep analysis from the raw news buffer
 * @param limit - Maximum number of items to fetch (default: 15)
 * @returns Promise resolving to array of grouped coin data
 */
export async function fetchTopItemsForDeepAnalysis(limit: number = 15): Promise<GroupedCoinData[]> {
    // Fetch items where processed = true AND relevanceScore >= 50, ordered by relevanceScore DESC
    const items = await db
        .select()
        .from(rawNewsBuffer)
        .where(and(
            eq(rawNewsBuffer.processed, true),
            gte(rawNewsBuffer.relevanceScore, 50),
        ))
        .orderBy(desc(rawNewsBuffer.relevanceScore))
        .limit(limit);

    if (items.length === 0) {
        return [];
    }

    // Group items by symbolMentions
    const groups: Map<string, Array<typeof items[number]>> = new Map();

    for (const item of items) {
        // Get symbolMentions, cast properly, default to empty array if null
        const mentions = (item.symbolMentions as string[] | null) || [];
        
        // If no mentions, group under "UNKNOWN"
        if (mentions.length === 0) {
            const unknownGroup = groups.get('UNKNOWN') || [];
            unknownGroup.push(item);
            groups.set('UNKNOWN', unknownGroup);
            continue;
        }

        // Add item to each mentioned symbol group
        for (const symbol of mentions) {
            const group = groups.get(symbol) || [];
            group.push(item);
            groups.set(symbol, group);
        }
    }

    // Convert groups to GroupedCoinData array
    const result: GroupedCoinData[] = [];

    for (const [coinSymbol, groupItems] of groups.entries()) {
        const newsTitles = groupItems.map(item => item.title);
        const sources = groupItems.map(item => item.source).filter((source): source is string => source !== null);
        const relevanceScores = groupItems.map(item => item.relevanceScore).filter((score): score is number => score !== null);
        
        const avgRelevanceScore = relevanceScores.length > 0 
            ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length 
            : 0;

        result.push({
            coinSymbol,
            newsTitles,
            sources,
            avgRelevanceScore
        });
    }

    return result;
}

/**
 * Fetches items by specific symbol from the raw news buffer
 * @param symbol - Coin symbol to filter by
 * @returns Promise resolving to array of news items with title, source, and relevanceScore
 */
export async function fetchItemsBySymbol(symbol: string): Promise<Array<{ title: string; source: string | null; relevanceScore: number | null }>> {
    // Fetch items where processed = true AND relevanceScore >= 50
    const items = await db
        .select({
            title: rawNewsBuffer.title,
            source: rawNewsBuffer.source,
            relevanceScore: rawNewsBuffer.relevanceScore,
            symbolMentions: rawNewsBuffer.symbolMentions
        })
        .from(rawNewsBuffer)
        .where(and(
            eq(rawNewsBuffer.processed, true),
            gte(rawNewsBuffer.relevanceScore, 50),
        ));

    const filteredItems = items.filter(item => {
        const mentions = (item.symbolMentions as string[] | null) || [];
        return mentions.includes(symbol);
    });

    // Map to return format
    return filteredItems.map(item => ({
        title: item.title,
        source: item.source,
        relevanceScore: item.relevanceScore
    }));
}