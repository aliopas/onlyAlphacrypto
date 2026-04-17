import type { Metadata } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';
import { AirdropsPageClient } from '@/features/airdrop/components/AirdropsPageClient';

export const revalidate = 60;

const SITE_URL = 'https://onlyalphacrypto.com';

export const metadata: Metadata = {
    title: 'Airdrop Farm Grid — Track Active Crypto Airdrops',
    description: 'Discover and track active crypto airdrops. AI-powered risk assessment, farming progress tracking, and deadline monitoring for DeFi airdrops.',
    openGraph: {
        title: 'Airdrop Farm Grid — OnlyAlpha',
        description: 'Discover and track active crypto airdrops with AI-powered risk assessment.',
        url: `${SITE_URL}/airdrops`,
        type: 'website',
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
    try {
        projects = await airdropApi.getProjects();
    } catch (error) {
        console.error('[Airdrops] Failed to load projects on server:', error);
    }

    return <AirdropsPageClient initialProjects={projects} />;
}
