import { apiClient } from '@/features/shared/api/client';
import type { PublicMarketContextResponse } from './types';

export const marketContextApi = {
    getLatestPublished: async (): Promise<PublicMarketContextResponse> => {
        try {
            const { data } = await apiClient.get<PublicMarketContextResponse>(
                '/market/market-context'
            );
            return data;
        } catch {
            return { available: false, snapshot: null };
        }
    },
};

export function formatEditionLabel(kind: string, weekLabel: string | null): string {
    if (weekLabel?.trim()) return weekLabel.trim();
    const normalized = kind.replace(/_/g, ' ').trim();
    if (!normalized) return 'Edition';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatPublishedDate(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
