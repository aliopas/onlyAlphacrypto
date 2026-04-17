import type { MetadataRoute } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';

const SITE_URL = 'https://onlyalphacrypto.com';

const COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
    'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
    'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
];

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
        url: `${SITE_URL}/airdrops`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.8,
    },
];

function buildCoinPages(): MetadataRoute.Sitemap {
    return COINS.map((coin) => [
        {
            url: `${SITE_URL}/terminal/${coin.toLowerCase()}`,
            lastModified: new Date(),
            changeFrequency: 'hourly' as const,
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/terminal/${coin.toLowerCase()}/alpha`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.8,
        },
    ]).flat();
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
    const coinPages = buildCoinPages();

    return [...STATIC_PAGES, ...coinPages, ...airdropPages];
}
