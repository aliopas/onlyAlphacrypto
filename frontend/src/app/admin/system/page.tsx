'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface TelemetryData {
    timestamp: string;
    signals: {
        total: number;
        byState: Record<string, number>;
        activeCount: number;
        closedCount: number;
        archivedCount: number;
        partialTpCount: number;
        winRate72h: number | null;
    };
    shadowMode: {
        total: number;
        unresolved: number;
        resolved72h: number;
        algorithmWins72h: number;
        aiWins72h: number;
        agreementRate: number | null;
    };
    pipeline: {
        newsBufferBacklog: number;
        articlesLast24h: number;
        hourlyPublishRate: number | null;
    };
    health: {
        dbConnected: boolean;
        redisConnected: boolean;
        signalGenerationPaused: boolean;
    };
}

export default function SystemPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [telemetryLoading, setTelemetryLoading] = useState(false);
    const [telemetryError, setTelemetryError] = useState<string | null>(null);

    const [maintenanceFlags, setMaintenanceFlags] = useState<Record<string, number>>({});
    const [flagsLoading, setFlagsLoading] = useState(false);

    const [toggleForm, setToggleForm] = useState({ pageKey: '', enabled: false, ttlSeconds: 3600 });
    const [toggleLoading, setToggleLoading] = useState(false);
    const [toggleMessage, setToggleMessage] = useState<string | null>(null);

    const fetchTelemetry = useCallback(async () => {
        setTelemetryLoading(true);
        setTelemetryError(null);
        try {
            const response = await fetchWithAuth('/admin/telemetry');
            if (!response.ok) throw new Error('Failed to fetch telemetry');
            const data = await response.json();
            setTelemetry(data);
        } catch (err) {
            setTelemetryError(err instanceof Error ? err.message : 'Failed to load telemetry');
        } finally {
            setTelemetryLoading(false);
        }
    }, [fetchWithAuth]);

    const fetchFlags = useCallback(async () => {
        setFlagsLoading(true);
        try {
            const response = await fetchWithAuth('/admin/maintenance');
            if (response.ok) {
                const data = await response.json();
                setMaintenanceFlags(data);
            }
        } catch {
            // ignore
        } finally {
            setFlagsLoading(false);
        }
    }, [fetchWithAuth]);

    useEffect(() => {
        fetchTelemetry();
        fetchFlags();
    }, [fetchTelemetry, fetchFlags]);

    const handleToggle = async (e: React.FormEvent) => {
        e.preventDefault();
        setToggleLoading(true);
        setToggleMessage(null);
        try {
            const response = await fetchWithAuth('/admin/maintenance/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toggleForm),
            });
            if (!response.ok) throw new Error('Toggle failed');
            setToggleMessage(`Maintenance ${toggleForm.enabled ? 'enabled' : 'disabled'} for ${toggleForm.pageKey}`);
            fetchFlags();
        } catch (err) {
            setToggleMessage(err instanceof Error ? err.message : 'Toggle failed');
        } finally {
            setToggleLoading(false);
        }
    };

    const formatNumber = (n: number | null) => (n !== null ? n.toFixed(1) : 'N/A');

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">System</h1>

            {toggleMessage && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">{toggleMessage}</div>
            )}

            {/* Telemetry Cards */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Telemetry</h2>
                    <button
                        onClick={fetchTelemetry}
                        disabled={telemetryLoading}
                        className="px-3 py-1 bg-[#1a1a1a] text-gray-300 rounded hover:bg-[#2a2a2a] text-sm"
                    >
                        {telemetryLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {telemetryError && (
                    <div className="p-4 bg-red-900/20 border border-red-900/50 rounded text-red-400">{telemetryError}</div>
                )}

                {telemetry && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm text-gray-500 mb-1">Total Signals</h3>
                                <p className="text-2xl font-bold">{telemetry.signals.total}</p>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm text-gray-500 mb-1">Active Signals</h3>
                                <p className="text-2xl font-bold text-green-400">{telemetry.signals.activeCount}</p>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm text-gray-500 mb-1">Shadow Total</h3>
                                <p className="text-2xl font-bold">{telemetry.shadowMode.total}</p>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm text-gray-500 mb-1">News Buffer</h3>
                                <p className="text-2xl font-bold">{telemetry.pipeline.newsBufferBacklog}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm font-semibold mb-3">Signal States</h3>
                                <div className="space-y-1">
                                    {Object.entries(telemetry.signals.byState).map(([state, count]) => (
                                        <div key={state} className="flex justify-between text-sm">
                                            <span className="text-gray-400">{state}</span>
                                            <span className="font-mono">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm font-semibold mb-3">Shadow Mode 72h</h3>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Resolved</span>
                                        <span className="font-mono">{telemetry.shadowMode.resolved72h}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Algorithm Wins</span>
                                        <span className="font-mono text-green-400">{telemetry.shadowMode.algorithmWins72h}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">AI Wins</span>
                                        <span className="font-mono text-blue-400">{telemetry.shadowMode.aiWins72h}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Win Rate</span>
                                        <span className="font-mono">{formatNumber(telemetry.signals.winRate72h)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm font-semibold mb-2">Database</h3>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${telemetry.health.dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="text-sm">{telemetry.health.dbConnected ? 'Connected' : 'Disconnected'}</span>
                                </div>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm font-semibold mb-2">Redis</h3>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${telemetry.health.redisConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="text-sm">{telemetry.health.redisConnected ? 'Connected' : 'Disconnected'}</span>
                                </div>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                                <h3 className="text-sm font-semibold mb-2">Signal Gen</h3>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${telemetry.health.signalGenerationPaused ? 'bg-red-500' : 'bg-green-500'}`} />
                                    <span className="text-sm">{telemetry.health.signalGenerationPaused ? 'Paused' : 'Running'}</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Maintenance Flags */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Maintenance Mode</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-sm font-semibold mb-3">Active Flags</h3>
                        {flagsLoading ? (
                            <p className="text-gray-500">Loading...</p>
                        ) : Object.keys(maintenanceFlags).length === 0 ? (
                            <p className="text-gray-500">No active maintenance flags</p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(maintenanceFlags).map(([key, ttl]) => (
                                    <div key={key} className="flex justify-between items-center p-2 bg-[#1a1a1a] rounded">
                                        <span className="text-sm font-mono">{key}</span>
                                        <span className="text-xs text-gray-500">{TTL: {ttl}s}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-sm font-semibold mb-3">Toggle Maintenance</h3>
                        <form onSubmit={handleToggle} className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Page Key</label>
                                <input
                                    type="text"
                                    value={toggleForm.pageKey}
                                    onChange={(e) => setToggleForm((f) => ({ ...f, pageKey: e.target.value }))}
                                    placeholder="e.g. home, terminal, airdrops"
                                    className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-600"
                                    required
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={toggleForm.enabled}
                                        onChange={(e) => setToggleForm((f) => ({ ...f, enabled: e.target.checked }))}
                                        className="rounded"
                                    />
                                    Enable Maintenance
                                </label>
                            </div>
                            {toggleForm.enabled && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">TTL (seconds)</label>
                                    <input
                                        type="number"
                                        value={toggleForm.ttlSeconds}
                                        onChange={(e) => setToggleForm((f) => ({ ...f, ttlSeconds: Number(e.target.value) }))}
                                        className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                                        min={60}
                                    />
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={toggleLoading}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {toggleLoading ? 'Applying...' : 'Apply'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
