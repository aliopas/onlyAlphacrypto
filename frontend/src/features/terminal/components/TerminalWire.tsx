'use client';

import { useMemo } from 'react';
import { CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';

interface Props {
    news: CoinNews[];
    radarSignals?: RadarSignal[];
    targetedCoin?: string;
    activeTab: 'WIRE' | 'RADAR';
    setActiveTab: (tab: 'WIRE' | 'RADAR') => void;
    onSelectNews?: (newsId: number) => void;
    onSelectRadar?: (radarId: number) => void;
    selectedRadarId?: number | null;
    selectedNewsId?: number | null;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    hasSignals?: boolean;
    onLoadMoreWire?: () => void;
    hasMoreWire?: boolean;
    isLoadingMoreWire?: boolean;
}

export function TerminalWire({
    news,
    radarSignals = [],
    targetedCoin,
    activeTab,
    setActiveTab,
    onSelectNews,
    onSelectRadar,
    selectedRadarId,
    selectedNewsId,
    onLoadMore,
    hasMore = true,
    isLoadingMore = false,
    hasSignals = true,
    onLoadMoreWire,
    hasMoreWire,
    isLoadingMoreWire
}: Props) {
    const now = useMemo(() => Date.now(), []);

    if (!hasSignals) {
        return (
            <aside className="w-full h-full flex flex-col border border-[#333] bg-[#0A0A0A] overflow-hidden">
                <div className="h-11 flex items-center px-4 border-b border-[#333] bg-[#111]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white">Alpha Detection Stream</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-[#555] font-mono text-sm p-4 text-center">
                    No signals available. Signals will appear automatically when available.
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-full h-full flex flex-col border border-[#333] bg-[#0A0A0A] overflow-hidden">
            {/* Header */}
            <div className="h-11 flex items-center px-4 border-b border-[#333] bg-[#111]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-white">Alpha Detection Stream</span>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {radarSignals.length === 0 ? (
                    <div className="flex items-center justify-center p-4 h-full text-[#555] text-xs font-mono text-center">
                        No radar signals found for {targetedCoin ? `$${targetedCoin.toUpperCase()}` : 'this selection'}.
                    </div>
                ) : null}

                {radarSignals.map((item, i) => {
                    const isSelectedRadar = activeTab === 'RADAR' && selectedRadarId === item.id;
                    const isTargeted = !selectedRadarId && targetedCoin && item.coin?.toLowerCase() === targetedCoin.toLowerCase();
                    const timeStr = item.formattedTime || `${Math.floor((now - new Date(item.createdAt).getTime()) / 60000)}m ago`;



                    return (
                        <div key={`radar-${item.id || i}`}
                            className={`p-4 bg-black border cursor-pointer transition-all ${isSelectedRadar || isTargeted ? 'border-amber-500 bg-amber-500/5' : 'border-[#333] hover:border-[#555]'}`}
                            onClick={() => { onSelectRadar?.(item.id); setActiveTab('RADAR'); }}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-[10px] font-mono ${isSelectedRadar ? 'text-amber-500' : 'text-[#888]'}`}>{timeStr}</span>
                                {item.coin ? (
                                    <span className={`text-[10px] font-mono px-1 border text-amber-500 bg-amber-500/10 border-amber-500/30`}>
                                        ${item.coin}
                                    </span>
                                ) : null}
                            </div>
                            <h4 className="text-[13px] font-medium text-white leading-relaxed line-clamp-4">
                                {item.signal || item.signalText}
                            </h4>


                        </div>
                    );
                })}

                {/* Load More Button - Radar */}
                {activeTab === 'RADAR' && radarSignals.length > 0 && hasMore && (
                    <div className="pt-2 pb-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onLoadMore?.(); }}
                            disabled={isLoadingMore}
                            className="w-full py-3 bg-[#111] hover:bg-[#181818] border border-[#222] hover:border-[#333] text-[#888] hover:text-white text-[10px] font-mono uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                        >
                            {isLoadingMore ? 'Fetching...' : 'Show More +'}
                        </button>
                    </div>
                )}

                {/* Load More Button - Wire */}
                {activeTab === 'WIRE' && hasMoreWire && (
                    <div className="pt-2 pb-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onLoadMoreWire?.(); }}
                            disabled={isLoadingMoreWire}
                            className="w-full py-3 bg-[#111] hover:bg-[#181818] border border-[#222] hover:border-[#333] text-[#888] hover:text-white text-[10px] font-mono uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                        >
                            {isLoadingMoreWire ? 'Fetching...' : 'Load Wire News +'}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
