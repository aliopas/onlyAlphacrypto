'use client';

import { useEffect, useState } from 'react';
import { CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';
import { terminalApi } from '@/features/terminal/api';

interface Props {
    newsId?: number | null;
    radarSignal?: RadarSignal | null;
}

export function AlphaStream({ newsId, radarSignal }: Props) {
    const [article, setArticle] = useState<CoinNews | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // If we are given a radar signal directly, we don't need to fetch news.
        if (radarSignal) {
            setArticle(null);
            return;
        }

        if (!newsId) {
            setArticle(null);
            return;
        }

        async function fetchArticle() {
            setLoading(true);
            try {
                const data = await terminalApi.getNewsById(newsId!);
                setArticle(data);
            } catch (err) {
                console.error("Failed to load article details", err);
            } finally {
                setLoading(false);
            }
        }

        fetchArticle();
    }, [newsId, radarSignal]);

    // Fallback View (When no wire card or radar card is clicked)
    if (!newsId && !radarSignal) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="text-center opacity-40">
                    <div className="w-24 h-24 border border-dashed border-[#555] rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-medium text-white mb-2">Alpha Stream Standby</h2>
                    <p className="text-[#888] font-mono text-sm">Select an event from the timeline to initiate deep analysis.</p>
                </div>
            </div>
        );
    }

    if (loading && !radarSignal) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <span className="text-[#888] font-mono text-sm">Decoding Signal...</span>
                </div>
            </div>
        );
    }

    // Determine the data payload (News or Radar)
    const displayCoin = radarSignal ? radarSignal.coin : article?.coin;
    const displaySentiment = radarSignal ? radarSignal.sentiment : article?.sentiment;
    const displayDate = radarSignal ? radarSignal.createdAt : article?.createdAt;
    const displayHeadline = radarSignal ? "AI Radar Detection Event" : article?.headline;
    const displayBody = radarSignal ? radarSignal.signal : article?.summary;
    const isRadarType = !!radarSignal;

    const getSentimentColor = (sentiment?: string) => {
        const s = sentiment?.toLowerCase();
        if (s === 'bullish') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (s === 'bearish') return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        if (s === 'volatile') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-[#135bec] bg-[#135bec]/10 border-[#135bec]/20';
    };

    return (
        <div className="flex-1 flex flex-col p-8 xl:p-12 overflow-y-auto relative animate-fade-in">
            {/* Header / Meta */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                {displayCoin && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#333] flex items-center justify-center text-xs font-bold text-white">
                            {displayCoin[0]}
                        </div>
                        <span className="text-lg font-bold text-white tracking-wide">${displayCoin}</span>
                    </div>
                )}

                {isRadarType && (
                    <span className="px-3 py-1 text-xs font-mono uppercase tracking-wider border rounded-sm text-amber-500 bg-amber-500/10 border-amber-500/20">
                        RADAR TARGET
                    </span>
                )}

                {displaySentiment && (
                    <span className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border rounded-sm ${getSentimentColor(displaySentiment)}`}>
                        {displaySentiment}
                    </span>
                )}

                {displayDate && (
                    <span className="text-xs font-mono text-[#666] ml-auto">
                        Signal acquired at {new Date(displayDate).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Headline */}
            <h1 className="text-3xl xl:text-4xl font-semibold text-white leading-tight mb-8">
                {displayHeadline}
            </h1>

            {/* Content Body */}
            <div className="prose prose-invert prose-lg max-w-none">
                <div className="p-6 bg-[#0A0A0A] border border-[#222] rounded-lg shadow-2xl relative overflow-hidden group">
                    {/* Decorative cyber grid background */}
                    <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-1 h-4 rounded-sm ${isRadarType ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <h3 className="text-sm font-mono tracking-widest text-[#888] uppercase m-0">
                            {isRadarType ? 'Synthesized Intelligence' : 'GLM-5 Deep Analysis'}
                        </h3>
                    </div>

                    <p className="text-[#CCC] leading-relaxed text-[15px] font-sans relative z-10 whitespace-pre-line">
                        {displayBody || "No AI summary available for this signal."}
                    </p>
                </div>
            </div>

            {/* System Status Footer */}
            <div className="mt-12 flex items-center justify-between pt-6 border-t border-[#222]">
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${isRadarType ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-xs font-mono text-[#555] uppercase tracking-widest">Network Secure</span>
                </div>
                <div className="text-xs font-mono text-[#555]">
                    {radarSignal ? radarSignal.id : article?.id}-SEQ-HASH
                </div>
            </div>
        </div>
    );
}
