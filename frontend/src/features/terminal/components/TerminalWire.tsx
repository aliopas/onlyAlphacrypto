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
    onLoadMoreWire,
    hasMoreWire,
    isLoadingMoreWire
}: Props) {
    const now = useMemo(() => Date.now(), []);

    return (
        <aside className="w-full h-full flex flex-col border border-[#333] bg-[#0A0A0A] overflow-hidden">
            <div className="h-11 flex items-center px-4 border-b border-[#333] bg-[#111]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-white">Alpha Detection Stream</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {news.map((item, i) => {
                    const isSelected = activeTab === 'WIRE' && selectedNewsId === item.id;
                    const timeStr = item.formattedTime || `${Math.floor((now - new Date(item.createdAt).getTime()) / 60000)}m ago`;
                    const displayCoin = item.coin || item.coinSymbol;

                    return (
                        <div key={`news-${item.id || i}`}
                            className={`p-4 bg-black border cursor-pointer transition-all ${isSelected ? 'border-amber-500 bg-amber-500/5' : 'border-[#333] hover:border-[#555]'}`}
                            onClick={() => { onSelectNews?.(item.id); setActiveTab('WIRE'); }}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-[10px] font-mono ${isSelected ? 'text-amber-500' : 'text-[#888]'}`}>{timeStr}</span>
                                {displayCoin ? (
                                    <span className="text-[10px] font-mono px-1 border text-[#888] bg-[#111] border-[#333]">
                                        ${displayCoin.toUpperCase()}
                                    </span>
                                ) : null}
                            </div>
                            <h4 className="text-[13px] font-medium text-white leading-relaxed line-clamp-4">
                                {item.headline}
                            </h4>
                            {item.sentiment ? (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                        item.sentiment === 'bullish' ? 'bg-emerald-500/10 text-emerald-400' :
                                        item.sentiment === 'bearish' ? 'bg-red-500/10 text-red-400' :
                                        'bg-[#222] text-[#888]'
                                    }`}>
                                        {item.sentiment.toUpperCase()}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    );
                })}

                {news.length > 0 && radarSignals.length > 0 && (
                    <div className="flex items-center gap-2 py-2">
                        <div className="flex-1 h-px bg-[#333]" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#555]">Signals</span>
                        <div className="flex-1 h-px bg-[#333]" />
                    </div>
                )}

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
                                    <span className="text-[10px] font-mono px-1 border text-amber-500 bg-amber-500/10 border-amber-500/30">
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

                {news.length === 0 && radarSignals.length === 0 && (
                    <div className="flex items-center justify-center p-4 h-full text-[#555] text-xs font-mono text-center">
                        No data available yet. Content will appear automatically.
                    </div>
                )}

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
            </div>
        </aside>
    );
}
