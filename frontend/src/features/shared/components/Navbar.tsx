'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Network, Search, Bell, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Navbar() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check auth status on mount and listen to changes
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('token');
            setIsAuthenticated(!!token);
        };

        checkAuth();

        // Listen for custom login/logout events
        window.addEventListener('auth-change', checkAuth);
        window.addEventListener('unauthorized', () => {
            localStorage.removeItem('token');
            setIsAuthenticated(false);
            router.push('/auth');
        });

        return () => {
            window.removeEventListener('auth-change', checkAuth);
            window.removeEventListener('unauthorized', checkAuth);
        };
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-change'));
        router.push('/auth');
    };

    return (
        <header className="sticky top-0 z-40 w-full glass border-b border-border/40 pb-0">
            <div className="flex h-16 items-center px-6 justify-between">
                <div className="flex items-center gap-2 md:hidden">
                    <Network className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg text-glow tracking-tight">OnlyAlpha</span>
                </div>

                <div className="hidden md:flex flex-1" />

                <div className="flex items-center gap-4">
                    <div className="relative group hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search coins, airdrops..."
                            className="h-10 w-64 rounded-full bg-input/50 pl-10 pr-4 text-sm border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground"
                        />
                    </div>

                    <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors">
                        <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </button>

                    <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
                        <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>

                    {isAuthenticated ? (
                        <button
                            onClick={handleLogout}
                            className="ml-2 flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all text-muted-foreground"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    ) : (
                        <Link
                            href="/auth"
                            className="ml-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(0,230,118,0.3)] hover:shadow-[0_0_25px_rgba(0,230,118,0.5)] transition-all"
                        >
                            Connect Wallet
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
