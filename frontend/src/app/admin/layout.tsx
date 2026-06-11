'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth, AdminAuthProvider } from './hooks/useAdminAuth';
import AdminNav from './components/AdminNav';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, loginError, login, logout } = useAdminAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && isAuthenticated && pathname === '/admin') {
            router.replace('/admin/shadow');
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        try {
            await login(email, password);
        } catch {
            setLocalError(loginError || 'Login failed');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <div className="w-full max-w-md p-6 bg-[#0A0A0A] border border-[#333] rounded-lg">
                    <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-300">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                                required
                            />
                        </div>
                        {(localError || loginError) && (
                            <div className="mb-4 text-red-400 text-sm">{localError || loginError}</div>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-black text-white">
            <AdminNav onLogout={logout} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminAuthProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </AdminAuthProvider>
    );
}
