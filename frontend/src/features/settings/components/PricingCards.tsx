'use client';

interface Props {
    currentPlan: 'free' | 'pro' | 'institutional';
    isOgGenesis: boolean;
}

export function PricingCards({ currentPlan, isOgGenesis }: Props) {
    return (
        <div className="bg-black border border-[#333] p-8">
            <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6">Neural Access Tier</h3>

            <div className="bg-[#0A0A0A] border border-[#333] p-4 mb-6">
                <p className="text-[10px] font-mono text-[#555] uppercase tracking-wider">OnlyAlpha is currently in OPEN BETA — All features are free.</p>
                {isOgGenesis && (
                    <p className="text-[11px] font-mono text-emerald-500 mt-1">Your early access is locked in permanently.</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`border p-6 relative ${currentPlan === 'free' ? 'border-emerald-500/30' : 'border-[#222]'}`}>
                    {currentPlan === 'free' && (
                        <span className="absolute top-4 right-4 text-[9px] font-mono text-emerald-500">ACTIVE</span>
                    )}
                    <h4 className="text-[20px] font-mono text-white font-bold mb-1">FREE</h4>
                    <p className="text-[14px] font-mono text-[#555] mb-4">$0</p>
                    <div className="border-t border-[#222] my-4" />
                    <ul className="space-y-2 mb-6">
                        <li className="text-[11px] font-mono text-[#888]">Full AI Analysis Pipeline</li>
                        <li className="text-[11px] font-mono text-[#888]">5 Chat Prompts / min</li>
                        <li className="text-[11px] font-mono text-[#888]">Live Market Data</li>
                        <li className="text-[11px] font-mono text-[#888]">Airdrop Tracking</li>
                    </ul>
                    <button disabled className="w-full bg-[#111] border border-[#333] text-[#555] px-4 py-2 text-[10px] font-mono uppercase">
                        Current Plan
                    </button>
                </div>

                <div className="border border-[#222] p-6 relative">
                    <span className="absolute top-4 right-4 text-[9px] font-mono text-[#555] border border-[#333] px-2 py-0.5">COMING SOON</span>
                    <h4 className="text-[20px] font-mono text-white font-bold mb-1">PRO</h4>
                    <p className="text-[14px] font-mono text-[#888] mb-4">$29/mo</p>
                    <div className="border-t border-[#222] my-4" />
                    <ul className="space-y-2 mb-6">
                        <li className="text-[11px] font-mono text-[#888]">Everything in Free</li>
                        <li className="text-[11px] font-mono text-[#888]">500 Chat Prompts / hr</li>
                        <li className="text-[11px] font-mono text-[#888]">Developer API Access</li>
                        <li className="text-[11px] font-mono text-[#888]">5 API Keys</li>
                        <li className="text-[11px] font-mono text-[#888]">Priority AI Queue</li>
                    </ul>
                    <button disabled className="w-full bg-[#111] border border-[#333] text-[#333] px-4 py-2 text-[10px] font-mono uppercase">
                        Coming Soon
                    </button>
                </div>

                <div className="border border-[#222] p-6 relative">
                    <span className="absolute top-4 right-4 text-[9px] font-mono text-[#555] border border-[#333] px-2 py-0.5">COMING SOON</span>
                    <h4 className="text-[20px] font-mono text-white font-bold mb-1">INSTITUTIONAL</h4>
                    <p className="text-[14px] font-mono text-[#888] mb-4">$199/mo</p>
                    <div className="border-t border-[#222] my-4" />
                    <ul className="space-y-2 mb-6">
                        <li className="text-[11px] font-mono text-[#888]">Everything in Pro</li>
                        <li className="text-[11px] font-mono text-[#888]">5,000 Chat Prompts / hr</li>
                        <li className="text-[11px] font-mono text-[#888]">20 API Keys</li>
                        <li className="text-[11px] font-mono text-[#888]">Dedicated AI Queue</li>
                        <li className="text-[11px] font-mono text-[#888]">Custom Webhooks</li>
                        <li className="text-[11px] font-mono text-[#888]">Priority Support</li>
                    </ul>
                    <button disabled className="w-full bg-[#111] border border-[#333] text-[#333] px-4 py-2 text-[10px] font-mono uppercase">
                        Coming Soon
                    </button>
                </div>
            </div>
        </div>
    );
}
