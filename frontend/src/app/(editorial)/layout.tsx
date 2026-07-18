import Link from 'next/link';
import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
import { Footer } from '@/features/shared/components/Footer';

/**
 * Editorial reading shell for Market Context (DEC-040 MC-UX-0).
 * Typography-first, calm chrome — distinct from Terminal / ops dashboard.
 * Route group does not change public URL (/blog/market-context).
 */
export default function EditorialLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#050505]">
            <header className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-black/90 backdrop-blur-md">
                <div className="max-w-3xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
                    <Link
                        href="/"
                        className="text-sm font-bold tracking-tighter text-white hover:text-white/90 transition-colors"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        aria-label="OnlyAlpha home"
                    >
                        <span className="flex items-baseline">
                            <span className="leading-none">O</span>
                            <span className="relative leading-none">
                                A
                                <span className="absolute bottom-0 right-0 translate-x-[40%] translate-y-[45%] text-[10px] text-[var(--color-primary)] font-medium">
                                    c
                                </span>
                            </span>
                        </span>
                    </Link>
                    <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.14em]">
                        <span className="text-[#666] hidden sm:inline">Market Context</span>
                        <Link
                            href="/terminal"
                            className="text-[#888] hover:text-[var(--color-primary)] transition-colors"
                        >
                            Open Terminal
                        </Link>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-5 md:px-8 py-10 md:py-14">
                <ErrorBoundary>{children}</ErrorBoundary>
            </div>

            <Footer />
        </div>
    );
}
