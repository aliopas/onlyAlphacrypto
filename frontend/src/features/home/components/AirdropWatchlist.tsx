'use client';

import { useState, useEffect, useCallback } from 'react';
import { airdropApi } from '@/features/airdrop/api';
import { UrgentAirdrop } from '@/features/airdrop/types';
import { AlertTriangle, Clock, Zap, Radio } from 'lucide-react';

const POLL_INTERVAL = 60000;

type RiskColor = {
    text: string;
    bg: string;
    dot: string;
};

function getRiskColor(verdict: string | null): RiskColor {
    switch (verdict) {
        case 'SAFE':
        case 'LOW':
            return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' };
        case 'MEDIUM_RISK':
        case 'MEDIUM':
            return { text: 'text-yellow-400', bg: 'bg-yellow-400/10', dot: 'bg-yellow-400' };
        case 'HIGH_RISK':
        case 'HIGH':
            return { text: 'text-orange-400', bg: 'bg-orange-400/10', dot: 'bg-orange-400' };
        case 'SCAM':
            return { text: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500' };
        default:
            return { text: 'text-[#888]', bg: 'bg-[#888]/10', dot: 'bg-[#888]' };
    }
}

function formatCountdown(daysLeft: number | null, snapshotAt: string | null, tgeAt: string | null): string {
    if (daysLeft === null || (!snapshotAt && !tgeAt)) return '--';

    const deadline = snapshotAt ? new Date(snapshotAt) : tgeAt ? new Date(tgeAt) : null;
    if (!deadline) return '--';

    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return 'ENDED';

    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const h = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isDeadlinePassed(snapshotAt: string | null, tgeAt: string | null): boolean {
    const deadline = snapshotAt ? new Date(snapshotAt) : tgeAt ? new Date(tgeAt) : null;
    if (!deadline) return false;
    return deadline.getTime() < Date.now();
}

export function AirdropWatchlist() {
    const [airdrops, setAirdrops] = useState<UrgentAirdrop[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    const fetchData = useCallback(async () => {
        const data = await airdropApi.getUrgentAirdrops();
        setAirdrops(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        const poll = setInterval(fetchData, POLL_INTERVAL);
        return () => clearInterval(poll);
    }, [fetchData]);

    useEffect(() => {
        const ticker = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(ticker);
    }, []);

    const isCritical = (item: UrgentAirdrop): boolean =>
        item.daysLeft !== null && item.daysLeft <= 3 && !isDeadlinePassed(item.snapshotAt, item.tgeAt);

    const isEmpty = !loading && airdrops.length === 0;

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <Radio className="w-3 h-3 text-emerald-400" />
                <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">
                    Alpha Airdrop Radar
                </h3>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-5 h-5 border-2 border-[#333] border-t-emerald-400 rounded-full animate-spin" />
                    <span className="text-[10px] font-mono text-[#555]">Scanning for urgent drops...</span>
                </div>
            )}

            {isEmpty && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 flex-1">
                    <Zap className="w-8 h-8 text-[#333]" />
                    <span className="text-[10px] font-mono text-[#555] text-center leading-relaxed max-w-[200px]">
                        No urgent airdrops right now. Check back soon — new drops appear here when deadlines approach.
                    </span>
                </div>
            )}

            {!loading && airdrops.length > 0 && (
                <div className="flex flex-col gap-3 flex-1">
                    {airdrops.map((item) => {
                        const risk = getRiskColor(item.riskVerdict);
                        const critical = isCritical(item);
                        const passed = isDeadlinePassed(item.snapshotAt, item.tgeAt);
                        const countdown = formatCountdown(item.daysLeft, item.snapshotAt, item.tgeAt);

                        return (
                            <div
                                key={item.id}
                                className={`relative border rounded-sm p-3 transition-all ${
                                    critical
                                        ? 'border-red-500/40 bg-red-500/5'
                                        : passed
                                        ? 'border-[#222] bg-[#080808] opacity-50'
                                        : 'border-[#333] bg-[#0D0D0D]'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {critical && (
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                            </span>
                                        )}
                                        <span className="text-[11px] font-mono text-white truncate">
                                            {item.name}
                                        </span>
                                        {item.isNew && (
                                            <span className="text-[8px] font-mono font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 uppercase shrink-0">
                                                NEW
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                                        <span className={`text-[8px] font-mono ${risk.text}`}>
                                            {item.riskVerdict ?? '—'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-2.5 h-2.5 text-[#555]" />
                                        <span
                                            className={`text-[10px] font-mono-nums ${
                                                critical ? 'text-red-400 font-bold' : 'text-[#888]'
                                            }`}
                                        >
                                            {countdown}
                                        </span>
                                    </div>
                                    {item.estValue && (
                                        <span className="text-[9px] font-mono text-emerald-400/80">
                                            {item.estValue}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            critical ? 'bg-red-500' : 'bg-emerald-500/60'
                                        }`}
                                        style={{ width: `${Math.min(item.progressPercent, 100)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
