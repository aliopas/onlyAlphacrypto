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

export type MasterArticle = {
    id: number;
    coinSymbol: string;
    headline: string;
    hook: string | null;
    coreCatalyst: string | null;
    marketContext: string | null;
    strategicImpact: string | null;
    historicalContext: string | null;
    technicalLevels: string | null;
    riskAssessment: string | null;
    bottomLine: string | null;
    sentiment: string | null;
    verdict: string | null;
    confidenceScore: number | null;
    convictionScore: number | null;
    posture: string | null;
    riskTags: string[] | null;
    triggerType: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    seoKeywords: string[] | null;
    majorUpdateCount: number;
    minorUpdateCount: number;
    lastMajorUpdate: string | null;
    lastMinorUpdate: string | null;
    createdAt: string;
    updatedAt: string;
};

export type TimelineUpdate = {
    id: number;
    coinSymbol: string;
    masterArticleId: number;
    updateText: string;
    triggerType: string | null;
    severity: string;
    sourceTitle: string | null;
    sourceHash: string | null;
    sentiment: string | null;
    impactScore: number | null;
    convictionDelta: number | null;
    createdAt: string;
};

export type MasterArticleResponse = {
    masterArticle: MasterArticle | null;
    timelineUpdates: TimelineUpdate[];
    convictionScore: number | null;
    posture: string | null;
};

export type TimelineResponse = {
    updates: TimelineUpdate[];
    total: number;
};


