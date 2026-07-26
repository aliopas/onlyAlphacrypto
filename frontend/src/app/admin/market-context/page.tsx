'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { TRACKED_COINS } from '@/config/coins';

type NewsTrust = 'pending' | 'trusted' | 'rejected';
type NewsSourceType = 'terminal' | 'rss' | 'telegram' | 'manual';

interface MarketNewsRow {
    id: number;
    sourceType: NewsSourceType;
    externalId: string | null;
    sourceHash: string;
    title: string;
    body: string | null;
    url: string | null;
    sourceName: string | null;
    publishedAt: string | null;
    symbols: string[];
    trust: NewsTrust;
    trustNote: string | null;
    classification?: string | null;
    eventSeverity?: number | null;
    relevanceScore?: number | null;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface TelegramChannelRow {
    id: number;
    usernameOrId: string;
    title: string | null;
    enabled: boolean;
    lastCursor: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

interface SnapshotRow {
    id: number;
    snapshotKey: string;
    kind: string;
    weekLabel: string | null;
    status: string;
    symbol?: string | null;
    newsIds: number[];
    marketDataVersion: string | null;
    generatorVersion: string;
    generatedAt: string | null;
    publishedAt: string | null;
    createdBy: string | null;
    createdAt: string;
    sectionCount: number;
    wordCount?: number;
    seoScore?: { band: string; score: number } | null;
    autoPublished?: boolean;
    seoMeta?: {
        metaTitle: string;
        metaDescription: string;
        seoKeywords: string[];
    } | null;
}

interface SnapshotSection {
    content: string;
    updatedAt: string;
    sourceNewsIds: number[];
}

interface SnapshotDetail extends Omit<SnapshotRow, 'sectionCount'> {
    sections: Partial<Record<string, SnapshotSection>>;
    updatedAt: string | null;
}

interface ActivityRow {
    id: number;
    adminEmail: string;
    action: string;
    targetTable: string | null;
    targetId: string | null;
    newValue: Record<string, unknown> | null;
    createdAt: string | null;
}

const SECTION_PREVIEW_ORDER = [
    'overview',
    'btcCorrelation',
    'liquidity',
    'newsSensitivity',
    'geopolitics',
    'thisWeek',
    'outlook',
    'faq',
    'heroWhatIs',
    'historicalStructure',
    'eventTimeline',
    'newsImpact',
    'structuralOutlook',
    'relatedCoins',
] as const;

function seoBandEmoji(band: string | null | undefined): string {
    if (band === 'green') return '🟢';
    if (band === 'yellow') return '🟡';
    if (band === 'red') return '🔴';
    return '—';
}

export default function MarketContextAdminPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [tab, setTab] = useState<'news' | 'channels' | 'snapshots' | 'coins' | 'activity'>(
        'news'
    );

    const [items, setItems] = useState<MarketNewsRow[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [trustFilter, setTrustFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [reviewQueueOnly, setReviewQueueOnly] = useState(false);
    const [q, setQ] = useState('');
    const [qInput, setQInput] = useState('');
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [busySymbol, setBusySymbol] = useState<string | null>(null);
    const [generateAllRunning, setGenerateAllRunning] = useState(false);

    const [manualTitle, setManualTitle] = useState('');
    const [manualBody, setManualBody] = useState('');
    const [manualUrl, setManualUrl] = useState('');
    const [manualSourceName, setManualSourceName] = useState('');
    const [manualSymbols, setManualSymbols] = useState('');
    const [manualTrust, setManualTrust] = useState<NewsTrust>('pending');
    const [manualSubmitting, setManualSubmitting] = useState(false);

    const [channels, setChannels] = useState<TelegramChannelRow[]>([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [channelSubmitting, setChannelSubmitting] = useState(false);

    const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [snapshotStatusFilter, setSnapshotStatusFilter] = useState('draft');
    const [snapshotKindFilter, setSnapshotKindFilter] = useState<'weekly' | 'coin' | ''>('');
    const [generating, setGenerating] = useState(false);
    const [preview, setPreview] = useState<SnapshotDetail | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [coinSnapshots, setCoinSnapshots] = useState<SnapshotRow[]>([]);
    const [coinsLoading, setCoinsLoading] = useState(false);
    const [activities, setActivities] = useState<ActivityRow[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);

    const fetchNews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (trustFilter) params.append('trust', trustFilter);
            if (sourceFilter) params.append('sourceType', sourceFilter);
            if (q.trim()) params.append('q', q.trim());
            params.append('page', String(page));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/market-context/news?${params}`);
            if (!response.ok) throw new Error('Failed to fetch market news');
            const data = (await response.json()) as {
                items: MarketNewsRow[];
                pagination: Pagination;
            };
            setItems(data.items);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load news');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, trustFilter, sourceFilter, q, page]);

    const fetchChannels = useCallback(async () => {
        setChannelsLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth('/admin/market-context/telegram-channels');
            if (!response.ok) throw new Error('Failed to fetch channels');
            const data = (await response.json()) as { channels: TelegramChannelRow[] };
            setChannels(data.channels);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load channels');
        } finally {
            setChannelsLoading(false);
        }
    }, [fetchWithAuth]);

    const fetchSnapshots = useCallback(async () => {
        setSnapshotsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (snapshotStatusFilter) params.append('status', snapshotStatusFilter);
            if (snapshotKindFilter) params.append('kind', snapshotKindFilter);
            params.append('page', '1');
            params.append('limit', '50');
            const response = await fetchWithAuth(
                `/admin/market-context/snapshots?${params}`
            );
            if (!response.ok) throw new Error('Failed to fetch snapshots');
            const data = (await response.json()) as { snapshots: SnapshotRow[] };
            setSnapshots(data.snapshots);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load snapshots');
        } finally {
            setSnapshotsLoading(false);
        }
    }, [fetchWithAuth, snapshotStatusFilter, snapshotKindFilter]);

    const fetchCoinSnapshots = useCallback(async () => {
        setCoinsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('kind', 'coin');
            params.append('page', '1');
            params.append('limit', '100');
            const response = await fetchWithAuth(
                `/admin/market-context/snapshots?${params}`
            );
            if (!response.ok) throw new Error('Failed to fetch coin snapshots');
            const data = (await response.json()) as { snapshots: SnapshotRow[] };
            setCoinSnapshots(data.snapshots);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load coins');
        } finally {
            setCoinsLoading(false);
        }
    }, [fetchWithAuth]);

    const fetchActivity = useCallback(async () => {
        setActivityLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth('/admin/market-context/activity?limit=40');
            if (!response.ok) throw new Error('Failed to fetch activity');
            const data = (await response.json()) as { activities: ActivityRow[] };
            setActivities(data.activities ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load activity');
        } finally {
            setActivityLoading(false);
        }
    }, [fetchWithAuth]);

    useEffect(() => {
        if (tab === 'news') fetchNews();
    }, [tab, fetchNews]);

    useEffect(() => {
        if (tab === 'channels') fetchChannels();
    }, [tab, fetchChannels]);

    useEffect(() => {
        if (tab === 'snapshots') fetchSnapshots();
    }, [tab, fetchSnapshots]);

    useEffect(() => {
        if (tab === 'coins') fetchCoinSnapshots();
    }, [tab, fetchCoinSnapshots]);

    useEffect(() => {
        if (tab === 'activity') fetchActivity();
    }, [tab, fetchActivity]);

    const displayedNews = useMemo(() => {
        if (!reviewQueueOnly) return items;
        return items
            .filter(
                (i) =>
                    i.trust === 'pending' &&
                    i.classification === 'MAJOR' &&
                    i.eventSeverity === 3
            )
            .sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return ta - tb;
            });
    }, [items, reviewQueueOnly]);

    const coinRowsBySymbol = useMemo(() => {
        const map = new Map<string, SnapshotRow>();
        for (const s of coinSnapshots) {
            const sym = (s.symbol || '').toUpperCase();
            if (!sym) continue;
            const existing = map.get(sym);
            if (!existing) {
                map.set(sym, s);
                continue;
            }
            // Prefer published, else newest generated
            if (s.status === 'published' && existing.status !== 'published') {
                map.set(sym, s);
                continue;
            }
            const tNew = s.generatedAt ? new Date(s.generatedAt).getTime() : 0;
            const tOld = existing.generatedAt ? new Date(existing.generatedAt).getTime() : 0;
            if (tNew > tOld) map.set(sym, s);
        }
        return map;
    }, [coinSnapshots]);

    const handlePreviewSnapshot = async (id: number) => {
        setPreviewLoading(true);
        setMessage(null);
        setError(null);
        try {
            const response = await fetchWithAuth(`/admin/market-context/snapshots/${id}`);
            const data = (await response.json()) as {
                error?: string;
                snapshot?: SnapshotDetail;
            };
            if (!response.ok) throw new Error(data.error || 'Failed to load snapshot');
            if (!data.snapshot) throw new Error('Snapshot not found');
            setPreview(data.snapshot);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Preview failed');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleGenerateSnapshot = async () => {
        setGenerating(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/market-context/snapshots/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'weekly' }),
            });
            const data = (await response.json()) as {
                error?: string;
                snapshot?: { id: number; snapshotKey: string; newsCount: number };
            };
            if (!response.ok) throw new Error(data.error || 'Generate failed');
            setMessage(
                `Draft snapshot #${data.snapshot?.id} created (${data.snapshot?.newsCount ?? 0} trusted news)`
            );
            setTab('snapshots');
            setSnapshotStatusFilter('draft');
            fetchSnapshots();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Generate failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateCoin = async (symbol: string) => {
        setBusySymbol(symbol);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                '/admin/market-context/snapshots/generate-coin',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol }),
                }
            );
            const data = (await response.json()) as {
                error?: string;
                snapshot?: { id: number; symbol?: string; status?: string };
            };
            if (!response.ok) throw new Error(data.error || 'Coin generate failed');
            setMessage(
                `Coin draft #${data.snapshot?.id} for ${symbol} created (${data.snapshot?.status ?? 'draft'})`
            );
            fetchCoinSnapshots();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Coin generate failed');
        } finally {
            setBusySymbol(null);
        }
    };

    const handleGenerateAllRemaining = async () => {
        setGenerateAllRunning(true);
        setMessage(null);
        const missing = TRACKED_COINS.filter((s) => {
            const row = coinRowsBySymbol.get(s);
            return !row || row.status !== 'published';
        });
        if (missing.length === 0) {
            setMessage('All tracked coins already have a published page');
            setGenerateAllRunning(false);
            return;
        }
        let ok = 0;
        let fail = 0;
        for (const symbol of missing) {
            try {
                setBusySymbol(symbol);
                const response = await fetchWithAuth(
                    '/admin/market-context/snapshots/generate-coin',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbol }),
                    }
                );
                if (response.ok) ok += 1;
                else fail += 1;
            } catch {
                fail += 1;
            }
            await new Promise((r) => setTimeout(r, 3000));
        }
        setBusySymbol(null);
        setGenerateAllRunning(false);
        setMessage(`Generate all remaining done: ${ok} ok, ${fail} failed (${missing.length} attempted)`);
        fetchCoinSnapshots();
    };

    const handleUnpublishSnapshot = async (id: number) => {
        setBusyId(id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                `/admin/market-context/snapshots/${id}/unpublish`,
                { method: 'PATCH' }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Unpublish failed');
            setMessage(`Snapshot #${id} unpublished → draft`);
            fetchSnapshots();
            fetchCoinSnapshots();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Unpublish failed');
        } finally {
            setBusyId(null);
        }
    };

    const handlePublishSnapshot = async (id: number) => {
        setBusyId(id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                `/admin/market-context/snapshots/${id}/publish`,
                { method: 'PATCH' }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Publish failed');
            setMessage(`Snapshot #${id} published → /blog/market-context`);
            fetchSnapshots();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Publish failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleArchiveSnapshot = async (id: number) => {
        setBusyId(id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                `/admin/market-context/snapshots/${id}/archive`,
                { method: 'PATCH' }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Archive failed');
            setMessage(`Snapshot #${id} archived`);
            fetchSnapshots();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Archive failed');
        } finally {
            setBusyId(null);
        }
    };

    const setTrust = async (id: number, trust: NewsTrust) => {
        setBusyId(id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/market-context/news/${id}/trust`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trust }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Trust update failed');
            setMessage(`News #${id} → ${trust}`);
            fetchNews();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Trust update failed');
        } finally {
            setBusyId(null);
        }
    };

    const injectManual = async () => {
        if (!manualTitle.trim()) {
            setMessage('Title is required');
            return;
        }
        setManualSubmitting(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/market-context/news/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: manualTitle.trim(),
                    body: manualBody.trim() || undefined,
                    url: manualUrl.trim() || undefined,
                    sourceName: manualSourceName.trim() || undefined,
                    symbols: manualSymbols.trim() || undefined,
                    trust: manualTrust,
                }),
            });
            const data = (await response.json()) as { error?: string; item?: { id: number } };
            if (!response.ok) throw new Error(data.error || 'Inject failed');
            setMessage(`Manual news injected${data.item ? ` (#${data.item.id})` : ''}`);
            setManualTitle('');
            setManualBody('');
            setManualUrl('');
            setManualSourceName('');
            setManualSymbols('');
            setManualTrust('pending');
            fetchNews();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Inject failed');
        } finally {
            setManualSubmitting(false);
        }
    };

    const addChannel = async () => {
        if (!newUsername.trim()) {
            setMessage('usernameOrId is required');
            return;
        }
        setChannelSubmitting(true);
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/market-context/telegram-channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usernameOrId: newUsername.trim(),
                    title: newTitle.trim() || undefined,
                    notes: newNotes.trim() || undefined,
                    enabled: true,
                }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Create channel failed');
            setMessage('Channel created');
            setNewUsername('');
            setNewTitle('');
            setNewNotes('');
            fetchChannels();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Create channel failed');
        } finally {
            setChannelSubmitting(false);
        }
    };

    const toggleChannel = async (ch: TelegramChannelRow) => {
        setBusyId(ch.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                `/admin/market-context/telegram-channels/${ch.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: !ch.enabled }),
                }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Update failed');
            setMessage(`Channel #${ch.id} ${ch.enabled ? 'disabled' : 'enabled'}`);
            fetchChannels();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    const trustClass = (t: NewsTrust): string => {
        if (t === 'trusted') return 'text-green-400';
        if (t === 'rejected') return 'text-red-400';
        return 'text-yellow-400';
    };

    const truncate = (text: string | null, max: number): string => {
        if (!text) return '—';
        return text.length > max ? `${text.slice(0, max)}…` : text;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Blog / Insights</h1>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
                {(
                    [
                        ['news', 'Review Queue / News'],
                        ['channels', 'Telegram channels'],
                        ['snapshots', 'Snapshots'],
                        ['coins', 'Coins'],
                        ['activity', 'Activity'],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`px-4 py-2 rounded text-sm ${
                            tab === id
                                ? 'bg-blue-900/40 text-blue-300 border border-blue-800'
                                : 'bg-[#111] text-gray-400 border border-[#333]'
                        }`}
                    >
                        {label}
                    </button>
                ))}
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

            {tab === 'news' && (
                <>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                        <h2 className="text-sm font-semibold text-gray-300 mb-3">Manual inject</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                                placeholder="Title *"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <input
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                placeholder="URL"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <input
                                value={manualSourceName}
                                onChange={(e) => setManualSourceName(e.target.value)}
                                placeholder="Source name"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <input
                                value={manualSymbols}
                                onChange={(e) => setManualSymbols(e.target.value)}
                                placeholder="Symbols (BTC,ETH)"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <select
                                value={manualTrust}
                                onChange={(e) => setManualTrust(e.target.value as NewsTrust)}
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            >
                                <option value="pending">pending</option>
                                <option value="trusted">trusted</option>
                                <option value="rejected">rejected</option>
                            </select>
                            <textarea
                                value={manualBody}
                                onChange={(e) => setManualBody(e.target.value)}
                                placeholder="Body"
                                rows={2}
                                className="md:col-span-2 border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={injectManual}
                            disabled={manualSubmitting}
                            className="mt-3 px-4 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {manualSubmitting ? 'Injecting…' : 'Inject news'}
                        </button>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setReviewQueueOnly(true);
                                    setTrustFilter('pending');
                                    setPage(1);
                                }}
                                className={`px-3 py-1.5 text-xs rounded border ${
                                    reviewQueueOnly
                                        ? 'border-amber-700 text-amber-300 bg-amber-900/20'
                                        : 'border-[#333] text-gray-400'
                                }`}
                            >
                                Review Queue (MAJOR sev=3 pending)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReviewQueueOnly(false);
                                    setTrustFilter('');
                                }}
                                className={`px-3 py-1.5 text-xs rounded border ${
                                    !reviewQueueOnly
                                        ? 'border-blue-800 text-blue-300'
                                        : 'border-[#333] text-gray-400'
                                }`}
                            >
                                All news
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select
                                value={trustFilter}
                                onChange={(e) => {
                                    setTrustFilter(e.target.value);
                                    setReviewQueueOnly(false);
                                    setPage(1);
                                }}
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            >
                                <option value="">All trust</option>
                                <option value="pending">pending</option>
                                <option value="trusted">trusted</option>
                                <option value="rejected">rejected</option>
                            </select>
                            <select
                                value={sourceFilter}
                                onChange={(e) => {
                                    setSourceFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            >
                                <option value="">All sources</option>
                                <option value="terminal">terminal</option>
                                <option value="rss">rss</option>
                                <option value="telegram">telegram</option>
                                <option value="manual">manual</option>
                            </select>
                            <input
                                value={qInput}
                                onChange={(e) => setQInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setQ(qInput);
                                        setPage(1);
                                    }
                                }}
                                placeholder="Search title…"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setQ(qInput);
                                    setPage(1);
                                }}
                                className="px-3 py-2 bg-[#1a1a1a] border border-[#333] text-gray-300 rounded text-sm"
                            >
                                Search
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full table-auto">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-[#111] text-gray-300">
                                        <th className="px-3 py-2 text-left">ID</th>
                                        <th className="px-3 py-2 text-left">Source</th>
                                        <th className="px-3 py-2 text-left">Title</th>
                                        <th className="px-3 py-2 text-left">Class / Sev</th>
                                        <th className="px-3 py-2 text-left">Trust</th>
                                        <th className="px-3 py-2 text-left">Published</th>
                                        <th className="px-3 py-2 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-6 text-center text-gray-500"
                                            >
                                                Loading…
                                            </td>
                                        </tr>
                                    )}
                                    {!loading && displayedNews.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-6 text-center text-gray-500"
                                            >
                                                {reviewQueueOnly
                                                    ? 'Review queue empty'
                                                    : 'No news items'}
                                            </td>
                                        </tr>
                                    )}
                                    {!loading &&
                                        displayedNews.map((item) => (
                                            <tr
                                                key={item.id}
                                                className={`border-t border-[#222] hover:bg-[#111] ${
                                                    item.classification === 'MAJOR' &&
                                                    item.eventSeverity === 3 &&
                                                    item.trust === 'pending'
                                                        ? 'bg-amber-950/20'
                                                        : ''
                                                }`}
                                            >
                                                <td className="px-3 py-2 text-gray-400">
                                                    {item.id}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-blue-300">
                                                    {item.sourceType}
                                                    {item.sourceName
                                                        ? ` · ${item.sourceName}`
                                                        : ''}
                                                </td>
                                                <td className="px-3 py-2 text-white text-sm max-w-md">
                                                    {truncate(item.title, 100)}
                                                    {item.symbols?.length > 0 && (
                                                        <span className="block text-[10px] text-gray-500">
                                                            {item.symbols.join(', ')}
                                                        </span>
                                                    )}
                                                    {item.url && (
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block text-xs text-blue-500 truncate"
                                                        >
                                                            {item.url}
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-400">
                                                    {item.classification ?? '—'}
                                                    {item.eventSeverity != null
                                                        ? ` · sev ${item.eventSeverity}`
                                                        : ''}
                                                    {item.relevanceScore != null
                                                        ? ` · rel ${item.relevanceScore}`
                                                        : ''}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-sm font-medium ${trustClass(item.trust)}`}
                                                >
                                                    {item.trust}
                                                </td>
                                                <td className="px-3 py-2 text-gray-500 text-xs">
                                                    {item.publishedAt
                                                        ? new Date(
                                                              item.publishedAt
                                                          ).toLocaleString()
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(
                                                            [
                                                                'trusted',
                                                                'pending',
                                                                'rejected',
                                                            ] as NewsTrust[]
                                                        ).map((t) => (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                disabled={
                                                                    busyId === item.id ||
                                                                    item.trust === t
                                                                }
                                                                onClick={() => setTrust(item.id, t)}
                                                                className="px-2 py-1 text-xs rounded border border-[#333] text-gray-300 hover:bg-[#222] disabled:opacity-40"
                                                            >
                                                                {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between p-3 border-t border-[#333] text-sm text-gray-400">
                                <span>
                                    Page {pagination.page} / {pagination.totalPages} (
                                    {pagination.total} total)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="px-3 py-1 border border-[#333] rounded disabled:opacity-40"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="px-3 py-1 border border-[#333] rounded disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === 'snapshots' && (
                <>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleGenerateSnapshot}
                            disabled={generating}
                            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {generating
                                ? 'Generating draft… (AI may take ~30–90s)'
                                : 'Generate market edition draft'}
                        </button>
                        <select
                            value={snapshotKindFilter}
                            onChange={(e) =>
                                setSnapshotKindFilter(
                                    e.target.value as '' | 'weekly' | 'coin'
                                )
                            }
                            className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                        >
                            <option value="">All kinds</option>
                            <option value="weekly">Market Editions</option>
                            <option value="coin">Coins</option>
                        </select>
                        <select
                            value={snapshotStatusFilter}
                            onChange={(e) => setSnapshotStatusFilter(e.target.value)}
                            className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                        >
                            <option value="">All statuses</option>
                            <option value="draft">draft</option>
                            <option value="published">published</option>
                            <option value="archived">archived</option>
                        </select>
                        <button
                            type="button"
                            onClick={fetchSnapshots}
                            className="px-3 py-2 border border-[#333] text-gray-300 rounded text-sm"
                        >
                            Refresh
                        </button>
                        <p className="text-xs text-gray-500 w-full">
                            Market editions use trusted news + Search Intent Pack. Coin drafts from
                            Coins tab. Status stays{' '}
                            <span className="text-yellow-400">draft</span> until publish.
                        </p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                        <table className="w-full table-auto">
                            <thead>
                                <tr className="bg-[#111] text-gray-300">
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">Key</th>
                                    <th className="px-3 py-2 text-left">Kind / Symbol</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">SEO</th>
                                    <th className="px-3 py-2 text-left">Words</th>
                                    <th className="px-3 py-2 text-left">Generated</th>
                                    <th className="px-3 py-2 text-left">By</th>
                                    <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {snapshotsLoading && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-3 py-6 text-center text-gray-500"
                                        >
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {!snapshotsLoading && snapshots.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="px-3 py-6 text-center text-gray-500"
                                        >
                                            No snapshots yet
                                        </td>
                                    </tr>
                                )}
                                {!snapshotsLoading &&
                                    snapshots.map((s) => (
                                        <tr
                                            key={s.id}
                                            className="border-t border-[#222] hover:bg-[#111]"
                                        >
                                            <td className="px-3 py-2 text-gray-400">{s.id}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-white">
                                                {s.snapshotKey}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-300">
                                                {s.kind}
                                                {s.symbol ? ` · ${s.symbol}` : ''}
                                                {s.weekLabel ? ` · ${s.weekLabel}` : ''}
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                <span
                                                    className={
                                                        s.status === 'published'
                                                            ? 'text-green-400'
                                                            : s.status === 'archived'
                                                              ? 'text-gray-500'
                                                              : 'text-yellow-400'
                                                    }
                                                >
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                {seoBandEmoji(s.seoScore?.band)}
                                                {s.seoScore
                                                    ? ` ${s.seoScore.band} (${s.seoScore.score})`
                                                    : ''}
                                            </td>
                                            <td className="px-3 py-2 text-gray-400 text-sm">
                                                {s.wordCount ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">
                                                {s.generatedAt
                                                    ? new Date(s.generatedAt).toLocaleString()
                                                    : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">
                                                {s.createdBy || '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <button
                                                        type="button"
                                                        disabled={previewLoading && busyId === s.id}
                                                        onClick={() => {
                                                            setBusyId(s.id);
                                                            void handlePreviewSnapshot(s.id).finally(
                                                                () => setBusyId(null)
                                                            );
                                                        }}
                                                        className="px-2 py-1 text-xs rounded border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-40"
                                                    >
                                                        Preview
                                                    </button>
                                                    {s.status !== 'published' &&
                                                        s.status !== 'archived' && (
                                                            <button
                                                                type="button"
                                                                disabled={busyId === s.id}
                                                                onClick={() =>
                                                                    handlePublishSnapshot(s.id)
                                                                }
                                                                className="px-2 py-1 text-xs rounded border border-green-800 text-green-400 hover:bg-green-900/30 disabled:opacity-40"
                                                            >
                                                                Publish
                                                            </button>
                                                        )}
                                                    {s.status === 'published' && (
                                                        <button
                                                            type="button"
                                                            disabled={busyId === s.id}
                                                            onClick={() =>
                                                                handleUnpublishSnapshot(s.id)
                                                            }
                                                            className="px-2 py-1 text-xs rounded border border-amber-800 text-amber-300 hover:bg-amber-900/20 disabled:opacity-40"
                                                        >
                                                            Unpublish
                                                        </button>
                                                    )}
                                                    {s.status !== 'archived' && (
                                                        <button
                                                            type="button"
                                                            disabled={busyId === s.id}
                                                            onClick={() =>
                                                                handleArchiveSnapshot(s.id)
                                                            }
                                                            className="px-2 py-1 text-xs rounded border border-[#333] text-gray-400 hover:bg-[#222] disabled:opacity-40"
                                                        >
                                                            Archive
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {previewLoading && !preview && (
                        <p className="mt-4 text-sm text-gray-500">Loading preview…</p>
                    )}

                    {preview && (
                        <div className="mt-6 bg-[#0A0A0A] border border-[#333] rounded p-4 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        Preview snapshot #{preview.id}
                                    </h2>
                                    <p className="text-xs text-gray-500 font-mono mt-1">
                                        {preview.snapshotKey} · {preview.status} · {preview.kind}
                                        {preview.weekLabel ? ` · ${preview.weekLabel}` : ''} ·{' '}
                                        {preview.generatorVersion}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Trusted news IDs: {(preview.newsIds ?? []).join(', ') || '—'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    className="px-3 py-1.5 text-xs rounded border border-[#333] text-gray-400 hover:bg-[#222]"
                                >
                                    Close preview
                                </button>
                            </div>

                            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                                {SECTION_PREVIEW_ORDER.map((key) => {
                                    const section = preview.sections?.[key];
                                    if (!section?.content?.trim()) return null;
                                    return (
                                        <section
                                            key={key}
                                            className="border-t border-[#222] pt-4 first:border-t-0 first:pt-0"
                                        >
                                            <h3 className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-2">
                                                {key}
                                            </h3>
                                            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
                                                {section.content}
                                            </pre>
                                            {section.sourceNewsIds?.length > 0 && (
                                                <p className="text-[10px] text-gray-600 mt-2 font-mono">
                                                    sourceNewsIds: {section.sourceNewsIds.join(', ')}
                                                </p>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>

                            {preview.status === 'draft' && (
                                <div className="mt-4 pt-4 border-t border-[#333] flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busyId === preview.id}
                                        onClick={() => handlePublishSnapshot(preview.id)}
                                        className="px-4 py-2 text-sm rounded border border-green-800 text-green-400 hover:bg-green-900/30 disabled:opacity-40"
                                    >
                                        Publish this draft
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {tab === 'coins' && (
                <>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6 flex flex-wrap gap-3 items-center">
                        <button
                            type="button"
                            disabled={generateAllRunning}
                            onClick={() => void handleGenerateAllRemaining()}
                            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {generateAllRunning
                                ? `Generating… ${busySymbol ?? ''}`
                                : 'Generate All Remaining'}
                        </button>
                        <button
                            type="button"
                            onClick={fetchCoinSnapshots}
                            className="px-3 py-2 border border-[#333] text-gray-300 rounded text-sm"
                        >
                            Refresh
                        </button>
                        <p className="text-xs text-gray-500 w-full">
                            Tracked set ({TRACKED_COINS.length}). Sequential generate with ~3s gap.
                            SEO score from last generation.
                        </p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                        <table className="w-full table-auto">
                            <thead>
                                <tr className="bg-[#111] text-gray-300">
                                    <th className="px-3 py-2 text-left">Symbol</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Last Generated</th>
                                    <th className="px-3 py-2 text-left">Word Count</th>
                                    <th className="px-3 py-2 text-left">SEO Score</th>
                                    <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coinsLoading && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {!coinsLoading &&
                                    TRACKED_COINS.map((symbol) => {
                                        const row = coinRowsBySymbol.get(symbol);
                                        return (
                                            <tr
                                                key={symbol}
                                                className="border-t border-[#222] hover:bg-[#111]"
                                            >
                                                <td className="px-3 py-2 font-semibold text-white">
                                                    {symbol}
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                    <span
                                                        className={
                                                            row?.status === 'published'
                                                                ? 'text-green-400'
                                                                : row?.status === 'draft'
                                                                  ? 'text-yellow-400'
                                                                  : row
                                                                    ? 'text-gray-500'
                                                                    : 'text-gray-600'
                                                        }
                                                    >
                                                        {row?.status ?? 'missing'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500">
                                                    {row?.generatedAt
                                                        ? new Date(row.generatedAt).toLocaleString()
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-gray-400">
                                                    {row?.wordCount ?? '—'}
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                    {seoBandEmoji(row?.seoScore?.band)}
                                                    {row?.seoScore
                                                        ? ` ${row.seoScore.band} (${row.seoScore.score})`
                                                        : ' —'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                busySymbol === symbol ||
                                                                generateAllRunning
                                                            }
                                                            onClick={() =>
                                                                void handleGenerateCoin(symbol)
                                                            }
                                                            className="px-2 py-1 text-xs rounded border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-40"
                                                        >
                                                            Generate
                                                        </button>
                                                        {row && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void handlePreviewSnapshot(
                                                                        row.id
                                                                    )
                                                                }
                                                                className="px-2 py-1 text-xs rounded border border-[#333] text-gray-300 hover:bg-[#222]"
                                                            >
                                                                Preview
                                                            </button>
                                                        )}
                                                        {row &&
                                                            row.status !== 'published' &&
                                                            row.status !== 'archived' && (
                                                                <button
                                                                    type="button"
                                                                    disabled={busyId === row.id}
                                                                    onClick={() =>
                                                                        handlePublishSnapshot(
                                                                            row.id
                                                                        )
                                                                    }
                                                                    className="px-2 py-1 text-xs rounded border border-green-800 text-green-400 disabled:opacity-40"
                                                                >
                                                                    Publish
                                                                </button>
                                                            )}
                                                        {row?.status === 'published' && (
                                                            <button
                                                                type="button"
                                                                disabled={busyId === row.id}
                                                                onClick={() =>
                                                                    handleUnpublishSnapshot(row.id)
                                                                }
                                                                className="px-2 py-1 text-xs rounded border border-amber-800 text-amber-300 disabled:opacity-40"
                                                            >
                                                                Unpublish
                                                            </button>
                                                        )}
                                                        {row && row.status !== 'archived' && (
                                                            <button
                                                                type="button"
                                                                disabled={busyId === row.id}
                                                                onClick={() =>
                                                                    handleArchiveSnapshot(row.id)
                                                                }
                                                                className="px-2 py-1 text-xs rounded border border-[#333] text-gray-400 disabled:opacity-40"
                                                            >
                                                                Archive
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {preview && (
                        <div className="mt-6 bg-[#0A0A0A] border border-[#333] rounded p-4">
                            <div className="flex justify-between mb-3">
                                <h2 className="text-white font-semibold">
                                    Preview #{preview.id} {preview.symbol ?? preview.kind}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    className="text-xs text-gray-400 border border-[#333] px-2 py-1 rounded"
                                >
                                    Close
                                </button>
                            </div>
                            {preview.seoMeta && (
                                <p className="text-xs text-gray-500 mb-3">
                                    SEO: {preview.seoMeta.metaTitle} · score{' '}
                                    {seoBandEmoji(preview.seoScore?.band)}{' '}
                                    {preview.seoScore?.score ?? '—'}
                                </p>
                            )}
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                                {SECTION_PREVIEW_ORDER.map((key) => {
                                    const section = preview.sections?.[key];
                                    if (!section?.content?.trim()) return null;
                                    return (
                                        <section key={key} className="border-t border-[#222] pt-3">
                                            <h3 className="text-xs font-mono text-blue-400 mb-1">
                                                {key}
                                            </h3>
                                            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">
                                                {section.content.slice(0, 2000)}
                                            </pre>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {tab === 'activity' && (
                <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                    <div className="p-3 border-b border-[#333] flex justify-between items-center">
                        <h2 className="text-sm text-gray-300">Recent market_context_* actions</h2>
                        <button
                            type="button"
                            onClick={fetchActivity}
                            className="text-xs border border-[#333] px-2 py-1 rounded text-gray-400"
                        >
                            Refresh
                        </button>
                    </div>
                    {activityLoading && (
                        <p className="p-4 text-gray-500 text-sm">Loading…</p>
                    )}
                    {!activityLoading && activities.length === 0 && (
                        <p className="p-4 text-gray-500 text-sm">No activity yet</p>
                    )}
                    <ul className="divide-y divide-[#222] max-h-[600px] overflow-y-auto">
                        {activities.map((a) => (
                            <li key={a.id} className="px-4 py-3 text-sm">
                                <div className="flex flex-wrap gap-2 text-gray-300">
                                    <span className="text-blue-300 font-mono text-xs">
                                        {a.action}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                        {a.createdAt
                                            ? new Date(a.createdAt).toLocaleString()
                                            : '—'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {a.adminEmail}
                                    {a.targetId ? ` · #${a.targetId}` : ''}
                                    {a.targetTable ? ` · ${a.targetTable}` : ''}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tab === 'channels' && (
                <>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                        <h2 className="text-sm font-semibold text-gray-300 mb-3">Add channel</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="@channel or id *"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="Title"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                            <input
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                                placeholder="Notes"
                                className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={addChannel}
                            disabled={channelSubmitting}
                            className="mt-3 px-4 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                        >
                            {channelSubmitting ? 'Adding…' : 'Add channel'}
                        </button>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                        <table className="w-full table-auto">
                            <thead>
                                <tr className="bg-[#111] text-gray-300">
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">Username / ID</th>
                                    <th className="px-3 py-2 text-left">Title</th>
                                    <th className="px-3 py-2 text-left">Enabled</th>
                                    <th className="px-3 py-2 text-left">Cursor</th>
                                    <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {channelsLoading && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-3 py-6 text-center text-gray-500"
                                        >
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {!channelsLoading && channels.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-3 py-6 text-center text-gray-500"
                                        >
                                            No channels configured
                                        </td>
                                    </tr>
                                )}
                                {!channelsLoading &&
                                    channels.map((ch) => (
                                        <tr
                                            key={ch.id}
                                            className="border-t border-[#222] hover:bg-[#111]"
                                        >
                                            <td className="px-3 py-2 text-gray-400">{ch.id}</td>
                                            <td className="px-3 py-2 font-mono text-white text-sm">
                                                {ch.usernameOrId}
                                            </td>
                                            <td className="px-3 py-2 text-gray-300 text-sm">
                                                {ch.title || '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={
                                                        ch.enabled
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                    }
                                                >
                                                    {ch.enabled ? 'Yes' : 'No'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 text-xs font-mono">
                                                {ch.lastCursor || '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    disabled={busyId === ch.id}
                                                    onClick={() => toggleChannel(ch)}
                                                    className="px-2 py-1 text-xs rounded border border-[#333] text-gray-300 hover:bg-[#222] disabled:opacity-40"
                                                >
                                                    {ch.enabled ? 'Disable' : 'Enable'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
