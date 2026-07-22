'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface PipelineMetrics {
    runsLast7d: number;
    runsByType: Array<{ runType: string; count: number }>;
    recentRuns: Array<{
        id: number;
        runType: string;
        runAt: string;
        articlesFound: number | null;
        articlesProcessed: number | null;
        projectsInserted: number | null;
        projectsRejected: number | null;
        errors: number | null;
        durationMs: number | null;
        notes: string | null;
    }>;
    projectOutcomes: {
        activeAutoPublish: number;
        holdRecheck: number;
        rejected: number;
        discovering: number;
        archived: number;
        inactive: number;
        total: number;
    };
    entityCount: number;
    signalCount7d: number;
}

interface AdminProject {
    id: number;
    name: string;
    network: string;
    isActive: boolean | null;
    pipelineStatus: string;
    publishPath: string;
    qualityScore: number | null;
    riskVerdict: string | null;
    entityId: number | null;
    updatedAt: string;
}

interface AdminEntity {
    id: number;
    canonicalName: string;
    slug: string;
    defillamaSlug: string | null;
    aliasCount: number;
    projectCount: number;
    signalCount: number;
    updatedAt: string;
}

interface EntityAlias {
    id: number;
    alias: string;
    normalizedAlias: string;
    source: string;
    createdAt: string;
}

type Tab = 'metrics' | 'projects' | 'entities';

export default function AirdropOpsAdminPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [tab, setTab] = useState<Tab>('metrics');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);

    const [projects, setProjects] = useState<AdminProject[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const [entities, setEntities] = useState<AdminEntity[]>([]);
    const [entitiesLoading, setEntitiesLoading] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
    const [aliases, setAliases] = useState<EntityAlias[]>([]);
    const [newAlias, setNewAlias] = useState('');
    const [mergeTarget, setMergeTarget] = useState('');
    const [mergeSource, setMergeSource] = useState('');
    const [splitSource, setSplitSource] = useState('');
    const [splitName, setSplitName] = useState('');

    const fetchMetrics = useCallback(async () => {
        setMetricsLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth('/admin/airdrop-ops/metrics');
            if (!response.ok) throw new Error('Failed to load metrics');
            const data = (await response.json()) as { metrics: PipelineMetrics };
            setMetrics(data.metrics);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Metrics failed');
        } finally {
            setMetricsLoading(false);
        }
    }, [fetchWithAuth]);

    const fetchProjects = useCallback(async () => {
        setProjectsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.append('pipelineStatus', statusFilter);
            params.append('limit', '80');
            const qs = params.toString();
            const response = await fetchWithAuth(`/admin/airdrop-ops/projects?${qs}`);
            if (!response.ok) throw new Error('Failed to load projects');
            const data = (await response.json()) as { projects: AdminProject[] };
            setProjects(data.projects);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Projects failed');
        } finally {
            setProjectsLoading(false);
        }
    }, [fetchWithAuth, statusFilter]);

    const fetchEntities = useCallback(async () => {
        setEntitiesLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth('/admin/airdrop-ops/entities?limit=80');
            if (!response.ok) throw new Error('Failed to load entities');
            const data = (await response.json()) as { entities: AdminEntity[] };
            setEntities(data.entities);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Entities failed');
        } finally {
            setEntitiesLoading(false);
        }
    }, [fetchWithAuth]);

    const loadEntityDetail = async (id: number) => {
        setSelectedEntityId(id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(`/admin/airdrop-ops/entities/${id}`);
            if (!response.ok) throw new Error('Failed to load entity');
            const data = (await response.json()) as { aliases: EntityAlias[] };
            setAliases(data.aliases);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Entity detail failed');
        }
    };

    useEffect(() => {
        if (tab === 'metrics') void fetchMetrics();
    }, [tab, fetchMetrics]);

    useEffect(() => {
        if (tab === 'projects') void fetchProjects();
    }, [tab, fetchProjects]);

    useEffect(() => {
        if (tab === 'entities') void fetchEntities();
    }, [tab, fetchEntities]);

    const killSwitch = async (p: AdminProject) => {
        if (
            !window.confirm(
                `Kill-switch deactivate "${p.name}" (#${p.id})? Removes from public immediately.`
            )
        ) {
            return;
        }
        setBusyId(p.id);
        setMessage(null);
        try {
            const response = await fetchWithAuth(
                `/admin/airdrop-ops/projects/${p.id}/kill-switch`,
                { method: 'POST' }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Kill-switch failed');
            setMessage(`Project #${p.id} deactivated (archived)`);
            void fetchProjects();
            void fetchMetrics();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Kill-switch failed');
        } finally {
            setBusyId(null);
        }
    };

    const addAlias = async () => {
        if (!selectedEntityId || !newAlias.trim()) {
            setMessage('Select entity and enter alias');
            return;
        }
        setBusyId(selectedEntityId);
        try {
            const response = await fetchWithAuth(
                `/admin/airdrop-ops/entities/${selectedEntityId}/aliases`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alias: newAlias.trim() }),
                }
            );
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error || 'Add alias failed');
            setMessage('Alias added');
            setNewAlias('');
            void loadEntityDetail(selectedEntityId);
            void fetchEntities();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Add alias failed');
        } finally {
            setBusyId(null);
        }
    };

    const runMerge = async () => {
        const targetEntityId = parseInt(mergeTarget, 10);
        const sourceEntityId = parseInt(mergeSource, 10);
        if (isNaN(targetEntityId) || isNaN(sourceEntityId)) {
            setMessage('Enter valid target and source entity IDs');
            return;
        }
        if (
            !window.confirm(
                `Merge entity #${sourceEntityId} INTO #${targetEntityId}? Source will be deleted.`
            )
        ) {
            return;
        }
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/airdrop-ops/entities/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetEntityId, sourceEntityId }),
            });
            const data = (await response.json()) as {
                error?: string;
                merge?: { moved: Record<string, number> };
            };
            if (!response.ok) throw new Error(data.error || 'Merge failed');
            setMessage(
                `Merged — moved ${JSON.stringify(data.merge?.moved ?? {})}`
            );
            setMergeSource('');
            void fetchEntities();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Merge failed');
        }
    };

    const runSplit = async () => {
        const sourceEntityId = parseInt(splitSource, 10);
        if (isNaN(sourceEntityId) || !splitName.trim()) {
            setMessage('Enter source entity ID and new canonical name');
            return;
        }
        setMessage(null);
        try {
            const response = await fetchWithAuth('/admin/airdrop-ops/entities/split', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceEntityId,
                    newCanonicalName: splitName.trim(),
                }),
            });
            const data = (await response.json()) as {
                error?: string;
                split?: { newEntityId: number; slug: string };
            };
            if (!response.ok) throw new Error(data.error || 'Split failed');
            setMessage(
                `Split OK — new entity #${data.split?.newEntityId} (${data.split?.slug})`
            );
            setSplitName('');
            void fetchEntities();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Split failed');
        }
    };

    const o = metrics?.projectOutcomes;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Airdrop Ops</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Pipeline metrics · kill-switch · entity merge/split. No trust-approve queue
                        (DEC-041).
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
                {(['metrics', 'projects', 'entities'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded text-sm capitalize ${
                            tab === t
                                ? 'bg-blue-900/40 text-blue-300 border border-blue-800'
                                : 'bg-[#111] text-gray-400 border border-[#333]'
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {message && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400 text-sm">
                    {message}
                </div>
            )}
            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm">
                    {error}
                </div>
            )}

            {tab === 'metrics' && (
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => void fetchMetrics()}
                        className="px-3 py-2 border border-[#333] text-gray-300 rounded text-sm"
                    >
                        Refresh
                    </button>
                    {metricsLoading && <p className="text-gray-500 text-sm">Loading…</p>}
                    {metrics && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricBox label="Runs (7d)" value={String(metrics.runsLast7d)} />
                                <MetricBox
                                    label="Auto-publish"
                                    value={String(o?.activeAutoPublish ?? 0)}
                                    accent="text-green-400"
                                />
                                <MetricBox
                                    label="Hold recheck"
                                    value={String(o?.holdRecheck ?? 0)}
                                    accent="text-yellow-400"
                                />
                                <MetricBox
                                    label="Rejected"
                                    value={String(o?.rejected ?? 0)}
                                    accent="text-red-400"
                                />
                                <MetricBox label="Discovering" value={String(o?.discovering ?? 0)} />
                                <MetricBox label="Archived" value={String(o?.archived ?? 0)} />
                                <MetricBox label="Entities" value={String(metrics.entityCount)} />
                                <MetricBox
                                    label="Signals (7d)"
                                    value={String(metrics.signalCount7d)}
                                />
                            </div>

                            {metrics.runsByType.length > 0 && (
                                <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                    <h2 className="text-sm font-semibold text-gray-300 mb-2">
                                        Runs by type (7d)
                                    </h2>
                                    <ul className="text-sm font-mono text-gray-400 space-y-1">
                                        {metrics.runsByType.map((r) => (
                                            <li key={r.runType}>
                                                {r.runType}: {r.count}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-x-auto">
                                <table className="w-full text-sm min-w-[700px]">
                                    <thead>
                                        <tr className="bg-[#111] text-gray-300">
                                            <th className="px-3 py-2 text-left">ID</th>
                                            <th className="px-3 py-2 text-left">Type</th>
                                            <th className="px-3 py-2 text-left">At</th>
                                            <th className="px-3 py-2 text-left">Ins</th>
                                            <th className="px-3 py-2 text-left">Rej</th>
                                            <th className="px-3 py-2 text-left">Err</th>
                                            <th className="px-3 py-2 text-left">ms</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.recentRuns.map((r) => (
                                            <tr key={r.id} className="border-t border-[#222]">
                                                <td className="px-3 py-2 text-gray-500">{r.id}</td>
                                                <td className="px-3 py-2 font-mono text-xs text-white">
                                                    {r.runType}
                                                </td>
                                                <td className="px-3 py-2 text-gray-500 text-xs">
                                                    {new Date(r.runAt).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-gray-400">
                                                    {r.projectsInserted ?? 0}
                                                </td>
                                                <td className="px-3 py-2 text-gray-400">
                                                    {r.projectsRejected ?? 0}
                                                </td>
                                                <td className="px-3 py-2 text-gray-400">
                                                    {r.errors ?? 0}
                                                </td>
                                                <td className="px-3 py-2 text-gray-500">
                                                    {r.durationMs ?? '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === 'projects' && (
                <div>
                    <div className="flex flex-wrap gap-3 mb-4 items-center">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm"
                        >
                            <option value="">All statuses</option>
                            <option value="active">active</option>
                            <option value="hold_recheck">hold_recheck</option>
                            <option value="rejected">rejected</option>
                            <option value="discovering">discovering</option>
                            <option value="archived">archived</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => void fetchProjects()}
                            className="px-3 py-2 border border-[#333] text-gray-300 rounded text-sm"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-x-auto">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead>
                                <tr className="bg-[#111] text-gray-300">
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">Name</th>
                                    <th className="px-3 py-2 text-left">Pipeline</th>
                                    <th className="px-3 py-2 text-left">Publish</th>
                                    <th className="px-3 py-2 text-left">Active</th>
                                    <th className="px-3 py-2 text-left">Q</th>
                                    <th className="px-3 py-2 text-left">Entity</th>
                                    <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectsLoading && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {!projectsLoading && projects.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                                            No projects
                                        </td>
                                    </tr>
                                )}
                                {!projectsLoading &&
                                    projects.map((p) => (
                                        <tr key={p.id} className="border-t border-[#222] hover:bg-[#111]">
                                            <td className="px-3 py-2 text-gray-500">{p.id}</td>
                                            <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-gray-300">
                                                {p.pipelineStatus}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs text-gray-400">
                                                {p.publishPath}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={
                                                        p.isActive ? 'text-green-400' : 'text-gray-500'
                                                    }
                                                >
                                                    {p.isActive ? 'on' : 'off'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-400">
                                                {p.qualityScore ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500">
                                                {p.entityId ?? '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        busyId === p.id ||
                                                        p.pipelineStatus === 'archived'
                                                    }
                                                    onClick={() => void killSwitch(p)}
                                                    className="px-2 py-1 text-xs rounded border border-red-900 text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                                                >
                                                    Kill-switch
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'entities' && (
                <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                            <h2 className="text-sm font-semibold text-gray-300 mb-3">Merge entities</h2>
                            <p className="text-[10px] text-gray-500 mb-2">
                                Source is deleted; FKs + aliases move to target. Admin-only, never
                                auto.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <input
                                    value={mergeTarget}
                                    onChange={(e) => setMergeTarget(e.target.value)}
                                    placeholder="Target entity ID"
                                    className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm w-36"
                                />
                                <input
                                    value={mergeSource}
                                    onChange={(e) => setMergeSource(e.target.value)}
                                    placeholder="Source entity ID"
                                    className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm w-36"
                                />
                                <button
                                    type="button"
                                    onClick={() => void runMerge()}
                                    className="px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded text-sm"
                                >
                                    Merge
                                </button>
                            </div>
                        </div>
                        <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                            <h2 className="text-sm font-semibold text-gray-300 mb-3">Split entity</h2>
                            <div className="flex flex-wrap gap-2">
                                <input
                                    value={splitSource}
                                    onChange={(e) => setSplitSource(e.target.value)}
                                    placeholder="Source entity ID"
                                    className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm w-36"
                                />
                                <input
                                    value={splitName}
                                    onChange={(e) => setSplitName(e.target.value)}
                                    placeholder="New canonical name"
                                    className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm flex-1 min-w-[140px]"
                                />
                                <button
                                    type="button"
                                    onClick={() => void runSplit()}
                                    className="px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded text-sm"
                                >
                                    Split
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-x-auto">
                        <table className="w-full text-sm min-w-[800px]">
                            <thead>
                                <tr className="bg-[#111] text-gray-300">
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">Name</th>
                                    <th className="px-3 py-2 text-left">Slug</th>
                                    <th className="px-3 py-2 text-left">Aliases</th>
                                    <th className="px-3 py-2 text-left">Projects</th>
                                    <th className="px-3 py-2 text-left">Signals</th>
                                    <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entitiesLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {!entitiesLoading &&
                                    entities.map((e) => (
                                        <tr
                                            key={e.id}
                                            className={`border-t border-[#222] hover:bg-[#111] ${
                                                selectedEntityId === e.id ? 'bg-blue-900/10' : ''
                                            }`}
                                        >
                                            <td className="px-3 py-2 text-gray-500">{e.id}</td>
                                            <td className="px-3 py-2 text-white">{e.canonicalName}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-gray-400">
                                                {e.slug}
                                            </td>
                                            <td className="px-3 py-2 text-gray-400">{e.aliasCount}</td>
                                            <td className="px-3 py-2 text-gray-400">{e.projectCount}</td>
                                            <td className="px-3 py-2 text-gray-400">{e.signalCount}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void loadEntityDetail(e.id)}
                                                    className="px-2 py-1 text-xs rounded border border-blue-800 text-blue-300"
                                                >
                                                    Aliases
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {selectedEntityId !== null && (
                        <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                            <h2 className="text-sm font-semibold text-gray-300 mb-3">
                                Aliases · entity #{selectedEntityId}
                            </h2>
                            <ul className="text-sm font-mono text-gray-400 mb-3 space-y-1">
                                {aliases.length === 0 && <li className="text-gray-600">No aliases</li>}
                                {aliases.map((a) => (
                                    <li key={a.id}>
                                        {a.alias}{' '}
                                        <span className="text-gray-600">
                                            ({a.normalizedAlias} · {a.source})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex gap-2">
                                <input
                                    value={newAlias}
                                    onChange={(e) => setNewAlias(e.target.value)}
                                    placeholder="New alias"
                                    className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white text-sm flex-1"
                                />
                                <button
                                    type="button"
                                    disabled={busyId === selectedEntityId}
                                    onClick={() => void addAlias()}
                                    className="px-3 py-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                                >
                                    Add alias
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricBox({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: string;
}) {
    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
            <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${accent ?? 'text-white'}`}>{value}</p>
        </div>
    );
}
