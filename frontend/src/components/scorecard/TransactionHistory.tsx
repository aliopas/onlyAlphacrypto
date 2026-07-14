'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/features/shared/api/client';

interface TransactionRow {
    id: number;
    coinId: number;
    symbol?: string | null;
    type: string;
    price: string;
    amount: string | null;
    pnl: string | null;
    createdAt: string;
}

interface TransactionHistoryResponse {
    transactions: TransactionRow[];
    total: number;
    limit: number;
    offset: number;
}

const TX_LABELS: Record<string, string> = {
    entry: 'Simulated Entry',
    tp1_hit: 'TP1 Hit',
    tp2_hit: 'TP2 Hit',
    tp3_hit: 'TP3 Hit',
    sl_hit: 'Stop Loss Hit',
    dca: 'DCA',
    rebalance: 'Rebalance',
    manual_close: 'Manual Close',
};

const TX_BADGE: Record<string, string> = {
    entry: 'bg-blue-500/20 text-blue-400',
    tp1_hit: 'bg-emerald-500/20 text-emerald-400',
    tp2_hit: 'bg-emerald-500/20 text-emerald-400',
    tp3_hit: 'bg-emerald-500/20 text-emerald-400',
    sl_hit: 'bg-red-500/20 text-red-400',
    dca: 'bg-purple-500/20 text-purple-400',
    rebalance: 'bg-yellow-500/20 text-yellow-400',
    manual_close: 'bg-orange-500/20 text-orange-400',
};

function formatPrice(price: string): string {
    const num = parseFloat(price);
    if (isNaN(num)) return '—';
    if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<TransactionHistoryResponse>('/scorecard/transactions', {
                params: { limit, offset },
            });
            setTransactions(data.transactions);
            setTotal(data.total);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [limit, offset]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const hasMore = offset + transactions.length < total;

    if (error && transactions.length === 0) {
        return (
            <div className="border border-red-500/30 rounded-lg p-4 mb-6 text-center">
                <span className="text-red-400 text-sm">Failed to load transaction history</span>
                <button onClick={fetchTransactions} className="block mx-auto mt-2 text-xs text-[#666] hover:text-white underline">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="border border-[#222] rounded-lg overflow-hidden mb-6">
            <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                <span>Transaction History</span>
                {total > 0 && <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">Simulated</span>}
            </div>

            {loading && transactions.length === 0 && (
                <div className="p-4 space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse flex gap-4">
                            <div className="h-4 bg-[#222] rounded w-24" />
                            <div className="h-4 bg-[#222] rounded w-20" />
                            <div className="h-4 bg-[#222] rounded flex-1" />
                        </div>
                    ))}
                </div>
            )}

            {transactions.length === 0 && !loading && (
                <div className="p-6 text-center text-[#666] text-sm">
                    No simulated transactions yet.
                </div>
            )}

            {transactions.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-left px-4 py-3 font-medium">Type</th>
                                    <th className="text-right px-4 py-3 font-medium">Price</th>
                                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                                    <th className="text-right px-4 py-3 font-medium">P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr
                                        key={tx.id}
                                        className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'}`}
                                    >
                                        <td className="px-4 py-3 text-[#888] text-xs">{formatDate(tx.createdAt)}</td>
                                        <td className="px-4 py-3 font-mono text-emerald-400">{tx.symbol ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${TX_BADGE[tx.type] || 'bg-[#222] text-[#888]'}`}>
                                                {TX_LABELS[tx.type] || tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">{formatPrice(tx.price)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[#888]">
                                            {tx.amount ? `$${parseFloat(tx.amount).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {tx.pnl ? (
                                                <span className={parseFloat(tx.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                    {parseFloat(tx.pnl) >= 0 ? '+' : ''}{formatPrice(tx.pnl)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-[#0A0A0A] border-t border-[#1A1A1A] px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-[#555]">
                            Showing {offset + 1}–{Math.min(offset + transactions.length, total)} of {total}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setOffset(o => Math.max(0, o - limit))}
                                disabled={offset === 0}
                                className="text-xs px-3 py-1 bg-[#1A1A1A] border border-[#333] rounded hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setOffset(o => o + limit)}
                                disabled={!hasMore}
                                className="text-xs px-3 py-1 bg-[#1A1A1A] border border-[#333] rounded hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                Load More
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}