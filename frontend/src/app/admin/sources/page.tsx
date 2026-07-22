'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

type SourceKind = 'telegram' | 'rss';
type SourcePurpose =
    | 'airdrop_alpha'
    | 'airdrop_community'
    | 'news'
    | 'market_context';

interface ContentSourceRow {
    id: number;
    kind: SourceKind | string;
    purpose: SourcePurpose | string;
    identifier: string;
    title: string | null;
    enabled: boolean;
    lastCursor: string | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

const PURPOSE_OPTIONS: SourcePurpose[] = [
    'airdrop_alpha',
    'airdrop_community',
    'news',
    'market_context',
];

export default function AdminSourcesPage() {
    const { fetchWithAuth } = useAdminAuth();

    const [sources, setSources] = useState<ContentSourceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [kindFilter, setKindFilter] = useState('');
    const [purposeFilter, setPurposeFilter] = useState('');
    const [enabledFilter, setEnabledFilter] = useState('');

    const [newKind, setNewKind] = useState<SourceKind>('telegram');
    const [newPurpose, setNewPurpose] = useState<SourcePurpose>('airdrop_alpha');
    const [newIdentifier, setNewIdentifier] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchSources = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (kindFilter) params.append('kind', kindFilter);
            if (purposeFilter) params.append('purpose', purposeFilter);
            if (enabledFilter) params.append('enabled', enabledFilter);

            const qs = params.toString();
            const response = await fetchWithAuth(`/admin/sources${qs ? `?${qs}` : ''}`);
            if (!response.ok) throw new Error('Failed to fetch sources');
            const data = (await response.json()) as { sources: ContentSourceRow[] };
            setSources(data.sources);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sources');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, kindFilter, purposeFilter, enabledFilter]);

    useEffect(() => {
        void fetchSources();
    }, [fetchSources]);

    const addSource = async () => {
        if (!newIdentifier.trim()) {
            setMessage('identifier is required');
            return;
        }
        setSubmitting(true);
        setMessage(null);
        setError(null);
        try {
            const response = await fetchWithAuth('/admin/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: newKind,
                    purpose: newPurpose,
                    identifier: newIdentifier.trim(),
                    title: newTitle.trim() || undefined,
                    notes: newNotes.trim() || undefined,
                    enabled: true,
                }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Create failed');
            setMessage('Source created');
            setNewIdentifier('');
            setNewTitle('');
            setNewNotes('');
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Create failed');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleEnabled = async (row: ContentSourceRow) => {
        setBusyId(row.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/sources/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !row.enabled }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage(`Source #${row.id} ${row.enabled ? 'disabled' : 'enabled'}`);
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    const updatePurpose = async (row: ContentSourceRow, purpose: string) => {
        if (purpose === row.purpose) return;
        setBusyId(row.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/sources/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purpose }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage(`Source #${row.id} purpose → ${purpose}`);
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    const updateNotes = async (row: ContentSourceRow, notes: string) => {
        setBusyId(row.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/sources/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage(`Source #${row.id} notes updated`);
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    const updateCursor = async (row: ContentSourceRow, lastCursor: string) => {
        setBusyId(row.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/sources/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastCursor }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage(`Source #${row.id} cursor updated`);
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    const deleteSource = async (row: ContentSourceRow) => {
        if (!window.confirm(`Delete source #${row.id} (${row.identifier})?`)) return;
        setBusyId(row.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/sources/${row.id}`, {
                method: 'DELETE',
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Delete failed');
            setMessage(`Source #${row.id} deleted`);
            void fetchSources();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Content Sources</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Site-wide TG + RSS registry (DEC-041). Credentials stay in env.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchSources()}
                    className="px-3 py-2 border border-[#333] text-gray-300 rounded text-sm"
                >
                    Refresh
                </button>
            </div>

            {message && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">
                    {message}
                </div>
            )}
            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400">
                    {error}
                </div>
            )}

            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <h2 className="text-sm font-semibold text-gray-300 mb-3">Add source</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as SourceKind)}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    >
                        <option value="telegram">telegram</option>
                        <option value="rss">rss</option>
                    </select>
                    <select
                        value={newPurpose}
                        onChange={(e) => setNewPurpose(e.target.value as SourcePurpose)}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    >
                        {PURPOSE_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    <input
                        value={newIdentifier}
                        onChange={(e) => setNewIdentifier(e.target.value)}
                        placeholder={
                            newKind === 'telegram'
                                ? 'username or id (no @)'
                                : 'https://feed.example/rss'
                        }
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    />
                    <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Title (optional)"
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    />
                    <input
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="md:col-span-2 border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => void addSource()}
                    disabled={submitting}
                    className="mt-3 px-4 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                >
                    {submitting ? 'Creating…' : 'Create source'}
                </button>
            </div>

            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    >
                        <option value="">All kinds</option>
                        <option value="telegram">telegram</option>
                        <option value="rss">rss</option>
                    </select>
                    <select
                        value={purposeFilter}
                        onChange={(e) => setPurposeFilter(e.target.value)}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    >
                        <option value="">All purposes</option>
                        {PURPOSE_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    <select
                        value={enabledFilter}
                        onChange={(e) => setEnabledFilter(e.target.value)}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                    >
                        <option value="">All status</option>
                        <option value="true">enabled</option>
                        <option value="false">disabled</option>
                    </select>
                </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-x-auto">
                <table className="w-full table-auto min-w-[900px]">
                    <thead>
                        <tr className="bg-[#111] text-gray-300 text-sm">
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Kind</th>
                            <th className="px-3 py-2 text-left">Purpose</th>
                            <th className="px-3 py-2 text-left">Identifier</th>
                            <th className="px-3 py-2 text-left">Title</th>
                            <th className="px-3 py-2 text-left">Enabled</th>
                            <th className="px-3 py-2 text-left">Cursor</th>
                            <th className="px-3 py-2 text-left">Notes</th>
                            <th className="px-3 py-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading && sources.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                                    No sources yet — add TG/RSS rows for airdrop crons
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            sources.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-t border-[#222] hover:bg-[#111] text-sm"
                                >
                                    <td className="px-3 py-2 text-gray-400">{row.id}</td>
                                    <td className="px-3 py-2 text-gray-300">{row.kind}</td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={row.purpose}
                                            disabled={busyId === row.id}
                                            onChange={(e) =>
                                                void updatePurpose(row, e.target.value)
                                            }
                                            className="border border-[#333] bg-[#0D0D0D] p-1 rounded text-white text-xs max-w-[160px]"
                                        >
                                            {PURPOSE_OPTIONS.map((p) => (
                                                <option key={p} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                            {!PURPOSE_OPTIONS.includes(
                                                row.purpose as SourcePurpose
                                            ) && (
                                                <option value={row.purpose}>{row.purpose}</option>
                                            )}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-white max-w-[220px] truncate">
                                        {row.identifier}
                                    </td>
                                    <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate">
                                        {row.title || '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={
                                                row.enabled ? 'text-green-400' : 'text-gray-500'
                                            }
                                        >
                                            {row.enabled ? 'on' : 'off'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            defaultValue={row.lastCursor ?? ''}
                                            key={`cursor-${row.id}-${row.updatedAt}`}
                                            disabled={busyId === row.id}
                                            onBlur={(e) => {
                                                const v = e.target.value.trim();
                                                const prev = row.lastCursor ?? '';
                                                if (v !== prev) void updateCursor(row, v);
                                            }}
                                            placeholder="—"
                                            className="w-24 border border-[#333] bg-[#0D0D0D] p-1 rounded text-white text-xs font-mono"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            defaultValue={row.notes ?? ''}
                                            key={`notes-${row.id}-${row.updatedAt}`}
                                            disabled={busyId === row.id}
                                            onBlur={(e) => {
                                                const v = e.target.value.trim();
                                                const prev = row.notes ?? '';
                                                if (v !== prev) void updateNotes(row, v);
                                            }}
                                            placeholder="—"
                                            className="w-36 border border-[#333] bg-[#0D0D0D] p-1 rounded text-white text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1">
                                            <button
                                                type="button"
                                                disabled={busyId === row.id}
                                                onClick={() => void toggleEnabled(row)}
                                                className="px-2 py-1 text-xs rounded border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-40"
                                            >
                                                {row.enabled ? 'Disable' : 'Enable'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyId === row.id}
                                                onClick={() => void deleteSource(row)}
                                                className="px-2 py-1 text-xs rounded border border-red-900 text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
