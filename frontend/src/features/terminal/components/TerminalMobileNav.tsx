'use client';

interface Props {
    activeTab: 'wire' | 'stream' | 'chat';
    onTabChange: (tab: 'wire' | 'stream' | 'chat') => void;
}

export function TerminalMobileNav({ activeTab, onTabChange }: Props) {
    return (
        <nav className="flex-none lg:hidden w-full bg-[#0A0A0A] border border-[#333] flex p-1 rounded-sm relative shrink-0">
            <button
                onClick={() => onTabChange('wire')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 transition-all outline-none rounded-[2px] ${activeTab === 'wire' ? 'bg-[#181818] border border-[#555] text-white shadow-sm' : 'bg-transparent border border-transparent text-[#555] hover:text-[#888]'}`}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'wire' ? 'text-amber-500' : ''}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium">Wire</span>
            </button>
            <button
                onClick={() => onTabChange('stream')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 transition-all outline-none rounded-[2px] ${activeTab === 'stream' ? 'bg-[#181818] border border-[#555] text-white shadow-sm' : 'bg-transparent border border-transparent text-[#555] hover:text-[#888]'}`}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'stream' ? 'text-emerald-500' : ''}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium">Stream</span>
            </button>
            <button
                onClick={() => onTabChange('chat')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 transition-all outline-none rounded-[2px] ${activeTab === 'chat' ? 'bg-[#181818] border border-[#555] text-white shadow-sm' : 'bg-transparent border border-transparent text-[#555] hover:text-[#888]'}`}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'chat' ? 'text-[#135bec]' : ''}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium">Chat</span>
            </button>
        </nav>
    );
}

export default TerminalMobileNav;
