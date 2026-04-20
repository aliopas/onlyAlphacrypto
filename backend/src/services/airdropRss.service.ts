import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { db } from '../config/db';
import { airdropProjects } from '../models/index';

export interface AirdropRSSArticle {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;
    content: string;
    hash: string;
}

interface RSSSource {
    name: string;
    url: string;
}

const AIRDROP_RSS_SOURCES: RSSSource[] = [
    { name: 'CoinMarketCap Airdrops', url: 'https://coinmarketcap.com/airdrops/rss/' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/?s=airdrop' },
    { name: 'CoinGape', url: 'https://coingape.com/feed/?s=airdrop' },
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss' },
];

const AIRDROP_KEYWORDS: string[] = [
    'airdrop', 'airdrops', 'snapshot', 'tge', 'token generation',
    'claim', 'retrodrop', 'retroactive', 'testnet reward',
    'incentivized testnet', 'free token', 'token claim',
    'eligibility', 'eligible', 'distribution', 'token distribution',
    'zk drop', 'zero-knowledge drop', 'mainnet launch',
];

const ANTI_KEYWORDS: string[] = [
    'scam alert', 'phishing', 'fake airdrop', 'avoid',
    'honeypot', 'rug pull', 'malicious',
];

const parser = new Parser();

export function filterAirdropRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    if (ANTI_KEYWORDS.some(kw => lower.includes(kw))) {
        return false;
    }
    return AIRDROP_KEYWORDS.some(kw => lower.includes(kw));
}

export function generateArticleHash(title: string, link: string): string {
    return createHash('sha256').update(`${title}||${link}`).digest('hex');
}

export async function fetchAirdropRSSFeeds(): Promise<AirdropRSSArticle[]> {
    const dedupMap = new Map<string, AirdropRSSArticle>();

    const fetchPromises = AIRDROP_RSS_SOURCES.map(async (source) => {
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 15);

            for (const item of items) {
                const title = item.title || '';
                const link = item.link || '';
                const contentSnippet = item.contentSnippet || '';
                const content =
                    (item as Record<string, string>)['content:encoded'] ||
                    item.content ||
                    item.contentSnippet ||
                    '';
                const pubDate = item.pubDate || '';

                const combinedText = `${title} ${contentSnippet} ${content}`;
                if (!filterAirdropRelevant(combinedText)) {
                    continue;
                }

                const hash = generateArticleHash(title, link);

                if (!dedupMap.has(hash)) {
                    dedupMap.set(hash, {
                        title,
                        link,
                        pubDate,
                        contentSnippet,
                        source: source.name,
                        content,
                        hash,
                    });
                }
            }
        } catch (error) {
            console.error(
                `[AirdropRSS] Error fetching from ${source.name}:`,
                error instanceof Error ? error.message : String(error)
            );
        }
    });

    await Promise.all(fetchPromises);

    const articles = Array.from(dedupMap.values());
    articles.sort((a, b) => {
        const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return timeB - timeA;
    });

    return articles;
}

export async function getExistingProjectNames(): Promise<Set<string>> {
    const projects = await db
        .select({ name: airdropProjects.name })
        .from(airdropProjects);
    return new Set(projects.map(p => p.name.toLowerCase()));
}

export function buildProjectContextFromArticle(article: AirdropRSSArticle): string {
    const MAX_CONTENT_LENGTH = 3200;
    const truncatedContent =
        article.content.length > MAX_CONTENT_LENGTH
            ? article.content.slice(0, MAX_CONTENT_LENGTH) + '...[truncated]'
            : article.content;

    return [
        `ARTICLE TITLE: ${article.title}`,
        `SOURCE: ${article.source}`,
        `PUBLISHED: ${article.pubDate}`,
        `LINK: ${article.link}`,
        '',
        '--- ARTICLE CONTENT ---',
        truncatedContent,
    ].join('\n');
}
