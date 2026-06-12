'use client';

import { useState } from 'react';

interface CoinRow {
    id: number;
    symbol: string;
    entryPrice: string;
    currentPrice: string | null;
    priceMovementAtEntry: string | null;
    status: string;
    signalClassification: string | null;
    cexListings: string | null;
    allocatedBudget: string;
    createdAt: string;
}

interface Props {
    coins: CoinRow[];
    onCoinClick: (symbol: string) => void;
}

function formatPrice(price: string | null): string {
    if (!price) return '—';
    const num = parseFloat(price);
    if (isNaN(num)) return '—';
    if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

function calcMovement(entry: string | null, current: string | null): number | null {
    if (!entry || !current) return null;
    const e = parseFloat(entry);
    const c = parseFloat(current);
    if (isNaN(e) || isNaN(c) || e === 0) return null;
    return ((c - e) / e) * 100;
}

function pnlColor(val: number | null): string {
    if (val === null) return 'text-[#888]';
    if (val > 0) return 'text-emerald-400';
    if (val < 0) return 'text-red-400';
    return 'text-[#888]';
}

export default function WatchlistTable({ coins, onCoinClick }: Props) {
    if (coins.length === 0) {
        return (
            <div className="border border-[#222] rounded-lg p-6 mb-6 text-center">
                <span className="text-[#666] text-sm">No coins in watchlist.</span>
            </div>
        );
    }

    return (
        <div className="border border-[#222] rounded-lg overflow-hidden mb-6">
            <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                <span>Watchlist</span>
                <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">Simulation Candidates</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                            <th className="text-left px-4 py-3 font-medium">ID</th>
                            <th className="text-left px-4 py-3 font-medium">Coin</th>
                            <th className="text-right px-4 py-3 font-medium">Analysis Price</th>
                            <th className="text-right px-4 py-3 font-medium">Current Price</th>
                            <th className="text-right px-4 py-3 font-medium">Movement</th>
                            <th className="text-left px-4 py-3 font-medium">CEX Listings</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coins.map((coin, idx) => {
                            const movement = calcMovement(coin.entryPrice, coin.currentPrice);
                            return (
                                <tr
                                    key={coin.id}
                                    className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'} hover:bg-[#161616] cursor-pointer transition-colors`}
                                    onClick={() => onCoinClick(coin.symbol)}
                                >
                                    <td className="px-4 py-3 font-mono text-[#888] text-xs">#{coin.id}</td>
                                    <td className="px-4 py-3 font-mono font-semibold text-white hover:text-yellow-400">{coin.symbol}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.entryPrice)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.currentPrice)}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${pnlColor(movement)}`}>
                                        {movement !== null ? `${movement >= 0 ? '+' : ''}${movement.toFixed(2)}%` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-[#888] text-xs max-w-[200px] truncate">{coin.cexListings || '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}