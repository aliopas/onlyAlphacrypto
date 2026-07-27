'use client';

import { useEffect } from 'react';
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
 * Ops chrome (Sidebar + Ticker) for platform routes.
 * Insights uses a full-document reading shell — no app panel scroll trap.
 */
export function AppChrome({ children }: AppChromeProps) {
    const pathname = usePathname() ?? '';
    const editorial = isEditorialPath(pathname);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (editorial) {
            root.classList.add('editorial-mode');
            body.classList.add('editorial-mode');
        } else {
            root.classList.remove('editorial-mode');
            body.classList.remove('editorial-mode');
        }
        return () => {
            root.classList.remove('editorial-mode');
            body.classList.remove('editorial-mode');
        };
    }, [editorial]);

    if (editorial) {
        return (
            <div className="editorial-shell w-full min-h-screen flex flex-col bg-[#070706]">
                {children}
            </div>
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
