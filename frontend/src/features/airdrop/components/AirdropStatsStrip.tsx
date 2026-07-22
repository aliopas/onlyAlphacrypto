'use client';

import Link from 'next/link';
import type { AirdropPublicStats } from '@/features/airdrop/types';

interface AirdropStatsStripProps {
    stats: AirdropPublicStats | null;
    loading?: boolean;
}

export function AirdropStatsStrip({ stats, loading }: AirdropStatsStripProps) {
    if (loading && !stats) {
        return (
            <div className="bg-[#0A0A0A] border border-[#2a2a2a] p-4 grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-[#141414] rounded" />
                ))}
            </div>
        );
    }

    const s = stats ?? {
        projectsScanned: 0,
        recommended: 0,
        underReview: 0,
        notRecommended: 0,
        acceptanceRatePercent: 0,
        lastPipelineAt: null,
    };

    const cells: Array<{ label: string; value: string; tone: string }> = [
        {
            label: 'Scanned',
            value: String(s.projectsScanned),
            tone: 'text-slate-200',
        },
        {
            label: 'Recommended',
            value: String(s.recommended),
            tone: 'text-emerald-400/90',
        },
        {
            label: 'Under Review',
            value: String(s.underReview),
            tone: 'text-amber-300/90',
        },
        {
            label: 'Not Recommended',
            value: String(s.notRecommended),
            tone: 'text-rose-300/80',
        },
        {
            label: 'Acceptance',
            value: `${s.acceptanceRatePercent}%`,
            tone: 'text-white',
        },
    ];

    return (
        <div className="bg-[#0A0A0A] border border-[#2a2a2a] p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                    <h2 className="text-[10px] font-mono text-[#777] uppercase tracking-[0.18em]">
                        Algorithmic Filter Dashboard
                    </h2>
                    <p className="text-[11px] font-mono text-[#555] mt-1 leading-relaxed max-w-2xl">
                        Strict multi-gate filter — low acceptance is intentional. Mood never equals legitimacy.
                    </p>
                </div>
                <Link
                    href="/airdrops/research"
                    className="text-[10px] font-mono text-slate-300 border border-[#333] px-3 py-1.5 hover:bg-[#141414] hover:border-[#444] transition-colors uppercase tracking-widest shrink-0"
                >
                    Research Archive →
                </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cells.map((c) => (
                    <div
                        key={c.label}
                        className="bg-[#0D0D0D] border border-[#222] px-3 py-2.5"
                    >
                        <span className="text-[9px] font-mono text-[#555] uppercase block mb-1">
                            {c.label}
                        </span>
                        <span className={`text-xl font-mono-nums font-bold ${c.tone}`}>
                            {c.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
