'use client';

import { useState, useEffect } from 'react';

export default function ScorecardSoftLaunchPopup() {
    const [visible, setVisible] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        setVisible(true);
    }, []);

    const handleDismiss = () => {
        setFadingOut(true);
        setTimeout(() => setVisible(false), 400);
    };

    if (!visible) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-[400ms] ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleDismiss}
        >
            <div
                className={`bg-[#0D0D0D] border border-[#222] rounded-xl p-6 max-w-md mx-4 shadow-2xl transition-all duration-[400ms] ${fadingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#333] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl text-[#666]">science</span>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white mb-2">⚙️ Under Development</h2>
                        <p className="text-sm text-[#888] leading-relaxed mb-4">
                            This feature is still under active development. The current signal accuracy hasn&apos;t reached our target — false signals are still being generated at a higher rate than acceptable. We&apos;re actively testing and refining the algorithm to deliver the best possible results before going live.
                        </p>
                        <button
                            onClick={handleDismiss}
                            className="w-full bg-[#1A1A1A] border border-[#333] text-white px-4 py-2 rounded-lg hover:bg-[#222] transition-colors text-sm font-medium"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}