import cron from 'node-cron';
import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/db';
import { coinNews, radarSignals, airdropProjects } from '../models/index';
import { generateDualNewsOutput } from '../services/openai.service';
import { deleteCache } from '../config/redis';
import { env } from '../config/env';
import { eq, isNotNull, desc } from 'drizzle-orm';

function hashTitle(title: string): string {
    return crypto.createHash('sha256').update(title.trim().toLowerCase()).digest('hex');
}

// ─── Crypto News Sources ──────────────────────────────────────────────────────
const NEWS_SOURCES = [
    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
];

async function fetchLatestNews(): Promise<Array<{ title: string; text?: string; source?: string }>> {
    try {
        let url = NEWS_SOURCES[0];
        if (process.env.CRYPTOCOMPARE_API_KEY) {
            url += `&api_key=${process.env.CRYPTOCOMPARE_API_KEY}`;
        }
        console.log(`[TerminalEngine] Fetching from: ${NEWS_SOURCES[0]}`);
        let { data } = await axios.get(url, { timeout: 8000 });
        
        if (!data || !data.Data || !Array.isArray(data.Data)) {
            // Log the actual response to diagnose rate limits or auth errors from CryptoCompare
            const snippet = JSON.stringify(data).slice(0, 300);
            console.error(`[TerminalEngine] Invalid API structure. Response snippet: ${snippet}`);
            return [];
        }

        console.log(`[TerminalEngine] Fetched ${data.Data.length} news items from API`);
        return data.Data.slice(0, 5).map((item: Record<string, any>) => ({
            title: item.title as string,
            source: item.source_info?.name as string || item.source as string,
        }));
    } catch (err: any) {
        console.error('[TerminalEngine] Error fetching news:', err.message);
        if (err.response) {
            console.error('[TerminalEngine] API Error Data:', err.response.data);
        }
        return [];
    }
}

async function getTrackedProjectNames(): Promise<string[]> {
    const projects = await db
        .select({ name: airdropProjects.name })
        .from(airdropProjects)
        .where(eq(airdropProjects.isActive, true));
    return projects.map((p) => p.name);
}

const BREAKING_KEYWORDS = ['snapshot', 'tge', 'claim', 'hack', 'exploit', 'sec', 'crash', 'listing'];

async function triggerAirdropWebhook(projectName: string): Promise<void> {
    console.log(`🔔 Breaking news detected for tracked project: ${projectName} — triggering airdrop update`);
    // TODO: call airdrop hunter cron directly or via internal event
}

// ─── Main Cron: Every 5 minutes ──────────────────────────────────────────────

export async function runTerminalEngine(): Promise<void> {
    console.log('🤖 [TerminalEngine] Running — fetching crypto news...');

    const trackedProjects = await getTrackedProjectNames();
    const newsItems = await fetchLatestNews();

    if (!newsItems.length) {
        console.log('[TerminalEngine] No news to process.');
        return;
    }

    for (const newsItem of newsItems) {
        try {
            const rawText = newsItem.title;
            const hash = hashTitle(rawText);

            // 1. Check if already processed (Deduplication)
            const [existing] = await db
                .select({ id: coinNews.id })
                .from(coinNews)
                .where(eq(coinNews.sourceHash, hash))
                .limit(1);

            if (existing) {
                console.log(`[TerminalEngine] Skipping duplicate: "${rawText.slice(0, 50)}..."`);
                continue;
            }

            // 2. Fetch context (Recent Summaries)
            const recentSummaries = await db
                .select({ summary: coinNews.summary, headline: coinNews.headline })
                .from(coinNews)
                .where(eq(coinNews.aiProcessed, 1))
                .orderBy(desc(coinNews.createdAt))
                .limit(3);

            const context = recentSummaries
                .filter(s => s.summary)
                .map(s => `[${s.headline}]: ${s.summary}`)
                .join('\n');

            // 3. Generate Analysis
            const output = await generateDualNewsOutput(rawText, trackedProjects, context);

            // Write wire_card → coin_news table
            const [savedNews] = await db.insert(coinNews).values({
                coinSymbol: output.wireCard.coinSymbol,
                headline: output.wireCard.headline,
                summary: output.wireCard.summary,
                sourceUrl: undefined,
                sentiment: output.wireCard.sentiment,
                impactScore: output.wireCard.impactScore,
                isBreaking: output.wireCard.isBreaking ? 1 : 0,
                sourceHash: hash,
                aiProcessed: 1,
            }).returning({ id: coinNews.id });

            // Write radar_card → radar_signals table
            await db.insert(radarSignals).values({
                coinSymbol: output.radarCard.coinSymbol,
                signalText: output.radarCard.signalText,
                sentiment: output.radarCard.sentiment,
                impactScore: output.radarCard.impactScore,
                newsId: savedNews.id,
            });

            // Invalidate radar cache
            await deleteCache('radar:latest');
            await deleteCache(`wire:all:20`);

            // Check if breaking news affects a tracked airdrop
            if (output.wireCard.isBreaking) {
                const headline = output.wireCard.headline.toLowerCase();
                const matchedProject = trackedProjects.find((p) =>
                    headline.includes(p.toLowerCase()) &&
                    BREAKING_KEYWORDS.some((kw) => headline.includes(kw))
                );
                if (matchedProject) {
                    await triggerAirdropWebhook(matchedProject);
                }
            }

            // Small delay between items to avoid OpenAI rate limiting
            await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
            console.error('[TerminalEngine] Error processing news item:', err);
        }
    }

    console.log(`✅ [TerminalEngine] Processed ${newsItems.length} news items.`);
}

export function startTerminalEngineCron(): void {
    cron.schedule('*/5 * * * *', runTerminalEngine);
    console.log('⏰ Terminal Intelligence Engine cron scheduled — every 5 minutes');
}
