'use client';

import { useState, useRef, useEffect } from 'react';
import { TerminalChart } from './TerminalChart';
import { useTerminalChat } from '../hooks/useTerminalChat';

interface Props {
    coin: string;
    articleId?: number | null;
    articleType?: 'WIRE' | 'RADAR';
}

export function TerminalChat({ coin, articleId, articleType }: Props) {
    const { messages, streaming, mode, setMode, guestCount, isGuestLocked, isLoggedIn, send } = useTerminalChat({ coin, articleId, articleType });
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = () => {
        if (!input.trim() || streaming || isGuestLocked) return;
        send(input);
        setInput('');
    };

    return (
        <aside className="w-full h-full flex flex-col border border-[#333] bg-[#0A0A0A] relative overflow-hidden">
            {/* Price chart area (extracted) */}
            <TerminalChart coin={coin} />

            {/* Tabs Header */}
            <div className="flex border-b border-[#333]">
                <button
                    onClick={() => setMode('general')}
                    className={`flex-1 py-4 text-[10px] font-mono font-medium transition-colors border-b relative group ${mode === 'general' ? 'text-white border-[#135bec] bg-[#1a1a1a]' : 'text-[#888] border-transparent bg-[#0A0A0A] hover:bg-[#111]'}`}
                >
                    Macro Intelligence
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-black border border-[#333] text-[#888] text-[9px] p-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        Ask general questions about the market or technical analysis for this coin.
                    </div>
                </button>
                <div className="w-px bg-[#333]"></div>
                <button
                    onClick={() => setMode('context')}
                    className={`flex-1 py-4 text-[10px] font-mono font-medium transition-colors border-b relative group ${mode === 'context' ? 'text-[#10b981] border-[#10b981] bg-[#1a1a1a]' : 'text-[#888] border-transparent bg-[#0A0A0A] hover:bg-[#111]'}`}
                >
                    Asset Context
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-black border border-[#10b981]/50 text-[#888] text-[9px] p-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        AI will analyze the currently selected article/insight and search for the newest updates since then.
                    </div>
                </button>
            </div>

            {/* Chat Content — disabled overlay */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="flex-1 p-5 space-y-6 overflow-y-auto opacity-30 pointer-events-none select-none">
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

                {/* Disabled Overlay */}
                <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    <span className="material-symbols-outlined text-[48px] text-[#888] mb-4">lock</span>
                    <h3 className="text-white text-[14px] font-bold mb-2">AI Chat Temporarily Offline</h3>
                    <p className="text-[#888] text-[12px] max-w-[260px] leading-relaxed">Our AI engine is undergoing maintenance. Chat will be back shortly. Thank you for your patience.</p>
                </div>
            </div>

            {/* Input — disabled */}
            <div className="p-4 border-t border-[#333] bg-[#0A0A0A] opacity-30 pointer-events-none">
                <div className="relative">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full bg-black border border-[#333] px-4 py-3 text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#555] cursor-not-allowed"
                        placeholder="Chat temporarily disabled..."
                        type="text"
                        disabled
                    />
                </div>
                <div className="flex justify-between items-center mt-3">
                    <span className="text-[9px] font-mono text-[#555] uppercase tracking-tighter">
                        Model: OFFLINE
                    </span>
                    <span className="text-[9px] font-mono flex items-center gap-1 text-[#ef4444]">
                        <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full inline-block" /> MAINTENANCE
                    </span>
                </div>
            </div>
        </aside>
    );
}
