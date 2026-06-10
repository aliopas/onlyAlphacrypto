'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface Signal {
    id: number;
    signalId: number;
    coinSymbol: string;
    signalState: string | null;
    entryPrice: number;
    takeProfitPrice: number | null;
    tp2Price: number | null;
    tp3Price: number | null;
    stopLossPrice: number | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function SignalControlPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [signals, setSignals] = useState<Signal[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const [paused, setPaused] = useState<boolean | null>(null);
    const [pauseLoading, setPauseLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
    const [tpForm, setTpForm] = useState({
        takeProfitPrice: '',
        tp2Price: '',
        tp3Price: '',
        stopLossPrice: '',
    });
    const [tpLoading, setTpLoading] = useState(false);

    const fetchSignals = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('state', 'ACTIVE');
            params.append('page', String(page));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/score-records?${params}`);
            if (!response.ok) throw new Error('Failed to fetch signals');
            const data = await response.json();
            setSignals(data.records);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load signals');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, page]);

    const fetchPauseStatus = useCallback(async () => {
        try {
            const response = await fetchWithAuth('/admin/maintenance/status?page=signal_generation');
            if (response.ok) {
                const data = await response.json();
                setPaused(data.inMaintenance);
            }
        } catch {
            // ignore
        }
    }, [fetchWithAuth]);

    useEffect(() => {
        fetchSignals();
        fetchPauseStatus();
    }, [fetchSignals, fetchPauseStatus]);

    const handlePause = async () => {
        setPauseLoading(true);
        setActionMessage(null);
        try {
            const response = await fetchWithAuth('/admin/signals/pause-generation', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to pause');
            setPaused(true);
            setActionMessage('Signal generation paused');
        } catch (err) {
            setActionMessage(err instanceof Error ? err.message : 'Failed to pause');
        } finally {
            setPauseLoading(false);
        }
    };

    const handleResume = async () => {
        setPauseLoading(true);
        setActionMessage(null);
        try {
            const response = await fetchWithAuth('/admin/signals/resume-generation', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to resume');
            setPaused(false);
            setActionMessage('Signal generation resumed');
        } catch (err) {
            setActionMessage(err instanceof Error ? err.message : 'Failed to resume');
        } finally {
            setPauseLoading(false);
        }
    };

    const openEdit = (signal: Signal) => {
        setEditingSignal(signal);
        setTpForm({
            takeProfitPrice: signal.takeProfitPrice?.toString() ?? '',
            tp2Price: signal.tp2Price?.toString() ?? '',
            tp3Price: signal.tp3Price?.toString() ?? '',
            stopLossPrice: signal.stopLossPrice?.toString() ?? '',
        });
    };

    const closeEdit = () => {
        setEditingSignal(null);
        setTpForm({ takeProfitPrice: '', tp2Price: '', tp3Price: '', stopLossPrice: '' });
    };

    const handleTpRaise = async () => {
        if (!editingSignal) return;
        setTpLoading(true);
        setActionMessage(null);
        try {
            const body: Record<string, number> = {};
            if (tpForm.takeProfitPrice) body.takeProfitPrice = Number(tpForm.takeProfitPrice);
            if (tpForm.tp2Price) body.tp2Price = Number(tpForm.tp2Price);
            if (tpForm.tp3Price) body.tp3Price = Number(tpForm.tp3Price);
            if (tpForm.stopLossPrice) body.stopLossPrice = Number(tpForm.stopLossPrice);

            const response = await fetchWithAuth(`/admin/signals/${editingSignal.id}/targets`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'TP raise failed');
            }
            setActionMessage('Targets updated successfully');
            closeEdit();
            fetchSignals();
        } catch (err) {
            setActionMessage(err instanceof Error ? err.message : 'TP raise failed');
        } finally {
            setTpLoading(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Signal Control</h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${paused === true ? 'bg-red-500' : paused === false ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-sm text-gray-400">
                            {paused === true ? 'Paused' : paused === false ? 'Running' : 'Unknown'}
                        </span>
                    </div>
                    {paused !== true ? (
                        <button
                            onClick={handlePause}
                            disabled={pauseLoading}
                            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                            Pause Generation
                        </button>
                    ) : (
                        <button
                            onClick={handleResume}
                            disabled={pauseLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            Resume Generation
                        </button>
                    )}
                </div>
            </div>

            {actionMessage && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">{actionMessage}</div>
            )}

            {/* Signals Table */}
            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#111] text-gray-300">
                                <th className="px-3 py-2 text-left">ID</th>
                                <th className="px-3 py-2 text-left">Coin</th>
                                <th className="px-3 py-2 text-left">State</th>
                                <th className="px-3 py-2 text-left">Entry</th>
                                <th className="px-3 py-2 text-left">TP1</th>
                                <th className="px-3 py-2 text-left">TP2</th>
                                <th className="px-3 py-2 text-left">TP3</th>
                                <th className="px-3 py-2 text-left">SL</th>
                                <th className="px-3 py-2 text-left">Created</th>
                                <th className="px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                            )}
                            {error && (
                                <tr><td colSpan={10} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
                            )}
                            {!loading && !error && signals.map((signal) => (
                                <tr key={signal.id} className="border-t border-[#222] text-gray-400">
                                    <td className="px-3 py-2">{signal.id}</td>
                                    <td className="px-3 py-2">{signal.coinSymbol}</td>
                                    <td className="px-3 py-2">
                                        <span className="px-2 py-0.5 rounded text-xs bg-[#1a1a1a]">{signal.signalState ?? 'N/A'}</span>
                                    </td>
                                    <td className="px-3 py-2">{signal.entryPrice.toFixed(2)}</td>
                                    <td className="px-3 py-2">{signal.takeProfitPrice?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{signal.tp2Price?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{signal.tp3Price?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{signal.stopLossPrice?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{new Date(signal.createdAt).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => openEdit(signal)}
                                            className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 text-xs"
                                        >
                                            Edit Targets
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >Previous</button>
                    <span className="px-3 py-1">Page {page} of {pagination.totalPages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >Next</button>
                </div>
            )}

            {/* Edit Modal */}
            {editingSignal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Edit Targets — {editingSignal.coinSymbol}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP1</label>
                                <input
                                    type="number"
                                    value={tpForm.takeProfitPrice}
                                    onChange={(e) => setTpForm((f) => ({ ...f, takeProfitPrice: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP2</label>
                                <input
                                    type="number"
                                    value={tpForm.tp2Price}
                                    onChange={(e) => setTpForm((f) => ({ ...f, tp2Price: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP3</label>
                                <input
                                    type="number"
                                    value={tpForm.tp3Price}
                                    onChange={(e) => setTpForm((f) => ({ ...f, tp3Price: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Stop Loss</label>
                                <input
                                    type="number"
                                    value={tpForm.stopLossPrice}
                                    onChange={(e) => setTpForm((f) => ({ ...f, stopLossPrice: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleTpRaise}
                                disabled={tpLoading}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {tpLoading ? 'Saving...' : 'Save Targets'}
                            </button>
                            <button
                                onClick={closeEdit}
                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
