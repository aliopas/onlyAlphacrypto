import { apiClient } from '@/features/shared/api/client';
import { MarketMood, AlphaFocus, RadarSignal, TopMover } from './types';

export const homeApi = {
    getMarketMood: async (): Promise<MarketMood | null> => {
        try {
            const { data } = await apiClient.get<MarketMood>('/market/mood');
            return data;
        } catch (error) {
            console.error('[API] getMarketMood failed:', error);
            return null;
        }
    },

    getAlphaFocus: async (): Promise<AlphaFocus | null> => {
        try {
            const { data } = await apiClient.get<AlphaFocus>('/market/alpha-focus');
            return data;
        } catch (error) {
            console.error('[API] getAlphaFocus failed:', error);
            return null;
        }
    },

    getRadarSignals: async (): Promise<RadarSignal[]> => {
        try {
            const { data } = await apiClient.get<RadarSignal[]>('/market/radar');
            return data;
        } catch (error) {
            console.error('[API] getRadarSignals failed:', error);
            return [];
        }
    },

    getTopMovers: async (): Promise<TopMover[]> => {
        try {
            const { data } = await apiClient.get<TopMover[]>('/market/movers');
            return data;
        } catch (error) {
            console.error('[API] getTopMovers failed:', error);
            return [];
        }
    },

    getAssetCount: async (): Promise<number> => {
        try {
            const { data } = await apiClient.get<{ count: number }>('/market/asset-count');
            return data.count;
        } catch (error) {
            console.error('[API] getAssetCount failed:', error);
            return 0;
        }
    }
};

