import Parser from 'rss-parser';

const parser = new Parser();

export interface RSSNewsItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet?: string;
    source: string;
}

const RSS_SOURCES = [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
];

export async function fetchAllRSSNews(): Promise<RSSNewsItem[]> {
    const allNews: RSSNewsItem[] = [];

    const fetchPromises = RSS_SOURCES.map(async (source) => {
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 10).map((item) => ({
                title: item.title || '',
                link: item.link || '',
                pubDate: item.pubDate || '',
                contentSnippet: item.contentSnippet,
                source: source.name,
            }));
            allNews.push(...items);
        } catch (error) {
            console.error(`[RSSService] Error fetching from ${source.name}:`, error);
        }
    });

    await Promise.all(fetchPromises);
    
    // Sort by publication date (newest first)
    return allNews.sort((a, b) => 
        new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
}
