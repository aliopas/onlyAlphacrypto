// Types for the Terminal features

export type CoinNews = {
    id: number;
    coinSymbol?: string;   // from backend DB
    coin?: string;          // mapped alias used in some components
    headline: string;
    summary?: string;
    hook?: string;          // SEO opening hook sentence
    metaTitle?: string;     // SEO meta title
    metaDescription?: string; // SEO meta description
    seoKeywords?: string[]; // SEO target keywords
    sourceUrl?: string;
    url?: string;           // alias
    source?: string;
    sentiment?: string;
    impactScore?: number;
    isBreaking?: number;
    createdAt: string;
    publishedAt?: string;
    formattedTime?: string;
};


