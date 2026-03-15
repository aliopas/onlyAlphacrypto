'use client';

import { useEffect, useState } from 'react';
import { homeApi } from '@/features/home/api';
import { TopMover } from '@/features/home/types';

function TickerItems({ movers }: { movers: TopMover[] }) {
    if (!movers.length) {
        return (
            <div className="flex items-center gap-10 px-6">
                <span className="text-[#888] flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> LIVE
                </span>
                <span className="text-[#888] font-mono text-[11px] uppercase tracking-wider">
                    SCANNING MARKETS...
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-10 px-6 shrink-0">
            <span className="text-[#888] flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> LIVE
            </span>
            {movers.map((m) => {
                const price = parseFloat(m.lastPrice);
                const change = parseFloat(m.priceChangePercent);
                const isPositive = change > 0;
                return (
                    <span key={m.symbol} className="flex items-center gap-2 text-[#888] font-mono text-[11px] uppercase tracking-wider shrink-0">
                        {m.symbol.replace('USDT', '')}{' '}
                        <span className="text-white font-mono-nums">
                            ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
                        </span>{' '}
                        <span className={isPositive ? 'text-[#10b981] font-mono-nums' : change < 0 ? 'text-[#ef4444] font-mono-nums' : 'text-[#888] font-mono-nums'}>
                            {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

export function TickerBar() {
    const [movers, setMovers] = useState<TopMover[]>([]);

    useEffect(() => {
        homeApi.getTopMovers().then(setMovers);
    }, []);

    return (
        <header className="h-[42px] border-b border-[#333] bg-black flex items-center overflow-hidden whitespace-nowrap relative z-10 shrink-0">
            <div className="flex animate-marquee items-center">
                <TickerItems movers={movers} />
                <TickerItems movers={movers} />
            </div>
        </header>
    );
}
