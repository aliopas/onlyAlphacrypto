'use client';

import { useState } from 'react';
import { Network, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/features/shared/api/client';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const endpoint = isLogin ? '/user/auth/login' : '/user/auth/register';

        try {
            const { data } = await apiClient.post(endpoint, { email, password });

            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Custom event so Navbar can pick up the token change
                window.dispatchEvent(new Event('auth-change'));

                router.push('/');
                router.refresh();
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-md glass-card rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Network className="w-8 h-8 text-primary" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight mb-2 text-glow">
                        {isLogin ? 'Welcome Back' : 'Join OnlyAlpha'}
                    </h1>
                    <p className="text-muted-foreground text-center mb-8 text-sm">
                        {isLogin ? 'Login to access your AI market scenarios and airdrops.' : 'Create an account to track airdrops and view AI market analysis.'}
                    </p>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        {error && (
                            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-input/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 focus:bg-input transition-all"
                                placeholder="trader@example.com"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-input/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 focus:bg-input transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !email || !password}
                            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(0,230,118,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-muted-foreground">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-primary font-semibold hover:underline"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
