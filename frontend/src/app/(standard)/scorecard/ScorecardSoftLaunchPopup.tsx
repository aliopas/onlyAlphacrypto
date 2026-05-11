'use client';

import { useState, useEffect } from 'react';

export default function ScorecardSoftLaunchPopup() {
    const [visible, setVisible] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem('onlyalpha:scorecard_popup_seen');
        if (!seen) {
            setVisible(true);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('onlyalpha:scorecard_popup_seen', 'true');
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
                        <h2 className="text-lg font-semibold text-white mb-2">Welcome to Market Intelligence Scorecard</h2>
                        <p className="text-sm text-[#888] leading-relaxed mb-4">
                            Track AI-generated market scenarios with historical win rates, bull probabilities, and Wyckoff phase analysis. Data refreshes every 6 minutes.
                        </p>
                        <button
                            onClick={handleDismiss}
                            className="w-full bg-[#1A1A1A] border border-[#333] text-white px-4 py-2 rounded-lg hover:bg-[#222] transition-colors text-sm font-medium"
                        >
                            Got it, let&apos;s explore
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}