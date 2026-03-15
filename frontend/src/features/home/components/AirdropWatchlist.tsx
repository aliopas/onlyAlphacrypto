import { AirdropProject } from '@/features/airdrop/types';

interface Props {
    projects: AirdropProject[];
}

const STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
    SAFE: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    MEDIUM_RISK: { text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    HIGH_RISK: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    SCAM: { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export function AirdropWatchlist({ projects }: Props) {
    const displayProjects = projects.slice(0, 5);

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6 flex-1">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-4">Airdrop Watchlist</h3>
            <div className="space-y-5">
                {displayProjects.map((p) => {
                    const status = p.riskVerdict || 'SAFE';
                    const c = STATUS_COLOR[status] || STATUS_COLOR.SAFE;
                    return (
                        <div key={p.id} className={`border-l ${c.border.replace('border-', 'border-l-')} pl-4 py-1`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[13px] font-medium text-white">{p.name}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 border uppercase ${c.text} ${c.bg} ${c.border}`}>{status}</span>
                            </div>
                            <div className="text-[11px] font-mono text-[#555]">
                                {p.tgeAt ? `TGE EST: ` : 'NETWORK: '}<span className="font-mono-nums text-[#888]">{p.tgeAt ? new Date(p.tgeAt).toLocaleDateString() : p.network}</span>
                            </div>
                        </div>
                    );
                })}
                {displayProjects.length === 0 && (
                    <div className="text-center text-[#555] font-mono text-[10px] p-4 uppercase">
                        No active airdrops tracking
                    </div>
                )}
            </div>
            <div className="mt-8 pt-6 border-t border-[#333]">
                <div className="bg-black border border-[#333] p-3 rounded flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#135bec]">info</span>
                    <span className="text-[11px] text-[#888]">Monitoring {projects.length} on-chain projects.</span>
                </div>
            </div>
        </div>
    );
}
