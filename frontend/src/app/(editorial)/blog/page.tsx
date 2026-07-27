import type { Metadata } from 'next';
import Link from 'next/link';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';
import { TRACKED_COINS } from '@/config/coins';
import {
    IndexMeasure,
    CalmNfaNotice,
    PublicationPath,
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
                name: 'Insights',
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
    const publishedCount = TRACKED_COINS.filter((s) => coinBySymbol.has(s)).length;

    return (
        <IndexMeasure>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd()),
                }}
            />

            <PublicationPath items={[{ label: 'Insights' }]} />

            <header className={`${ed.space.heroBottom} max-w-[36rem]`}>
                <p
                    className={`${ed.type.wordmark} mb-5`}
                    style={{ fontFamily: ed.font.ui }}
                >
                    OnlyAlpha Insights
                </p>
                <h1
                    className={`${ed.type.h1} mb-5`}
                    style={{ fontFamily: ed.font.display }}
                >
                    Structure before noise
                </h1>
                <p className={ed.type.dek} style={{ fontFamily: ed.font.body }}>
                    Long-form educational reading on why crypto markets move — weekly market
                    editions and asset briefs. Not live signals.
                </p>
            </header>

            <CalmNfaNotice />

            {/* Featured weekly edition — magazine lead */}
            <section className="mb-16 md:mb-20" aria-labelledby="edition-heading">
                <div
                    className="flex items-baseline justify-between gap-4 mb-6"
                    style={{ fontFamily: ed.font.ui }}
                >
                    <h2
                        id="edition-heading"
                        className={ed.type.chapterLabel + ' mb-0'}
                    >
                        This week
                    </h2>
                    {editionUpdated && (
                        <span className={ed.type.meta}>{editionUpdated}</span>
                    )}
                </div>

                {snap ? (
                    <Link
                        href="/blog/market-context"
                        className="group block border-t border-b border-[#1c1b19] py-8 md:py-10 transition-colors hover:border-[#2e2c28]"
                    >
                        <p
                            className={`${ed.type.editionBadge} mb-5 inline-block`}
                            style={{ fontFamily: ed.font.ui }}
                        >
                            Market Context
                            {snap.weekLabel ? ` · ${snap.weekLabel}` : ''}
                        </p>
                        <h3
                            className="text-[1.65rem] md:text-[2.1rem] font-normal text-[#f4f0ea] tracking-[-0.02em] leading-[1.2] mb-4 group-hover:text-white transition-colors"
                            style={{ fontFamily: ed.font.display }}
                        >
                            Why is the crypto market moving today?
                        </h3>
                        <p
                            className={`${ed.type.dek} mb-6 max-w-[38rem]`}
                            style={{ fontFamily: ed.font.body }}
                        >
                            Liquidity, Bitcoin correlation, macro narrative, and the week&apos;s
                            verified context — written for understanding.
                        </p>
                        <span
                            className="inline-flex items-center gap-2 text-[13px] tracking-wide text-[#b5a894] group-hover:text-[#ece8e1] transition-colors"
                            style={{ fontFamily: ed.font.ui }}
                        >
                            Read the edition
                            <span className="text-[#5c574f] group-hover:text-[#9c968c]" aria-hidden>
                                →
                            </span>
                        </span>
                    </Link>
                ) : (
                    <div className="border-t border-b border-[#1c1b19] py-10">
                        <p
                            className={ed.type.dek}
                            style={{ fontFamily: ed.font.body }}
                        >
                            The next market edition is in progress. Check back after the next
                            editorial publish.
                        </p>
                    </div>
                )}
            </section>

            {/* Asset index — editorial list, not dashboard cards */}
            <section id="assets" aria-labelledby="assets-heading">
                <div
                    className="flex flex-wrap items-baseline justify-between gap-3 mb-2"
                    style={{ fontFamily: ed.font.ui }}
                >
                    <h2 id="assets-heading" className={ed.type.chapterLabel + ' mb-0'}>
                        Asset briefs
                    </h2>
                    <span className={ed.type.meta}>
                        {publishedCount} of {TRACKED_COINS.length} published
                    </span>
                </div>
                <p
                    className={`${ed.type.bodySm} mb-8 max-w-[34rem]`}
                    style={{ fontFamily: ed.font.body }}
                >
                    Structural context for major assets — history, news impact, and outlook without
                    price targets.
                </p>

                <ul className="border-t border-[#1c1b19]">
                    {TRACKED_COINS.map((symbol) => {
                        const row = coinBySymbol.get(symbol);
                        const href = `/blog/${symbol.toLowerCase()}`;
                        const updated = formatDisplayDate(row?.updatedAt ?? row?.publishedAt);
                        const title =
                            row?.seoMeta?.metaTitle?.replace(/\s*\|\s*OnlyAlpha.*$/i, '').trim() ||
                            `${symbol} market structure`;
                        const hook =
                            row?.hook ||
                            (row
                                ? `Educational ${symbol} structure and news context.`
                                : null);

                        if (!row) {
                            return (
                                <li
                                    key={symbol}
                                    className="flex items-baseline gap-4 md:gap-6 py-4 border-b border-[#141311] opacity-45"
                                >
                                    <span
                                        className="w-14 shrink-0 text-[13px] tracking-wide text-[#6e6860]"
                                        style={{ fontFamily: ed.font.ui }}
                                    >
                                        {symbol}
                                    </span>
                                    <span
                                        className="flex-1 text-[0.95rem] text-[#5c574f]"
                                        style={{ fontFamily: ed.font.body }}
                                    >
                                        In preparation
                                    </span>
                                </li>
                            );
                        }

                        return (
                            <li key={symbol} className="border-b border-[#1c1b19]">
                                <Link
                                    href={href}
                                    className="group flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 py-5 md:py-6 transition-colors"
                                >
                                    <span
                                        className="w-14 shrink-0 text-[13px] tracking-wide text-[#a89a88] group-hover:text-[#ece8e1] transition-colors"
                                        style={{ fontFamily: ed.font.ui }}
                                    >
                                        {symbol}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span
                                            className={`${ed.type.indexTitle} block group-hover:text-white transition-colors`}
                                            style={{ fontFamily: ed.font.display }}
                                        >
                                            {title}
                                        </span>
                                        {hook && (
                                            <span
                                                className={`${ed.type.indexHook} block mt-1.5 line-clamp-2`}
                                                style={{ fontFamily: ed.font.body }}
                                            >
                                                {hook}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className="shrink-0 text-[12px] text-[#5c574f] sm:text-right sm:w-28 mt-1 sm:mt-0"
                                        style={{ fontFamily: ed.font.ui }}
                                    >
                                        {updated ?? 'Published'}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </IndexMeasure>
    );
}
