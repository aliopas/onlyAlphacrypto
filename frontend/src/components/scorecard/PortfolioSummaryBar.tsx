'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/features/shared/api/client';

interface ScorecardSummary {
    totalBudget: number;
    totalCapital?: number;
    currentValue: number;
    deployed?: number;
    positionsValue?: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
    cashBalance: number;
}

interface Props {
    summary: ScorecardSummary | null;
}

function toNum(value: unknown): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
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
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
                {[...Array(7)].map((_, i) => (
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

    const totalBudget = toNum(summary.totalCapital ?? summary.totalBudget);
    const deployed = toNum(summary.deployed);
    const positionsValue = toNum(summary.positionsValue);
    const currentValue = toNum(summary.currentValue);
    const cashBalance = toNum(summary.cashBalance);
    const totalPnl = toNum(summary.totalPnl);
    const totalPnlPercent = toNum(summary.totalPnlPercent);

    const pnlColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    const pnlSign = totalPnl >= 0 ? '+' : '';

    return (
        <div className="grid grid-cols-2 md:grid-cols-9 gap-3 mb-6">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Total Capital</div>
                <div className="text-xl font-mono font-bold">
                    ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Deployed</div>
                <div className="text-xl font-mono font-bold text-orange-400">
                    ${deployed.toFixed(0)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Cash</div>
                <div className="text-xl font-mono font-bold text-blue-400">
                    ${cashBalance.toFixed(0)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Positions Value</div>
                <div className="text-xl font-mono font-bold">
                    ${positionsValue.toFixed(0)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">NAV</div>
                <div className="text-xl font-mono font-bold">
                    ${currentValue.toFixed(0)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">P&L $</div>
                <div className={`text-xl font-mono font-bold ${pnlColor}`}>
                    {pnlSign}${totalPnl.toFixed(0)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">P&L %</div>
                <div className={`text-xl font-mono font-bold ${pnlColor}`}>
                    {pnlSign}{totalPnlPercent.toFixed(1)}%
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Active</div>
                <div className="text-xl font-mono font-bold text-emerald-400">
                    {toNum(summary.activeCoins)}
                </div>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                <div className="text-xs text-[#666] mb-1">Watchlist</div>
                <div className="text-xl font-mono font-bold text-yellow-400">
                    {toNum(summary.watchlistCoins)}
                </div>
            </div>
        </div>
    );
}