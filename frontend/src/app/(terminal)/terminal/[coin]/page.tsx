import type { Metadata } from 'next';
import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { homeApi } from '@/features/home/api';
import { MasterArticle, CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';
import { COINS, SITE_URL } from '@/lib/constants';
import { CoinSeoContent, COIN_SEO_DATA } from '@/components/seo/CoinSeoContent';
import { FaqSchema, FaqItem } from '@/components/seo/FaqSchema';
import { SEO_CONTENT_ENABLED } from '@/lib/env';
import { isTrackedCoin } from '@/config/coins';
import { sanitizeForJsonLd } from '@/lib/json-ld';

export const revalidate = 60;
export const dynamicParams = true;

export function generateStaticParams() {
    return COINS.map((coin) => ({ coin: coin.toLowerCase() }));
}

type Params = Promise<{ coin: string }>;

function buildArticleJsonLd(symbol: string, masterArticle: MasterArticle | null): Record<string, unknown> {
    const staticData = COIN_SEO_DATA[symbol];
    const evergreenHeadline =
        staticData?.metaTitle ?? `${symbol} Live AI Analysis — Market Intelligence | OnlyAlpha`;
    const evergreenDescription =
        staticData?.metaDescription ??
        `Real-time AI-powered analysis and market intelligence for ${symbol} on OnlyAlpha.`;

    const breadcrumb = {
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
            {
                '@type': 'ListItem',
                position: 3,
                name: `${staticData?.name ?? symbol} Intelligence`,
                item: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
            },
        ],
    };

    if (!masterArticle) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: evergreenHeadline,
            description: evergreenDescription,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
            breadcrumb,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: evergreenHeadline,
        description: evergreenDescription,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        datePublished: masterArticle.createdAt,
        dateModified: masterArticle.updatedAt,
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        breadcrumb,
        // News headline kept as secondary signal only — never replaces evergreen page name
        about: masterArticle.metaTitle
            ? { '@type': 'Thing', name: sanitizeForJsonLd(masterArticle.metaTitle) }
            : undefined,
    };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();
    const staticData = COIN_SEO_DATA[symbol];

    // Evergreen primary SEO — never overwrite with volatile AI news headlines
    const title =
        staticData?.metaTitle ?? `${symbol} Live AI Analysis — Market Intelligence | OnlyAlpha`;
    const description =
        staticData?.metaDescription ??
        `Real-time AI-powered analysis, news, and market intelligence for ${symbol}. Track trend regime, momentum, and algorithmic signals on OnlyAlpha.`;
    const keywords = staticData?.keywords ?? [
        `${symbol} AI analysis`,
        `${symbol} market intelligence`,
        `${symbol} live analysis`,
        'OnlyAlpha',
    ];

    return {
        title: {
            absolute: title,
        },
        description,
        keywords,
        robots: { index: true, follow: true },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
            type: 'website',
            siteName: 'OnlyAlpha',
            images: [
                {
                    url: `${SITE_URL}/opengraph-image.png`,
                    width: 1200,
                    height: 630,
                    alt: `${staticData?.name ?? symbol} AI Analysis — OnlyAlpha`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${SITE_URL}/opengraph-image.png`],
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
        },
    };
}

function buildCoinFaq(symbol: string): FaqItem[] {
    const data = COIN_SEO_DATA[symbol];
    const name = data?.name ?? symbol;
    return [
        {
            question: `What is ${name}?`,
            answer:
                data?.whatIs ??
                `${name} (${symbol}) is a tracked cryptocurrency on OnlyAlpha.`,
        },
        {
            question: `How does OnlyAlpha analyze ${name}?`,
            answer: `${
                data?.coverage ?? `OnlyAlpha analyzes ${name} across technical timeframes and market regimes.`
            } Not Financial Advice.`,
        },
        {
            question: `What signals does OnlyAlpha generate for ${name}?`,
            answer:
                `OnlyAlpha generates data-driven BULLISH or BEARISH directional context for ${name} based on algorithmic technical and regime inputs. All outputs are for educational purposes only and are not financial advice.`,
        },
    ];
}

export default async function CoinTerminalPage({
    params,
    searchParams
}: {
    params: Promise<{ coin: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    let news: CoinNews[] = [];
    let radarSignals: RadarSignal[] = [];
    try {
        [news, radarSignals] = await Promise.all([
            terminalApi.getLatestWire({ coin: coinSymbol }),
            homeApi.getRadarSignals(),
        ]);
    } catch (e) {
        console.error('[SEO] Error fetching terminal data:', e);
    }

    const radarId = resolvedSearchParams.radarId ? Number(resolvedSearchParams.radarId) : undefined;
    const isAlphaFocus = resolvedSearchParams.alpha === 'true';

    let masterArticle: MasterArticle | null = null;
    try {
        const resp = await terminalApi.getMasterArticle(coinSymbol);
        masterArticle = resp.masterArticle;
    } catch { /* silently fail, JSON-LD fallback handles it */ }

    const jsonLd = buildArticleJsonLd(coinSymbol, masterArticle);
    const coinFaq = isTrackedCoin(coinSymbol) ? buildCoinFaq(coinSymbol) : [];
    const showSeoContent = SEO_CONTENT_ENABLED && isTrackedCoin(coinSymbol);
    const staticData = COIN_SEO_DATA[coinSymbol];
    const displayName = staticData?.name ?? coinSymbol;

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {coinFaq.length > 0 && <FaqSchema items={coinFaq} />}
            <div className="flex flex-col h-full min-h-0 gap-0">
                {showSeoContent && (
                    <header className="shrink-0 pb-3 border-b border-[#1a1a1a] mb-3">
                        <h1 className="text-sm md:text-base font-semibold text-white tracking-tight">
                            {displayName} ({coinSymbol}) Live AI Analysis
                        </h1>
                        <p className="mt-1 text-xs text-[#666] max-w-3xl leading-relaxed">
                            {staticData?.metaDescription ??
                                `Real-time AI market intelligence for ${displayName} on OnlyAlpha.`}
                        </p>
                    </header>
                )}
                <div className="flex-1 min-h-0">
                    <TerminalPageClient
                        initialNews={news}
                        coin={coinSymbol}
                        radarSignals={radarSignals}
                        initialRadarId={radarId}
                        isAlphaFocus={isAlphaFocus}
                    />
                </div>
                {showSeoContent && <CoinSeoContent symbol={coinSymbol} visible />}
            </div>
        </>
    );
}

