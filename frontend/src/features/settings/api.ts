import { apiClient } from '@/features/shared/api/client';
import { UserProfile, UserPreferences, UserWallet, ApiKey } from './types';

export const settingsApi = {
    getMe: async (): Promise<UserProfile | null> => {
        try {
            const { data } = await apiClient.get<UserProfile>('/user/me');
            return data;
        } catch { return null; }
    },

    updatePreferences: async (prefs: Partial<UserPreferences>): Promise<void> => {
        await apiClient.patch('/user/me', prefs);
    },

    upgradePlan: async (plan: string): Promise<void> => {
        await apiClient.patch('/user/plan', { plan });
    },

    addWallet: async (address: string, label?: string, chains?: string[]): Promise<UserWallet> => {
        const { data } = await apiClient.post<UserWallet>('/user/wallets', { address, label, chains });
        return data;
    },

    deleteWallet: async (id: number): Promise<void> => {
        await apiClient.delete(`/user/wallets/${id}`);
    },

    listApiKeys: async (): Promise<ApiKey[]> => {
        try {
            const { data } = await apiClient.get<ApiKey[]>('/user/api-keys');
            return data;
        } catch { return []; }
    },

    createApiKey: async (name: string): Promise<ApiKey> => {
        const { data } = await apiClient.post<ApiKey>('/user/api-keys', { name });
        return data;
    },

    revokeApiKey: async (id: number): Promise<void> => {
        await apiClient.delete(`/user/api-keys/${id}`);
    },
};
