import { apiClient } from '@/features/shared/api/client';
import { AirdropProject, ProgressResponse, UrgentAirdrop } from './types';

export interface AirdropStats {
    totalValue: number;
    walletCount: number;
    txCount: number;
    completedTasks: number;
}

export interface AirdropActivity {
    id: string;
    description: string;
    projectName: string;
    completed: boolean;
    completedAt: string | null;
    txHash: string | null;
}

export interface AirdropDeadline {
    id: string;
    name: string;
    deadline: string;
    daysLeft: number;
    countdown: string;
    isCritical: boolean;
}

export const airdropApi = {
    getProjects: async (): Promise<AirdropProject[]> => {
        try {
            const { data } = await apiClient.get<AirdropProject[]>('/airdrop/projects');
            return data;
        } catch (error) {
            console.error('[API] getProjects failed:', error);
            return [];
        }
    },

    getProjectById: async (id: number): Promise<AirdropProject | null> => {
        try {
            const { data } = await apiClient.get<AirdropProject>(`/airdrop/projects/${id}`);
            return data;
        } catch (error) {
            console.error('[API] getProjectById failed:', error);
            return null;
        }
    },

    getProjectProgress: async (id: number): Promise<ProgressResponse | null> => {
        try {
            const { data } = await apiClient.get<ProgressResponse>(`/airdrop/projects/${id}/progress`);
            return data;
        } catch (error) {
            console.error('[API] getProjectProgress failed:', error);
            return null;
        }
    },

    triggerVerification: async (taskId: number): Promise<{ success: boolean; status: string; txHash?: string }> => {
        try {
            const { data } = await apiClient.post(`/airdrop/verify/${taskId}`);
            return data;
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            throw new Error('Verification failed');
        }
    },

    getStats: async (): Promise<AirdropStats | null> => {
        try {
            const { data } = await apiClient.get<AirdropStats>('/airdrop/stats');
            return data;
        } catch (error) {
            console.error('[API] getStats failed:', error);
            return null;
        }
    },

    getActivity: async (): Promise<AirdropActivity[] | null> => {
        try {
            const { data } = await apiClient.get<AirdropActivity[]>('/airdrop/activity');
            return data;
        } catch (error) {
            console.error('[API] getActivity failed:', error);
            return null;
        }
    },

    getDeadlines: async (): Promise<AirdropDeadline[] | null> => {
        try {
            const { data } = await apiClient.get<AirdropDeadline[]>('/airdrop/sidebar-deadlines');
            return data;
        } catch (error) {
            console.error('[API] getDeadlines failed:', error);
            return null;
        }
    },

    getUrgentAirdrops: async (): Promise<UrgentAirdrop[]> => {
        try {
            const { data } = await apiClient.get<UrgentAirdrop[]>('/airdrop/urgent');
            return data;
        } catch (error) {
            console.error('[API] getUrgentAirdrops failed:', error);
            return [];
        }
    },

    getPipelineStatus: async (): Promise<{ lastScan: string | null; nextScan: string | null; sources: number } | null> => {
        try {
            const { data } = await apiClient.get<{ lastScan: string | null; nextScan: string | null; sources: number }>('/airdrop/pipeline-status');
            return data;
        } catch {
            return null;
        }
    },
};
