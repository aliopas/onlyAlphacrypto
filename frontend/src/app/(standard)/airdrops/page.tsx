import type { Metadata } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';
import { AirdropsPageClient } from '@/features/airdrop/components/AirdropsPageClient';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 60;

export const metadata: Metadata = {
    title: 'Airdrop Farm Grid — Track Active Crypto Airdrops',
    description: 'Discover and track active crypto airdrops. AI-powered risk assessment, farming progress tracking, and deadline monitoring for DeFi airdrops.',
    keywords: ['crypto airdrops', 'free airdrops', 'airdrop tracker', 'airdrop farm', 'OnlyAlpha airdrops', 'DeFi airdrops', 'crypto rewards'],
    openGraph: {
        title: 'Airdrop Farm Grid — OnlyAlpha',
        description: 'Discover and track active crypto airdrops with AI-powered risk assessment.',
        url: `${SITE_URL}/airdrops`,
        siteName: 'OnlyAlpha',
        type: 'website',
        images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'Airdrop Farm Grid — OnlyAlpha' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Airdrop Farm Grid — OnlyAlpha',
        description: 'Discover and track active crypto airdrops with AI-powered risk assessment.',
    },
    alternates: {
        canonical: `${SITE_URL}/airdrops`,
    },
};

export default async function AirdropsPage() {
    let projects: AirdropProject[] = [];
    let fetchError = false;
    try {
        projects = await airdropApi.getProjects();
    } catch (error) {
        console.error('[Airdrops] Failed to load projects on server:', error);
        fetchError = true;
    }

    const airdropListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Active Crypto Airdrops',
        description: 'Discover and track active crypto airdrops on OnlyAlpha',
        url: `${SITE_URL}/airdrops`,
        numberOfItems: projects.length,
        itemListElement: projects.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/airdrops/${p.id}`,
            name: p.name,
        })),
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            url: SITE_URL,
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(airdropListJsonLd) }}
            />
            <AirdropsPageClient initialProjects={projects} initialError={fetchError} />
        </>
    );
}
