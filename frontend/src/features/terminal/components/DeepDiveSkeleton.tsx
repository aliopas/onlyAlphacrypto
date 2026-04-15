'use client';

function SkeletonPulse({ className }: { className?: string }) {
    return (
        <div className={`relative overflow-hidden bg-[#111] border border-[#222] ${className ?? ''}`}>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-emerald-500/[0.03] to-transparent" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
        </div>
    );
}

function GlowingSkeleton({ className, children }: { className?: string; children?: React.ReactNode }) {
    return (
        <div className={`relative overflow-hidden bg-[#0A0A0A] border border-[#222] ${className ?? ''}`}>
            <div className="absolute inset-0 animate-pulse border border-emerald-500/[0.08]" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite_linear] bg-gradient-to-r from-transparent via-emerald-500/[0.04] to-transparent" />
            {children}
        </div>
    );
}

export function DeepDiveSkeleton() {
    const sectionCount = 7;

    return (
        <div className="mt-8 space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-5 bg-emerald-500/30 animate-pulse rounded-sm" />
                <SkeletonPulse className="h-4 w-48 rounded-sm" />
                <div className="ml-auto flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
                    <SkeletonPulse className="h-3 w-24 rounded-sm" />
                </div>
            </div>

            <GlowingSkeleton className="rounded-lg p-6">
                <div className="space-y-5">
                    <SkeletonPulse className="h-6 w-3/4 rounded" />
                    <div className="space-y-2 pt-2">
                        <SkeletonPulse className="h-3 w-full rounded-sm" />
                        <SkeletonPulse className="h-3 w-11/12 rounded-sm" />
                        <SkeletonPulse className="h-3 w-4/5 rounded-sm" />
                    </div>
                </div>
            </GlowingSkeleton>

            <div className="space-y-3">
                {Array.from({ length: sectionCount }).map((_, i) => (
                    <GlowingSkeleton key={i} className="rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-1 h-3 rounded-sm animate-pulse ${i === 0 || i === sectionCount - 1 ? 'bg-emerald-500/40' : 'bg-[#333]'}`} />
                            <SkeletonPulse className="h-3 w-36 rounded-sm" />
                        </div>
                        <div className="space-y-2 pl-4">
                            <SkeletonPulse className="h-2.5 w-full rounded-sm" />
                            <SkeletonPulse className="h-2.5 w-[95%] rounded-sm" />
                            <SkeletonPulse className="h-2.5 w-[85%] rounded-sm" />
                            {i % 2 === 0 && (
                                <>
                                    <SkeletonPulse className="h-2.5 w-[90%] rounded-sm" />
                                    <SkeletonPulse className="h-2.5 w-[70%] rounded-sm" />
                                </>
                            )}
                        </div>
                    </GlowingSkeleton>
                ))}
            </div>

            <GlowingSkeleton className="rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                    <SkeletonPulse className="h-4 w-32 rounded-sm" />
                </div>
                <div className="space-y-3 pl-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="border-l-2 border-[#222] pl-3 py-2">
                            <SkeletonPulse className="h-2.5 w-16 mb-2 rounded-sm" />
                            <SkeletonPulse className="h-2.5 w-full rounded-sm" />
                            <SkeletonPulse className="h-2.5 w-3/4 rounded-sm mt-1" />
                        </div>
                    ))}
                </div>
            </GlowingSkeleton>

            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
