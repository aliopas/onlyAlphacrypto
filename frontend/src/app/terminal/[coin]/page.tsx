import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { homeApi } from '@/features/home/api';

export const revalidate = 60;

export default async function CoinTerminalPage({
    params,
    searchParams
}: {
    params: Promise<{ coin: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    // 1. Fetch generic news
    const news = await terminalApi.getLatestWire();

    // 2. We can also fetch radar signals to inject them natively as the user requested in the video!
    const radarSignals = await homeApi.getRadarSignals();

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const coinSymbol = resolvedParams.coin.toUpperCase();

    const radarId = resolvedSearchParams.radarId ? Number(resolvedSearchParams.radarId) : undefined;
    const isAlphaFocus = resolvedSearchParams.alpha === 'true';

    // The component below natively handles merging and filtering now
    return <TerminalPageClient
        initialNews={news}
        coin={coinSymbol}
        radarSignals={radarSignals}
        initialRadarId={radarId}
        isAlphaFocus={isAlphaFocus}
    />;
}
