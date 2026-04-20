'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { homeApi } from '@/features/home/api';
import { TopMover } from '@/features/home/types';

const DISPLAY_COUNT = 5;
const POLL_INTERVAL = 30000;
const NEW_BADGE_DURATION = 60000;
const FLAT_THRESHOLD = 3;
const EXTREME_THRESHOLD = 40;

interface MoverRow {
    symbol: string;
    displayName: string;
    linkTarget: string;
    changeNum: number;
    priceNum: number;
    volumeNum: number;
    isExtreme: boolean;
}

function toMoverRow(m: TopMover): MoverRow {
    const rawName = m.symbol.replace('USDT', '');
    const changeNum = parseFloat(m.priceChangePercent) || 0;
    const priceNum = parseFloat(m.lastPrice) || 0;
    const volumeNum = parseFloat(m.quoteVolume) || 0;
    return {
        symbol: m.symbol,
        displayName: rawName,
        linkTarget: `/terminal/${rawName.toLowerCase()}`,
        changeNum,
        priceNum,
        volumeNum,
        isExtreme: changeNum >= EXTREME_THRESHOLD,
    };
}

function formatPrice(price: number): string {
    if (!Number.isFinite(price)) return '$0.00';
    if (price < 1) {
        return `$${price.toFixed(4)}`;
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SkeletonRows() {
    return (
        <div className="flex flex-col gap-2 mt-4">
            {Array.from({ length: DISPLAY_COUNT }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 animate-pulse">
                    <div className="w-4 h-3 bg-[#222]" />
                    <div className="w-12 h-3 bg-[#222]" />
                    <div className="w-10 h-3 bg-[#222]" />
                    <div className="flex-1 h-3 bg-[#222]" />
                </div>
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex items-center justify-center py-8">
            <span className="text-[10px] font-mono text-[#555]">No significant movers detected</span>
        </div>
    );
}

function ReconnectingState() {
    return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
            <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#555] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#555]" />
            </span>
            <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
                RECONNECTING...
            </span>
            <span className="text-[8px] font-mono text-[#444]">
                Market data temporarily unavailable
            </span>
        </div>
    );
}

export function TopMovers() {
    const [rows, setRows] = useState<MoverRow[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isError, setIsError] = useState<boolean>(false);
    const [flatMarket, setFlatMarket] = useState<boolean>(false);
    const [newEntries, setNewEntries] = useState<Map<string, number>>(new Map());

    const prevSymbolsRef = useRef<Set<string>>(new Set());
    const newEntriesRef = useRef<Map<string, number>>(new Map());
    const cachedRowsRef = useRef<MoverRow[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const data = await homeApi.getTopMovers();
            const mapped = data.slice(0, DISPLAY_COUNT).map(toMoverRow);

            const currentSymbols = new Set(mapped.map((r) => r.symbol));
            const prevSymbols = prevSymbolsRef.current;
            const freshCoins: string[] = [];

            currentSymbols.forEach((sym) => {
                if (!prevSymbols.has(sym)) {
                    freshCoins.push(sym);
                }
            });

            const now = Date.now();
            const updatedEntries = new Map(newEntriesRef.current);
            freshCoins.forEach((sym) => {
                updatedEntries.set(sym, now);
            });
            newEntriesRef.current = updatedEntries;
            setNewEntries(new Map(updatedEntries));

            prevSymbolsRef.current = currentSymbols;

            const isFlat = mapped.length > 0 && mapped.every((r) => r.changeNum < FLAT_THRESHOLD);
            setFlatMarket(isFlat);
            setRows(mapped);
            cachedRowsRef.current = mapped;
            setIsError(false);
            setIsLoading(false);
        } catch {
            if (cachedRowsRef.current.length === 0) {
                setIsError(true);
                setIsLoading(false);
            } else {
                setIsError(true);
            }
        }
    }, []);

    useEffect(() => {
        fetchData();

        const pollInterval = setInterval(fetchData, POLL_INTERVAL);

        const badgeCleanup = setInterval(() => {
            const now = Date.now();
            const current = newEntriesRef.current;
            let changed = false;
            const updated = new Map<string, number>();
            current.forEach((timestamp, sym) => {
                if (now - timestamp < NEW_BADGE_DURATION) {
                    updated.set(sym, timestamp);
                } else {
                    changed = true;
                }
            });
            if (changed) {
                newEntriesRef.current = updated;
                setNewEntries(new Map(updated));
            }
        }, 5000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(badgeCleanup);
        };
    }, [fetchData]);

    const maxVolume = rows.length > 0 ? Math.max(...rows.map((r) => r.volumeNum)) : 0;

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">
                        {flatMarket ? 'Market Pulse (24h)' : 'Top Movers (24h)'}
                    </h3>
                    {flatMarket && (
                        <span className="text-[9px] font-mono text-[#555] uppercase">
                            Low volatility regime
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {isError ? (
                        <span className="text-[9px] font-mono text-[#eab308] uppercase tracking-wider">
                            &#9888; Live Delayed
                        </span>
                    ) : !isLoading && (
                        <span className="relative flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            <span className="text-[9px] font-mono text-[#888] uppercase tracking-wider">
                                Live
                            </span>
                        </span>
                    )}
                </div>
            </div>

            {isLoading && rows.length === 0 ? (
                <SkeletonRows />
            ) : isError && rows.length === 0 ? (
                <ReconnectingState />
            ) : rows.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-4 text-[9px] font-mono text-[#555] uppercase">#</span>
                        <span className="w-16 text-[9px] font-mono text-[#555] uppercase">Asset</span>
                        <span className="w-16 text-right text-[9px] font-mono text-[#555] uppercase">24h</span>
                        <span className="flex-1 text-[9px] font-mono text-[#555] uppercase">Vol</span>
                    </div>
                    {rows.map((row, index) => {
                        const isNewBadge =
                            newEntries.has(row.symbol) &&
                            Date.now() - (newEntries.get(row.symbol) ?? 0) < NEW_BADGE_DURATION;
                        const volumeWidth = maxVolume > 0 ? (row.volumeNum / maxVolume) * 100 : 0;

                        return (
                            <Link
                                key={row.symbol}
                                href={row.linkTarget}
                                className={`flex items-center gap-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer${row.isExtreme ? ' opacity-80' : ''}`}
                            >
                                <span className="w-4 text-[10px] font-mono text-[#555]">
                                    {index + 1}
                                </span>
                                <span className="w-16 flex flex-col gap-0.5">
                                    <span className="text-[12px] font-mono text-white font-bold uppercase leading-none">
                                        {row.displayName}
                                    </span>
                                    {isNewBadge && (
                                        <span className="text-[8px] font-mono text-[#00ff88] border border-[#00ff88]/30 px-1 py-0.5 uppercase w-fit">
                                            NEW
                                        </span>
                                    )}
                                    {row.isExtreme && (
                                        <span className="text-[8px] font-mono text-[#eab308] border border-[#eab308]/30 px-1 py-0.5 uppercase w-fit">
                                            &#9889; Extreme
                                        </span>
                                    )}
                                </span>
                                <span className="w-16 flex flex-col items-end gap-0.5">
                                    <span className="text-[12px] font-mono font-bold text-[#10b981]">
                                        +{row.changeNum.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] font-mono text-[#888]">
                                        {formatPrice(row.priceNum)}
                                    </span>
                                </span>
                                <span className="flex-1 flex items-center">
                                    <div
                                        className="h-1 bg-emerald-500/40"
                                        style={{ width: `${volumeWidth}%` }}
                                    />
                                </span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
