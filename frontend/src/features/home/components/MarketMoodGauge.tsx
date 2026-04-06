export function MarketMoodGauge() {
    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6 flex flex-col items-center">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6 w-full text-center">
                Market Mood
            </h3>
            <div className="flex flex-col items-center justify-center py-6 gap-3">
                <span className="material-symbols-outlined text-[32px] text-[#333]">lock</span>
                <span className="text-[9px] font-mono text-[#555] border border-[#333] px-2 py-0.5 uppercase">Coming Soon</span>
                <p className="text-[11px] text-[#444] mt-1">AI-powered market sentiment</p>
            </div>
        </div>
    );
}
