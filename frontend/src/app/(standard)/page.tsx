import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { homeApi } from '@/features/home/api';
import { AlphaFocusCard } from '@/features/home/components/AlphaFocusCard';
import { RadarGrid } from '@/features/home/components/RadarGrid';
import { MarketMoodGauge } from '@/features/home/components/MarketMoodGauge';
import { TopMovers } from '@/features/home/components/TopMovers';
import { AirdropWatchlist } from '@/features/home/components/AirdropWatchlist';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'OnlyAlpha — AI-Powered Crypto Intelligence | Real-Time Market Analysis',
  description: 'Track 11 top cryptocurrencies with AI-powered analysis, airdrop farming, on-chain intelligence, and real-time market signals. Free crypto intelligence platform.',
  keywords: ['crypto intelligence', 'AI crypto analysis', 'airdrop tracker', 'market signals', 'crypto analysis', 'OnlyAlpha'],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking, and on-chain intelligence for crypto market participants.',
    url: SITE_URL,
    siteName: 'OnlyAlpha',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'OnlyAlpha — AI-Powered Crypto Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OnlyAlpha — AI-Powered Crypto Intelligence',
    description: 'Real-time AI market analysis, airdrop tracking, and on-chain intelligence for crypto market participants.',
    images: [`${SITE_URL}/opengraph-image.png`],
  },
  alternates: { canonical: SITE_URL },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'OnlyAlpha',
  url: SITE_URL,
  description: 'AI-Powered Crypto Intelligence Platform',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/terminal?coin={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'OnlyAlpha',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
  },
};

export default async function HomePage() {
  const [alpha, signals, mood, moodHistory] = await Promise.all([
    homeApi.getAlphaFocus(),
    homeApi.getRadarSignals(),
    homeApi.getMarketMood(),
    homeApi.getMarketMoodHistory(),
  ]);

  const previousScore = moodHistory.length >= 2
    ? (moodHistory[1]?.finalScore ?? moodHistory[1]?.score)
    : undefined;
  const lastUpdated = moodHistory[0]?.createdAt;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <div className="flex flex-col lg:flex-row gap-4">
      {/* Left — 70% */}
      <div className="w-full lg:w-[70%] flex flex-col gap-4">
        <AlphaFocusCard data={alpha} />
        <RadarGrid signals={signals} />
      </div>

      {/* Right — 30% */}
      <div className="w-full lg:w-[30%] flex flex-col gap-4 lg:self-start">
        <MarketMoodGauge mood={mood} previousScore={previousScore} lastUpdated={lastUpdated} />
        <TopMovers />
        <AirdropWatchlist />
      </div>
      </div>
    </>
  );
}
