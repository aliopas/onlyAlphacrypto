'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/features/shared/api/client';

interface CoinDetail {
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
    projectProfile: Record<string, unknown> | null;
    technicalAnalysis: Record<string, unknown> | null;
    createdAt: string;
}

interface Props {
    symbol: string | null;
    onClose: () => void;
}

function formatPrice(price: string | null): string {
    if (!price) return '—';
    const num = parseFloat(price);
    if (isNaN(num)) return '—';
    if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

export default function CoinProfileModal({ symbol, onClose }: Props) {
    const [coin, setCoin] = useState<CoinDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const fetchCoin = useCallback(async () => {
        if (!symbol) return;
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<CoinDetail>(`/scorecard/${symbol}`);
            setCoin(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchCoin();
    }, [fetchCoin]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!symbol) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#0D0D0D] border border-[#222] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-[#333] border-t-emerald-400 rounded-full" />
                    </div>
                )}

                {error && !loading && (
                    <div className="text-center py-8">
                        <p className="text-red-400 text-sm mb-3">Failed to load coin profile</p>
                        <button onClick={fetchCoin} className="text-xs text-[#666] hover:text-white underline">Retry</button>
                    </div>
                )}

                {!loading && !error && coin && (
                    <>
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-mono font-bold text-white">{coin.symbol}</h2>
                                <p className="text-sm text-[#666] mt-1">Model Position Profile</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-[#555] hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {coin.projectProfile && (
                            <div className="mb-6 p-4 bg-[#111] rounded-lg border border-[#1A1A1A]">
                                <h3 className="text-xs text-[#666] uppercase tracking-wider mb-3">Project Profile</h3>
                                <div className="space-y-2 text-sm">
                                    {Object.entries(coin.projectProfile).slice(0, 6).map(([key, val]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-[#555] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <span className="text-[#888] font-mono text-xs max-w-[200px] truncate">
                                                {typeof val === 'string' ? val : JSON.stringify(val).slice(0, 40)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-6 p-4 bg-[#111] rounded-lg border border-[#1A1A1A]">
                            <h3 className="text-xs text-[#666] uppercase tracking-wider mb-3">Simulated Position</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-[#555] text-xs mb-1">Entry Price</div>
                                    <div className="font-mono text-white">{formatPrice(coin.entryPrice)}</div>
                                </div>
                                <div>
                                    <div className="text-[#555] text-xs mb-1">Current Price</div>
                                    <div className="font-mono text-white">{formatPrice(coin.currentPrice)}</div>
                                </div>
                                <div>
                                    <div className="text-[#555] text-xs mb-1">Allocated Budget</div>
                                    <div className="font-mono text-white">${parseFloat(coin.allocatedBudget || '0').toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-[#555] text-xs mb-1">Classification</div>
                                    <div className={`font-mono text-xs px-2 py-0.5 rounded inline-block ${coin.signalClassification === 'STRATEGIC' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {coin.signalClassification || '—'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 p-4 bg-[#111] rounded-lg border border-[#1A1A1A]">
                            <h3 className="text-xs text-[#666] uppercase tracking-wider mb-3">Take Profit / Stop Loss</h3>
                            <div className="grid grid-cols-4 gap-2 text-sm">
                                <div className="text-center">
                                    <div className="text-[#555] text-xs mb-1">TP1</div>
                                    <div className="font-mono text-emerald-400">{formatPrice(coin.tp1)}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[#555] text-xs mb-1">TP2</div>
                                    <div className="font-mono text-emerald-400">{formatPrice(coin.tp2)}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[#555] text-xs mb-1">TP3</div>
                                    <div className="font-mono text-emerald-400">{formatPrice(coin.tp3)}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[#555] text-xs mb-1">Stop Loss</div>
                                    <div className="font-mono text-red-400">{formatPrice(coin.stopLoss)}</div>
                                </div>
                            </div>
                        </div>

                        {coin.technicalAnalysis && (
                            <div className="mb-4 p-4 bg-[#111] rounded-lg border border-[#1A1A1A]">
                                <h3 className="text-xs text-[#666] uppercase tracking-wider mb-3">Technical Analysis</h3>
                                <div className="space-y-2 text-sm">
                                    {Object.entries(coin.technicalAnalysis).map(([key, val]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-[#555] capitalize text-xs">{key}</span>
                                            <span className="text-[#888] font-mono text-xs">
                                                {typeof val === 'string' ? val : JSON.stringify(val).slice(0, 30)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {coin.cexListings && (
                            <div className="mb-4 p-4 bg-[#111] rounded-lg border border-[#1A1A1A]">
                                <h3 className="text-xs text-[#666] uppercase tracking-wider mb-2">CEX Listings</h3>
                                <p className="text-xs text-[#888]">{coin.cexListings}</p>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full mt-2 bg-[#1A1A1A] border border-[#333] text-white px-4 py-2 rounded-lg hover:bg-[#222] transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}