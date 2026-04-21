'use client';

import { useState, useEffect } from 'react';
import { airdropApi } from '../api';
import { AirdropTask, UserProgress } from '../types';
import { apiClient } from '@/features/shared/api/client';
import { CheckCircle2, Circle, Loader2, ExternalLink, Link2, Trophy } from 'lucide-react';

interface Props {
    tasks: AirdropTask[];
    userProgress: UserProgress[];
    onVerificationSuccess: () => void;
}

type TaskVisualState = 'verified' | 'verifying' | 'not_started';

const CHAIN_EXPLORER: Record<string, string> = {
    ethereum: 'https://etherscan.io',
    eth: 'https://etherscan.io',
    zksync: 'https://explorer.zksync.io',
    arbitrum: 'https://arbiscan.io',
    arb: 'https://arbiscan.io',
    optimism: 'https://optimistic.etherscan.io',
    op: 'https://optimistic.etherscan.io',
    base: 'https://basescan.org',
    polygon: 'https://polygonscan.com',
    matic: 'https://polygonscan.com',
    bsc: 'https://bscscan.com',
    solana: 'https://solscan.io',
    sol: 'https://solscan.io',
};

function getExplorerUrl(chain: string | undefined, hashOrAddress: string): string | null {
    if (!chain || !hashOrAddress) return null;
    const base = CHAIN_EXPLORER[chain.toLowerCase()];
    if (!base) return null;
    if (hashOrAddress.startsWith('0x') && hashOrAddress.length === 66) {
        return `${base}/tx/${hashOrAddress}`;
    }
    return `${base}/address/${hashOrAddress}`;
}

function truncateHash(hash: string): string {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function TaskList({ tasks, userProgress, onVerificationSuccess }: Props) {
    const [verifying, setVerifying] = useState<number | null>(null);
    const [manualAttesting, setManualAttesting] = useState<number | null>(null);

    useEffect(() => {
        const pendingTasks = tasks.filter(t => {
            const progressRecord = userProgress.find(up => up.taskId === t.id);
            return !progressRecord?.completed;
        });
        if (pendingTasks.length === 0) return;

        const intervalId = setInterval(async () => {
            try {
                const promises = pendingTasks.map(async (task) => {
                    const { data } = await apiClient.get(`/verification/check/${task.id}`);
                    return data;
                });
                const results = await Promise.allSettled(promises);
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.verified) {
                        onVerificationSuccess();
                    }
                });
            } catch (error) {
                console.error('[TaskList] Verification poll failed:', error);
            }
        }, 30000);

        return () => clearInterval(intervalId);
    }, [tasks, userProgress, onVerificationSuccess]);

    const handleVerify = async (taskId: number) => {
        setVerifying(taskId);
        try {
            const res = await airdropApi.triggerVerification(taskId);
            if (res.success) {
                onVerificationSuccess();
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            alert(error.message || 'Verification failed');
        } finally {
            setVerifying(null);
        }
    };

    const handleManualAttest = async (taskId: number) => {
        setManualAttesting(taskId);
        try {
            await apiClient.post(`/airdrop/verify/${taskId}`, { manual: true });
            onVerificationSuccess();
        } catch {
            alert('Failed to mark task as done.');
        } finally {
            setManualAttesting(null);
        }
    };

    const sorted = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);
    const allComplete = sorted.length > 0 && sorted.every(t => {
        const rec = userProgress.find(up => up.taskId === t.id);
        return rec?.completed === true;
    });

    const getVisualState = (task: AirdropTask): TaskVisualState => {
        const rec = userProgress.find(up => up.taskId === task.id);
        if (rec?.completed) return 'verified';
        if (task.isAutoVerifiable && !rec?.completed) return 'verifying';
        return 'not_started';
    };

    const timelineLineColor = (state: TaskVisualState): string => {
        switch (state) {
            case 'verified': return 'bg-emerald-500';
            case 'verifying': return 'bg-blue-500';
            default: return 'bg-[#333]';
        }
    };

    return (
        <div className="relative">
            {allComplete && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                        <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase">All tasks complete!</span>
                        <p className="text-[10px] font-mono text-emerald-500/70 mt-0.5">Great work — you&apos;re eligible for this drop.</p>
                    </div>
                </div>
            )}

            <div className="space-y-0">
                {sorted.map((task, idx) => {
                    const progressRecord = userProgress.find(up => up.taskId === task.id);
                    const isVerified = progressRecord?.completed === true;
                    const state = getVisualState(task);
                    const isLast = idx === sorted.length - 1;
                    const lineColor = timelineLineColor(state);
                    const txExplorerUrl = progressRecord?.txHash
                        ? getExplorerUrl(task.chain, progressRecord.txHash)
                        : null;
                    const contractExplorerUrl = task.contractAddress
                        ? getExplorerUrl(task.chain, task.contractAddress)
                        : null;
                    const externalUrl = task.description.match(/https?:\/\/[^\s]+/)?.[0] ?? null;

                    return (
                        <div key={task.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                                    {state === 'verified' ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    ) : state === 'verifying' ? (
                                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-[#555]" />
                                    )}
                                </div>
                                {!isLast && (
                                    <div className={`w-0.5 flex-1 min-h-[24px] ${lineColor}`} />
                                )}
                            </div>

                            <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                                <div className="bg-black border border-[#333] p-4 group hover:border-[#444] transition-all">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                                                isVerified ? 'text-[#555] line-through' : 'text-white'
                                            }`}>
                                                Task #{task.orderIndex}
                                            </h3>
                                            <p className="text-[10px] font-mono text-[#888] mt-1 break-words">
                                                {task.description}
                                            </p>
                                        </div>

                                        {state === 'verified' && (
                                            <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest font-bold shrink-0 mt-0.5">
                                                COMPLETED
                                            </span>
                                        )}
                                    </div>

                                    {state === 'verified' && progressRecord && (
                                        <div className="mt-3 pt-3 border-t border-[#222] space-y-1.5">
                                            {progressRecord.txHash && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono text-[#555]">TX:</span>
                                                    {txExplorerUrl ? (
                                                        <a
                                                            href={txExplorerUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[9px] font-mono text-blue-400 hover:text-blue-300 underline underline-offset-2"
                                                        >
                                                            {truncateHash(progressRecord.txHash)}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[9px] font-mono text-[#666]">
                                                            {truncateHash(progressRecord.txHash)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-mono text-[#555]">Verified by:</span>
                                                <span className="text-[9px] font-mono text-[#888] capitalize">
                                                    {progressRecord.verifiedBy ?? 'auto'}
                                                </span>
                                                {progressRecord.completedAt && (
                                                    <>
                                                        <span className="text-[9px] font-mono text-[#444]">•</span>
                                                        <span className="text-[9px] font-mono text-[#555]">
                                                            {new Date(progressRecord.completedAt).toLocaleString()}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {state === 'verifying' && (
                                        <div className="mt-3 pt-3 border-t border-[#222]">
                                            <div className="flex items-center gap-2">
                                                {task.contractAddress && contractExplorerUrl ? (
                                                    <a
                                                        href={contractExplorerUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[9px] font-mono text-blue-400/60 hover:text-blue-300 truncate"
                                                    >
                                                        <Link2 className="w-3 h-3 inline mr-1" />
                                                        {truncateHash(task.contractAddress)}
                                                    </a>
                                                ) : task.contractAddress ? (
                                                    <span className="text-[9px] font-mono text-[#555] truncate">
                                                        {truncateHash(task.contractAddress)}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-[9px] font-mono text-blue-400/60 mt-1">
                                                Checking on-chain... <Loader2 className="w-3 h-3 inline animate-spin" />
                                            </p>
                                            <p className="text-[8px] font-mono text-[#444] mt-0.5">Will retry in 30s</p>
                                        </div>
                                    )}

                                    {state === 'not_started' && !isVerified && (
                                        <div className="mt-3 pt-3 border-t border-[#222] flex flex-wrap items-center gap-2">
                                            {externalUrl && (
                                                <a
                                                    href={externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[9px] font-mono text-[#888] border border-[#333] hover:bg-white hover:text-black transition-colors uppercase"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Open External Link
                                                </a>
                                            )}
                                            {!task.isAutoVerifiable && (
                                                <button
                                                    onClick={() => handleManualAttest(task.id)}
                                                    disabled={manualAttesting === task.id}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[9px] font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                    {manualAttesting === task.id ? 'MARKING...' : "I've Done This"}
                                                </button>
                                            )}
                                            {task.isAutoVerifiable && (
                                                <button
                                                    onClick={() => handleVerify(task.id)}
                                                    disabled={verifying === task.id}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[9px] font-mono font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors uppercase"
                                                >
                                                    {verifying === task.id ? 'VERIFYING...' : '[VERIFY]'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
