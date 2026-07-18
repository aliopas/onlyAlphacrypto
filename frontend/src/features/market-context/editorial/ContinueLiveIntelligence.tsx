import Link from 'next/link';
import { ed } from './tokens';

/** MC-ED-6 — post-body bridge only. Never place above the fold. */
export function ContinueLiveIntelligence() {
    return (
        <section
            className={`${ed.space.bridgeTop} border-t ${ed.colors.border} pt-12 md:pt-16`}
            aria-labelledby="continue-live-heading"
        >
            <p className={`${ed.type.moduleLabel} mb-3`}>After this edition</p>
            <h2
                id="continue-live-heading"
                className="text-[1.35rem] md:text-[1.5rem] font-semibold text-white tracking-tight mb-3"
            >
                Continue with Live Intelligence
            </h2>
            <p className={`${ed.type.bodySm} mb-6 max-w-[60ch]`}>
                You have the structural picture — why markets may be behaving this way. When you
                need what is happening right now per asset, open the Intelligence Platform Terminal
                for live wire, radar, and coin-level analysis.
            </p>
            <div className="flex flex-wrap items-center gap-4">
                <Link
                    href="/terminal"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#141414] text-[#e8e6e3] border border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] text-sm font-medium transition-colors"
                >
                    Open Terminal
                </Link>
                <Link
                    href="/terminal"
                    className="text-[12px] font-mono text-[#555] hover:text-[#888] transition-colors"
                >
                    Radar &amp; live wire
                </Link>
            </div>
        </section>
    );
}
