import { apiClient } from '@/features/shared/api/client';
import { MarketMood, AlphaFocus, RadarSignal, TopMover } from './types';
import { MOCK_MARKET_MOOD, MOCK_ALPHA_FOCUS, MOCK_RADAR_SIGNALS } from '@/features/shared/api/mockData';

const isMock = process.env.NEXT_PUBLIC_API_MODE === 'mock';

export const homeApi = {
    getMarketMood: async (): Promise<MarketMood | null> => {
        if (isMock) return MOCK_MARKET_MOOD;
        try {
            const { data } = await apiClient.get<MarketMood>('/market/mood');
            return data;
        } catch {
            return null;
        }
    },

    getAlphaFocus: async (): Promise<AlphaFocus | null> => {
        if (isMock) return MOCK_ALPHA_FOCUS;
        try {
            const { data } = await apiClient.get<AlphaFocus>('/market/alpha-focus');
            return data;
        } catch {
            return null;
        }
    },

    getRadarSignals: async (): Promise<RadarSignal[]> => {
        if (isMock) return MOCK_RADAR_SIGNALS;
        try {
            const { data } = await apiClient.get<RadarSignal[]>('/market/radar');
            return data;
        } catch {
            return [];
        }
    },

    getTopMovers: async (): Promise<TopMover[]> => {
        try {
            const { data } = await apiClient.get<TopMover[]>('/market/movers');
            return data;
        } catch {
            return [];
        }
    }
};

