import type { MetadataRoute } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { terminalApi } from '@/features/terminal/api';
import { AirdropProject } from '@/features/airdrop/types';
import { SITE_URL } from '@/lib/constants';
import { TRACKED_COINS } from '@/config/coins';

const STATIC_PAGES: MetadataRoute.Sitemap = [
    {
        url: SITE_URL,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
    },
    {
        url: `${SITE_URL}/terminal`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
    },
    {
        url: `${SITE_URL}/scorecard`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
    },
    {
        url: `${SITE_URL}/airdrops`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.8,
    },
    {
        url: `${SITE_URL}/archive`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
    },
    {
        url: `${SITE_URL}/privacy`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
    {
        url: `${SITE_URL}/terms`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
    {
        url: `${SITE_URL}/disclaimer`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
    },
    {
        url: `${SITE_URL}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
    },
    {
        url: `${SITE_URL}/contact`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.3,
    },
];

async function buildArticleCoinPages(): Promise<MetadataRoute.Sitemap> {
    // Always index tracked coin terminals (evergreen SEO targets for US/EU)
    const coinSet = new Set<string>(TRACKED_COINS.map((c) => c.toUpperCase()));

    try {
        const coinsWithArticles = await terminalApi.getMasterArticleCoins();
        for (const coin of coinsWithArticles) {
            coinSet.add(coin.toUpperCase());
        }
    } catch (error) {
        console.error('[Sitemap] Failed to fetch coins with articles:', error);
    }

    return Array.from(coinSet).flatMap((coin) => [
        {
            url: `${SITE_URL}/terminal/${coin.toLowerCase()}`,
            lastModified: new Date(),
            changeFrequency: 'hourly' as const,
            priority: 0.85,
        },
        {
            url: `${SITE_URL}/terminal/${coin.toLowerCase()}/alpha`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.8,
        },
    ]);
}

async function buildAirdropPages(): Promise<MetadataRoute.Sitemap> {
    let projects: AirdropProject[] = [];
    try {
        projects = await airdropApi.getProjects();
    } catch (error) {
        console.error('[Sitemap] Failed to fetch airdrop projects:', error);
    }

    return projects.map((p) => ({
        url: `${SITE_URL}/airdrops/${p.id}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const airdropPages = await buildAirdropPages();
    const coinPages = await buildArticleCoinPages();

    return [...STATIC_PAGES, ...coinPages, ...airdropPages];
}
