import { apiClient } from '@/features/shared/api/client';
import { CoinNews, MasterArticleResponse, TimelineResponse } from './types';

export const terminalApi = {
    getLatestWire: async (): Promise<CoinNews[]> => {
        try {
            const { data } = await apiClient.get<CoinNews[]>('/market/wire');
            return data;
        } catch (error) {
            console.error('[API] getLatestWire failed:', error);
            return [];
        }
    },

    getNewsById: async (id: number): Promise<CoinNews | null> => {
        try {
            const { data } = await apiClient.get<CoinNews>(`/market/wire/${id}`);
            return data;
        } catch (error) {
            console.error('[API] getNewsById failed:', error);
            return null;
        }
    },

    getMasterArticle: async (symbol: string): Promise<MasterArticleResponse> => {
        try {
            const { data } = await apiClient.get<MasterArticleResponse>(`/market/master/${symbol}`);
            return data;
        } catch (error) {
            console.error('[API] getMasterArticle failed:', error);
            return {
                masterArticle: null,
                timelineUpdates: [],
                convictionScore: null,
                posture: null,
            };
        }
    },

    getTimeline: async (symbol: string, offset: number = 0, limit: number = 20): Promise<TimelineResponse> => {
        try {
            const { data } = await apiClient.get<TimelineResponse>(`/market/timeline/${symbol}`, {
                params: { offset, limit },
            });
            return data;
        } catch (error) {
            console.error('[API] getTimeline failed:', error);
            return { updates: [], total: 0 };
        }
    },
};

