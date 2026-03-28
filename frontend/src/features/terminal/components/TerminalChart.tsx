'use client';

import { useBinanceChart } from '../hooks/useBinanceChart';

interface TerminalChartProps {
    coin: string;
}

export function TerminalChart({ coin }: TerminalChartProps) {
    const { chartContainerRef, price } = useBinanceChart({ coin });

    return (
        <div className="h-1/3 border-b border-[#333] flex flex-col relative min-h-[250px] shrink-0">
            <div className="h-11 px-4 border-b border-[#333] flex items-center justify-between z-10 bg-[#0A0A0A]">
                <span className="text-[10px] font-mono text-[#888]">{coin.toUpperCase()}/USDT • BINANCE</span>
                <span className="text-[10px] font-mono text-[#10b981] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse inline-block" /> LIVE
                </span>
            </div>
            <div className="absolute top-14 left-4 z-10 pointer-events-none">
                <div className="text-[28px] font-bold text-white font-mono-nums drop-shadow-md">
                    {price !== '...' ? `$${price}` : '---'}
                </div>
            </div>
            <div className="flex-1 bg-black relative w-full h-full" ref={chartContainerRef} />
        </div>
    );
}
