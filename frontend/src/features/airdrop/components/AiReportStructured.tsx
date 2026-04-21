'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Shield, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

interface Props {
    report: string | null | undefined;
    timestamp?: string | null;
}

interface Section {
    title: string;
    icon: React.ReactNode;
    content: string;
    color: string;
}

const HEADING_KEYWORDS: Array<{ keywords: string[]; title: string; icon: React.ReactNode; color: string }> = [
    { keywords: ['risk', 'risks', 'risk assessment', 'security'], title: 'Risk Assessment', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-orange-400' },
    { keywords: ['legitimate', 'legitimacy', 'authenticity', 'team'], title: 'Legitimacy', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-blue-400' },
    { keywords: ['value', 'valuation', 'worth', 'potential', 'reward'], title: 'Value Analysis', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
    { keywords: ['funding', 'investors', 'backing', 'investment'], title: 'Funding & Backing', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-purple-400' },
    { keywords: ['conclusion', 'summary', 'verdict', 'final', 'overall'], title: 'Summary', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-yellow-400' },
];

function matchHeading(line: string): { title: string; icon: React.ReactNode; color: string } | null {
    const trimmed = line.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim().toLowerCase();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 60) return null;

    for (const h of HEADING_KEYWORDS) {
        for (const kw of h.keywords) {
            if (trimmed === kw || trimmed.startsWith(kw) || trimmed.endsWith(kw) || trimmed.includes(kw)) {
                return { title: h.title, icon: h.icon, color: h.color };
            }
        }
    }
    return null;
}

function parseSections(text: string): Section[] {
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let buffer: string[] = [];

    const flushBuffer = () => {
        if (currentSection && buffer.length > 0) {
            currentSection.content = buffer.join('\n').trim();
            if (currentSection.content) {
                sections.push(currentSection);
            }
        }
        buffer = [];
    };

    for (const line of lines) {
        const heading = matchHeading(line);
        if (heading) {
            flushBuffer();
            currentSection = {
                title: heading.title,
                icon: heading.icon,
                content: '',
                color: heading.color,
            };
        } else {
            buffer.push(line);
        }
    }

    flushBuffer();

    if (buffer.length > 0 && sections.length === 0) {
        const remaining = buffer.join('\n').trim();
        if (remaining) {
            sections.push({
                title: 'Limited Intelligence',
                icon: <Brain className="w-3.5 h-3.5" />,
                content: remaining,
                color: 'text-[#888]',
            });
        }
    }

    return sections;
}

function SectionBlock({ section }: { section: Section }) {
    const [open, setOpen] = useState(true);

    const confidenceMatch = section.content.match(/(\d{1,3})\s*%\s*(confidence|score|certainty)/i);
    const confidence = confidenceMatch ? Math.min(100, parseInt(confidenceMatch[1], 10)) : null;

    const hasVerdict = /safe|medium|risk|scam|legit/i.test(section.content);
    const verdictMatch = section.content.match(/\b(SAFE|MEDIUM|RISK|SCAM|LEGIT(?:IMATE)?)\b/i);
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : null;

    const verdictColor = (v: string | null): string => {
        switch (v) {
            case 'SAFE': case 'LEGIT': case 'LEGITIMATE': return 'text-emerald-400';
            case 'MEDIUM': case 'RISK': return 'text-yellow-400';
            case 'SCAM': return 'text-red-500';
            default: return 'text-[#888]';
        }
    };

    return (
        <div className="border border-[#222] bg-[#0A0A0A]">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 p-3 hover:bg-[#111] transition-colors"
            >
                <span className={section.color}>{section.icon}</span>
                <span className="text-[10px] font-mono text-white uppercase tracking-wider font-bold flex-1 text-left">
                    {section.title}
                </span>
                {verdict && (
                    <span className={`text-[8px] font-mono font-bold ${verdictColor(verdict)} mr-2`}>
                        {verdict}
                    </span>
                )}
                {open ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[#555]" />
                )}
            </button>

            {open && (
                <div className="px-3 pb-3 pt-1 border-t border-[#1A1A1A]">
                    {confidence !== null && (
                        <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-mono text-[#555] uppercase">Confidence</span>
                                <span className="text-[9px] font-mono-nums text-white">{confidence}%</span>
                            </div>
                            <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${confidence >= 70 ? 'bg-emerald-500' : confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${confidence}%` }}
                                />
                            </div>
                        </div>
                    )}
                    <div className="text-[11px] font-mono text-[#aaa] leading-relaxed whitespace-pre-wrap">
                        {section.content}
                    </div>
                </div>
            )}
        </div>
    );
}

export function AiReportStructured({ report, timestamp }: Props) {
    if (!report || report.trim().length === 0) {
        return (
            <div className="bg-[#0A0A0A] border border-[#333] p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-[#555]" />
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">AI Intelligence Report</h3>
                </div>
                <div className="flex flex-col items-center py-6 gap-2">
                    <span className="text-[10px] font-mono text-[#555] text-center">
                        Limited intelligence available for this project.
                    </span>
                    <span className="text-[9px] font-mono text-[#444]">
                        Our AI is analyzing — check back soon.
                    </span>
                </div>
            </div>
        );
    }

    const sections = parseSections(report);

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">AI Intelligence Report</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-purple-400 bg-purple-400/10 px-1.5 py-0.5 uppercase">
                        AI-analyzed
                    </span>
                    {timestamp && (
                        <span className="text-[8px] font-mono text-[#555]">
                            {new Date(timestamp).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {sections.map((section, i) => (
                    <SectionBlock key={i} section={section} />
                ))}
            </div>

            {sections.length === 0 && (
                <div className="text-[11px] font-mono text-[#888] whitespace-pre-wrap leading-relaxed">
                    {report}
                </div>
            )}
        </div>
    );
}
