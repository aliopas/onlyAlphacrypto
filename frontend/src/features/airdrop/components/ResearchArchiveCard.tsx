import Link from 'next/link';
import type { AirdropResearchListItem } from '@/features/airdrop/types';
import {
    EvidenceStrengthBadge,
    ResearchVerdictBadge,
} from './ResearchVerdictBadge';

export function ResearchArchiveCard({ item }: { item: AirdropResearchListItem }) {
    const reasons = item.reasonsPublic.slice(0, 2);

    return (
        <Link
            href={`/airdrops/research/${item.slug}`}
            className="block bg-[#0A0A0A] border border-[#222] hover:border-[#3a3a3a] p-5 transition-colors group"
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-[#e8e8e8] tracking-tight truncate group-hover:text-white">
                        {item.name}
                    </h3>
                    <span className="text-[10px] font-mono text-[#555] uppercase">
                        {item.network}
                    </span>
                </div>
                <ResearchVerdictBadge verdict={item.verdictLabel} />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                <EvidenceStrengthBadge strength={item.evidenceStrength} />
            </div>

            {reasons.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                    {reasons.map((r) => (
                        <li
                            key={r}
                            className="text-[11px] font-mono text-[#666] leading-relaxed line-clamp-2"
                        >
                            · {r}
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]">
                <span className="text-[9px] font-mono text-[#444]">
                    Analyzed{' '}
                    {new Date(item.analyzedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    })}
                </span>
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider group-hover:text-slate-400">
                    View research →
                </span>
            </div>
        </Link>
    );
}
