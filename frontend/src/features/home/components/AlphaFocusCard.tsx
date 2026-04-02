'use client';

import { useState, useEffect } from 'react';
import { AlphaFocus } from '@/features/home/types';
import Link from 'next/link';

interface Props {
    data: AlphaFocus | null;
}

export function AlphaFocusCard({ data }: Props) {
    const [sparklinePath, setSparklinePath] = useState<string>('M0,50 L400,50');
    const [sparklineLoading, setSparklineLoading] = useState(true);

    useEffect(() => {
        const coinValue = data?.coin;
        if (!coinValue) return;

        let cancelled = false;

        async function fetchSparkline() {
            try {
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coinValue!.toUpperCase()}USDT&interval=1h&limit=24`);
                if (!response.ok) throw new Error('Binance API error');
                const rawData = await response.json();
                const klineData = rawData as unknown[][];
                if (cancelled || !Array.isArray(klineData) || klineData.length === 0) return;

                const prices = klineData.map((d) => Number(d[4]));
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const range = max - min || 1;
                const width = 400;
                const height = 100;

                const points = prices.map((price: number, i: number) => {
                    const x = (i / (prices.length - 1)) * width;
                    const y = height - ((price - min) / range) * (height - 10) - 5;
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                });

                setSparklinePath(points.join(' '));
            } catch (error) {
                console.error('[AlphaFocusCard] Sparkline fetch failed:', error);
            } finally {
                if (!cancelled) setSparklineLoading(false);
            }
        }

        fetchSparkline();
        return () => { cancelled = true; };
    }, [data?.coin]);

    if (!data) {
        return (
            <div className="bg-[#0A0A0A] border border-[#333] p-8 relative flex flex-col">
                <div className="flex justify-between items-start mb-10">
                    <div className="space-y-4">
                        <span className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] block">
                            Today&apos;s Alpha Focus
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-center py-8">
                    <p className="text-[#555] font-mono text-[12px] uppercase tracking-widest">No Alpha Focus data available.</p>
                </div>
            </div>
        );
    }

    const isUp = (data.priceChange24h ?? 0) >= 0;

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-8 relative flex flex-col">
            <div className="flex justify-between items-start mb-10">
                <div className="space-y-4">
                    <span className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] block">
                        Today&apos;s Alpha Focus
                    </span>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h2 className="text-4xl font-bold text-white tracking-tighter uppercase truncate max-w-[400px]" title={data.coin}>${data.coin}</h2>
                        <div className="px-4 py-1.5 bg-[#135bec] flex items-center gap-2.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-[12px] font-mono font-bold text-white uppercase tracking-wider">
                                AI VERDICT: {data.verdict}
                            </span>
                        </div>
                        <span className="text-[12px] font-mono text-[#555] ml-2 whitespace-nowrap">
                            <span className="font-mono-nums">{data.confidence}%</span> Confidence
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-mono text-[#888] uppercase block mb-1">Current Price</span>
                    <div className="text-3xl font-mono-nums font-bold text-white tracking-tight">${data.price?.toLocaleString()}</div>
                    <div className={`text-[12px] font-mono-nums ${isUp ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {isUp ? '+' : ''}{data.priceChange24h?.toFixed(2)}% (24H)
                    </div>
                </div>
            </div>

            <div className="flex gap-12 items-center">
                {/* Spark chart */}
                <div className="flex-1 h-36 relative">
                    <svg className="w-full h-full text-[#00ff88] drop-shadow-[0_0_8px_rgba(0,255,136,0.3)]"
                        preserveAspectRatio="none" viewBox="0 0 400 100">
                        {sparklineLoading ? (
                            <line x1="0" y1="50" x2="400" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                        ) : (
                            <path d={sparklinePath} fill="none" stroke="currentColor" strokeWidth="2.5" />
                        )}
                    </svg>
                    <div className="absolute bottom-0 left-0 text-[10px] font-mono text-[#444] uppercase tracking-widest">
                        24H High-Density Execution Path
                    </div>
                </div>

                {/* Summary */}
                <div className="w-[320px] space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-widest border-b border-[#333] pb-1">
                            Executive Summary
                        </h3>
                        <p className="text-[14px] text-[#888] leading-relaxed line-clamp-5 overflow-hidden" title={data.summary}>
                            {data.summary}
                        </p>
                    </div>
                    <Link href={`/terminal/${data.coin}?alpha=true`} className="text-[11px] font-mono text-white flex items-center gap-2 hover:translate-x-1 transition-transform group mt-2 w-fit">
                        <span className="border-b border-white/30 group-hover:border-white">EXPLORE FULL ON-CHAIN ANALYSIS</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
