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

interface SignalRow {
    id: number;
    coinSymbol: string;
    verdict: string;
    sentiment: string | null;
    entryPrice: number;
    entryAt: string;
    price24h: number | null;
    price7d: number | null;
    price30d: number | null;
    pnl24h: number | null;
    pnl7d: number | null;
    pnl30d: number | null;
    isWin7d: boolean | null;
    isWin30d: boolean | null;
    createdAt: string;
}

interface ScorecardData {
    overall: {
        totalSignals: number;
        winRate7d: number | null;
        avgReturn7d: number | null;
        bestCall: SignalRow | null;
    };
    recent: SignalRow[];
    perCoin: Record<string, { signals: number; wins: number; totalPnl: number }>;
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

export default async function ScorecardPage() {
    let data: ScorecardData | null = null;

    try {
        const { data: responseData } = await apiClient.get<ScorecardData>('/market/scorecard');
        data = responseData;
    } catch {
        data = null;
    }

    if (!data || data.overall.totalSignals === 0) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0A0A0A] border border-[#222] flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">leaderboard</span>
                    </div>
                    <h1 className="text-xl font-semibold text-white mb-3">No Signals Tracked Yet</h1>
                    <p className="text-sm text-[#666] leading-relaxed">
                        Check back after the first AI signal is published. The scorecard will populate automatically as signals are recorded and tracked over 24h, 7d, and 30d windows.
                    </p>
                </div>
            </div>
        );
    }

    const { overall, recent, perCoin } = data;

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Signal Scorecard</h1>
                    <p className="text-sm text-[#666] mt-1">Transparent performance tracking of every AI signal.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Total Signals</div>
                        <div className="text-2xl font-mono font-bold">{overall.totalSignals}</div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Win Rate (7d)</div>
                        <div className="text-2xl font-mono font-bold">
                            {overall.winRate7d !== null ? `${overall.winRate7d}%` : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Avg Return (7d)</div>
                        <div className={`text-2xl font-mono font-bold ${pnlClass(overall.avgReturn7d)}`}>
                            {overall.avgReturn7d !== null ? pnlFormat(overall.avgReturn7d) : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Best Call</div>
                        <div className="text-lg font-mono font-bold">
                            {overall.bestCall ? (
                                <span className={pnlClass(overall.bestCall.pnl7d)}>
                                    {overall.bestCall.coinSymbol} {pnlFormat(overall.bestCall.pnl7d)}
                                </span>
                            ) : '—'}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Recent Signals</h2>
                    <div className="overflow-x-auto border border-[#222] rounded-lg">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-left px-4 py-3 font-medium">Verdict</th>
                                    <th className="text-right px-4 py-3 font-medium">Entry $</th>
                                    <th className="text-right px-4 py-3 font-medium">24h</th>
                                    <th className="text-right px-4 py-3 font-medium">7d</th>
                                    <th className="text-right px-4 py-3 font-medium">30d</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map((row, index) => (
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
                                        <td className="px-4 py-3 text-right font-mono">${row.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.pnl24h)}`}>{pnlFormat(row.pnl24h)}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.pnl7d)}`}>{pnlFormat(row.pnl7d)}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.pnl30d)}`}>{pnlFormat(row.pnl30d)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {Object.keys(perCoin).length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-4">Per-Coin Breakdown</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(perCoin).map(([symbol, stats]) => {
                                const coinWinRate = stats.signals > 0 ? Math.round((stats.wins / stats.signals) * 100) : 0;
                                const coinAvgReturn = stats.signals > 0 ? stats.totalPnl / stats.signals : 0;
                                return (
                                    <div key={symbol} className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                                        <div className="font-mono font-bold text-lg mb-2">{symbol}</div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <div className="text-[#666]">Signals</div>
                                                <div className="font-mono">{stats.signals}</div>
                                            </div>
                                            <div>
                                                <div className="text-[#666]">Win Rate</div>
                                                <div className="font-mono">{coinWinRate}%</div>
                                            </div>
                                            <div>
                                                <div className="text-[#666]">Avg P&L</div>
                                                <div className={`font-mono ${pnlClass(coinAvgReturn)}`}>{pnlFormat(coinAvgReturn)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mt-12 pt-6 border-t border-[#222] text-center">
                    <p className="text-xs text-[#555] max-w-lg mx-auto leading-relaxed">
                        Past performance does not guarantee future results. Not financial advice. Signals are generated by AI analysis and should not be the sole basis for investment decisions. Always do your own research (DYOR).
                    </p>
                </div>
            </div>
        </div>
    );
}
