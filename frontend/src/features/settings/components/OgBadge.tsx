'use client';

interface Props {
    isOgGenesis: boolean;
    plan: string;
}

export function OgBadge({ isOgGenesis, plan }: Props) {
    if (isOgGenesis) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#FFD700] bg-[#FFD700]/5">
                <span className="text-[10px] font-mono font-bold text-[#FFD700] tracking-widest uppercase">OG GENESIS MEMBER</span>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#333]">
            <span className="text-[10px] font-mono font-bold text-[#888] tracking-widest uppercase">{plan.toUpperCase()} PLAN</span>
        </div>
    );
}
