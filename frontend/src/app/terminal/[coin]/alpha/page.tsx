import type { Metadata } from 'next';
import { LivingArticle } from '@/features/terminal/components/LivingArticle';
import { terminalApi } from '@/features/terminal/api';
import { MasterArticle } from '@/features/terminal/types';

export const revalidate = 60;

const COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
    'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
    'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
];

export function generateStaticParams() {
    return COINS.map((coin) => ({ coin: coin.toLowerCase() }));
}

const SITE_URL = 'https://onlyalphacrypto.com';

type Params = Promise<{ coin: string }>;

function buildArticleJsonLd(symbol: string, masterArticle: MasterArticle | null): Record<string, unknown> {
    if (!masterArticle) {
        return {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${symbol} Alpha Intelligence Report`,
            url: `${SITE_URL}/terminal/${symbol.toLowerCase()}/alpha`,
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
    };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    let title = `${symbol} Alpha Intelligence Report`;
    let description = `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`;
    let keywords: string[] | undefined = undefined;

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
        }
    } catch (e) {
        console.error('[SEO] Error fetching master article for alpha metadata:', e);
    }

    return {
        title: { absolute: title },
        description,
        keywords,
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