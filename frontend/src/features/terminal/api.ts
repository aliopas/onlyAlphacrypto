import { apiClient } from '@/features/shared/api/client';
import { CoinNews, AnalysisStream } from './types';

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

    getAlphaStream: async (coinPair: string): Promise<AnalysisStream | null> => {
        try {
            const { data } = await apiClient.get<AnalysisStream>(`/terminal/stream/${coinPair}`);
            return data;
        } catch (error) {
            console.error('[API] getAlphaStream failed:', error);
            return null;
        }
    }
};

