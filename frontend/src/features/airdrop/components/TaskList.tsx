'use client';

import { useState, useEffect } from 'react';
import { airdropApi } from '../api';
import { AirdropTask, UserProgress } from '../types';
import { apiClient } from '@/features/shared/api/client';

interface Props {
    tasks: AirdropTask[];
    userProgress: UserProgress[];
    onVerificationSuccess: () => void;
}

export function TaskList({ tasks, userProgress, onVerificationSuccess }: Props) {
    const [verifying, setVerifying] = useState<number | null>(null);

    useEffect(() => {
        const pendingTasks = tasks.filter(t => {
            const progressRecord = userProgress.find(up => up.taskId === t.id);
            return progressRecord?.status !== 'VERIFIED';
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

    return (
        <div className="space-y-4">
            {tasks.sort((a, b) => a.orderIndex - b.orderIndex).map((task) => {
                const progressRecord = userProgress.find(up => up.taskId === task.id);
                const isVerified = progressRecord?.status === 'VERIFIED';

                return (
                    <div key={task.id} className="bg-black border border-[#333] p-6 flex flex-col md:flex-row md:items-center justify-between group hover:border-[#555] transition-all gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 border flex items-center justify-center shrink-0 ${isVerified ? 'bg-[#135bec] border-[#135bec]' : 'border-[#333]'}`}>
                                {isVerified && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                            </div>
                            <div>
                                <h3 className={`text-[13px] font-mono font-bold uppercase ${isVerified ? 'text-[#555] line-through' : 'text-white'}`}>
                                    Task #{task.orderIndex}
                                </h3>
                                <p className="text-[10px] font-mono text-[#888] uppercase mt-1">{task.description}</p>
                            </div>
                        </div>

                        {!isVerified && (
                            <button
                                onClick={() => handleVerify(task.id)}
                                disabled={verifying === task.id || !task.isAutoVerifiable}
                                className="px-4 py-2 bg-white text-black font-mono text-[10px] font-bold uppercase hover:bg-gray-200 disabled:opacity-50 transition-colors shrink-0"
                            >
                                {verifying === task.id ? 'VERIFYING...' : (!task.isAutoVerifiable ? 'MANUAL' : '[VERIFY]')}
                            </button>
                        )}
                        {isVerified && (
                            <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest font-bold shrink-0">COMPLETED</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
