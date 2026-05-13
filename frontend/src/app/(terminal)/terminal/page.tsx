import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { homeApi } from '@/features/home/api';

export const revalidate = 60;

export const metadata: Metadata = {
    title: 'Terminal — Live Crypto Analysis Dashboard',
    description: 'Real-time AI-powered analysis dashboard for BTC, ETH, SOL, and 8 more cryptocurrencies. Live signals, market regime detection, and deep intelligence reports.',
    keywords: ['crypto terminal', 'live crypto analysis', 'crypto dashboard', 'BTC analysis', 'ETH analysis', 'OnlyAlpha terminal'],
    openGraph: {
        title: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha',
        description: 'Real-time AI-powered analysis dashboard for 11 top cryptocurrencies.',
        url: `${SITE_URL}/terminal`,
        siteName: 'OnlyAlpha',
        type: 'website',
        images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha',
        description: 'Real-time AI-powered analysis dashboard for 11 top cryptocurrencies.',
        images: [`${SITE_URL}/opengraph-image.png`],
    },
    alternates: { canonical: `${SITE_URL}/terminal` },
};

export default async function TerminalPage() {
    const [news, radarSignals] = await Promise.all([
        terminalApi.getLatestWire(),
        homeApi.getRadarSignals(),
    ]);

    return <TerminalPageClient initialNews={news} radarSignals={radarSignals} />;
}
