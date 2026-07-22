// Types for the Airdrops features (DEC-041 AD-4 portfolio card)

export type AirdropTask = {
    id: number;
    projectId: number;
    description: string;
    contractAddress?: string;
    minAmount?: string;
    tokenSymbol?: string;
    chain?: string;
    isAutoVerifiable: boolean;
    orderIndex: number;
};

/** Portfolio card task (may lack DB id) */
export type PortfolioTaskItem = {
    id: number | null;
    description: string;
    isAutoVerifiable: boolean;
    chain: string | null;
};

export type PortfolioMoodStrip = {
    window: '24h' | '7d';
    moodLabel: 'cold' | 'warming' | 'hot' | 'toxic';
    mentionCount: number;
    uniqueSourceCount: number;
    hypeScore: number;
    fudScore: number;
    controversyFlag: boolean;
    computedAt: string | null;
};

export type PortfolioDateSignal = {
    kind: string;
    isoDate: string | null;
    raw?: string;
    confidence: 'low' | 'medium' | 'high';
};

export type PortfolioProvenanceLink = {
    label: string;
    url: string;
    kind: 'signal' | 'cited' | 'official' | 'social';
};

export type AirdropProject = {
    id: number;
    name: string;
    logoUrl?: string | null;
    network: string;
    estValue?: string | null;
    aiReport?: string | null;
    riskVerdict: string;
    isActive: boolean;
    snapshotAt?: string | null;
    tgeAt?: string | null;
    createdAt: string;
    updatedAt: string;
    tasks?: Array<AirdropTask | PortfolioTaskItem>;
    progressPercent?: number;
    ecosystem?: string | null;
    effortLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | string | null;
    rewardConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED' | string | null;
    qualityScore?: number;
    /** AD-4 portfolio fields */
    pipelineStatus?: string;
    publishPath?: string;
    whyFarmNow?: string;
    teamSummary?: string;
    docsSummary?: string;
    fundingSummary?: string;
    howItWorks?: string;
    dates?: PortfolioDateSignal[];
    mood?: {
        strip24h: PortfolioMoodStrip | null;
        strip7d: PortfolioMoodStrip | null;
    };
    moodLabel?: string | null;
    provenanceLinks?: PortfolioProvenanceLink[];
    provenanceCount?: number;
    taskCount?: number;
    websiteUrl?: string | null;
    twitterUrl?: string | null;
    discordUrl?: string | null;
    fundingRound?: string | null;
    nfaDisclaimer?: string;
};

export type UserProgress = {
    id: number;
    userId: number;
    taskId: number;
    walletId?: number;
    completed: boolean;
    completedAt?: string;
    verifiedBy?: 'auto' | 'manual';
    txHash?: string;
};

export type UrgentAirdrop = {
    id: number;
    name: string;
    logoUrl: string | null;
    network: string;
    estValue: string | null;
    riskVerdict: string | null;
    snapshotAt: string | null;
    tgeAt: string | null;
    createdAt: string;
    urgencyScore: number;
    daysLeft: number | null;
    isNew: boolean;
    progressPercent: number;
    qualityScore?: number;
};

export type ProgressResponse = {
    percent: number;
    completedCount: number;
    totalCount: number;
    userProgress: UserProgress[];
};
