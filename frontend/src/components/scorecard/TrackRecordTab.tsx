'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/features/shared/api/client';

interface TacticalSignal {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    referencePrice: number;
    entryAt: string;
    unrealizedPnl: number | null;
    unrealizedDrift: number | null;
    currentPrice: number | null;
    stopLossPrice: number | null;
    riskZonePrice: number | null;
    takeProfitPrice: number | null;
    targetZonePrice: number | null;
}

interface StrategicStance {
    id: number;
    coinSymbol: string;
    marketPhase: string | null;
    bullRunProbability: number | null;
    recommendedAction: string | null;
    marketStance: string | null;
    updatedAt: string | null;
}

interface ClosedSignal {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    entryAt: string;
    exitPrice: number | null;
    realizedPnl: number | null;
    closedAt: string | null;
    autoClosedReason: string | null;
}

interface TrackRecordOverall {
    activePositions: number;
    activeScenarios: number;
    totalClosed: number;
    wins: number;
    winRate: number | null;
    outcomeRate: number | null;
    avgRealizedPnl: number | null;
    avgScenarioOutcome: number | null;
    bestTrade: ClosedSignal | null;
    bestOutcome: ClosedSignal | null;
}

interface TrackRecordData {
    tactical: TacticalSignal[];
    strategic: StrategicStance[];
    closed: ClosedSignal[];
    overall: TrackRecordOverall;
}

type LoadState = 'loading' | 'error' | 'ready';

function formatPrice(num: number | null): string {
    if (num === null || num === undefined) return '—';
    if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

function formatPct(val: number | null): string {
    if (val === null || val === undefined) return '—';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function verdictBadge(verdict: string): string {
    const v = verdict.toUpperCase();
    if (v === 'BULLISH' || v === 'BUY') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (v === 'BEARISH' || v === 'SELL') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    return 'bg-[#222] text-[#888]';
}

function verdictLabel(verdict: string): string {
    const v = verdict.toUpperCase();
    if (v === 'STRONG_BUY' || v === 'BUY') return 'BULLISH';
    if (v === 'STRONG_SELL' || v === 'SELL') return 'BEARISH';
    if (v === 'NEUTRAL') return 'NEUTRAL';
    return verdict;
}

function pnlColor(val: number | null): string {
    if (val === null || val === undefined) return 'text-[#888]';
    if (val > 0) return 'text-emerald-400';
    if (val < 0) return 'text-red-400';
    return 'text-[#888]';
}

function stanceColor(stance: string | null): string {
    if (!stance) return 'text-[#888]';
    const s = stance.toUpperCase();
    if (s.includes('BULL') || s === 'LONG') return 'text-emerald-400';
    if (s.includes('BEAR') || s === 'SHORT') return 'text-red-400';
    return 'text-yellow-400';
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function TrackRecordTab() {
    const [state, setState] = useState<LoadState>('loading');
    const [data, setData] = useState<TrackRecordData | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: payload } = await apiClient.get<TrackRecordData>('/market/scorecard');
                if (!cancelled) {
                    setData(payload);
                    setState('ready');
                }
            } catch {
                if (!cancelled) setState('error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (state === 'loading') {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4 animate-pulse">
                            <div className="h-3 bg-[#1A1A1A] rounded w-2/3 mb-2" />
                            <div className="h-5 bg-[#1A1A1A] rounded w-1/2" />
                        </div>
                    ))}
                </div>
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-8 text-center animate-pulse">
                    <div className="h-4 bg-[#1A1A1A] rounded w-1/3 mx-auto" />
                </div>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="bg-[#0A0A0A] border border-red-500/30 rounded-lg p-6 text-center">
                <span className="material-symbols-outlined text-red-400 text-2xl mb-2 block">error</span>
                <p className="text-sm text-red-400 mb-3">Failed to load track record data.</p>
                <button
                    onClick={() => {
                        setState('loading');
                        (async () => {
                            try {
                                const { data: payload } = await apiClient.get<TrackRecordData>('/market/scorecard');
                                setData(payload);
                                setState('ready');
                            } catch {
                                setState('error');
                            }
                        })();
                    }}
                    className="text-xs text-[#888] hover:text-white underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-6 text-center">
                <p className="text-sm text-[#666]">No track record data available.</p>
            </div>
        );
    }

    const { tactical, strategic, closed, overall } = data;
    const isEmpty = tactical.length === 0 && strategic.length === 0 && closed.length === 0;

    if (isEmpty) {
        return (
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-8 text-center">
                <span className="material-symbols-outlined text-[#444] text-3xl mb-2 block">query_stats</span>
                <p className="text-sm text-[#666]">No signals recorded yet. Track record will populate as signals are generated and closed.</p>
            </div>
        );
    }

    const bestTradePnl = overall.bestTrade?.realizedPnl ?? null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Active</div>
                    <div className="text-xl font-mono font-bold text-emerald-400">{overall.activePositions}</div>
                </div>
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Closed</div>
                    <div className="text-xl font-mono font-bold text-white">{overall.totalClosed}</div>
                </div>
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Win Rate</div>
                    <div className="text-xl font-mono font-bold text-white">
                        {overall.winRate !== null ? `${overall.winRate.toFixed(1)}%` : '—'}
                    </div>
                </div>
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Avg P&L</div>
                    <div className={`text-xl font-mono font-bold ${pnlColor(overall.avgRealizedPnl)}`}>
                        {formatPct(overall.avgRealizedPnl)}
                    </div>
                </div>
                <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                    <div className="text-xs text-[#666] mb-1">Best Trade</div>
                    <div className="text-sm font-mono font-bold text-white">
                        {overall.bestTrade ? overall.bestTrade.coinSymbol : '—'}
                        {bestTradePnl !== null && (
                            <span className={`ml-1 text-xs ${pnlColor(bestTradePnl)}`}>
                                {formatPct(bestTradePnl)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden">
                <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">crosshair</span>
                    <span>Tactical Signals</span>
                    <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">{tactical.length}</span>
                </div>
                {tactical.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[#666]">No active tactical signals.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-center px-4 py-3 font-medium">Verdict</th>
                                    <th className="text-right px-4 py-3 font-medium">Entry</th>
                                    <th className="text-right px-4 py-3 font-medium">Current</th>
                                    <th className="text-right px-4 py-3 font-medium">P&L%</th>
                                    <th className="text-right px-4 py-3 font-medium">TP</th>
                                    <th className="text-right px-4 py-3 font-medium">SL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tactical.map((sig, idx) => (
                                    <tr
                                        key={sig.id}
                                        className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'} hover:bg-[#161616] transition-colors`}
                                    >
                                        <td className="px-4 py-3 font-mono font-semibold text-white">{sig.coinSymbol}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${verdictBadge(sig.verdict)}`}>
                                                {verdictLabel(sig.verdict)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">{formatPrice(sig.entryPrice)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatPrice(sig.currentPrice)}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${pnlColor(sig.unrealizedPnl)}`}>
                                            {formatPct(sig.unrealizedPnl)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[#888]">{formatPrice(sig.takeProfitPrice)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-400/70">{formatPrice(sig.stopLossPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden">
                <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">timeline</span>
                    <span>Strategic Stances</span>
                    <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">{strategic.length}</span>
                </div>
                {strategic.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[#666]">No strategic stances recorded.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-left px-4 py-3 font-medium">Market Phase</th>
                                    <th className="text-right px-4 py-3 font-medium">Bull Prob</th>
                                    <th className="text-center px-4 py-3 font-medium">Stance</th>
                                    <th className="text-center px-4 py-3 font-medium">Action</th>
                                    <th className="text-right px-4 py-3 font-medium">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {strategic.map((s, idx) => (
                                    <tr
                                        key={s.id}
                                        className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'} hover:bg-[#161616] transition-colors`}
                                    >
                                        <td className="px-4 py-3 font-mono font-semibold text-white">{s.coinSymbol}</td>
                                        <td className="px-4 py-3 font-mono text-[#888]">{s.marketPhase ?? '—'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-yellow-400">
                                            {s.bullRunProbability !== null ? `${s.bullRunProbability.toFixed(0)}%` : '—'}
                                        </td>
                                        <td className={`px-4 py-3 text-center font-mono ${stanceColor(s.marketStance)}`}>
                                            {s.marketStance ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-[#888]">{s.recommendedAction ?? '—'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[#666]">{formatDate(s.updatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg overflow-hidden">
                <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">history</span>
                    <span>Closed Signals</span>
                    <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">{closed.length}</span>
                </div>
                {closed.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[#666]">No closed signals yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-center px-4 py-3 font-medium">Verdict</th>
                                    <th className="text-right px-4 py-3 font-medium">Entry</th>
                                    <th className="text-right px-4 py-3 font-medium">Exit</th>
                                    <th className="text-right px-4 py-3 font-medium">P&L%</th>
                                    <th className="text-left px-4 py-3 font-medium">Close Reason</th>
                                    <th className="text-right px-4 py-3 font-medium">Closed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closed.map((sig, idx) => (
                                    <tr
                                        key={sig.id}
                                        className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'} hover:bg-[#161616] transition-colors`}
                                    >
                                        <td className="px-4 py-3 font-mono font-semibold text-white">{sig.coinSymbol}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${verdictBadge(sig.verdict)}`}>
                                                {verdictLabel(sig.verdict)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">{formatPrice(sig.entryPrice)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatPrice(sig.exitPrice)}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${pnlColor(sig.realizedPnl)}`}>
                                            {formatPct(sig.realizedPnl)}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[#888]">{sig.autoClosedReason ?? '—'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[#666]">{formatDate(sig.closedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
