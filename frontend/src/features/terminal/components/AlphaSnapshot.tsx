'use client';

import React from 'react';
import { MasterArticle } from '../types';

interface AlphaSnapshotProps {
    article: MasterArticle;
}

export const AlphaSnapshot: React.FC<AlphaSnapshotProps> = ({ article }) => {
    const getConvictionColor = (score: number) => {
        if (score < 30) return 'bg-red-500';
        if (score < 60) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getPostureColor = (posture: string) => {
        switch (posture.toLowerCase()) {
            case 'bullish': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'bearish': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            case 'cautious': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'neutral': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            default: return 'text-[#888] bg-[#111] border-[#333]';
        }
    };

    const getSentimentColor = (sentiment: string | null) => {
        const s = sentiment?.toLowerCase();
        if (s === 'bullish' || s === 'positive') return 'text-emerald-500';
        if (s === 'bearish' || s === 'negative') return 'text-rose-500';
        if (s === 'volatile') return 'text-amber-500';
        return 'text-[#888]';
    };

    return (
        <div className="bg-[#0A0A0A] border border-[#333] rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Alpha Snapshot</h2>
                <span className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border rounded-sm ${getPostureColor(article.posture || 'N/A')}`}>
                    {article.posture || 'N/A'}
                </span>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm text-[#888] mb-1">
                    <span>Conviction Score</span>
                    <span>{article.convictionScore || 0}/100</span>
                </div>
                <div className="w-full bg-[#111] rounded-full h-2">
                    <div
                        className={`h-2 rounded-full ${getConvictionColor(article.convictionScore || 0)}`}
                        style={{ width: `${article.convictionScore || 0}%` }}
                    />
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-lg font-medium text-white mb-2">Verdict</h3>
                <p className={`text-lg ${getSentimentColor(article.sentiment)}`}>
                    {article.verdict}
                </p>
            </div>

            {article.riskTags && article.riskTags.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-sm font-medium text-[#888] mb-2">Risk Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {article.riskTags.map((tag, index) => (
                            <span
                                key={index}
                                className="text-[10px] font-mono px-2 py-0.5 border border-[#333] text-[#888] bg-[#111]"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between text-[10px] font-mono text-[#555]">
                <span>Major: {article.majorUpdateCount}</span>
                <span>Minor: {article.minorUpdateCount}</span>
            </div>

            {article.bottomLine && (
                <div className="mt-4 pt-3 border-t border-[#333]">
                    <p className="text-[#888] italic line-clamp-2">{article.bottomLine}</p>
                </div>
            )}
        </div>
    );
};