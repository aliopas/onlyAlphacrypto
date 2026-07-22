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

    const farmPages = projects.map((p) => ({
        url: `${SITE_URL}/airdrops/${p.id}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
    }));

    // DEC-042: research hub + seoEligible not_recommended only (no under_review)
    const researchHub: MetadataRoute.Sitemap = [
        {
            url: `${SITE_URL}/airdrops/research`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
    ];

    let researchSlugs: Array<{ slug: string; updatedAt: string }> = [];
    try {
        researchSlugs = await airdropApi.getResearchSeoSlugs();
    } catch (error) {
        console.error('[Sitemap] Failed to fetch research slugs:', error);
    }

    const researchPages = researchSlugs.map((s) => ({
        url: `${SITE_URL}/airdrops/research/${s.slug}`,
        lastModified: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.55,
    }));

    return [...farmPages, ...researchHub, ...researchPages];
}

async function buildMarketContextPage(): Promise<MetadataRoute.Sitemap> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    try {
        const res = await fetch(`${apiBase}/market/market-context`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
            available?: boolean;
            snapshot?: { publishedAt?: string | null } | null;
        };
        if (!data.available || !data.snapshot) return [];
        const lastMod = data.snapshot.publishedAt
            ? new Date(data.snapshot.publishedAt)
            : new Date();
        return [
            {
                url: `${SITE_URL}/blog/market-context`,
                lastModified: lastMod,
                changeFrequency: 'weekly' as const,
                priority: 0.85,
            },
        ];
    } catch (error) {
        console.error('[Sitemap] Failed to fetch market context:', error);
        return [];
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const airdropPages = await buildAirdropPages();
    const coinPages = await buildArticleCoinPages();
    const marketContextPage = await buildMarketContextPage();

    return [...STATIC_PAGES, ...coinPages, ...airdropPages, ...marketContextPage];
}
