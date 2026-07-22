import type { EvidenceStrength, PublicVerdictLabel } from '@/features/airdrop/types';

const VERDICT_STYLES: Record<
    PublicVerdictLabel,
    { label: string; className: string }
> = {
    not_recommended: {
        label: 'Not Recommended',
        className: 'text-rose-300/90 bg-rose-500/10 border-rose-500/25',
    },
    high_risk: {
        label: 'High Risk',
        className: 'text-orange-300/90 bg-orange-500/10 border-orange-500/25',
    },
    failed_legitimacy_checks: {
        label: 'Failed Checks',
        className: 'text-rose-300/80 bg-rose-500/8 border-rose-500/20',
    },
    under_review: {
        label: 'Under Review',
        className: 'text-amber-300/90 bg-amber-500/10 border-amber-500/25',
    },
    insufficient_evidence: {
        label: 'Insufficient Evidence',
        className: 'text-amber-200/80 bg-amber-500/8 border-amber-500/20',
    },
};

const EVIDENCE_STYLES: Record<EvidenceStrength, string> = {
    high: 'text-slate-200 bg-slate-500/15 border-slate-500/25',
    medium: 'text-slate-300/80 bg-slate-500/10 border-slate-500/20',
    low: 'text-[#777] bg-[#1a1a1a] border-[#333]',
};

export function ResearchVerdictBadge({
    verdict,
}: {
    verdict: PublicVerdictLabel;
}) {
    const s = VERDICT_STYLES[verdict] ?? VERDICT_STYLES.not_recommended;
    return (
        <span
            className={`inline-flex text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 border ${s.className}`}
        >
            {s.label}
        </span>
    );
}

export function EvidenceStrengthBadge({
    strength,
}: {
    strength: EvidenceStrength;
}) {
    return (
        <span
            className={`inline-flex text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 border ${EVIDENCE_STYLES[strength]}`}
        >
            Evidence: {strength}
        </span>
    );
}
