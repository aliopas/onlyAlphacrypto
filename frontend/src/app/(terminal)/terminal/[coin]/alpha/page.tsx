import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LivingArticle } from '@/features/terminal/components/LivingArticle';
import { terminalApi } from '@/features/terminal/api';
import { MasterArticle } from '@/features/terminal/types';
import { COINS, SITE_URL } from '@/lib/constants';
import { sanitizeForJsonLd } from '@/lib/json-ld';
import { CoinSeoContent, COIN_SEO_DATA } from '@/components/seo/CoinSeoContent';
import { SEO_CONTENT_ENABLED } from '@/lib/env';
import { isTrackedCoin } from '@/config/coins';

export const revalidate = 3600;
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
            name: `${symbol} Alpha Intelligence Report`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                    { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
                    { '@type': 'ListItem', position: 3, name: `${symbol} Alpha Report`, item: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha` },
                ],
            },
        };
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: masterArticle.metaTitle
            ? sanitizeForJsonLd(masterArticle.metaTitle)
            : `${symbol} Alpha Intelligence Report`,
        description: masterArticle.metaDescription
            ? sanitizeForJsonLd(masterArticle.metaDescription)
            : `Deep AI intelligence report for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        datePublished: masterArticle.createdAt,
        dateModified: masterArticle.updatedAt,
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
                { '@type': 'ListItem', position: 3, name: `${symbol} Alpha Report`, item: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha` },
            ],
        },
    };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();
    const staticData = COIN_SEO_DATA[symbol];

    let title = staticData
        ? `${staticData.name} (${symbol}) Alpha Intelligence Report`
        : `${symbol} Alpha Intelligence Report`;
    let description =
        staticData?.metaDescription ??
        `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`;
    let keywords = staticData?.keywords;
    let noArticle = false;

    try {
        const { masterArticle } = await terminalApi.getMasterArticle(symbol);
        if (masterArticle) {
            if (masterArticle.metaTitle) {
                title = masterArticle.metaTitle.replace(/\|\s*OnlyAlpha$/i, '') + ' — Alpha Report';
            }
            if (masterArticle.metaDescription) description = masterArticle.metaDescription;
            if (masterArticle.seoKeywords && Array.isArray(masterArticle.seoKeywords)) {
                keywords = masterArticle.seoKeywords;
            }
        } else {
            noArticle = true;
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for alpha metadata:', e);
        noArticle = true;
    }

    return {
        title: { absolute: title },
        description,
        keywords,
        robots: noArticle ? { index: false, follow: true } : { index: true, follow: true },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
            type: 'article',
            images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: `${symbol} Alpha Intelligence Report` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${SITE_URL}/opengraph-image.png`],
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        },
    };
}

function buildStaticFallbackJsonLd(symbol: string): Record<string, unknown> {
    const data = COIN_SEO_DATA[symbol];
    const name = data?.name ?? symbol;
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${name} (${symbol}) Alpha Intelligence Report`,
        description: `AI intelligence report for ${name} generated in real-time by the OnlyAlpha AI engine.`,
        author: { '@type': 'Organization', name: 'OnlyAlpha' },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon` },
        },
        url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        datePublished: data?.activationDate ?? new Date().toISOString().split('T')[0],
        mainEntityOfPage: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Terminal', item: `${SITE_URL}/terminal` },
                { '@type': 'ListItem', position: 3, name: `${name} Alpha Report`, item: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha` },
            ],
        },
    };
}

function AlphaFallback({ symbol }: { symbol: string }) {
    if (!SEO_CONTENT_ENABLED || !isTrackedCoin(symbol)) return null;
    const data = COIN_SEO_DATA[symbol];
    const name = data?.name ?? symbol;
    return (
        <article className="sr-only" aria-label={`${name} Alpha Intelligence Report`}>
            <h1>{name} ({symbol}) AI Intelligence Report</h1>
            <p>This report is generated in real-time by the OnlyAlpha AI engine.</p>
            <CoinSeoContent symbol={symbol} />
            <p>Not Financial Advice.</p>
        </article>
    );
}

export default async function AlphaSnapshotPage({
    params,
}: {
    params: Promise<{ coin: string }>;
}) {
    const resolvedParams = await params;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    let masterArticle: MasterArticle | null = null;
    try {
        const resp = await terminalApi.getMasterArticle(coinSymbol);
        masterArticle = resp.masterArticle;
    } catch { /* silently fail, JSON-LD fallback handles it */ }

    if (!masterArticle && !SEO_CONTENT_ENABLED) {
        notFound();
    }

    const hasArticle = masterArticle !== null;
    const jsonLd = hasArticle ? buildArticleJsonLd(coinSymbol, masterArticle) : buildStaticFallbackJsonLd(coinSymbol);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {hasArticle ? <LivingArticle symbol={coinSymbol} /> : <AlphaFallback symbol={coinSymbol} />}
        </>
    );
}
