'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface AdminAuthState {
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    loginError: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('adminSessionToken');
        if (stored) {
            setToken(stored);
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setLoginError(null);
        try {
            const response = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Login failed');
            }
            const data = await response.json();
            setToken(data.sessionToken);
            setIsAuthenticated(true);
            localStorage.setItem('adminSessionToken', data.sessionToken);
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Login failed');
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            if (token) {
                await fetch(`${API_BASE}/admin/logout`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
        } catch {
            // ignore
        }
        setToken(null);
        setIsAuthenticated(false);
        localStorage.removeItem('adminSessionToken');
    }, [token]);

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
        if (response.status === 404) {
            setIsAuthenticated(false);
            setToken(null);
            localStorage.removeItem('adminSessionToken');
            throw new Error('Not authenticated');
        }
        return response;
    }, [token]);

    return (
        <AdminAuthContext.Provider value={{ token, isAuthenticated, isLoading, loginError, login, logout, fetchWithAuth }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth(): AdminAuthState {
    const ctx = useContext(AdminAuthContext);
    if (!ctx) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }
    return ctx;
}
