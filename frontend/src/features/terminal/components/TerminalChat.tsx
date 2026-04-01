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
        <aside className="w-full xl:w-[25%] flex flex-col border border-[#333] bg-[#0A0A0A] xl:min-w-[320px] flex-1 xl:flex-initial xl:h-[calc(100vh-80px)] shrink-0 relative">
            {/* Price chart area (extracted) */}
            <TerminalChart coin={coin} />

            {/* Tabs Header */}
            <div className="flex border-b border-[#333]">
                <button
                    onClick={() => setMode('general')}
                    className={`flex-1 py-4 text-[10px] font-mono font-medium transition-colors border-b relative group ${mode === 'general' ? 'text-white border-[#135bec] bg-[#1a1a1a]' : 'text-[#888] border-transparent bg-[#0A0A0A] hover:bg-[#111]'}`}
                >
                    GENERAL AI
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-black border border-[#333] text-[#888] text-[9px] p-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        Ask general questions about the market or technical analysis for this coin.
                    </div>
                </button>
                <div className="w-px bg-[#333]"></div>
                <button
                    onClick={() => setMode('private')}
                    className={`flex-1 py-4 text-[10px] font-mono font-medium transition-colors border-b relative group ${mode === 'private' ? 'text-[#10b981] border-[#10b981] bg-[#1a1a1a]' : 'text-[#888] border-transparent bg-[#0A0A0A] hover:bg-[#111]'}`}
                >
                    CONTEXT AI
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-black border border-[#10b981]/50 text-[#888] text-[9px] p-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        AI will analyze the currently selected article/insight and search for the newest updates since then.
                    </div>
                </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
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

                {/* Guest Locked Overlay */}
                {isGuestLocked && (
                    <div className="absolute inset-x-0 bottom-[80px] z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border-t border-[#333] h-[200px]">
                        <span className="material-symbols-outlined text-[40px] text-[#135bec] mb-4">account_balance_wallet</span>
                        <h3 className="text-white text-[14px] font-bold mb-2">Free Prompts Exhausted</h3>
                        <p className="text-[#888] text-[12px] mb-6">You've reached the limit of 3 free Ask OnlyAlpha uses. Please connect your wallet to continue.</p>
                        <a href="/auth" className="px-6 py-2 bg-[#135bec] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#0f4ac0] transition-colors rounded-lg shadow-[0_0_15px_rgba(19,91,236,0.3)]">
                            Connect Wallet
                        </a>
                    </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-[#333] bg-[#0A0A0A]">
                    <div className="relative">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isGuestLocked}
                            className="w-full bg-black border border-[#333] px-4 py-3 text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#555] disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={isGuestLocked ? "Sign in to continue..." : "Ask OnlyAlpha..."}
                            type="text"
                        />
                        <button onClick={handleSend} disabled={isGuestLocked} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#135bec] hover:text-white transition-colors disabled:opacity-50">
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-[9px] font-mono text-[#555] uppercase tracking-tighter">
                            Model: {mode === 'general' ? 'Alpha-Turbo-4' : 'Alpha-Context-5'} {(!isLoggedIn && guestCount < 3) ? `(GUEST: ${guestCount}/3)` : ''}
                        </span>
                        <span className="text-[9px] font-mono flex items-center gap-1 text-[#10b981]">
                            <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full inline-block animate-pulse" /> SYSTEM READY
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
