import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { CoinNews } from '@/features/terminal/types';
import { homeApi } from '@/features/home/api';
import { RadarSignal } from '@/features/home/types';
import { FaqSchema, FaqItem } from '@/components/seo/FaqSchema';
import { SEO_CONTENT_ENABLED } from '@/lib/env';
import { TRACKED_COINS } from '@/config/coins';

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
        images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Terminal — Live Crypto Analysis Dashboard | OnlyAlpha',
        description: 'Real-time AI-powered analysis dashboard for 11 top cryptocurrencies.',
        images: [`${SITE_URL}/opengraph-image.png`],
    },
    alternates: { canonical: `${SITE_URL}/terminal` },
};

const TERMINAL_FAQ: FaqItem[] = [
    {
        question: 'What is OnlyAlpha Terminal?',
        answer:
            'OnlyAlpha Terminal is a live cryptocurrency intelligence dashboard that combines algorithmic market regime detection, multi-timeframe technical context, and AI-generated reports for educational purposes. It is not financial advice.',
    },
    {
        question: 'Which cryptocurrencies are tracked?',
        answer: `OnlyAlpha tracks ${TRACKED_COINS.join(', ')} across multiple timeframes, monitoring trend posture, momentum, volatility, and key technical levels.`,
    },
    {
        question: 'How does AI analysis work on OnlyAlpha?',
        answer:
            'The platform reads market data through pre-computed technical indicators, then uses AI to explain the directional context. All outputs are framed as BULLISH or BEARISH market intelligence for education only and do not constitute financial advice.',
    },
    {
        question: 'What are algorithmic signals?',
        answer:
            'Algorithmic signals are data-driven directional outlooks generated from technical and market-regime inputs. They express BULLISH or BEARISH bias for research and education, not as investment recommendations.',
    },
];

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
        ],
    };
}

function TerminalSeoContent() {
    if (!SEO_CONTENT_ENABLED) return null;
    return (
        <section className="sr-only" aria-label="Terminal overview">
            <h2>OnlyAlpha Terminal — Live Crypto Intelligence Dashboard</h2>
            <p>
                OnlyAlpha Terminal is a live cryptocurrency intelligence dashboard covering {TRACKED_COINS.join(', ')}.
                It combines algorithmic market regime detection, multi-timeframe technical context, and AI-generated
                intelligence reports to highlight BULLISH or BEARISH directional bias for educational purposes only.
            </p>
            <p>Not Financial Advice.</p>
        </section>
    );
}

export default async function TerminalPage() {
    let news: CoinNews[] = [];
    let radarSignals: RadarSignal[] = [];
    try {
        [news, radarSignals] = await Promise.all([
            terminalApi.getLatestWire(),
            homeApi.getRadarSignals(),
        ]);
    } catch (e) {
        console.error('[SEO] Error fetching terminal data:', e);
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd()) }}
            />
            <FaqSchema items={TERMINAL_FAQ} />
            <TerminalSeoContent />
            <TerminalPageClient initialNews={news} radarSignals={radarSignals} />
        </>
    );
}
