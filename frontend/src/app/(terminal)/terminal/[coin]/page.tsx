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
    if (!masterArticle) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${symbol} Terminal — OnlyAlpha`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                    { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
                    { '@type': 'ListItem', position: 3, name: `${symbol} Intelligence`, item: `${SITE_URL}/terminal/${symbol.toLowerCase()}` },
                ],
            },
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: sanitizeForJsonLd(masterArticle.metaTitle) || `${symbol} Terminal — Live Analysis`,
        description: sanitizeForJsonLd(masterArticle.metaDescription) || `AI-powered analysis for ${symbol}`,
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
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
                { '@type': 'ListItem', position: 3, name: `${symbol} Intelligence`, item: `${SITE_URL}/terminal/${symbol.toLowerCase()}` },
            ],
        },
    };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();
    const staticData = COIN_SEO_DATA[symbol];

    let title = staticData?.metaTitle ?? `${symbol} Terminal — Live Analysis & Intelligence`;
    let description =
        staticData?.metaDescription ??
        `Real-time AI-powered analysis, news, and intelligence for ${symbol}. Track price action, on-chain data, and market sentiment.`;
    let keywords = staticData?.keywords;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) title = masterArticle.metaTitle;
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords && Array.isArray(masterArticle.seoKeywords)) {
                keywords = masterArticle.seoKeywords;
            }
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for metadata:', e);
    }

    return {
        title: {
            absolute: title,
        },
        description,
        keywords,
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}`,
            type: 'website',
            siteName: 'OnlyAlpha',
            images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: `${symbol} Analysis — OnlyAlpha` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
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

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {coinFaq.length > 0 && <FaqSchema items={coinFaq} />}
            {showSeoContent && <CoinSeoContent symbol={coinSymbol} />}
            <TerminalPageClient
                initialNews={news}
                coin={coinSymbol}
                radarSignals={radarSignals}
                initialRadarId={radarId}
                isAlphaFocus={isAlphaFocus}
            />
        </>
    );
}

