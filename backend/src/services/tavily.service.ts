import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Phase 2 (Aggregator): Scam check / investigation via Tavily
export async function searchTavily(query: string): Promise<string> {
    try {
        const apiKey = env.TAVILY_API_KEY;
        if (!apiKey) {
            logger.warn('[Tavily] No TAVILY_API_KEY configured — search functionality disabled');
            return '';
        }

        const res = await axios.post(
            'https://api.tavily.com/search',
            {
                api_key: apiKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 3
            },
            { timeout: 15000 }
        );

        if (res.data && res.data.answer) {
            return res.data.answer;
        }

        if (res.data && res.data.results && res.data.results.length > 0) {
            return res.data.results.map((r: { content?: string }) => r.content ?? '').filter(Boolean).join(' | ');
        }

        return '';
    } catch (err: unknown) {
        console.error(`[Tavily] Error searching for "${query}":`, err instanceof Error ? err.message : String(err));
        return '';
    }
}
