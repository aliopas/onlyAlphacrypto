'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/', icon: 'home', label: 'Home', disabled: false },
    { href: '/terminal', icon: 'terminal', label: 'Terminal', disabled: false },
    { href: '/airdrops', icon: 'flight_takeoff', label: 'Airdrops', disabled: true }
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
            <div className="w-full h-full pt-1 md:pt-0 grid grid-cols-4 md:flex md:flex-col md:gap-6 md:px-0 items-center justify-items-center md:justify-start md:h-auto">
                {NAV_ITEMS.map(({ href, icon, label, disabled }) => {
                    const isActive = !disabled && (pathname === href || (href !== '/' && pathname.startsWith(href)));
                    const navClassName = `group relative flex w-full h-full md:h-auto md:w-auto items-center justify-center p-2.5 rounded-lg transition-all duration-300 ${disabled
                        ? 'text-[#333] cursor-not-allowed'
                        : isActive
                            ? 'text-[var(--color-primary)] md:bg-[var(--color-primary)]/10 md:ring-1 md:ring-[var(--color-primary)]/30'
                            : 'text-[#666] hover:text-[#fff] hover:bg-[#111]'
                        }`;
                    const innerContent = (
                        <>
                            <span className={`material-symbols-outlined text-[26px] md:text-[22px] transition-transform duration-300 ${disabled ? '' : 'group-hover:-translate-y-1'} ${isActive ? 'text-[var(--color-primary)] md:text-[var(--color-primary)]' : ''}`}>
                                {icon}
                            </span>
                            {disabled && (
                                <span className="absolute top-1 right-1 md:top-0 md:right-auto md:left-[30px] text-[7px] md:text-[8px] font-mono text-[#555] border border-[#333] px-1.5 py-0 leading-none">SOON</span>
                            )}
                            <span className={`absolute bottom-1 text-[10px] font-medium transition-all duration-300 md:hidden pt-4 ${isActive ? 'opacity-100 text-[var(--color-primary)]' : 'opacity-0 translate-y-1'}`}>
                                {label}
                            </span>
                            <span className="absolute left-14 bg-[#111] text-white text-[10px] font-mono px-2 py-1 rounded hidden md:group-hover:block border border-[#222] whitespace-nowrap z-50 pointer-events-none">
                                {disabled ? 'Coming Soon' : label}
                            </span>
                        </>
                    );

                    if (disabled) {
                        return (
                            <div key={href} title={label} className={navClassName}>
                                {innerContent}
                            </div>
                        );
                    }

                    return (
                        <Link key={href} href={href} title={label} className={navClassName}>
                            {innerContent}
                        </Link>
                    );
                })}

                {/* Mobile Settings Icon (Integrated into Grid for perfect symmetry) */}
                <div 
                    title="Settings"
                    className="md:hidden group relative flex w-full h-full items-center justify-center p-2.5 rounded-lg transition-all duration-300 text-[#333] cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[26px]">
                        settings
                    </span>
                    <span className="absolute top-1 right-1 text-[7px] font-mono text-[#555] border border-[#333] px-1.5 py-0 leading-none">SOON</span>
                    <span className="absolute bottom-1 text-[10px] font-medium text-[#333] md:hidden pt-4">
                        Settings
                    </span>
                </div>
            </div>

            {/* Bottom: Settings + Avatar (Desktop Only) */}
            <div className="mt-auto hidden md:flex flex-col gap-6 items-center">
                <div title="Settings" className="group relative p-2.5 rounded-lg transition-all duration-300 text-[#333] cursor-not-allowed">
                    <span className="material-symbols-outlined text-[22px]">settings</span>
                    <span className="absolute -top-1 -right-1 text-[7px] font-mono text-[#555] border border-[#333] px-1.5 py-0 leading-none">SOON</span>
                    <span className="absolute left-14 bg-[#111] text-white text-[10px] font-mono px-2 py-1 rounded hidden md:group-hover:block border border-[#222] whitespace-nowrap z-50 pointer-events-none">
                        Coming Soon
                    </span>
                </div>
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
        </nav>
    );
}
