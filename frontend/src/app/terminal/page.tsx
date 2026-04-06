import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';
import { homeApi } from '@/features/home/api';

export const revalidate = 60;

export default async function TerminalPage() {
    const [news, radarSignals] = await Promise.all([
        terminalApi.getLatestWire(),
        homeApi.getRadarSignals(),
    ]);

    return <TerminalPageClient initialNews={news} radarSignals={radarSignals} />;
}
