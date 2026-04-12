import { LivingArticle } from '@/features/terminal/components/LivingArticle';

export const revalidate = 60;

export default async function AlphaSnapshotPage({
    params,
}: {
    params: Promise<{ coin: string }>;
}) {
    const resolvedParams = await params;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    return <LivingArticle symbol={coinSymbol} />;
}