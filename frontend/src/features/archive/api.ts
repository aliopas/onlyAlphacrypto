import { apiClient } from '@/features/shared/api/client';
import { ArchiveArticle } from './types';

export const archiveApi = {
  getArchiveArticles: async (): Promise<ArchiveArticle[]> => {
    try {
      const { data } = await apiClient.get<ArchiveArticle[]>('/market/archive');
      return data;
    } catch (error) {
      console.error('[API] getArchiveArticles failed:', error);
      return [];
    }
  },
};
