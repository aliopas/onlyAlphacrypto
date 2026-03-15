import { TopMover } from '@/features/home/types';

interface Props {
    movers: TopMover[];
}

export function TopMovers({ movers }: Props) {
    // Take only top 5 if needed, but Binance API slice limits to 10. Let's show up to 5 on UI.
    const displayMovers = movers.slice(0, 5);

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-4">Top Movers (24h)</h3>
            <table className="w-full text-[13px]">
                <thead>
                    <tr className="text-[10px] font-mono text-[#555] uppercase border-b border-[#333]">
                        <th className="text-left py-2 font-normal">Asset</th>
                        <th className="text-right py-2 font-normal">Price</th>
                        <th className="text-right py-2 font-normal">Change</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                    {displayMovers.map((m) => {
                        const price = parseFloat(m.lastPrice);
                        const change = parseFloat(m.priceChangePercent);
                        const isPositive = change > 0;
                        return (
                            <tr key={m.symbol}>
                                <td className="py-3 text-white font-medium">{m.symbol.replace('USDT', '')}</td>
                                <td className="py-3 text-right font-mono-nums">
                                    ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
                                </td>
                                <td className={`py-3 text-right font-mono-nums ${isPositive ? 'text-[#10b981]' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                                </td>
                            </tr>
                        );
                    })}
                    {displayMovers.length === 0 && (
                        <tr>
                            <td colSpan={3} className="py-6 text-center text-[#555] font-mono text-[10px] uppercase">
                                Awaiting API Data...
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
