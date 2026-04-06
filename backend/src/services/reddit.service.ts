import axios from 'axios';

// Phase 1 (Hunter): Get Hot topics from r/CryptoCurrency
export async function getHotCryptoTopics(): Promise<string[]> {
    try {
        const res = await axios.get('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=15', {
            headers: {
                'User-Agent': 'CryptoBot/1.0'
            },
            timeout: 10000
        });

        if (!res.data || !res.data.data || !res.data.data.children) {
            return [];
        }

        const topics = res.data.data.children
            .map((child: { data?: { title?: string } }) => child.data?.title ?? '')
            .filter((title: string) => title && title.length > 5);

        return topics;
    } catch (err) {
        console.error('[Reddit] Error fetching hot topics:', err);
        return [];
    }
}
