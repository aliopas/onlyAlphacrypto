import type { Metadata } from 'next';
import { apiClient } from '@/features/shared/api/client';
import ScorecardPopupWrapper from './ScorecardPopupWrapper';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 360;

export const metadata: Metadata = {
    title: 'Market Intelligence Scorecard — OnlyAlpha',
    description: 'Data-driven market scenario tracking. Historical outcomes, reference prices, and pattern analysis for cryptocurrency markets.',
    keywords: ['crypto scorecard', 'market intelligence', 'crypto scenarios', 'trading signals', 'market regime', 'OnlyAlpha scorecard'],
    openGraph: {
        title: 'Market Intelligence Scorecard — OnlyAlpha',
        description: 'Data-driven market scenario tracking with historical outcomes and pattern analysis per coin.',
        url: `${SITE_URL}/scorecard`,
        siteName: 'OnlyAlpha',
        type: 'website',
        images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'Market Intelligence Scorecard — OnlyAlpha' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Market Intelligence Scorecard — OnlyAlpha',
        description: 'Data-driven market scenario tracking with historical outcomes and pattern analysis per coin.',
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
    referencePrice?: number;
    entryAt: string;
    unrealizedPnl: number | null;
    unrealizedDrift?: number | null;
    currentPrice: number | null;
    stopLossPrice: number | null;
    riskZonePrice?: number | null;
    takeProfitPrice: number | null;
    targetZonePrice?: number | null;
}

interface StrategicStance {
    id: number;
    coinSymbol: string;
    marketPhase: string | null;
    bullRunProbability: number | null;
    recommendedAction: string | null;
    marketStance?: string | null;
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
    activeScenarios?: number;
    totalClosed: number;
    wins: number;
    winRate: number | null;
    outcomeRate?: number | null;
    avgRealizedPnl: number | null;
    avgScenarioOutcome?: number | null;
    bestTrade: ClosedSignal | null;
    bestOutcome?: ClosedSignal | null;
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

function verdictLabel(verdict: string): string {
    const map: Record<string, string> = {
        STRONG_BUY: 'Strong Bullish',
        BUY: 'Bullish',
        SELL: 'Bearish',
        STRONG_SELL: 'Strong Bearish',
        NEUTRAL: 'Neutral',
    };
    return map[verdict] ?? verdict.replace('_', ' ');
}

function closeReasonLabel(reason: string | null): string {
    const map: Record<string, string> = {
        take_profit: 'Target Reached',
        stop_loss: 'Risk Zone Breached',
        time_expiry: 'Horizon Expired',
    };
    return map[reason ?? ''] ?? 'Thesis Reversed';
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

    const scorecardJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Market Intelligence Scorecard',
        description: 'Real-time market intelligence scorecard tracking crypto market health, sentiment, and regime.',
        url: `${SITE_URL}/scorecard`,
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Scorecard', item: `${SITE_URL}/scorecard` },
            ],
        },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            url: SITE_URL,
        },
    };

    if (!data || (data.overall.activePositions === 0 && data.overall.totalClosed === 0)) {
        return (
            <>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(scorecardJsonLd) }}
                />
                <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0A0A0A] border border-[#222] flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">leaderboard</span>
                    </div>
                    <h1 className="text-xl font-semibold text-white mb-3">No Scenarios Tracked Yet</h1>
                    <p className="text-sm text-[#666] leading-relaxed">
                        Check back after the first AI market scenario is published. The scorecard will populate automatically as scenarios are recorded and tracked over time.
                    </p>
                </div>
            </div>
            </>
        );
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(scorecardJsonLd) }}
            />
            <div className="min-h-screen bg-black text-white">
            <ScorecardPopupWrapper />
            <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Market Intelligence Scorecard</h1>
                    <p className="text-sm text-[#666] mt-1">Data-driven market scenario tracking with historical outcomes.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Active Scenarios</div>
                        <div className="text-2xl font-mono font-bold">{data.overall.activeScenarios ?? data.overall.activePositions}</div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Completed Scenarios</div>
                        <div className="text-2xl font-mono font-bold">{data.overall.totalClosed}</div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Outcome Rate</div>
                        <div className="text-2xl font-mono font-bold">
                            {(data.overall.outcomeRate ?? data.overall.winRate) !== null ? `${data.overall.outcomeRate ?? data.overall.winRate}%` : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Avg Scenario Outcome</div>
                        <div className={`text-2xl font-mono font-bold ${pnlClass(data.overall.avgScenarioOutcome ?? data.overall.avgRealizedPnl)}`}>
                            {(data.overall.avgScenarioOutcome ?? data.overall.avgRealizedPnl) !== null ? pnlFormat(data.overall.avgScenarioOutcome ?? data.overall.avgRealizedPnl) : '—'}
                        </div>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-4">
                        <div className="text-xs text-[#666] mb-1">Best Outcome</div>
                        <div className="text-lg font-mono font-bold">
                            {(() => {
                                const best = data.overall.bestOutcome ?? data.overall.bestTrade;
                                return best ? (
                                    <span className={pnlClass(best.realizedPnl)}>
                                        {best.coinSymbol} {pnlFormat(best.realizedPnl)}
                                    </span>
                                ) : '—';
                            })()}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Active Market Scenarios</h2>
                    <p className="text-xs text-[#666] mb-4">Short-term active scenarios (1-3 days). One scenario per coin.</p>
                    <div className="overflow-x-auto border border-[#222] rounded-lg">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                    <th className="text-left px-4 py-3 font-medium">Coin</th>
                                    <th className="text-left px-4 py-3 font-medium">Bias</th>
                                    <th className="text-right px-4 py-3 font-medium">Reference Price</th>
                                    <th className="text-right px-4 py-3 font-medium">Risk Zone</th>
                                    <th className="text-right px-4 py-3 font-medium">Target Zone</th>
                                    <th className="text-right px-4 py-3 font-medium">Current Price</th>
                                    <th className="text-right px-4 py-3 font-medium">Drift</th>
                                    <th className="text-right px-4 py-3 font-medium">Since</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tactical.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-[#666]">
                                            No active scenarios currently.
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
                                                    {verdictLabel(row.verdict)}
                                                </span>
                                            </td>
                                             <td className="px-4 py-3 text-right font-mono">{formatPrice(row.referencePrice ?? row.entryPrice)}</td>
                                             <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(row.riskZonePrice ?? row.stopLossPrice)}</td>
                                             <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(row.targetZonePrice ?? row.takeProfitPrice)}</td>
                                             <td className="px-4 py-3 text-right font-mono">{formatPrice(row.currentPrice)}</td>
                                             <td className={`px-4 py-3 text-right font-mono ${pnlClass(row.unrealizedDrift ?? row.unrealizedPnl)}`}>{pnlFormat(row.unrealizedDrift ?? row.unrealizedPnl)}</td>
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
                                        <th className="text-left px-4 py-3 font-medium">Market Stance</th>
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
                                             <td className="px-4 py-3 text-[#888]">{(row.marketStance ?? row.recommendedAction) || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {data.closed.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-4">Completed Scenarios</h2>
                        <p className="text-xs text-[#666] mb-4">Historical scenario performance with realized outcomes.</p>
                        <div className="overflow-x-auto border border-[#222] rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#111] text-[#666] text-xs uppercase tracking-wider">
                                        <th className="text-left px-4 py-3 font-medium">Coin</th>
                                        <th className="text-left px-4 py-3 font-medium">Bias</th>
                                        <th className="text-left px-4 py-3 font-medium">Ref → Exit</th>
                                        <th className="text-right px-4 py-3 font-medium">Outcome</th>
                                        <th className="text-right px-4 py-3 font-medium">Held</th>
                                        <th className="text-center px-4 py-3 font-medium">Reason</th>
                                        <th className="text-center px-4 py-3 font-medium">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {                                    data.closed.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            className={`border-t border-[#222] ${index % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'}`}
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold">{row.coinSymbol}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded font-mono ${verdictBadge(row.verdict)}`}>
                                                    {verdictLabel(row.verdict)}
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
                                Past performance does <span className="text-[#888]">not</span> guarantee future results. All market scenarios are <span className="text-[#888]">AI-generated</span> and should not be the sole basis for investment decisions. OnlyAlpha is <span className="text-[#888]">not</span> a registered financial advisor. Always <span className="text-[#888]">do your own research (DYOR)</span>. <span className="text-[#888]">NFA — Not Financial Advice.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </>
    );
}
