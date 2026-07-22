import Link from 'next/link';
import type { AirdropResearchDetail } from '@/features/airdrop/types';
import {
    EvidenceStrengthBadge,
    ResearchVerdictBadge,
} from './ResearchVerdictBadge';

export function ResearchDetailClient({ detail }: { detail: AirdropResearchDetail }) {
    return (
        <article className="max-w-3xl mx-auto px-4 py-8 md:py-12">
            <Link
                href="/airdrops/research"
                className="text-[10px] font-mono text-[#555] hover:text-[#888] uppercase tracking-widest"
            >
                ← Research Archive
            </Link>

            <header className="mt-5 mb-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <ResearchVerdictBadge verdict={detail.verdictLabel} />
                    <EvidenceStrengthBadge strength={detail.evidenceStrength} />
                    <span className="text-[9px] font-mono text-[#555] uppercase">
                        {detail.network}
                    </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#eaeaea] tracking-tight leading-snug">
                    {detail.headline}
                </h1>
                <p className="mt-3 text-[13px] font-mono text-[#777] leading-relaxed">
                    {detail.summary}
                </p>
                <p className="mt-2 text-[10px] font-mono text-[#444]">
                    Analyzed{' '}
                    {new Date(detail.analyzedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </p>
            </header>

            {detail.researchBlurb && (
                <section className="bg-[#0C0C0C] border border-[#2a2a2a] p-5 mb-5">
                    <h2 className="text-[10px] font-mono text-[#666] uppercase tracking-[0.15em] mb-3">
                        Research notes
                    </h2>
                    <p className="text-[13px] font-mono text-[#999] leading-relaxed">
                        {detail.researchBlurb}
                    </p>
                </section>
            )}

            <section className="bg-[#0A0A0A] border border-[#222] p-5 mb-5">
                <h2 className="text-[10px] font-mono text-[#666] uppercase tracking-[0.15em] mb-3">
                    Why this verdict
                </h2>
                <ul className="space-y-2">
                    {detail.reasonsPublic.map((r) => (
                        <li
                            key={r}
                            className="text-[12px] font-mono text-[#888] leading-relaxed pl-3 border-l border-[#2a2a2a]"
                        >
                            {r}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="bg-[#0A0A0A] border border-[#1f1f1f] p-5 mb-5">
                <h2 className="text-[10px] font-mono text-[#666] uppercase tracking-[0.15em] mb-3">
                    Methodology
                </h2>
                <p className="text-[12px] font-mono text-[#777] leading-relaxed">
                    {detail.methodologyBlurb}
                </p>
            </section>

            {(detail.websiteUrl || detail.twitterUrl) && (
                <section className="bg-[#0A0A0A] border border-[#1f1f1f] p-5 mb-5">
                    <h2 className="text-[10px] font-mono text-[#666] uppercase tracking-[0.15em] mb-3">
                        Cited links (unverified)
                    </h2>
                    <div className="flex flex-col gap-2">
                        {detail.websiteUrl && (
                            <a
                                href={detail.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-[12px] font-mono text-slate-400 hover:text-slate-200 break-all"
                            >
                                Website: {detail.websiteUrl}
                            </a>
                        )}
                        {detail.twitterUrl && (
                            <a
                                href={detail.twitterUrl}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-[12px] font-mono text-slate-400 hover:text-slate-200 break-all"
                            >
                                Social profile: {detail.twitterUrl}
                            </a>
                        )}
                    </div>
                    <p className="mt-3 text-[10px] font-mono text-[#444]">
                        Links are identity signals from our evidence pack only — not endorsements.
                    </p>
                </section>
            )}

            <div className="bg-amber-500/5 border border-amber-500/15 p-4 mb-8">
                <p className="text-[11px] font-mono text-amber-200/70 leading-relaxed">
                    {detail.nfaDisclaimer}
                </p>
            </div>

            <div className="flex flex-wrap gap-3">
                <Link
                    href="/airdrops"
                    className="text-[10px] font-mono uppercase tracking-widest px-4 py-2 border border-[#333] text-slate-300 hover:bg-[#141414] transition-colors"
                >
                    View Active Farm Grid
                </Link>
                <Link
                    href="/airdrops/research"
                    className="text-[10px] font-mono uppercase tracking-widest px-4 py-2 border border-[#2a2a2a] text-[#666] hover:text-[#999] transition-colors"
                >
                    Back to Archive
                </Link>
            </div>
        </article>
    );
}
