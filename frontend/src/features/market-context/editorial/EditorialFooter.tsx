import Link from 'next/link';
import { ed } from './tokens';

/** MC-ED-7 — slim legal/brand footer for editorial reading paths. */
export function EditorialFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className={`w-full border-t ${ed.colors.border} bg-black py-8 mt-auto`}>
            <div className={`${ed.measure} mx-auto ${ed.space.pageX} text-center`}>
                <p className={`${ed.type.footer} mb-3`}>
                    © {year} OnlyAlpha · Market Context
                </p>
                <nav
                    className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono"
                    aria-label="Editorial legal"
                >
                    <Link href="/disclaimer" className="text-[#555] hover:text-[#888] transition-colors">
                        Disclaimer
                    </Link>
                    <span className="text-[#333]" aria-hidden>
                        ·
                    </span>
                    <Link href="/about" className="text-[#555] hover:text-[#888] transition-colors">
                        About
                    </Link>
                    <span className="text-[#333]" aria-hidden>
                        ·
                    </span>
                    <Link href="/" className="text-[#555] hover:text-[#888] transition-colors">
                        OnlyAlpha
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
