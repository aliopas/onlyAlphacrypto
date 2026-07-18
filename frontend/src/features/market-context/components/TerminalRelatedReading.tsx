import Link from 'next/link';
import {
    formatEditionLabel,
    formatPublishedDate,
    marketContextApi,
} from '@/features/market-context/api';

/**
 * Contextual Platform → MC handoff on Terminal index (macro / why context).
 * Hidden when no published snapshot (independence + no spam).
 */
export async function TerminalRelatedReading() {
    const data = await marketContextApi.getLatestPublished();
    const snapshot = data.available ? data.snapshot : null;
    if (!snapshot) return null;

    const edition = formatEditionLabel(snapshot.kind, snapshot.weekLabel);
    const published = formatPublishedDate(snapshot.publishedAt);

    return (
        <aside
            className="shrink-0 border border-[#2a2a2a] bg-[#0A0A0A]/90 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            aria-label="Related reading"
        >
            <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#666] mb-0.5">
                    Related reading
                </p>
                <p className="text-xs text-[#aaa] leading-snug">
                    Macro &amp; structural context — why the market is behaving this way
                    {edition ? (
                        <span className="text-[#777]">
                            {' '}
                            · {edition}
                            {published ? ` · ${published}` : ''}
                        </span>
                    ) : null}
                </p>
            </div>
            <Link
                href="/blog/market-context"
                className="shrink-0 text-[11px] font-mono text-[var(--color-primary)] hover:underline whitespace-nowrap"
            >
                Open Market Context →
            </Link>
        </aside>
    );
}
