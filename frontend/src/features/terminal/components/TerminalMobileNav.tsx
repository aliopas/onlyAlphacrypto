'use client';

interface Props {
    activeTab: 'wire' | 'stream' | 'chat';
    onTabChange: (tab: 'wire' | 'stream' | 'chat') => void;
}

export function TerminalMobileNav({ activeTab, onTabChange }: Props) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 xl:hidden bg-black border-t border-[#222] flex justify-around items-center h-14 z-50">
            <button
                onClick={() => onTabChange('wire')}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 cursor-pointer transition-colors ${activeTab === 'wire' ? 'text-[#00ff88]' : 'text-[#555]'}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-wider">Wire</span>
            </button>
            <button
                onClick={() => onTabChange('stream')}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 cursor-pointer transition-colors ${activeTab === 'stream' ? 'text-[#00ff88]' : 'text-[#555]'}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-wider">Stream</span>
            </button>
            <button
                onClick={() => onTabChange('chat')}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 cursor-pointer transition-colors ${activeTab === 'chat' ? 'text-[#00ff88]' : 'text-[#555]'}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-[10px] font-mono uppercase tracking-wider">Chat</span>
            </button>
        </nav>
    );
}

export default TerminalMobileNav;
