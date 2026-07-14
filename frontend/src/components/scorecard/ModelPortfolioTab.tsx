'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/features/shared/api/client';
import PortfolioSummaryBar from '@/components/scorecard/PortfolioSummaryBar';
import ActivePortfolioTable from '@/components/scorecard/ActivePortfolioTable';
import WatchlistTable from '@/components/scorecard/WatchlistTable';
import CoinProfileModal from '@/components/scorecard/CoinProfileModal';
import TransactionHistory from '@/components/scorecard/TransactionHistory';

interface CoinRow {
    id: number;
    symbol: string;
    entryPrice: string;
    currentPrice: string | null;
    priceMovementAtEntry: string | null;
    status: string;
    signalClassification: string | null;
    cexListings: string | null;
    allocatedBudget: string;
    tp1: string | null;
    tp2: string | null;
    tp3: string | null;
    stopLoss: string | null;
    qualityScore: number | null;
    createdAt: string;
    updatedAt: string;
    direction?: string | null;
    postedEntryPrice?: string | null;
    averageEntryPrice?: string | null;
    initialBudget?: string | null;
    dcaBudget?: string | null;
    remainingSizeFrac?: string | null;
    dcaFilled?: boolean | null;
    tp1Hit?: boolean | null;
    tp2Hit?: boolean | null;
    tp3Hit?: boolean | null;
    realizedPnl?: string | null;
}

interface ScorecardSummary {
    totalBudget: number;
    totalCapital?: number;
    deployed?: number;
    positionsValue?: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
    cashBalance: number;
}

interface ScorecardData {
    summary: ScorecardSummary;
    active: CoinRow[];
    watchlist: CoinRow[];
}

interface ModelPortfolioTabProps {
    data: ScorecardData | null;
}

export default function ModelPortfolioTab({ data: initialData }: ModelPortfolioTabProps) {
    const [data, setData] = useState<ScorecardData | null>(initialData);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const { data: fresh } = await apiClient.get<ScorecardData>('/scorecard');
                setData(fresh);
            } catch {
                // silent fail, keep last data
            }
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-orange-500 text-base mt-0.5 shrink-0">engineering</span>
                    <p className="text-sm text-orange-200/80 leading-relaxed">
                        Model Portfolio monitoring is in active deployment. Verify all TP/SL, 
                        P&L, and position data manually until this banner is removed.
                    </p>
                </div>
            </div>

            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-yellow-500 text-base mt-0.5 shrink-0">warning</span>
                    <p className="text-sm text-yellow-200/80 leading-relaxed">
                        This is a simulated educational portfolio for educational purposes only. Not financial advice.
                        All positions are model positions used for learning purposes. NFA — Not Financial Advice.
                    </p>
                </div>
            </div>

            <PortfolioSummaryBar summary={data?.summary ?? null} />

            <ActivePortfolioTable coins={data?.active ?? []} onCoinClick={setSelectedSymbol} />

            <WatchlistTable coins={data?.watchlist ?? []} onCoinClick={setSelectedSymbol} />

            <TransactionHistory />

            <div className="mt-12 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#444] text-base mt-0.5 shrink-0">shield</span>
                    <div>
                        <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#555] mb-2">Disclaimer</h4>
                        <p className="text-[11px] text-[#555] leading-relaxed">
                            Past performance does <span className="text-[#888]">not</span> guarantee future results.
                            This is a <span className="text-[#888]">model portfolio</span> for educational simulation only.
                            OnlyAlpha is <span className="text-[#888]">not</span> a registered financial advisor.
                            Always <span className="text-[#888]">do your own research (DYOR)</span>.
                            <span className="text-[#888]"> NFA — Not Financial Advice.</span>
                        </p>
                    </div>
                </div>
            </div>

            <CoinProfileModal
                symbol={selectedSymbol}
                onClose={() => setSelectedSymbol(null)}
            />
        </>
    );
}

export type { CoinRow, ScorecardSummary, ScorecardData };
export type { ModelPortfolioTabProps };
