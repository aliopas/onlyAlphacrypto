import Link from 'next/link';
import { AirdropProject } from '@/features/airdrop/types';

type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH';
type RewardConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

const EFFORT_COLORS: Record<EffortLevel, { text: string; bg: string }> = {
    LOW: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    MEDIUM: { text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    HIGH: { text: 'text-red-400', bg: 'bg-red-400/10' },
};

const ECOSYSTEM_COLORS: Record<string, { text: string; bg: string }> = {
    ETH: { text: 'text-blue-400', bg: 'bg-blue-400/10' },
    SOL: { text: 'text-purple-400', bg: 'bg-purple-400/10' },
    TON: { text: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    BNB: { text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    Other: { text: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const CONFIDENCE_COLORS: Record<RewardConfidence, { text: string; border: string }> = {
    HIGH: { text: 'text-emerald-400', border: 'border-emerald-500/30' },
    MEDIUM: { text: 'text-yellow-400', border: 'border-yellow-500/30' },
    LOW: { text: 'text-orange-400', border: 'border-orange-500/30' },
    UNVERIFIED: { text: 'text-gray-400', border: 'border-gray-500/30' },
};

const NETWORK_CHIP: Record<string, { text: string; bg: string }> = {
    Mainnet: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    Testnet: { text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    L2: { text: 'text-blue-400', bg: 'bg-blue-400/10' },
};

const RISK_COLOR: Record<string, { text: string; bg: string; border: string }> = {
    SAFE: { text: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/30' },
    MEDIUM: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
    MEDIUM_RISK: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
    HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/5', border: 'border-orange-500/30' },
    HIGH_RISK: { text: 'text-orange-500', bg: 'bg-orange-500/5', border: 'border-orange-500/30' },
    SCAM: { text: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/30' },
    TESTNET: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
};

function formatEstValue(value: string | undefined): string {
    if (!value) return 'TBD';
    const trimmed = value.trim();
    if (trimmed.toUpperCase() === 'TBD' || trimmed === '') return 'TBD';
    if (/^\$/.test(trimmed)) return trimmed + '+';
    return '$' + trimmed + '+';
}

function getQualityColor(score: number): string {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
}

function formatDeadline(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (absDiffDays > 7) return null;
    if (absDiffDays === 0) return 'Today';
    if (absDiffDays === 1) return diffMs > 0 ? 'Tomorrow' : 'Yesterday';
    return diffMs > 0 ? `In ${absDiffDays} days` : `${absDiffDays} days ago`;
}

interface AirdropCardProps {
    project: AirdropProject;
    onClick?: () => void;
}

export function AirdropCard({ project, onClick }: AirdropCardProps) {
    const ecosystem = project.ecosystem ?? 'Other';
    const effortLevel = project.effortLevel ?? 'HIGH';
    const rewardConfidence = project.rewardConfidence ?? 'UNVERIFIED';
    const qualityScore = project.qualityScore ?? 0;

    const verdict = project.riskVerdict || 'SAFE';
    const c = RISK_COLOR[verdict] || RISK_COLOR.SAFE;
    const networkChip = NETWORK_CHIP[project.network] ?? { text: 'text-[#888]', bg: 'bg-[#888]/10' };
    const effortColors = EFFORT_COLORS[effortLevel] ?? EFFORT_COLORS.HIGH;
    const ecoColors = ECOSYSTEM_COLORS[ecosystem] ?? ECOSYSTEM_COLORS.Other;
    const confColors = CONFIDENCE_COLORS[rewardConfidence] ?? CONFIDENCE_COLORS.UNVERIFIED;
    const deadline = formatDeadline(project.snapshotAt ?? project.tgeAt ?? null);

    return (
        <Link
            href={`/airdrops/${project.id}`}
            onClick={onClick}
            className={`bg-[#0A0A0A] border p-5 hover:border-[#444] transition-all group block ${c.border}`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold tracking-tight uppercase text-white truncate">{project.name}</h3>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 ${ecoColors.text} ${ecoColors.bg} uppercase shrink-0`}>
                            {ecosystem}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 ${effortColors.text} ${effortColors.bg} uppercase shrink-0`}>
                            {effortLevel}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-mono px-2 py-0.5 border ${c.border} ${c.text} ${c.bg} tracking-wider uppercase`}>
                            {verdict}
                        </span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 ${networkChip.text} ${networkChip.bg}`}>
                            {project.network}
                        </span>
                    </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                    <span className="text-[10px] font-mono text-[#555] block">EST. VALUE</span>
                    <span className="text-lg font-mono-nums font-bold text-white">{formatEstValue(project.estValue)}</span>
                </div>
            </div>

            <div className="flex items-center justify-between mb-3 py-2 border-y border-[#222]">
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <span className="text-[9px] font-mono text-[#555] uppercase block">Quality</span>
                        <span className={`text-xl font-mono-nums font-bold ${getQualityColor(qualityScore)}`}>
                            {qualityScore}
                        </span>
                    </div>
                    <div className="h-8 w-px bg-[#333]" />
                    <div className="text-center">
                        <span className={`text-[9px] font-mono uppercase block ${confColors.text}`}>
                            {rewardConfidence}
                        </span>
                        <span className="text-[10px] font-mono text-[#555]">Confidence</span>
                    </div>
                </div>
                {deadline && (
                    <div className="text-right">
                        <span className="text-[9px] font-mono text-[#555] uppercase block">Deadline</span>
                        <span className="text-[11px] font-mono-nums font-bold text-[#888]">{deadline}</span>
                    </div>
                )}
            </div>

            {project.aiReport && (
                <p className="text-[10px] font-mono text-[#555] line-clamp-2 leading-relaxed">
                    {project.aiReport.slice(0, 120)}...
                </p>
            )}
        </Link>
    );
}