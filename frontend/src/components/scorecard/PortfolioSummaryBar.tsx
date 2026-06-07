'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/features/shared/api/client';

interface ScorecardSummary {
    totalBudget: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
}

interface Props {
    summary: ScorecardSummary | null;
}

export default function PortfolioSummaryBar({ summary: initialSummary }: Props) {
    const [summary, setSummary] = useState<ScorecardSummary | null>(initialSummary);
    const [error, setError] = useState(false);

    const fetchSummary = useCallback(async () => {
        try {
            setError(false);
            const { data } = await apiClient.get<{ summary: ScorecardSummary }>('/scorecard');
            setSummary(data.summary);
        } catch {
            setError(true);
        }
    }, []);

    useEffect(() => {
        if (!initialSummary) {
            fetchSummary();
        }
    }, [initialSummary, fetchSummary]);

    if (error || !summary) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-[#0A0A0A] border border-red-500/30 rounded-lg p-4">
                        <div className="text-xs text-red-400 mb-1">Failed to load</div>
                        <button
                            onClick={fetchSummary}
                            className="text-xs text-[#666] hover:text-white underline"
                        >
                            Retry
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    const pnlColor = summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    const pnlSign = summary.totalPnl >= 0 ? '+' : '';

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Model Budget</div>
                <div className="text-xl font-mono font-bold">
                    ${summary.totalBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Current Value</div>
                <div className="text-xl font-mono font-bold">
                    ${summary.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Total P&L</div>
                <div className={`text-xl font-mono font-bold ${pnlColor}`}>
                    {pnlSign}{summary.totalPnlPercent.toFixed(2)}%
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Active</div>
                <div className="text-xl font-mono font-bold text-emerald-400">
                    {summary.activeCoins}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Watchlist</div>
                <div className="text-xl font-mono font-bold text-yellow-400">
                    {summary.watchlistCoins}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Simulated P&L</div>
                <div className={`text-xl font-mono font-bold ${pnlColor}`}>
                    {pnlSign}${summary.totalPnl.toFixed(2)}
                </div>
            </div>
        </div>
    );
}