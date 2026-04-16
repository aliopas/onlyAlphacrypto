'use client';

import React, { useState } from 'react';
import { TimelineUpdate } from '../types';
import { terminalApi } from '../api';

const stripPromptTags = (text: string) => {
    return text.replace(/\[[^\]]+\]/g, '').trim();
};

interface TimelineFeedProps {
    symbol: string;
    initialUpdates: TimelineUpdate[];
    initialTotal: number;
}

export const TimelineFeed: React.FC<TimelineFeedProps> = ({
    symbol,
    initialUpdates,
    initialTotal,
}) => {
    const [updates, setUpdates] = useState<TimelineUpdate[]>(initialUpdates);
    const [offset, setOffset] = useState(initialUpdates.length);
    const [hasMore, setHasMore] = useState(initialUpdates.length < initialTotal);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const loadMore = async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
            const response = await terminalApi.getTimeline(symbol, offset, 20);
            const newUpdates = response.updates.filter(update =>
                !updates.some(existing => existing.id === update.id)
            );

            setUpdates(prev => [...prev, ...newUpdates]);
            setOffset(prev => prev + newUpdates.length);
            setHasMore(offset + newUpdates.length < response.total);
        } catch (error) {
            console.error('Failed to load more timeline updates:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'major': return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
            case 'minor': return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
            default: return 'bg-[#111] border-[#333] text-[#888]';
        }
    };

    const getTimeAgo = (dateString: string) => {
        const now = new Date().getTime();
        const created = new Date(dateString).getTime();
        const minutes = Math.floor((now - created) / 60000);
        return `${minutes}m ago`;
    };

    if (updates.length === 0) {
        return (
            <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 text-center">
                <p className="text-[#555]">No timeline events yet</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Timeline Updates</h3>

            <div className="space-y-4">
                {updates.map((update) => (
                    <div key={update.id} className="border-l-4 border-[#333] pl-4 py-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wider border ${getSeverityBg(update.severity)}`}>
                                {update.severity}
                            </span>
                            {update.triggerType && (
                                <span className="text-xs text-[#888] font-mono">
                                    {update.triggerType}
                                </span>
                            )}
                            <span className="text-xs text-[#555] font-mono ml-auto">
                                {getTimeAgo(update.createdAt)}
                            </span>
                        </div>

                        <p className="text-[#CCC] line-clamp-3">{stripPromptTags(update.updateText)}</p>

                        {update.sourceTitle && (
                            <p className="text-sm text-[#555] mt-1">
                                {update.sourceTitle}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {hasMore && (
                <div className="mt-6 text-center">
                    <button
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="px-4 py-2 bg-[#111] border border-[#333] text-[#888] rounded hover:bg-[#1A1A1A] disabled:opacity-50 font-mono text-sm"
                    >
                        {isLoadingMore ? (
                            <>
                                <div className="w-4 h-4 border border-[#333] border-t-[#888] rounded-full animate-spin inline-block mr-2" />
                                Loading...
                            </>
                        ) : (
                            'Load More'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};