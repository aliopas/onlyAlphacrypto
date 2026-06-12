import type { Metadata } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';
import { AirdropsPageClient } from '@/features/airdrop/components/AirdropsPageClient';
import { SITE_URL } from '@/lib/constants';
import { FaqSchema, FaqItem } from '@/components/seo/FaqSchema';
import { sanitizeForJsonLd } from '@/lib/json-ld';

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

const AIRDROP_FAQ: FaqItem[] = [
    {
        question: 'What are crypto airdrops?',
        answer:
            'Crypto airdrops are distributions of tokens to early users, testers, or community members of a blockchain project, often used to bootstrap adoption and reward engagement.',
    },
    {
        question: 'How does OnlyAlpha rate airdrops?',
        answer:
            'OnlyAlpha scores airdrops using a quality model that considers CEX listings, price data availability, on-chain activity, farming difficulty, and risk indicators. Scores are for research and education only and do not constitute financial advice.',
    },
    {
        question: 'Is airdrop farming safe?',
        answer:
            'Airdrop farming involves smart-contract interactions, wallet exposure, token volatility, and potential scams. OnlyAlpha provides research tools to help users evaluate opportunities, but all participation is at your own risk and is not financial advice.',
    },
];

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Airdrops', item: `${SITE_URL}/airdrops` },
        ],
    };
}

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
            name: sanitizeForJsonLd(p.name),
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd()) }}
            />
            <FaqSchema items={AIRDROP_FAQ} />
            <AirdropsPageClient initialProjects={projects} initialError={fetchError} />
        </>
    );
}
