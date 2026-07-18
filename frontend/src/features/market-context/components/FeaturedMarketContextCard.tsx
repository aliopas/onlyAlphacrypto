import Link from 'next/link';
import {
    formatEditionLabel,
    formatPublishedDate,
    marketContextApi,
} from '@/features/market-context/api';

/**
 * Homepage discovery card — latest published Market Context snapshot (any kind).
 * Hides entirely when no published edition (DEC-040 G21 / G26).
 */
export async function FeaturedMarketContextCard() {
    const data = await marketContextApi.getLatestPublished();
    const snapshot = data.available ? data.snapshot : null;
    if (!snapshot) return null;

    const edition = formatEditionLabel(snapshot.kind, snapshot.weekLabel);
    const published = formatPublishedDate(snapshot.publishedAt);

    return (
        <Link
            href="/blog/market-context"
            className="group block bg-[#0A0A0A] border border-[#333] hover:border-[#555] transition-colors p-5 md:p-6"
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">
                    Featured Market Context
                </span>
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider shrink-0">
                    {snapshot.kind.replace(/_/g, ' ')}
                </span>
            </div>
            <h2 className="text-base md:text-lg font-semibold text-white tracking-tight mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                Why is the crypto market moving?
            </h2>
            <p className="text-sm text-[#888] leading-relaxed mb-4">
                Educational market-wide context — liquidity, dominance, macro, and structural
                outlook. Not financial advice.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-[#666]">
                <span className="text-[#aaa]">{edition}</span>
                {published && (
                    <>
                        <span className="text-[#333]">·</span>
                        <span>Published {published}</span>
                    </>
                )}
                <span className="text-[#333]">·</span>
                <span className="text-[var(--color-primary)] group-hover:underline">Read edition →</span>
            </div>
        </Link>
    );
}
