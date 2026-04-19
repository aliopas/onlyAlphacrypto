'use client';

import React, { useEffect, useState } from 'react';
import { MasterArticleResponse, TimelineResponse } from '../types';
import { terminalApi } from '../api';
import { AlphaSnapshot } from './AlphaSnapshot';
import { TimelineFeed } from './TimelineFeed';

interface LivingArticleProps {
    symbol: string;
}

export const LivingArticle: React.FC<LivingArticleProps> = ({ symbol }) => {
    const [data, setData] = useState<MasterArticleResponse | null>(null);
    const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [masterResult, timelineResult] = await Promise.all([
                    terminalApi.getMasterArticle(symbol),
                    terminalApi.getTimeline(symbol, 0, 20)
                ]);
                setData(masterResult);
                setTimelineData(timelineResult);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                setData(null);
                setTimelineData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <span className="text-[#888] font-mono text-sm">Compiling Intelligence...</span>
                </div>
            </div>
        );
    }

    if (!data?.masterArticle) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="text-center opacity-40">
                    <h2 className="text-xl font-medium text-white mb-2">No Living Article Found</h2>
                    <p className="text-[#555] font-mono text-sm">{`No living article found for ${symbol}`}</p>
                </div>
            </div>
        );
    }

    const sections = [
        { label: 'Core Catalyst', content: data.masterArticle.coreCatalyst },
        { label: 'Market Context', content: data.masterArticle.marketContext },
        { label: 'Strategic Impact', content: data.masterArticle.strategicImpact },
        { label: 'Historical Precedent', content: data.masterArticle.historicalContext },
        { label: 'Technical Levels', content: data.masterArticle.technicalLevels },
        { label: 'Risk Assessment', content: data.masterArticle.riskAssessment },
        { label: 'Executive Summary', content: data.masterArticle.bottomLine },
    ].filter(section => section.content);

    return (
        <div className="max-w-4xl mx-auto p-6">
            <AlphaSnapshot article={data.masterArticle} />

            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg shadow-2xl relative overflow-hidden group mb-6">
                <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6 text-white">
                        {data.masterArticle.headline}
                    </h2>

                    <div className="space-y-0 divide-y divide-[#222] border-t border-[#222]">
                        {sections.map((section, index) => (
                            <details
                                key={section.label}
                                open={index < 2}
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
};