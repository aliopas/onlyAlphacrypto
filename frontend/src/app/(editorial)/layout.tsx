import Link from 'next/link';
import { Source_Serif_4, Literata } from 'next/font/google';
import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
import { EditorialFooter } from '@/features/market-context/editorial';
import { ed } from '@/features/market-context/editorial/tokens';

const displayFont = Source_Serif_4({
    subsets: ['latin'],
    variable: '--font-editorial-display',
    display: 'swap',
});

const bodyFont = Literata({
    subsets: ['latin'],
    variable: '--font-editorial-body',
    display: 'swap',
});

/**
 * Publication shell for OnlyAlpha Insights — reading product, not app chrome.
 */
export default function EditorialLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className={`editorial-root flex-1 flex flex-col min-h-0 ${ed.colors.bg} ${displayFont.variable} ${bodyFont.variable}`}
        >
            <header
                className="sticky top-0 z-40 border-b border-[#141311]/bg-[#070706]/[backdrop-filter:blur(12px)]"
                style={{ fontFamily: ed.font.ui }}
            >
                <div
                    className={`${ed.measureIndex} mx-auto ${ed.space.pageX} ${ed.space.mastheadH} flex items-center justify-between gap-4`}
                >
                    <div className="flex items-center gap-6 min-w-0">
                        <Link
                            href="/blog"
                            className="flex items-baseline gap-2.5 min-w-0 group"
                            aria-label="OnlyAlpha Insights home"
                        >
                            <span
                                className={ed.type.mastheadMark}
                                style={{ fontFamily: ed.font.mono }}
                            >
                                <span className="flex items-baseline">
                                    <span className="leading-none">O</span>
                                    <span className="relative leading-none">
                                        A
                                        <span className="absolute bottom-0 right-0 translate-x-[40%] translate-y-[45%] text-[9px] text-[var(--color-primary)] font-medium">
                                            c
                                        </span>
                                    </span>
                                </span>
                            </span>
                            <span
                                className="hidden sm:inline text-[#2e2c28] select-none"
                                aria-hidden
                            >
                                /
                            </span>
                            <span
                                className={`${ed.type.wordmark} group-hover:text-[#9c968c] transition-colors`}
                            >
                                Insights
                            </span>
                        </Link>

                        <nav
                            className="hidden md:flex items-center gap-5 pl-5 border-l border-[#1c1b19]"
                            aria-label="Insights sections"
                        >
                            <Link href="/blog/market-context" className={ed.type.navLink}>
                                Market Context
                            </Link>
                            <Link href="/blog#assets" className={ed.type.navLink}>
                                Assets
                            </Link>
                        </nav>
                    </div>

                    <Link href="/terminal" className={ed.type.exitLink}>
                        Terminal
                        <span className="ml-1.5 text-[#3a3630]" aria-hidden>
                            ↗
                        </span>
                    </Link>
                </div>
            </header>

            <div className={`flex-1 ${ed.space.pageX} ${ed.space.pageY}`}>
                <ErrorBoundary>{children}</ErrorBoundary>
            </div>

            <EditorialFooter />
        </div>
    );
}
