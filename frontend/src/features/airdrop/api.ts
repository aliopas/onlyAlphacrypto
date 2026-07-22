import { apiClient } from '@/features/shared/api/client';
import {
    AirdropProject,
    AirdropPublicStats,
    AirdropResearchDetail,
    ProgressResponse,
    ResearchListResult,
    UrgentAirdrop,
} from './types';

export interface AirdropStats {
    totalValue: number;
    walletCount: number;
    txCount: number;
    completedTasks: number;
    projectsScanned?: number;
    recommended?: number;
    underReview?: number;
    notRecommended?: number;
    acceptanceRatePercent?: number;
    lastPipelineAt?: string | null;
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

    /** DEC-042: public trust / filter stats */
    getPublicStats: async (): Promise<AirdropPublicStats | null> => {
        try {
            const { data } = await apiClient.get<AirdropPublicStats>('/airdrop/public-stats');
            return data;
        } catch (error) {
            console.error('[API] getPublicStats failed:', error);
            return null;
        }
    },

    getResearchList: async (params?: {
        tier?: 'not_recommended' | 'under_review';
        page?: number;
        limit?: number;
    }): Promise<ResearchListResult | null> => {
        try {
            const { data } = await apiClient.get<ResearchListResult>('/airdrop/research', {
                params: {
                    tier: params?.tier ?? 'not_recommended',
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 20,
                },
            });
            return data;
        } catch (error) {
            console.error('[API] getResearchList failed:', error);
            return null;
        }
    },

    getResearchBySlug: async (slug: string): Promise<AirdropResearchDetail | null> => {
        try {
            const { data } = await apiClient.get<AirdropResearchDetail>(
                `/airdrop/research/${encodeURIComponent(slug)}`
            );
            return data;
        } catch (error) {
            console.error('[API] getResearchBySlug failed:', error);
            return null;
        }
    },

    getResearchSeoSlugs: async (): Promise<Array<{ slug: string; updatedAt: string }>> => {
        try {
            const { data } = await apiClient.get<{ slugs: Array<{ slug: string; updatedAt: string }> }>(
                '/airdrop/research/seo-slugs'
            );
            return data.slugs ?? [];
        } catch (error) {
            console.error('[API] getResearchSeoSlugs failed:', error);
            return [];
        }
    },
};
