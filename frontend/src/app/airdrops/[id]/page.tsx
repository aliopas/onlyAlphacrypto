'use client';

import { useEffect, useState, useCallback } from 'react';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject, ProgressResponse } from '@/features/airdrop/types';
import { TaskList } from '@/features/airdrop/components/TaskList';
import { ArrowLeft, Loader2, Target, Zap, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AirdropDetailsPage() {
    const params = useParams();
    const id = Number(params?.id);

    const [project, setProject] = useState<AirdropProject | null>(null);
    const [progress, setProgress] = useState<ProgressResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDetails = useCallback(async () => {
        if (!id) return;
        const [projData, progData] = await Promise.all([
            airdropApi.getProjectById(id),
            airdropApi.getProjectProgress(id),
        ]);
        setProject(projData);
        setProgress(progData);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchDetails();
    }, [fetchDetails]);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center space-y-4">
                <h2 className="text-xl font-bold">Project not found</h2>
                <Link href="/airdrops" className="text-primary hover:underline flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Airdrops
                </Link>
            </div>
        );
    }

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
                                style={{ width: `${progress?.progressPercentage || 0}%` }}
                            />
                            <p className="text-sm text-muted-foreground mb-1">Your Progress</p>
                            <p className="font-bold text-2xl text-primary">{progress?.progressPercentage || 0}%</p>
                        </div>
                    </div>
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
