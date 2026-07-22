'use client';

import { useState, useCallback, useEffect } from 'react';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject, ProgressResponse, PortfolioMoodStrip } from '@/features/airdrop/types';
import { TaskList } from '@/features/airdrop/components/TaskList';
import { AiReportStructured } from '@/features/airdrop/components/AiReportStructured';
import { ArrowLeft, Target, Zap, Clock, Timer, ExternalLink } from 'lucide-react';
import Link from 'next/link';

function useCountdown(targetDate: string | null | undefined): string | null {
    const [remaining, setRemaining] = useState<string | null>(null);

    useEffect(() => {
        if (!targetDate) {
            setRemaining(null);
            return;
        }

        const compute = () => {
            const target = new Date(targetDate).getTime();
            const now = Date.now();
            const diff = target - now;

            if (diff <= 0) {
                setRemaining('PASSED');
                return false;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            setRemaining(
                `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            );
            return true;
        };

        const shouldContinue = compute();
        if (!shouldContinue) return;

        const interval = setInterval(() => {
            const cont = compute();
            if (!cont) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    return remaining;
}

function MoodStripView({ strip, title }: { strip: PortfolioMoodStrip | null; title: string }) {
    if (!strip) {
        return (
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">{title}</p>
                <p className="text-sm text-[#555]">No mood data</p>
            </div>
        );
    }

    const labelColor =
        strip.moodLabel === 'toxic'
            ? 'text-red-400'
            : strip.moodLabel === 'hot'
              ? 'text-orange-400'
              : strip.moodLabel === 'warming'
                ? 'text-amber-400'
                : 'text-slate-400';

    return (
        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{title}</p>
                <span className={`text-sm font-bold uppercase ${labelColor}`}>{strip.moodLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#888]">
                <span>Mentions: {strip.mentionCount}</span>
                <span>Sources: {strip.uniqueSourceCount}</span>
                <span>Hype: {strip.hypeScore.toFixed(1)}</span>
                <span>FUD: {strip.fudScore.toFixed(1)}</span>
            </div>
            {strip.controversyFlag && (
                <p className="text-[10px] text-red-400/80 mt-2 font-mono">Controversy flag (dates/claims)</p>
            )}
            <p className="text-[9px] text-[#444] mt-2 font-mono">Mood ≠ legitimacy · soft ranking only</p>
        </div>
    );
}

export function AirdropDetailClient({
    project: initialProject,
    progress: initialProgress,
}: {
    project: AirdropProject;
    progress: ProgressResponse | null;
}) {
    const [project, setProject] = useState<AirdropProject>(initialProject);
    const [progress, setProgress] = useState<ProgressResponse | null>(initialProgress);

    const deadlineDate = project.snapshotAt || project.tgeAt;
    const countdown = useCountdown(deadlineDate);

    const fetchDetails = useCallback(async () => {
        if (!project.id) return;
        const [projData, progData] = await Promise.all([
            airdropApi.getProjectById(project.id),
            airdropApi.getProjectProgress(project.id),
        ]);
        if (projData) setProject(projData);
        if (progData) setProgress(progData);
    }, [project.id]);

    const risk = project.riskVerdict || 'MEDIUM';
    const tasks = (project.tasks || []).map((t, i) => ({
        id: typeof t.id === 'number' ? t.id : i + 1,
        projectId: project.id,
        description: t.description,
        isAutoVerifiable: t.isAutoVerifiable,
        chain: t.chain ?? undefined,
        orderIndex: 'orderIndex' in t && typeof t.orderIndex === 'number' ? t.orderIndex : i,
    }));

    return (
        <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-500 pb-12">
            <Link
                href="/airdrops"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Hub
            </Link>

            <div className="glass-card rounded-3xl p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-white/5 border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {project.network}
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1 ${
                                risk === 'SAFE' || risk === 'LOW'
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                    : risk === 'SCAM'
                                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                      : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            }`}
                        >
                            <ShieldIcon risk={risk} /> {risk.replace('_', ' ')}
                        </span>
                        {typeof project.qualityScore === 'number' && (
                            <span className="px-3 py-1 rounded-full bg-white/5 border text-xs font-mono text-[#aaa]">
                                Q{project.qualityScore}
                            </span>
                        )}
                        {project.publishPath === 'auto_publish' && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                                auto-published
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-glow">
                        {project.name}
                    </h1>

                    {project.whyFarmNow && (
                        <div className="mb-6 p-4 rounded-xl bg-black/30 border border-white/5">
                            <p className="text-[10px] font-mono uppercase text-[#666] mb-1">Why farm now</p>
                            <p className="text-sm text-[#ccc] leading-relaxed">{project.whyFarmNow}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <StatBox icon={<Target />} label="Est. Value" value={project.estValue || 'TBD'} />
                        <StatBox
                            icon={<Clock />}
                            label="Snapshot"
                            value={
                                project.snapshotAt
                                    ? new Date(project.snapshotAt).toLocaleDateString()
                                    : 'Unknown'
                            }
                        />
                        <StatBox
                            icon={<Zap />}
                            label="TGE"
                            value={project.tgeAt ? new Date(project.tgeAt).toLocaleDateString() : 'Unknown'}
                        />
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col justify-center relative overflow-hidden">
                            <div
                                className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-1000"
                                style={{ width: `${progress?.percent || 0}%` }}
                            />
                            <p className="text-sm text-muted-foreground mb-1">Your Progress</p>
                            <p className="font-bold text-2xl text-primary">{progress?.percent || 0}%</p>
                        </div>
                    </div>

                    {countdown && countdown !== 'PASSED' && (
                        <div className="mt-6 bg-black/20 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                            <Timer className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {project.snapshotAt ? 'Snapshot' : 'TGE'} Countdown
                                </p>
                                <p className="text-2xl font-mono-nums font-bold text-red-400 tracking-widest">
                                    {countdown}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Portfolio sections */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
                <Section title="Team / substance" body={project.teamSummary} />
                <Section title="Docs / whitepaper" body={project.docsSummary} />
                <Section title="Funding / TVL" body={project.fundingSummary} />
                <Section title="How it works" body={project.howItWorks} />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
                <MoodStripView strip={project.mood?.strip24h ?? null} title="Social Mood · 24h" />
                <MoodStripView strip={project.mood?.strip7d ?? null} title="Social Mood · 7d" />
            </div>

            {project.dates && project.dates.length > 0 && (
                <div className="mb-8 glass-card rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-3">Date signals</h2>
                    <ul className="space-y-2">
                        {project.dates.map((d, i) => (
                            <li
                                key={`${d.kind}-${d.isoDate ?? i}`}
                                className="flex justify-between text-sm font-mono border-b border-white/5 pb-2"
                            >
                                <span className="text-[#aaa] uppercase">{d.kind}</span>
                                <span className="text-[#888]">
                                    {d.isoDate ? new Date(d.isoDate).toLocaleDateString() : d.raw || 'unclear'}
                                    <span className="text-[#555] ml-2">({d.confidence})</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="space-y-6 mb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Tasks / eligibility path</h2>
                    <p className="text-muted-foreground mb-6 text-sm">
                        Informational only (NFA). Confirm every step on official docs before interacting.
                    </p>
                </div>

                {tasks.length > 0 ? (
                    <TaskList
                        tasks={tasks}
                        userProgress={progress?.userProgress || []}
                        onVerificationSuccess={fetchDetails}
                    />
                ) : (
                    <p className="text-sm text-[#666] font-mono">
                        No structured tasks on file — follow official docs linked in provenance.
                    </p>
                )}
            </div>

            {project.provenanceLinks && project.provenanceLinks.length > 0 && (
                <div className="mb-8 glass-card rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-3">Provenance</h2>
                    <ul className="space-y-2">
                        {project.provenanceLinks.map((link) => (
                            <li key={link.url}>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-blue-400/90 hover:text-blue-300 font-mono break-all"
                                >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span className="text-[10px] uppercase text-[#666]">{link.kind}</span>
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(project.websiteUrl || project.twitterUrl) && (
                <div className="flex flex-wrap gap-3 mb-8">
                    {project.websiteUrl && (
                        <a
                            href={project.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5"
                        >
                            Website
                        </a>
                    )}
                    {project.twitterUrl && (
                        <a
                            href={project.twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5"
                        >
                            Twitter / X
                        </a>
                    )}
                </div>
            )}

            {project.aiReport && (
                <div className="mt-8">
                    <AiReportStructured report={project.aiReport} timestamp={project.updatedAt} />
                </div>
            )}

            <p className="mt-8 text-[11px] font-mono text-[#555] leading-relaxed border-t border-white/5 pt-4">
                {project.nfaDisclaimer ||
                    'Not financial advice. Airdrops are speculative; never share seed phrases or send funds to “claim” sites. Verify every URL independently.'}
            </p>
        </div>
    );
}

function Section({ title, body }: { title: string; body?: string }) {
    return (
        <div className="glass-card rounded-2xl p-5">
            <h3 className="text-xs font-mono uppercase text-[#666] mb-2">{title}</h3>
            <p className="text-sm text-[#bbb] leading-relaxed">{body || '—'}</p>
        </div>
    );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
            <div className="text-muted-foreground mb-2 [&>svg]:w-5 [&>svg]:h-5">{icon}</div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-bold text-foreground">{value}</p>
        </div>
    );
}

function ShieldIcon({ risk }: { risk: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            {(risk === 'SAFE' || risk === 'LOW') && <path d="m9 12 2 2 4-4" />}
            {risk !== 'SAFE' && risk !== 'LOW' && <path d="M12 8v4" />}
            {risk !== 'SAFE' && risk !== 'LOW' && <path d="M12 16h.01" />}
        </svg>
    );
}
