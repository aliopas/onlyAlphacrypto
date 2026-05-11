'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ShadowStats {
    totalSignals: number;
    resolved72h: number;
    algorithmWins72h: number;
    aiWins72h: number;
    resolved7d: number;
    algorithmWins7d: number;
    aiWins7d: number;
    agreeingSignals: number;
    disagreeingSignals: number;
    algorithmDisagreementWinRate: number | null;
}

interface ShadowSignal {
    id: number;
    coinSymbol: string;
    algorithmVerdict: string;
    aiVerdict: string;
    algorithmEntry: number;
    aiEntry: number;
    algorithmTp: number | null;
    algorithmSl: number | null;
    aiTp: number | null;
    aiSl: number | null;
    qualityScore: number | null;
    trendContext: string | null;
    agreement: boolean;
    price72h: number | null;
    price7d: number | null;
    algorithmPnl72h: number | null;
    aiPnl72h: number | null;
    algorithmWin72h: boolean | null;
    aiWin72h: boolean | null;
    algorithmPnl7d: number | null;
    aiPnl7d: number | null;
    algorithmWin7d: boolean | null;
    aiWin7d: boolean | null;
    winner: string | null;
    createdAt: string;
    resolvedAt: string | null;
}

export default function ShadowDashboard() {
    const [stats, setStats] = useState<ShadowStats | null>(null);
    const [signals, setSignals] = useState<ShadowSignal[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);

    // Filters
    const [coinFilter, setCoinFilter] = useState('');
    const [agreementFilter, setAgreementFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Filter refs to prevent keystroke-triggered API calls
    const coinFilterRef = useRef('');
    const agreementFilterRef = useRef('');
    const statusFilterRef = useRef('');
    const startDateRef = useRef('');
    const endDateRef = useRef('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalSignals, setTotalSignals] = useState(0);

    // Load session from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('adminSessionToken');
        if (stored) {
            setSessionToken(stored);
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };

        if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers,
        });

        if (response.status === 404) {
            setIsAuthenticated(false);
            setSessionToken(null);
            localStorage.removeItem('adminSessionToken');
            throw new Error('Not authenticated');
        }

        return response;
    }, [sessionToken]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetchWithAuth('/admin/shadow/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            setStats(data);
        } catch (err) {
            if ((err as Error).message === 'Not authenticated') {
                setError('Please login to view shadow mode statistics');
            } else {
                setError('Failed to load statistics');
            }
        }
    }, [fetchWithAuth]);

    const fetchSignals = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (coinFilterRef.current) params.append('coin', coinFilterRef.current);
            if (agreementFilterRef.current) params.append('agreement', agreementFilterRef.current);
            if (statusFilterRef.current) params.append('status', statusFilterRef.current);
            if (startDateRef.current) params.append('startDate', startDateRef.current);
            if (endDateRef.current) params.append('endDate', endDateRef.current);
            params.append('page', String(currentPage));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/shadow/signals?${params}`);
            if (!response.ok) throw new Error('Failed to fetch signals');
            const data = await response.json();
            setSignals(data.signals);
            setTotalSignals(data.pagination.total);
            setTotalPages(data.pagination.totalPages);
        } catch (err) {
            if ((err as Error).message === 'Not authenticated') {
                setError('Please login to view shadow mode statistics');
            } else {
                setError('Failed to load signals');
            }
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, currentPage]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);

        try {
            const response = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }

            const data = await response.json();
            setSessionToken(data.sessionToken);
            setIsAuthenticated(true);
            localStorage.setItem('adminSessionToken', data.sessionToken);
            setLoginEmail('');
            setLoginPassword('');
        } catch (err) {
            setLoginError((err as Error).message);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch(`${API_BASE}/admin/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                },
            });
        } catch {
            // Ignore logout errors
        }

        setIsAuthenticated(false);
        setSessionToken(null);
        setStats(null);
        setSignals([]);
        localStorage.removeItem('adminSessionToken');
    };

    useEffect(() => {
        if (isAuthenticated && sessionToken) {
            fetchStats();
            fetchSignals();
        }
    }, [isAuthenticated, sessionToken, currentPage, coinFilter, agreementFilter, statusFilter, startDate, endDate, fetchStats, fetchSignals]);

    const formatPercent = (value: number | null) => value !== null ? `${value.toFixed(1)}%` : 'N/A';

    if (!isAuthenticated) {
        return (
            <div className="container mx-auto p-6">
                <h1 className="text-3xl font-bold mb-6">Shadow Mode Dashboard</h1>
                <div className="bg-[#0A0A0A] border border-[#333] p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1 text-gray-300">Password</label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                                required
                            />
                        </div>
                        {loginError && (
                            <div className="mb-4 text-red-400 text-sm">{loginError}</div>
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

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    const showDecisionHelper = stats !== null && stats.resolved7d >= 20;

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Shadow Mode Dashboard</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            </div>

            {/* Decision Helper Banner */}
            {showDecisionHelper && stats && (
                <div className="bg-[#0A0A0A] border border-[#333] border-l-4 border-blue-500 p-4 mb-6">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-gray-300">
                                <strong>Decision Helper:</strong> With {stats.resolved7d} resolved signals,
                                algorithm disagreement win rate is {formatPercent(stats.algorithmDisagreementWinRate)}.
                                {stats.algorithmDisagreementWinRate !== null && stats.algorithmDisagreementWinRate > 60
                                    ? ' Consider prioritizing algorithm signals in disagreements.'
                                    : ' Continue monitoring — insufficient data for algorithmic preference.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">Algorithm WIN Rate 72h</h3>
                        <p className="text-2xl">{formatPercent(stats.algorithmWins72h / Math.max(stats.resolved72h, 1) * 100)}</p>
                        <p className="text-sm text-gray-400">{stats.algorithmWins72h}/{stats.resolved72h} wins</p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">AI WIN Rate 72h</h3>
                        <p className="text-2xl">{formatPercent(stats.aiWins72h / Math.max(stats.resolved72h, 1) * 100)}</p>
                        <p className="text-sm text-gray-400">{stats.aiWins72h}/{stats.resolved72h} wins</p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">Total Signals</h3>
                        <p className="text-2xl">{stats.totalSignals}</p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">Agreeing</h3>
                        <p className="text-2xl">{stats.agreeingSignals}</p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">Disagreeing</h3>
                        <p className="text-2xl">{stats.disagreeingSignals}</p>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded">
                        <h3 className="text-lg font-semibold text-white">Algorithm Disagreement WIN Rate</h3>
                        <p className="text-2xl">{formatPercent(stats.algorithmDisagreementWinRate)}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input
                        type="text"
                        placeholder="Coin (e.g., BTC)"
                        value={coinFilter}
                        onChange={(e) => {
                            setCoinFilter(e.target.value);
                            coinFilterRef.current = e.target.value;
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white placeholder-gray-500"
                    />
                    <select
                        value={agreementFilter}
                        onChange={(e) => {
                            setAgreementFilter(e.target.value);
                            agreementFilterRef.current = e.target.value;
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="">All Agreements</option>
                        <option value="true">Agreeing</option>
                        <option value="false">Disagreeing</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            statusFilterRef.current = e.target.value;
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="">All Status</option>
                        <option value="unresolved">Unresolved</option>
                        <option value="resolved">Resolved</option>
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value);
                            startDateRef.current = e.target.value;
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value);
                            endDateRef.current = e.target.value;
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    />
                </div>
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={() => {
                            setCurrentPage(1);
                        }}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Apply Filters
                    </button>
                    {(coinFilter || agreementFilter || statusFilter || startDate || endDate) && (
                        <button
                            onClick={() => {
                                setCoinFilter('');
                                setAgreementFilter('');
                                setStatusFilter('');
                                setStartDate('');
                                setEndDate('');
                                coinFilterRef.current = '';
                                agreementFilterRef.current = '';
                                statusFilterRef.current = '';
                                startDateRef.current = '';
                                endDateRef.current = '';
                                setCurrentPage(1);
                            }}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-4">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1">
                        Page {currentPage} of {totalPages} ({totalSignals} total)
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Signals Table */}
            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-x-auto">
                <table className="w-full table-auto">
                    <thead>
                        <tr className="bg-[#111] text-gray-300">
                            <th className="px-4 py-2 text-left">ID</th>
                            <th className="px-4 py-2 text-left">Coin</th>
                            <th className="px-4 py-2 text-left">Algorithm</th>
                            <th className="px-4 py-2 text-left">AI</th>
                            <th className="px-4 py-2 text-left">Agreement</th>
                            <th className="px-4 py-2 text-left">Quality</th>
                            <th className="px-4 py-2 text-left">Winner</th>
                            <th className="px-4 py-2 text-left">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {signals.map((signal) => (
                            <tr key={signal.id} className="border-t border-[#222] text-gray-400">
                                <td className="px-4 py-2">{signal.id}</td>
                                <td className="px-4 py-2">{signal.coinSymbol}</td>
                                <td className="px-4 py-2">{signal.algorithmVerdict}</td>
                                <td className="px-4 py-2">{signal.aiVerdict}</td>
                                <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded text-sm ${
                                        signal.agreement ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                    }`}>
                                        {signal.agreement ? 'Agree' : 'Disagree'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">{signal.qualityScore ?? 'N/A'}</td>
                                <td className="px-4 py-2">{signal.winner ?? 'Pending'}</td>
                                <td className="px-4 py-2">{new Date(signal.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}