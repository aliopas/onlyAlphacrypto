'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface PortfolioPostRow {
    id: number;
    messageId: string;
    content: string | null;
    imageUrl: string | null;
    isAnalyzed: boolean;
    extractedSymbols: string | null;
    analyzedAt: string | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface ProcessSymbolResult {
    symbol: string;
    outcome: 'added_active' | 'added_watchlist' | 'rejected' | 'skipped_exists' | 'failed';
    reason?: string;
    coinId?: number;
}

interface ProcessPostResult {
    postId: number;
    messageId: string;
    results: ProcessSymbolResult[];
    summary: {
        added: number;
        watchlisted: number;
        rejected: number;
        skipped: number;
        failed: number;
    };
}

export default function PortfolioPostsPage() {
    const { fetchWithAuth } = useAdminAuth();
    const [posts, setPosts] = useState<PortfolioPostRow[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [analyzedFilter, setAnalyzedFilter] = useState('');
    const [page, setPage] = useState(1);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [lastResult, setLastResult] = useState<ProcessPostResult | null>(null);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (analyzedFilter === 'true' || analyzedFilter === 'false') {
                params.append('analyzed', analyzedFilter);
            }
            params.append('page', String(page));
            params.append('limit', '50');

            const response = await fetchWithAuth(`/admin/portfolio/posts?${params}`);
            if (!response.ok) throw new Error('Failed to fetch posts');
            const data = await response.json() as {
                posts: PortfolioPostRow[];
                pagination: Pagination;
            };
            setPosts(data.posts);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load posts');
        } finally {
            setLoading(false);
        }
    }, [fetchWithAuth, analyzedFilter, page]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleProcess = async (postId: number) => {
        setProcessingId(postId);
        setMessage(null);
        setLastResult(null);
        try {
            const response = await fetchWithAuth(`/admin/portfolio/posts/${postId}/process`, {
                method: 'POST',
            });
            const data = await response.json() as ProcessPostResult & { error?: string };
            if (!response.ok) {
                throw new Error(data.error || 'Process failed');
            }
            setLastResult(data);
            const s = data.summary;
            setMessage(
                `Post #${data.postId}: +${s.added} active, ${s.watchlisted} watchlist, ${s.rejected} rejected, ${s.skipped} skipped, ${s.failed} failed`
            );
            fetchPosts();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Process failed');
        } finally {
            setProcessingId(null);
        }
    };

    const outcomeClass = (outcome: ProcessSymbolResult['outcome']): string => {
        switch (outcome) {
            case 'added_active':
                return 'text-green-400';
            case 'added_watchlist':
                return 'text-yellow-400';
            case 'rejected':
                return 'text-red-400';
            case 'skipped_exists':
                return 'text-gray-400';
            case 'failed':
                return 'text-red-500';
            default:
                return 'text-gray-300';
        }
    };

    const truncate = (text: string | null, max: number): string => {
        if (!text) return '—';
        return text.length > max ? `${text.slice(0, max)}…` : text;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Portfolio Posts</h1>
            </div>

            {message && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-blue-400">
                    {message}
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400">
                    {error}
                </div>
            )}

            {lastResult && lastResult.results.length > 0 && (
                <div className="mb-6 bg-[#0A0A0A] border border-[#333] rounded p-4">
                    <h2 className="text-sm font-semibold text-gray-300 mb-2">
                        Last process results — post #{lastResult.postId} (msg {lastResult.messageId})
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto text-sm">
                            <thead>
                                <tr className="text-gray-400 border-b border-[#333]">
                                    <th className="px-2 py-1 text-left">Symbol</th>
                                    <th className="px-2 py-1 text-left">Outcome</th>
                                    <th className="px-2 py-1 text-left">Reason</th>
                                    <th className="px-2 py-1 text-left">Coin ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lastResult.results.map((r) => (
                                    <tr key={`${r.symbol}-${r.outcome}`} className="border-b border-[#222]">
                                        <td className="px-2 py-1 text-white font-mono">{r.symbol}</td>
                                        <td className={`px-2 py-1 ${outcomeClass(r.outcome)}`}>{r.outcome}</td>
                                        <td className="px-2 py-1 text-gray-400">{r.reason ?? '—'}</td>
                                        <td className="px-2 py-1 text-gray-400">{r.coinId ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-[#0A0A0A] border border-[#333] p-4 rounded mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select
                        value={analyzedFilter}
                        onChange={(e) => {
                            setAnalyzedFilter(e.target.value);
                            setPage(1);
                        }}
                        className="border border-[#333] bg-[#0D0D0D] p-2 rounded text-white"
                    >
                        <option value="">All posts</option>
                        <option value="true">Analyzed only</option>
                        <option value="false">Not analyzed</option>
                    </select>
                </div>
            </div>

            <div className="bg-[#0A0A0A] border border-[#333] rounded overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#111] text-gray-300">
                                <th className="px-3 py-2 text-left">ID</th>
                                <th className="px-3 py-2 text-left">Message</th>
                                <th className="px-3 py-2 text-left">Content</th>
                                <th className="px-3 py-2 text-left">Symbols</th>
                                <th className="px-3 py-2 text-left">Analyzed</th>
                                <th className="px-3 py-2 text-left">Created</th>
                                <th className="px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading && posts.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                                        No posts found
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                posts.map((post) => (
                                    <tr key={post.id} className="border-t border-[#222] hover:bg-[#111]">
                                        <td className="px-3 py-2 text-gray-400">{post.id}</td>
                                        <td className="px-3 py-2 font-mono text-sm text-white">
                                            {post.messageId}
                                        </td>
                                        <td className="px-3 py-2 text-gray-400 text-sm max-w-xs">
                                            {truncate(post.content, 80)}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-sm text-blue-300">
                                            {post.extractedSymbols || '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={
                                                    post.isAnalyzed ? 'text-green-400' : 'text-yellow-400'
                                                }
                                            >
                                                {post.isAnalyzed ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 text-xs">
                                            {post.createdAt
                                                ? new Date(post.createdAt).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                onClick={() => handleProcess(post.id)}
                                                disabled={processingId === post.id}
                                                className="px-3 py-1 text-sm bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                            >
                                                {processingId === post.id ? 'Processing…' : 'Process'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-500">
                        Page {pagination.page} / {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1 border border-[#333] rounded text-sm text-gray-300 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1 border border-[#333] rounded text-sm text-gray-300 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
