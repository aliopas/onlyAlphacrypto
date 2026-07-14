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
    tp1: string | null;
    tp2: string | null;
    tp3: string | null;
    stopLoss: string | null;
    qualityScore: number | null;
    createdAt: string;
    updatedAt: string;
    // T8 investment columns
    direction?: string | null;
    postedEntryPrice?: string | null;
    averageEntryPrice?: string | null;
    initialBudget?: string | null;
    dcaBudget?: string | null;
    remainingSizeFrac?: string | null;
    dcaFilled?: boolean | null;
    tp1Hit?: boolean | null;
    tp2Hit?: boolean | null;
    tp3Hit?: boolean | null;
    realizedPnl?: string | null;
}

type SortKey = 'id' | 'symbol' | 'entryPrice' | 'currentPrice' | 'movement' | 'classification';
type SortDir = 'asc' | 'desc';

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

function calcMovement(entry: string | null, current: string | null, avgEntry?: string | null): number | null {
    const e = parseFloat(avgEntry || entry || '0');
    const c = parseFloat(current || '0');
    if (isNaN(e) || isNaN(c) || e === 0) return null;
    return ((c - e) / e) * 100;
}

function classificationBadge(cls: string | null): string {
    if (cls === 'STRATEGIC') return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    if (cls === 'TACTICAL') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    return 'bg-[#222] text-[#888]';
}

function pnlColor(val: number | null): string {
    if (val === null) return 'text-[#888]';
    if (val > 0) return 'text-emerald-400';
    if (val < 0) return 'text-red-400';
    return 'text-[#888]';
}

export default function ActivePortfolioTable({ coins, onCoinClick }: Props) {
    const [sortKey, setSortKey] = useState<SortKey>('symbol');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const sorted = [...coins].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
            case 'id':
                cmp = a.id - b.id;
                break;
            case 'symbol':
                cmp = a.symbol.localeCompare(b.symbol);
                break;
            case 'entryPrice':
                cmp = parseFloat(a.entryPrice || '0') - parseFloat(b.entryPrice || '0');
                break;
            case 'currentPrice':
                cmp = parseFloat(a.currentPrice || '0') - parseFloat(b.currentPrice || '0');
                break;
            case 'movement':
                cmp = (calcMovement(a.entryPrice, a.currentPrice, a.averageEntryPrice) ?? 0) - (calcMovement(b.entryPrice, b.currentPrice, b.averageEntryPrice) ?? 0);
                break;
            case 'classification':
                cmp = (a.signalClassification || '').localeCompare(b.signalClassification || '');
                break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    function toggleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    function sortIcon(key: SortKey): string {
        if (sortKey !== key) return '↕';
        return sortDir === 'asc' ? '↑' : '↓';
    }

    if (coins.length === 0) {
        return (
            <div className="border border-[#222] rounded-lg p-6 mb-6 text-center">
                <span className="text-[#666] text-sm">No active positions in the model portfolio.</span>
            </div>
        );
    }

    return (
        <div className="border border-[#222] rounded-lg overflow-hidden mb-6">
            <div className="bg-[#111] text-xs text-[#666] uppercase tracking-wider px-4 py-3 flex items-center gap-2">
                <span>Active Portfolio</span>
                <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded">Simulated Positions</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-[#0A0A0A] text-[#555] text-xs">
                            <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('id')}>
                                ID {sortIcon('id')}
                            </th>
                            <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('symbol')}>
                                Coin {sortIcon('symbol')}
                            </th>
                            <th className="text-right px-4 py-3 font-medium">Allocated</th>
                            <th className="text-right px-4 py-3 font-medium">Remaining</th>
                            <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('entryPrice')}>
                                Avg Entry {sortIcon('entryPrice')}
                            </th>
                            <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('currentPrice')}>
                                Current {sortIcon('currentPrice')}
                            </th>
                            <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('movement')}>
                                P&L% {sortIcon('movement')}
                            </th>
                            <th className="text-right px-4 py-3 font-medium">P&L$</th>
                            <th className="text-right px-4 py-3 font-medium">TP1</th>
                            <th className="text-right px-4 py-3 font-medium">TP2</th>
                            <th className="text-right px-4 py-3 font-medium">TP3</th>
                            <th className="text-right px-4 py-3 font-medium">SL</th>
                            <th className="text-center px-4 py-3 font-medium">DCA</th>
                            <th className="text-center px-4 py-3 font-medium cursor-pointer hover:text-[#888]" onClick={() => toggleSort('classification')}>
                                Class {sortIcon('classification')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((coin, idx) => {
                            const movement = calcMovement(coin.entryPrice, coin.currentPrice, coin.averageEntryPrice);
                            const avg = parseFloat(coin.averageEntryPrice || coin.entryPrice || '0');
                            const risk = parseFloat(coin.allocatedBudget || '0');
                            const pnlDollar = movement !== null ? risk * (movement / 100) : 0;
                            const remainingPct = ((parseFloat(coin.remainingSizeFrac || '1')) * 100).toFixed(0) + '%';
                            const dcaYes = coin.dcaFilled ? 'Yes' : '—';
                            return (
                                <tr
                                    key={coin.id}
                                    className={`border-t border-[#1A1A1A] ${idx % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-[#111]'} hover:bg-[#161616] cursor-pointer transition-colors`}
                                    onClick={() => onCoinClick(coin.symbol)}
                                >
                                    <td className="px-4 py-3 font-mono text-[#888] text-xs">#{coin.id}</td>
                                    <td className="px-4 py-3 font-mono font-semibold text-white hover:text-emerald-400">{coin.symbol}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.allocatedBudget)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-purple-400">{remainingPct}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.averageEntryPrice || coin.entryPrice)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.currentPrice)}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${pnlColor(movement)}`}>
                                        {movement !== null ? `${movement >= 0 ? '+' : ''}${movement.toFixed(2)}%` : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono ${pnlColor(pnlDollar)}`}>
                                        {pnlDollar !== 0 ? `${pnlDollar >= 0 ? '+' : ''}$${pnlDollar.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(coin.tp1)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(coin.tp2)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#666]">{formatPrice(coin.tp3)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-red-400/70">{formatPrice(coin.stopLoss)}</td>
                                    <td className="px-4 py-3 text-center text-xs text-purple-400">{dcaYes}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${classificationBadge(coin.signalClassification)}`}>
                                            {coin.signalClassification || '—'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}