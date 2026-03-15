// Types for the Terminal features

export type CoinNews = {
    id: number;
    coin: string;
    headline: string;
    summary?: string;
    url?: string;
    source?: string;
    sentiment?: string;
    createdAt: string;
};

export type AnalysisStream = {
    id: string;
    coinPair: string; // e.g., 'SOL-USDT'
    analysisId: string; // e.g., 'OA-9921-X'
    title: string;
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
    executiveSummary: string[];
    detailedAnalysis: string;
    updatedAt: string;
};
