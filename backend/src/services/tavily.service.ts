import axios from 'axios';
import { env } from '../config/env';

// Phase 2 (Aggregator): Scam check / investigation via Tavily
export async function searchTavily(query: string): Promise<string> {
    try {
        const apiKey = process.env['Tavily-Api'];
        if (!apiKey) {
            console.warn('[Tavily] No Tavily-Api key found in .env, skipping search.');
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
            return res.data.results.map((r: any) => r.content).join(' | ');
        }

        return '';
    } catch (err: any) {
        console.error(`[Tavily] Error searching for "${query}":`, err.message);
        return '';
    }
}
