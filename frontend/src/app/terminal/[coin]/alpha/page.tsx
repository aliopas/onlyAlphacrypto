import type { Metadata } from 'next';
import { LivingArticle } from '@/features/terminal/components/LivingArticle';

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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { coin } = await params;
    const symbol = coin.toUpperCase();

    return {
        title: `${symbol} Alpha Intelligence Report`,
        description: `Deep AI intelligence report and living article for ${symbol}. Comprehensive analysis with conviction scores, posture, and timeline.`,
        openGraph: {
            title: `${symbol} Alpha Report — OnlyAlpha`,
            description: `Deep AI intelligence report for ${symbol} with conviction scores and timeline.`,
            url: `${SITE_URL}/terminal/${coin}/alpha`,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${symbol} Alpha Report — OnlyAlpha`,
            description: `Deep AI intelligence report for ${symbol}.`,
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

    return <LivingArticle symbol={coinSymbol} />;
}