'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'ai' | 'user';
    content: string;
}
interface Props {
    coin: string;
}

export function TerminalChat({ coin }: Props) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: `Terminal Interface ready. Scanning data streams for $${coin}...` }
    ]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [price, setPrice] = useState<string>('...');
    const endRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages([{ role: 'ai', content: `Terminal Interface ready. Scanning data streams for $${coin}...` }]);
    }, [coin]);

    useEffect(() => {
        if (!chartContainerRef.current) return;
        let chart: any;
        let isMounted = true;
        let ws: WebSocket | null = null;

        const initChart = async () => {
            const { createChart, ColorType } = await import('lightweight-charts');
            
            if (!isMounted || !chartContainerRef.current) return;
            
            chart = createChart(chartContainerRef.current, {
                layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888' },
                grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
                rightPriceScale: { borderColor: '#333' }
            });

            const candlestickSeries = chart.addCandlestickSeries({
                upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
                wickUpColor: '#10b981', wickDownColor: '#ef4444'
            });

            try {
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.toUpperCase()}USDT&interval=1h&limit=100`);
                const data = await res.json();
                const formattedData = data.map((d: any) => ({
                    time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]),
                    low: parseFloat(d[3]), close: parseFloat(d[4])
                }));
                if (isMounted) {
                    candlestickSeries.setData(formattedData);
                    if (formattedData.length > 0) {
                        const lastClose = formattedData[formattedData.length - 1].close;
                        setPrice(lastClose < 1 ? lastClose.toFixed(4) : lastClose.toFixed(2));
                    }
                }
            } catch (e) {
                console.error('Failed to fetch chart data', e);
            }

            if (!isMounted) return;

            // Connect WebSocket for live updates
            const wsUrl = `wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@kline_1h`;
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data);
                    if (message && message.k) {
                        const k = message.k;
                        const bar = {
                            time: k.t / 1000,
                            open: parseFloat(k.o),
                            high: parseFloat(k.h),
                            low: parseFloat(k.l),
                            close: parseFloat(k.c)
                        };
                        candlestickSeries.update(bar);
                        const currentPrice = bar.close;
                        setPrice(currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2));
                    }
                } catch (err) {
                    console.error('WS parsing error', err);
                }
            };

            const handleResize = () => {
                if (chartContainerRef.current && chart) {
                    chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
                }
            };
            window.addEventListener('resize', handleResize);
            chart.cleanupResize = () => window.removeEventListener('resize', handleResize);
        };

        initChart();

        return () => {
            isMounted = false;
            if (ws) ws.close();
            if (chart) {
                if (chart.cleanupResize) chart.cleanupResize();
                chart.remove();
            }
            if (chartContainerRef.current) {
                chartContainerRef.current.innerHTML = '';
            }
        };
    }, [coin]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = async () => {
        if (!input.trim() || streaming) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setStreaming(true);

        let aiBuffer = '';
        setMessages(prev => [...prev, { role: 'ai', content: '' }]);

        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: JSON.stringify({ message: userMsg, coin }),
            });

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                text.split('\n').filter(l => l.startsWith('data:')).forEach(line => {
                    const chunk = line.replace('data:', '').trim();
                    if (chunk && chunk !== '[DONE]') { aiBuffer += chunk; }
                });
                setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: aiBuffer }]);
            }
        } catch {
            setMessages(prev => [...prev.slice(0, -1), { role: 'ai', content: 'Connection error. Please try again.' }]);
        } finally {
            setStreaming(false);
        }
    };

    return (
        <aside className="w-full xl:w-[25%] flex flex-col border border-[#333] bg-[#0A0A0A] xl:min-w-[320px] h-[600px] xl:h-auto shrink-0">
            {/* Price chart area */}
            <div className="h-1/3 border-b border-[#333] flex flex-col relative min-h-[250px]">
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

            {/* Tabs Header */}
            <div className="flex border-b border-[#333]">
                <button className="flex-1 py-4 text-[10px] font-mono font-medium transition-colors text-white border-b border-[#135bec] bg-[#0A0A0A] cursor-default">
                    AI CHAT
                </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-5 space-y-6 overflow-y-auto">
                    {messages.map((msg, i) => (
                        msg.role === 'ai' ? (
                            <div key={i} className="flex gap-4">
                                <div className="w-6 h-6 bg-[#135bec] flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[14px] text-white">smart_toy</span>
                                </div>
                                <div className="flex-1">
                                    <div className="text-[13px] text-[#888] leading-relaxed bg-[#0A0A0A] border border-[#333] p-4">
                                        {msg.content || <span className="opacity-50">▌</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div key={i} className="flex gap-4 flex-row-reverse">
                                <div className="w-6 h-6 bg-[#333] flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[14px] text-white">person</span>
                                </div>
                                <div className="flex-1 flex justify-end">
                                    <div className="text-[13px] text-white leading-relaxed bg-[#135bec]/10 border border-[#135bec]/30 p-4">
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        )
                    ))}
                    <div ref={endRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-[#333] bg-[#0A0A0A]">
                    <div className="relative">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && send()}
                            className="w-full bg-black border border-[#333] px-4 py-3 text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#555]"
                            placeholder="Ask OnlyAlpha..."
                            type="text"
                        />
                        <button onClick={send} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#135bec] hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-[9px] font-mono text-[#555] uppercase tracking-tighter">Model: Alpha-Turbo-4</span>
                        <span className="text-[9px] font-mono text-[#10b981] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full inline-block" /> SYSTEM READY
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
