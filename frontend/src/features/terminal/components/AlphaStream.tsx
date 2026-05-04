'use client';

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';
import { terminalApi } from '@/features/terminal/api';
import { DeepDiveSkeleton } from './DeepDiveSkeleton';

const DeepDiveSection = lazy(() => import('./DeepDiveSection'));

type SectionName = 'HOOK' | 'WHAT HAPPENED' | 'WHY IT MATTERS' | 'HISTORY REPEATS' | 'PRICE PICTURE' | 'RISK CHECK' | 'BOTTOM LINE';

const SECTION_ORDER: SectionName[] = [
    'HOOK', 'WHAT HAPPENED', 'WHY IT MATTERS',
    'HISTORY REPEATS', 'PRICE PICTURE', 'RISK CHECK', 'BOTTOM LINE',
];

const SECTION_LABELS: Record<SectionName, string> = {
    'HOOK': 'Core Catalyst',
    'WHAT HAPPENED': 'Market Context',
    'WHY IT MATTERS': 'Strategic Impact',
    'HISTORY REPEATS': 'Historical Precedent',
    'PRICE PICTURE': 'Technical Levels',
    'RISK CHECK': 'Risk Assessment',
    'BOTTOM LINE': 'Data Synthesis',
};

function parseArticleSections(summary: string): Array<{ key: SectionName; label: string; content: string }> {
    const sections: Array<{ key: SectionName; label: string; content: string }> = [];

    for (let i = 0; i < SECTION_ORDER.length; i++) {
        const sectionName = SECTION_ORDER[i];
        const tagPlain = `[${sectionName}]`;
        const tagQuestion = `[${sectionName}?]`;
        const startIndex = summary.indexOf(tagPlain) !== -1 ? summary.indexOf(tagPlain) : summary.indexOf(tagQuestion);
        if (startIndex === -1) continue;

        const matchedTag = summary.indexOf(tagPlain) !== -1 ? tagPlain : tagQuestion;
        const contentStart = startIndex + matchedTag.length;
        let endIndex = summary.length;
        for (let j = i + 1; j < SECTION_ORDER.length; j++) {
            const nextSection = SECTION_ORDER[j];
            const nextPlain = `[${nextSection}]`;
            const nextQuestion = `[${nextSection}?]`;
            const nextIdx = summary.indexOf(nextPlain, contentStart) !== -1
                ? summary.indexOf(nextPlain, contentStart)
                : summary.indexOf(nextQuestion, contentStart);
            if (nextIdx !== -1 && nextIdx < endIndex) {
                endIndex = nextIdx;
                break;
            }
        }

        const content = summary.slice(contentStart, endIndex).trim();
        if (content) {
            sections.push({
                key: sectionName,
                label: SECTION_LABELS[sectionName],
                content,
            });
        }
    }

    if (sections.length === 0) {
        return [{
            key: 'WHAT HAPPENED',
            label: 'Analysis',
            content: summary,
        }];
    }

    return sections;
}

interface Props {
    newsId?: number | null;
    radarSignal?: RadarSignal | null;
}

export function AlphaStream({ newsId, radarSignal }: Props) {
    const [article, setArticle] = useState<CoinNews | null>(null);
    const [loading, setLoading] = useState(false);
    const [showDeepDive, setShowDeepDive] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // If we are given a radar signal directly, we don't need to fetch news.
        if (radarSignal) {
            setArticle(null);
            return;
        }

        if (!newsId) {
            setArticle(null);
            return;
        }

        async function fetchArticle() {
            setLoading(true);
            try {
                const data = await terminalApi.getNewsById(newsId!);
                setArticle(data);
            } catch (err) {
                console.error("Failed to load article details", err);
            } finally {
                setLoading(false);
            }
        }

        fetchArticle();
    }, [newsId, radarSignal]);

    // Fallback View (When no wire card or radar card is clicked)
    if (!newsId && !radarSignal) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="text-center opacity-40">
                    <div className="w-24 h-24 border border-dashed border-[#555] rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-medium text-white mb-2">Alpha Stream Standby</h2>
                    <p className="text-[#888] font-mono text-sm">Select an event from the timeline to initiate deep analysis.</p>
                </div>
            </div>
        );
    }

    if (loading && !radarSignal) {
        return (
            <div className="flex-1 flex flex-col p-8 xl:p-12 relative items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <span className="text-[#888] font-mono text-sm">Loading Intelligence...</span>
                </div>
            </div>
        );
    }

    // Determine the data payload (News or Radar)
    const displayCoin = radarSignal ? radarSignal.coin : article?.coin;
    const displaySentiment = radarSignal ? radarSignal.sentiment : article?.sentiment;
    const displayDate = radarSignal ? radarSignal.createdAt : article?.createdAt;
    const displayHeadline = radarSignal ? "Verified Alpha Catalyst" : article?.headline;
    const displayBody = radarSignal ? radarSignal.signal : article?.summary;
    const isRadarType = !!radarSignal;
    const sections = !isRadarType && article?.summary ? parseArticleSections(article.summary) : [];

    const getSentimentColor = (sentiment?: string) => {
        const s = sentiment?.toLowerCase();
        if (s === 'bullish') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (s === 'bearish') return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        if (s === 'volatile') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-[#135bec] bg-[#135bec]/10 border-[#135bec]/20';
    };

    const scrollToDeepDive = () => {
        if (!showDeepDive) {
            setShowDeepDive(true);
            // Poll for the deep dive element to mount due to lazy loading
            let attempts = 0;
            const maxAttempts = 100; // ~1.67 seconds at 60fps
            const pollForElement = () => {
                const element = document.getElementById('deep-dive-section');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else if (attempts < maxAttempts) {
                    attempts++;
                    requestAnimationFrame(pollForElement);
                }
            };
            requestAnimationFrame(pollForElement);
        } else {
            document.getElementById('deep-dive-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 xl:p-12 overflow-y-auto scrollbar-hidden relative animate-fade-in" ref={scrollContainerRef}>
            {/* Header / Meta */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                {displayCoin && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#333] flex items-center justify-center text-xs font-bold text-white">
                            {displayCoin[0]}
                        </div>
                        <span className="text-lg font-bold text-white tracking-wide">${displayCoin}</span>
                    </div>
                )}

                {isRadarType && (
                    <span className="px-3 py-1 text-xs font-mono uppercase tracking-wider border rounded-sm text-amber-500 bg-amber-500/10 border-amber-500/20">
                        RADAR TARGET
                    </span>
                )}

                {displaySentiment && (
                    <span className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border rounded-sm ${getSentimentColor(displaySentiment)}`}>
                        {displaySentiment}
                    </span>
                )}

                {displayDate && (
                    <span className="text-xs font-mono text-[#666] ml-auto">
                        Signal acquired at {new Date(displayDate).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Headline */}
            <div className="flex items-start justify-between gap-4 mb-8">
                <h1 className="text-3xl xl:text-4xl font-semibold text-white leading-tight">
                    {displayHeadline}
                </h1>
                {displayCoin && (
                    <button
                        onClick={scrollToDeepDive}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest border border-emerald-500/30 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[14px]">expand_more</span>
                        Read Deep Dive
                    </button>
                )}
            </div>

            {/* Content Body */}
            <div className="prose prose-invert prose-lg max-w-none">
                <div className="p-6 bg-[#0A0A0A] border border-[#222] rounded-lg shadow-2xl relative overflow-hidden group">
                    {/* Decorative cyber grid background */}
                    <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-1 h-4 rounded-sm ${isRadarType ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <h3 className="text-sm font-mono tracking-widest text-[#888] uppercase m-0">
                            {isRadarType ? 'Synthesized Intelligence' : 'Neural Consensus Verdict'}
                        </h3>
                    </div>

                    {/* Hook sentence if available */}
                    {!isRadarType && article?.hook && (
                        <p className="text-[#00ff88] font-medium text-[14px] mb-3 relative z-10 italic border-l-2 border-[#00ff88]/30 pl-3">
                            {article.hook}
                        </p>
                    )}

                    {!isRadarType && article?.summary ? (
                        <div className="space-y-0 divide-y divide-[#222] border-t border-[#222]">
                            {sections.length > 0 ? sections.map((section) => (
                                <details
                                    key={section.key}
                                    open={true}
                                    className="group"
                                >
                                    <summary className="cursor-pointer text-sm font-mono tracking-widest text-[#888] uppercase py-3 hover:text-white transition-colors select-none list-none flex items-center justify-between">
                                        <span className="flex items-center gap-3">
                                            <span className={`w-1 h-3 rounded-sm bg-emerald-500`} />
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
                            )) : (
                                <p className="text-[#CCC] leading-relaxed text-[15px] py-4 whitespace-pre-line">
                                    {article.summary}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="relative z-10">
                            {isRadarType && radarSignal?.signal && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px]">radar</span>
                                        <span className="text-xs font-mono tracking-widest text-amber-500 uppercase">Market Intelligence</span>
                                    </div>
                                    <p className="text-white leading-relaxed text-[15px] font-medium">
                                        {radarSignal.signal}
                                    </p>
                                </div>
                            )}
                            <p className="text-[#888] leading-relaxed text-[14px] italic">
                                {displayBody && displayBody !== radarSignal?.signal ? displayBody : "Full deep analysis pending. Click 'Full Analysis' to view the living article for this coin."}
                            </p>
                        </div>
                    )}

                    {/* SEO Keywords if available */}
                    {!isRadarType && article?.seoKeywords && article.seoKeywords.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#222] flex flex-wrap gap-2">
                            {article.seoKeywords.map((kw, i) => (
                                <span key={i} className="text-[10px] font-mono px-2 py-0.5 border border-[#333] text-[#555] bg-[#111]">
                                    #{kw}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {displayCoin && showDeepDive && (
                <Suspense fallback={<DeepDiveSkeleton />}>
                    <DeepDiveSection symbol={displayCoin} />
                </Suspense>
            )}

            {/* System Status Footer */}
            <div className="mt-12 flex items-center justify-between pt-6 border-t border-[#222]">
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${isRadarType ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-xs font-mono text-[#555] uppercase tracking-widest">Data Integrity: Verified</span>
                </div>
                <div className="flex items-center gap-4">
                    {displayCoin && (
                        <button
                            onClick={scrollToDeepDive}
                            className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/70 hover:text-emerald-500 transition-colors flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[12px]">timeline</span>
                            Deep Dive
                        </button>
                    )}
                    <div className="text-xs font-mono text-[#555]">
                        {radarSignal ? radarSignal.id : article?.id}-SEQ-HASH
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#222]">
                <div className="flex items-start gap-3 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg">
                    <span className="material-symbols-outlined text-[#444] text-[16px] mt-0.5 shrink-0">shield</span>
                    <div>
                        <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#555] mb-2">Disclaimer</h4>
                        <p className="text-[11px] text-[#555] leading-relaxed">
                            All content on this page is <span className="text-[#888]">AI-generated</span> and for{' '}
                            <span className="text-[#888]">informational purposes only</span>. It does{' '}
                            <span className="text-[#888] font-medium">not</span> constitute financial advice, investment recommendations,
                            or solicitation to buy or sell any asset. OnlyAlpha is{' '}
                            <span className="text-[#888] font-medium">not</span> a registered financial advisor. Always{' '}
                            <span className="text-[#888]">do your own research (DYOR)</span> and consult a licensed
                            professional before making investment decisions.{' '}
                            <span className="text-[#888]">NFA — Not Financial Advice.</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
