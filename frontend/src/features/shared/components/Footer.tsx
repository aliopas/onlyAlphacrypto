import Link from 'next/link';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full border-t border-[#222] bg-black py-6 mt-auto">
            <div className="max-w-4xl mx-auto px-4 text-center">
                <p className="text-[#555] text-xs font-mono mb-2">
                    © {currentYear} OnlyAlpha. All rights reserved.
                </p>
                <nav className="flex items-center justify-center flex-wrap gap-2 text-xs font-mono">
                    <Link
                        href="/privacy"
                        className="text-[#555] hover:text-[var(--color-primary)] transition-colors"
                    >
                        Privacy Policy
                    </Link>
                    <span className="text-[#333]">·</span>
                    <Link
                        href="/terms"
                        className="text-[#555] hover:text-[var(--color-primary)] transition-colors"
                    >
                        Terms of Service
                    </Link>
                    <span className="text-[#333]">·</span>
                    <Link
                        href="/disclaimer"
                        className="text-[#555] hover:text-[var(--color-primary)] transition-colors"
                    >
                        Disclaimer
                    </Link>
                    <span className="text-[#333]">·</span>
                    <Link
                        href="/about"
                        className="text-[#555] hover:text-[var(--color-primary)] transition-colors"
                    >
                        About
                    </Link>
                    <span className="text-[#333]">·</span>
                    <Link
                        href="/contact"
                        className="text-[#555] hover:text-[var(--color-primary)] transition-colors"
                    >
                        Contact
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
