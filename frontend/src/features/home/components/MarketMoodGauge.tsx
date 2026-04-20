'use client';

import { useState, useEffect } from 'react';
import { MarketMood } from '@/features/home/types';

interface Props {
    mood: MarketMood | null;
    previousScore?: number | null;
    lastUpdated?: string;
}

type MoodTier = {
    label: string;
    color: string;
    glowClass: string;
    borderColor: string;
};

function resolveScore(mood: MarketMood | null): number | null {
    if (!mood) return null;
    if (typeof mood.finalScore === 'number') return mood.finalScore;
    if (typeof mood.score === 'number') return mood.score;
    return null;
}

function getMoodTier(score: number): MoodTier {
    if (score <= 20) {
        return {
            label: 'Extreme Fear',
            color: '#dc2626',
            glowClass: 'shadow-red-glow',
            borderColor: 'border-red-600/20',
        };
    }
    if (score <= 40) {
        return {
            label: 'Fear',
            color: '#ef4444',
            glowClass: 'shadow-red-glow',
            borderColor: 'border-red-400/20',
        };
    }
    if (score <= 59) {
        return {
            label: 'Neutral',
            color: '#eab308',
            glowClass: 'shadow-yellow-glow',
            borderColor: 'border-yellow-500/20',
        };
    }
    if (score <= 80) {
        return {
            label: 'Greed',
            color: '#10b981',
            glowClass: 'shadow-emerald-glow',
            borderColor: 'border-emerald-500/20',
        };
    }
    return {
        label: 'Extreme Greed',
        color: '#00ff88',
        glowClass: 'shadow-emerald-glow',
        borderColor: 'border-[#00ff88]/20',
    };
}

export function MarketMoodGauge({ mood, previousScore, lastUpdated }: Props) {
    const [mounted, setMounted] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipToggled, setTooltipToggled] = useState(false);
    const tooltipVisible = showTooltip || tooltipToggled;

    useEffect(() => {
        setMounted(true);
    }, []);

    const score = resolveScore(mood);

    const hoursSinceUpdate = lastUpdated
        ? (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60)
        : null;
    const isStale = hoursSinceUpdate !== null && hoursSinceUpdate > 24;

    if (score === null) {
        return (
            <div className="bg-[#0A0A0A] border border-[#333] p-6 flex flex-col items-center">
                <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6 w-full text-center">
                    Market Mood
                </h3>
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#555] opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#555]" />
                    </span>
                    <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
                        Syncing...
                    </span>
                </div>
            </div>
        );
    }

    const tier = getMoodTier(score);
    const targetAngle = -180 + (score / 100) * 180;
    const needleAngle = mounted ? targetAngle : -180;

    const isExtreme = score <= 20 || score >= 81;
    const isNeutral = score >= 41 && score <= 59;
    const pulseDuration = isExtreme ? 2 : isNeutral ? 0 : 3;

    return (
        <>
            <style>{`
                @keyframes moodPulse {
                    0%, 100% { box-shadow: 0 0 20px var(--mood-shadow-base), 0 0 40px var(--mood-shadow-faint); }
                    50% { box-shadow: 0 0 20px var(--mood-shadow-bright), 0 0 40px var(--mood-shadow-base); }
                }
            `}</style>
            <div
                className={`bg-[#0A0A0A] border p-6 flex flex-col items-center transition-colors duration-700${isStale ? ' border-dashed' : ''}`}
                style={{
                    '--mood-shadow-base': `${tier.color}33`,
                    '--mood-shadow-bright': `${tier.color}55`,
                    '--mood-shadow-faint': `${tier.color}15`,
                    borderColor: `${tier.color}33`,
                    boxShadow: `0 0 20px ${tier.color}33, 0 0 40px ${tier.color}15`,
                    animation: pulseDuration > 0
                        ? `moodPulse ${pulseDuration}s ease-in-out infinite`
                        : 'none',
                } as React.CSSProperties}
            >
            <div className="flex items-center justify-between w-full mb-4">
                <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] flex-1 text-center">
                    Market Mood
                </h3>
                <button
                    type="button"
                    onClick={() => setTooltipToggled((prev) => !prev)}
                    className="text-[11px] text-[#555] hover:text-[#888] transition-colors leading-none ml-1"
                    aria-label="Toggle score breakdown"
                >
                    ℹ️
                </button>
            </div>

            <div
                className="relative w-full max-w-[220px]"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <svg
                    viewBox="0 0 200 110"
                    className="w-full"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient
                            id="moodGaugeGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                        >
                            <stop offset="0%" stopColor="#dc2626" />
                            <stop offset="50%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#00ff88" />
                        </linearGradient>
                    </defs>

                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#1a1a1a"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />

                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="url(#moodGaugeGradient)"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />

                    <g
                        style={{
                            transform: `rotate(${needleAngle}deg)`,
                            transformOrigin: '100px 100px',
                            transition: mounted
                                ? 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                : 'none',
                        }}
                    >
                        <line
                            x1="100"
                            y1="100"
                            x2="160"
                            y2="100"
                            stroke={tier.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <circle cx="100" cy="100" r="5" fill={tier.color} />
                    </g>
                </svg>

                {tooltipVisible && (
                    <div
                        className="absolute inset-0 bg-[#0A0A0A]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10"
                        style={{ transition: 'opacity 0.3s ease-in-out' }}
                    >
                        <span className="text-[10px] font-mono text-[#aaa]">
                            External Score: {mood?.externalScore ?? '\u2014'}
                        </span>
                        <span className="text-[10px] font-mono text-[#aaa]">
                            OnlyAlpha AI Score: {mood?.internalScore ?? '\u2014'}
                        </span>
                        <span className="text-[10px] font-mono text-[#fff] font-bold">
                            Final: {resolveScore(mood)} (Weighted Blend: 60/40)
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-1 mt-2">
                <span
                    className="text-4xl font-mono"
                    style={{ color: tier.color }}
                >
                    {Math.round(score)}
                </span>
                {typeof previousScore === 'number' && Math.abs(score - previousScore) >= 30 && (
                    <span
                        className="text-[10px] font-mono font-bold"
                        style={{
                            color: score > previousScore ? '#10b981' : '#ef4444',
                        }}
                    >
                        {score > previousScore ? '▲' : '▼'} {Math.abs(Math.round(score - previousScore))}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1 mt-1">
                <span
                    className="text-xs font-mono uppercase tracking-[0.2em]"
                    style={{ color: tier.color }}
                >
                    {tier.label}
                </span>
                {typeof previousScore === 'number' && (
                    <span
                        className="text-xs"
                        style={{
                            color: score > previousScore ? '#10b981' : score < previousScore ? '#ef4444' : '#eab308',
                        }}
                    >
                        {score > previousScore ? '↗' : score < previousScore ? '↘' : '→'}
                    </span>
                )}
            </div>

            {score === 50 && mood?.internalScore == null && (
                <span className="text-[8px] font-mono text-[#666] border border-[#333] px-1.5 py-0.5 mt-2">
                    Based on external data only
                </span>
            )}

            {isStale && (
                <span className="text-[8px] font-mono text-[#eab308] mt-2">
                    Stale Data
                </span>
            )}

            {hoursSinceUpdate !== null && !isStale && (
                <span className="text-[8px] font-mono text-[#555] mt-2">
                    Updated {Math.round(hoursSinceUpdate)}h ago
                </span>
            )}
            </div>
        </>
    );
}
