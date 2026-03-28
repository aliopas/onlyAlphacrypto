'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/', icon: 'home', label: 'Home' },
    { href: '/terminal', icon: 'terminal', label: 'Terminal' },
    { href: '/airdrops', icon: 'flight_takeoff', label: 'Airdrops' } // Changed icon to flight_takeoff to be more relevant
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <nav className="fixed md:relative bottom-0 left-0 w-full md:w-[64px] h-[72px] md:h-full md:border-r border-[#222] flex md:flex-col items-center md:py-6 bg-black/80 backdrop-blur-md md:bg-black shrink-0 z-50 transition-all duration-300 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.8)] md:shadow-none pb-2 md:pb-0">
            {/* Logo (Desktop Only) */}
            <div className="hidden md:block mb-10">
                <div className="text-xl font-bold tracking-tighter text-white flex justify-center" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    <span className="flex items-baseline">
                        <span className="leading-none">O</span>
                        <span className="relative leading-none">
                            A
                            <span className="absolute bottom-0 right-0 translate-x-[40%] translate-y-[45%] text-[13px] text-[var(--color-primary)] font-medium">c</span>
                        </span>
                    </span>
                </div>
            </div>

            {/* Nav items */}
            <div className="flex md:flex-col gap-2 md:gap-6 w-full px-4 md:px-0 justify-around md:justify-start items-center h-full md:h-auto">
                {NAV_ITEMS.map(({ href, icon, label }) => {
                    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={label}
                            className={`group relative flex items-center justify-center p-2.5 rounded-lg transition-all duration-300 ${isActive
                                ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30'
                                : 'text-[#666] hover:text-[#fff] hover:bg-[#111]'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[26px] md:text-[22px] transition-transform duration-300 group-hover:-translate-y-1">
                                {icon}
                            </span>
                            {/* Mobile Label */}
                            <span className={`absolute bottom-0 text-[9px] font-medium transition-all duration-300 md:hidden ${isActive ? 'opacity-100 text-[var(--color-primary)]' : 'opacity-0 translate-y-1'}`}>
                                {label}
                            </span>
                            {/* Desktop Tooltip */}
                            <span className="absolute left-14 bg-[#111] text-white text-[10px] font-mono px-2 py-1 rounded hidden md:group-hover:block border border-[#222] whitespace-nowrap z-50 pointer-events-none">
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Bottom: Settings + Avatar */}
            <div className="mt-auto hidden md:flex flex-col gap-6 items-center">
                <Link href="/settings" title="Settings" className={`group relative p-2.5 rounded-lg transition-all duration-300 ${pathname === '/settings'
                    ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30'
                    : 'text-[#666] hover:text-[#fff] hover:bg-[#111]'
                    }`}>
                    <span className="material-symbols-outlined text-[22px] transition-transform duration-300 group-hover:rotate-45">settings</span>
                    <span className="absolute left-14 bg-[#111] text-white text-[10px] font-mono px-2 py-1 rounded hidden md:group-hover:block border border-[#222] whitespace-nowrap z-50 pointer-events-none">
                        Settings
                    </span>
                </Link>
                <div className="w-8 h-8 flex items-center justify-center border border-[#333] bg-[#0A0A0A] text-[10px] font-mono text-[#888] cursor-pointer hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
                    <span className="flex items-baseline">
                        <span className="leading-none">O</span>
                        <span className="relative leading-none">
                            A
                            <span className="absolute bottom-0 right-0 translate-x-[40%] translate-y-[45%] text-[6px] text-[var(--color-primary)] font-medium">c</span>
                        </span>
                    </span>
                </div>
            </div>

            {/* Mobile Settings Icon */}
            <div className="md:hidden flex items-center pr-4">
                <Link href="/settings" className={`p-2 transition-colors ${pathname === '/settings' ? 'text-[var(--color-primary)]' : 'text-[#666] hover:text-white'}`}>
                    <span className="material-symbols-outlined text-[26px]">settings</span>
                </Link>
            </div>
        </nav>
    );
}
