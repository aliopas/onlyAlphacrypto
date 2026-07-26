'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/features/shared/components/Sidebar';
import { TickerBar } from '@/features/shared/components/TickerBar';

interface AppChromeProps {
    children: React.ReactNode;
}

function isEditorialPath(pathname: string): boolean {
    return pathname === '/blog' || pathname.startsWith('/blog/');
}

/**
 * Operational chrome (Sidebar + Ticker) for Intelligence Platform routes.
 * Hidden on editorial Market Context routes so reading shell owns the experience.
 */
export function AppChrome({ children }: AppChromeProps) {
    const pathname = usePathname() ?? '';
    const editorial = isEditorialPath(pathname);

    if (editorial) {
        return (
            <main className="flex-1 flex flex-col h-full min-w-0 bg-black overflow-hidden">
                {children}
            </main>
        );
    }

    return (
        <>
            <Sidebar />
            <main className="flex-1 flex flex-col h-full min-w-0 bg-black pb-[72px] md:pb-0">
                <TickerBar />
                {children}
            </main>
        </>
    );
}
