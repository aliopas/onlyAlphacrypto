import { apiClient } from '@/features/shared/api/client';
import { CoinNews, MasterArticleResponse, TimelineResponse } from './types';

export const terminalApi = {
    getLatestWire: async (options?: { coin?: string }): Promise<CoinNews[]> => {
        try {
            const params: Record<string, string> = {};
            if (options?.coin) params.coin = options.coin;
            const { data } = await apiClient.get<CoinNews[]>('/market/wire', { params });
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

    getMasterArticleCoins: async (): Promise<string[]> => {
        try {
            const { data } = await apiClient.get<{ coins: string[] }>('/market/master/coins');
            return data.coins;
        } catch (error) {
            console.error('[API] getMasterArticleCoins failed:', error);
            return [];
        }
    },
};

