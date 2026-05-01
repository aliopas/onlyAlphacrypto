import type { Metadata } from 'next';
import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { homeApi } from '@/features/home/api';
import { MasterArticle } from '@/features/terminal/types';
import { COINS, SITE_URL } from '@/lib/constants';

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
        headline: masterArticle.metaTitle || `${symbol} Terminal — Live Analysis`,
        description: masterArticle.metaDescription || `AI-powered analysis for ${symbol}`,
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

    let title = `${symbol} Terminal — Live Analysis & Intelligence`;
    let description = `Real-time AI-powered analysis, news, and intelligence for ${symbol}. Track price action, on-chain data, and market sentiment.`;
    let keywords: string[] | undefined = undefined;
    let noArticle = false;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) title = masterArticle.metaTitle;
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords && Array.isArray(masterArticle.seoKeywords)) {
                keywords = masterArticle.seoKeywords;
            }
        } else {
            noArticle = true;
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for metadata:', e);
        noArticle = true;
    }

    return {
        title: {
            absolute: title,
        },
        description,
        keywords,
        ...(noArticle && { robots: { index: false, follow: false } }),
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${coin}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${coin}`,
        },
    };
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

    const news = await terminalApi.getLatestWire({ coin: coinSymbol });
    const radarSignals = await homeApi.getRadarSignals();

    const radarId = resolvedSearchParams.radarId ? Number(resolvedSearchParams.radarId) : undefined;
    const isAlphaFocus = resolvedSearchParams.alpha === 'true';

    let masterArticle: MasterArticle | null = null;
    try {
        const resp = await terminalApi.getMasterArticle(coinSymbol);
        masterArticle = resp.masterArticle;
    } catch { /* silently fail, JSON-LD fallback handles it */ }

    const jsonLd = buildArticleJsonLd(coinSymbol, masterArticle);

    // The component below natively handles merging and filtering now
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
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
