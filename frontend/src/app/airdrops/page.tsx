'use client';

import { useEffect, useState, useCallback } from 'react';
import { airdropApi, AirdropStats, AirdropActivity, AirdropDeadline } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';
import Link from 'next/link';

const STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
    SAFE: { text: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/30' },
    MEDIUM: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
    HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/5', border: 'border-orange-500/30' },
    SCAM: { text: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/30' },
    TESTNET: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
};

export default function AirdropsPage() {
    const [projects, setProjects] = useState<AirdropProject[]>([]);
    const [stats, setStats] = useState<AirdropStats | null>(null);
    const [activity, setActivity] = useState<AirdropActivity[]>([]);
    const [deadlines, setDeadlines] = useState<AirdropDeadline[]>([]);
    const [loading, setLoading] = useState(true);
    const [sidebarLoading, setSidebarLoading] = useState(true);

    const loadProjects = useCallback(async () => {
        try {
            const data = await airdropApi.getProjects();
            setProjects(data);
        } catch (error) {
            console.error('[Airdrops] Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSidebarData = useCallback(async () => {
        try {
            const [statsData, activityData, deadlinesData] = await Promise.all([
                airdropApi.getStats(),
                airdropApi.getActivity(),
                airdropApi.getDeadlines(),
            ]);
            if (statsData) setStats(statsData);
            if (activityData) setActivity(activityData);
            if (deadlinesData) setDeadlines(deadlinesData);
        } catch (error) {
            console.error('[Airdrops] Failed to load sidebar data:', error);
        } finally {
            setSidebarLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProjects();
        loadSidebarData();
    }, [loadProjects, loadSidebarData]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-black">
                <div className="font-mono text-[#555] animate-pulse uppercase tracking-[0.5em]">Loading Farm Grid...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-6 h-full">
            {/* Left 70% — Farm Grid */}
            <div className="w-full lg:w-[70%] flex flex-col gap-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 inline-block" /> Active Farm Grid
                    </h2>
                    <div className="flex gap-4">
                        <span className="text-[10px] font-mono text-[#555] uppercase">Total Active: <span className="text-white font-mono-nums">{projects.length}</span></span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projects.map((p) => {
                        const verdict = p.riskVerdict || 'SAFE';
                        const c = STATUS_COLOR[verdict] || STATUS_COLOR.SAFE;
                        return (
                            <Link key={p.id} href={`/airdrops/${p.id}`}
                                className="bg-[#0A0A0A] border border-[#333] p-6 hover:border-[#444] transition-colors group block">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold tracking-tight uppercase text-white mb-1">{p.name}</h3>
                                        <span className={`text-[9px] font-mono px-2 py-0.5 border ${c.border} ${c.text} ${c.bg} tracking-wider uppercase`}>
                                            {verdict}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-mono text-[#555] block">EST. VALUE</span>
                                        <span className="text-lg font-mono-nums font-bold text-white">{p.estValue || 'TBD'}</span>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-mono text-[#888] uppercase tracking-wider">Farming Progress</span>
                                        <span className="text-[10px] font-mono-nums text-white">–</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 w-0" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-mono text-[#555] uppercase tracking-[0.1em] border-b border-[#222] pb-1">
                                        Network: {p.network}
                                    </h4>
                                    {p.snapshotAt && (
                                        <p className="text-[11px] font-mono text-[#555]">
                                            Snapshot: <span className="text-[#888]">{new Date(p.snapshotAt).toLocaleDateString()}</span>
                                        </p>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Right 30% — Stats & Deadlines */}
            <div className="w-full lg:w-[30%] flex flex-col gap-6">
                {/* Farming Stats */}
                <div className="bg-[#0A0A0A] border border-[#333] p-6 flex flex-col">
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-4">My Farming Stats</h3>
                    {sidebarLoading ? (
                        <div className="font-mono text-[#555] text-sm">Loading...</div>
                    ) : stats ? (
                        <div className="space-y-6">
                            <div>
                                <span className="text-[10px] font-mono text-[#555] uppercase block">Total Unrealized Value</span>
                                <div className="text-4xl font-mono-nums font-bold text-white tracking-tighter mt-1">${stats.totalValue.toLocaleString()}+</div>
                                <div className="text-[11px] font-mono text-emerald-500 mt-1">{stats.completedTasks} tasks completed</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#222]">
                                <div>
                                    <span className="text-[10px] font-mono text-[#555] uppercase block">Wallets Active</span>
                                    <span className="text-xl font-mono-nums font-bold text-white">{String(stats.walletCount).padStart(2, '0')}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono text-[#555] uppercase block">Total TXs</span>
                                    <span className="text-xl font-mono-nums font-bold text-white">{stats.txCount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="font-mono text-red-500 text-sm">Failed to load</div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-[#0A0A0A] border border-[#333] p-6 flex flex-col">
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-4">Recent Activity</h3>
                    {sidebarLoading ? (
                        <div className="font-mono text-[#555] text-sm">Loading...</div>
                    ) : activity.length > 0 ? (
                        <div className="space-y-4">
                            {activity.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`w-2 h-2 rounded-full ${a.completed ? 'bg-emerald-500' : 'bg-blue-500'} mt-1.5 shrink-0`} />
                                    <div className="flex-1">
                                        <p className="text-[12px] text-white leading-snug">{a.description}</p>
                                        <span className="text-[10px] font-mono text-[#555]">{a.completedAt ? new Date(a.completedAt).toLocaleString() : 'Pending'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="font-mono text-[#555] text-sm">No activity yet</div>
                    )}
                    <button className="mt-6 text-[10px] font-mono text-[#888] border border-[#333] py-2 hover:bg-white hover:text-black transition-colors uppercase tracking-widest">
                        View Full Audit Log
                    </button>
                </div>

                {/* Deadlines */}
                <div className="bg-[#0A0A0A] border border-[#333] p-6 flex-1">
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-4">Upcoming Deadlines</h3>
                    {sidebarLoading ? (
                        <div className="font-mono text-[#555] text-sm">Loading...</div>
                    ) : deadlines.length > 0 ? (
                        <div className="space-y-5">
                            {deadlines.map((d) => (
                                <div key={d.id} className={`p-3 ${d.isCritical ? 'bg-red-500/5 border-l-2 border-red-500' : 'bg-blue-500/5 border-l-2 border-blue-500'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[12px] font-bold text-white uppercase tracking-tight">{d.name}</span>
                                        <span className={`text-[10px] font-mono ${d.isCritical ? 'text-red-500' : 'text-blue-400'}`}>{d.isCritical ? 'CRITICAL' : 'NORMAL'}</span>
                                    </div>
                                    <div className="text-[14px] font-mono-nums font-bold text-white tracking-widest">{d.countdown}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="font-mono text-[#555] text-sm">No upcoming deadlines</div>
                    )}
                </div>
            </div>
        </div>
    );
}
