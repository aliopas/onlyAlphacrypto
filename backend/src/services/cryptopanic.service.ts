import axios from 'axios';

// Phase 1 & 2: Get news from CryptoPanic
// CryptoPanic has a free tier that doesn't strictly always require an API key for public endpoints, 
// though using an API key gives better limits. We'll use the public endpoint as requested.
export async function getCryptoPanicNews(filter?: string): Promise<string[]> {
    try {
        let url = 'https://cryptopanic.com/api/v1/posts/?public=true';
        if (filter) {
            url += `&filter=${filter}`; // e.g. 'rising', 'hot', 'bullish', 'bearish'
        }

        const res = await axios.get(url, { timeout: 10000 });

        if (!res.data || !res.data.results) {
            return [];
        }

        return res.data.results.map((post: any) => post.title);
    } catch (err: any) {
        if (err.response && err.response.status === 403) {
            console.error('[CryptoPanic] API key required or rate limited.');
        } else {
            console.error('[CryptoPanic] Error fetching news:', err.message);
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

        return res.data.results.map((post: any) => post.title);

    } catch (err: any) {
        if (err.response?.status === 404) {
            // Token not indexed in CryptoPanic — expected for small/new DexScreener tokens
            return [];
        }
        if (err.response?.status === 429) {
            console.warn(`[CryptoPanic] Rate limited for "${query}" — returning empty. Consider adding CRYPTOPANIC_API_KEY.`);
            return [];
        }
        console.warn(`[CryptoPanic] Search failed for ${query}:`, err.message);
        return [];
    }
}
