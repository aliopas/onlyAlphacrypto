import axios from 'axios';

export async function getCryptoPanicNews(filter?: string): Promise<string[]> {
    try {
        let url = 'https://cryptopanic.com/api/v1/posts/?public=true';
        if (filter) {
            url += `&filter=${filter}`;
        }

        const res = await axios.get(url, { timeout: 10000 });

        if (!res.data || !res.data.results) {
            return [];
        }

        return res.data.results.map((post: { title?: string }) => post.title ?? '').filter(Boolean);
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            if (err.response?.status === 403) {
                console.error('[CryptoPanic] API key required or rate limited.');
            } else {
                console.error('[CryptoPanic] Error fetching news:', err.message);
            }
        } else {
            console.error('[CryptoPanic] Error fetching news:', err instanceof Error ? err.message : String(err));
        }
        return [];
    }
}

export async function searchCryptoPanic(query: string): Promise<string[]> {
    try {
        let url = `https://cryptopanic.com/api/v1/posts/?public=true&currencies=${encodeURIComponent(query.toUpperCase())}`;
        if (process.env.CRYPTOPANIC_API_KEY) {
            url += `&auth_token=${process.env.CRYPTOPANIC_API_KEY}`;
        }

        const res = await axios.get(url, { timeout: 10000 });
        if (!res.data || !res.data.results) return [];

        return res.data.results.map((post: { title?: string }) => post.title ?? '').filter(Boolean);

    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            if (err.response?.status === 404) {
                return [];
            }
            if (err.response?.status === 429) {
                console.warn(`[CryptoPanic] Rate limited for "${query}" — returning empty.`);
                return [];
            }
            console.warn(`[CryptoPanic] Search failed for ${query}:`, err.message);
        }
        return [];
    }
}
