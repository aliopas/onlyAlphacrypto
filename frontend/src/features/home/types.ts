// Types for the Home Dashboard features

export type MarketMood = {
    externalScore?: number;
    internalScore?: number;
    finalScore?: number;  // primary score from backend
    score?: number;       // alias (same as finalScore, kept for compatibility)
    label: string;
};

export type AlphaFocus = {
    // original DB fields
    coinSymbol: string;
    coinName: string;
    verdict: string;
    confidenceScore: number;
    executiveSummary: string;
    compositeScore: number;
    // mapped fields used in UI
    coin: string;          // = coinSymbol
    confidence: number;    // = confidenceScore
    summary: string;       // = executiveSummary
    price?: number;
    priceChange24h?: number;
};

export type RadarSignal = {
    id: number;
    // original
    coinSymbol?: string;
    signalText?: string;
    // mapped fields used in UI
    coin: string;          // = coinSymbol
    signal: string;        // = signalText
    sentiment: string;
    impactScore?: number;
    createdAt: string;
    formattedTime?: string;
};

export type TopMover = {
    symbol: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
};
