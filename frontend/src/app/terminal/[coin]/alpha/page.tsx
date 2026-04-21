import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LivingArticle } from '@/features/terminal/components/LivingArticle';
import { terminalApi } from '@/features/terminal/api';
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
        headline: masterArticle.metaTitle || `${symbol} Alpha Intelligence Report`,
        description: masterArticle.metaDescription || `Deep AI intelligence report for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`,
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

    let title = `${symbol} Alpha Intelligence Report`;
    let description = `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`;
    let keywords: string[] | undefined = undefined;
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
        ...(noArticle && { robots: { index: false, follow: false } }),
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/terminal/${coin}/alpha`,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: {
            canonical: `${SITE_URL}/terminal/${coin}/alpha`,
        },
    };
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

    if (!masterArticle) {
        notFound();
    }

    const jsonLd = buildArticleJsonLd(coinSymbol, masterArticle);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LivingArticle symbol={coinSymbol} />
        </>
    );
}