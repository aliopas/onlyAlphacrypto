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
        // CryptoPanic search requires an auth token on API. If it fails, fallback gracefully.
        // Since we are asked to use free features, we will attempt the public news and filter manually
        // if the search endpoint fails without a key.
        const res = await axios.get(`https://cryptopanic.com/api/v1/posts/?public=true`, { timeout: 10000 });
        if (!res.data || !res.data.results) return [];

        const lowerQuery = query.toLowerCase();
        return res.data.results
            .filter((post: any) => post.title.toLowerCase().includes(lowerQuery))
            .map((post: any) => post.title);

    } catch (err: any) {
        console.warn(`[CryptoPanic] Search failed for ${query}:`, err.message);
        return [];
    }
}
