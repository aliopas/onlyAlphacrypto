import { TerminalPageClient } from '@/features/terminal/components/TerminalPageClient';
import { terminalApi } from '@/features/terminal/api';

export const revalidate = 60;

export default async function TerminalPage() {
    const news = await terminalApi.getLatestWire();

    return <TerminalPageClient initialNews={news} />;
}
