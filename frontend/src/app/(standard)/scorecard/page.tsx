import type { Metadata } from 'next';
import { apiClient } from '@/features/shared/api/client';

export const revalidate = 360;

const SITE_URL = 'https://onlyalphacrypto.com';

export const metadata: Metadata = {
    title: 'Signal Scorecard — Track Record',
    description: 'Transparent performance tracking of every AI signal OnlyAlpha publishes. Win rate, average return, and per-coin breakdown.',
    openGraph: {
        title: 'Signal Scorecard — OnlyAlpha',
        description: 'Track the profit and loss performance of every AI signal. Transparent track record per coin.',
        url: `${SITE_URL}/scorecard`,
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Signal Scorecard — OnlyAlpha',
        description: 'Track the profit and loss performance of every AI signal. Transparent track record per coin.',
    },
    alternates: {
        canonical: `${SITE_URL}/scorecard`,
    },
};

interface TacticalSignal {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    entryAt: string;
    unrealizedPnl: number | null;
    currentPrice: number | null;
    stopLossPrice: number | null;
    takeProfitPrice: number | null;
}

interface StrategicStance {
    id: number;
    coinSymbol: string;
    marketPhase: string | null;
    bullRunProbability: number | null;
    recommendedAction: string | null;
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

interface OverallStats {
    activePositions: number;
    totalClosed: number;
    wins: number;
    winRate: number | null;
    avgRealizedPnl: number | null;
    bestTrade: ClosedSignal | null;
}

interface ScorecardData {
    tactical: TacticalSignal[];
    strategic: StrategicStance[];
    closed: ClosedSignal[];
    overall: OverallStats;
}

function pnlClass(value: number | null): string {
    if (value === null) return 'text-[#555]';
    if (value > 0) return 'text-emerald-500';
    if (value < 0) return 'text-red-500';
    return 'text-[#555]';
}

function pnlFormat(value: number | null): string {
    if (value === null) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

function verdictBadge(verdict: string): string {
    const map: Record<string, string> = {
        STRONG_BUY: 'bg-emerald-500/20 text-emerald-400',
        BUY: 'bg-emerald-500/10 text-emerald-400',
        SELL: 'bg-red-500/10 text-red-400',
        STRONG_SELL: 'bg-red-500/20 text-red-400',
        NEUTRAL: 'bg-[#222] text-[#888]',
    };
    return map[verdict] ?? 'bg-[#222] text-[#888]';
}

function closeReasonBadge(reason: string | null): string {
    const map: Record<string, string> = {
        take_profit: 'bg-emerald-500/20 text-emerald-400',
        stop_loss: 'bg-red-500/20 text-red-400',
        time_expiry: 'bg-[#222] text-[#888]',
    };
    return map[reason ?? ''] ?? 'bg-[#222] text-[#888]';
}

function closeReasonLabel(reason: string | null): string {
    const map: Record<string, string> = {
        take_profit: 'TP Hit',
        stop_loss: 'SL Hit',
        time_expiry: 'Expired',
    };
    return map[reason ?? ''] ?? 'Reversed';
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatPrice(price: number | null): string {
    if (price === null) return '—';
    if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function wyckoffColor(phase: string | null): string {
    if (!phase) return 'text-[#555]';
    const green = new Set(['Accumulation', 'Markup']);
    const red = new Set(['Distribution', 'Markdown']);
    if (green.has(phase)) return 'text-emerald-400';
    if (red.has(phase)) return 'text-red-400';
    return 'text-[#555]';
}

function durationBetween(start: string, end: string | null): string {
    if (!end) return '—';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d`;
    return `${diffHours}h`;
}

export default async function ScorecardPage() {
    let data: ScorecardData | null = null;

    try {
        const { data: responseData } = await apiClient.get<ScorecardData>('/market/scorecard');
        data = responseData;
    } catch {
        data = null;
    }

    if (!data || (data.overall.activePositions === 0 && data.overall.totalClosed === 0)) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0A0A0A] border border-[#222] flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">leaderboard</span>
                    </div>
                    <h1 className="text-xl font-semibold text-white mb-3">No Signals Tracked Yet</h1>
                    <p className="text-sm text-[#666] leading-relaxed">
                        Check back after the first AI signal is published. The scorecard will populate automatically as signals are recorded and tracked over time.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Signal Scorecard</h1>
                    <p className="text-sm text-[#666] mt-1">Transparent performance tracking of every AI signal.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Active Positions</div>
                        <div className="text-2xl font-mono font-bold">{data.overall.activePositions}</div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Closed Signals</div>
                        <div className="text-2xl font-mono font-bold">{data.overall.totalClosed}</div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Win Rate</div>
                        <div className="text-2xl font-mono font-bold">
                            {data.overall.winRate !== null ? `${data.overall.winRate}%` : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Avg P&L</div>
                        <div className={`text-2xl font-mono font-bold ${pnlClass(data.overall.avgRealizedPnl)}`}>
                            {data.overall.avgRealizedPnl !== null ? pnlFormat(data.overall.avgRealizedPnl) : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Best Trade</div>
                        <div className="text-lg font-mono font-bold">
                            {data.overall.bestTrade ? (
                                <span className={pnlClass(data.overall.bestTrade.realizedPnl)}>
                                    {data.overall.bestTrade.coinSymbol} {pnlFormat(data.overall.bestTrade.realizedPnl)}
                                </span>
                            ) : '—'}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Tactical Signals</h2>
                    <p className="text-xs text-[#666] mb-4">Short-term active positions (1-3 days). One signal per coin.</p>
                    <div className="overflow-x-auto border border-[#222] rounded-lg">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-left px-4 py-3 font-medium">Signal</th>
                                    <th className="text-right px-4 py-3 font-medium">Entry $</th>
                                    <th className="text-right px-4 py-3 font-medium">SL</th>
                                    <th className="text-right px-4 py-3 font-medium">TP</th>
                                    <th className="text-right px-4 py-3 font-medium">Current $</th>
                                    <th className="text-right px-4 py-3 font-medium">Unrealized</th>
                                    <th className="text-right px-4 py-3 font-medium">Since</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tactical.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-[#666]">
                                            No active signals currently.
                                        </td>
                                    </tr>
                                ) : (
                                    data.tactical.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            className={`border-t border-[#222] ${index % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'}`}
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold">{row.coinSymbol}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded font-mono ${verdictBadge(row.verdict)}`}>
                                                    {row.verdict.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">{formatPrice(row.entryPrice)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(row.stopLossPrice)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(row.takeProfitPrice)}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatPrice(row.currentPrice)}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.unrealizedPnl)}`}>{pnlFormat(row.unrealizedPnl)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[#888]">{timeAgo(row.entryAt)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {data.strategic.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-4">Strategic Stance</h2>
                        <p className="text-xs text-[#666] mb-4">Long-term outlook (weeks/months). From AI structural analysis.</p>
                        <div className="overflow-x-auto border border-[#222] rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                        <th className="text-left px-4 py-3 font-medium">Coin</th>
                                        <th className="text-left px-4 py-3 font-medium">Wyckoff Phase</th>
                                        <th className="text-left px-4 py-3 font-medium">Bull Probability</th>
                                        <th className="text-left px-4 py-3 font-medium">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.strategic.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            className={`border-t border-[#222] ${index % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'}`}
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold">{row.coinSymbol}</td>
                                            <td className="px-4 py-3">
                                                <span className={`font-mono ${wyckoffColor(row.marketPhase)}`}>
                                                    {row.marketPhase || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {row.bullRunProbability !== null ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-12 h-1.5 bg-[#333] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-emerald-400 rounded-full"
                                                                style={{ width: `${row.bullRunProbability}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-mono text-xs">{row.bullRunProbability}%</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-[#888]">{row.recommendedAction || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {data.closed.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-4">Closed Signals</h2>
                        <p className="text-xs text-[#666] mb-4">Historical signal performance with realized P&L.</p>
                        <div className="overflow-x-auto border border-[#222] rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                        <th className="text-left px-4 py-3 font-medium">Coin</th>
                                        <th className="text-left px-4 py-3 font-medium">Signal</th>
                                        <th className="text-left px-4 py-3 font-medium">Entry → Exit</th>
                                        <th className="text-right px-4 py-3 font-medium">P&L</th>
                                        <th className="text-right px-4 py-3 font-medium">Held</th>
                                        <th className="text-center px-4 py-3 font-medium">Reason</th>
                                        <th className="text-center px-4 py-3 font-medium">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.closed.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            className={`border-t border-[#222] ${index % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'}`}
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold">{row.coinSymbol}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded font-mono ${verdictBadge(row.verdict)}`}>
                                                    {row.verdict.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[#888]">
                                                {formatPrice(row.entryPrice)} → {row.exitPrice ? formatPrice(row.exitPrice) : '—'}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.realizedPnl)}`}>{pnlFormat(row.realizedPnl)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-[#888]">{durationBetween(row.entryAt, row.closedAt)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs px-2 py-0.5 rounded font-mono ${closeReasonBadge(row.autoClosedReason)}`}>
                                                    {closeReasonLabel(row.autoClosedReason)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {row.realizedPnl !== null && row.realizedPnl > 0 ? '✅' : '❌'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="mt-12 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#444] text-base mt-0.5 shrink-0">shield</span>
                        <div>
                            <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#555] mb-2">Disclaimer</h4>
                            <p className="text-[11px] text-[#555] leading-relaxed">
                                Past performance does <span className="text-[#888]">not</span> guarantee future results. All signals are <span className="text-[#888]">AI-generated</span> and should not be the sole basis for investment decisions. OnlyAlpha is <span className="text-[#888]">not</span> a registered financial advisor. Always <span className="text-[#888]">do your own research (DYOR)</span>. <span className="text-[#888]">NFA — Not Financial Advice.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
