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

    useEffect(() => {
        setMessages([{ role: 'ai', content: `Terminal Interface ready. Scanning data streams for $${coin}...` }]);

        const fetchPrice = async () => {
            try {
                const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin.toUpperCase()}USDT`);
                const data = await res.json();
                if (data.price) {
                    const numPrice = parseFloat(data.price);
                    setPrice(numPrice < 1 ? numPrice.toFixed(4) : numPrice.toFixed(2));
                }
            } catch (e) {
                console.error("Failed to fetch price", e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 10000);
        return () => clearInterval(interval);
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
            <div className="h-1/3 border-b border-[#333] flex flex-col relative">
                <div className="h-11 px-4 border-b border-[#333] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#888]">{coin.toUpperCase()}/USDT • BINANCE</span>
                    <span className="text-[10px] font-mono text-[#10b981] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse inline-block" /> LIVE
                    </span>
                </div>
                <div className="flex-1 bg-black chart-grid relative p-6 flex flex-col">
                    <div className="text-[28px] font-bold text-white mb-2 font-mono-nums">
                        {price !== '...' ? `$${price}` : '---'}
                    </div>
                    <div className="flex-1 flex items-end gap-[3px]">
                        {[12, 8, 20, 24, 6, 16].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                                <div className={`w-full h-${h} ${i % 3 === 1 || i === 4 ? 'bg-[#ef4444]' : i === 5 ? 'bg-[#135bec] shadow-[0_0_10px_#135bec33]' : 'bg-[#10b981]'}`}
                                    style={{ height: `${h * 4}px` }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#333]">
                {['DATA', 'AI CHAT', 'ALERTS'].map((tab) => (
                    <button key={tab} className={`flex-1 py-4 text-[10px] font-mono font-medium transition-colors ${tab === 'AI CHAT' ? 'text-white border-b border-[#135bec] bg-[#0A0A0A]' : 'text-[#888] hover:text-white'}`}>
                        {tab}
                    </button>
                ))}
            </div>

            {/* Messages */}
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
