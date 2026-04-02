'use client';

import { useState } from 'react';
import { RadarSignal } from '@/features/home/types';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/features/shared/api/client';

interface Props {
    signals: RadarSignal[];
}

const SIGNAL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    bullish: { text: 'text-[#135bec]', bg: 'bg-[#135bec]/10', border: 'border-[#135bec]/30' },
    bearish: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
    neutral: { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
    volatile: { text: 'text-blue-300', bg: 'bg-blue-300/10', border: 'border-blue-300/30' },
};

const SIGNAL_DOT: Record<string, string> = {
    bullish: 'bg-emerald-500',
    bearish: 'bg-red-500',
    neutral: 'bg-yellow-500',
    volatile: 'bg-yellow-500',
};

export function RadarGrid({ signals: initialSignals }: Props) {
    const router = useRouter();
    const [signals, setSignals] = useState<RadarSignal[]>(initialSignals);
    const [offset, setOffset] = useState(initialSignals.length);
    const [hasMore, setHasMore] = useState(initialSignals.length >= 6);
    const [isLoading, setIsLoading] = useState(false);

    const handleLoadMore = async () => {
        if (isLoading || !hasMore) return;
        setIsLoading(true);
        try {
            const { data } = await apiClient.get<RadarSignal[]>(`/market/radar?offset=${offset}&limit=6`);
            if (Array.isArray(data)) {
                if (data.length < 6) setHasMore(false);
                if (data.length > 0) {
                    setSignals(prev => [...prev, ...data]);
                    setOffset(prev => prev + data.length);
                }
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to load more signals:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" /> Live AI Radar
                </h3>
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-tighter">
                    Scanning <span className="font-mono-nums">2,482</span> Assets
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {signals.length === 0 && (
                    <div className="col-span-full bg-[#0A0A0A] border border-[#333] p-12 text-center">
                        <p className="text-[#555] font-mono text-[12px] uppercase tracking-widest">No signals yet. Engine processing…</p>
                    </div>
                )}
                {signals.map((s, i) => {
                    const sentiment = s.sentiment?.toLowerCase() || 'neutral';
                    const c = SIGNAL_COLORS[sentiment] || SIGNAL_COLORS.neutral;
                    const dot = SIGNAL_DOT[sentiment] || 'bg-yellow-500';
                    return (
                        <div
                            key={`radar-${s.id}-${i}`}
                            onClick={() => router.push(`/terminal/${s.coin || ''}?radarId=${s.id}`)}
                            className="bg-[#0A0A0A] border border-[#333] p-5 hover:border-[#555] transition-all cursor-pointer flex flex-col justify-between h-[160px] group"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] font-mono ${c.text} ${c.bg} border ${c.border} px-2 py-0.5`}>
                                        ${s.coin}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${dot} shadow-[0_0_8px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform`} />
                                </div>
                                <h4 className="text-[13px] font-medium text-white leading-snug line-clamp-3 group-hover:text-[#135bec] transition-colors" title={s.signal}>{s.signal}</h4>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <span className={`text-[10px] font-mono uppercase ${c.text}`}>{s.sentiment}</span>
                                <span className="text-[10px] font-mono-nums text-[#555]">
                                    {s.formattedTime || (s.createdAt ? new Date(s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Now')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasMore && (
                <div className="flex justify-center mt-2">
                    <button 
                        onClick={handleLoadMore}
                        disabled={isLoading}
                        className="px-8 py-2 bg-[#0A0A0A] border border-[#333] text-[#888] hover:border-[#555] hover:text-white transition-all text-[11px] font-mono uppercase tracking-[0.2em] disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Load More Signals +'}
                    </button>
                </div>
            )}
        </div>
    );
}
