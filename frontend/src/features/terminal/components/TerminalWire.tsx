'use client';

import { useState, useEffect } from 'react';
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
}

export function TerminalWire({
    news,
    radarSignals = [],
    targetedCoin,
    activeTab,
    setActiveTab,
    onSelectNews,
    onSelectRadar
}: Props) {
    const [now, setNow] = useState<number | null>(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setNow(Date.now()); }, []);

    if (!now) return null;

    // Filter by coin if targetedCoin is provided, otherwise show all
    const filteredNews = targetedCoin
        ? news.filter(n => n.coin?.toLowerCase() === targetedCoin.toLowerCase())
        : news;

    const filteredRadar = targetedCoin
        ? radarSignals.filter(r => r.coin?.toLowerCase() === targetedCoin.toLowerCase())
        : radarSignals;

    // Sort descending by date
    filteredNews.sort((a, b) => new Date((b as any).publishedAt || b.createdAt).getTime() - new Date((a as any).publishedAt || a.createdAt).getTime());
    filteredRadar.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const isWire = activeTab === 'WIRE';
    const displayList = isWire ? filteredNews : filteredRadar;

    return (
        <aside className="w-full xl:w-[20%] border border-[#333] flex flex-col bg-[#0A0A0A] xl:min-w-[280px] h-[300px] xl:h-auto shrink-0">
            {/* Tabs Header */}
            <div className="h-11 flex border-b border-[#333]">
                <button
                    onClick={() => setActiveTab('WIRE')}
                    className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest border-r border-[#333] transition-colors ${isWire ? 'text-white bg-[#1A1A1A]' : 'text-[#888] hover:text-[#bbb] hover:bg-[#111]'
                        }`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${isWire ? 'bg-[#135bec]' : 'bg-[#555]'}`} />
                    Latest Wire
                </button>
                <button
                    onClick={() => setActiveTab('RADAR')}
                    className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${!isWire ? 'text-white bg-[#1A1A1A]' : 'text-[#888] hover:text-[#bbb] hover:bg-[#111]'
                        }`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${!isWire ? 'bg-amber-500' : 'bg-[#555]'}`} />
                    AI Radar
                </button>
            </div>
            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {displayList.length === 0 ? (
                    <div className="flex items-center justify-center p-4 h-full text-[#555] text-xs font-mono text-center">
                        No {isWire ? 'news' : 'radar signals'} found for {targetedCoin ? `$${targetedCoin.toUpperCase()}` : 'this selection'}.
                    </div>
                ) : null}

                {displayList.map((item: any, i: number) => {
                    const dateRaw = isWire ? (item.publishedAt || item.createdAt) : item.createdAt;
                    const dateObj = new Date(dateRaw.endsWith('Z') ? dateRaw : `${dateRaw}Z`);
                    const minsAgo = isNaN(dateObj.getTime()) ? 0 : Math.floor((now - dateObj.getTime()) / 60000);
                    const timeStr = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;

                    return (
                        <div key={`${isWire ? 'wire' : 'radar'}-${item.id || i}`}
                            className="p-4 bg-black border border-[#333] hover:border-[#555] cursor-pointer transition-all"
                            onClick={() => isWire ? onSelectNews?.(item.id) : onSelectRadar?.(item.id)}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-mono text-[#888]">{timeStr}</span>
                                {item.coin ? (
                                    <span className={`text-[10px] font-mono px-1 border ${!isWire ? 'text-amber-500 bg-amber-500/10 border-amber-500/30' : 'text-[#135bec] bg-[#135bec]/10 border-[#135bec]/30'}`}>
                                        ${item.coin}
                                    </span>
                                ) : null}
                            </div>
                            <h4 className="text-[13px] font-medium text-white leading-relaxed line-clamp-4">
                                {isWire ? item.headline : item.signal}
                            </h4>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
