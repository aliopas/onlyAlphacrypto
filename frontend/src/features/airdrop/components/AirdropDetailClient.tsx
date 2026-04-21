'use client';

import { useState, useCallback, useEffect } from 'react';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject, ProgressResponse } from '@/features/airdrop/types';
import { TaskList } from '@/features/airdrop/components/TaskList';
import { AiReportStructured } from '@/features/airdrop/components/AiReportStructured';
import { ArrowLeft, Loader2, Target, Zap, Clock, Timer } from 'lucide-react';
import Link from 'next/link';

function useCountdown(targetDate: string | undefined): string | null {
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

    return (
        <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-500 pb-12">
            <Link href="/airdrops" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Hub
            </Link>

            <div className="glass-card rounded-3xl p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-white/5 border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {project.network}
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1 ${project.riskVerdict === 'SAFE' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                            <ShieldIcon risk={project.riskVerdict} /> {project.riskVerdict.replace('_', ' ')}
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-glow">
                        {project.name}
                    </h1>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <StatBox icon={<Target />} label="Est. Value" value={project.estValue || 'TBD'} />
                        <StatBox icon={<Clock />} label="Snapshot" value={project.snapshotAt ? new Date(project.snapshotAt).toLocaleDateString() : 'Unknown'} />
                        <StatBox icon={<Zap />} label="TGE" value={project.tgeAt ? new Date(project.tgeAt).toLocaleDateString() : 'Unknown'} />

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

                    {countdown === 'PASSED' && deadlineDate && (
                        <div className="mt-6 bg-black/20 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                            <Timer className="w-5 h-5 text-[#555] shrink-0" />
                            <span className="text-sm text-[#555] font-mono">
                                {project.snapshotAt ? 'Snapshot' : 'TGE'} date has passed
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Required Tasks</h2>
                    <p className="text-muted-foreground mb-6">Complete the tasks below to become eligible for this airdrop.</p>
                </div>

                <TaskList
                    tasks={project.tasks || []}
                    userProgress={progress?.userProgress || []}
                    onVerificationSuccess={fetchDetails}
                />
            </div>

            {project.aiReport && (
                <div className="mt-8">
                    <AiReportStructured report={project.aiReport} timestamp={project.updatedAt} />
                </div>
            )}

            {!project.aiReport && (
                <div className="mt-8">
                    <AiReportStructured report={null} timestamp={null} />
                </div>
            )}
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
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            {risk === 'SAFE' && <path d="m9 12 2 2 4-4" />}
            {risk !== 'SAFE' && <path d="M12 8v4" />}
            {risk !== 'SAFE' && <path d="M12 16h.01" />}
        </svg>
    );
}
