import Link from 'next/link';
import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
import { EditorialFooter } from '@/features/market-context/editorial';
import { ed } from '@/features/market-context/editorial/tokens';

/**
 * Editorial reading shell for Market Context (DEC-040 MC-UX-0 + MC-ED-1/7).
 * Publication identity masthead — not application navigation.
 * Route group does not change public URL (/blog/market-context).
 */
export default function EditorialLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${ed.colors.bg}`}>
            <header className="sticky top-0 z-40 border-b border-[#141414] bg-black/92 backdrop-blur-md">
                <div
                    className={`${ed.measure} mx-auto ${ed.space.pageX} h-14 flex items-center justify-between gap-6`}
                >
                    <div className="flex items-baseline gap-3 min-w-0">
                        <Link
                            href="/"
                            className={ed.type.mastheadMark}
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
                        <span className="text-[#2a2a2a] select-none" aria-hidden>
                            /
                        </span>
                        <Link href="/blog" className={ed.type.wordmark}>
                            OnlyAlpha Insights
                        </Link>
                    </div>
                    <Link href="/terminal" className={ed.type.exitLink}>
                        Exit to Terminal
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
