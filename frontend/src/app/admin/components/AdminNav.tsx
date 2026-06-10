'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminNavProps {
    onLogout: () => void;
}

const NAV_ITEMS = [
    { href: '/admin/shadow', label: 'Shadow Dashboard', icon: '📊' },
    { href: '/admin/score-records', label: 'Score Records', icon: '📋' },
    { href: '/admin/signals', label: 'Signal Control', icon: '🎯' },
    { href: '/admin/system', label: 'System', icon: '⚙️' },
];

export default function AdminNav({ onLogout }: AdminNavProps) {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-[#0A0A0A] border-r border-[#333] flex flex-col h-full">
            <div className="p-4 border-b border-[#333]">
                <h2 className="text-lg font-bold text-white">Admin Hub</h2>
                <p className="text-xs text-gray-500 mt-1">OnlyAlpha Command Center</p>
            </div>
            <nav className="flex-1 p-2">
                <ul className="space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                                        isActive
                                            ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50'
                                            : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                                    }`}
                                >
                                    <span>{item.icon}</span>
                                    <span className="text-sm">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="p-4 border-t border-[#333]">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors text-sm"
                >
                    <span>🚪</span>
                    Logout
                </button>
            </div>
        </aside>
    );
}
