import Link from 'next/link';
import { ed } from './tokens';

/** Post-body bridge only — quiet, not a product banner. */
export function ContinueLiveIntelligence() {
    return (
        <section
            className={`${ed.space.bridgeTop} border-t ${ed.colors.rule} pt-14 md:pt-16`}
            aria-labelledby="continue-live-heading"
        >
            <p
                className={`${ed.type.moduleLabel} mb-4`}
                style={{ fontFamily: ed.font.ui }}
            >
                Further reading
            </p>
            <h2
                id="continue-live-heading"
                className="text-[1.45rem] md:text-[1.65rem] font-normal text-[#f4f0ea] tracking-[-0.015em] mb-4"
                style={{ fontFamily: ed.font.display }}
            >
                Live markets on Terminal
            </h2>
            <p
                className={`${ed.type.bodySm} mb-8 max-w-[34rem]`}
                style={{ fontFamily: ed.font.body }}
            >
                This page is for understanding. When you need what is moving right now — wire,
                radar, and per-coin analysis — continue on the Intelligence Platform.
            </p>
            <Link
                href="/terminal"
                className="inline-flex items-center gap-2 text-[13px] tracking-wide text-[#b5a894] hover:text-[#f4f0ea] transition-colors border-b border-[#3a3630] hover:border-[#b5a894] pb-0.5"
                style={{ fontFamily: ed.font.ui }}
            >
                Open Terminal
                <span aria-hidden className="text-[#6e6860]">
                    →
                </span>
            </Link>
        </section>
    );
}
