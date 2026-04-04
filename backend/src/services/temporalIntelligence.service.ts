import Parser from 'rss-parser';
import { db } from '../config/db';
import { coinNewsHistory } from '../models/market.model';
import { eq, and, gte, isNotNull, isNull, desc, sql, lte } from 'drizzle-orm';
import { getBinancePriceAtDate, getPriceWithFallback } from './priceService';

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const parser = new Parser();

export interface TemporalPattern {
    eventType: string;
    severity: number;
    sampleSize: number;
    rugPullRate: string;
    bullishRate: string;
    avgOutcome7d: string;
    historicalCases: Array<{ date: string; headline: string; outcome: string }>;
}

export async function fetchHistoricalNewsForCoins(coins: string[]): Promise<void> {
    for (const symbol of coins) {
        await sleep(2000 + Math.random() * 1000);
        await fetchCoinHistoricalNews(symbol, 'Other');
        console.log(`[Temporal] Fetched historical news for ${symbol}`);
    }
}

async function fetchCoinHistoricalNews(symbol: string, eventType: string): Promise<void> {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' crypto ' + eventType)}&hl=en&gl=US&ceid=US:en`;
        const feed = await parser.parseURL(url);
        const items = feed.items.slice(0, 30);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (i > 0 && i % 10 === 0) {
                await sleep(500);
            }
            if (!item.pubDate) continue;
            const publishedAt = new Date(item.pubDate);
            if (isNaN(publishedAt.getTime())) continue;
            const priceAtTime = await getBinancePriceAtDate(symbol.toUpperCase() + 'USDT', publishedAt);
            let sourceName: string;
            try {
                sourceName = item.link ? new URL(item.link).hostname.replace('www.', '') : 'unknown';
            } catch {
                sourceName = 'unknown';
            }
            await db.insert(coinNewsHistory).values({
                coinSymbol: symbol.toUpperCase(),
                title: item.title || '',
                source: sourceName,
                publishedAt: publishedAt,
                eventType: eventType,
                priceAtTime: priceAtTime,
            }).onConflictDoNothing({ target: [coinNewsHistory.coinSymbol, coinNewsHistory.title, coinNewsHistory.publishedAt] });
        }
    } catch (error) {
        console.warn(`Error fetching historical news for ${symbol}:`, error);
        return;
    }
}

export async function buildTemporalPattern(symbol: string, eventType: string, severity: number): Promise<TemporalPattern | null> {
    const rows = await db.select()
        .from(coinNewsHistory)
        .where(and(
            eq(coinNewsHistory.coinSymbol, symbol),
            eq(coinNewsHistory.eventType, eventType),
            eq(coinNewsHistory.eventSeverity, severity),
            isNotNull(coinNewsHistory.price7dAfter),
            gte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '180 days'`)
        ))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(5);

    if (rows.length === 0) return null;

    const historicalCases = rows.map(r => ({
        date: r.publishedAt.toISOString().split('T')[0],
        headline: r.title,
        outcome: r.isRugPull ? 'RUG PULL — token went to zero' : `${r.priceChange7d != null && r.priceChange7d > 0 ? '+' : ''}${Number(r.priceChange7d ?? 0).toFixed(1)}% in 7 days`
    }));
    const live = rows.filter(r => !r.isRugPull);
    const rugCount = rows.filter(r => r.isRugPull).length;
    const rugPullRate = `${Math.round(rugCount / rows.length * 100)}%`;
    const bullishRate = live.length ? `${Math.round(live.filter(r => Number(r.priceChange7d ?? 0) > 0).length / live.length * 100)}%` : 'N/A';
    const avgChange = live.length ? live.reduce((sum, r) => sum + Number(r.priceChange7d ?? 0), 0) / live.length : null;
    const avgOutcome7d = avgChange !== null ? `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%` : 'N/A';

    return { eventType, severity, sampleSize: rows.length, rugPullRate, bullishRate, avgOutcome7d, historicalCases };
}

export async function backfillPriceOutcomes(): Promise<void> {
    try {
        const rows = await db.select({
            id: coinNewsHistory.id,
            coinSymbol: coinNewsHistory.coinSymbol,
            publishedAt: coinNewsHistory.publishedAt,
            priceAtTime: coinNewsHistory.priceAtTime,
        }).from(coinNewsHistory)
        .where(and(
            isNull(coinNewsHistory.price7dAfter),
            isNotNull(coinNewsHistory.priceAtTime),
            lte(coinNewsHistory.publishedAt, sql`NOW() - INTERVAL '7 days'`)
        ))
        .limit(100);

        for (const row of rows) {
            const target = new Date(row.publishedAt);
            target.setDate(target.getDate() + 7);
            let price7d: number | null = await getBinancePriceAtDate(row.coinSymbol.toUpperCase() + 'USDT', target);
            let isRugPull = false;
            if (price7d === null) {
                const fallback = await getPriceWithFallback(row.coinSymbol);
                if (!fallback || fallback.price === 0) {
                    isRugPull = true;
                    price7d = 0;
                } else {
                    price7d = fallback.price;
                }
            }
            const change = isRugPull ? -100 : ((price7d - Number(row.priceAtTime)) / Number(row.priceAtTime) * 100);
            const setData: { price7dAfter: number; priceChange7d: number; isRugPull: boolean; sentiment?: string } = {
                price7dAfter: price7d,
                priceChange7d: change,
                isRugPull: isRugPull,
            };
            if (isRugPull) {
                setData.sentiment = 'SCAM';
            }
            await db.update(coinNewsHistory).set(setData).where(eq(coinNewsHistory.id, row.id));
            await sleep(200);
        }
    } catch (error) {
        console.error('Error in backfillPriceOutcomes:', error);
        return;
    }
}