import { apiClient } from '@/features/shared/api/client';
import { CoinNews, AnalysisStream } from './types';
import { MOCK_COIN_NEWS, MOCK_ANALYSIS_STREAM } from '@/features/shared/api/mockData';

const isMock = process.env.NEXT_PUBLIC_API_MODE === 'mock';

export const terminalApi = {
    getLatestWire: async (): Promise<CoinNews[]> => {
        if (isMock) return MOCK_COIN_NEWS;
        try {
            const { data } = await apiClient.get<CoinNews[]>('/market/wire');
            return data;
        } catch {
            return [];
        }
    },

    getNewsById: async (id: number): Promise<CoinNews | null> => {
        if (isMock) return MOCK_COIN_NEWS.find(n => n.id === id) || null;
        try {
            const { data } = await apiClient.get<CoinNews>(`/market/wire/${id}`);
            return data;
        } catch {
            return null;
        }
    },

    getAlphaStream: async (coinPair: string): Promise<AnalysisStream | null> => {
        if (isMock) return MOCK_ANALYSIS_STREAM;
        try {
            const { data } = await apiClient.get<AnalysisStream>(`/terminal/stream/${coinPair}`);
            return data;
        } catch {
            return null;
        }
    }
};

