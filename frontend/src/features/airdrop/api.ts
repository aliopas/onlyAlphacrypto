import { apiClient } from '@/features/shared/api/client';
import { AirdropProject, ProgressResponse } from './types';
import { MOCK_AIRDROPS, MOCK_AIRDROP_PROGRESS } from '@/features/shared/api/mockData';

const isMock = process.env.NEXT_PUBLIC_API_MODE === 'mock';

export const airdropApi = {
    getProjects: async (): Promise<AirdropProject[]> => {
        if (isMock) return MOCK_AIRDROPS;
        try {
            const { data } = await apiClient.get<AirdropProject[]>('/airdrop/projects');
            return data;
        } catch {
            return [];
        }
    },

    getProjectById: async (id: number): Promise<AirdropProject | null> => {
        if (isMock) return MOCK_AIRDROPS.find(p => p.id === id) || null;
        try {
            const { data } = await apiClient.get<AirdropProject>(`/airdrop/projects/${id}`);
            return data;
        } catch {
            return null;
        }
    },

    getProjectProgress: async (id: number): Promise<ProgressResponse | null> => {
        if (isMock) return MOCK_AIRDROP_PROGRESS[id] || { progressPercentage: 0, userProgress: [] };
        try {
            const { data } = await apiClient.get<ProgressResponse>(`/airdrop/projects/${id}/progress`);
            return data;
        } catch {
            return null;
        }
    },

    triggerVerification: async (taskId: number): Promise<{ success: boolean; status: string; txHash?: string }> => {
        if (isMock) return new Promise(resolve => setTimeout(() => resolve({ success: true, status: 'VERIFIED' }), 1500));
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
    }
};
