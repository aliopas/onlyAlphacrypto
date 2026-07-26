import type { Metadata } from 'next';
import Link from 'next/link';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';
import { TRACKED_COINS } from '@/config/coins';
import { sanitizeForJsonLd } from '@/lib/json-ld';
import {
    ReadingMeasure,
    CalmNfaNotice,
    ed,
    formatDisplayDate,
    type PublicSnapshot,
} from '@/features/market-context/editorial';

export const revalidate = 3600;

const PAGE_PATH = '/blog';
const CANONICAL = `${SITE_URL}${PAGE_PATH}`;

interface MarketEditionResponse {
    available: boolean;
    snapshot: PublicSnapshot | null;
}

interface CoinListItem {
    symbol: string;
    snapshotId: number;
    status: 'published';
    publishedAt: string | null;
    updatedAt: string | null;
    generatorVersion: string;
    seoMeta: {
        metaTitle: string;
        metaDescription: string;
        seoKeywords: string[];
    } | null;
    seoScoreBand: string | null;
    hook: string | null;
}

interface CoinsListResponse {
    coins: CoinListItem[];
}

export const metadata: Metadata = {
    title: {
        absolute: 'OnlyAlpha Insights — Crypto Market Context & Coin Analysis',
    },
    description:
        'OnlyAlpha Insights: educational crypto market editions and coin-level structural analysis. Not financial advice.',
    robots: { index: true, follow: true },
    alternates: { canonical: CANONICAL },
    openGraph: {
        title: 'OnlyAlpha Insights',
        description:
            'Educational market context and coin analysis from OnlyAlpha. Structure before noise.',
        url: CANONICAL,
        type: 'website',
        siteName: 'OnlyAlpha',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OnlyAlpha Insights',
        description: 'Educational crypto market context and coin analysis.',
    },
};

async function fetchMarketEdition(): Promise<MarketEditionResponse> {
    try {
        const { data } = await apiClient.get<MarketEditionResponse>('/market/market-context');
        return data;
    } catch {
        return { available: false, snapshot: null };
    }
}

async function fetchPublishedCoins(): Promise<CoinListItem[]> {
    try {
        const { data } = await apiClient.get<CoinsListResponse>('/market/market-context/coins');
        return Array.isArray(data.coins) ? data.coins : [];
    } catch {
        return [];
    }
}

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                item: CANONICAL,
            },
        ],
    };
}

export default async function BlogIndexPage() {
    const [edition, coins] = await Promise.all([fetchMarketEdition(), fetchPublishedCoins()]);
    const coinBySymbol = new Map(coins.map((c) => [c.symbol.toUpperCase(), c]));
    const snap = edition.available ? edition.snapshot : null;
    const editionUpdated = formatDisplayDate(snap?.publishedAt ?? snap?.updatedAt);

    return (
        <ReadingMeasure>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd()),
                }}
            />

            <nav className={`${ed.type.meta} mb-8`} aria-label="Breadcrumb">
                <Link href="/" className={ed.colors.link}>
                    Home
                </Link>
                <span className="text-[#333] mx-2" aria-hidden>
                    /
                </span>
                <span className="text-[#8a8680]">Blog</span>
            </nav>

            <header className={ed.space.heroBottom}>
                <p className={`${ed.type.wordmark} mb-3`}>OnlyAlpha Insights</p>
                <h1 className={`${ed.type.h1} mb-4`}>Market context &amp; coin analysis</h1>
                <p className={ed.type.dek}>
                    Educational reading on why markets move and how major assets are structured —
                    not live trading signals. Not financial advice.
                </p>
            </header>

            <CalmNfaNotice />

            <section className="mb-12">
                <h2 className="text-xl font-semibold text-white mb-4">Market edition</h2>
                {snap ? (
                    <Link
                        href="/blog/market-context"
                        className="block border border-[#1f1f1f] bg-[#0a0a0a] rounded-lg p-5 hover:border-[#333] transition-colors"
                    >
                        <p className="text-xs uppercase tracking-wider text-[#6a6660] mb-2">
                            Weekly Market Context
                        </p>
                        <p className="text-lg font-semibold text-white mb-2">
                            {snap.weekLabel
                                ? `Edition ${snap.weekLabel}`
                                : 'Latest market context edition'}
                        </p>
                        <p className="text-sm text-[#a8a49e] mb-3">
                            Why crypto markets are moving — liquidity, Bitcoin correlation, macro,
                            and the week&apos;s narrative.
                        </p>
                        {editionUpdated && (
                            <p className={ed.type.meta}>Updated {editionUpdated}</p>
                        )}
                    </Link>
                ) : (
                    <div className="border border-[#1f1f1f] rounded-lg p-5 text-[#8a8680] text-sm">
                        No market edition is published yet. Check back after the next editorial
                        publish.
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-xl font-semibold text-white mb-4">Coin pages</h2>
                <p className={`${ed.type.bodySm} mb-6 text-[#8a8680]`}>
                    Structural context for the OnlyAlpha tracked set. Empty cards mean a page has
                    not been generated yet.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {TRACKED_COINS.map((symbol) => {
                        const row = coinBySymbol.get(symbol);
                        const href = `/blog/${symbol.toLowerCase()}`;
                        const updated = formatDisplayDate(row?.updatedAt ?? row?.publishedAt);
                        const title =
                            row?.seoMeta?.metaTitle ||
                            `${symbol} price analysis | OnlyAlpha Insights`;
                        const hook =
                            row?.hook ||
                            (row
                                ? `Educational ${symbol} market structure and news context.`
                                : `${symbol} page not published yet.`);

                        return (
                            <li key={symbol}>
                                <Link
                                    href={href}
                                    className={`block h-full border rounded-lg p-4 transition-colors ${
                                        row
                                            ? 'border-[#1f1f1f] bg-[#0a0a0a] hover:border-[#333]'
                                            : 'border-[#151515] bg-transparent opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-baseline justify-between gap-2 mb-2">
                                        <span className="text-base font-semibold text-white">
                                            {symbol}
                                        </span>
                                        {row?.seoScoreBand && (
                                            <span className="text-[10px] uppercase tracking-wider text-[#6a6660]">
                                                SEO {row.seoScoreBand}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[#c8c4be] line-clamp-2 mb-2">
                                        {sanitizeForJsonLd(title)}
                                    </p>
                                    <p className="text-xs text-[#8a8680] line-clamp-2 mb-2">
                                        {hook}
                                    </p>
                                    <p className={ed.type.meta}>
                                        {row
                                            ? updated
                                                ? `Updated ${updated}`
                                                : 'Published'
                                            : 'Coming soon'}
                                    </p>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </ReadingMeasure>
    );
}
