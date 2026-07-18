export interface PublicMarketContextSnapshot {
    id: number;
    snapshotKey: string;
    kind: string;
    weekLabel: string | null;
    status: 'published';
    marketDataVersion: string | null;
    generatorVersion: string;
    generatedAt: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
}

export interface PublicMarketContextResponse {
    available: boolean;
    snapshot: PublicMarketContextSnapshot | null;
}
