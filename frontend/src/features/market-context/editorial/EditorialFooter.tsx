import Link from 'next/link';
import { ed } from './tokens';

/** Slim legal/brand footer for publication paths. */
export function EditorialFooter() {
    const year = new Date().getFullYear();

    return (
        <footer
            className={`w-full border-t ${ed.colors.rule} mt-auto`}
            style={{ fontFamily: ed.font.ui }}
        >
            <div
                className={`${ed.measureIndex} mx-auto ${ed.space.pageX} py-10 md:py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6`}
            >
                <div>
                    <p className={`${ed.type.wordmark} mb-2`}>OnlyAlpha Insights</p>
                    <p className={ed.type.footer}>
                        © {year} OnlyAlpha · Educational market reading
                    </p>
                </div>
                <nav
                    className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]"
                    aria-label="Editorial legal"
                >
                    <Link href="/blog" className={ed.type.navLink}>
                        Insights
                    </Link>
                    <Link href="/disclaimer" className={ed.type.navLink}>
                        Disclaimer
                    </Link>
                    <Link href="/about" className={ed.type.navLink}>
                        About
                    </Link>
                    <Link href="/" className={ed.type.navLink}>
                        OnlyAlpha
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
