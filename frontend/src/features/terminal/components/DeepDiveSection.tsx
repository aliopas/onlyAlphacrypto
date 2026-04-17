'use client';

import React, { useEffect, useState } from 'react';
import { MasterArticleResponse, TimelineResponse } from '../types';
import { terminalApi } from '../api';
import { AlphaSnapshot } from './AlphaSnapshot';
import { TimelineFeed } from './TimelineFeed';

interface DeepDiveSectionProps {
    symbol: string;
}

const SECTIONS = [
    { label: 'Core Catalyst', key: 'coreCatalyst' as const },
    { label: 'Market Context', key: 'marketContext' as const },
    { label: 'Strategic Impact', key: 'strategicImpact' as const },
    { label: 'Historical Precedent', key: 'historicalContext' as const },
    { label: 'Technical Levels', key: 'technicalLevels' as const },
    { label: 'Risk Assessment', key: 'riskAssessment' as const },
    { label: 'Executive Summary', key: 'bottomLine' as const },
];

export default function DeepDiveSection({ symbol }: DeepDiveSectionProps) {
    const [data, setData] = useState<MasterArticleResponse | null>(null);
    const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function fetchDeepDive() {
            setLoading(true);
            setError(false);
            try {
                const [masterResult, timelineResult] = await Promise.all([
                    terminalApi.getMasterArticle(symbol),
                    terminalApi.getTimeline(symbol, 0, 20),
                ]);
                if (!cancelled) {
                    setData(masterResult);
                    setTimelineData(timelineResult);
                }
            } catch (err) {
                console.error('[DeepDive] Fetch failed:', err);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchDeepDive();

        return () => { cancelled = true; };
    }, [symbol]);

    if (loading) {
        return null;
    }

    if (error || !data?.masterArticle) {
        return (
            <div className="mt-8 border-t border-[#222] pt-8">
                <div className="text-center opacity-40 py-8">
                    <span className="material-symbols-outlined text-[#555] text-3xl mb-3 block">cloud_off</span>
                    <p className="text-[#555] font-mono text-sm">Deep dive unavailable for ${symbol}</p>
                </div>
            </div>
        );
    }

    const article = data.masterArticle;
    const sections = SECTIONS
        .map(s => ({ label: s.label, content: article[s.key] }))
        .filter(s => s.content);

    return (
        <div className="mt-8 border-t border-[#222] pt-8 animate-fade-in" id="deep-dive-section">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-sm" />
                <h2 className="text-sm font-mono tracking-widest text-[#888] uppercase">
                    Deep Dive Analysis
                </h2>
                <span className="text-[10px] font-mono text-[#444] ml-auto uppercase tracking-widest">
                    7-Section Intelligence Report
                </span>
            </div>

            <AlphaSnapshot article={article} />

            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg shadow-2xl relative overflow-hidden group mb-6">
                <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6 text-white">
                        {article.headline}
                    </h2>

                    <div className="space-y-0 divide-y divide-[#222] border-t border-[#222]">
                        {sections.map((section, index) => (
                            <details
                                key={section.label}
                                open={true}
                                className="group"
                            >
                                <summary className="cursor-pointer text-sm font-mono tracking-widest text-[#888] uppercase py-3 hover:text-white transition-colors select-none list-none flex items-center justify-between">
                                    <span className="flex items-center gap-3">
                                        <span className="w-1 h-3 rounded-sm bg-emerald-500" />
                                        {section.label}
                                    </span>
                                    <span className="material-symbols-outlined text-[14px] text-[#555] group-open:rotate-180 transition-transform">
                                        expand_more
                                    </span>
                                </summary>
                                <p className="text-[#CCC] leading-relaxed text-[15px] pl-4 pb-4 whitespace-pre-line">
                                    {section.content}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </div>

            <TimelineFeed
                symbol={symbol}
                initialUpdates={timelineData?.updates || []}
                initialTotal={timelineData?.total || 0}
            />
        </div>
    );
}
