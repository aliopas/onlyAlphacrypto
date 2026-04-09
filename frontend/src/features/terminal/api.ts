import { apiClient } from '@/features/shared/api/client';
import { CoinNews } from './types';

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
    }
};

