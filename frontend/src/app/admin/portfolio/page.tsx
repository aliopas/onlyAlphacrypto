'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface PortfolioCoin {
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
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const STATUS_OPTIONS = ['active', 'watchlist', 'exited'];
const CLASSIFICATION_OPTIONS = ['TACTICAL', 'STRATEGIC'];

export default function PortfolioPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [coins, setCoins] = useState<PortfolioCoin[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState('');
    const [symbolFilter, setSymbolFilter] = useState('');
    const [page, setPage] = useState(1);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        symbol: '',
        entryPrice: '',
        signalClassification: 'TACTICAL',
        status: 'watchlist',
    });
    const [addLoading, setAddLoading] = useState(false);

    const [editingCoin, setEditingCoin] = useState<PortfolioCoin | null>(null);
    const [editForm, setEditForm] = useState({
        entryPrice: '',
        tp1: '',
        tp2: '',
        tp3: '',
        stopLoss: '',
        allocatedBudget: '',
        status: '',
        signalClassification: '',
    });
    const [editLoading, setEditLoading] = useState(false);

    const [closingCoin, setClosingCoin] = useState<PortfolioCoin | null>(null);
    const [closePrice, setClosePrice] = useState('');
    const [closeLoading, setCloseLoading] = useState(false);

    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetConfirm, setResetConfirm] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const fetchCoins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (symbolFilter) params.append('symbol', symbolFilter.toUpperCase());
            params.append('page', String(page));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/portfolio/coins?${params}`);
            if (!response.ok) throw new Error('Failed to fetch coins');
            const data = await response.json();
            setCoins(data.coins);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load coins');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, statusFilter, symbolFilter, page]);

    useEffect(() => {
        fetchCoins();
    }, [fetchCoins]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/portfolio/coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: addForm.symbol,
                    entryPrice: Number(addForm.entryPrice),
                    signalClassification: addForm.signalClassification,
                    status: addForm.status,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to add coin');
            setMessage(`Added ${data.symbol} as ${data.status}`);
            setIsAddOpen(false);
            setAddForm({ symbol: '', entryPrice: '', signalClassification: 'TACTICAL', status: 'watchlist' });
            fetchCoins();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to add coin');
        } finally {
            setAddLoading(false);
        }
    };

    const openEdit = (coin: PortfolioCoin) => {
        setEditingCoin(coin);
        setEditForm({
            entryPrice: coin.entryPrice,
            tp1: coin.tp1 ?? '',
            tp2: coin.tp2 ?? '',
            tp3: coin.tp3 ?? '',
            stopLoss: coin.stopLoss ?? '',
            allocatedBudget: coin.allocatedBudget,
            status: coin.status,
            signalClassification: coin.signalClassification ?? '',
        });
        setMessage(null);
    };

    const closeEdit = () => {
        setEditingCoin(null);
        setEditForm({ entryPrice: '', tp1: '', tp2: '', tp3: '', stopLoss: '', allocatedBudget: '', status: '', signalClassification: '' });
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCoin) return;
        setEditLoading(true);
        setMessage(null);
        try {
            const body: Record<string, number | string> = {};
            if (editForm.entryPrice) body.entryPrice = Number(editForm.entryPrice);
            if (editForm.tp1) body.tp1 = Number(editForm.tp1);
            if (editForm.tp2) body.tp2 = Number(editForm.tp2);
            if (editForm.tp3) body.tp3 = Number(editForm.tp3);
            if (editForm.stopLoss) body.stopLoss = Number(editForm.stopLoss);
            if (editForm.allocatedBudget) body.allocatedBudget = Number(editForm.allocatedBudget);
            if (editForm.status) body.status = editForm.status;
            if (editForm.signalClassification) body.signalClassification = editForm.signalClassification;

            const response = await fetchWithAuth(`/admin/portfolio/coins/${editingCoin.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage('Coin updated');
            closeEdit();
            fetchCoins();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setEditLoading(false);
        }
    };

    const openClose = (coin: PortfolioCoin) => {
        setClosingCoin(coin);
        setClosePrice('');
        setMessage(null);
    };

    const handleClose = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!closingCoin) return;
        setCloseLoading(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/portfolio/coins/${closingCoin.id}/close`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ closePrice: Number(closePrice) }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Close failed');
            setMessage(`Closed ${closingCoin.symbol} — PnL $${data.pnl}`);
            setClosingCoin(null);
            setClosePrice('');
            fetchCoins();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Close failed');
        } finally {
            setCloseLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetConfirm !== 'RESET_MODEL_PORTFOLIO') {
            setMessage('Type RESET_MODEL_PORTFOLIO exactly to confirm');
            return;
        }
        setResetLoading(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/portfolio/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'RESET_MODEL_PORTFOLIO' }),
            });
            const data = await response.json() as {
                ok?: boolean;
                deleted?: { coins: number; transactions: number; snapshots: number };
                totalCapital?: number;
                error?: string;
            };
            if (!response.ok) throw new Error(data.error || 'Reset failed');
            setMessage(
                `Model Portfolio reset. Deleted coins=${data.deleted?.coins ?? 0}, txs=${data.deleted?.transactions ?? 0}, snapshots=${data.deleted?.snapshots ?? 0}. Capital=$${data.totalCapital ?? 10000}`
            );
            setIsResetOpen(false);
            setResetConfirm('');
            fetchCoins();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Reset failed');
        } finally {
            setResetLoading(false);
        }
    };

    const formatNum = (value: string | null) => {
        if (value === null || value === undefined) return '—';
        const num = Number(value);
        return isNaN(num) ? value : num.toFixed(4);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Portfolio Management</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setIsResetOpen(true);
                            setResetConfirm('');
                            setMessage(null);
                        }}
                        className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 border border-red-600"
                    >
                        Reset Model Portfolio
                    </button>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Add Coin
                    </button>
                </div>
            </div>

            {message && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">{message}</div>
            )}

            {/* Filters */}
            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        type="text"
                        placeholder="Symbol (e.g. ARB)"
                        value={symbolFilter}
                        onChange={(e) => { setSymbolFilter(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="">All Statuses</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#111] text-gray-300">
                                <th className="px-3 py-2 text-left">ID</th>
                                <th className="px-3 py-2 text-left">Symbol</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Class</th>
                                <th className="px-3 py-2 text-left">Entry</th>
                                <th className="px-3 py-2 text-left">Current</th>
                                <th className="px-3 py-2 text-left">TP1</th>
                                <th className="px-3 py-2 text-left">TP2</th>
                                <th className="px-3 py-2 text-left">TP3</th>
                                <th className="px-3 py-2 text-left">SL</th>
                                <th className="px-3 py-2 text-left">Budget</th>
                                <th className="px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                            )}
                            {error && (
                                <tr><td colSpan={12} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
                            )}
                            {!loading && !error && coins.map((coin) => (
                                <tr key={coin.id} className="border-t border-[#222] text-gray-400">
                                    <td className="px-3 py-2 font-mono">#{coin.id}</td>
                                    <td className="px-3 py-2 font-bold text-white">{coin.symbol}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            coin.status === 'active' ? 'bg-green-900/30 text-green-400' :
                                            coin.status === 'exited' ? 'bg-gray-800 text-gray-500' :
                                            'bg-yellow-900/30 text-yellow-400'
                                        }`}>{coin.status}</span>
                                    </td>
                                    <td className="px-3 py-2">{coin.signalClassification ?? '—'}</td>
                                    <td className="px-3 py-2">{formatNum(coin.entryPrice)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.currentPrice)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.tp1)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.tp2)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.tp3)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.stopLoss)}</td>
                                    <td className="px-3 py-2">{formatNum(coin.allocatedBudget)}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEdit(coin)}
                                                disabled={coin.status === 'exited'}
                                                className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 text-xs disabled:opacity-50"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => openClose(coin)}
                                                disabled={coin.status === 'exited'}
                                                className="px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-xs disabled:opacity-50"
                                            >
                                                Close
                                            </button>
                                        </div>
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
                    <span className="px-3 py-1">Page {page} of {pagination.totalPages} ({pagination.total} total)</span>
                    <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >Next</button>
                </div>
            )}

            {/* Add Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Add Portfolio Coin</h3>
                        <form onSubmit={handleAdd} className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                                <input
                                    type="text"
                                    value={addForm.symbol}
                                    onChange={(e) => setAddForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={addForm.entryPrice}
                                    onChange={(e) => setAddForm((f) => ({ ...f, entryPrice: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Classification</label>
                                <select
                                    value={addForm.signalClassification}
                                    onChange={(e) => setAddForm((f) => ({ ...f, signalClassification: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                >
                                    {CLASSIFICATION_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Status</label>
                                <select
                                    value={addForm.status}
                                    onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={addLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {addLoading ? 'Adding...' : 'Add Coin'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingCoin && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Edit {editingCoin.symbol}</h3>
                        <form onSubmit={handleEdit} className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editForm.entryPrice}
                                    onChange={(e) => setEditForm((f) => ({ ...f, entryPrice: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP1</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editForm.tp1}
                                    onChange={(e) => setEditForm((f) => ({ ...f, tp1: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP2</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editForm.tp2}
                                    onChange={(e) => setEditForm((f) => ({ ...f, tp2: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">TP3</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editForm.tp3}
                                    onChange={(e) => setEditForm((f) => ({ ...f, tp3: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Stop Loss</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={editForm.stopLoss}
                                    onChange={(e) => setEditForm((f) => ({ ...f, stopLoss: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Allocated Budget</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editForm.allocatedBudget}
                                    onChange={(e) => setEditForm((f) => ({ ...f, allocatedBudget: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                >
                                    <option value="">No change</option>
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Classification</label>
                                <select
                                    value={editForm.signalClassification}
                                    onChange={(e) => setEditForm((f) => ({ ...f, signalClassification: e.target.value }))}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                >
                                    <option value="">No change</option>
                                    {CLASSIFICATION_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Close Modal */}
            {closingCoin && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Close {closingCoin.symbol}</h3>
                        <form onSubmit={handleClose} className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Close Price</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={closePrice}
                                    onChange={(e) => setClosePrice(e.target.value)}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={closeLoading}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                    {closeLoading ? 'Closing...' : 'Close Position'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClosingCoin(null)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Model Portfolio Modal */}
            {isResetOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#0A0A0A] border border-red-900/60 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-2 text-red-400">Reset Model Portfolio</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Deletes all portfolio coins, transactions, and snapshots. Telegram posts are kept.
                            Capital returns to SCORECARD_TOTAL_BUDGET. This cannot be undone.
                        </p>
                        <form onSubmit={handleReset} className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Type <span className="font-mono text-red-300">RESET_MODEL_PORTFOLIO</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={resetConfirm}
                                    onChange={(e) => setResetConfirm(e.target.value)}
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white font-mono"
                                    placeholder="RESET_MODEL_PORTFOLIO"
                                    autoComplete="off"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={resetLoading || resetConfirm !== 'RESET_MODEL_PORTFOLIO'}
                                    className="flex-1 px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-50"
                                >
                                    {resetLoading ? 'Resetting...' : 'Confirm Hard Reset'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsResetOpen(false);
                                        setResetConfirm('');
                                    }}
                                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
