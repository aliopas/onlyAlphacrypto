'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface ScoreRecord {
    id: number;
    signalId: number;
    coinSymbol: string;
    signalState: string | null;
    isActive: boolean;
    entryPrice: number;
    takeProfitPrice: number | null;
    tp2Price: number | null;
    tp3Price: number | null;
    stopLossPrice: number | null;
    exitPrice: number | null;
    realizedPnl: number | null;
    closedAt: string | null;
    autoClosedReason: string | null;
    closeReason: string | null;
    createdAt: string;
    archivedAt: string | null;
}

interface RestoreResponse {
    id: number;
    status: string;
    currentPrice: number | null;
    unrealizedPnl: number | null;
}

type ArchivedView = 'hide' | 'archived' | 'all';

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function ScoreRecordsPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [records, setRecords] = useState<ScoreRecord[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [coin, setCoin] = useState('');
    const [state, setState] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [archivedView, setArchivedView] = useState<ArchivedView>('hide');
    const [page, setPage] = useState(1);
    const [searchId, setSearchId] = useState('');

    const [archiveDays, setArchiveDays] = useState(90);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
    const [restoreLoading, setRestoreLoading] = useState<number | null>(null);
    const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchId) params.append('id', searchId);
            if (coin) params.append('coin', coin);
            if (state) params.append('state', state);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (archivedView !== 'hide') params.append('includeArchived', 'true');
            params.append('page', String(page));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/score-records?${params}`);
            if (!response.ok) throw new Error('Failed to fetch records');
            const data = await response.json();
            const fetched: ScoreRecord[] = data.records;
            const visible = archivedView === 'archived'
                ? fetched.filter((r) => r.archivedAt !== null)
                : fetched;
            setRecords(visible);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load records');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, searchId, coin, state, startDate, endDate, archivedView, page]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const toggleSelection = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === records.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(records.map((r) => r.id)));
        }
    };

    const handleArchive = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Archive ${selectedIds.size} records?`)) return;
        setArchiveLoading(true);
        setArchiveMessage(null);
        try {
            const response = await fetchWithAuth('/admin/score-records', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!response.ok) throw new Error('Archive failed');
            const data = await response.json();
            setArchiveMessage(`Archived ${data.archivedCount} records`);
            setSelectedIds(new Set());
            fetchRecords();
        } catch (err) {
            setArchiveMessage(err instanceof Error ? err.message : 'Archive failed');
        } finally {
            setArchiveLoading(false);
        }
    };

    const handleAutoArchive = async () => {
        if (!confirm(`Auto-archive records older than ${archiveDays} days?`)) return;
        setArchiveLoading(true);
        setArchiveMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/score-records/archive-old?days=${archiveDays}`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Auto-archive failed');
            const data = await response.json();
            setArchiveMessage(`Archived ${data.archivedCount} records`);
            fetchRecords();
        } catch (err) {
            setArchiveMessage(err instanceof Error ? err.message : 'Auto-archive failed');
        } finally {
            setArchiveLoading(false);
        }
    };

    const handleRestore = async (record: ScoreRecord) => {
        if (record.isActive && !record.archivedAt) {
            setRestoreMessage(`Record #${record.id} is already active and visible`);
            return;
        }

        const wasClosed = !record.isActive;
        const stateLabel = record.archivedAt
            ? (wasClosed ? 'archived & closed' : 'archived')
            : 'closed';

        const confirmMessage = `Restore #${record.id} ${record.coinSymbol} to Active?\nCurrent state: ${stateLabel}.\n\nThis will return the record to active tracking at its original entry price (entry/TP/SL unchanged).`;
        if (!confirm(confirmMessage)) return;

        setRestoreLoading(record.id);
        setRestoreMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/score-records/${record.id}/restore`, {
                method: 'POST',
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Restore failed');
            }
            const data: RestoreResponse = await response.json();
            const priceText = data.currentPrice !== null && data.currentPrice !== undefined
                ? `$${Number(data.currentPrice).toFixed(2)}`
                : 'Price temporarily unavailable';
            const pnlText = data.unrealizedPnl !== null && data.unrealizedPnl !== undefined
                ? `${data.unrealizedPnl >= 0 ? '+' : ''}${(data.unrealizedPnl * 100).toFixed(2)}% unrealized`
                : 'PnL unavailable';
            setRestoreMessage(`Restored #${record.id} ${record.coinSymbol} to active — ${priceText} · ${pnlText}`);
            fetchRecords();
        } catch (err) {
            setRestoreMessage(err instanceof Error ? err.message : 'Restore failed');
        } finally {
            setRestoreLoading(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Score Records</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleArchive}
                        disabled={selectedIds.size === 0 || archiveLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                        Archive Selected ({selectedIds.size})
                    </button>
                </div>
            </div>

            {archiveMessage && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">{archiveMessage}</div>
            )}

            {restoreMessage && (
                <div className="mb-4 p-3 bg-green-900/20 border border-green-900/50 rounded text-green-400">{restoreMessage}</div>
            )}

            {/* Filters */}
            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    <input
                        type="number"
                        placeholder="Record ID"
                        value={searchId}
                        onChange={(e) => { setSearchId(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                    />
                    <input
                        type="text"
                        placeholder="Coin (e.g. BTC)"
                        value={coin}
                        onChange={(e) => { setCoin(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                    />
                    <select
                        value={state}
                        onChange={(e) => { setState(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="">All States</option>
                        <option value="NEW">NEW</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PARTIAL_TP">PARTIAL_TP</option>
                        <option value="BREAKEVEN">BREAKEVEN</option>
                        <option value="CLOSED">CLOSED</option>
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    />
                    <select
                        value={archivedView}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'hide' || value === 'archived' || value === 'all') {
                                setArchivedView(value);
                            }
                            setPage(1);
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="hide">Active &amp; Closed</option>
                        <option value="archived">Archived Only</option>
                        <option value="all">Show All (incl. Archived)</option>
                    </select>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={archiveDays}
                            onChange={(e) => setArchiveDays(Number(e.target.value))}
                            className="w-20 border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            min={7}
                        />
                        <button
                            onClick={handleAutoArchive}
                            disabled={archiveLoading}
                            className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm"
                        >
                            Auto-Archive
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#111] text-gray-300">
                                <th className="px-3 py-2 text-left">
                                    <input
                                        type="checkbox"
                                        checked={records.length > 0 && selectedIds.size === records.length}
                                        onChange={selectAll}
                                        className="rounded"
                                    />
                                </th>
                                <th className="px-3 py-2 text-left">ID</th>
                                <th className="px-3 py-2 text-left">Coin</th>
                                <th className="px-3 py-2 text-left">State</th>
                                <th className="px-3 py-2 text-left">Entry</th>
                                <th className="px-3 py-2 text-left">TP1</th>
                                <th className="px-3 py-2 text-left">TP2</th>
                                <th className="px-3 py-2 text-left">TP3</th>
                                <th className="px-3 py-2 text-left">SL</th>
                                <th className="px-3 py-2 text-left">Created</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={12} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                                </tr>
                            )}
                            {error && (
                                <tr>
                                    <td colSpan={12} className="px-4 py-8 text-center text-red-400">{error}</td>
                                </tr>
                            )}
                            {!loading && !error && records.map((record) => (
                                <tr
                                    key={record.id}
                                    className={`border-t border-[#222] text-gray-400 ${record.archivedAt ? 'opacity-60 bg-amber-950/20' : ''}`}
                                >
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(record.id)}
                                            onChange={() => toggleSelection(record.id)}
                                            disabled={!!record.archivedAt}
                                            className="rounded"
                                        />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-white font-bold">#{record.id}</td>
                                    <td className="px-3 py-2">{record.coinSymbol}</td>
                                    <td className="px-3 py-2">
                                        <span className="px-2 py-0.5 rounded text-xs bg-[#1a1a1a]">{record.signalState ?? 'N/A'}</span>
                                    </td>
                                    <td className="px-3 py-2">{record.entryPrice.toFixed(2)}</td>
                                    <td className="px-3 py-2">{record.takeProfitPrice?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{record.tp2Price?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{record.tp3Price?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{record.stopLossPrice?.toFixed(2) ?? '—'}</td>
                                    <td className="px-3 py-2">{new Date(record.createdAt).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">
                                        {record.archivedAt ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-500">Archived</span>
                                        ) : record.isActive ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-green-900/30 text-green-400">Active</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400">Closed</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {(!record.isActive || record.archivedAt) && (
                                            <button
                                                onClick={() => handleRestore(record)}
                                                disabled={restoreLoading === record.id}
                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {restoreLoading === record.id ? '...' : 'Restore to Active'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!loading && !error && archivedView === 'archived' && records.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                                        No archived records on this page. Archived records are older — try the next pages.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
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
        </div>
    );
}
