import { apiClient } from '@/features/shared/api/client';
import { AirdropProject, ProgressResponse } from './types';

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
    }
};
