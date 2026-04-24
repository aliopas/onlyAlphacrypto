'use client';

import { useEffect, useState, useCallback } from 'react';
import { airdropApi, AirdropStats, AirdropActivity, AirdropDeadline } from '@/features/airdrop/api';
import { AirdropProject } from '@/features/airdrop/types';
import Link from 'next/link';
import { TrendingUp, X, AlertTriangle, DollarSign } from 'lucide-react';
import { FarmingStreak } from '@/features/airdrop/components/FarmingStreak';

type CardState = 'CRITICAL_DEADLINE' | 'NEEDS_ATTENTION' | 'NEWLY_DISCOVERED' | 'ON_TRACK';

interface CardMeta {
    state: CardState;
    borderClass: string;
    bgClass: string;
    badge: React.ReactNode;
    progressColor: string;
    shadowClass: string;
}

const NETWORK_CHIP: Record<string, { text: string; bg: string }> = {
    Mainnet: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    Testnet: { text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    L2: { text: 'text-blue-400', bg: 'bg-blue-400/10' },
};

const STATUS_COLOR: Record<string, { text: string; bg: string; border: string }> = {
    SAFE: { text: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/30' },
    MEDIUM: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
    MEDIUM_RISK: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
    HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/5', border: 'border-orange-500/30' },
    HIGH_RISK: { text: 'text-orange-500', bg: 'bg-orange-500/5', border: 'border-orange-500/30' },
    SCAM: { text: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/30' },
    TESTNET: { text: 'text-yellow-500', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30' },
};

function daysBetween(now: Date, target: Date): number {
    return Math.max(0, Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function resolveCardState(p: AirdropProject, progressPercent: number): CardMeta {
    const now = new Date();
    const tgeDate = p.tgeAt ? new Date(p.tgeAt) : null;
    const snapshotDate = p.snapshotAt ? new Date(p.snapshotAt) : null;
    const createdDate = new Date(p.createdAt);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const deadlineDate = tgeDate || snapshotDate;
    const daysToDeadline = deadlineDate ? daysBetween(now, deadlineDate) : null;

    const isCritical = daysToDeadline !== null && daysToDeadline <= 3 && deadlineDate && deadlineDate > now;
    const isNew = createdDate >= fortyEightHoursAgo;
    const needsAttention = daysToDeadline !== null && daysToDeadline <= 14 && progressPercent < 30;
    const isOnTrack = progressPercent > 50;

    if (isCritical) {
        return {
            state: 'CRITICAL_DEADLINE',
            borderClass: 'border-red-500/60',
            bgClass: 'bg-red-500/5',
            badge: (
                <span className="flex items-center gap-1 text-[8px] font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 uppercase">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    CRITICAL
                </span>
            ),
            progressColor: 'bg-red-500',
            shadowClass: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
        };
    }

    if (needsAttention) {
        return {
            state: 'NEEDS_ATTENTION',
            borderClass: 'border-amber-500/50',
            bgClass: 'bg-amber-500/5',
            badge: (
                <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 uppercase">
                    ⚠ NEEDS ATTENTION
                </span>
            ),
            progressColor: 'bg-amber-500',
            shadowClass: '',
        };
    }

    if (isNew) {
        return {
            state: 'NEWLY_DISCOVERED',
            borderClass: 'border-blue-500/40',
            bgClass: 'bg-blue-500/5',
            badge: (
                <span className="text-[8px] font-mono font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 uppercase">
                    NEW
                </span>
            ),
            progressColor: 'bg-blue-500',
            shadowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.1)]',
        };
    }

    return {
        state: 'ON_TRACK',
        borderClass: isOnTrack ? 'border-emerald-500/30' : 'border-[#333]',
        bgClass: isOnTrack ? 'bg-emerald-500/5' : 'bg-[#0A0A0A]',
        badge: isOnTrack ? (
            <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 uppercase">
                ✓ ON TRACK
            </span>
        ) : null,
        progressColor: isOnTrack ? 'bg-emerald-500' : 'bg-blue-500',
        shadowClass: '',
    };
}

function formatRelativeTime(dateStr: string): string | null {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (absDiffDays > 7) return null;
    if (absDiffDays === 0) return 'Today';
    if (absDiffDays === 1) return diffMs > 0 ? 'Tomorrow' : 'Yesterday';
    return diffMs > 0 ? `In ${absDiffDays} days` : `${absDiffDays} days ago`;
}

function formatEstValue(value: string | undefined): string {
    if (!value) return 'TBD';
    const trimmed = value.trim();
    if (trimmed.toUpperCase() === 'TBD' || trimmed === '') return 'TBD';
    if (/^\$/.test(trimmed)) return trimmed + '+';
    return '$' + trimmed + '+';
}

function GridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#0A0A0A] border border-[#222] p-6 animate-pulse">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="h-5 w-32 bg-[#1A1A1A] rounded mb-2" />
                            <div className="flex gap-2">
                                <div className="h-4 w-16 bg-[#1A1A1A] rounded" />
                                <div className="h-4 w-12 bg-[#1A1A1A] rounded" />
                            </div>
                        </div>
                        <div className="h-5 w-16 bg-[#1A1A1A] rounded" />
                    </div>
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="h-3 w-24 bg-[#1A1A1A] rounded" />
                            <div className="h-3 w-8 bg-[#1A1A1A] rounded" />
                        </div>
                        <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-40 bg-[#1A1A1A] rounded" />
                        <div className="h-3 w-28 bg-[#1A1A1A] rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function AirdropsPageClient({ initialProjects, initialError }: { initialProjects: AirdropProject[]; initialError?: boolean }) {
    const [projects, setProjects] = useState<AirdropProject[]>(initialProjects);
    const [stats, setStats] = useState<AirdropStats | null>(null);
    const [activity, setActivity] = useState<AirdropActivity[]>([]);
    const [deadlines, setDeadlines] = useState<AirdropDeadline[]>([]);
    const [sidebarLoading, setSidebarLoading] = useState(true);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [fetchError] = useState(initialError ?? false);
    const [gridLoading, setGridLoading] = useState(true);
    const [pipelineStatus, setPipelineStatus] = useState<{ lastScan: string | null; nextScan: string | null; sources: number } | null>(null);

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
        loadSidebarData();
    }, [loadSidebarData]);

    useEffect(() => {
        if (initialProjects.length >= 0) setGridLoading(false);
    }, [initialProjects]);

    useEffect(() => {
        airdropApi.getPipelineStatus().then(setPipelineStatus);
    }, []);

    useEffect(() => {
        try {
            const dismissed = sessionStorage.getItem('airdrop:banner_dismissed');
            if (dismissed === 'true') setBannerDismissed(true);
        } catch {}
    }, []);

    const activeProjects = projects.length;
    const completedProjects = projects.filter(
        (p) => (p.progressPercent ?? 0) >= 100
    ).length;
    const totalValue = stats?.totalValue ?? 0;

    const mostUrgent = deadlines.length > 0
        ? deadlines.reduce((prev, curr) =>
            prev.daysLeft <= curr.daysLeft ? prev : curr
          )
        : null;

    const showBanner = !bannerDismissed && mostUrgent && mostUrgent.isCritical;

    const dismissBanner = () => {
        setBannerDismissed(true);
        try {
            sessionStorage.setItem('airdrop:banner_dismissed', 'true');
        } catch {}
    };

    return (
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-6 h-full">
            <div className="w-full lg:w-[70%] flex flex-col gap-6">

                <div className="bg-gradient-to-r from-[#0D0D0D] to-[#0A0A0A] border border-[#333] p-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                            <span className="text-[9px] font-mono text-[#555] uppercase block">Total Unrealized Value</span>
                            <span className="text-2xl font-mono-nums font-bold text-white tracking-tight">
                                {totalValue > 0
                                    ? `$${totalValue.toLocaleString()}+`
                                    : '$0'}
                            </span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[#333] hidden md:block" />

                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                            <span className="text-[9px] font-mono text-[#555] uppercase block">Active Projects</span>
                            <span className="text-lg font-mono-nums font-bold text-white">{activeProjects}</span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[#333] hidden md:block" />

                    <div>
                        <span className="text-[9px] font-mono text-[#555] uppercase block">Completed</span>
                        <span className="text-lg font-mono-nums font-bold text-emerald-400">{completedProjects}</span>
                    </div>

                    {totalValue === 0 && !sidebarLoading && (
                        <div className="text-[10px] font-mono text-[#555] md:ml-auto">
                            Start farming to unlock potential value
                        </div>
                    )}
                </div>

                {showBanner && (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3 relative">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <div className="flex-1">
                            <span className="text-[10px] font-mono font-bold text-red-400 uppercase">
                                {mostUrgent.name}
                            </span>
                            <span className="text-[10px] font-mono text-red-300/70 ml-2">
                                — {mostUrgent.countdown} remaining
                            </span>
                        </div>
                        <button
                            onClick={dismissBanner}
                            className="shrink-0 p-1 hover:bg-red-500/20 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                    </div>
                )}

                {pipelineStatus && (
                    <div className="flex items-center gap-4 text-[9px] font-mono text-[#444] uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Pipeline Active
                        </span>
                        <span>
                            Last scan: {pipelineStatus.lastScan ? formatRelativeTime(pipelineStatus.lastScan) : 'N/A'}
                        </span>
                        <span>
                            Next scan: {pipelineStatus.nextScan ? formatRelativeTime(pipelineStatus.nextScan) : '~6h'}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 inline-block" /> Active Farm Grid
                    </h2>
                    <div className="flex gap-4">
                        <span className="text-[10px] font-mono text-[#555] uppercase">Total Active: <span className="text-white font-mono-nums">{projects.length}</span></span>
                    </div>
                </div>

                {gridLoading && <GridSkeleton />}

                {!gridLoading && fetchError && (
                    <div className="bg-red-500/5 border border-red-500/20 p-8 flex flex-col items-center justify-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-400/60" />
                        <p className="text-[12px] font-mono text-red-300/80">Unable to load airdrops. Please try again later.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[10px] font-mono text-red-400 border border-red-500/30 px-4 py-1.5 hover:bg-red-500/10 transition-colors uppercase tracking-widest"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!gridLoading && !fetchError && projects.length === 0 && (
                    <div className="bg-[#0A0A0A] border border-[#222] p-10 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <TrendingUp className="w-7 h-7 text-blue-400/60" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-[14px] font-bold text-white uppercase tracking-tight mb-2">No Active Airdrops Tracked</h3>
                            <p className="text-[11px] font-mono text-[#555] max-w-md leading-relaxed">
                                Our AI pipeline scans for new airdrop opportunities every 6 hours. New verified projects will appear here automatically.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-mono text-[#444] uppercase tracking-wider">Pipeline Active — Scanning Sources</span>
                        </div>
                    </div>
                )}

                {!gridLoading && !fetchError && projects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projects.map((p) => {
                        const verdict = p.riskVerdict || 'SAFE';
                        const c = STATUS_COLOR[verdict] || STATUS_COLOR.SAFE;
                        const progressPct = p.progressPercent ?? 0;
                        const meta = resolveCardState(p, progressPct);
                        const networkChip = NETWORK_CHIP[p.network] ?? { text: 'text-[#888]', bg: 'bg-[#888]/10' };
                        const snapshotRelative = p.snapshotAt ? formatRelativeTime(p.snapshotAt) : null;

                        return (
                            <Link key={p.id} href={`/airdrops/${p.id}`}
                                className={`bg-[#0A0A0A] border p-6 hover:border-[#444] transition-all group block ${meta.borderClass} ${meta.bgClass} ${meta.shadowClass}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold tracking-tight uppercase text-white">{p.name}</h3>
                                            {meta.badge}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-mono px-2 py-0.5 border ${c.border} ${c.text} ${c.bg} tracking-wider uppercase`}>
                                                {verdict}
                                            </span>
                                            <span className={`text-[8px] font-mono px-1.5 py-0.5 ${networkChip.text} ${networkChip.bg}`}>
                                                {p.network}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-mono text-[#555] block">EST. VALUE</span>
                                        <span className="text-lg font-mono-nums font-bold text-white">{formatEstValue(p.estValue)}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-mono text-[#888] uppercase tracking-wider">Farming Progress</span>
                                        <span className="text-[10px] font-mono-nums text-white">{progressPct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${meta.progressColor}`}
                                            style={{ width: `${Math.min(progressPct, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-mono text-[#555] uppercase tracking-[0.1em] border-b border-[#222] pb-1">
                                        Network: {p.network}
                                    </h4>
                                    {p.snapshotAt && (
                                        <p className="text-[11px] font-mono text-[#555]">
                                            Snapshot:{' '}
                                            <span className="text-[#888]">
                                                {snapshotRelative ?? new Date(p.snapshotAt).toLocaleDateString()}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
                )}
            </div>

            <div className="w-full lg:w-[30%] flex flex-col gap-6">
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

                <FarmingStreak
                    streakDays={0}
                    completedProjects={completedProjects}
                    totalProjects={activeProjects}
                />

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
